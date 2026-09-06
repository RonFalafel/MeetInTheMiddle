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
import { CONTINENTS, CONTINENT_IDS, continentOf, isContinentId } from './continents.ts'
import type { ContinentId } from './continents.ts'
import type { CountryCode } from './types.ts'

export type PlayerIndex = 0 | 1

export type Move = {
  /**
   * Usually a country. A few modes answer with something else — `SKIP`, or a
   * continent id in which-continent — which is why this is not narrowed.
   */
  readonly code: string
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
  | {
      readonly mode: 'identify'
      readonly scope: Scope
      readonly prompt: Prompt
      readonly order: readonly CountryCode[]
    }
  | { readonly mode: 'neighbours'; readonly hub: CountryCode }
  | { readonly mode: 'hot-cold'; readonly target: CountryCode }
  | { readonly mode: 'chain'; readonly start: CountryCode }
  | {
      readonly mode: 'compare'
      readonly scope: Scope
      readonly pairs: readonly (readonly [CountryCode, CountryCode])[]
    }
  | { readonly mode: 'which-continent'; readonly order: readonly CountryCode[] }

/** Where an identify round draws its countries from. */
export type Scope = ContinentId | 'world'

/** How an identify round asks about a country. */
export type Prompt = 'shape' | 'capital' | 'flag'

/** A country needs at least this many neighbours to be worth asking about. */
export const MIN_HUB_NEIGHBOURS = 4

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
  | { readonly mode: 'identify'; readonly scope: Scope; readonly prompt: Prompt }
  | { readonly mode: 'neighbours' }
  | { readonly mode: 'hot-cold' }
  | { readonly mode: 'chain' }
  | { readonly mode: 'compare'; readonly scope: Scope }
  | { readonly mode: 'which-continent' }

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
  readonly prompt: Prompt
  readonly order: readonly CountryCode[]
  /** Every attempt, right or wrong, plus `SKIP` for a country given up on. */
  readonly moves: readonly Move[]
  readonly status: 'playing' | 'won' | 'revealed'
}

/**
 * Name everything that borders one country. The adjacency graph already knows
 * the answer, so this mode is almost entirely free — it is the same
 * "complete this set" shape as a continent game with a different set.
 */
export type NeighboursGame = {
  readonly mode: 'neighbours'
  readonly hub: CountryCode
  readonly moves: readonly Move[]
  readonly status: 'playing' | 'won' | 'revealed'
}

/**
 * One secret country. Every guess is coloured by how close it is, so the map
 * becomes the clue — cold blue far away, red next door.
 */
export type HotColdGame = {
  readonly mode: 'hot-cold'
  readonly target: CountryCode
  readonly moves: readonly Move[]
  readonly status: 'playing' | 'won' | 'revealed'
}

/**
 * Walk as far as you can, one border at a time, never repeating a country.
 * There is no target — the score is how long a chain you manage before you run
 * out of ideas, which makes it the one mode you can play forever.
 */
export type ChainGame = {
  readonly mode: 'chain'
  readonly start: CountryCode
  readonly moves: readonly Move[]
  readonly status: 'playing' | 'won' | 'revealed'
}

/**
 * Two countries, one question: which is bigger? Pairs are dealt up front so
 * both phones ask the same thing, and every answer moves on — with only two
 * options there is nothing to gain from letting you try again.
 */
export type CompareGame = {
  readonly mode: 'compare'
  readonly scope: Scope
  readonly pairs: readonly (readonly [CountryCode, CountryCode])[]
  /** `code` is whichever of the pair was chosen. */
  readonly moves: readonly Move[]
  readonly status: 'playing' | 'won' | 'revealed'
}

/**
 * A country lights up and you tap a continent. No typing at all, which makes
 * it the quickest thing here on a phone.
 */
export type WhichContinentGame = {
  readonly mode: 'which-continent'
  readonly order: readonly CountryCode[]
  /** `code` is a ContinentId rather than a country — see `Move`. */
  readonly moves: readonly Move[]
  readonly status: 'playing' | 'won' | 'revealed'
}

export type GameState =
  | MeetGame
  | ContinentGame
  | IdentifyGame
  | NeighboursGame
  | HotColdGame
  | ChainGame
  | CompareGame
  | WhichContinentGame

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
  if (state.mode === 'neighbours') return { mode: 'neighbours', hub: state.hub }
  if (state.mode === 'hot-cold') return { mode: 'hot-cold', target: state.target }
  if (state.mode === 'chain') return { mode: 'chain', start: state.start }
  if (state.mode === 'compare') return { mode: 'compare', scope: state.scope, pairs: state.pairs }
  if (state.mode === 'which-continent') return { mode: 'which-continent', order: state.order }
  return { mode: 'identify', scope: state.scope, prompt: state.prompt, order: state.order }
}

