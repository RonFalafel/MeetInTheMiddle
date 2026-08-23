import { COUNTRIES } from './data/countries.generated.ts'
import type { Country, CountryCode } from './types.ts'

export const COUNTRY_LIST: readonly Country[] = COUNTRIES

const byCode = new Map<CountryCode, Country>(COUNTRIES.map((c) => [c.code, c]))

export const CODES: readonly CountryCode[] = COUNTRIES.map((c) => c.code)

export function getCountry(code: CountryCode): Country {
  const country = byCode.get(code)
  if (!country) throw new Error(`Unknown country code: ${code}`)
  return country
}

export function exists(code: CountryCode): boolean {
  return byCode.has(code)
}

export function areNeighbours(a: CountryCode, b: CountryCode): boolean {
  return getCountry(a).neighbours.includes(b)
}

/**
 * Fewest borders to cross from `from` to `to`, inclusive of both endpoints.
 * The graph is connected, so this always returns a path.
 */
export function shortestPath(from: CountryCode, to: CountryCode): CountryCode[] {
  if (from === to) return [from]
  const cameFrom = new Map<CountryCode, CountryCode>([[from, from]])
  const queue = [from]

  for (let i = 0; i < queue.length; i++) {
    const current = queue[i]!
    for (const next of getCountry(current).neighbours) {
      if (cameFrom.has(next)) continue
      cameFrom.set(next, current)
      if (next === to) {
        const path = [to]
        let step = to
        while (step !== from) {
          step = cameFrom.get(step)!
          path.push(step)
        }
        return path.reverse()
      }
      queue.push(next)
    }
  }
  throw new Error(`No path from ${from} to ${to} — the graph is disconnected`)
}

/** Number of borders between two countries. 0 if they are the same country. */
export function distance(from: CountryCode, to: CountryCode): number {
  return shortestPath(from, to).length - 1
}

/** Lowercase, strip accents and punctuation, so "cote d'ivoire" matches "Côte d'Ivoire". */
export function normalise(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

const byNormalisedName = new Map<string, Country>()
for (const country of COUNTRIES) {
  byNormalisedName.set(normalise(country.name), country)
  for (const alias of country.aliases) {
    // A real name always wins over another country's alias.
    if (!byNormalisedName.has(normalise(alias))) byNormalisedName.set(normalise(alias), country)
  }
}

/** Exact match on a name or alias, ignoring case, spacing and accents. */
export function findByName(text: string): Country | undefined {
  return byNormalisedName.get(normalise(text))
}

/**
 * Name, alias, or raw country code. The browser input deliberately does not use
 * this — "BRA" is not something a player should be able to type — but scripts
 * and tests are easier to read when a code works.
 */
export function resolveCountry(text: string): Country | undefined {
  const code = text.trim().toUpperCase()
  if (byCode.has(code)) return byCode.get(code)
  return findByName(text)
}

/** Names and aliases beginning with the typed text, best for an autocomplete. */
export function search(text: string, limit = 8): Country[] {
  const needle = normalise(text)
  if (!needle) return []
  const starts: Country[] = []
  const contains: Country[] = []
  for (const country of COUNTRIES) {
    const haystacks = [country.name, ...country.aliases].map(normalise)
    if (haystacks.some((h) => h.startsWith(needle))) starts.push(country)
    else if (haystacks.some((h) => h.includes(needle))) contains.push(country)
  }
  return [...starts, ...contains].slice(0, limit)
}
