import { describe, expect, it } from 'vitest'
import { PLAYABLE_CODES, areNeighbours, getCountry, sameLandmass } from './graph.ts'
import {
  applyMove,
  chainGame,
  chainHead,
  chainOptions,
  chainRoute,
  checkGuess,
  claimedBy,
  deal,
  dealChain,
  hotColdGame,
  hotColdGuesses,
  isOver,
  lastGuess,
  namableCodes,
  repeatOf,
  replay,
  reveal,
  setupOf,
} from './rules.ts'
import type { ChainGame } from './rules.ts'

const walk = (game: ChainGame, codes: readonly string[]): ChainGame =>
  codes.reduce((state, code, index) => applyMove(state, code, (index % 2) as 0 | 1), game)

describe('the long way round', () => {
  it('starts on its start country, with nothing walked yet', () => {
    const game = chainGame('DEU')
    expect(chainHead(game)).toBe('DEU')
    expect(chainRoute(game)).toEqual(['DEU'])
  })

  it('accepts only a country bordering the head', () => {
    const game = chainGame('DEU')
    expect(checkGuess(game, 'Poland')).toEqual({ ok: true, code: 'POL' })
    expect(checkGuess(game, 'Spain')).toMatchObject({ ok: false, reason: 'not-adjacent' })
  })

  it('moves the head along as it goes', () => {
    const game = walk(chainGame('DEU'), ['POL', 'UKR'])
    expect(chainHead(game)).toBe('UKR')
    expect(chainRoute(game)).toEqual(['DEU', 'POL', 'UKR'])
    // Poland borders Germany, but Ukraine is the head now.
    expect(checkGuess(game, 'Germany')).toMatchObject({ ok: false, reason: 'already-named' })
    expect(checkGuess(game, 'Romania')).toEqual({ ok: true, code: 'ROU' })
  })

  it('never lets a country be used twice', () => {
    const game = walk(chainGame('DEU'), ['POL', 'CZE'])
    expect(checkGuess(game, 'Poland')).toMatchObject({ ok: false, reason: 'already-named' })
  })

  it('is a genuine walk, every step bordering the last', () => {
    const route = chainRoute(walk(chainGame('DEU'), ['POL', 'UKR', 'ROU', 'BGR']))
    for (let i = 1; i < route.length; i++) expect(areNeighbours(route[i - 1]!, route[i]!)).toBe(true)
  })

  it('ends when the head runs out of unused neighbours', () => {
    // Portugal borders only Spain, so a chain into Portugal is finished.
    const game = walk(chainGame('FRA'), ['ESP', 'PRT'])
    expect(chainOptions(game)).toEqual([])
    expect(game.status).toBe('won')
    expect(isOver(game)).toBe(true)
    expect(checkGuess(game, 'Andorra')).toMatchObject({ ok: false, reason: 'game-over' })
  })

  it('can be given up on at any point', () => {
    const game = reveal(walk(chainGame('DEU'), ['POL']))
    expect(game.status).toBe('revealed')
    expect(chainRoute(game)).toEqual(['DEU', 'POL'])
  })

  it('puts the whole walk on the board, start included', () => {
    expect([...claimedBy(walk(chainGame('DEU'), ['POL'])).keys()]).toEqual(['DEU', 'POL'])
  })

  it('does not narrow the autocomplete to the head’s neighbours', () => {
    // That list would be the answer, exactly as in the neighbours mode.
    const allowed = namableCodes(chainGame('DEU'))
    expect(allowed.has('ESP')).toBe(true)
    expect(allowed.size).toBeGreaterThan(getCountry('DEU').neighbours.length)
    for (const code of allowed) expect(sameLandmass(code, 'DEU')).toBe(true)
  })

  it('starts somewhere with room to move', () => {
    for (let i = 0; i < 40; i++) {
      const game = dealChain()
      expect(PLAYABLE_CODES).toContain(game.start)
      expect(chainOptions(game).length).toBeGreaterThanOrEqual(4)
    }
  })

  it('goes through the same request path as every other mode', () => {
    expect(deal({ mode: 'chain' }).mode).toBe('chain')
    expect(repeatOf(chainGame('DEU'))).toEqual({ mode: 'chain' })
  })

  it('survives a round trip through JSON', () => {
    const original = walk(chainGame('DEU'), ['POL', 'UKR'])
    const wire = JSON.parse(JSON.stringify({ setup: setupOf(original), moves: original.moves }))
    expect(replay(wire.setup, wire.moves)).toEqual(original)
  })
})

describe('hot and cold, on being next door', () => {
  it('says so when a guess borders the answer', () => {
    const game = applyMove(hotColdGame('FRA'), 'BEL', 0)
    expect(lastGuess(game)?.borders).toBe(true)
    expect(hotColdGuesses(game)[0]).toMatchObject({ code: 'BEL', borders: true })
  })

  it('does not say so for somewhere merely close', () => {
    // Austria is nearby but shares no border with France.
    const game = applyMove(hotColdGame('FRA'), 'AUT', 0)
    expect(lastGuess(game)?.borders).toBe(false)
  })

  it('reports on the most recent guess, not the warmest', () => {
    const game = applyMove(applyMove(hotColdGame('FRA'), 'BEL', 0), 'AUS', 1)
    expect(lastGuess(game)?.code).toBe('AUS')
    expect(lastGuess(game)?.borders).toBe(false)
    // Belgium is still the warmest on the board.
    expect(hotColdGuesses(game)[0]?.code).toBe('BEL')
  })

  it('has nothing to report before the first guess', () => {
    expect(lastGuess(hotColdGame('FRA'))).toBeNull()
  })
})

describe('flags', () => {
  it('gives every country a flag file name', () => {
    for (const code of PLAYABLE_CODES) {
      expect(getCountry(code).flag, code).toMatch(/^[a-z]{2}$/)
    }
  })

  it('uses xk for Kosovo, which ISO never gave a code', () => {
    expect(getCountry('XKX').flag).toBe('xk')
    expect(getCountry('DEU').flag).toBe('de')
  })

  it('never gives two countries the same flag', () => {
    const flags = PLAYABLE_CODES.map((code) => getCountry(code).flag)
    expect(new Set(flags).size).toBe(flags.length)
  })
})
