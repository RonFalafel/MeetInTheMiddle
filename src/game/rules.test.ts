import { describe, expect, it } from 'vitest'
import { distance, sameLandmass } from './graph.ts'
import {
  applyMove,
  checkGuess,
  checkMove,
  claimedBy,
  connectingRoute,
  countriesStillNeeded,
  gameFrom,
  movesMade,
  newGame,
  optimalRoute,
  par,
  replay,
  startPair,
} from './rules.ts'
import type { GameState, PlayerIndex } from './rules.ts'

/** Deterministic RNG so start-pair tests fail the same way twice. */
function seeded(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Plays a list of countries, alternating players unless told otherwise. */
const play = (game: GameState, codes: string[], player?: PlayerIndex): GameState =>
  codes.reduce(
    (state, code, index) => applyMove(state, code, player ?? ((index % 2) as PlayerIndex)),
    game,
  )

describe('starting a game', () => {
  it('records the distance between the two starts', () => {
    const game = gameFrom('PRT', 'POL')
    expect(game.optimalDistance).toBe(distance('PRT', 'POL'))
    expect(game.status).toBe('playing')
    expect(game.moves).toEqual([])
  })

  it('puts both starts on the board straight away', () => {
    expect([...claimedBy(gameFrom('PRT', 'POL')).entries()]).toEqual([
      ['PRT', 0],
      ['POL', 1],
    ])
  })

  it('is already over if the starts touch', () => {
    expect(gameFrom('PRT', 'ESP').status).toBe('won')
  })

  it('refuses a pair that could never meet', () => {
    expect(() => gameFrom('FRA', 'USA')).toThrow(/same landmass/)
  })

  it('reveals the route the game was hiding', () => {
    const game = gameFrom('MAR', 'DEU')
    const route = optimalRoute(game)
    expect(route[0]).toBe('MAR')
    expect(route[route.length - 1]).toBe('DEU')
    expect(route.length - 1).toBe(game.optimalDistance)
  })

  it('scores par as one fewer than the gap', () => {
    expect(par(gameFrom('PRT', 'POL'))).toBe(distance('PRT', 'POL') - 1)
  })

  it('needs exactly par more countries before anyone has played', () => {
    const game = gameFrom('PRT', 'POL')
    expect(countriesStillNeeded(game)).toBe(par(game))
  })
})

describe('picking start countries', () => {
  it('always lands inside the requested range', () => {
    const random = seeded(1)
    for (let i = 0; i < 200; i++) {
      const [a, b] = startPair({ minHops: 5, maxHops: 9, random })
      const hops = distance(a, b)
      expect(hops, `${a} to ${b}`).toBeGreaterThanOrEqual(5)
      expect(hops, `${a} to ${b}`).toBeLessThanOrEqual(9)
    }
  })

  it('never picks two countries that could not reach each other', () => {
    const random = seeded(3)
    for (let i = 0; i < 300; i++) {
      const [a, b] = startPair({ random })
      expect(sameLandmass(a, b), `${a} and ${b}`).toBe(true)
    }
  })

  it('refuses a range that would start the game already won', () => {
    expect(() => startPair({ minHops: 1 })).toThrow(/at least 2/)
    expect(() => startPair({ minHops: 9, maxHops: 4 })).toThrow(/at least minHops/)
  })

  it('gives a fresh game two different starts', () => {
    const game = newGame({ random: seeded(42) })
    expect(game.starts[0]).not.toBe(game.starts[1])
    expect(game.status).toBe('playing')
  })
})

describe('naming a country', () => {
  const game = gameFrom('PRT', 'POL')

  it('accepts a country nowhere near either player', () => {
    // The whole point of dropping the adjacency rule: Poland is 4 borders from
    // Portugal, and Belarus touches neither start.
    expect(checkGuess(game, 'Belarus')).toEqual({ ok: true, code: 'BLR' })
  })

  it('accepts an alias in any casing', () => {
    expect(checkGuess(game, 'holland')).toEqual({ ok: true, code: 'NLD' })
  })

  it('rejects a country that does not exist', () => {
    expect(checkGuess(game, 'Narnia')).toMatchObject({ ok: false, reason: 'unknown-country' })
  })

  it('rejects an island that has no land route anywhere', () => {
    const check = checkGuess(game, 'Australia')
    expect(check).toMatchObject({ ok: false, reason: 'out-of-play' })
    if (!check.ok) expect(check.message).toContain('no land border')
  })

  it('rejects a country on the other landmass', () => {
    expect(checkGuess(game, 'Brazil')).toMatchObject({ ok: false, reason: 'wrong-landmass' })
  })

  it('rejects a country already on the board, whoever put it there', () => {
    const played = applyMove(game, 'ESP', 0)
    expect(checkMove(played, 'ESP')).toMatchObject({ ok: false, reason: 'already-named' })
    expect(checkMove(played, 'POL')).toMatchObject({ ok: false, reason: 'already-named' })
  })

  it('rejects everything once the game is won', () => {
    expect(checkGuess(gameFrom('PRT', 'ESP'), 'France')).toMatchObject({
      ok: false,
      reason: 'game-over',
    })
  })
})

describe('making a move', () => {
  it('records who named it and leaves the original state alone', () => {
    const before = gameFrom('PRT', 'POL')
    const after = applyMove(before, 'ESP', 1)
    expect(after.moves).toEqual([{ code: 'ESP', player: 1 }])
    expect(claimedBy(after).get('ESP')).toBe(1)
    expect(before.moves).toEqual([])
  })

  it('lets one player move repeatedly, because there are no turns', () => {
    const game = play(gameFrom('PRT', 'POL'), ['ESP', 'FRA', 'BEL'], 0)
    expect(movesMade(game)).toBe(3)
    expect(game.moves.every((move) => move.player === 0)).toBe(true)
  })

  it('counts every country named by either player', () => {
    const game = play(gameFrom('PRT', 'POL'), ['ESP', 'DEU'])
    expect(movesMade(game)).toBe(2)
  })

  it('throws rather than applying an illegal move', () => {
    expect(() => applyMove(gameFrom('PRT', 'POL'), 'BRA', 0)).toThrow(/different landmass/)
    expect(() => applyMove(gameFrom('PRT', 'POL'), 'ZZZ', 0)).toThrow(/not a country/)
  })

  it('keeps par fixed as the game goes on', () => {
    const game = gameFrom('PRT', 'POL')
    expect(par(applyMove(game, 'ESP', 0))).toBe(par(game))
  })
})

describe('meeting', () => {
  it('ends when the named countries join the two starts', () => {
    // PRT - ESP - FRA - DEU - POL, so ESP, FRA and DEU complete the chain.
    let game = gameFrom('PRT', 'POL')
    game = applyMove(game, 'ESP', 0)
    game = applyMove(game, 'DEU', 1)
    expect(game.status).toBe('playing')
    game = applyMove(game, 'FRA', 0)
    expect(game.status).toBe('won')
    expect(movesMade(game)).toBe(3)
    expect(movesMade(game)).toBe(par(gameFrom('PRT', 'POL')))
  })

  it('does not care who named which country', () => {
    const game = play(gameFrom('PRT', 'POL'), ['ESP', 'FRA', 'DEU'], 1)
    expect(game.status).toBe('won')
  })

  it('does not care what order they were named in', () => {
    const forwards = play(gameFrom('PRT', 'POL'), ['ESP', 'FRA', 'DEU'])
    const backwards = play(gameFrom('PRT', 'POL'), ['DEU', 'FRA', 'ESP'])
    expect(forwards.status).toBe('won')
    expect(backwards.status).toBe('won')
  })

  it('ignores countries that do not join anything up', () => {
    // A perfectly legal guess that happens to be useless still costs a guess.
    const game = play(gameFrom('PRT', 'POL'), ['UKR', 'ROU', 'BGR'])
    expect(game.status).toBe('playing')
    expect(movesMade(game)).toBe(3)
  })

  it('returns the route that actually connected them', () => {
    const game = play(gameFrom('PRT', 'POL'), ['ESP', 'FRA', 'DEU'])
    expect(connectingRoute(game)).toEqual(['PRT', 'ESP', 'FRA', 'DEU', 'POL'])
  })

  it('has no connecting route while the game is still on', () => {
    expect(connectingRoute(gameFrom('PRT', 'POL'))).toBeNull()
  })

  it('counts down the countries still needed as the gap closes', () => {
    const game = gameFrom('PRT', 'POL')
    const before = countriesStillNeeded(game)
    const after = countriesStillNeeded(applyMove(game, 'FRA', 0))
    expect(after).toBe(before - 1)
    expect(countriesStillNeeded(play(game, ['ESP', 'FRA', 'DEU']))).toBe(0)
  })

  it('is reachable in par by naming the optimal route', () => {
    const game = gameFrom('PRT', 'POL')
    const middle = optimalRoute(game).slice(1, -1)
    const played = play(game, middle)
    expect(played.status).toBe('won')
    expect(movesMade(played)).toBe(par(game))
  })
})

describe('replaying a move list', () => {
  it('rebuilds the same game, which is how a device catches up', () => {
    const original = play(gameFrom('PRT', 'POL'), ['ESP', 'FRA', 'DEU'])
    const rebuilt = replay(original.starts, original.moves)
    expect(rebuilt).toEqual(original)
    expect(rebuilt.status).toBe('won')
  })

  it('survives a round trip through JSON', () => {
    const original = play(gameFrom('PRT', 'POL'), ['ESP', 'UKR'])
    const wire = JSON.parse(JSON.stringify({ starts: original.starts, moves: original.moves }))
    expect(replay(wire.starts, wire.moves)).toEqual(original)
  })
})
