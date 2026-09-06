import { useCallback, useEffect, useState } from 'react'
import { SETTINGS } from '../settings.ts'
import { getCountry } from '../game/graph.ts'
import { CONTINENT_IDS } from '../game/continents.ts'
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
  chainHead,
  chainRoute,
  compareScore,
  currentCountry,
  currentPair,
  currentQuestion,
  justRevealed,
  previousAnswer,
  hotColdGuesses,
  identifyScore,
  lastGuess,
  whichContinentScore,
  isOver,
  movesMade,
  neighbourRemaining,
  neighbourTargets,
  optimalRoute,
  par,
  triviaScore,
} from '../game/rules.ts'
import type {
  ChainGame,
  CompareGame,
  ContinentGame,
  GameRequest,
  GameState,
  HotColdGame,
  IdentifyGame,
  MeetGame,
  NeighboursGame,
  PlayerIndex,
  RoundScore,
  TriviaGame,
  TriviaQuestion,
  WhichContinentGame,
} from '../game/rules.ts'
import type { CountryCode } from '../game/types.ts'
import type { ContinentId } from '../game/continents.ts'
import { GuessInput } from './GuessInput.tsx'
import { Lobby } from './Lobby.tsx'
import { WorldMap, heatColour } from './WorldMap.tsx'
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
  // Bumped rather than set, so asking for the same country twice still moves
  // the map — a clue you cannot repeat is a clue you can lose.
  const [clue, setClue] = useState<{ code: CountryCode; nonce: number } | null>(null)

  if (!game) {
    return (
      <main>
        <Header onLeave={onLeave} />
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
    : game.mode === 'neighbours' ? neighbourRemaining(game)
    : undefined

  return (
    <main>
      <Header game={game} onLeave={onLeave} />

      {session.roomCode && <RoomBar session={session} onLeave={onLeave} />}

      <WorldMap
        claimed={claimedBy(game)}
        starts={game.mode === 'meet' ? game.starts : []}
        route={game.mode === 'meet' && over ? connectingRoute(game) : null}
        hiddenPlayer={hidePartner ? other : null}
        focus={mapFocus(game, me)}
        missed={missed}
        highlight={highlightFor(game, over)}
        heat={game.mode === 'hot-cold' ? heatMap(game) : undefined}
        clue={clue}
      />

      {over ? (
        <Summary game={game} session={session} />
      ) : (
        <Play
          session={session}
          game={game}
          onClue={(code) => setClue((current) => ({ code, nonce: (current?.nonce ?? 0) + 1 }))}
        />
      )}

      {(game.mode === 'meet' || game.mode === 'continent' || game.mode === 'neighbours') && (
        <Board game={game} me={me} hidePartner={hidePartner} />
      )}

      {game.mode === 'hot-cold' && <HotColdBoard game={game} />}
      {game.mode === 'chain' && <ChainBoard game={game} />}

      {!over &&
        (game.mode === 'continent' || game.mode === 'neighbours' || game.mode === 'chain' ||
          game.mode === 'hot-cold') &&
        session.reveal && (
          <GiveUp onConfirm={session.reveal} />
        )}
    </main>
  )
}

/** Every guess so far with its warmth, plus the answer once it is over. */
function heatMap(game: HotColdGame): ReadonlyMap<CountryCode, number> {
  const map = new Map<CountryCode, number>()
  for (const { code, heat } of hotColdGuesses(game)) map.set(code, heat)
  if (isOver(game)) map.set(game.target, 1)
  return map
}

/**
 * The country drawn lit up. Only the shape prompt hides its identity — the
 * capitals prompt must not highlight, or the map would answer the question.
 */
function highlightFor(game: GameState, over: boolean): CountryCode | null {
  if (game.mode === 'neighbours') return game.hub
  if (game.mode === 'which-continent') return over ? null : currentCountry(game)
  if (game.mode === 'identify' && game.prompt === 'shape' && !over) return currentTarget(game)
  return null
}

/** What the map should be looking at when it opens. */
/**
 * Where the map opens.
 *
 * Anywhere the country's position is part of the question, this returns nothing
 * and the map stays on the whole world — framing the answer was giving capitals,
 * flags and which-continent away outright. The clue button exists for when you
 * do want the map to help.
 */
function mapFocus(game: GameState, me: PlayerIndex): readonly CountryCode[] {
  if (game.mode === 'meet') return [game.starts[me]]
  if (game.mode === 'continent') return continentTargets(game)
  // The hub is named in the prompt, so framing it gives nothing away.
  if (game.mode === 'neighbours') return [game.hub]
  if (game.mode === 'chain') return [chainHead(game)]
  // Both countries are named on the buttons, so the map cannot spoil anything.
  if (game.mode === 'compare') return currentPair(game) ?? []
  // Hot/cold, which-continent, and the capital and flag prompts all hide where
  // the country is, which is exactly what is being asked.
  if (game.mode === 'identify' && game.prompt === 'shape') {
    return [currentTarget(game) ?? game.order[0]!]
  }
  return []
}

function Header({ game, onLeave }: { game?: GameState; onLeave?: () => void }) {
  const { t } = useLanguage()

  return (
    <header>
      {onLeave ? (
        <h1>
          <button type="button" className="title" onClick={onLeave}>
            {t.title}
          </button>
        </h1>
      ) : (
        <h1>{t.title}</h1>
      )}
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
          ) : game.mode === 'hot-cold' ? (
            <>
              <span>{t.guesses}</span>
              <strong>{movesMade(game)}</strong>
            </>
          ) : game.mode === 'chain' ? (
            <>
              <span>{t.chainLength}</span>
              <strong>{chainRoute(game).length}</strong>
            </>
          ) : game.mode === 'compare' ? (
            <>
              <span>{t.correct}</span>
              <strong>
                {compareScore(game).right}/{compareScore(game).total}
              </strong>
            </>
          ) : game.mode === 'which-continent' ? (
            <>
              <span>{t.correct}</span>
              <strong>
                {whichContinentScore(game).right}/{whichContinentScore(game).total}
              </strong>
            </>
          ) : game.mode === 'trivia' ? (
            <>
              <span>{t.correct}</span>
              <strong>
                {triviaScore(game).right}/{triviaScore(game).total}
              </strong>
            </>
          ) : game.mode === 'neighbours' ? (
            <>
              <span>{t.named}</span>
              <strong>
                {movesMade(game)}/{neighbourTargets(game).length}
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

function Play({
  session,
  game,
  onClue,
}: {
  session: Session
  game: GameState
  onClue: (code: CountryCode) => void
}) {
  const { t, name } = useLanguage()
  const { me, setMe, guess, notice } = session

  if (game.mode === 'compare') return <ComparePlay game={game} onPick={guess} />
  if (game.mode === 'which-continent') {
    return <ContinentPlay game={game} onPick={guess} onClue={onClue} />
  }
  if (game.mode === 'trivia') return <TriviaPlay game={game} onPick={guess} onClue={onClue} />

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
      ) : game.mode === 'hot-cold' ? (
        <HotColdStanding game={game} />
      ) : game.mode === 'chain' ? (
        <p className="standing">
          <strong>{format(t.chainPrompt, { country: name(chainHead(game)) })}</strong>
          <em>
            {' · '}
            {t.chainLength}: {chainRoute(game).length}
          </em>
        </p>
      ) : game.mode === 'neighbours' ? (
        <p className="standing">
          <strong>{format(t.whichNeighbours, { country: name(game.hub) })}</strong>
          <em>
            {' · '}
            {t.stillNeeded}: {neighbourRemaining(game).length}
          </em>
        </p>
      ) : (
        <>
          {game.prompt === 'flag' && <FlagPrompt game={game} />}
          <p className="standing">
            <strong>{identifyPrompt(game, t)}</strong>
            <em>
              {' · '}
              {identifyScore(game).asked + 1}/{identifyScore(game).total}
            </em>
          </p>
          {justRevealed(game) && (
            <p className="last-answer wrong">
              {format(t.itWas, { answer: '' })}
              <strong>{name(justRevealed(game)!)}</strong>
            </p>
          )}
        </>
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
        {game.mode === 'identify' && game.prompt !== 'shape' && currentTarget(game) && (
          <button
            type="button"
            className="chip"
            onClick={() => onClue(currentTarget(game)!)}
          >
            {t.clue}
          </button>
        )}
        {game.mode === 'identify' && (
          <button type="button" className="chip give-up" onClick={() => guess(SKIP)}>
            {t.revealAnswer}
          </button>
        )}
      </div>
      )}
    </section>
  )
}

