import { COUNTRIES } from './data/countries.generated.ts'
import { NAMES, NAME_ALIASES } from './data/names.generated.ts'
import { LANGUAGE_CODES } from './languages.ts'
import type { LanguageCode } from './languages.ts'
import type { Country, CountryCode } from './types.ts'

export const COUNTRY_LIST: readonly Country[] = COUNTRIES

const byCode = new Map<CountryCode, Country>(COUNTRIES.map((c) => [c.code, c]))

export const CODES: readonly CountryCode[] = COUNTRIES.map((c) => c.code)

/** Countries that can actually appear in a game. Islands with no land route are not among them. */
export const PLAYABLE_CODES: readonly CountryCode[] = COUNTRIES.filter(
  (c) => c.component !== null,
).map((c) => c.code)

export function isPlayable(code: CountryCode): boolean {
  return byCode.get(code)?.component != null
}

/** Two countries can only meet if they are on the same landmass. */
export function sameLandmass(a: CountryCode, b: CountryCode): boolean {
  const left = byCode.get(a)?.component
  return left != null && left === byCode.get(b)?.component
}

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

/**
 * Lowercase, then drop combining marks and everything that is not a letter or
 * a digit — in any script, which is the point. It makes "cote divoire" match
 * "Côte d'Ivoire", "צכיה" match "צ׳כיה" by dropping the geresh, and Arabic
 * hamza variants match each other, since NFD splits أ into ا plus a mark.
 */
export function normalise(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '')
}

export function countryName(code: CountryCode, language: LanguageCode): string {
  return NAMES[language][code] ?? getCountry(code).name
}

function namesFor(country: Country, language: LanguageCode): string[] {
  return [NAMES[language][country.code] ?? country.name, ...(NAME_ALIASES[language][country.code] ?? [])]
}

/**
 * Every spelling of every country in every language, pointing at the country.
 *
 * Matching deliberately ignores which language the player has chosen: two
 * people reading the game in different languages still share one board, and
 * neither should be told their own word for Germany is wrong.
 */
const byAnyName = new Map<string, Country>()
for (const pass of ['names', 'aliases'] as const) {
  for (const country of COUNTRIES) {
    for (const language of LANGUAGE_CODES) {
      const [name, ...aliases] = namesFor(country, language)
      for (const spelling of pass === 'names' ? [name!] : aliases) {
        const key = normalise(spelling)
        // First writer wins, and a real name always beats another country's alias.
        if (key && !byAnyName.has(key)) byAnyName.set(key, country)
      }
    }
  }
}

/** Exact match on a name or alias in any language, ignoring case and accents. */
export function findByName(text: string): Country | undefined {
  return byAnyName.get(normalise(text))
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

/**
 * Names beginning with the typed text, best for an autocomplete.
 *
 * Suggestions are ranked by the reader's own language but matched against all
 * of them, so typing in a language other than the one on screen still works.
 * Only countries in play are offered — suggesting Australia when Australia can
 * never be part of a route is just a trap.
 */
export function search(
  text: string,
  language: LanguageCode,
  /** Codes this game would accept. Omit to search every country. */
  within?: ReadonlySet<CountryCode>,
  limit = 8,
): Country[] {
  const needle = normalise(text)
  if (!needle) return []

  const starts: Country[] = []
  const contains: Country[] = []
  const otherLanguage: Country[] = []

  for (const country of COUNTRIES) {
    if (within && !within.has(country.code)) continue

    const own = namesFor(country, language).map(normalise)
    if (own.some((name) => name.startsWith(needle))) starts.push(country)
    else if (own.some((name) => name.includes(needle))) contains.push(country)
    else if (
      LANGUAGE_CODES.some((other) =>
        other === language ? false : namesFor(country, other).some((name) => normalise(name).startsWith(needle)),
      )
    ) {
      otherLanguage.push(country)
    }
  }
  return [...starts, ...contains, ...otherLanguage].slice(0, limit)
}
