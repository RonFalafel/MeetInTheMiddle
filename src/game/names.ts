/**
 * Display names and accepted alternatives.
 *
 * English comes from Natural Earth, which abbreviates aggressively but stays
 * short; the overrides below expand the ones that read badly. Every other
 * language comes from `Intl.DisplayNames`, which is CLDR data and needs almost
 * no correction — the tables here are for the handful of cases where the
 * official name is not the one anyone says out loud.
 *
 * Aliases only need to cover genuinely different words. The guess input
 * normalises case, punctuation and diacritics in any script, so "cote divoire"
 * already matches "Côte d'Ivoire" and "צכיה" already matches "צ׳כיה" without
 * an entry.
 */

import type { CountryCode } from './types.ts'
import type { LanguageCode } from './languages.ts'

/** English only — the other languages are named from CLDR. */
export const NAME_OVERRIDES: Readonly<Record<CountryCode, string>> = {
  ATG: 'Antigua and Barbuda',
  BIH: 'Bosnia and Herzegovina',
  CAF: 'Central African Republic',
  COD: 'Democratic Republic of the Congo',
  COG: 'Republic of the Congo',
  DOM: 'Dominican Republic',
  GNQ: 'Equatorial Guinea',
  KNA: 'Saint Kitts and Nevis',
  LCA: 'Saint Lucia',
  MHL: 'Marshall Islands',
  MKD: 'North Macedonia',
  SLB: 'Solomon Islands',
  SSD: 'South Sudan',
  STP: 'São Tomé and Príncipe',
  SWZ: 'Eswatini',
  USA: 'United States',
  VAT: 'Vatican City',
  VCT: 'Saint Vincent and the Grenadines',
}

/**
 * Where CLDR's name is not what people say, or where a country has no CLDR
 * entry at all. Kosovo is the second case in every language: it has no ISO
 * code, so it has no CLDR record either.
 */
export const TRANSLATED_OVERRIDES: Readonly<
  Partial<Record<LanguageCode, Readonly<Record<CountryCode, string>>>>
> = {
  he: {
    XKX: 'קוסובו',
    COD: 'קונגו קינשאסה',
    COG: 'קונגו ברזוויל',
  },
  ar: {
    XKX: 'كوسوفو',
    COD: 'الكونغو كينشاسا',
    COG: 'الكونغو برازافيل',
  },
  es: { XKX: 'Kosovo', COD: 'Congo-Kinshasa', COG: 'Congo-Brazzaville' },
  fr: { XKX: 'Kosovo' },
  de: { XKX: 'Kosovo' },
  it: { XKX: 'Kosovo', COD: 'Congo-Kinshasa', COG: 'Congo-Brazzaville' },
  nl: { XKX: 'Kosovo' },
  pt: { XKX: 'Kosovo', COD: 'Congo-Kinshasa', COG: 'Congo-Brazzaville' },
  ru: {
    XKX: 'Косово',
    KOR: 'Южная Корея',
    USA: 'США',
    COD: 'Конго-Киншаса',
    COG: 'Конго-Браззавиль',
  },
}

export const ALIASES: Readonly<Record<CountryCode, readonly string[]>> = {
  ARE: ['UAE', 'Emirates'],
  BHS: ['The Bahamas'],
  BIH: ['Bosnia'],
  CAF: ['CAR'],
  CIV: ['Ivory Coast'],
  COD: ['DRC', 'DR Congo', 'Congo-Kinshasa', 'Zaire'],
  COG: ['Congo', 'Congo-Brazzaville'],
  CPV: ['Cape Verde'],
  CZE: ['Czech Republic'],
  FSM: ['Federated States of Micronesia'],
  GBR: ['UK', 'Britain', 'Great Britain', 'England'],
  GMB: ['The Gambia'],
  GNB: ['Guinea Bissau'],
  IRN: ['Persia'],
  KNA: ['St Kitts'],
  KOR: ['Korea', 'Republic of Korea'],
  LCA: ['St Lucia'],
  MKD: ['Macedonia', 'FYROM'],
  MMR: ['Burma'],
  NLD: ['Holland'],
  NZL: ['NZ'],
  PNG: ['PNG'],
  PRK: ['DPRK'],
  RUS: ['Russian Federation'],
  STP: ['Sao Tome'],
  SWZ: ['Swaziland'],
  TLS: ['East Timor'],
  TTO: ['Trinidad', 'Tobago'],
  TUR: ['Türkiye', 'Turkiye'],
  USA: ['USA', 'US', 'United States of America', 'America'],
  VAT: ['Holy See'],
  VCT: ['St Vincent'],
  XKX: ['Kosova'],
  ZAF: ['RSA', 'South Africa'],
}

/**
 * Extra spellings per language. Mostly the definite article people drop, and
 * the abbreviations they use instead of the full name.
 */
export const TRANSLATED_ALIASES: Readonly<
  Partial<Record<LanguageCode, Readonly<Record<CountryCode, readonly string[]>>>>
> = {
  he: {
    USA: ['ארהב', 'אמריקה', 'ארצות הברית'],
    GBR: ['אנגליה', 'הממלכה המאוחדת', 'בריטניה הגדולה'],
    ARE: ['אמירויות', 'איחוד האמירויות'],
    VAT: ['ותיקן', 'הוותיקן'],
    NLD: ['ארצות השפלה'],
    CHE: ['שוויץ'],
    CZE: ['צכיה', 'צ׳כיה'],
    MMR: ['בורמה'],
    DEU: ['אשכנז'],
    GRC: ['יוון'],
    EGY: ['מצריים'],
    SAU: ['ערב הסעודית', 'סעודיה'],
    PRK: ['צפון קוריאה'],
    KOR: ['דרום קוריאה'],
    ZAF: ['דרום אפריקה'],
    CAF: ['מרכז אפריקה'],
    COD: ['קונגו'],
  },
  ar: {
    USA: ['أمريكا', 'الولايات المتحدة الأمريكية'],
    GBR: ['بريطانيا', 'إنجلترا'],
    ARE: ['الإمارات'],
    EGY: ['مصر'],
    SAU: ['السعودية'],
    MMR: ['بورما'],
  },
  es: { USA: ['EEUU', 'EE UU', 'América'], GBR: ['Inglaterra', 'Gran Bretaña'], NLD: ['Holanda'] },
  fr: { USA: ['USA', 'Amérique'], GBR: ['Angleterre', 'Grande-Bretagne'], NLD: ['Hollande'] },
  de: { USA: ['USA', 'Amerika'], GBR: ['England', 'Großbritannien'], NLD: ['Holland'] },
  it: { USA: ['USA', 'America'], GBR: ['Inghilterra', 'Gran Bretagna'], NLD: ['Olanda'] },
  nl: { USA: ['VS', 'Amerika'], GBR: ['Engeland', 'Groot-Brittannië'] },
  pt: { USA: ['EUA', 'América'], GBR: ['Inglaterra', 'Grã-Bretanha'], NLD: ['Holanda'] },
  ru: {
    USA: ['Соединенные Штаты', 'Америка', 'США'],
    GBR: ['Англия', 'Великобритания'],
    NLD: ['Голландия'],
    ARE: ['Объединенные Арабские Эмираты', 'ОАЭ'],
    PRK: ['Северная Корея', 'КНДР'],
    CHN: ['КНР'],
  },
}
