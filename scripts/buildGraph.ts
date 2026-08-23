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
import {
  ALIASES,
  NAME_OVERRIDES,
  TRANSLATED_ALIASES,
  TRANSLATED_OVERRIDES,
} from '../src/game/names.ts'
import { LANGUAGE_CODES } from '../src/game/languages.ts'
import type { LanguageCode } from '../src/game/languages.ts'
import { SETTINGS } from '../src/settings.ts'
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

// ------------------------------------------------------------------ landmasses

const neighboursOf = (code: CountryCode) => [...(edges.get(code) ?? [])]

const distancesFrom = (start: CountryCode): Map<CountryCode, number> => {
  const depth = new Map([[start, 0]])
  const queue = [start]
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i]!
    for (const next of neighboursOf(current)) {
      if (depth.has(next)) continue
      depth.set(next, depth.get(current)! + 1)
      queue.push(next)
    }
  }
  return depth
}

const seen = new Set<CountryCode>()
const landmasses: CountryCode[][] = []
for (const code of edges.keys()) {
  if (seen.has(code)) continue
  const members = [...distancesFrom(code).keys()]
  for (const member of members) seen.add(member)
  landmasses.push(members)
}
landmasses.sort((a, b) => b.length - a.length)

/** The longest shortest path inside a landmass — how far apart two starts could be. */
const diameterOf = (members: CountryCode[]): number => {
  let longest = 0
  for (const member of members) {
    for (const hops of distancesFrom(member).values()) longest = Math.max(longest, hops)
  }
  return longest
}

/**
 * A landmass can host a game only if two countries on it can be far enough
 * apart. Anything smaller is out of play, which is what stops the generator
 * from ever producing an unwinnable start pair.
 */
const componentOf = new Map<CountryCode, number>()
const playableLandmasses: CountryCode[][] = []
const droppedLandmasses: CountryCode[][] = []

for (const members of landmasses) {
  if (diameterOf(members) >= SETTINGS.minHops) {
    const index = playableLandmasses.length
    for (const member of members) componentOf.set(member, index)
    playableLandmasses.push(members)
  } else {
    droppedLandmasses.push(members)
  }
}

if (playableLandmasses.length === 0) {
  fail(`No landmass has two countries ${SETTINGS.minHops} borders apart. Enable more sea links.`)
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
      component: componentOf.get(code) ?? null,
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
    if (country.component !== other!.component) {
      fail(`${country.code} and ${neighbour} border each other but are on different landmasses.`)
    }
  }
  if (country.component !== null && country.neighbours.length === 0) {
    fail(`${country.code} is in play but borders nothing.`)
  }
}

for (const [index, members] of playableLandmasses.entries()) {
  const reached = distancesFrom(members[0]!)
  if (reached.size !== members.length) fail(`Landmass ${index} is not internally connected.`)
}

// --------------------------------------------------------------- translations

/**
 * Names in every language the game offers. CLDR by way of `Intl.DisplayNames`,
 * which is far closer to what people actually say than the official forms —
 * "Duitsland" rather than "Bondsrepubliek Duitsland".
 *
 * English is deliberately not taken from CLDR: Natural Earth's names are
 * shorter and the overrides above already tune them.
 */
const translate = (language: LanguageCode) => {
  const display = new Intl.DisplayNames([language], { type: 'region' })
  const overrides = TRANSLATED_OVERRIDES[language] ?? {}

  return (code: CountryCode): { name: string; aliases: string[] } | null => {
    const override = overrides[code]
    if (override) return { name: override, aliases: [] }

    const alpha2 = iso.alpha3ToAlpha2(code)
    if (!alpha2) return null

    let name: string
    try {
      name = display.of(alpha2) ?? alpha2
    } catch {
      return null
    }
    // `of` echoes the code back when CLDR has no record for it.
    if (name === alpha2) return null

    // "Myanmar (Burma)" is two names in one field: keep the first, accept both.
    const aliases: string[] = []
    const parenthetical = name.match(/^(.+?)\s*\((.+)\)\s*$/)
    if (parenthetical) {
      aliases.push(parenthetical[2]!.trim())
      name = parenthetical[1]!.trim()
    }
    return { name: name.replace(/\s+/g, ' ').trim(), aliases }
  }
}

const translations = new Map<LanguageCode, Map<CountryCode, { name: string; aliases: string[] }>>()

