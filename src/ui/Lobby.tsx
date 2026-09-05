import { useState } from 'react'
import { makeRoomCode, normaliseRoomCode } from '../../server/protocol.ts'
import { CONTINENT_IDS } from '../game/continents.ts'
import type { ContinentId } from '../game/continents.ts'
import { randomContinent } from '../game/rules.ts'
import type { GameRequest } from '../game/rules.ts'
import { LanguagePicker } from './LanguagePicker.tsx'
import { useLanguage } from './language.tsx'

export type LobbyProps = {
  readonly onPlayHere: (request?: GameRequest) => void
  readonly onOpenRoom: (code: string, request?: GameRequest) => void
}

type Choice = 'menu' | 'continent' | 'identify'

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
    const pick = (id: ContinentId): GameRequest =>
      choice === 'continent'
        ? { mode: 'continent', continent: id }
        : { mode: 'identify', scope: id }

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
            {choice === 'identify' ? (
              <button
                type="button"
                onClick={() => onOpenRoom(makeRoomCode(), { mode: 'identify', scope: 'world' })}
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
