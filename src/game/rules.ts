import {
  PLAYABLE_CODES,
  exists,
  findByName,
  getCountry,
  isPlayable,
  sameLandmass,
  shortestPath,
} from './graph.ts'
import type { CountryCode } from './types.ts'

export type PlayerIndex = 0 | 1

export type Move = {
  readonly code: CountryCode
  readonly player: PlayerIndex
}

/**
 * The whole game, as a start pair plus an ordered list of moves. Everything
 * else is derived, which keeps it trivially serialisable — two devices stay in
 * sync by agreeing on this list and nothing else.
 */
export type GameState = {
  readonly starts: readonly [CountryCode, CountryCode]
  readonly moves: readonly Move[]
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

/** Every country on the board, and who put it there. Both starts are included. */
export function claimedBy(state: GameState): Map<CountryCode, PlayerIndex> {
  const claimed = new Map<CountryCode, PlayerIndex>([
    [state.starts[0], 0],
    [state.starts[1], 1],
  ])
  for (const move of state.moves) if (!claimed.has(move.code)) claimed.set(move.code, move.player)
  return claimed
}

export function claimedCodes(state: GameState): Set<CountryCode> {
  return new Set(claimedBy(state).keys())
}

/** Countries named so far. The score — lower is better. */
export function movesMade(state: GameState): number {
  return state.moves.length
}

/**
 * The best possible score. Two starts d borders apart need d - 1 countries
 * between them to join up.
 */
export function par(state: GameState): number {
  return state.optimalDistance - 1
}

/** The route the game was hiding, revealed at the end. */
export function optimalRoute(state: GameState): CountryCode[] {
  return shortestPath(state.starts[0], state.starts[1])
}

/**
 * A route from one start to the other using only countries that have been
 * named, or null if the two sides are still apart. This is the win condition
 * and also what gets drawn on the map when the game ends.
 */
export function connectingRoute(state: GameState): CountryCode[] | null {
  const claimed = claimedCodes(state)
  const [from, to] = state.starts
  if (from === to) return [from]

  const cameFrom = new Map<CountryCode, CountryCode>([[from, from]])
  const queue = [from]

  for (let i = 0; i < queue.length; i++) {
    const current = queue[i]!
    for (const next of getCountry(current).neighbours) {
      if (!claimed.has(next) || cameFrom.has(next)) continue
      cameFrom.set(next, current)
      if (next === to) {
        const route = [to]
        let step = to
        while (step !== from) {
          step = cameFrom.get(step)!
          route.push(step)
        }
        return route.reverse()
      }
      queue.push(next)
    }
  }
  return null
}

/**
 * How many more countries are needed on the shortest remaining join, ignoring
 * who owns what. Useful as a hint and for testing that a game is still winnable.
 */
export function countriesStillNeeded(state: GameState): number {
  const claimed = claimedCodes(state)
  const [from, to] = state.starts

  // Dijkstra where an already-claimed country costs nothing to pass through.
  const cost = new Map<CountryCode, number>([[from, 0]])
  const frontier = [from]

  while (frontier.length > 0) {
    frontier.sort((a, b) => cost.get(a)! - cost.get(b)!)
    const current = frontier.shift()!
    if (current === to) return cost.get(current)!
    for (const next of getCountry(current).neighbours) {
      const step = next === to || claimed.has(next) ? 0 : 1
      const candidate = cost.get(current)! + step
      if (candidate < (cost.get(next) ?? Infinity)) {
        cost.set(next, candidate)
        frontier.push(next)
      }
    }
  }
  return Infinity
}

/**
 * Two starts far enough apart to be interesting, and always on the same
 * landmass — otherwise no sequence of guesses could ever join them.
 */
export function startPair(options: StartOptions = {}): [CountryCode, CountryCode] {
  const { minHops = DEFAULT_MIN_HOPS, maxHops = DEFAULT_MAX_HOPS, random = Math.random } = options
  if (minHops < 2) throw new Error('minHops must be at least 2, or the game is over before it starts')
  if (maxHops < minHops) throw new Error('maxHops must be at least minHops')

  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)]!

  for (let attempt = 0; attempt < 200; attempt++) {
    const from = pick(PLAYABLE_CODES)
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

/** A game with chosen starts. Deterministic, which is what tests and rooms want. */
export function gameFrom(a: CountryCode, b: CountryCode): GameState {
  if (!sameLandmass(a, b)) {
    throw new Error(`${a} and ${b} are not on the same landmass, so they could never meet`)
  }
  const base: GameState = {
    starts: [a, b],
    moves: [],
    status: 'playing',
    optimalDistance: shortestPath(a, b).length - 1,
  }
  return { ...base, status: connectingRoute(base) ? 'won' : 'playing' }
}

/** Replays a move list, which is how a device catches up after reconnecting. */
export function replay(
  starts: readonly [CountryCode, CountryCode],
  moves: readonly Move[],
): GameState {
  let state = gameFrom(starts[0], starts[1])
  for (const move of moves) state = applyMove(state, move.code, move.player)
  return state
}

export type IllegalReason =
  | 'game-over'
  | 'unknown-country'
  | 'out-of-play'
  | 'wrong-landmass'
  | 'already-named'

export type MoveCheck =
  | { readonly ok: true; readonly code: CountryCode }
  | { readonly ok: false; readonly reason: IllegalReason; readonly message: string }

/**
 * Validates a country against the board. There is no adjacency rule and no
 * turn order: name anywhere, any time, and it either helps or it does not.
 * Rejections are free — none of them cost a guess.
 */
export function checkMove(state: GameState, code: CountryCode): MoveCheck {
  if (state.status === 'won') {
    return { ok: false, reason: 'game-over', message: 'You already met.' }
  }
  if (!exists(code)) {
    return { ok: false, reason: 'unknown-country', message: `${code} is not a country in this game.` }
  }

  const country = getCountry(code)

  if (!isPlayable(code)) {
    return {
      ok: false,
      reason: 'out-of-play',
      message: `${country.name} has no land border with anywhere, so it is not in this game.`,
    }
  }
  if (!sameLandmass(code, state.starts[0])) {
    return {
      ok: false,
      reason: 'wrong-landmass',
      message: `${country.name} is on a different landmass — you could never walk there.`,
    }
  }
  if (claimedCodes(state).has(code)) {
    return {
      ok: false,
      reason: 'already-named',
      message: `${country.name} is already on the board.`,
    }
  }

  return { ok: true, code }
}

/** What a player typed, checked. Quotes them back when the name means nothing. */
export function checkGuess(state: GameState, guess: string): MoveCheck {
  if (state.status === 'won') {
    return { ok: false, reason: 'game-over', message: 'You already met.' }
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
export function applyMove(state: GameState, code: CountryCode, player: PlayerIndex): GameState {
  const check = checkMove(state, code)
  if (!check.ok) throw new Error(check.message)

  const next: GameState = { ...state, moves: [...state.moves, { code: check.code, player }] }
  return { ...next, status: connectingRoute(next) ? 'won' : 'playing' }
}
