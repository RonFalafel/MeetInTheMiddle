import { describe, expect, it } from 'vitest'
import { CODES, search } from './graph.ts'
import { CONTINENTS } from './continents.ts'
import {
  ROUND_LENGTH,
  SKIP,
  applyMove,
  checkGuess,
  claimedBy,
  currentTarget,
  deal,
  dealIdentify,
  identifyGame,
  identifyScore,
  isOver,
  namableCodes,
  repeatOf,
  replay,
  reveal,
  scopeCodes,
  setupOf,
} from './rules.ts'
import type { IdentifyGame } from './rules.ts'

/** Answers every question correctly. */
const aceIt = (game: IdentifyGame): IdentifyGame =>
  game.order.reduce((state, code, index) => applyMove(state, code, (index % 2) as 0 | 1), game)

const round = (order: string[]) => identifyGame('europe', order)

describe('dealing a round', () => {
  it('draws from the chosen scope and stops at the round length', () => {
    const game = dealIdentify('south-america')
    expect(game.order).toHaveLength(Math.min(ROUND_LENGTH, CONTINENTS['south-america'].length))
    for (const code of game.order) expect(CONTINENTS['south-america']).toContain(code)
  })

  it('never repeats a country inside one round', () => {
    for (let i = 0; i < 30; i++) {
      const game = dealIdentify('world')
      expect(new Set(game.order).size).toBe(game.order.length)
    }
  })

  it('can draw from the whole world, islands included', () => {
    expect(scopeCodes('world')).toHaveLength(CODES.length)
    expect(scopeCodes('europe')).toEqual(CONTINENTS.europe)
  })

  it('does not run short on a small continent', () => {
    const game = dealIdentify('oceania')
    expect(game.order.length).toBeGreaterThan(0)
    expect(game.order.length).toBeLessThanOrEqual(CONTINENTS.oceania.length)
  })

  it('is dealt through the same request path as the other modes', () => {
    const game = deal({ mode: 'identify', scope: 'africa' })
    expect(game.mode).toBe('identify')
  })

  it('reshuffles rather than repeating the same ten', () => {
    expect(repeatOf(dealIdentify('asia'))).toEqual({ mode: 'identify', scope: 'asia' })
  })
})

describe('answering', () => {
  it('asks for the first country first', () => {
    expect(currentTarget(round(['FRA', 'DEU']))).toBe('FRA')
  })

  it('moves on when the answer is right', () => {
    const game = applyMove(round(['FRA', 'DEU']), 'FRA', 0)
    expect(currentTarget(game)).toBe('DEU')
    expect(identifyScore(game).right).toBe(1)
  })

  it('stays put when the answer is wrong, and counts it against you', () => {
    const game = applyMove(round(['FRA', 'DEU']), 'ESP', 0)
    expect(currentTarget(game)).toBe('FRA')
    expect(identifyScore(game)).toMatchObject({ right: 0, wrong: 1 })
  })

  it('accepts a wrong answer rather than refusing it, because that is the game', () => {
    // Other modes hand a bad guess back for free; here it has to cost something.
    expect(checkGuess(round(['FRA']), 'Spain')).toEqual({ ok: true, code: 'ESP' })
  })

  it('still refuses something that is not a country at all', () => {
    expect(checkGuess(round(['FRA']), 'Narnia')).toMatchObject({
      ok: false,
      reason: 'unknown-country',
    })
  })

  it('lets a stuck player skip, which counts as missed', () => {
    const game = applyMove(round(['FRA', 'DEU']), SKIP, 0)
    expect(currentTarget(game)).toBe('DEU')
    expect(identifyScore(game)).toMatchObject({ right: 0, wrong: 0 })
    expect(identifyScore(game).missed).toContain('FRA')
  })

  it('is won once the last country is named', () => {
    const game = aceIt(round(['FRA', 'DEU', 'ITA']))
    expect(game.status).toBe('won')
    expect(isOver(game)).toBe(true)
    expect(currentTarget(game)).toBeNull()
    expect(identifyScore(game)).toMatchObject({ right: 3, wrong: 0, missed: [] })
  })

  it('is over even if every answer was skipped', () => {
    const game = ['FRA', 'DEU'].reduce((state) => applyMove(state, SKIP, 0), round(['FRA', 'DEU']))
    expect(game.status).toBe('won')
    expect(identifyScore(game).missed).toEqual(['FRA', 'DEU'])
  })

  it('refuses anything once the round is done', () => {
    expect(checkGuess(aceIt(round(['FRA'])), 'Germany')).toMatchObject({
      ok: false,
      reason: 'game-over',
    })
  })

  it('can be given up on part way through', () => {
    const game = reveal(applyMove(round(['FRA', 'DEU', 'ITA']), 'FRA', 0))
    expect(game.status).toBe('revealed')
    expect(identifyScore(game).missed).toEqual(['DEU', 'ITA'])
  })
})

describe('what the board shows', () => {
  it('colours in only the countries actually got right', () => {
    // A wrong guess must not paint Spain onto the map as though it were placed.
    const game = applyMove(round(['FRA', 'DEU']), 'ESP', 0)
    expect([...claimedBy(game).keys()]).toEqual([])

    const better = applyMove(game, 'FRA', 1)
    expect([...claimedBy(better).entries()]).toEqual([['FRA', 1]])
  })

  it('offers only the scope in the autocomplete', () => {
    const allowed = namableCodes(round(['FRA']))
    expect(allowed.has('FRA')).toBe(true)
    expect(allowed.has('BRA')).toBe(false)
    expect(search('bra', 'en', allowed).map((c) => c.code)).not.toContain('BRA')
  })
})

describe('on the wire', () => {
  it('carries the order, so both phones ask the same question', () => {
    const game = dealIdentify('europe')
    expect(setupOf(game)).toEqual({ mode: 'identify', scope: 'europe', order: game.order })
  })

  it('survives a round trip through JSON, wrong answers and all', () => {
    const original = applyMove(applyMove(round(['FRA', 'DEU']), 'ESP', 0), 'FRA', 1)
    const wire = JSON.parse(JSON.stringify({ setup: setupOf(original), moves: original.moves }))
    expect(replay(wire.setup, wire.moves)).toEqual(original)
  })

  it('replays a skip too', () => {
    const original = applyMove(round(['FRA', 'DEU']), SKIP, 0)
    expect(replay(setupOf(original), original.moves)).toEqual(original)
  })
})