/** Every country on the board, and who put it there. Meet includes both starts. */
export function claimedBy(state: GameState): Map<CountryCode, PlayerIndex> {
  const claimed = new Map<CountryCode, PlayerIndex>()
  if (state.mode === 'meet') {
    claimed.set(state.starts[0], 0)
    claimed.set(state.starts[1], 1)
  }
  if (state.mode === 'chain') claimed.set(state.start, 0)

  if (state.mode === 'compare') {
    // Colour the pair to match the two buttons, so the map is the question.
    const pair = currentPair(state)
    if (pair) {
      claimed.set(pair[0], 0)
      claimed.set(pair[1], 1)
    }
    return claimed
  }

  // Only the country being asked about matters here, and it is highlighted
  // rather than claimed — a continent id is not something to paint.
  if (state.mode === 'which-continent') return claimed

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
export function reveal<S extends Exclude<GameState, MeetGame>>(state: S): S {
  return state.status === 'playing' ? ({ ...state, status: 'revealed' } as S) : state
}

// -------------------------------------------------------------------- identify

/** The countries an identify round can draw from. */
export function scopeCodes(scope: Scope): readonly CountryCode[] {
  return scope === 'world' ? CODES : CONTINENTS[scope]
}

export function identifyGame(
  scope: Scope,
  prompt: Prompt,
  order: readonly CountryCode[],
): IdentifyGame {
  return { mode: 'identify', scope, prompt, order, moves: [], status: 'playing' }
}

/** Deals a round: a shuffled sample of the scope, fixed for the whole game. */
export function dealIdentify(
  scope: Scope,
  prompt: Prompt = 'shape',
  random: Random = Math.random,
): IdentifyGame {
  const pool = [...scopeCodes(scope)]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j]!, pool[i]!]
  }
  return identifyGame(scope, prompt, pool.slice(0, Math.min(ROUND_LENGTH, pool.length)))
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

/**
 * The answer a reveal just gave away, or null. Used to show what it was before
 * the round moves on, which is the whole point of revealing rather than skipping.
 */
