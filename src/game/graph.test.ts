import { describe, expect, it } from 'vitest'
import { CODES, COUNTRY_LIST, areNeighbours, distance, findByName, getCountry, normalise, search, shortestPath } from './graph.ts'
import { SEA_LINKS } from './seaLinks.ts'
import { DISPUTED, EXCLUDED } from './playSet.ts'

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

  it('leaves nobody stranded', () => {
    for (const country of COUNTRY_LIST) expect(country.neighbours.length).toBeGreaterThan(0)
  })

  it('is fully connected, so every game is winnable', () => {
    const seen = new Set([CODES[0]!])
    const queue = [CODES[0]!]
    for (let i = 0; i < queue.length; i++) {
      for (const next of getCountry(queue[i]!).neighbours) {
        if (!seen.has(next)) {
          seen.add(next)
          queue.push(next)
        }
      }
    }
    expect(seen.size).toBe(CODES.length)
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

describe('sea links', () => {
  it('reference countries that are in play', () => {
    const known = new Set(CODES)
    for (const { a, b } of SEA_LINKS) {
      expect(known.has(a), `${a} is not in play`).toBe(true)
      expect(known.has(b), `${b} is not in play`).toBe(true)
    }
  })

  it('never link a country to itself', () => {
    for (const { a, b } of SEA_LINKS) expect(a).not.toBe(b)
  })

  it('are not listed twice', () => {
    const keys = SEA_LINKS.map(({ a, b }) => [a, b].sort().join('-'))
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('all carry a justification', () => {
    for (const link of SEA_LINKS) expect(link.why.length).toBeGreaterThan(0)
  })

  it('appear in the graph', () => {
    for (const { a, b } of SEA_LINKS) expect(areNeighbours(a, b)).toBe(true)
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

  it('includes the microstates', () => {
    for (const name of ['Singapore', 'Malta', 'Andorra', 'Monaco', 'San Marino', 'Liechtenstein', 'Bahrain', 'Mauritius', 'Maldives', 'Vatican City']) {
      expect(findByName(name), `${name} should be in play`).toBeDefined()
    }
  })

  it('gets the microstate borders right', () => {
    expect([...getCountry('AND').neighbours].sort()).toEqual(['ESP', 'FRA'])
    expect([...getCountry('LIE').neighbours].sort()).toEqual(['AUT', 'CHE'])
    expect(getCountry('SMR').neighbours).toEqual(['ITA'])
  })

  it('excludes dependent territories', () => {
    for (const name of ['Greenland', 'Puerto Rico', 'Antarctica', 'Hong Kong', 'New Caledonia']) {
      expect(EXCLUDED.has(name)).toBe(true)
      expect(findByName(name), `${name} should not be playable`).toBeUndefined()
    }
  })

  it('connects the continents where it should', () => {
    expect(areNeighbours('ESP', 'MAR')).toBe(true) // Gibraltar
    expect(areNeighbours('RUS', 'USA')).toBe(true) // Bering Strait
    expect(areNeighbours('IND', 'LKA')).toBe(true) // Palk Strait
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
    expect(distance('CHL', 'MNG')).toBe(distance('MNG', 'CHL'))
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

  it('rejects things that are not countries', () => {
    expect(findByName('Atlantis')).toBeUndefined()
    expect(findByName('')).toBeUndefined()
  })

  it('normalises consistently', () => {
    expect(normalise('São Tomé & Príncipe')).toBe('saotomeprincipe')
  })

  it('suggests prefix matches first', () => {
    expect(search('ger')[0]?.code).toBe('DEU')
    expect(search('')).toEqual([])
  })
})
