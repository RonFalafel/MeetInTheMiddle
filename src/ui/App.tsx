import { useCallback, useState } from 'react'
import { SETTINGS } from '../settings.ts'
import { getCountry } from '../game/graph.ts'
import {
  claimedBy,
  connectingRoute,
  countriesStillNeeded,
  movesMade,
  optimalRoute,
  par,
} from '../game/rules.ts'
import type { GameState, PlayerIndex } from '../game/rules.ts'
import type { CountryCode } from '../game/types.ts'
import { GuessInput } from './GuessInput.tsx'
import { Lobby } from './Lobby.tsx'
import { WorldMap } from './WorldMap.tsx'
import { useLocalGame } from './useLocalGame.ts'
import { useRoom } from './useRoom.ts'
import type { Session } from './session.ts'

const roomFromUrl = () => new URLSearchParams(location.search).get('room')

export default function App() {
  const [room, setRoom] = useState<string | null>(roomFromUrl)
  const [playHere, setPlayHere] = useState(false)

  // Both hooks always run; the inactive one sits idle with a null room.
  const local = useLocalGame()
  const remote = useRoom(room)

  const openRoom = useCallback((code: string) => {
    history.replaceState(null, '', `?room=${code}`)
    setRoom(code)
  }, [])

  const leaveRoom = useCallback(() => {
    history.replaceState(null, '', location.pathname)
    setRoom(null)
    setPlayHere(false)
  }, [])

  if (!room && !playHere) {
    return <Lobby onPlayHere={() => setPlayHere(true)} onOpenRoom={openRoom} />
  }

  return <Game session={room ? remote : local} onLeave={leaveRoom} />
}

function Game({ session, onLeave }: { session: Session; onLeave: () => void }) {
  const { game, me } = session

  if (!game) {
    return (
      <main>
        <header>
          <h1>Meet in the Middle</h1>
        </header>
        <section className="panel">
          <p>{session.notice ?? 'Connecting…'}</p>
          <button type="button" onClick={onLeave}>
            Back
          </button>
        </section>
      </main>
    )
  }

  const won = game.status === 'won'
  const other: PlayerIndex = me === 0 ? 1 : 0
  const hidePartner = !SETTINGS.showPartnerCountries && !won

  return (
    <main>
      <header>
        <h1>Meet in the Middle</h1>
        <p className="score">
          <strong>{movesMade(game)}</strong>
          <span>named</span>
          {won && <em>par {par(game)}</em>}
        </p>
      </header>

      {session.roomCode && <RoomBar session={session} onLeave={onLeave} />}

      <WorldMap
        claimed={claimedBy(game)}
        starts={game.starts}
        route={won ? connectingRoute(game) : null}
        hiddenPlayer={hidePartner ? other : null}
        focus={game.starts[me]}
      />

      {won ? (
        <Summary game={game} onRestart={session.restart} />
      ) : (
        <Play session={session} game={game} />
      )}

      <Board game={game} me={me} hidePartner={hidePartner} />
    </main>
  )
}

function RoomBar({ session, onLeave }: { session: Session; onLeave: () => void }) {
  const [shared, setShared] = useState(false)

  const share = async () => {
    const url = location.href
    try {
      if (navigator.share) await navigator.share({ title: 'Meet in the Middle', url })
      else await navigator.clipboard.writeText(url)
      setShared(true)
      setTimeout(() => setShared(false), 2000)
    } catch {
      // Cancelling the share sheet lands here. Nothing to say about it.
    }
  }

  const state =
    session.connection === 'live'
      ? session.partnerHere
        ? 'both here'
        : 'waiting for your partner'
      : session.connection === 'dropped'
        ? 'reconnecting…'
        : 'connecting…'

  return (
    <div className="roombar">
      <span className="code">{session.roomCode}</span>
      <span className={`state ${session.partnerHere && session.connection === 'live' ? 'ok' : ''}`}>
        {state}
      </span>
      <button type="button" onClick={share}>
        {shared ? 'Copied' : 'Invite'}
      </button>
      <button type="button" onClick={onLeave}>
        Leave
      </button>
    </div>
  )
}

function Play({ session, game }: { session: Session; game: GameState }) {
  const { me, setMe, guess, notice } = session
  const needed = countriesStillNeeded(game)

  return (
    <section className="panel">
      <p className="standing">
        <span className={`pip player-${me}`} />
        You start in <strong>{getCountry(game.starts[me]).name}</strong>
        {SETTINGS.showCountriesNeeded && (
          <>
            {' · '}
            <em>
              {needed} more {needed === 1 ? 'country' : 'countries'} needed
            </em>
          </>
        )}
      </p>

      <GuessInput game={game} onGuess={guess} disabled={session.connection === 'dropped'} />
      {notice && <p className="error">{notice}</p>}

      {setMe && (
        <div className="who">
          <span>Guessing as</span>
          {([0, 1] as PlayerIndex[]).map((player) => (
            <button
              key={player}
              type="button"
              className={`chip player-${player}${player === me ? ' on' : ''}`}
              onClick={() => setMe(player)}
            >
              Player {player + 1}
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

function Summary({ game, onRestart }: { game: GameState; onRestart: (() => void) | null }) {
  const score = movesMade(game)
  const target = par(game)
  const over = score - target

  return (
    <section className="panel summary">
      <h2>You met</h2>
      <p className="verdict">
        {over === 0
          ? 'Perfect — nobody could have done it in fewer.'
          : `${score} countries against a par of ${target}.`}
      </p>
      <Route label="Your route" codes={connectingRoute(game) ?? []} />
      {over > 0 && <Route label="Shortest possible" codes={optimalRoute(game)} />}
      {onRestart && (
        <button type="button" className="primary" onClick={onRestart}>
          New game
        </button>
      )}
    </section>
  )
}

function Route({ label, codes }: { label: string; codes: readonly CountryCode[] }) {
  return (
    <p className="route-line">
      <span>{label}</span> {codes.map((code) => getCountry(code).name).join(' → ')}
    </p>
  )
}

function Board({
  game,
  me,
  hidePartner,
}: {
  game: GameState
  me: PlayerIndex
  hidePartner: boolean
}) {
  const claimed = [...claimedBy(game)]
  const mine = claimed.filter(([, player]) => player === me)
  const theirs = claimed.filter(([, player]) => player !== me)

  return (
    <section className="board">
      <Chips label="You" player={me} entries={mine} starts={game.starts} />
      {hidePartner ? (
        <p className="hidden-chain">Partner has named {Math.max(0, theirs.length - 1)}, somewhere</p>
      ) : (
        <Chips label="Partner" player={me === 0 ? 1 : 0} entries={theirs} starts={game.starts} />
      )}
    </section>
  )
}

function Chips({
  label,
  player,
  entries,
  starts,
}: {
  label: string
  player: PlayerIndex
  entries: [CountryCode, PlayerIndex][]
  starts: readonly CountryCode[]
}) {
  return (
    <div className={`chips player-${player}`}>
      <h3>
        <span className={`pip player-${player}`} /> {label}
      </h3>
      <ul>
        {entries.map(([code]) => (
          <li key={code} className={starts.includes(code) ? 'start' : undefined}>
            {getCountry(code).name}
          </li>
        ))}
      </ul>
    </div>
  )
}
