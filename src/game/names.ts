/**
 * Display names and accepted alternatives.
 *
 * Natural Earth's names are mostly good but abbreviate aggressively, and the
 * ISO package's are worse in the other direction ("Lao People's Democratic
 * Republic"). So: Natural Earth by default, overridden here where it reads
 * badly.
 *
 * Aliases only need to cover genuinely different words. The guess input
 * normalises case, punctuation and diacritics, so "cote divoire" already
 * matches "Côte d'Ivoire" without an entry.
 */

import type { CountryCode } from './types.ts'

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
