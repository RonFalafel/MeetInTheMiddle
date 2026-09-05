import { describe, expect, it } from 'vitest'
import { CODES, PLAYABLE_CODES, getCountry, search } from './graph.ts'
import { CONTINENTS, CONTINENT_IDS, continentOf, isContinentId } from './continents.ts'
import { SETTINGS } from '../settings.ts'
import {
  applyMove,
  checkGuess,
  continentGame,
  continentRemaining,
  continentTargets,
  deal,
  isOver,
  movesMade,
  namableCodes,
  randomContinent,
  repeatOf,
  replay,
  reveal,
  setupOf,
} from './rules.ts'
import type { ContinentGame } from './rules.ts'

const fill = (game: ContinentGame, codes: readonly string[]): ContinentGame =>
  codes.reduce((state, code, index) => applyMove(state, code, (index % 2) as 0 | 1), game)

describe('the continent table', () => {
  it('places every country exactly once', () => {
    const assigned = CONTINENT_IDS.flatMap((id) => CONTINENTS[id])
    expect(new Set(assigned).size).toBe(assigned.length)
    expect([...assigned].sort()).toEqual([...CODES].sort())
  })

  it('agrees with what the generator baked into each country', () => {
    for (const code of CODES) expect(getCountry(code).continent).toBe(continentOf(code))
  })

  it('recognises its own ids and nothing else', () => {
    expect(isContinentId('europe')).toBe(true)
    expect(isContinentId('atlantis')).toBe(false)
  })

  it('is big enough everywhere to be worth playing', () => {
    for (const id of CONTINENT_IDS) expect(CONTINENTS[id].length).toBeGreaterThanOrEqual(10)
  })

  it('puts the awkward ones where the comments say', () => {
    expect(continentOf('RUS')).toBe('europe')
    expect(continentOf('CYP')).toBe('europe')
    expect(continentOf('TUR')).toBe('asia')
    expect(continentOf('GEO')).toBe('asia')
    expect(continentOf('EGY')).toBe('africa')
    expect(continentOf('MEX')).toBe('north-america')
    expect(continentOf('CUB')).toBe('north-america')
  })

  it('gives Oceania somewhere to exist, which Meet in the Middle cannot', () => {
    // Every one of these is an island with no land route, so they are out of
    // play in the other mode entirely.
    const oceania = CONTINENTS.oceania
    expect(oceania).toContain('AUS')
    expect(oceania).toContain('NZL')
    expect(oceania.filter((code) => PLAYABLE_CODES.includes(code))).toEqual(['PNG'])
  })
})

describe('a continent game', () => {
  it('starts empty, with no starts and nothing claimed', () => {
    const game = continentGame('south-america')
    expect(game.moves).toEqual([])
    expect(game.status).toBe('playing')
    expect(continentRemaining(game)).toHaveLength(12)
  })

  it('accepts islands that Meet in the Middle refuses', () => {
    // Australia has no land border with anywhere, and is the whole point here.
    expect(checkGuess(continentGame('oceania'), 'Australia')).toEqual({ ok: true, code: 'AUS' })
    expect(checkGuess(continentGame('europe'), 'Iceland')).toEqual({ ok: true, code: 'ISL' })
  })

  it('refuses a country from another continent', () => {
    expect(checkGuess(continentGame('south-america'), 'Spain')).toMatchObject({
      ok: false,
      reason: 'wrong-continent',
      country: 'ESP',
    })
  })

  it('refuses a country twice, whoever named it', () => {
    const game = applyMove(continentGame('south-america'), 'PER', 0)
    expect(checkGuess(game, 'Peru')).toMatchObject({ ok: false, reason: 'already-named' })
  })

  it('counts down as it fills', () => {
    const game = fill(continentGame('south-america'), ['PER', 'CHL', 'ARG'])
    expect(movesMade(game)).toBe(3)
    expect(continentRemaining(game)).toHaveLength(9)
    expect(game.status).toBe('playing')
  })

  it('is won only when every last country is named', () => {
    const targets = continentTargets(continentGame('south-america'))
    const almost = fill(continentGame('south-america'), targets.slice(0, -1))
    expect(almost.status).toBe('playing')

    const done = applyMove(almost, targets[targets.length - 1]!, 1)
    expect(done.status).toBe('won')
    expect(isOver(done)).toBe(true)
    expect(continentRemaining(done)).toEqual([])
  })

  it('does not care about land routes, so Oceania can be completed', () => {
    const game = fill(continentGame('oceania'), CONTINENTS.oceania)
    expect(game.status).toBe('won')
  })

  it('can be given up on, which lists what was missed', () => {
    const game = reveal(fill(continentGame('south-america'), ['PER', 'CHL']))
    expect(game.status).toBe('revealed')
    expect(isOver(game)).toBe(true)
    expect(continentRemaining(game)).toHaveLength(10)
    expect(checkGuess(game, 'Brazil')).toMatchObject({ ok: false, reason: 'game-over' })
  })

  it('leaves a finished game alone when revealed', () => {
    const done = fill(continentGame('south-america'), continentTargets(continentGame('south-america')))
    expect(reveal(done).status).toBe('won')
  })
})

describe('dealing and repeating', () => {
  it('deals the continent that was asked for', () => {
    const game = deal({ mode: 'continent', continent: 'africa' })
    expect(game.mode).toBe('continent')
    if (game.mode === 'continent') expect(game.continent).toBe('africa')
  })

  it('deals Meet in the Middle when nothing is asked for', () => {
    expect(deal(undefined, { minHops: SETTINGS.minHops, maxHops: SETTINGS.maxHops }).mode).toBe('meet')
    expect(deal({ mode: 'meet' }).mode).toBe('meet')
  })

  it('repeats a continent but reshuffles a meet game', () => {
    expect(repeatOf(continentGame('asia'))).toEqual({ mode: 'continent', continent: 'asia' })
    expect(repeatOf(deal({ mode: 'meet' }))).toEqual({ mode: 'meet' })
  })

  it('only ever picks a real continent at random', () => {
    for (let i = 0; i < 50; i++) expect(CONTINENT_IDS).toContain(randomContinent())
  })
})

describe('a continent game on the wire', () => {
  it('survives a round trip through JSON', () => {
    const original = fill(continentGame('south-america'), ['PER', 'CHL', 'ARG'])
    const wire = JSON.parse(JSON.stringify({ setup: setupOf(original), moves: original.moves }))
    expect(replay(wire.setup, wire.moves)).toEqual(original)
  })

  it('carries the continent, not a start pair', () => {
    expect(setupOf(continentGame('africa'))).toEqual({ mode: 'continent', continent: 'africa' })
  })
})

describe('what the autocomplete may offer', () => {
  it('is the whole continent, islands included', () => {
    const allowed = namableCodes(continentGame('oceania'))
    expect(allowed.has('AUS')).toBe(true)
    expect(allowed.has('FRA')).toBe(false)
    expect(allowed.size).toBe(CONTINENTS.oceania.length)
  })

  it('is only the reachable half of the world in a meet game', () => {
    const allowed = namableCodes(deal({ mode: 'meet' }))
    for (const code of allowed) expect(PLAYABLE_CODES).toContain(code)
  })

  it('stops the search offering anything the game would refuse', () => {
    const oceania = namableCodes(continentGame('oceania'))
    expect(search('austral', 'en', oceania)[0]?.code).toBe('AUS')
    expect(search('france', 'en', oceania)).toEqual([])

    // Without a restriction the search is just a country lookup, and finds
    // everything — the filtering is the game's business, not the search's.
    expect(search('austral', 'en')[0]?.code).toBe('AUS')
  })
})
