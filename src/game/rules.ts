import { CODES, areNeighbours, exists, findByName, getCountry, shortestPath } from './graph.ts'
import type { CountryCode } from './types.ts'

export type PlayerIndex = 0 | 1

export type Chain = {
  readonly player: PlayerIndex
  /** Index 0 is the secret start. The last entry is where the player is now. */
  readonly countries: readonly CountryCode[]
}

export type GameState = {
  readonly chains: readonly [Chain, Chain]
  readonly turn: PlayerIndex
  readonly status: 'playing' | 'won'
  /** Borders between the two secret starts. Fixed for the life of the game. */
  readonly optimalDistance: number
}

export type Random = () => number

export type StartOptions = {
  readonly minHops?: number
  readonly maxHops?: number
  readonly random?: Random
}

const DEFAULT_MIN_HOPS = 5
const DEFAULT_MAX_HOPS = 9

export function head(chain: Chain): CountryCode {
  return chain.countries[chain.countries.length - 1]!
}

/** Countries named so far by both players. The score — lower is better. */
export function movesMade(state: GameState): number {
  return state.chains[0].countries.length - 1 + (state.chains[1].countries.length - 1)
}

/**
 * The best possible score. Two starts d borders apart meet when the gap closes
 * to one border, so d - 1 countries have to be named between them.
 */
export function par(state: GameState): number {
  return state.optimalDistance - 1
}

/** The route the game was hiding, revealed at the end. */
export function optimalRoute(state: GameState): CountryCode[] {
  return shortestPath(state.chains[0].countries[0]!, state.chains[1].countries[0]!)
}

/**
 * Two starts far enough apart to be interesting. Picks a country, then picks
 * uniformly among the countries the right distance from it.
 */
export function startPair(options: StartOptions = {}): [CountryCode, CountryCode] {
  const { minHops = DEFAULT_MIN_HOPS, maxHops = DEFAULT_MAX_HOPS, random = Math.random } = options
  if (minHops < 2) throw new Error('minHops must be at least 2, or the game is over before it starts')
  if (maxHops < minHops) throw new Error('maxHops must be at least minHops')

  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)]!

  for (let attempt = 0; attempt < 100; attempt++) {
    const from = pick(CODES)
    const candidates = countriesWithin(from, minHops, maxHops)
    if (candidates.length > 0) return [from, pick(candidates)]
  }
  throw new Error(`No country pair is between ${minHops} and ${maxHops} borders apart`)
}

function countriesWithin(from: CountryCode, minHops: number, maxHops: number): CountryCode[] {
  const depth = new Map<CountryCode, number>([[from, 0]])
  const queue = [from]
  const found: CountryCode[] = []

  for (let i = 0; i < queue.length; i++) {
    const current = queue[i]!
    const next = depth.get(current)! + 1
    if (next > maxHops) break
    for (const neighbour of getCountry(current).neighbours) {
      if (depth.has(neighbour)) continue
      depth.set(neighbour, next)
      if (next >= minHops) found.push(neighbour)
      queue.push(neighbour)
    }
  }
  return found
}

export function newGame(options: StartOptions = {}): GameState {
  const [a, b] = startPair(options)
  return gameFrom(a, b)
}

/** A game with chosen starts. Deterministic, which is what tests want. */
export function gameFrom(a: CountryCode, b: CountryCode): GameState {
  return {
    chains: [
      { player: 0, countries: [a] },
      { player: 1, countries: [b] },
    ],
    turn: 0,
    status: haveMet(a, b) ? 'won' : 'playing',
    optimalDistance: shortestPath(a, b).length - 1,
  }
}

/**
 * The chains touch when the two players are standing in the same country, or in
 * countries that border each other. Where they have *been* does not count —
 * you have to still be there.
 */
function haveMet(a: CountryCode, b: CountryCode): boolean {
  return a === b || areNeighbours(a, b)
}

export type IllegalReason = 'game-over' | 'unknown-country' | 'not-adjacent' | 'already-visited'

export type MoveCheck =
  | { readonly ok: true; readonly code: CountryCode }
  | { readonly ok: false; readonly reason: IllegalReason; readonly message: string }

/**
 * Validates a move for the player whose turn it is. Rejection is free — there
 * is no penalty for a wrong guess, so this can stay honest about what went
 * wrong instead of just saying no.
 */
export function checkMove(state: GameState, code: CountryCode): MoveCheck {
  if (state.status === 'won') {
    return { ok: false, reason: 'game-over', message: 'The game is already over.' }
  }
  if (!exists(code)) {
    return { ok: false, reason: 'unknown-country', message: `${code} is not a country in this game.` }
  }

  const chain = state.chains[state.turn]
  const from = head(chain)

  if (chain.countries.includes(code)) {
    return {
      ok: false,
      reason: 'already-visited',
      message: `You have already been to ${getCountry(code).name}.`,
    }
  }

  if (!areNeighbours(from, code)) {
    return {
      ok: false,
      reason: 'not-adjacent',
      message: `${getCountry(code).name} does not border ${getCountry(from).name}.`,
    }
  }

  return { ok: true, code }
}

/**
 * What the player typed, checked. Resolves the name first so the rejection can
 * quote what they actually wrote, then defers to `checkMove`.
 */
export function checkGuess(state: GameState, guess: string): MoveCheck {
  if (state.status === 'won') {
    return { ok: false, reason: 'game-over', message: 'The game is already over.' }
  }

  const country = findByName(guess)
  if (!country) {
    return {
      ok: false,
      reason: 'unknown-country',
      message: `"${guess.trim()}" is not a country in this game.`,
    }
  }
  return checkMove(state, country.code)
}

/** Applies a legal move. Throws if it is not one, so check first. */
export function applyMove(state: GameState, code: CountryCode): GameState {
  const check = checkMove(state, code)
  if (!check.ok) throw new Error(check.message)

  const moved: Chain = {
    player: state.turn,
    countries: [...state.chains[state.turn].countries, check.code],
  }
  const chains: [Chain, Chain] = state.turn === 0 ? [moved, state.chains[1]] : [state.chains[0], moved]

  return {
    chains,
    turn: state.turn === 0 ? 1 : 0,
    status: haveMet(head(chains[0]), head(chains[1])) ? 'won' : 'playing',
    optimalDistance: state.optimalDistance,
  }
}