for (const language of LANGUAGE_CODES) {
  const lookup = translate(language)
  const forLanguage = new Map<CountryCode, { name: string; aliases: string[] }>()

  for (const country of countries) {
    const extra = TRANSLATED_ALIASES[language]?.[country.code] ?? []

    if (language === 'en') {
      forLanguage.set(country.code, { name: country.name, aliases: [...country.aliases] })
      continue
    }

    const translated = lookup(country.code)
    if (!translated) {
      if (country.component !== null) {
        fail(`No ${language} name for ${country.code} (${country.name}). Add one to TRANSLATED_OVERRIDES.`)
      }
      // Out of play, so it only ever appears as a refusal message: English will do.
      forLanguage.set(country.code, { name: country.name, aliases: [] })
      continue
    }

    forLanguage.set(country.code, {
      name: translated.name,
      aliases: [...new Set([...translated.aliases, ...extra])],
    })
  }
  translations.set(language, forLanguage)
}

// ---------------------------------------------------------------------- write

const body = countries
  .map(
    (c) =>
      `  { code: '${c.code}', name: ${JSON.stringify(c.name)}, aliases: ${JSON.stringify(c.aliases)},` +
      ` centroid: [${c.centroid[0]}, ${c.centroid[1]}], component: ${c.component},` +
      ` neighbours: ${JSON.stringify(c.neighbours)} },`,
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
    `/** Natural Earth polygon name -> the country it draws, or null if it is not a country here. */\n` +
    `export const SHAPE_CODES: Readonly<Record<string, CountryCode | null>> = {\n${shapeBody}\n}\n`,
)

const namesBody = LANGUAGE_CODES.map((language) => {
  const rows = countries
    .map((c) => `    ${c.code}: ${JSON.stringify(translations.get(language)!.get(c.code)!.name)},`)
    .join('\n')
  return `  ${language}: {\n${rows}\n  },`
}).join('\n')

const aliasBody = LANGUAGE_CODES.map((language) => {
  const rows = countries
    .filter((c) => translations.get(language)!.get(c.code)!.aliases.length > 0)
    .map((c) => `    ${c.code}: ${JSON.stringify(translations.get(language)!.get(c.code)!.aliases)},`)
    .join('\n')
  return `  ${language}: {\n${rows}\n  },`
}).join('\n')

writeFileSync(
  url('../src/game/data/names.generated.ts'),
  `// Generated by scripts/buildGraph.ts. Do not edit.\n` +
    `// English from Natural Earth, everything else from CLDR via Intl.DisplayNames.\n` +
    `// Run \`npm run graph\` after changing names.ts or languages.ts.\n\n` +
    `import type { CountryCode } from '../types.ts'\n` +
    `import type { LanguageCode } from '../languages.ts'\n\n` +
    `export const NAMES: Readonly<Record<LanguageCode, Readonly<Record<CountryCode, string>>>> = {\n` +
    `${namesBody}\n}\n\n` +
    `export const NAME_ALIASES: Readonly<\n` +
    `  Record<LanguageCode, Readonly<Record<CountryCode, readonly string[]>>>\n` +
    `> = {\n${aliasBody}\n}\n`,
)

// --------------------------------------------------------------------- report

const inPlay = countries.filter((c) => c.component !== null)
const borders = inPlay.reduce((total, c) => total + c.neighbours.length, 0) / 2

console.log(`\n  ${countries.length} countries known, ${inPlay.length} in play, ${borders} borders`)
console.log(`  ${SEA_LINKS.length} sea links enabled\n`)

for (const [index, members] of playableLandmasses.entries()) {
  const biggest = members
    .map((code) => byCode.get(code)!)
    .sort((a, b) => b.neighbours.length - a.neighbours.length)[0]!
  console.log(
    `  landmass ${index}: ${String(members.length).padStart(3)} countries, ` +
      `diameter ${diameterOf(members)}, hub ${biggest.name}`,
  )
}

const dropped = droppedLandmasses.flat()
console.log(`\n  ${dropped.length} out of play, no land route to a playable landmass:`)
console.log(
  '   ',
  dropped
    .map((code) => byCode.get(code)!.name)
    .sort()
    .join(', '),
)
console.log('\n  wrote src/game/data/countries.generated.ts\n')
