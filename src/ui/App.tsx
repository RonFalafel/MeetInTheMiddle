import { useCallback, useState } from 'react'
import { SETTINGS } from '../settings.ts'
import { format } from '../game/languages.ts'
import type { Strings } from '../game/languages.ts'
import {
  SKIP,
  claimedBy,
  connectingRoute,
  continentRemaining,
  continentTargets,
  countriesStillNeeded,
  currentTarget,
  identifyScore,
  isOver,
  movesMade,
  optimalRoute,
  par,
} from '../game/rules.ts'
import type {
  ContinentGame,
  GameRequest,
  GameState,
  IdentifyGame,
  MeetGame,
  PlayerIndex,
} from '../game/rules.ts'
import type { CountryCode } from '../game/types.ts'
import { GuessInput } from './GuessInput.tsx'
import { Lobby } from './Lobby.tsx'
import { WorldMap } from './WorldMap.tsx'
import { LanguagePicker } from './LanguagePicker.tsx'
import { useLanguage } from './language.tsx'
import { describeError, describeRejection } from './messages.ts'
import { useLocalGame } from './useLocalGame.ts'
import { useRoom } from './useRoom.ts'
import type { Session } from './session.ts'

const roomFromUrl = () => new URLSearchParams(location.search).get('room')

export default function App() {
  const [room, setRoom] = useState<string | null>(roomFromUrl)
  const [playHere, setPlayHere] = useState<GameRequest | null>(null)
  const [wanted, setWanted] = useState<GameRequest | undefined>(undefined)

  // Both hooks always run; the inactive one sits idle with a null room.
  const local = useLocalGame(playHere ?? undefined)
  const remote = useRoom(room, wanted)

  const openRoom = useCallback((code: string, request?: GameRequest) => {
    history.replaceState(null, '', `?room=${code}`)
    setWanted(request)
    setRoom(code)
  }, [])

  const leaveRoom = useCallback(() => {
    history.replaceState(null, '', location.pathname)
    setRoom(null)
    setWanted(undefined)
    setPlayHere(null)
  }, [])

  if (!room && !playHere) {
    return <Lobby onPlayHere={(request) => setPlayHere(request ?? { mode: 'meet' })} onOpenRoom={openRoom} />
  }

  return <Game session={room ? remote : local} onLeave={leaveRoom} />
}

function Game({ session, onLeave }: { session: Session; onLeave: () => void }) {
  const { t, name } = useLanguage()
  const { game, me } = session

  if (!game) {
    return (
      <main>
        <Header />
        <section className="panel">
          <p>{session.notice ? describeNotice(session.notice, t, name) : t.connecting}</p>
          <button type="button" onClick={onLeave}>
            {t.back}
          </button>
        </section>
      </main>
    )
  }

  const over = isOver(game)
  const other: PlayerIndex = me === 0 ? 1 : 0
  const hidePartner = game.mode === 'meet' && !SETTINGS.showPartnerCountries && !over
  const missed =
    !over ? undefined
    : game.mode === 'continent' ? continentRemaining(game)
    : game.mode === 'identify' ? identifyScore(game).missed
    : undefined

  return (
    <main>
      <Header game={game} />

      {session.roomCode && <RoomBar session={session} onLeave={onLeave} />}

      <WorldMap
        claimed={claimedBy(game)}
        starts={game.mode === 'meet' ? game.starts : []}
        route={game.mode === 'meet' && over ? connectingRoute(game) : null}
        hiddenPlayer={hidePartner ? other : null}
        focus={mapFocus(game, me)}
        missed={missed}
        highlight={game.mode === 'identify' && !over ? currentTarget(game) : null}
      />

      {over ? (
        <Summary game={game} session={session} />
      ) : (
        <Play session={session} game={game} />
      )}

      {game.mode !== 'identify' && <Board game={game} me={me} hidePartner={hidePartner} />}
    </main>
  )
}

