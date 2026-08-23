import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { countryName } from '../game/graph.ts'
import { DEFAULT_LANGUAGE, STRINGS, isLanguageCode, languageOf } from '../game/languages.ts'
import type { LanguageCode, Strings } from '../game/languages.ts'
import type { CountryCode } from '../game/types.ts'

const STORAGE_KEY = 'mitm:language'

type LanguageValue = {
  language: LanguageCode
  setLanguage: (language: LanguageCode) => void
  /** Interface text in the chosen language. */
  t: Strings
  /** A country's name in the chosen language. */
  name: (code: CountryCode) => string
  dir: 'ltr' | 'rtl'
}

const LanguageContext = createContext<LanguageValue | null>(null)

/** A saved choice, else the phone's own language if the game speaks it. */
function initialLanguage(): LanguageCode {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved && isLanguageCode(saved)) return saved

  for (const preferred of navigator.languages ?? [navigator.language]) {
    const base = preferred.split('-')[0]
    if (base && isLanguageCode(base)) return base
  }
  return DEFAULT_LANGUAGE
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setStored] = useState<LanguageCode>(initialLanguage)

  const setLanguage = useCallback((next: LanguageCode) => {
    localStorage.setItem(STORAGE_KEY, next)
    setStored(next)
  }, [])

  // Hebrew and Arabic need the whole document flipped, not just the text.
  useEffect(() => {
    const { dir } = languageOf(language)
    document.documentElement.lang = language
    document.documentElement.dir = dir
  }, [language])

  const value = useMemo<LanguageValue>(
    () => ({
      language,
      setLanguage,
      t: STRINGS[language],
      name: (code: CountryCode) => countryName(code, language),
      dir: languageOf(language).dir,
    }),
    [language, setLanguage],
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage(): LanguageValue {
  const value = useContext(LanguageContext)
  if (!value) throw new Error('useLanguage must be used inside a LanguageProvider')
  return value
}
