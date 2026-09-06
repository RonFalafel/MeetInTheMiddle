import { useState } from 'react'
import { makeRoomCode, normaliseRoomCode } from '../../server/protocol.ts'
import { CONTINENT_IDS } from '../game/continents.ts'
import type { ContinentId } from '../game/continents.ts'
import { randomContinent } from '../game/rules.ts'
import type { GameRequest, Scope } from '../game/rules.ts'
import { LanguagePicker } from './LanguagePicker.tsx'
import { useLanguage } from './language.tsx'

export type LobbyProps = {
  readonly onPlayHere: (request?: GameRequest) => void
  readonly onOpenRoom: (code: string, request?: GameRequest) => void
}

type Choice =
  | 'menu'
  | 'continent'
  | 'identify'
  | 'capitals'
  | 'flags'
  | 'compare'
  | 'population'

/** Which question an identify round asks, from the lobby branch we came down. */
const promptFor = (choice: Choice): 'shape' | 'capital' | 'flag' =>
  choice === 'capitals' ? 'capital' : choice === 'flags' ? 'flag' : 'shape'

export function Lobby({ onPlayHere, onOpenRoom }: LobbyProps) {
  const { t } = useLanguage()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [choice, setChoice] = useState<Choice>('menu')

  const join = () => {
    const room = normaliseRoomCode(code)
    if (!room) {
      setError(t.codeError)
      return
    }
    // Joining an existing room takes whatever game is already running there.
    onOpenRoom(room)
  }

  if (choice !== 'menu') {
    // Bigger or smaller and More people are the same round asked about a
    // different column, so they share everything but the metric.
    const compareRequest = (scope: Scope): GameRequest => ({
      mode: 'compare',
      scope,
      metric: choice === 'population' ? 'population' : 'area',
    })

    const pick = (id: ContinentId): GameRequest =>
      choice === 'continent' ? { mode: 'continent', continent: id }
      : choice === 'compare' || choice === 'population' ? compareRequest(id)
      : { mode: 'identify', scope: id, prompt: promptFor(choice) }

    return (
      <main className="lobby">
        <header>
          <h1>{t.chooseContinent}</h1>
          <LanguagePicker />
        </header>

        <section className="panel">
          <div className="continent-grid">
            {CONTINENT_IDS.map((id) => (
              <button key={id} type="button" onClick={() => onOpenRoom(makeRoomCode(), pick(id))}>
                {t.continents[id]}
              </button>
            ))}
            {choice !== 'continent' ? (
              <button
                type="button"
                onClick={() =>
                  onOpenRoom(
                    makeRoomCode(),
                    choice === 'compare' || choice === 'population'
                      ? compareRequest('world')
                      : { mode: 'identify', scope: 'world', prompt: promptFor(choice) },
                  )
                }
              >
                {t.wholeWorld}
              </button>
            ) : (
              <button
                type="button"
                onClick={() =>
                  onOpenRoom(makeRoomCode(), { mode: 'continent', continent: randomContinent() })
                }
              >
                {t.randomContinent}
              </button>
            )}
          </div>
        </section>

        <section className="panel">
          <button type="button" onClick={() => setChoice('menu')}>
            {t.back}
          </button>
        </section>
      </main>
    )
  }

  return (
    <main className="lobby">
      <header>
        <h1>{t.title}</h1>
        <LanguagePicker />
      </header>

      <p className="tagline">{t.tagline}</p>

      <section className="panel">
        <h2>{t.modeMeet}</h2>
        <p className="muted">{t.modeMeetHint}</p>
        <button type="button" className="primary" onClick={() => onOpenRoom(makeRoomCode(), { mode: 'meet' })}>
          {t.startGame}
        </button>
      </section>

      <section className="panel">
        <h2>{t.modeContinent}</h2>
        <p className="muted">{t.modeContinentHint}</p>
        <button type="button" className="primary" onClick={() => setChoice('continent')}>
          {t.startGame}
        </button>
      </section>

      <section className="panel">
        <h2>{t.modeIdentify}</h2>
        <p className="muted">{t.modeIdentifyHint}</p>
        <button type="button" className="primary" onClick={() => setChoice('identify')}>
          {t.startGame}
        </button>
      </section>

      <section className="panel">
        <h2>{t.modeCapitals}</h2>
        <p className="muted">{t.modeCapitalsHint}</p>
        <button type="button" className="primary" onClick={() => setChoice('capitals')}>
          {t.startGame}
        </button>
      </section>

      <section className="panel">
        <h2>{t.modeNeighbours}</h2>
        <p className="muted">{t.modeNeighboursHint}</p>
        <button
          type="button"
          className="primary"
          onClick={() => onOpenRoom(makeRoomCode(), { mode: 'neighbours' })}
        >
          {t.startGame}
        </button>
      </section>

      <section className="panel">
        <h2>{t.modeFlags}</h2>
        <p className="muted">{t.modeFlagsHint}</p>
        <button type="button" className="primary" onClick={() => setChoice('flags')}>
          {t.startGame}
        </button>
      </section>

      <section className="panel">
        <h2>{t.modeCompare}</h2>
        <p className="muted">{t.modeCompareHint}</p>
        <button type="button" className="primary" onClick={() => setChoice('compare')}>
          {t.startGame}
        </button>
      </section>

      <section className="panel">
        <h2>{t.modePopulation}</h2>
        <p className="muted">{t.modePopulationHint}</p>
        <button type="button" className="primary" onClick={() => setChoice('population')}>
          {t.startGame}
        </button>
      </section>

      <section className="panel">
        <h2>{t.modeTrivia}</h2>
        <p className="muted">{t.modeTriviaHint}</p>
        <button
          type="button"
          className="primary"
          onClick={() => onOpenRoom(makeRoomCode(), { mode: 'trivia' })}
        >
          {t.startGame}
        </button>
      </section>

      <section className="panel">
        <h2>{t.modeWhichContinent}</h2>
        <p className="muted">{t.modeWhichContinentHint}</p>
        <button
          type="button"
          className="primary"
          onClick={() => onOpenRoom(makeRoomCode(), { mode: 'which-continent' })}
        >
          {t.startGame}
        </button>
      </section>

      <section className="panel">
        <h2>{t.modeChain}</h2>
        <p className="muted">{t.modeChainHint}</p>
        <button
          type="button"
          className="primary"
          onClick={() => onOpenRoom(makeRoomCode(), { mode: 'chain' })}
        >
          {t.startGame}
        </button>
      </section>

      <section className="panel">
        <h2>{t.modeHotCold}</h2>
        <p className="muted">{t.modeHotColdHint}</p>
        <button
          type="button"
          className="primary"
          onClick={() => onOpenRoom(makeRoomCode(), { mode: 'hot-cold' })}
        >
          {t.startGame}
        </button>
      </section>

      <section className="panel">
        <h2>{t.twoPhones}</h2>
        <p className="muted">{t.twoPhonesHint}</p>
        <div className="join">
          <input
            value={code}
            placeholder={t.codePlaceholder}
            aria-label={t.codePlaceholder}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="characters"
            spellCheck={false}
            enterKeyHint="go"
            maxLength={5}
            // The code is always Latin, whatever language the game is in.
            dir="ltr"
            onChange={(event) => {
              setCode(event.target.value)
              setError(null)
            }}
            onKeyDown={(event) => event.key === 'Enter' && join()}
          />
          <button type="button" onClick={join}>
            {t.join}
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </section>

      <section className="panel">
        <h2>{t.oneDevice}</h2>
        <p className="muted">{t.oneDeviceHint}</p>
        <button type="button" onClick={() => onPlayHere({ mode: 'meet' })}>
          {t.playHere}
        </button>
      </section>
    </main>
  )
}
