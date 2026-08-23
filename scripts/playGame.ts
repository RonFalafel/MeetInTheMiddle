/**
 * Plays a game without a browser, so the rules can be argued with before any
 * pixels exist.
 *
 *   npm run play                              random game, walked optimally
 *   npm run play -- --from PRT --to POL       chosen starts, walked optimally
 *   npm run play -- --from PRT --to POL ESP DEU
 *                                             chosen starts, scripted moves
 *   npm run play -- --stats 2000              par distribution over N games
 *
 * Moves are country codes or names, alternating between the two players.
 */

import { distance, getCountry, resolveCountry } from '../src/game/graph.ts'
import {
  applyMove,
  checkMove,
  gameFrom,
  head,
  movesMade,
  newGame,
  optimalRoute,
  par,
  startPair,
} from '../src/game/rules.ts'
import type { GameState } from '../src/game/rules.ts'
import type { CountryCode } from '../src/game/types.ts'

const argv = process.argv.slice(2)

const flag = (name: string): string | undefined => {
  const at = argv.indexOf(`--${name}`)
  return at === -1 ? undefined : argv[at + 1]
}

const positional = (): string[] => {
  const out: string[] = []
  for (let i = 0; i < argv.length; i++) {
    if (argv[i]!.startsWith('--')) i++ // skip the flag and its value
    else out.push(argv[i]!)
  }
  return out
}

const name = (code: CountryCode) => getCountry(code).name

if (flag('stats') !== undefined) {
  reportStats(Number(flag('stats')))
} else {
  playOneGame()
}

function playOneGame(): void {
  const from = flag('from')
  const to = flag('to')
  const start = from && to ? ([from, to] as [CountryCode, CountryCode]) : startPair()

  let game = gameFrom(start[0], start[1])
  const scripted = positional()

  console.log(`\n  ${name(start[0])}  ...  ${name(start[1])}`)
  console.log(`  ${game.optimalDistance} borders apart, so par is ${par(game)}\n`)

  const moves = scripted.length > 0 ? scripted : optimalMoves(game)

  for (const move of moves) {
    if (game.status === 'won') {
      console.log(`  (ignored "${move}" — already met)`)
      continue
    }
    const player = game.turn
    const country = resolveCountry(move)
    if (!country) {
      console.log(`  P${player + 1}  ${move} — rejected: no such country`)
      continue
    }
    const check = checkMove(game, country.code)
    if (!check.ok) {
      console.log(`  P${player + 1}  ${move} — rejected: ${check.message}`)
      continue
    }
    game = applyMove(game, check.code)
    console.log(`  P${player + 1}  ${name(check.code)}`)
  }

  console.log()
  if (game.status === 'won') {
    console.log(`  Met in ${name(head(game.chains[0]))} / ${name(head(game.chains[1]))}`)
    console.log(`  Score ${movesMade(game)}, par ${par(game)}` +
      (movesMade(game) === par(game) ? '  — perfect' : ` — ${movesMade(game) - par(game)} over`))
  } else {
    console.log(`  Unfinished: P1 in ${name(head(game.chains[0]))}, P2 in ${name(head(game.chains[1]))}`)
  }
  console.log(`  Best route was ${optimalRoute(game).map(name).join(' → ')}\n`)
}

/** Both players walk the shortest route toward each other. This is par by definition. */
function optimalMoves(game: GameState): CountryCode[] {
  const route = optimalRoute(game)
  const moves: CountryCode[] = []
  let low = 1
  let high = route.length - 2
  let turn = 0
  while (low <= high) {
    moves.push(turn === 0 ? route[low++]! : route[high--]!)
    turn = turn === 0 ? 1 : 0
  }
  return moves
}

function reportStats(games: number): void {
  const pars = new Map<number, number>()
  const starts = new Map<CountryCode, number>()

  for (let i = 0; i < games; i++) {
    const game = newGame()
    const value = par(game)
    pars.set(value, (pars.get(value) ?? 0) + 1)
    for (const chain of game.chains) {
      const code = chain.countries[0]!
      starts.set(code, (starts.get(code) ?? 0) + 1)
    }
  }

  console.log(`\n  ${games} games\n`)
  console.log('  par   games')
  for (const [value, count] of [...pars].sort((a, b) => a[0] - b[0])) {
    console.log(`  ${String(value).padStart(3)}   ${String(count).padStart(5)}  ${'#'.repeat(Math.round((count / games) * 60))}`)
  }

  const ranked = [...starts].sort((a, b) => b[1] - a[1])
  console.log(`\n  ${starts.size} of 196 countries appeared as a start`)
  console.log(`  most common: ${ranked.slice(0, 6).map(([c, n]) => `${name(c)} ${n}`).join(', ')}`)

  const sample = newGame()
  console.log(`\n  sample: ${name(sample.chains[0].countries[0]!)} to ${name(sample.chains[1].countries[0]!)}` +
    `, ${distance(sample.chains[0].countries[0]!, sample.chains[1].countries[0]!)} apart\n`)
}
