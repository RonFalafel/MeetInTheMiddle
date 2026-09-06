import { describe, expect, it } from 'vitest'
import { PLAYABLE_CODES, getCountry, sameLandmass, search } from './graph.ts'
import { CAPITALS, capitalOf } from './capitals.ts'
import {
  MIN_HUB_NEIGHBOURS,
  applyMove,
  checkGuess,
  claimedBy,
  deal,
  dealIdentify,
  dealNeighbours,
  hubCandidates,
  identifyScore,
  isOver,
  movesMade,
  namableCodes,
  neighbourRemaining,
  neighbourTargets,
  neighboursGame,
  repeatOf,
  replay,
  reveal,
  setupOf,
} from './rules.ts'
import type { NeighboursGame } from './rules.ts'

const fill = (game: NeighboursGame, codes: readonly string[]): NeighboursGame =>
  codes.reduce((state, code, index) => applyMove(state, code, (index % 2) as 0 | 1), game)

describe('picking a hub', () => {
  it('only offers countries with enough neighbours to be a puzzle', () => {
    const hubs = hubCandidates()
    expect(hubs.length).toBeGreaterThan(50)
    for (const code of hubs) {
      expect(getCountry(code).neighbours.length).toBeGreaterThanOrEqual(MIN_HUB_NEIGHBOURS)
    }
  })

  it('never picks an island or anything out of play', () => {
    for (const code of hubCandidates()) expect(PLAYABLE_CODES).toContain(code)
  })

  it('deals one of them', () => {
    for (let i = 0; i < 40; i++) expect(hubCandidates()).toContain(dealNeighbours().hub)
  })

  it('is dealt through the same request path as the other modes', () => {
    expect(deal({ mode: 'neighbours' }).mode).toBe('neighbours')
  })

  it('asks about a different country next time', () => {
    expect(repeatOf(dealNeighbours())).toEqual({ mode: 'neighbours' })
  })
})

describe('naming the neighbours', () => {
  it('wants exactly the countries that border the hub', () => {
    const game = neighboursGame('DEU')
    expect([...neighbourTargets(game)].sort()).toEqual([...getCountry('DEU').neighbours].sort())
    expect(neighbourRemaining(game)).toHaveLength(9)
  })

  it('accepts a real neighbour', () => {
    expect(checkGuess(neighboursGame('DEU'), 'Poland')).toEqual({ ok: true, code: 'POL' })
  })

  it('refuses a country that does not border the hub', () => {
    expect(checkGuess(neighboursGame('DEU'), 'Spain')).toMatchObject({
      ok: false,
      reason: 'not-a-neighbour',
      country: 'ESP',
    })
  })

  it('refuses the hub itself', () => {
    expect(checkGuess(neighboursGame('DEU'), 'Germany')).toMatchObject({
      ok: false,
      reason: 'not-a-neighbour',
    })
  })

  it('refuses the same neighbour twice', () => {
    const game = applyMove(neighboursGame('DEU'), 'POL', 0)
    expect(checkGuess(game, 'Poland')).toMatchObject({ ok: false, reason: 'already-named' })
  })

  it('counts down and is won only when every one is named', () => {
    const targets = neighbourTargets(neighboursGame('DEU'))
    const almost = fill(neighboursGame('DEU'), targets.slice(0, -1))
    expect(almost.status).toBe('playing')
    expect(neighbourRemaining(almost)).toHaveLength(1)

    const done = applyMove(almost, targets[targets.length - 1]!, 1)
    expect(done.status).toBe('won')
    expect(isOver(done)).toBe(true)
    expect(movesMade(done)).toBe(targets.length)
  })

  it('can be given up on, which lists what was missed', () => {
    const game = reveal(fill(neighboursGame('DEU'), ['POL', 'FRA']))
    expect(game.status).toBe('revealed')
    expect(neighbourRemaining(game)).toHaveLength(7)
    expect(checkGuess(game, 'Austria')).toMatchObject({ ok: false, reason: 'game-over' })
  })

  it('does not put the hub on the board — it is the question, not an answer', () => {
    expect([...claimedBy(neighboursGame('DEU')).keys()]).toEqual([])
  })

  it('does not narrow the autocomplete to the answers', () => {
    // Offering only the nine countries bordering Germany would be a cheat sheet.
    const allowed = namableCodes(neighboursGame('DEU'))
    expect(allowed.has('ESP')).toBe(true)
    expect(allowed.size).toBeGreaterThan(neighbourTargets(neighboursGame('DEU')).length)
    for (const code of allowed) expect(sameLandmass(code, 'DEU')).toBe(true)
  })

  it('survives a round trip through JSON', () => {
    const original = fill(neighboursGame('DEU'), ['POL', 'FRA'])
    const wire = JSON.parse(JSON.stringify({ setup: setupOf(original), moves: original.moves }))
    expect(replay(wire.setup, wire.moves)).toEqual(original)
  })
})

describe('capitals', () => {
  it('gives every country exactly one, and no two share a name', () => {
    const cities = Object.values(CAPITALS)
    expect(new Set(cities).size).toBe(cities.length)
    for (const code of PLAYABLE_CODES) expect(capitalOf(code)).toBeTruthy()
  })

  it('is baked into the country record', () => {
    expect(getCountry('DEU').capital).toBe('Berlin')
    expect(getCountry('AUS').capital).toBe('Canberra')
    expect(getCountry('XKX').capital).toBe('Pristina')
  })

  it('is the same round as the shape prompt, asked differently', () => {
    const game = dealIdentify('europe', 'capital')
    expect(game.prompt).toBe('capital')
    expect(game.order.length).toBeGreaterThan(0)
    for (const code of game.order) expect(getCountry(code).capital).toBeTruthy()
  })

  it('carries the prompt on the wire, so both phones ask the same question', () => {
    const game = dealIdentify('africa', 'capital')
    expect(setupOf(game)).toMatchObject({ mode: 'identify', scope: 'africa', prompt: 'capital' })
    expect(replay(setupOf(game), []).mode).toBe('identify')
  })

  it('repeats as a capitals round rather than reverting to shapes', () => {
    expect(repeatOf(dealIdentify('asia', 'capital'))).toEqual({
      mode: 'identify',
      scope: 'asia',
      prompt: 'capital',
    })
  })

  it('scores exactly like the shape prompt', () => {
    const game = dealIdentify('europe', 'capital')
    const answered = applyMove(game, game.order[0]!, 0)
    expect(identifyScore(answered).right).toBe(1)
  })

  it('still searches by country name, since that is what you type', () => {
    const game = dealIdentify('europe', 'capital')
    expect(search('germ', 'en', namableCodes(game))[0]?.code).toBe('DEU')
  })
})
