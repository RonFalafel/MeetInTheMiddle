import { useEffect, useRef, useState } from 'react'
import { search } from '../game/graph.ts'
import { checkGuess } from '../game/rules.ts'
import type { GameState } from '../game/rules.ts'
import type { Country, CountryCode } from '../game/types.ts'

export type GuessInputProps = {
  readonly game: GameState
  readonly onMove: (code: CountryCode) => void
}

export function GuessInput({ game, onMove }: GuessInputProps) {
  const [text, setText] = useState('')
  const [highlighted, setHighlighted] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const suggestions: Country[] = text.trim() ? search(text) : []

  // Whoever's turn it is should be able to type immediately.
  useEffect(() => {
    inputRef.current?.focus()
  }, [game.turn])

  const submit = (guess: string) => {
    const check = checkGuess(game, guess)
    if (!check.ok) {
      setError(check.message)
      return
    }
    setText('')
    setHighlighted(0)
    setError(null)
    onMove(check.code)
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (suggestions.length === 0) return
      const step = event.key === 'ArrowDown' ? 1 : -1
      setHighlighted((current) => (current + step + suggestions.length) % suggestions.length)
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      submit(suggestions[highlighted]?.name ?? text)
      return
    }
    if (event.key === 'Escape') setText('')
  }

  return (
    <div className="guess">
      <input
        ref={inputRef}
        value={text}
        placeholder="Name a bordering country"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        aria-label="Your guess"
        onChange={(event) => {
          setText(event.target.value)
          setHighlighted(0)
          setError(null)
        }}
        onKeyDown={onKeyDown}
      />

      {suggestions.length > 0 && (
        <ul className="suggestions">
          {suggestions.map((country, index) => (
            <li key={country.code}>
              <button
                type="button"
                className={index === highlighted ? 'active' : undefined}
                // onMouseDown, not onClick: the input blurs before click fires.
                onMouseDown={(event) => {
                  event.preventDefault()
                  submit(country.name)
                }}
              >
                {country.name}
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="error">{error}</p>}
    </div>
  )
}