export function justRevealed(state: IdentifyGame): CountryCode | null {
  const last = state.moves[state.moves.length - 1]
  if (!last || last.code !== SKIP) return null
  const { rows } = answered(state)
  return rows[rows.length - 1]?.target ?? null
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

// ------------------------------------------------------------------ neighbours

/** Countries with enough neighbours to make a puzzle rather than a gimme. */
export function hubCandidates(): readonly CountryCode[] {
  return PLAYABLE_CODES.filter((code) => getCountry(code).neighbours.length >= MIN_HUB_NEIGHBOURS)
}

export function neighboursGame(hub: CountryCode): NeighboursGame {
  return { mode: 'neighbours', hub, moves: [], status: 'playing' }
}

export function dealNeighbours(random: Random = Math.random): NeighboursGame {
  const hubs = hubCandidates()
  return neighboursGame(hubs[Math.floor(random() * hubs.length)]!)
}

export function neighbourTargets(state: NeighboursGame): readonly CountryCode[] {
  return getCountry(state.hub).neighbours
}

export function neighbourRemaining(state: NeighboursGame): CountryCode[] {
  const claimed = claimedCodes(state)
  return neighbourTargets(state).filter((code) => !claimed.has(code))
}

// -------------------------------------------------------------------- hot/cold

/**
 * Great-circle distance between two countries' centroids, in kilometres.
 *
 * Haversine written out rather than pulled from d3-geo, so the game layer stays
 * free of the map's dependencies and the server does not have to load a
 * projection library to score a guess.
 */
export function kilometresBetween(a: CountryCode, b: CountryCode): number {
  const EARTH_RADIUS_KM = 6371
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180

  const [aLon, aLat] = getCountry(a).centroid
  const [bLon, bLat] = getCountry(b).centroid

  const dLat = toRadians(bLat - aLat)
  const dLon = toRadians(bLon - aLon)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(aLat)) * Math.cos(toRadians(bLat)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

/**
 * The far side of the world, near enough. Everything is scaled against this so
 * that the whole planet uses the whole gradient.
 */
const ANTIPODAL_KM = 20000

/**
 * 0 for the far side of the world, 1 for the country itself.
 *
 * The exponent is the whole trick. Exponential decay (the first attempt) put
 * every guess beyond a few thousand kilometres into the same dark shade, so a
 * board full of far guesses was a board of identical squares. A plain linear
 * ramp has the opposite fault and leaves all of Europe one colour. A root curve
 * spreads both ends: every distance band gets its own visible step.
 */
export function heatOf(state: HotColdGame, code: CountryCode): number {
  if (code === state.target) return 1
  const share = Math.min(1, kilometresBetween(code, state.target) / ANTIPODAL_KM)
  return 1 - share ** 0.6
}

export function hotColdGame(target: CountryCode): HotColdGame {
  return { mode: 'hot-cold', target, moves: [], status: 'playing' }
}

export function dealHotCold(random: Random = Math.random): HotColdGame {
  // Any country at all: islands make perfectly good secrets here, because
  // distance does not care about land routes.
  return hotColdGame(CODES[Math.floor(random() * CODES.length)]!)
}

export type HotColdGuess = {
  readonly code: CountryCode
  readonly heat: number
  readonly km: number
  /** Shares a land border with the answer, which is worth saying out loud. */
  readonly borders: boolean
}

/** Every guess with its heat, hottest first — the running scoreboard. */
export function hotColdGuesses(state: HotColdGame): HotColdGuess[] {
  const neighbours = new Set(getCountry(state.target).neighbours)
  const seen = new Set<CountryCode>()
  const rows: HotColdGuess[] = []

  for (const move of state.moves) {
    if (seen.has(move.code)) continue
    seen.add(move.code)
    rows.push({
      code: move.code,
      heat: heatOf(state, move.code),
      km: Math.round(kilometresBetween(move.code, state.target)),
      borders: neighbours.has(move.code),
    })
  }
  return rows.sort((a, b) => b.heat - a.heat)
}

/** The last country guessed, so the screen can react to what just happened. */
export function lastGuess(state: HotColdGame): HotColdGuess | null {
  const code = state.moves[state.moves.length - 1]?.code
  if (!code) return null
  return hotColdGuesses(state).find((row) => row.code === code) ?? null
}

// ---------------------------------------------------------------------- chain

export function chainGame(start: CountryCode): ChainGame {
  return { mode: 'chain', start, moves: [], status: 'playing' }
}

export function dealChain(random: Random = Math.random): ChainGame {
  // Starting somewhere with options: a country with one neighbour is a chain
  // that ends on the first move.
  const starts = hubCandidates()
  return chainGame(starts[Math.floor(random() * starts.length)]!)
}

/** Where the chain currently stands, and therefore what the next country must border. */
export function chainHead(state: ChainGame): CountryCode {
  return state.moves[state.moves.length - 1]?.code ?? state.start
}

/** The whole walk so far, starting country included. */
export function chainRoute(state: ChainGame): CountryCode[] {
  return [state.start, ...state.moves.map((move) => move.code)]
}

/** Neighbours of the head that have not been used yet. Empty means stuck. */
export function chainOptions(state: ChainGame): CountryCode[] {
  const used = claimedCodes(state)
  return getCountry(chainHead(state)).neighbours.filter((code) => !used.has(code))
}

// -------------------------------------------------------------- bigger or smaller

/**
 * How far apart two areas must be to make a fair question.
 *
 * The 50m outlines are simplified, so an area can be a few per cent off the
 * official figure. Anything closer than this and our answer might disagree with
 * an atlas, which would be worse than a boring question.
 */
const MIN_AREA_RATIO = 1.2
const MAX_AREA_RATIO = 6

export function comparePairs(
  scope: Scope,
  random: Random = Math.random,
  rounds = ROUND_LENGTH,
): [CountryCode, CountryCode][] {
  const pool = scopeCodes(scope).filter((code) => getCountry(code).area > 0)
  const pairs: [CountryCode, CountryCode][] = []
  const used = new Set<string>()

  for (let attempt = 0; attempt < 4000 && pairs.length < rounds; attempt++) {
    const a = pool[Math.floor(random() * pool.length)]!
    const b = pool[Math.floor(random() * pool.length)]!
    if (a === b) continue

    const key = [a, b].sort().join('-')
    if (used.has(key)) continue

    const ratio = Math.max(getCountry(a).area, getCountry(b).area) /
      Math.min(getCountry(a).area, getCountry(b).area)
    if (ratio < MIN_AREA_RATIO || ratio > MAX_AREA_RATIO) continue

    used.add(key)
    pairs.push([a, b])
  }
  return pairs
}

export function compareGame(
  scope: Scope,
  pairs: readonly (readonly [CountryCode, CountryCode])[],
): CompareGame {
  return { mode: 'compare', scope, pairs, moves: [], status: 'playing' }
}

export function dealCompare(scope: Scope = 'world', random: Random = Math.random): CompareGame {
  return compareGame(scope, comparePairs(scope, random))
}

/** The pair being asked about, or null once the round is done. */
export function currentPair(
  state: CompareGame,
): readonly [CountryCode, CountryCode] | null {
  return state.pairs[state.moves.length] ?? null
}

/** Which of a pair is actually bigger. */
export function biggerOf(pair: readonly [CountryCode, CountryCode]): CountryCode {
  return getCountry(pair[0]).area >= getCountry(pair[1]).area ? pair[0] : pair[1]
}

// ------------------------------------------------------------- which continent

export function whichContinentGame(order: readonly CountryCode[]): WhichContinentGame {
  return { mode: 'which-continent', order, moves: [], status: 'playing' }
}

export function dealWhichContinent(random: Random = Math.random): WhichContinentGame {
  const pool = [...CODES]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j]!, pool[i]!]
  }
  return whichContinentGame(pool.slice(0, ROUND_LENGTH))
}

