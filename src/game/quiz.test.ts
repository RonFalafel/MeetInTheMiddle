import { describe, expect, it } from 'vitest'
import { CODES, getCountry } from './graph.ts'
import { CONTINENTS, CONTINENT_IDS, continentOf } from './continents.ts'
import {
  ROUND_LENGTH,
  applyMove,
  biggerOf,
  checkMove,
  claimedBy,
  compareGame,
  compareScore,
  comparePairs,
  currentCountry,
  currentPair,
  deal,
  dealCompare,
  dealWhichContinent,
  isOver,
  namableCodes,
  repeatOf,
  replay,
  setupOf,
  whichContinentGame,
  whichContinentScore,
} from './rules.ts'
import type { CompareGame, WhichContinentGame } from './rules.ts'

const answer = <S extends CompareGame | WhichContinentGame>(game: S, codes: string[]): S =>
  codes.reduce((state, code, index) => applyMove(state, code, (index % 2) as 0 | 1), game)

describe('country areas', () => {
  it('exist for every country', () => {
    for (const code of CODES) expect(getCountry(code).area, code).toBeGreaterThan(0)
  })

  it('rank the big ones the way an atlas does', () => {
    const order = ['RUS', 'CAN', 'CHN', 'BRA', 'AUS', 'IND', 'ARG']
    for (let i = 1; i < order.length; i++) {
      expect(getCountry(order[i - 1]!).area, order[i - 1]).toBeGreaterThan(getCountry(order[i]!).area)
    }
  })

  it('are close enough to the real figures to be worth asking about', () => {
    // 50m outlines are simplified, so a few per cent out is expected.
    const known: Record<string, number> = { RUS: 17098246, BRA: 8515767, FRA: 643801, PER: 1285216 }
    for (const [code, real] of Object.entries(known)) {
      expect(Math.abs(getCountry(code).area - real) / real, code).toBeLessThan(0.06)
    }
  })
})

