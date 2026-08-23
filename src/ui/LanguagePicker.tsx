import { LANGUAGES } from '../game/languages.ts'
import type { LanguageCode } from '../game/languages.ts'
import { useLanguage } from './language.tsx'

/** A plain select: on a phone this is the native picker, which is the good one. */
export function LanguagePicker() {
  const { language, setLanguage, t } = useLanguage()

  return (
    <label className="language">
      <span className="visually-hidden">{t.language}</span>
      <select
        value={language}
        aria-label={t.language}
        onChange={(event) => setLanguage(event.target.value as LanguageCode)}
      >
        {LANGUAGES.map((option) => (
          <option key={option.code} value={option.code}>
            {option.endonym}
          </option>
        ))}
      </select>
    </label>
  )
}
