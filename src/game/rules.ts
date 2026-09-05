import {
  CODES,
  PLAYABLE_CODES,
  exists,
  findByName,
  getCountry,
  isPlayable,
  sameLandmass,
  shortestPath,
} from './graph.ts'
import { CONTINENTS, CONTINENT_IDS, continentOf } from './continents.ts'
import type { ContinentId } from './continents.ts'
import type { CountryCode } from './types.ts'

export type PlayerIndex = 0 | 1

export type Move = {
  readonly code: CountryCode
  readonly player: PlayerIndex
}

/**
 * Everything needed to deal a specific game, and the only thing besides the
 * move list that has to travel between two devices. `fromSetup(setup)` plus a
 * move list reproduces a game exactly.
 */
export type Setup =
  | { readonly mode: 'meet'; readonly starts: readonly [CountryCode, CountryCode] }
  | { readonly mode: 'continent'; readonly continent: ContinentId }
  | { readonly mode: 'identify'; readonly scope: Scope; readonly order: readonly CountryCode[] }

/** Where an identify round draws its countries from. */
export type Scope = ContinentId | 'world'

/** Passed instead of a country to give up on the one currently highlighted. */
export const SKIP = '--'

/** How many countries one identify round asks about. */
export const ROUND_LENGTH = 10

/**
 * What someone asks for, as opposed to what they get. A meet game is requested
 * without starts — those are dealt — while a `Setup` always names them, which
 * is what makes a snapshot replayable.
 */
export type GameRequest =
  | { readonly mode: 'meet' }
  | { readonly mode: 'continent'; readonly continent: ContinentId }
  | { readonly mode: 'identify'; readonly scope: Scope }

/** Walk toward each other from two secret starts. */
export type MeetGame = {
  readonly mode: 'meet'
  readonly starts: readonly [CountryCode, CountryCode]
  readonly moves: readonly Move[]
  readonly status: 'playing' | 'won'
  /** Borders between the two secret starts. Fixed for the life of the game. */
  readonly optimalDistance: number
}

/**
 * Fill in a whole continent together. No starts, no routes, no land
 * connectivity — which is why islands that Meet in the Middle cannot use are
 * fair game here, and why Oceania exists at all.
 */
export type ContinentGame = {
  readonly mode: 'continent'
  readonly continent: ContinentId
  readonly moves: readonly Move[]
  /** `revealed` means they gave up and asked to see the rest. */
  readonly status: 'playing' | 'won' | 'revealed'
}

/**
 * A country is highlighted on the map and you name it.
 *
 * The order is dealt once and carried in the setup rather than derived, so both
 * phones highlight the same country and a reconnecting device rejoins the same
 * round rather than a fresh shuffle.
 */
export type IdentifyGame = {
  readonly mode: 'identify'
  readonly scope: Scope
  readonly order: readonly CountryCode[]
  /** Every attempt, right or wrong, plus `SKIP` for a country given up on. */
  readonly moves: readonly Move[]
  readonly status: 'playing' | 'won' | 'revealed'
}

export type GameState = MeetGame | ContinentGame | IdentifyGame

export type Random = () => number

export type StartOptions = {
  readonly minHops?: number
  readonly maxHops?: number
  readonly random?: Random
}

const DEFAULT_MIN_HOPS = 5
const DEFAULT_MAX_HOPS = 9

export function isOver(state: GameState): boolean {
  return state.status !== 'playing'
}

export function setupOf(state: GameState): Setup {
  if (state.mode === 'meet') return { mode: 'meet', starts: state.starts }
  if (state.mode === 'continent') return { mode: 'continent', continent: state.continent }
  return { mode: 'identify', scope: state.scope, order: state.order }
}

/** Every country on the board, and who put it there. Meet includes both starts. */
export function claimedBy(state: GameState): Map<CountryCode, PlayerIndex> {
  const claimed = new Map<CountryCode, PlayerIndex>()
  if (state.mode === 'meet') {
    claimed.set(state.starts[0], 0)
    claimed.set(state.starts[1], 1)
  }

  if (state.mode === 'identify') {
    // Only the ones actually got right belong on the map; a wrong guess should
    // not colour in a country as though it had been placed.
    for (const { code, player } of correctAnswers(state)) claimed.set(code, player)
    return claimed
  }

  for (const move of state.moves) if (!claimed.has(move.code)) claimed.set(move.code, move.player)
  return claimed
}

export function claimedCodes(state: GameState): Set<CountryCode> {
  return new Set(claimedBy(state).keys())
}

/** Countries named so far. In Meet in the Middle this is the score, lower being better. */
export function movesMade(state: GameState): number {
  return state.moves.length
}

// ------------------------------------------------------------- meet in the middle

/**
 * The best possible score. Two starts d borders apart need d - 1 countries
 * between them to join up.
 */
export function par(state: MeetGame): number {
  return state.optimalDistance - 1
}

/** The route the game was hiding, revealed at the end. */
export function optimalRoute(state: MeetGame): CountryCode[] {
  return shortestPath(state.starts[0], state.starts[1])
}