describe('bigger or smaller', () => {
  it('deals a full round of pairs from the scope', () => {
    const game = dealCompare('world')
    expect(game.pairs).toHaveLength(ROUND_LENGTH)
    for (const [a, b] of game.pairs) {
      expect(a).not.toBe(b)
      expect(CODES).toContain(a)
      expect(CODES).toContain(b)
    }
  })

  it('never asks a question too close to call', () => {
    // Areas can be a few per cent off, so a near-tie could contradict an atlas.
    for (let i = 0; i < 30; i++) {
      for (const [a, b] of dealCompare('world').pairs) {
        const ratio =
          Math.max(getCountry(a).area, getCountry(b).area) /
          Math.min(getCountry(a).area, getCountry(b).area)
        expect(ratio, `${a} vs ${b}`).toBeGreaterThanOrEqual(1.2)
      }
    }
  })

  it('never asks the same pair twice in a round', () => {
    const keys = dealCompare('world').pairs.map(([a, b]) => [a, b].sort().join('-'))
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('stays inside a continent when asked to', () => {
    for (const [a, b] of dealCompare('south-america').pairs) {
      expect(CONTINENTS['south-america']).toContain(a)
      expect(CONTINENTS['south-america']).toContain(b)
    }
  })

  it('knows which of a pair is bigger', () => {
    expect(biggerOf(['FRA', 'RUS'])).toBe('RUS')
    expect(biggerOf(['RUS', 'FRA'])).toBe('RUS')
  })

  it('accepts only one of the two on offer', () => {
    const game = compareGame('world', [['FRA', 'RUS']])
    expect(checkMove(game, 'RUS')).toEqual({ ok: true, code: 'RUS' })
    expect(checkMove(game, 'DEU')).toMatchObject({ ok: false, reason: 'not-an-option' })
  })

  it('moves on whether you are right or wrong', () => {
    const game = compareGame('world', [
      ['FRA', 'RUS'],
      ['DEU', 'BRA'],
    ])
    const wrong = applyMove(game, 'FRA', 0)
    expect(currentPair(wrong)).toEqual(['DEU', 'BRA'])
    expect(compareScore(wrong)).toMatchObject({ right: 0, asked: 1 })
  })

  it('scores and finishes', () => {
    const game = answer(
      compareGame('world', [
        ['FRA', 'RUS'],
        ['DEU', 'BRA'],
      ]),
      ['RUS', 'DEU'],
    )
    expect(game.status).toBe('won')
    expect(isOver(game)).toBe(true)
    expect(compareScore(game)).toMatchObject({ right: 1, total: 2 })
    expect(compareScore(game).wrong[0]).toMatchObject({ given: 'DEU', answer: 'BRA' })
  })

  it('shows the pair on the map, one in each colour', () => {
    const game = compareGame('world', [['FRA', 'RUS']])
    expect([...claimedBy(game).entries()]).toEqual([
      ['FRA', 0],
      ['RUS', 1],
    ])
  })

  it('offers the autocomplete nothing, because it is answered by tapping', () => {
    expect(namableCodes(compareGame('world', [['FRA', 'RUS']])).size).toBe(0)
  })

  it('survives a round trip through JSON', () => {
    const original = answer(compareGame('world', [['FRA', 'RUS'], ['DEU', 'BRA']]), ['RUS'])
    const wire = JSON.parse(JSON.stringify({ setup: setupOf(original), moves: original.moves }))
    expect(replay(wire.setup, wire.moves)).toEqual(original)
  })

  it('repeats within the same scope', () => {
    expect(repeatOf(dealCompare('africa'))).toEqual({ mode: 'compare', scope: 'africa' })
    expect(deal({ mode: 'compare', scope: 'world' }).mode).toBe('compare')
  })
})

describe('which continent', () => {
  it('deals a round of real countries', () => {
    const game = dealWhichContinent()
    expect(game.order).toHaveLength(ROUND_LENGTH)
    expect(new Set(game.order).size).toBe(game.order.length)
    for (const code of game.order) expect(CODES).toContain(code)
  })

  it('accepts a continent and refuses anything else', () => {
    const game = whichContinentGame(['DEU'])
    expect(checkMove(game, 'europe')).toEqual({ ok: true, code: 'europe' })
    expect(checkMove(game, 'DEU')).toMatchObject({ ok: false, reason: 'not-an-option' })
    expect(checkMove(game, 'atlantis')).toMatchObject({ ok: false, reason: 'not-an-option' })
  })

  it('moves on whether you are right or wrong', () => {
    const game = applyMove(whichContinentGame(['DEU', 'BRA']), 'asia', 0)
    expect(currentCountry(game)).toBe('BRA')
    expect(whichContinentScore(game)).toMatchObject({ right: 0, asked: 1 })
  })

  it('scores against the continent table', () => {
    const game = answer(whichContinentGame(['DEU', 'BRA']), ['europe', 'africa'])
    expect(game.status).toBe('won')
    expect(whichContinentScore(game)).toMatchObject({ right: 1, total: 2 })
    expect(whichContinentScore(game).wrong[0]).toMatchObject({
      question: 'BRA',
      given: 'africa',
      answer: 'south-america',
    })
  })

  it('agrees with the continent table for every country it could ask', () => {
    for (const code of CODES) expect(CONTINENT_IDS).toContain(continentOf(code))
  })

  it('paints nothing on the board — a continent is not a country', () => {
    expect([...claimedBy(applyMove(whichContinentGame(['DEU']), 'europe', 0)).keys()]).toEqual([])
  })

  it('survives a round trip through JSON', () => {
    const original = applyMove(whichContinentGame(['DEU', 'BRA']), 'europe', 0)
    const wire = JSON.parse(JSON.stringify({ setup: setupOf(original), moves: original.moves }))
    expect(replay(wire.setup, wire.moves)).toEqual(original)
  })

  it('goes through the same request path as every other mode', () => {
    expect(deal({ mode: 'which-continent' }).mode).toBe('which-continent')
    expect(repeatOf(dealWhichContinent())).toEqual({ mode: 'which-continent' })
  })
})

describe('pair selection under pressure', () => {
  it('still fills a round on the smallest continent', () => {
    const pairs = comparePairs('south-america')
    expect(pairs.length).toBeGreaterThan(5)
  })

  it('fills a round on Oceania, where most countries are tiny', () => {
    expect(comparePairs('oceania').length).toBeGreaterThan(3)
  })
})
