/**
 * Derives the country graph from world-atlas 50m and the curated tables in
 * src/game/, then writes src/game/data/countries.generated.ts.
 *
 *   npm run graph
 *
 * Land adjacency comes from shared arcs in the TopoJSON topology — it is never
 * hand-written. Everything hand-written lives in playSet.ts, seaLinks.ts and
 * names.ts, and this script is what combines them.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { neighbors, feature } from 'topojson-client'
import { geoArea, geoCentroid } from 'd3-geo'
import iso from 'i18n-iso-countries'
import { DISPUTED, EXCLUDED, EDGE_BLACKLIST } from '../src/game/playSet.ts'
import { SEA_LINKS } from '../src/game/seaLinks.ts'
import { NAME_OVERRIDES, ALIASES } from '../src/game/names.ts'
import type { CountryCode } from '../src/game/types.ts'
import type { Feature, MultiPolygon, Polygon } from 'geojson'

const url = (p: string) => fileURLToPath(new URL(p, import.meta.url))

type NeGeometry = { id?: string; properties: { name: string } }
type NeTopology = { objects: { countries: { geometries: NeGeometry[] } } }

const topology = JSON.parse(
  readFileSync(url('../node_modules/world-atlas/countries-50m.json'), 'utf8'),
) as NeTopology

const geometries = topology.objects.countries.geometries
const adjacentGeometries = neighbors(geometries as never)

const fail = (message: string): never => {
  console.error(`\n  ${message}\n`)
  process.exit(1)
}

// ---------------------------------------------------------------- resolve codes

/**
 * Which country each geometry counts as, or null if it is out of play.
 * A merged disputed entity resolves to its parent, which is how the parent
 * inherits its borders.
 */
const codeOfGeometry = geometries.map((geometry): CountryCode | null => {
  const { name } = geometry.properties

  const disputed = DISPUTED[name]
  if (disputed) return disputed.mode === 'play' ? disputed.code : disputed.parent

  if (EXCLUDED.has(name)) return null

  if (!geometry.id) {
    return fail(`"${name}" has no ISO numeric id. Add it to EXCLUDED or DISPUTED in playSet.ts.`)
  }
  const alpha3 = iso.numericToAlpha3(geometry.id)
  if (!alpha3) return fail(`No alpha-3 for "${name}" (numeric ${geometry.id}).`)
  return alpha3
})

/** The geometry that *is* this country, as opposed to one merged into it. */
const primaryGeometry = new Map<CountryCode, number>()
codeOfGeometry.forEach((code, index) => {
  if (!code) return
  const isMerged = DISPUTED[geometries[index]!.properties.name]?.mode === 'merge'
  if (!isMerged || !primaryGeometry.has(code)) primaryGeometry.set(code, index)
})

// ---------------------------------------------------------------------- edges

const edges = new Map<CountryCode, Set<CountryCode>>()
for (const code of primaryGeometry.keys()) edges.set(code, new Set())

const link = (a: CountryCode, b: CountryCode) => {
  edges.get(a)!.add(b)
  edges.get(b)!.add(a)
}
const unlink = (a: CountryCode, b: CountryCode) => {
  edges.get(a)?.delete(b)
  edges.get(b)?.delete(a)
}

adjacentGeometries.forEach((neighbourIndexes, index) => {
  const a = codeOfGeometry[index]
  if (!a) return
  for (const neighbourIndex of neighbourIndexes) {
    const b = codeOfGeometry[neighbourIndex]
    // Self-adjacency is real here: a merged entity shares a border with its parent.
    if (b && a !== b) link(a, b)
  }
})

for (const [a, b] of EDGE_BLACKLIST) unlink(a, b)

for (const { a, b, why } of SEA_LINKS) {
  if (!edges.has(a)) fail(`Sea link ${a}–${b} ("${why}") references unknown country ${a}.`)
  if (!edges.has(b)) fail(`Sea link ${a}–${b} ("${why}") references unknown country ${b}.`)
  if (a === b) fail(`Sea link ${a}–${b} ("${why}") links a country to itself.`)
  link(a, b)
}

// ------------------------------------------------------------------ countries

const displayName = (code: CountryCode, index: number): string => {
  const override = NAME_OVERRIDES[code]
  if (override) return override
  const disputed = DISPUTED[geometries[index]!.properties.name]
  if (disputed?.mode === 'play') return disputed.name
  return geometries[index]!.properties.name
}

const countries = [...primaryGeometry.entries()]
  .map(([code, index]) => {
    const [longitude, latitude] = mainlandCentroid(index)
    return {
      code,
      name: displayName(code, index),
      aliases: ALIASES[code] ?? [],
      centroid: [round(longitude), round(latitude)] as const,
      neighbours: [...edges.get(code)!].sort(),
    }
  })
  .sort((x, y) => x.code.localeCompare(y.code))