/**
 * A route from one start to the other using only countries that have been
 * named, or null if the two sides are still apart. This is the win condition
 * and also what gets drawn on the map when the game ends.
 */
export function connectingRoute(state: MeetGame): CountryCode[] | null {
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
 * who owns what. The only signal that makes a distant guess worth trying.
 */
export function countriesStillNeeded(state: MeetGame): number {
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

export function newGame(options: StartOptions = {}): MeetGame {
  const [a, b] = startPair(options)
  return gameFrom(a, b)
}

/** A game with chosen starts. Deterministic, which is what tests and rooms want. */
export function gameFrom(a: CountryCode, b: CountryCode): MeetGame {
  if (!sameLandmass(a, b)) {
    throw new Error(`${a} and ${b} are not on the same landmass, so they could never meet`)
  }
  const base: MeetGame = {
    mode: 'meet',
    starts: [a, b],
    moves: [],
    status: 'playing',
    optimalDistance: shortestPath(a, b).length - 1,
  }
  return { ...base, status: connectingRoute(base) ? 'won' : 'playing' }
}

// ------------------------------------------------------------------ continents

/** Every country that has to be named to finish. */
export function continentTargets(state: ContinentGame): readonly CountryCode[] {
  return CONTINENTS[state.continent]
}

/** Still to be named. After a reveal this is the list of what was missed. */
export function continentRemaining(state: ContinentGame): CountryCode[] {
  const claimed = claimedCodes(state)
  return continentTargets(state).filter((code) => !claimed.has(code))
}

export function continentGame(continent: ContinentId): ContinentGame {
  return { mode: 'continent', continent, moves: [], status: 'playing' }
}

export function randomContinent(random: Random = Math.random): ContinentId {
  return CONTINENT_IDS[Math.floor(random() * CONTINENT_IDS.length)]!
}

/** Ends a continent game early so the missed countries can be shown. */
export function reveal<S extends ContinentGame | IdentifyGame>(state: S): S {
  return state.status === 'playing' ? ({ ...state, status: 'revealed' } as S) : state
}

// -------------------------------------------------------------------- identify

/** The countries an identify round can draw from. */
export function scopeCodes(scope: Scope): readonly CountryCode[] {
  return scope === 'world' ? CODES : CONTINENTS[scope]
}

export function identifyGame(scope: Scope, order: readonly CountryCode[]): IdentifyGame {
  return { mode: 'identify', scope, order, moves: [], status: 'playing' }
}

/** Deals a round: a shuffled sample of the scope, fixed for the whole game. */
export function dealIdentify(scope: Scope, random: Random = Math.random): IdentifyGame {
  const pool = [...scopeCodes(scope)]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j]!, pool[i]!]
  }
  return identifyGame(scope, pool.slice(0, Math.min(ROUND_LENGTH, pool.length)))
}

/**
 * Walks the attempts, pairing each with the country it was answering. A move
 * either lands on the current target and moves on, or is a wrong guess and
 * does not.
 */
function answered(state: IdentifyGame) {
  const rows: { target: CountryCode; move: Move; right: boolean }[] = []
  let index = 0
  for (const move of state.moves) {
    const target = state.order[index]
    if (target === undefined) break
    const right = move.code === target
    rows.push({ target, move, right })
    if (right || move.code === SKIP) index++
  }
  return { rows, index }
}

function correctAnswers(state: IdentifyGame): { code: CountryCode; player: PlayerIndex }[] {
  return answered(state)
    .rows.filter((row) => row.right)
    .map((row) => ({ code: row.target, player: row.move.player }))
}

/** The country highlighted right now, or null once the round is done. */
export function currentTarget(state: IdentifyGame): CountryCode | null {
  return state.order[answered(state).index] ?? null
}

export type IdentifyScore = {
  readonly asked: number
  readonly right: number
  readonly wrong: number
  readonly total: number
  /** Countries that were skipped or never reached. */
  readonly missed: readonly CountryCode[]
}

export function identifyScore(state: IdentifyGame): IdentifyScore {
  const { rows, index } = answered(state)
  const right = rows.filter((row) => row.right).map((row) => row.target)
  return {
    asked: index,
    right: right.length,
    wrong: rows.filter((row) => !row.right && row.move.code !== SKIP).length,
    total: state.order.length,
    missed: state.order.filter((code) => !right.includes(code)),
  }
}

// ----------------------------------------------------------------------- setup

export function fromSetup(setup: Setup): GameState {
  if (setup.mode === 'meet') return gameFrom(setup.starts[0], setup.starts[1])
  if (setup.mode === 'continent') return continentGame(setup.continent)
  return identifyGame(setup.scope, setup.order)
}

/** Deals a game from a request, choosing whatever the request left open. */
export function deal(request: GameRequest | undefined, options: StartOptions = {}): GameState {
  if (request?.mode === 'continent') return continentGame(request.continent)
  if (request?.mode === 'identify') return dealIdentify(request.scope, options.random)
  return newGame(options)
}

/** What "again" means: the same continent, or a fresh pair of starts. */
export function repeatOf(game: GameState): GameRequest {
  if (game.mode === 'continent') return { mode: 'continent', continent: game.continent }
  // A new shuffle of the same scope, not the same ten countries again.
  if (game.mode === 'identify') return { mode: 'identify', scope: game.scope }
  return { mode: 'meet' }
}

