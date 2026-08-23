import { useMemo } from 'react'
import { geoNaturalEarth1, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import type { Feature, Geometry } from 'geojson'
import topology from 'world-atlas/countries-50m.json'
import { SHAPE_CODES } from '../game/data/countries.generated.ts'
import { getCountry } from '../game/graph.ts'
import type { CountryCode } from '../game/types.ts'

const WIDTH = 960
const HEIGHT = 500

/** Below this many square pixels a country is invisible and gets a dot instead. */
const TOO_SMALL = 6

const projection = geoNaturalEarth1().fitSize([WIDTH, HEIGHT], { type: 'Sphere' })
const path = geoPath(projection)

type Shape = {
  readonly code: CountryCode | null
  readonly d: string
  readonly tiny: boolean
}

const SHAPES: readonly Shape[] = (() => {
  const collection = feature(topology, topology.objects.countries!) as unknown as {
    features: Feature<Geometry, { name: string }>[]
  }
  return collection.features.flatMap((shape) => {
    const d = path(shape)
    if (!d) return []
    return [{ code: SHAPE_CODES[shape.properties.name] ?? null, d, tiny: path.area(shape) < TOO_SMALL }]
  })
})()

const SHAPE_BY_CODE = new Map<CountryCode, Shape>()
for (const shape of SHAPES) {
  if (shape.code && !SHAPE_BY_CODE.has(shape.code)) SHAPE_BY_CODE.set(shape.code, shape)
}

const projectCentroid = (code: CountryCode): [number, number] | null => {
  const point = projection(getCountry(code).centroid as [number, number])
  return point ? [point[0], point[1]] : null
}

export type WorldMapProps = {
  readonly chains: readonly [readonly CountryCode[], readonly CountryCode[]]
  /** Drawn as a dashed line at the end of the game. */
  readonly revealedRoute?: readonly CountryCode[]
}

export function WorldMap({ chains, revealedRoute }: WorldMapProps) {
  const owner = useMemo(() => {
    const map = new Map<CountryCode, 0 | 1>()
    chains[0].forEach((code) => map.set(code, 0))
    chains[1].forEach((code) => map.set(code, 1))
    return map
  }, [chains])

  const heads: readonly (CountryCode | undefined)[] = [chains[0].at(-1), chains[1].at(-1)]

  const routeLine = useMemo(() => {
    if (!revealedRoute || revealedRoute.length < 2) return null
    const points = revealedRoute.map(projectCentroid).filter((p): p is [number, number] => p !== null)
    return points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ')
  }, [revealedRoute])

  return (
    <svg className="map" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="World map">
      <path className="sphere" d={path({ type: 'Sphere' }) ?? undefined} />

      {SHAPES.map((shape, index) => {
        const player = shape.code ? owner.get(shape.code) : undefined
        const className =
          shape.code === null
            ? 'land out-of-play'
            : player === undefined
              ? 'land'
              : `land player-${player}${heads.includes(shape.code) ? ' current' : ''}`
        return <path key={index} className={className} d={shape.d} />
      })}

      {routeLine && <path className="route" d={routeLine} />}

      {/* Microstates are smaller than a pixel at this scale, so they get a dot. */}
      {[0, 1].map((player) =>
        chains[player]!.map((code) => {
          const point = projectCentroid(code)
          if (!SHAPE_BY_CODE.get(code)?.tiny || !point) return null
          return (
            <circle key={`tiny-${code}`} className={`tiny player-${player}`} cx={point[0]} cy={point[1]} r={3} />
          )
        }),
      )}

      {/* A ring in the ocean colour, so the head reads even on top of its own fill. */}
      {heads.map((code, player) => {
        const point = code ? projectCentroid(code) : null
        if (!point) return null
        return (
          <g key={`head-${player}`} className={`head player-${player}`}>
            <circle className="halo" cx={point[0]} cy={point[1]} r={8} />
            <circle className="ring" cx={point[0]} cy={point[1]} r={8} />
          </g>
        )
      })}
    </svg>
  )
}