/** What the map should be looking at when it opens. */
function mapFocus(game: GameState, me: PlayerIndex): readonly CountryCode[] {
  if (game.mode === 'meet') return [game.starts[me]]
  if (game.mode === 'continent') return continentTargets(game)
  // Identify follows the country being asked about, which moves each round.
  return [currentTarget(game) ?? game.order[0]!]
}

function Header({ game }: { game?: GameState }) {
  const { t } = useLanguage()

  return (
    <header>
      <h1>{t.title}</h1>
      {game && (
        <p className="score">
          {game.mode === 'meet' ? (
            <>
              <span>{t.score}</span>
              <strong>{movesMade(game)}</strong>
              {game.status === 'won' && (
                <em>
                  {t.par} {par(game)}
                </em>
              )}
            </>
          ) : game.mode === 'continent' ? (
            <>
              <span>{t.named}</span>
              <strong>
                {movesMade(game)}/{continentTargets(game).length}
              </strong>
            </>
          ) : (
            <>
              <span>{t.correct}</span>
              <strong>
                {identifyScore(game).right}/{identifyScore(game).total}
              </strong>
            </>
          )}
        </p>
      )}
      <LanguagePicker />
    </header>
  )
}

function RoomBar({ session, onLeave }: { session: Session; onLeave: () => void }) {
  const { t } = useLanguage()
  const [shared, setShared] = useState(false)

  const share = async () => {
    const url = location.href
    try {
      if (navigator.share) await navigator.share({ title: t.title, url })
      else await navigator.clipboard.writeText(url)
      setShared(true)
      setTimeout(() => setShared(false), 2000)
    } catch {
      // Cancelling the share sheet lands here. Nothing to say about it.
    }
  }

  const live = session.connection === 'live'
  const state = live
    ? session.partnerHere
      ? t.bothHere
      : t.waiting
    : session.connection === 'dropped'
      ? t.reconnecting
      : t.connecting

  return (
    <div className="roombar">
      <span className="code">{session.roomCode}</span>
      <span className={`state ${live && session.partnerHere ? 'ok' : ''}`}>{state}</span>
      <button type="button" onClick={share}>
        {shared ? t.copied : t.invite}
      </button>
      <button type="button" onClick={onLeave}>
        {t.leave}
      </button>
    </div>
  )
}

function Play({ session, game }: { session: Session; game: GameState }) {
  const { t, name } = useLanguage()
  const { me, setMe, guess, notice } = session

  return (
    <section className="panel">
      {game.mode === 'meet' ? (
        <p className="standing">
          <span className={`pip player-${me}`} />
          {t.yourStart}: <strong>{name(game.starts[me])}</strong>
          {SETTINGS.showCountriesNeeded && (
            <em>
              {' · '}
              {t.stillNeeded}: {countriesStillNeeded(game)}
            </em>
          )}
        </p>
      ) : game.mode === 'continent' ? (
        <p className="standing">
          <strong>{t.continents[game.continent]}</strong>
          <em>
            {' · '}
            {t.stillNeeded}: {continentRemaining(game).length}
          </em>
        </p>
      ) : (
        <p className="standing">
          <strong>{t.whichCountry}</strong>
          <em>
            {' · '}
            {identifyScore(game).asked + 1}/{identifyScore(game).total}
          </em>
        </p>
      )}

      <GuessInput game={game} onGuess={guess} disabled={session.connection === 'dropped'} />
      {notice && <p className="error">{describeNotice(notice, t, name)}</p>}

      {(setMe || game.mode !== 'meet') && (
      <div className="who">
        {setMe && (
          <>
            <span>{t.guessingAs}</span>
            {([0, 1] as PlayerIndex[]).map((player) => (
              <button
                key={player}
                type="button"
                className={`chip player-${player}${player === me ? ' on' : ''}`}
                onClick={() => setMe(player)}
              >
                {t.player} {player + 1}
              </button>
            ))}
          </>
        )}
        {game.mode === 'identify' && (
          <button type="button" className="chip give-up" onClick={() => guess(SKIP)}>
            {t.skip}
          </button>
        )}
        {game.mode === 'continent' && session.reveal && (
          <button type="button" className="chip give-up" onClick={session.reveal}>
            {t.giveUp}
          </button>
        )}
      </div>
      )}
    </section>
  )
}

