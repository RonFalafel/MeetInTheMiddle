import { describe, expect, it } from 'vitest'
import {
  CODES,
  COUNTRY_LIST,
  PLAYABLE_CODES,
  areNeighbours,
  distance,
  findByName,
  getCountry,
  isPlayable,
  normalise,
  sameLandmass,
  search,
  shortestPath,
} from './graph.ts'
import { CARIBBEAN, FIXED_LINKS, PACIFIC, SEA_LINKS } from './seaLinks.ts'
import { DISPUTED, EXCLUDED } from './playSet.ts'
import { SETTINGS } from '../settings.ts'

const landmasses = (): Map<number, string[]> => {
  const groups = new Map<number, string[]>()
  for (const country of COUNTRY_LIST) {
    if (country.component === null) continue
    const members = groups.get(country.component) ?? []
    members.push(country.code)
    groups.set(country.component, members)
  }
  return groups
}

describe('generated graph invariants', () => {
  it('has no duplicate codes', () => {
    expect(new Set(CODES).size).toBe(CODES.length)
  })

  it('uses three-letter uppercase codes', () => {
    for (const code of CODES) expect(code).toMatch(/^[A-Z]{3}$/)
  })

  it('is symmetric', () => {
    for (const country of COUNTRY_LIST) {
      for (const neighbour of country.neighbours) {
        expect(getCountry(neighbour).neighbours, `${neighbour} should border ${country.code}`)
          .toContain(country.code)
      }
    }
  })

  it('has no country adjacent to itself', () => {
    for (const country of COUNTRY_LIST) expect(country.neighbours).not.toContain(country.code)
  })

  it('has no duplicate neighbours', () => {
    for (const country of COUNTRY_LIST) {
      expect(new Set(country.neighbours).size).toBe(country.neighbours.length)
    }
  })

  it('references only real countries', () => {
    const known = new Set(CODES)
    for (const country of COUNTRY_LIST) {
      for (const neighbour of country.neighbours) expect(known.has(neighbour)).toBe(true)
    }
  })

  it('gives every country a plausible centroid', () => {
    for (const country of COUNTRY_LIST) {
      const [longitude, latitude] = country.centroid
      expect(longitude).toBeGreaterThanOrEqual(-180)
      expect(longitude).toBeLessThanOrEqual(180)
      expect(latitude).toBeGreaterThanOrEqual(-90)
      expect(latitude).toBeLessThanOrEqual(90)
    }
  })
})

describe('landmasses', () => {
  it('never strand a country that is in play', () => {
    for (const code of PLAYABLE_CODES) {
      expect(getCountry(code).neighbours.length, `${code} is in play but borders nothing`)
        .toBeGreaterThan(0)
    }
  })

  it('keep neighbours on the same landmass', () => {
    for (const country of COUNTRY_LIST) {
      for (const neighbour of country.neighbours) {
        expect(getCountry(neighbour).component).toBe(country.component)
      }
    }
  })

  it('are each internally connected', () => {
    for (const [index, members] of landmasses()) {
      const seen = new Set([members[0]!])
      const queue = [members[0]!]
      for (let i = 0; i < queue.length; i++) {
        for (const next of getCountry(queue[i]!).neighbours) {
          if (!seen.has(next)) {
            seen.add(next)
            queue.push(next)
          }
        }
      }
      expect(seen.size, `landmass ${index} is in pieces`).toBe(members.length)
    }
  })

  it('are each big enough to host a game, so no start pair is ever unwinnable', () => {
    for (const [index, members] of landmasses()) {
      const furthest = Math.max(
        ...members.map((from) => Math.max(...members.map((to) => distance(from, to)))),
      )
      expect(furthest, `landmass ${index} cannot host a ${SETTINGS.minHops}-hop game`)
        .toBeGreaterThanOrEqual(SETTINGS.minHops)
    }
  })

  it('split the world into Afro-Eurasia and the Americas', () => {
    expect(landmasses().size).toBe(2)
    expect(sameLandmass('FRA', 'CHN')).toBe(true)
    expect(sameLandmass('USA', 'ARG')).toBe(true)
    expect(sameLandmass('FRA', 'USA')).toBe(false)
  })

  it('put islands with no land route out of play', () => {
    for (const code of ['AUS', 'NZL', 'JPN', 'CUB', 'ISL', 'MDG', 'LKA', 'PHL', 'MLT']) {
      expect(isPlayable(code), `${code} should be out of play`).toBe(false)
      expect(getCountry(code).component).toBeNull()
    }
  })
})

