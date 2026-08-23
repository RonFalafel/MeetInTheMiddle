import { describe, expect, it } from 'vitest'
import { PLAYABLE_CODES, countryName, findByName, normalise, search } from './graph.ts'
import { NAMES, NAME_ALIASES } from './data/names.generated.ts'
import { LANGUAGES, LANGUAGE_CODES, STRINGS, format, isLanguageCode } from './languages.ts'
import type { LanguageCode } from './languages.ts'

describe('the language list', () => {
  it('has a name and a direction for each', () => {
    for (const language of LANGUAGES) {
      expect(language.endonym.length).toBeGreaterThan(0)
      expect(['ltr', 'rtl']).toContain(language.dir)
    }
  })

  it('marks Hebrew and Arabic right to left', () => {
    expect(LANGUAGES.find((l) => l.code === 'he')?.dir).toBe('rtl')
    expect(LANGUAGES.find((l) => l.code === 'ar')?.dir).toBe('rtl')
  })

  it('recognises its own codes and nothing else', () => {
    expect(isLanguageCode('he')).toBe(true)
    expect(isLanguageCode('klingon')).toBe(false)
  })
})

describe('interface text', () => {
  it('is complete in every language', () => {
    const keys = Object.keys(STRINGS.en) as (keyof (typeof STRINGS)['en'])[]
    for (const language of LANGUAGE_CODES) {
      for (const key of keys) {
        expect(STRINGS[language][key], `${language}.${key}`).toBeTruthy()
      }
    }
  })

  it('is genuinely translated, not a copied English block', () => {
    // Checked on the long, distinctive strings only: single words like "Score"
    // are legitimately the same in French and Dutch, and flagging those would
    // make this test lie.
    for (const language of LANGUAGE_CODES) {
      if (language === 'en') continue
      for (const key of ['title', 'tagline', 'perfect', 'twoPhonesHint'] as const) {
        expect(STRINGS[language][key], `${language}.${key} is still English`).not.toBe(
          STRINGS.en[key],
        )
      }
    }
  })

  it('keeps every placeholder a sentence needs', () => {
    for (const language of LANGUAGE_CODES) {
      expect(STRINGS[language].againstPar).toContain('{score}')
      expect(STRINGS[language].againstPar).toContain('{par}')
      expect(STRINGS[language].rejectUnknown).toContain('{text}')
      for (const key of ['rejectOutOfPlay', 'rejectWrongLandmass', 'rejectAlreadyNamed'] as const) {
        expect(STRINGS[language][key], `${language}.${key}`).toContain('{country}')
      }
    }
  })

  it('fills placeholders and leaves unknown ones alone', () => {
    expect(format('Score {score}, par {par}.', { score: 4, par: 3 })).toBe('Score 4, par 3.')
    expect(format('{nope}', {})).toBe('{nope}')
  })
})

describe('country names', () => {
  it('exist in every language for every country in play', () => {
    for (const language of LANGUAGE_CODES) {
      for (const code of PLAYABLE_CODES) {
        expect(NAMES[language][code], `${code} in ${language}`).toBeTruthy()
      }
    }
  })

  it('are actually translated, not English copied around', () => {
    // A sample where every language really does differ from English.
    for (const language of LANGUAGE_CODES) {
      if (language === 'en') continue
      expect(NAMES[language].DEU, `Germany in ${language}`).not.toBe(NAMES.en.DEU)
    }
  })

  it('are in Hebrew script for Hebrew', () => {
    for (const code of ['DEU', 'FRA', 'ISR', 'XKX', 'SGP']) {
      expect(NAMES.he[code], code).toMatch(/[֐-׿]/)
    }
  })

  it('never leave a country nameless in a language that has no CLDR record', () => {
    // Kosovo is the case: no ISO code, so no CLDR entry either.
    for (const language of LANGUAGE_CODES) {
      expect(NAMES[language].XKX, `Kosovo in ${language}`).toBeTruthy()
    }
  })

  it('splits a parenthetical into a name and an alias', () => {
    expect(NAMES.he.MMR).toBe('מיאנמר')
    expect(NAME_ALIASES.he.MMR).toContain('בורמה')
  })

  it('are unique within a language, so no two countries share a name', () => {
    for (const language of LANGUAGE_CODES) {
      const seen = new Map<string, string>()
      for (const code of PLAYABLE_CODES) {
        const key = normalise(NAMES[language][code]!)
        expect(seen.has(key), `${language}: ${code} and ${seen.get(key)} are both "${key}"`).toBe(false)
        seen.set(key, code)
      }
    }
  })

  it('are what the interface asks for', () => {
    expect(countryName('DEU', 'he')).toBe('גרמניה')
    expect(countryName('DEU', 'en')).toBe('Germany')
  })
})

describe('normalising other scripts', () => {
  it('does not throw Hebrew away, which a Latin-only filter would', () => {
    expect(normalise('גרמניה')).toBe('גרמניה')
    expect(normalise('  גרמניה  ')).toBe('גרמניה')
  })

  it('ignores the geresh, so צכיה matches צ׳כיה', () => {
    expect(normalise('צ׳כיה')).toBe(normalise('צכיה'))
  })

  it('ignores Arabic hamza placement and harakat', () => {
    expect(normalise('ألمانيا')).toBe(normalise('المانيا'))
  })

  it('still folds Latin accents', () => {
    expect(normalise('Côte d’Ivoire')).toBe(normalise('cote divoire'))
  })
})

describe('guessing across languages', () => {
  it('accepts a country named in any language, whatever is on screen', () => {
    const german: Record<LanguageCode, string> = {
      en: 'Germany',
      he: 'גרמניה',
      ar: 'ألمانيا',
      es: 'Alemania',
      fr: 'Allemagne',
      de: 'Deutschland',
      it: 'Germania',
      nl: 'Duitsland',
      pt: 'Alemanha',
      ru: 'Германия',
    }
    for (const [language, name] of Object.entries(german)) {
      expect(findByName(name)?.code, `${name} (${language})`).toBe('DEU')
    }
  })

  it('accepts what a Hebrew speaker would really type', () => {
    expect(findByName('ארהב')?.code).toBe('USA')
    expect(findByName('אנגליה')?.code).toBe('GBR')
    expect(findByName('בורמה')?.code).toBe('MMR')
  })

  it('suggests in the reader’s language', () => {
    expect(search('גרמ', 'he')[0]?.code).toBe('DEU')
    expect(search('Deutsch', 'de')[0]?.code).toBe('DEU')
  })

  it('still finds a country typed in another language, ranked after the reader’s own', () => {
    // Reading in Hebrew, typing in English: it should still be found.
    expect(search('Germany', 'he').map((c) => c.code)).toContain('DEU')
  })

  it('never suggests a country that is out of play, in any language', () => {
    for (const language of LANGUAGE_CODES) {
      for (const country of search('a', language, 20)) {
        expect(country.component, `${country.code} in ${language}`).not.toBeNull()
      }
    }
  })
})