/** The question, which depends on how this round asks. */
function identifyPrompt(game: IdentifyGame, t: Strings): string {
  if (game.prompt === 'shape') return t.whichCountry
  if (game.prompt === 'flag') return t.whichFlag
  const target = currentTarget(game)
  return format(t.whichCapital, { city: target ? getCountry(target).capital : '' })
}

/**
 * Ending the game early, kept well away from the guess input and needing two
 * deliberate presses. The confirm deliberately appears to one side, so a second
 * tap in the same place lands on Cancel rather than confirming.
 */
function GiveUp({ onConfirm }: { onConfirm: () => void }) {
  const { t } = useLanguage()
  const [asking, setAsking] = useState(false)

  useEffect(() => {
    if (!asking) return
    const timer = setTimeout(() => setAsking(false), 6000)
    return () => clearTimeout(timer)
  }, [asking])

  if (!asking) {
    return (
      <div className="give-up-row">
        <button type="button" className="quiet" onClick={() => setAsking(true)}>
          {t.giveUp}
        </button>
      </div>
    )
  }

  return (
    <div className="give-up-row asking">
      <button type="button" className="quiet" onClick={() => setAsking(false)}>
        {t.cancel}
      </button>
      <span>{t.areYouSure}</span>
      <button type="button" className="danger" onClick={onConfirm}>
        {t.giveUp}
      </button>
    </div>
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
  const { t, name } = useLanguage()

  return (
    <section className="panel summary">
      {game.mode === 'meet' ? (
        <MeetSummary game={game} />
      ) : game.mode === 'continent' ? (
        <ContinentSummary game={game} />
      ) : game.mode === 'hot-cold' ? (
        <HotColdSummary game={game} />
      ) : game.mode === 'chain' ? (
        <ChainSummary game={game} />
      ) : game.mode === 'compare' ? (
        <RoundSummary
          score={compareScore(game)}
          describe={(row) => {
            const [a, b] = row.question.split('/')
            return `${name(a!)} / ${name(b!)} — ${name(row.answer)}`
          }}
        />
      ) : game.mode === 'which-continent' ? (
        <RoundSummary
          score={whichContinentScore(game)}
          describe={(row) => `${name(row.question)} — ${t.continents[row.answer as ContinentId]}`}
        />
      ) : game.mode === 'trivia' ? (
        <TriviaSummary game={game} />
      ) : game.mode === 'neighbours' ? (
        <NeighboursSummary game={game} />
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

/**
 * The flag being asked about. Served from `public/flags/` rather than bundled,
 * and deliberately given no alt text — the file name is the answer.
 */
function FlagPrompt({ game }: { game: IdentifyGame }) {
  const target = currentTarget(game)
  if (!target) return null
  return (
    <div className="flag-prompt">
      <img src={`/flags/${getCountry(target).flag}.svg`} alt="" width={160} height={120} />
    </div>
  )
}

/**
 * Two big buttons rather than the guess input: the answer is one of two things,
 * and typing a country name you can already see would be busywork.
 */
function ComparePlay({ game, onPick }: { game: CompareGame; onPick: (code: string) => void }) {
  const { t, name } = useLanguage()
  const pair = currentPair(game)
  const score = compareScore(game)
  if (!pair) return null

  return (
    <section className="panel">
      <p className="standing">
        <strong>{game.metric === 'population' ? t.whichMorePeople : t.whichBigger}</strong>
        <em>
          {' · '}
          {score.asked + 1}/{score.total}
        </em>
      </p>
      <LastAnswer game={game} />
      <div className="two-up">
        {pair.map((code, index) => (
          <button key={code} type="button" className={`big player-${index}`} onClick={() => onPick(code)}>
            {name(code)}
          </button>
        ))}
      </div>
    </section>
  )
}

/** Six buttons, no keyboard — the quickest thing here on a phone. */
function ContinentPlay({
  game,
  onPick,
  onClue,
}: {
  game: WhichContinentGame
  onPick: (code: string) => void
  onClue: (code: CountryCode) => void
}) {
  const { t } = useLanguage()
  const score = whichContinentScore(game)
  const target = currentCountry(game)

  return (
    <section className="panel">
      <p className="standing">
        <strong>{t.whichContinentIs}</strong>
        <em>
          {' · '}
          {score.asked + 1}/{score.total}
        </em>
      </p>
      <LastAnswer game={game} />
      <div className="continent-grid">
        {CONTINENT_IDS.map((id) => (
          <button key={id} type="button" onClick={() => onPick(id)}>
            {t.continents[id]}
          </button>
        ))}
      </div>
      {target && (
        <div className="who">
          <button type="button" className="chip" onClick={() => onClue(target)}>
            {t.clue}
          </button>
        </div>
      )}
    </section>
  )
}

/**
 * What a question asks, in the reader's language.
 *
 * The question itself is generated and carries only codes and bare strings —
 * see `TriviaQuestion` — so this is the only place that turns one into a
 * sentence, exactly as with every other rejection and prompt in the game.
 */
function questionText(
  question: TriviaQuestion,
  t: Strings,
  name: (code: CountryCode) => string,
): string {
  const country = name(question.subject)
  if (question.kind === 'borders') return format(t.triviaBorders, { country })
  if (question.kind === 'not-borders') return format(t.triviaNotBorders, { country })
  if (question.kind === 'capital-of') return format(t.triviaCapitalOf, { country })
  if (question.kind === 'whose-capital') {
    return format(t.triviaWhoseCapital, { city: getCountry(question.subject).capital })
  }
  if (question.kind === 'currency') return format(t.triviaCurrency, { country })
  if (question.kind === 'language') return format(t.triviaLanguage, { country })
  return t.triviaLandlocked
}

/**
 * One option, labelled. Half the kinds answer with a country, which is
 * translated; the rest answer with a capital, a currency or a language, which
 * are not — same reason as capitals.ts.
 */
function optionLabel(
  question: TriviaQuestion,
  option: string,
  name: (code: CountryCode) => string,
): string {
  const isCountry =
    question.kind === 'borders' ||
    question.kind === 'not-borders' ||
    question.kind === 'whose-capital' ||
    question.kind === 'landlocked'
  return isCountry ? name(option) : option
}

function TriviaPlay({
  game,
  onPick,
  onClue,
}: {
  game: TriviaGame
  onPick: (code: string) => void
  onClue: (code: CountryCode) => void
}) {
  const { t, name } = useLanguage()
  const score = triviaScore(game)
  const question = currentQuestion(game)
  if (!question) return null

  return (
    <section className="panel">
      <p className="standing">
        <strong>{questionText(question, t, name)}</strong>
        <em>
          {' · '}
          {score.asked + 1}/{score.total}
        </em>
      </p>
      <LastAnswer game={game} />
      <div className="options">
        {question.options.map((option) => (
          <button key={option} type="button" onClick={() => onPick(option)}>
            {optionLabel(question, option, name)}
          </button>
        ))}
      </div>
      {/* Where the country is the answer, framing it on the map would be the
          answer, so those two kinds get no clue. */}
      {question.answer !== question.subject && (
        <div className="who">
          <button type="button" className="chip" onClick={() => onClue(question.subject)}>
            {t.clue}
          </button>
        </div>
      )}
    </section>
  )
}

function TriviaSummary({ game }: { game: TriviaGame }) {
  const { t, name } = useLanguage()
  const score = triviaScore(game)
  const missed = game.questions.filter((_, index) => {
    const move = game.moves[index]
    return move && move.code !== game.questions[index]!.answer
  })

  return (
    <>
      <h2>{score.right === score.total ? t.perfect : t.roundOver}</h2>
      <p className="verdict">
        {t.correct}: {score.right}/{score.total}
      </p>
      {missed.length > 0 && (
        <div className="chips missed">
          <h3>
            {t.missed}: {missed.length}
          </h3>
          <ul>
            {missed.map((question, index) => (
              <li key={`${question.kind}-${question.subject}-${index}`}>
                {questionText(question, t, name)}
                {' — '}
                {optionLabel(question, question.answer, name)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}

/**
 * What the previous question's answer was. All three tap-through modes move on
 * whatever you press, so without this a wrong answer teaches nothing.
 */
function LastAnswer({ game }: { game: CompareGame | WhichContinentGame | TriviaGame }) {
  const { t, name } = useLanguage()
  const previous = previousAnswer(game)
  if (!previous) return null

  const label =
    game.mode === 'compare' ? name(previous.answer)
    : game.mode === 'which-continent' ? t.continents[previous.answer as ContinentId]
    : optionLabel(game.questions[game.moves.length - 1]!, previous.answer, name)

  return (
    <p className={`last-answer ${previous.right ? 'right' : 'wrong'}`}>
      {format(t.itWas, { answer: '' })}
      <strong>{label}</strong>
    </p>
  )
}

/** The prompt, plus a call-out when the last guess turned out to be adjacent. */
function HotColdStanding({ game }: { game: HotColdGame }) {
  const { t } = useLanguage()
  const last = lastGuess(game)

  return (
    <p className="standing">
      <strong>{t.hotColdPrompt}</strong>
      <em>
        {' · '}
        {t.guesses}: {movesMade(game)}
      </em>
      {last?.borders && <span className="borders-flash">{t.bordersIt}</span>}
    </p>
  )
}

function ChainBoard({ game }: { game: ChainGame }) {
  const { t, name } = useLanguage()
  const route = chainRoute(game)

  return (
    <section className="chips">
      <h3>
        {t.chainLength}: {route.length}
      </h3>
      <ul>
        {route.map((code, index) => (
          <li key={code} className={index === route.length - 1 ? 'start' : undefined}>
            {name(code)}
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Right out of total, and what the wrong ones should have been. */
function RoundSummary({
  score,
  describe,
}: {
  score: RoundScore
  describe: (row: RoundScore['wrong'][number]) => string
}) {
  const { t } = useLanguage()

  return (
    <>
      <h2>{score.right === score.total ? t.perfect : t.roundOver}</h2>
      <p className="verdict">
        {t.correct}: {score.right}/{score.total}
      </p>
      {score.wrong.length > 0 && (
        <div className="chips missed">
          <h3>
            {t.missed}: {score.wrong.length}
          </h3>
          <ul>
            {score.wrong.map((row) => (
              <li key={row.question}>{describe(row)}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}

function ChainSummary({ game }: { game: ChainGame }) {
  const { t, name } = useLanguage()
  const route = chainRoute(game)

  return (
    <>
      <h2>
        {t.chainLength}: {route.length}
      </h2>
      <p className="route-line">
        <span>{name(game.start)}</span> {route.slice(1).map(name).join(' → ')}
      </p>
    </>
  )
}

/** Guesses ranked by warmth, which is the only scoreboard this mode needs. */
function HotColdBoard({ game }: { game: HotColdGame }) {
  const { t, name } = useLanguage()
  const rows = hotColdGuesses(game)
  if (rows.length === 0) return null

  return (
    <section className="heat-board">
      <h3>{t.guesses}</h3>
      <ul>
        {rows.map((row) => (
          <li key={row.code} style={{ borderInlineStartColor: heatColour(row.heat) }}>
            <span className="swatch" style={{ background: heatColour(row.heat) }} />
            <span className="who">{name(row.code)}</span>
            {row.borders && <b className="borders">{t.bordersIt}</b>}
            <em>{row.km.toLocaleString()} km</em>
          </li>
        ))}
      </ul>
    </section>
  )
}

function HotColdSummary({ game }: { game: HotColdGame }) {
  const { t, name } = useLanguage()

  return (
    <>
      <h2>{game.status === 'won' ? t.foundIt : t.gaveUp}</h2>
      <p className="verdict">
        {t.theAnswer}: <strong>{name(game.target)}</strong> · {t.guesses}: {movesMade(game)}
      </p>
    </>
  )
}

function NeighboursSummary({ game }: { game: NeighboursGame }) {
  const { t, name } = useLanguage()
  const missed = neighbourRemaining(game)
  const total = neighbourTargets(game).length

  return (
    <>
      <h2>{game.status === 'won' ? t.perfect : t.gaveUp}</h2>
      <p className="verdict">
        {name(game.hub)} · {t.named}: {movesMade(game)}/{total}
      </p>
      {missed.length > 0 && <Missed codes={missed} />}
    </>
  )
}

function Missed({ codes }: { codes: readonly CountryCode[] }) {
  const { t, name } = useLanguage()
  return (
    <div className="chips missed">
      <h3>
        {t.missed}: {codes.length}
      </h3>
      <ul>
        {codes.map((code) => (
          <li key={code}>{name(code)}</li>
        ))}
      </ul>
    </div>
  )
}

function IdentifySummary({ game }: { game: IdentifyGame }) {
  const { t, name } = useLanguage()
  const score = identifyScore(game)

  return (
    <>
      <h2>{score.right === score.total ? t.perfect : t.roundOver}</h2>
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