function round(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Centroid of the country's largest landmass, not of all its polygons. France
 * owns islands in three oceans; averaging them puts "France" in the Bay of
 * Biscay. The biggest piece is the one people picture.
 */
function mainlandCentroid(index: number): [number, number] {
  const shape = feature(topology as never, geometries[index] as never) as unknown as Feature<
    Polygon | MultiPolygon
  >
  const { geometry } = shape
  if (geometry.type === 'Polygon') return geoCentroid(geometry) as [number, number]

  let biggest = geometry.coordinates[0]!
  let biggestArea = -1
  for (const coordinates of geometry.coordinates) {
    const area = geoArea({ type: 'Polygon', coordinates })
    if (area > biggestArea) {
      biggestArea = area
      biggest = coordinates
    }
  }
  return geoCentroid({ type: 'Polygon', coordinates: biggest }) as [number, number]
}

// ----------------------------------------------------------------- invariants

const byCode = new Map(countries.map((c) => [c.code, c]))

for (const country of countries) {
  if (country.neighbours.includes(country.code)) fail(`${country.code} borders itself.`)
  for (const neighbour of country.neighbours) {
    const other = byCode.get(neighbour)
    if (!other) fail(`${country.code} borders unknown ${neighbour}.`)
    if (!other!.neighbours.includes(country.code)) {
      fail(`Asymmetric border: ${country.code} -> ${neighbour} but not back.`)
    }
  }
}

const reachable = (start: CountryCode): Set<CountryCode> => {
  const seen = new Set([start])
  const queue = [start]
  for (let i = 0; i < queue.length; i++) {
    for (const next of byCode.get(queue[i]!)!.neighbours) {
      if (!seen.has(next)) {
        seen.add(next)
        queue.push(next)
      }
    }
  }
  return seen
}

const connected = reachable(countries[0]!.code)
if (connected.size !== countries.length) {
  const stranded = countries.filter((c) => !connected.has(c.code)).map((c) => `${c.name} (${c.code})`)
  fail(`${stranded.length} countries unreachable. Add sea links for:\n  ${stranded.join('\n  ')}`)
}

// ---------------------------------------------------------------------- write

const body = countries
  .map(
    (c) =>
      `  { code: '${c.code}', name: ${JSON.stringify(c.name)}, aliases: ${JSON.stringify(c.aliases)},` +
      ` centroid: [${c.centroid[0]}, ${c.centroid[1]}], neighbours: ${JSON.stringify(c.neighbours)} },`,
  )
  .join('\n')

/**
 * Which country each map polygon belongs to, keyed by the only identifier the
 * renderer has. Emitted rather than recomputed so the map cannot disagree with
 * the graph about what Morocco is.
 */
const shapeNames = geometries.map((geometry) => geometry.properties.name)
if (new Set(shapeNames).size !== shapeNames.length) {
  fail('Two map polygons share a name, so shapes cannot be matched to countries.')
}

const shapeBody = shapeNames
  .map((shapeName, index) => {
    const code = codeOfGeometry[index]
    return `  ${JSON.stringify(shapeName)}: ${code ? `'${code}'` : 'null'},`
  })
  .sort()
  .join('\n')

writeFileSync(
  url('../src/game/data/countries.generated.ts'),
  `// Generated by scripts/buildGraph.ts from world-atlas 50m. Do not edit.\n` +
    `// Run \`npm run graph\` after changing playSet.ts, seaLinks.ts or names.ts.\n\n` +
    `import type { Country, CountryCode } from '../types.ts'\n\n` +
    `export const COUNTRIES: readonly Country[] = [\n${body}\n]\n\n` +
    `/** Natural Earth polygon name -> the country it draws, or null if out of play. */\n` +
    `export const SHAPE_CODES: Readonly<Record<string, CountryCode | null>> = {\n${shapeBody}\n}\n`,
)

// --------------------------------------------------------------------- report

const degrees = countries.map((c) => c.neighbours.length)
const deadEnds = countries.filter((c) => c.neighbours.length === 1)

console.log(`\n  ${countries.length} countries, ${degrees.reduce((a, b) => a + b, 0) / 2} borders`)
console.log(`  ${SEA_LINKS.length} of them sea links`)
console.log(`  connected: yes`)
console.log(`\n  dead ends (${deadEnds.length}):`)
for (const c of deadEnds) console.log(`    ${c.name} -> ${byCode.get(c.neighbours[0]!)!.name}`)
console.log('\n  wrote src/game/data/countries.generated.ts\n')