function describeNotice(
  notice: NonNullable<Session['notice']>,
  t: Strings,
  name: (code: CountryCode) => string,
): string {
  return notice.kind === 'rejected'
    ? describeRejection(notice.rejection, t, name)
    : describeError(notice.error, t)
}

function Summary({ session, game }: { session: Session; game: GameState }) {
  const { t } = useLanguage()

  return (
    <section className="panel summary">
      {game.mode === 'meet' ? (
        <MeetSummary game={game} />
      ) : game.mode === 'continent' ? (
        <ContinentSummary game={game} />
      ) : (
        <IdentifySummary game={game} />
      )}
      {session.restart && (
        <button type="button" className="primary" onClick={() => session.restart?.()}>
          {t.newGame}
        </button>
      )}
    </section>
  )
}

function MeetSummary({ game }: { game: MeetGame }) {
  const { t } = useLanguage()
  const score = movesMade(game)
  const target = par(game)
  const over = score - target

  return (
    <>
      <h2>{t.youMet}</h2>
      <p className="verdict">
        {over === 0 ? t.perfect : format(t.againstPar, { score, par: target })}
      </p>
      <Route label={t.yourRoute} codes={connectingRoute(game) ?? []} />
      {over > 0 && <Route label={t.shortestRoute} codes={optimalRoute(game)} />}
    </>
  )
}

function ContinentSummary({ game }: { game: ContinentGame }) {
  const { t, name } = useLanguage()
  const missed = continentRemaining(game)
  const total = continentTargets(game).length

  return (
    <>
      <h2>{game.status === 'won' ? t.filledIt : t.gaveUp}</h2>
      <p className="verdict">
        {t.continents[game.continent]} · {t.named}: {movesMade(game)}/{total}
      </p>
      {missed.length > 0 && (
        <div className="chips missed">
          <h3>
            {t.missed}: {missed.length}
          </h3>
          <ul>
            {missed.map((code) => (
              <li key={code}>{name(code)}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}

function IdentifySummary({ game }: { game: IdentifyGame }) {
  const { t, name } = useLanguage()
  const score = identifyScore(game)

  return (
    <>
      <h2>{score.right === score.total ? t.perfect : t.filledIt}</h2>
      <p className="verdict">
        {t.correct}: {score.right}/{score.total}
      </p>
      {score.missed.length > 0 && (
        <div className="chips missed">
          <h3>
            {t.missed}: {score.missed.length}
          </h3>
          <ul>
            {score.missed.map((code) => (
              <li key={code}>{name(code)}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}

function Route({ label, codes }: { label: string; codes: readonly CountryCode[] }) {
  const { name, dir } = useLanguage()
  // The arrow has to point the way the sentence runs, or the route reads backwards.
  const arrow = dir === 'rtl' ? ' ← ' : ' → '
  return (
    <p className="route-line">
      <span>{label}</span> {codes.map(name).join(arrow)}
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
  const { t } = useLanguage()
  const claimed = [...claimedBy(game)]
  const mine = claimed.filter(([, player]) => player === me)
  const theirs = claimed.filter(([, player]) => player !== me)
  const starts = game.mode === 'meet' ? game.starts : []

  return (
    <section className="board">
      <Chips label={t.you} player={me} entries={mine} starts={starts} />
      {hidePartner ? (
        <p className="hidden-chain">
          {t.partnerNamed}: {Math.max(0, theirs.length - 1)}
        </p>
      ) : (
        <Chips label={t.partner} player={me === 0 ? 1 : 0} entries={theirs} starts={starts} />
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
  const { name } = useLanguage()

  return (
    <div className={`chips player-${player}`}>
      <h3>
        <span className={`pip player-${player}`} /> {label}
      </h3>
      <ul>
        {entries.map(([code]) => (
          <li key={code} className={starts.includes(code) ? 'start' : undefined}>
            {name(code)}
          </li>
        ))}
      </ul>
    </div>
  )
}