/** Replays a move list, which is how a device catches up after reconnecting. */
export function replay(setup: Setup, moves: readonly Move[]): GameState {
  let state = fromSetup(setup)
  for (const move of moves) state = applyMove(state, move.code, move.player)
  return state
}

/**
 * A whole game, small enough to put on the wire.
 *
 * `revealed` has to be carried rather than derived: giving up is the one piece
 * of state that no sequence of moves implies, so leaving it out silently means
 * one player gives up and the other never finds out.
 */
export type Snapshot = {
  readonly setup: Setup
  readonly moves: readonly Move[]
  readonly revealed?: true
}

export function snapshot(state: GameState): Snapshot {
  const base = { setup: setupOf(state), moves: state.moves }
  return state.status === 'revealed' ? { ...base, revealed: true } : base
}

export function fromSnapshot(snap: Snapshot): GameState {
  const state = replay(snap.setup, snap.moves)
  if (!snap.revealed || state.mode === 'meet') return state
  return reveal(state)
}

// ------------------------------------------------------------------ validation

export type IllegalReason =
  | 'game-over'
  | 'unknown-country'
  | 'out-of-play'
  | 'wrong-landmass'
  | 'wrong-continent'
  | 'already-named'

/**
 * A refusal carries the reason and what it was about, not a finished sentence.
 * The screen has to say this in the reader's language, and the server has to
 * put it on the wire, so neither can be handed English prose.
 */
export type Rejection = {
  readonly ok: false
  readonly reason: IllegalReason
  /** The country refused, when the guess resolved to one. */
  readonly country?: CountryCode
  /** What the player typed, when it resolved to nothing. */
  readonly text?: string
}

export type MoveCheck = { readonly ok: true; readonly code: CountryCode } | Rejection

/**
 * Validates a country against the board. There is no adjacency rule and no
 * turn order: name anywhere, any time, and it either helps or it does not.
 * Rejections are free — none of them cost a guess.
 */
export function checkMove(state: GameState, code: CountryCode): MoveCheck {
  if (isOver(state)) return { ok: false, reason: 'game-over' }
  if (code === SKIP && state.mode === 'identify') return { ok: true, code }
  if (!exists(code)) return { ok: false, reason: 'unknown-country', text: code }

  if (state.mode === 'identify') {
    // Anything goes: a wrong answer is part of the game rather than a refusal,
    // so it is recorded and costs you, instead of being handed back.
    return { ok: true, code }
  }

  if (state.mode === 'meet') {
    if (!isPlayable(code)) return { ok: false, reason: 'out-of-play', country: code }
    if (!sameLandmass(code, state.starts[0])) {
      return { ok: false, reason: 'wrong-landmass', country: code }
    }
  } else if (continentOf(code) !== state.continent) {
    // Land routes are irrelevant here, so an island is only wrong if it is on
    // the wrong continent.
    return { ok: false, reason: 'wrong-continent', country: code }
  }

  if (claimedCodes(state).has(code)) return { ok: false, reason: 'already-named', country: code }

  return { ok: true, code }
}

/**
 * Every country this game would accept, ignoring what has already been named.
 * The autocomplete uses it so it never offers a country that is guaranteed to
 * be refused — which in a continent game means islands are offered and other
 * continents are not.
 */
export function namableCodes(state: GameState): ReadonlySet<CountryCode> {
  if (state.mode === 'continent') return new Set(CONTINENTS[state.continent])
  if (state.mode === 'identify') return new Set(scopeCodes(state.scope))
  return new Set(PLAYABLE_CODES.filter((code) => sameLandmass(code, state.starts[0])))
}

/** What a player typed, checked. Quotes them back when the name means nothing. */
export function checkGuess(state: GameState, guess: string): MoveCheck {
  if (isOver(state)) return { ok: false, reason: 'game-over' }

  const country = findByName(guess)
  if (!country) return { ok: false, reason: 'unknown-country', text: guess.trim() }
  return checkMove(state, country.code)
}

/**
 * Applies a legal move. Throws if it is not one, so check first.
 *
 * Generic in the game type because a move never changes the mode: applying one
 * to a `MeetGame` gives back a `MeetGame`, and callers keep their narrowing.
 */
export function applyMove<S extends GameState>(state: S, code: CountryCode, player: PlayerIndex): S {
  const check = checkMove(state, code)
  if (!check.ok) throw new Error(`${code}: ${check.reason}`)

  const moves = [...state.moves, { code: check.code, player }]

  if (state.mode === 'meet') {
    const next: MeetGame = { ...state, moves }
    return { ...next, status: connectingRoute(next) ? 'won' : 'playing' } as S
  }

  if (state.mode === 'identify') {
    const next: IdentifyGame = { ...state, moves }
    return { ...next, status: currentTarget(next) === null ? 'won' : 'playing' } as S
  }

  const next: ContinentGame = { ...state, moves }
  return { ...next, status: continentRemaining(next).length === 0 ? 'won' : 'playing' } as S
}
