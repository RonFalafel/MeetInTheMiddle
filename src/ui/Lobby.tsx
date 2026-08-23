import { useState } from 'react'
import { makeRoomCode, normaliseRoomCode } from '../../server/protocol.ts'
import { LanguagePicker } from './LanguagePicker.tsx'
import { useLanguage } from './language.tsx'

export type LobbyProps = {
  readonly onPlayHere: () => void
  readonly onOpenRoom: (code: string) => void
}

export function Lobby({ onPlayHere, onOpenRoom }: LobbyProps) {
  const { t } = useLanguage()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  const join = () => {
    const room = normaliseRoomCode(code)
    if (!room) {
      setError(t.codeError)
      return
    }
    onOpenRoom(room)
  }

  return (
    <main className="lobby">
      <header>
        <h1>{t.title}</h1>
        <LanguagePicker />
      </header>

      <p className="tagline">{t.tagline}</p>

      <section className="panel">
        <h2>{t.twoPhones}</h2>
        <p className="muted">{t.twoPhonesHint}</p>
        <button type="button" className="primary" onClick={() => onOpenRoom(makeRoomCode())}>
          {t.startGame}
        </button>

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
        <button type="button" onClick={onPlayHere}>
          {t.playHere}
        </button>
      </section>
    </main>
  )
}
