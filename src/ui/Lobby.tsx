import { useState } from 'react'
import { makeRoomCode, normaliseRoomCode } from '../../server/protocol.ts'

export type LobbyProps = {
  readonly onPlayHere: () => void
  readonly onOpenRoom: (code: string) => void
}

export function Lobby({ onPlayHere, onOpenRoom }: LobbyProps) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  const join = () => {
    const room = normaliseRoomCode(code)
    if (!room) {
      setError('Room codes are four characters.')
      return
    }
    onOpenRoom(room)
  }

  return (
    <main className="lobby">
      <div className="lobby-intro">
        <h1>Meet in the Middle</h1>
        <p>
          You and your partner start in two secret countries. Name countries —
          any country, in any order — until your two sides join up. Fewest
          countries wins.
        </p>
      </div>

      <section className="panel">
        <h2>Two phones</h2>
        <p className="muted">One of you starts a game and sends the other the link.</p>
        <button type="button" className="primary" onClick={() => onOpenRoom(makeRoomCode())}>
          Start a game
        </button>

        <div className="join">
          <input
            value={code}
            placeholder="Or enter a code"
            aria-label="Room code"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="characters"
            spellCheck={false}
            enterKeyHint="go"
            maxLength={5}
            onChange={(event) => {
              setCode(event.target.value)
              setError(null)
            }}
            onKeyDown={(event) => event.key === 'Enter' && join()}
          />
          <button type="button" onClick={join}>
            Join
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </section>

      <section className="panel">
        <h2>One device</h2>
        <p className="muted">Pass it back and forth, or play both sides yourself.</p>
        <button type="button" onClick={onPlayHere}>
          Play here
        </button>
      </section>
    </main>
  )
}
