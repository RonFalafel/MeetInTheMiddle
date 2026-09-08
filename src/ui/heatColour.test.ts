import { describe, expect, it } from 'vitest'
import { heatColour, heatRgb } from './heatColour.ts'
import { hotColdGame, heatOf, kilometresBetween } from '../game/rules.ts'
import type { CountryCode } from '../game/types.ts'

/**
 * How different two colours look, on the "redmean" approximation of CIE ΔE.
 * Rough, but far closer to the eye than plain RGB distance and it needs no
 * colour-space library. Roughly: under 10 is a shade, 30 is clearly different,
 * over 60 is unmistakable.
 */
function difference(a: readonly [number, number, number], b: readonly [number, number, number]) {
  const meanRed = (a[0] + b[0]) / 2
  const [dr, dg, db] = [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
  return Math.sqrt(
    (2 + meanRed / 256) * dr * dr + 4 * dg * dg + (2 + (255 - meanRed) / 256) * db * db,
  )
}

/** The map's unguessed land, which nothing on the ramp may resemble. */
const LAND = [0x2b, 0x35, 0x43] as const

describe('the heat ramp', () => {
  it('stays inside the range whatever it is handed', () => {
    for (const heat of [-1, 0, 0.5, 1, 2, Number.NaN]) {
      for (const channel of heatRgb(heat)) {
        expect(channel).toBeGreaterThanOrEqual(0)
        expect(channel).toBeLessThanOrEqual(255)
      }
    }
  })

  it('renders a colour a browser will take', () => {
    expect(heatColour(0.5)).toMatch(/^rgb\(\d+ \d+ \d+\)$/)
  })

  it('moves in one direction — no two heats share a colour', () => {
    const seen = new Set(
      Array.from({ length: 101 }, (_, i) => heatColour(i / 100)),
    )
    expect(seen.size).toBe(101)
  })

  /**
   * The point of the whole file. Every one of these was reported as
   * "they all look the same" at some version of the ramp.
   */
  it('separates neighbouring steps by more than a shade', () => {
    for (let i = 0; i < 10; i++) {
      const step = difference(heatRgb(i / 10), heatRgb((i + 1) / 10))
      expect(step, `heat ${i / 10} to ${(i + 1) / 10}`).toBeGreaterThan(40)
    }
  })

  it('is unmistakable end to end', () => {
    expect(difference(heatRgb(0), heatRgb(1))).toBeGreaterThan(250)
  })

  it('never looks like unguessed land, however cold', () => {
    for (let i = 0; i <= 20; i++) {
      expect(difference(heatRgb(i / 20), LAND), `heat ${i / 20}`).toBeGreaterThan(90)
    }
  })
})

describe('what it looks like in a real game', () => {
  const game = hotColdGame('FRA')

  const apart = (a: CountryCode, b: CountryCode) =>
    difference(heatRgb(heatOf(game, a)), heatRgb(heatOf(game, b)))

  const label = (code: CountryCode) => `${code} (${Math.round(kilometresBetween('FRA', code))} km)`

  /** Guesses at steadily increasing distance from France, in order. */
  const bands = ['BEL', 'POL', 'TUR', 'NGA', 'KEN', 'CHN', 'ARG', 'AUS', 'NZL']

  it('gives every distance band its own obvious colour', () => {
    for (let i = 1; i < bands.length; i++) {
      const step = apart(bands[i - 1]!, bands[i]!)
      expect(step, `${label(bands[i - 1]!)} to ${label(bands[i]!)}`).toBeGreaterThan(50)
    }
  })

  /**
   * The half that matters, and the half the old single-hue ramp gave up on: it
   * put Belgium at 480 km and Poland at 1,370 km thirteen points apart, and
   * Poland and Belgium eight, which is nothing at all. A game is won in here,
   * so 700 km of closing in has to be visible on its own.
   */
  it('spreads the hot half, where a game is actually decided', () => {
    const closing = ['BEL', 'POL', 'MAR', 'TUR', 'NGA']
    for (let i = 1; i < closing.length; i++) {
      const step = apart(closing[i - 1]!, closing[i]!)
      expect(step, `${label(closing[i - 1]!)} to ${label(closing[i]!)}`).toBeGreaterThan(60)
    }
  })

  /**
   * The cold half is deliberately the compressed one — see the ramp's stops.
   * Two guesses 9,000 km out only have to say "nowhere near"; the list gives
   * the exact kilometres for anyone who wants them.
   */
  it('still separates the far half enough to rank it', () => {
    expect(apart('BRA', 'AUS')).toBeGreaterThan(30)
    expect(apart('KEN', 'NZL')).toBeGreaterThan(80)
  })

  it('tells a near miss from a continent away at a glance', () => {
    expect(apart('BEL', 'EGY')).toBeGreaterThan(100)
  })

  it('makes the answer itself unmistakable', () => {
    expect(difference(heatRgb(1), heatRgb(heatOf(game, 'BEL')))).toBeGreaterThan(80)
  })
})
