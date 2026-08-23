import { describe, expect, it } from 'vitest'
import { areNeighbours, distance } from './graph.ts'
import {
  applyMove,
  checkGuess,
  gameFrom,
  head,
  movesMade,
  newGame,
  optimalRoute,
  par,
  startPair,
} from './rules.ts'

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

describe('starting a game', () => {
  it('records the distance between the two starts', () => {
    const game = gameFrom('PRT', 'POL')
    expect(game.optimalDistance).toBe(distance('PRT', 'POL'))
    expect(game.status).toBe('playing')
    expect(game.turn).toBe(0)
  })

  it('is already over if the starts touch', () => {
    expect(gameFrom('PRT', 'ESP').status).toBe('won')
    expect(gameFrom('PRT', 'PRT').status).toBe('won')
  })

  it('reveals the route the game was hiding', () => {
    const game = gameFrom('MAR', 'DEU')
    const route = optimalRoute(game)
    expect(route[0]).toBe('MAR')
    expect(route[route.length - 1]).toBe('DEU')
    expect(route.length - 1).toBe(game.optimalDistance)
  })

  it('scores par as one fewer than the gap, since meeting means bordering', () => {
    expect(par(gameFrom('PRT', 'POL'))).toBe(distance('PRT', 'POL') - 1)
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

  it('honours a tighter range', () => {
    const random = seeded(7)
    for (let i = 0; i < 50; i++) {
      const [a, b] = startPair({ minHops: 12, maxHops: 12, random })
      expect(distance(a, b)).toBe(12)
    }
  })

  it('refuses a range that would start the game already won', () => {
    expect(() => startPair({ minHops: 1 })).toThrow(/at least 2/)
    expect(() => startPair({ minHops: 9, maxHops: 4 })).toThrow(/at least minHops/)
  })

  it('gives a fresh game two different starts', () => {
    const game = newGame({ random: seeded(42) })
    expect(game.chains[0].countries).toHaveLength(1)
    expect(game.chains[1].countries).toHaveLength(1)
    expect(game.chains[0].countries[0]).not.toBe(game.chains[1].countries[0])
    expect(game.status).toBe('playing')
  })
})

describe('checking a guess', () => {
  const game = gameFrom('PRT', 'POL') // player 0 is in Portugal

  it('accepts a bordering country', () => {
    expect(checkGuess(game, 'Spain')).toEqual({ ok: true, code: 'ESP' })
  })

  it('accepts it by alias, in any casing', () => {
    expect(checkGuess(gameFrom('MEX', 'BRA'), 'usa')).toEqual({ ok: true, code: 'USA' })
  })

  it('rejects a country that does not exist', () => {
    expect(checkGuess(game, 'Narnia')).toMatchObject({ ok: false, reason: 'unknown-country' })
  })

  it('rejects a real country that is not adjacent', () => {
    const check = checkGuess(game, 'Japan')
    expect(check).toMatchObject({ ok: false, reason: 'not-adjacent' })
    if (!check.ok) expect(check.message).toContain('Portugal')
  })

  it('rejects somewhere you have already been', () => {
    const afterSpain = applyMove(game, 'ESP') // hands the turn to player 1
    const backToPlayerZero = applyMove(afterSpain, 'DEU')
    expect(checkGuess(backToPlayerZero, 'Portugal')).toMatchObject({
      ok: false,
      reason: 'already-visited',
    })
  })

  it('rejects everything once the game is won', () => {
    expect(checkGuess(gameFrom('PRT', 'ESP'), 'France')).toMatchObject({
      ok: false,
      reason: 'game-over',
    })
  })
})

describe('making a move', () => {
  it('extends the moving player and hands over the turn', () => {
    const game = applyMove(gameFrom('PRT', 'POL'), 'ESP')
    expect(game.chains[0].countries).toEqual(['PRT', 'ESP'])
    expect(game.chains[1].countries).toEqual(['POL'])
    expect(game.turn).toBe(1)
    expect(head(game.chains[0])).toBe('ESP')
  })

  it('leaves the original state alone', () => {
    const before = gameFrom('PRT', 'POL')
    applyMove(before, 'ESP')
    expect(before.chains[0].countries).toEqual(['PRT'])
    expect(before.turn).toBe(0)
  })

  it('throws rather than applying an illegal move', () => {
    expect(() => applyMove(gameFrom('PRT', 'POL'), 'JPN')).toThrow(/does not border/)
  })

  it('throws on a code that is not a country', () => {
    expect(() => applyMove(gameFrom('PRT', 'POL'), 'ZZZ')).toThrow(/not a country/)
  })

  it('takes the code that checkGuess hands back, which is how the UI drives it', () => {
    const game = gameFrom('PRT', 'POL')
    const check = checkGuess(game, 'spain')
    expect(check.ok).toBe(true)
    if (check.ok) expect(applyMove(game, check.code).chains[0].countries).toEqual(['PRT', 'ESP'])
  })

  it('counts every country named by either player', () => {
    let game = gameFrom('PRT', 'POL')
    expect(movesMade(game)).toBe(0)
    game = applyMove(game, 'ESP')
    game = applyMove(game, 'DEU')
    expect(movesMade(game)).toBe(2)
  })

  it('keeps par fixed as the game goes on', () => {
    const game = gameFrom('PRT', 'POL')
    expect(par(applyMove(game, 'ESP'))).toBe(par(game))
  })
})

describe('meeting', () => {
  it('ends when the two heads border each other', () => {
    let game = gameFrom('PRT', 'POL')
    game = applyMove(game, 'ESP') // player 0 to ESP
    game = applyMove(game, 'DEU') // player 1 to DEU
    expect(game.status).toBe('playing')
    game = applyMove(game, 'FRA') // player 0 to FRA, which borders DEU
    expect(game.status).toBe('won')
    expect(areNeighbours(head(game.chains[0]), head(game.chains[1]))).toBe(true)
    expect(movesMade(game)).toBe(3)
  })

  it('ends when both players stand in the same country', () => {
    const game = applyMove(gameFrom('PRT', 'MAR'), 'ESP')
    // Spain borders Morocco across Gibraltar, so player 0 arrives already met.
    expect(game.status).toBe('won')
    expect(head(game.chains[0])).toBe('ESP')
  })

  it('does not count merely crossing an old part of the other chain', () => {
    // Player 1 leaves Portugal; player 0 walking into Portugal later is not a
    // meeting, because player 1 is no longer standing there.
    let game = gameFrom('DEU', 'PRT')
    game = applyMove(game, 'AUT') // player 0: DEU to AUT
    game = applyMove(game, 'ESP') // player 1: PRT to ESP
    expect(game.chains[1].countries).toEqual(['PRT', 'ESP'])
    expect(game.status).toBe('playing')
  })

  it('is reachable in par when both players walk the optimal route', () => {
    const game = gameFrom('PRT', 'POL')
    const route = optimalRoute(game)
    let played = game
    let low = 1
    let high = route.length - 2
    while (played.status === 'playing') {
      played = played.turn === 0
        ? applyMove(played, route[low++]!)
        : applyMove(played, route[high--]!)
    }
    expect(movesMade(played)).toBe(par(game))
  })
})
