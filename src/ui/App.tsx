import { useCallback, useState } from 'react'
import { SETTINGS } from '../settings.ts'
import { getCountry } from '../game/graph.ts'
import { applyMove, head, movesMade, newGame, optimalRoute, par } from '../game/rules.ts'
import type { GameState, PlayerIndex } from '../game/rules.ts'
import type { CountryCode } from '../game/types.ts'
import { GuessInput } from './GuessInput.tsx'
import { WorldMap } from './WorldMap.tsx'

const startGame = () => newGame({ minHops: SETTINGS.minHops, maxHops: SETTINGS.maxHops })

export default function App() {
  const [game, setGame] = useState<GameState>(startGame)

  const onMove = useCallback((code: CountryCode) => {
    setGame((current) => applyMove(current, code))
  }, [])

  const won = game.status === 'won'
  const score = movesMade(game)
  const target = par(game)

  return (
    <main>
      <header>
        <h1>Meet in the Middle</h1>
        <p className="score">
          <strong>{score}</strong> {score === 1 ? 'country' : 'countries'} named
          {won && <> · par was {target}</>}
        </p>
      </header>

      <WorldMap
        chains={[game.chains[0].countries, game.chains[1].countries]}
        revealedRoute={won ? optimalRoute(game) : undefined}
      />

      {won ? <Summary game={game} onNewGame={() => setGame(startGame())} /> : <Turn game={game} onMove={onMove} />}

      <div className="chains">
        <ChainView game={game} player={0} />
        <ChainView game={game} player={1} />
      </div>
    </main>
  )
}

function Turn({ game, onMove }: { game: GameState; onMove: (code: CountryCode) => void }) {
  const player = game.turn
  const standing = getCountry(head(game.chains[player]))

  return (
    <section className="turn">
      <h2>
        <span className={`pip player-${player}`} /> Player {player + 1}
      </h2>
      <p>
        You are in <strong>{standing.name}</strong>.
      </p>
      <GuessInput game={game} onMove={onMove} />
    </section>
  )
}

function Summary({ game, onNewGame }: { game: GameState; onNewGame: () => void }) {
  const score = movesMade(game)
  const target = par(game)
  const over = score - target
  const route = optimalRoute(game)

  return (
    <section className="summary">
      <h2>
        You met in {getCountry(head(game.chains[0])).name} and{' '}
        {getCountry(head(game.chains[1])).name}
      </h2>
      <p className="verdict">
        {over === 0
          ? 'Perfect — nobody could have done it faster.'
          : `${score} against a par of ${target}. ${over} more than you needed.`}
      </p>
      <p className="route">
        <span>Shortest route:</span> {route.map((code) => getCountry(code).name).join(' → ')}
      </p>
      <button type="button" onClick={onNewGame}>
        New game
      </button>
    </section>
  )
}

function ChainView({ game, player }: { game: GameState; player: PlayerIndex }) {
  const chain = game.chains[player]
  const hidden = !SETTINGS.showPartnerChain && game.status === 'playing' && game.turn !== player

  return (
    <section className={`chain player-${player}`}>
      <h3>
        <span className={`pip player-${player}`} /> Player {player + 1}
      </h3>
      {hidden ? (
        <p className="hidden-chain">{chain.countries.length - 1} moves made, somewhere</p>
      ) : (
        <ol>
          {chain.countries.map((code, index) => (
            <li key={code} className={index === 0 ? 'start' : undefined}>
              {getCountry(code).name}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
