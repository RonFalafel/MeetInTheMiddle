import { useCallback, useEffect, useMemo, useState } from 'react'
import { geoNaturalEarth1, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import type { Feature, Geometry } from 'geojson'
import topology from 'world-atlas/countries-50m.json'
import { SHAPE_CODES } from '../game/data/countries.generated.ts'
import { getCountry } from '../game/graph.ts'
import type { CountryCode } from '../game/types.ts'
import type { PlayerIndex } from '../game/rules.ts'
import { useZoomPan } from './useZoomPan.ts'
import { useLanguage } from './language.tsx'
import { SETTINGS } from '../settings.ts'

const WIDTH = 960

/**
 * Antarctica and the empty far north are cropped out. They are half the height
 * of a world map and none of the game, and on a phone that height is the whole
 * budget.
 */
const FRAME: Geometry = {
  type: 'Polygon',
  coordinates: [
    [
      [-180, -56],
      [180, -56],
      [180, 83],
      [-180, 83],
      [-180, -56],
    ],
  ],
}

const projection = geoNaturalEarth1().fitWidth(WIDTH, FRAME)
const framePath = geoPath(projection)
const [[, top], [, bottom]] = framePath.bounds(FRAME)
const HEIGHT = Math.round(bottom - top)

// Re-centre so the cropped frame starts at y = 0 rather than wherever it landed.
const [translateX, translateY] = projection.translate()
projection.translate([translateX, translateY - top])

const path = geoPath(projection)

/** Below this many square pixels a country is invisible and gets a dot instead. */
const TOO_SMALL = 6

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

const OUTLINE_KEY = 'mitm:outlines'

/**
 * Whether the unnamed world is drawn at all.
 *
 * With outlines off you get Travle's version: an empty ocean that fills in only
 * where you have been right, so you are recalling the shape of the world rather
 * than reading it off the screen. Purely a view preference — it is per device,
 * never shared, and never part of the game state.
 */
function useOutlines(): [boolean, () => void] {
  const [on, setOn] = useState(() => {
    try {
      const saved = localStorage.getItem(OUTLINE_KEY)
      return saved === null ? SETTINGS.showOutlines : saved === 'true'
    } catch {
      return SETTINGS.showOutlines
    }
  })

  const toggle = useCallback(() => {
    setOn((current) => {
      try {
        localStorage.setItem(OUTLINE_KEY, String(!current))
      } catch {
        // A private window refusing storage is not worth a broken toggle.
      }
      return !current
    })
  }, [])

  return [on, toggle]
}

export type WorldMapProps = {
  readonly claimed: ReadonlyMap<CountryCode, PlayerIndex>
  /** Ringed on the map. Empty in a continent game, which has no starts. */
  readonly starts?: readonly CountryCode[]
  /** Drawn as a line once the two sides join up. */
  readonly route?: readonly CountryCode[] | null
  /** Hides one player's countries when partner visibility is off. */
  readonly hiddenPlayer?: PlayerIndex | null
  /** The map opens framed on these — on a phone the world does not fit at once. */
  readonly focus?: readonly CountryCode[]
  /** Drawn faintly once a game is over, to show what was missed. */
  readonly missed?: readonly CountryCode[]
  /** The country being asked about, drawn lit up and deliberately unnamed. */
  readonly highlight?: CountryCode | null
}

export function WorldMap({
  claimed,
  starts = [],
  route,
  hiddenPlayer,
  focus,
  missed,
  highlight,
}: WorldMapProps) {
  const { t } = useLanguage()
  const { transform, surfaceProps, reset, centreOn, moved } = useZoomPan(WIDTH, HEIGHT)
  const [outlines, toggleOutlines] = useOutlines()

  // On a narrow screen the map is cropped, so open it over what the player
  // actually cares about rather than the middle of the world.
  const focusKey = focus?.join(',')
  useEffect(() => {
    const points = (focus ?? []).map(projectCentroid).filter((p): p is [number, number] => p !== null)
    if (points.length === 0) return
    centreOn({
      x: points.reduce((total, p) => total + p[0], 0) / points.length,
      y: points.reduce((total, p) => total + p[1], 0) / points.length,
    })
    // focusKey rather than focus: a fresh array each render would re-centre
    // the map out from under a player who had panned away.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey, centreOn])

  const visible = useMemo(() => {
    if (hiddenPlayer == null) return claimed
    const shown = new Map<CountryCode, PlayerIndex>()
    for (const [code, player] of claimed) if (player !== hiddenPlayer) shown.set(code, player)
    return shown
  }, [claimed, hiddenPlayer])

  const missedSet = useMemo(() => new Set(missed ?? []), [missed])

  const routeLine = useMemo(() => {
    if (!route || route.length < 2) return null
    const points = route.map(projectCentroid).filter((p): p is [number, number] => p !== null)
    return points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ')
  }, [route])

  // Strokes are in viewBox units, so they thicken as you zoom unless divided out.
  const crisp = (value: number) => value / transform.k

  return (
    <div className="map-frame">
      <svg
        className="map"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="xMidYMid slice"
        role="img"
        aria-label="World map"
        {...surfaceProps}
      >
        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
          <rect className="sea" x={0} y={0} width={WIDTH} height={HEIGHT} />

          {SHAPES.map((shape, index) => {
            const player = shape.code ? visible.get(shape.code) : undefined
            const isMissed = shape.code !== null && missedSet.has(shape.code)

            // With outlines off, anything not on the board is simply not drawn —
            // except the country being asked about, which is the whole question.
            const lit = shape.code !== null && shape.code === highlight
            if (player === undefined && !isMissed && !lit && !outlines) return null

            const className =
              shape.code !== null && shape.code === highlight
                ? 'land highlight'
                : player !== undefined
                  ? `land player-${player}${starts.includes(shape.code!) ? ' start' : ''}`
                  : isMissed
                    ? 'land missed'
                    : shape.code === null || getCountry(shape.code).component === null
                      ? 'land out-of-play'
                      : 'land'
            return <path key={index} className={className} d={shape.d} strokeWidth={crisp(0.4)} />
          })}

          {routeLine && <path className="route" d={routeLine} strokeWidth={crisp(2)} />}

          {highlight && SHAPE_BY_CODE.get(highlight)?.tiny && (
            <Dot code={highlight} className="tiny highlight" r={crisp(4)} />
          )}

          {/* Microstates are smaller than a pixel at this scale, so they get a dot. */}
          {[...visible].map(([code, player]) =>
            SHAPE_BY_CODE.get(code)?.tiny ? (
              <Dot key={`tiny-${code}`} code={code} className={`tiny player-${player}`} r={crisp(3)} />
            ) : null,
          )}

          {/* A ring in the sea colour, so a start reads even on top of its own fill. */}
          {starts.map((code, player) =>
            visible.has(code) ? (
              <g key={`start-${code}`} className={`start-marker player-${player}`}>
                <Dot code={code} className="halo" r={crisp(8)} strokeWidth={crisp(4.5)} />
                <Dot code={code} className="ring" r={crisp(8)} strokeWidth={crisp(2)} />
              </g>
            ) : null,
          )}
        </g>
      </svg>

      <div className="map-buttons">
        {moved && (
          <button type="button" onClick={reset}>
            {t.wholeWorld}
          </button>
        )}
        <button type="button" onClick={toggleOutlines} aria-pressed={outlines}>
          {outlines ? t.hideOutlines : t.showOutlines}
        </button>
      </div>
    </div>
  )
}

function Dot({
  code,
  className,
  r,
  strokeWidth,
}: {
  code: CountryCode
  className: string
  r: number
  strokeWidth?: number
}) {
  const point = projectCentroid(code)
  if (!point) return null
  return <circle className={className} cx={point[0]} cy={point[1]} r={r} strokeWidth={strokeWidth} />
}
