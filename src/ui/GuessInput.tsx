import { useRef, useState } from 'react'
import { search } from '../game/graph.ts'
import { useLanguage } from './language.tsx'
import { checkGuess } from '../game/rules.ts'
import { describeRejection } from './messages.ts'
import type { GameState, Rejection } from '../game/rules.ts'
import type { Country, CountryCode } from '../game/types.ts'

export type GuessInputProps = {
  readonly game: GameState
  readonly onGuess: (code: CountryCode) => void
  readonly disabled?: boolean
}

export function GuessInput({ game, onGuess, disabled }: GuessInputProps) {
  const { t, language, name } = useLanguage()
  const [text, setText] = useState('')
  const [highlighted, setHighlighted] = useState(0)
  const [error, setError] = useState<Rejection | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const suggestions: Country[] = text.trim() ? search(text, language) : []

  const submit = (guess: string) => {
    const check = checkGuess(game, guess)
    if (!check.ok) {
      setError(check)
      return
    }
    setText('')
    setHighlighted(0)
    setError(null)
    onGuess(check.code)
    // Keeps the phone keyboard up between guesses.
    inputRef.current?.focus()
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
      const chosen = suggestions[highlighted]
      submit(chosen ? name(chosen.code) : text)
      return
    }
    if (event.key === 'Escape') setText('')
  }

  return (
    <div className="guess">
      <input
        ref={inputRef}
        value={text}
        disabled={disabled}
        placeholder={t.guessPlaceholder}
        aria-label={t.guessPlaceholder}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="words"
        spellCheck={false}
        enterKeyHint="go"
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
                // onPointerDown, not onClick: the input blurs before a click fires,
                // which on a phone closes the keyboard and jumps the layout.
                onPointerDown={(event) => {
                  event.preventDefault()
                  submit(name(country.code))
                }}
              >
                {name(country.code)}
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="error">{describeRejection(error, t, name)}</p>}
    </div>
  )
}
