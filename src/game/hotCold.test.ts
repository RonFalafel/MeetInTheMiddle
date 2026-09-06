import { describe, expect, it } from 'vitest'
import { CODES } from './graph.ts'
import {
  applyMove,
  checkGuess,
  deal,
  dealHotCold,
  heatOf,
  hotColdGame,
  hotColdGuesses,
  isOver,
  kilometresBetween,
  movesMade,
  namableCodes,
  repeatOf,
  replay,
  reveal,
  setupOf,
} from './rules.ts'
import type { HotColdGame } from './rules.ts'

const guess = (game: HotColdGame, codes: readonly string[]): HotColdGame =>
  codes.reduce((state, code, index) => applyMove(state, code, (index % 2) as 0 | 1), game)

describe('distance', () => {
  it('is zero to itself and symmetric', () => {
    expect(kilometresBetween('FRA', 'FRA')).toBe(0)
    expect(kilometresBetween('FRA', 'JPN')).toBeCloseTo(kilometresBetween('JPN', 'FRA'), 6)
  })

  it('is in the right ballpark for pairs anyone can check', () => {
    // Paris to Berlin is about 880 km as the crow flies; centroids are not
    // capitals, so this is deliberately a loose range.
    expect(kilometresBetween('FRA', 'DEU')).toBeGreaterThan(400)
    expect(kilometresBetween('FRA', 'DEU')).toBeLessThan(1200)
    expect(kilometresBetween('FRA', 'AUS')).toBeGreaterThan(13000)
  })

  it('works for islands, which have no land route to anywhere', () => {
    expect(kilometresBetween('AUS', 'NZL')).toBeGreaterThan(1000)
    expect(kilometresBetween('JPN', 'KOR')).toBeLessThan(1500)
  })
})

describe('heat', () => {
  const game = hotColdGame('FRA')

  it('is full for the answer itself', () => {
    expect(heatOf(game, 'FRA')).toBe(1)
  })

  it('falls off with distance, without ever going backwards', () => {
    const order = ['BEL', 'DEU', 'POL', 'TUR', 'IND', 'AUS']
    const heats = order.map((code) => heatOf(game, code))
    for (let i = 1; i < heats.length; i++) expect(heats[i]!).toBeLessThan(heats[i - 1]!)
  })

  it('stays between 0 and 1 for every country on earth', () => {
    for (const code of CODES) {
      const heat = heatOf(game, code)
      expect(heat).toBeGreaterThanOrEqual(0)
      expect(heat).toBeLessThanOrEqual(1)
    }
  })

  it('separates a neighbour from another continent, which is the whole point', () => {
    expect(heatOf(game, 'BEL')).toBeGreaterThan(0.7)
    expect(heatOf(game, 'AUS')).toBeLessThan(0.05)
  })
})

describe('playing', () => {
  it('accepts any country at all, near or far', () => {
    const game = hotColdGame('FRA')
    expect(checkGuess(game, 'Australia')).toEqual({ ok: true, code: 'AUS' })
    expect(checkGuess(game, 'Belgium')).toEqual({ ok: true, code: 'BEL' })
  })

  it('refuses only a repeat', () => {
    const game = applyMove(hotColdGame('FRA'), 'BEL', 0)
    expect(checkGuess(game, 'Belgium')).toMatchObject({ ok: false, reason: 'already-named' })
  })

  it('is won by naming the target and not before', () => {
    const warm = guess(hotColdGame('FRA'), ['AUS', 'DEU', 'BEL'])
    expect(warm.status).toBe('playing')
    expect(movesMade(warm)).toBe(3)

    const found = applyMove(warm, 'FRA', 1)
    expect(found.status).toBe('won')
    expect(isOver(found)).toBe(true)
    expect(movesMade(found)).toBe(4)
  })

  it('ranks the guesses hottest first, with a distance for each', () => {
    const game = guess(hotColdGame('FRA'), ['AUS', 'DEU', 'BRA'])
    const rows = hotColdGuesses(game)
    expect(rows.map((r) => r.code)).toEqual(['DEU', 'BRA', 'AUS'])
    expect(rows[0]!.km).toBeGreaterThan(0)
  })

  it('can be given up on, which is the only way to see the answer', () => {
    const game = reveal(guess(hotColdGame('FRA'), ['AUS']))
    expect(game.status).toBe('revealed')
    expect(game.target).toBe('FRA')
    expect(checkGuess(game, 'Belgium')).toMatchObject({ ok: false, reason: 'game-over' })
  })

  it('lets you guess anywhere on earth, islands included', () => {
    const allowed = namableCodes(hotColdGame('FRA'))
    expect(allowed.size).toBe(CODES.length)
    expect(allowed.has('AUS')).toBe(true)
  })
})

describe('dealing', () => {
  it('can pick any country, not just the ones with land routes', () => {
    const targets = new Set<string>()
    for (let i = 0; i < 400; i++) targets.add(dealHotCold().target)
    for (const code of targets) expect(CODES).toContain(code)
    expect(targets.size).toBeGreaterThan(50)
  })

  it('goes through the same request path as every other mode', () => {
    expect(deal({ mode: 'hot-cold' }).mode).toBe('hot-cold')
    expect(repeatOf(hotColdGame('FRA'))).toEqual({ mode: 'hot-cold' })
  })

  it('survives a round trip through JSON', () => {
    const original = guess(hotColdGame('FRA'), ['AUS', 'DEU'])
    const wire = JSON.parse(JSON.stringify({ setup: setupOf(original), moves: original.moves }))
    expect(replay(wire.setup, wire.moves)).toEqual(original)
  })

  it('carries the target, so both phones hunt the same country', () => {
    expect(setupOf(hotColdGame('FRA'))).toEqual({ mode: 'hot-cold', target: 'FRA' })
  })
})