export function currentCountry(state: WhichContinentGame): CountryCode | null {
  return state.order[state.moves.length] ?? null
}

/**
 * How the last question went, once it has moved on. These two modes advance on
 * any answer, so without this a wrong tap teaches nothing.
 */
export function previousAnswer(
  state: CompareGame | WhichContinentGame,
): { readonly answer: string; readonly right: boolean } | null {
  const index = state.moves.length - 1
  const move = state.moves[index]
  if (!move) return null

  if (state.mode === 'compare') {
    const pair = state.pairs[index]
    if (!pair) return null
    const answer = biggerOf(pair)
    return { answer, right: move.code === answer }
  }

  const code = state.order[index]
  if (!code) return null
  const answer = continentOf(code)!
  return { answer, right: move.code === answer }
}

// ------------------------------------------------- scoring the tap-through modes

export type RoundScore = {
  readonly asked: number
  readonly right: number
  readonly total: number
  /** What was got wrong, as [question, given, correct]. */
  readonly wrong: readonly { question: string; given: string; answer: string }[]
}

export function compareScore(state: CompareGame): RoundScore {
  const wrong: { question: string; given: string; answer: string }[] = []
  let right = 0

  state.moves.forEach((move, index) => {
    const pair = state.pairs[index]
    if (!pair) return
    const answer = biggerOf(pair)
    if (move.code === answer) right++
    else wrong.push({ question: `${pair[0]}/${pair[1]}`, given: move.code, answer })
  })

  return { asked: state.moves.length, right, total: state.pairs.length, wrong }
}

export function whichContinentScore(state: WhichContinentGame): RoundScore {
  const wrong: { question: string; given: string; answer: string }[] = []
  let right = 0

  state.moves.forEach((move, index) => {
    const code = state.order[index]
    if (!code) return
    const answer = continentOf(code)!
    if (move.code === answer) right++
    else wrong.push({ question: code, given: move.code, answer })
  })

  return { asked: state.moves.length, right, total: state.order.length, wrong }
}

// ----------------------------------------------------------------------- setup

export function fromSetup(setup: Setup): GameState {
  if (setup.mode === 'meet') return gameFrom(setup.starts[0], setup.starts[1])
  if (setup.mode === 'continent') return continentGame(setup.continent)
  if (setup.mode === 'neighbours') return neighboursGame(setup.hub)
  if (setup.mode === 'hot-cold') return hotColdGame(setup.target)
  if (setup.mode === 'chain') return chainGame(setup.start)
  if (setup.mode === 'compare') return compareGame(setup.scope, setup.pairs)
  if (setup.mode === 'which-continent') return whichContinentGame(setup.order)
  return identifyGame(setup.scope, setup.prompt, setup.order)
}

/** Deals a game from a request, choosing whatever the request left open. */
export function deal(request: GameRequest | undefined, options: StartOptions = {}): GameState {
  if (request?.mode === 'continent') return continentGame(request.continent)
  if (request?.mode === 'neighbours') return dealNeighbours(options.random)
  if (request?.mode === 'hot-cold') return dealHotCold(options.random)
  if (request?.mode === 'chain') return dealChain(options.random)
  if (request?.mode === 'compare') return dealCompare(request.scope, options.random)
  if (request?.mode === 'which-continent') return dealWhichContinent(options.random)
  if (request?.mode === 'identify') {
    return dealIdentify(request.scope, request.prompt, options.random)
  }
  return newGame(options)
}