describe('sea links', () => {
  it('are limited to fixed crossings you can drive over', () => {
    expect(SEA_LINKS).toEqual(FIXED_LINKS)
    for (const group of [CARIBBEAN, PACIFIC]) {
      for (const link of group) expect(SEA_LINKS).not.toContain(link)
    }
  })

  it('reference countries that are in play', () => {
    for (const { a, b } of SEA_LINKS) {
      expect(isPlayable(a), `${a} is not in play`).toBe(true)
      expect(isPlayable(b), `${b} is not in play`).toBe(true)
    }
  })

  it('are not listed twice and never link a country to itself', () => {
    const keys = SEA_LINKS.map(({ a, b }) => [a, b].sort().join('-'))
    expect(new Set(keys).size).toBe(keys.length)
    for (const { a, b } of SEA_LINKS) expect(a).not.toBe(b)
  })

  it('all carry a justification', () => {
    for (const link of SEA_LINKS) expect(link.why.length).toBeGreaterThan(0)
  })

  it('appear in the graph', () => {
    for (const { a, b } of SEA_LINKS) expect(areNeighbours(a, b)).toBe(true)
  })

  it('keep the fixed links that rescue four countries from the sea', () => {
    expect(areNeighbours('GBR', 'FRA')).toBe(true) // Channel Tunnel
    expect(areNeighbours('SGP', 'MYS')).toBe(true) // Johor Causeway
    expect(areNeighbours('BHR', 'SAU')).toBe(true) // King Fahd Causeway
    expect(isPlayable('IRL')).toBe(true) // reaches Europe through the UK
  })

  it('no longer ferry anyone across open water', () => {
    expect(areNeighbours('ESP', 'MAR')).toBe(false) // Gibraltar
    expect(areNeighbours('RUS', 'USA')).toBe(false) // Bering Strait
    expect(areNeighbours('IND', 'LKA')).toBe(false) // Palk Strait
    expect(areNeighbours('ITA', 'GRC')).toBe(false) // Adriatic
  })
})

describe('geography that the build is easy to get wrong', () => {
  it('keeps the border Western Sahara donates to Morocco', () => {
    expect(DISPUTED['W. Sahara']!.mode).toBe('merge')
    expect(areNeighbours('MAR', 'MRT')).toBe(true)
  })

  it('keeps the borders Somaliland donates to Somalia', () => {
    expect(getCountry('SOM').neighbours).toEqual(expect.arrayContaining(['DJI', 'ETH', 'KEN']))
  })

  it('does not let France border South America', () => {
    expect(areNeighbours('FRA', 'BRA')).toBe(false)
    expect(areNeighbours('FRA', 'SUR')).toBe(false)
  })

  it('plays Kosovo as its own country', () => {
    expect([...getCountry('XKX').neighbours].sort()).toEqual(['ALB', 'MKD', 'MNE', 'SRB'])
  })

  it('keeps the landlocked microstates in play', () => {
    expect([...getCountry('AND').neighbours].sort()).toEqual(['ESP', 'FRA'])
    expect([...getCountry('LIE').neighbours].sort()).toEqual(['AUT', 'CHE'])
    expect(getCountry('SMR').neighbours).toEqual(['ITA'])
    expect(getCountry('VAT').neighbours).toEqual(['ITA'])
    for (const code of ['AND', 'LIE', 'SMR', 'VAT', 'MCO', 'SGP', 'BHR']) {
      expect(isPlayable(code), `${code} should be playable`).toBe(true)
    }
  })

  it('excludes dependent territories entirely', () => {
    for (const name of ['Greenland', 'Puerto Rico', 'Antarctica', 'Hong Kong', 'New Caledonia']) {
      expect(EXCLUDED.has(name)).toBe(true)
      expect(findByName(name), `${name} should not be a country here`).toBeUndefined()
    }
  })
})

describe('paths', () => {
  it('returns a walkable route', () => {
    const path = shortestPath('PRT', 'POL')
    expect(path[0]).toBe('PRT')
    expect(path[path.length - 1]).toBe('POL')
    for (let i = 1; i < path.length; i++) expect(areNeighbours(path[i - 1]!, path[i]!)).toBe(true)
  })

  it('is symmetric in length', () => {
    expect(distance('ZAF', 'MNG')).toBe(distance('MNG', 'ZAF'))
  })

  it('is zero to itself and one to a neighbour', () => {
    expect(distance('KEN', 'KEN')).toBe(0)
    expect(distance('PRT', 'ESP')).toBe(1)
  })
})

describe('name matching', () => {
  it('ignores case, spacing, punctuation and accents', () => {
    expect(findByName('  CÔTE D’IVOIRE ')?.code).toBe(findByName('cote divoire')?.code)
    expect(findByName('united states')?.code).toBe('USA')
  })

  it('accepts aliases', () => {
    expect(findByName('Holland')?.code).toBe('NLD')
    expect(findByName('Burma')?.code).toBe('MMR')
    expect(findByName('UK')?.code).toBe('GBR')
  })

  it('still recognises out-of-play countries, so the input can explain itself', () => {
    expect(findByName('Australia')?.code).toBe('AUS')
    expect(isPlayable('AUS')).toBe(false)
  })

  it('rejects things that are not countries', () => {
    expect(findByName('Atlantis')).toBeUndefined()
    expect(findByName('')).toBeUndefined()
  })

  it('normalises consistently', () => {
    expect(normalise('São Tomé & Príncipe')).toBe('saotomeprincipe')
  })

  it('only ever suggests countries you are allowed to name', () => {
    expect(search('ger', 'en')[0]?.code).toBe('DEU')
    expect(search('', 'en')).toEqual([])
    expect(search('austral', 'en')).toEqual([])
    for (const country of search('a', 'en', 8)) expect(country.component).not.toBeNull()
  })
})
