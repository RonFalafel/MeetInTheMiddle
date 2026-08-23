/**
 * Plays a game without a browser, so the rules can be argued with before any
 * pixels exist.
 *
 *   npm run play                              random game, played optimally
 *   npm run play -- --from PRT --to POL       chosen starts, played optimally
 *   npm run play -- --from PRT --to POL ESP DEU
 *                                             chosen starts, named countries
 *   npm run play -- --stats 2000              par distribution over N games
 *
 * Countries are codes or names. There are no turns, so they are just attributed
 * to alternating players for the transcript.
 */

import { getCountry, resolveCountry } from '../src/game/graph.ts'
import {
  applyMove,
  checkMove,
  claimedBy,
  connectingRoute,
  countriesStillNeeded,
  gameFrom,
  movesMade,
  newGame,
  optimalRoute,
  par,
  startPair,
} from '../src/game/rules.ts'
import type { PlayerIndex } from '../src/game/rules.ts'
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

  const names = scripted.length > 0 ? scripted : optimalRoute(game).slice(1, -1)

  names.forEach((guess, index) => {
    const player = (index % 2) as PlayerIndex
    if (game.status === 'won') {
      console.log(`  (ignored "${guess}" — already met)`)
      return
    }
    const country = resolveCountry(guess)
    if (!country) {
      console.log(`  P${player + 1}  ${guess} — rejected: no such country`)
      return
    }
    const check = checkMove(game, country.code)
    if (!check.ok) {
      console.log(`  P${player + 1}  ${guess} — rejected: ${check.reason}`)
      return
    }
    game = applyMove(game, check.code, player)
    const left = countriesStillNeeded(game)
    console.log(`  P${player + 1}  ${name(check.code).padEnd(24)} ${left === 0 ? 'joined up' : `${left} still needed`}`)
  })

  console.log()
  if (game.status === 'won') {
    console.log(`  Route: ${connectingRoute(game)!.map(name).join(' → ')}`)
    const over = movesMade(game) - par(game)
    console.log(`  Score ${movesMade(game)}, par ${par(game)}${over === 0 ? '  — perfect' : ` — ${over} over`}`)
  } else {
    console.log(`  Unfinished: ${claimedBy(game).size} countries on the board, ${countriesStillNeeded(game)} still needed`)
  }
  console.log(`  Best route was ${optimalRoute(game).map(name).join(' → ')}\n`)
}

function reportStats(games: number): void {
  const pars = new Map<number, number>()
  const byLandmass = new Map<number, number>()
  const starts = new Map<CountryCode, number>()

  for (let i = 0; i < games; i++) {
    const game = newGame()
    pars.set(par(game), (pars.get(par(game)) ?? 0) + 1)
    const landmass = getCountry(game.starts[0]).component!
    byLandmass.set(landmass, (byLandmass.get(landmass) ?? 0) + 1)
    for (const code of game.starts) starts.set(code, (starts.get(code) ?? 0) + 1)
  }

  console.log(`\n  ${games} games\n`)
  console.log('  par   games')
  for (const [value, count] of [...pars].sort((a, b) => a[0] - b[0])) {
    const bar = '#'.repeat(Math.round((count / games) * 60))
    console.log(`  ${String(value).padStart(3)}   ${String(count).padStart(5)}  ${bar}`)
  }

  console.log('\n  landmass share:')
  for (const [landmass, count] of [...byLandmass].sort((a, b) => a[0] - b[0])) {
    console.log(`    ${landmass}: ${((count / games) * 100).toFixed(1)}%`)
  }

  const ranked = [...starts].sort((a, b) => b[1] - a[1])
  console.log(`\n  ${starts.size} distinct start countries`)
  console.log(`  most common: ${ranked.slice(0, 6).map(([c, n]) => `${name(c)} ${n}`).join(', ')}\n`)
}