/** What "again" means: the same continent, or a fresh pair of starts. */
export function repeatOf(game: GameState): GameRequest {
  if (game.mode === 'continent') return { mode: 'continent', continent: game.continent }
  // A new shuffle of the same scope, not the same ten countries again.
  if (game.mode === 'identify') {
    return { mode: 'identify', scope: game.scope, prompt: game.prompt }
  }
  // A different country to be asked about, not the same one twice.
  if (game.mode === 'neighbours') return { mode: 'neighbours' }
  if (game.mode === 'hot-cold') return { mode: 'hot-cold' }
  if (game.mode === 'chain') return { mode: 'chain' }
  if (game.mode === 'compare') return { mode: 'compare', scope: game.scope }
  if (game.mode === 'which-continent') return { mode: 'which-continent' }
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
  | 'not-a-neighbour'
  | 'not-adjacent'
  | 'not-an-option'
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
  // which-continent answers with a continent, so the country check comes after.
  if (state.mode === 'which-continent') {
    return isContinentId(code) ? { ok: true, code } : { ok: false, reason: 'not-an-option' }
  }
  if (!exists(code)) return { ok: false, reason: 'unknown-country', text: code }

  if (state.mode === 'compare') {
    const pair = currentPair(state)
    if (!pair?.includes(code)) return { ok: false, reason: 'not-an-option' }
    return { ok: true, code }
  }

  if (state.mode === 'identify') {
    // Anything goes: a wrong answer is part of the game rather than a refusal,
    // so it is recorded and costs you, instead of being handed back.
    return { ok: true, code }
  }

  if (state.mode === 'chain') {
    if (claimedCodes(state).has(code)) {
      return { ok: false, reason: 'already-named', country: code }
    }
    if (!getCountry(chainHead(state)).neighbours.includes(code)) {
      return { ok: false, reason: 'not-adjacent', country: code }
    }
    return { ok: true, code }
  }

  if (state.mode === 'hot-cold') {
    // Every country is a legal guess — being wrong is how you find the target,
    // and the colour it comes back is the whole point.
    if (claimedCodes(state).has(code)) {
      return { ok: false, reason: 'already-named', country: code }
    }
    return { ok: true, code }
  }

  if (state.mode === 'meet') {
    if (!isPlayable(code)) return { ok: false, reason: 'out-of-play', country: code }
    if (!sameLandmass(code, state.starts[0])) {
      return { ok: false, reason: 'wrong-landmass', country: code }
    }
  } else if (state.mode === 'neighbours') {
    if (!neighbourTargets(state).includes(code)) {
      return { ok: false, reason: 'not-a-neighbour', country: code }
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
  // Anywhere on earth is a legitimate guess when you are hunting by distance.
  if (state.mode === 'hot-cold') return new Set(CODES)
  // Not narrowed to the head's neighbours, for the same reason as the
  // neighbours mode: that list would be the answer.
  if (state.mode === 'chain') {
    return new Set(PLAYABLE_CODES.filter((code) => sameLandmass(code, state.start)))
  }
  // Answered by tapping, so there is nothing for an autocomplete to offer.
  if (state.mode === 'compare' || state.mode === 'which-continent') return new Set()
  // Neighbours deliberately does not narrow to the answer set: offering only
  // the nine countries that border Germany would be the answer sheet.
  if (state.mode === 'neighbours') {
    return new Set(PLAYABLE_CODES.filter((code) => sameLandmass(code, state.hub)))
  }
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

  if (state.mode === 'neighbours') {
    const next: NeighboursGame = { ...state, moves }
    return { ...next, status: neighbourRemaining(next).length === 0 ? 'won' : 'playing' } as S
  }

  if (state.mode === 'hot-cold') {
    const next: HotColdGame = { ...state, moves }
    return { ...next, status: check.code === state.target ? 'won' : 'playing' } as S
  }

  if (state.mode === 'chain') {
    const next: ChainGame = { ...state, moves }
    // Running the head dry is a finish rather than a failure — you exhausted it.
    return { ...next, status: chainOptions(next).length === 0 ? 'won' : 'playing' } as S
  }

  if (state.mode === 'compare') {
    const next: CompareGame = { ...state, moves }
    return { ...next, status: currentPair(next) === null ? 'won' : 'playing' } as S
  }

  if (state.mode === 'which-continent') {
    const next: WhichContinentGame = { ...state, moves }
    return { ...next, status: currentCountry(next) === null ? 'won' : 'playing' } as S
  }

  const next: ContinentGame = { ...state, moves }
  return { ...next, status: continentRemaining(next).length === 0 ? 'won' : 'playing' } as S
}
