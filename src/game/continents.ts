/**
 * Which continent each country belongs to.
 *
 * Hand-written rather than pulled from a package, because the awkward cases are
 * genuine judgement calls and deserve to be visible and arguable rather than
 * inherited from someone else's table. Mostly UN M49, with the departures
 * commented where they happen.
 *
 * The generator checks this covers every country exactly once, so a missing or
 * duplicated code fails the build rather than quietly producing a continent
 * that can never be completed.
 *
 * Continent games ignore land connectivity entirely — there is no route to
 * build — so islands that are out of play in Meet in the Middle are very much
 * in play here. Oceania exists only in this mode.
 */

import type { CountryCode } from './types.ts'

export type ContinentId =
  | 'europe'
  | 'asia'
  | 'africa'
  | 'north-america'
  | 'south-america'
  | 'oceania'

export const CONTINENT_IDS: readonly ContinentId[] = [
  'europe',
  'asia',
  'africa',
  'north-america',
  'south-america',
  'oceania',
]

export const CONTINENTS: Readonly<Record<ContinentId, readonly CountryCode[]>> = {
  europe: [
    'ALB', 'AND', 'AUT', 'BEL', 'BGR', 'BIH', 'BLR', 'CHE', 'CZE', 'DEU',
    'DNK', 'ESP', 'EST', 'FIN', 'FRA', 'GBR', 'GRC', 'HRV', 'HUN', 'IRL',
    'ISL', 'ITA', 'LIE', 'LTU', 'LUX', 'LVA', 'MCO', 'MDA', 'MKD', 'MLT',
    'MNE', 'NLD', 'NOR', 'POL', 'PRT', 'ROU', 'SMR', 'SRB', 'SVK', 'SVN',
    'SWE', 'UKR', 'VAT', 'XKX',

    // Asian by area, European by everything else anyone uses the word for.
    'CYP',
    // Most of the landmass is in Asia; most of the people are not.
    'RUS',
  ],

  asia: [
    'AFG', 'ARE', 'BGD', 'BHR', 'BRN', 'BTN', 'CHN', 'IDN', 'IND', 'IRN',
    'IRQ', 'ISR', 'JOR', 'JPN', 'KAZ', 'KGZ', 'KHM', 'KOR', 'KWT', 'LAO',
    'LBN', 'LKA', 'MDV', 'MMR', 'MNG', 'MYS', 'NPL', 'OMN', 'PAK', 'PHL',
    'PRK', 'PSE', 'QAT', 'SAU', 'SGP', 'SYR', 'THA', 'TJK', 'TKM', 'TLS',
    'TWN', 'UZB', 'VNM', 'YEM',

    // The South Caucasus sits on the line and gets claimed by both. M49 says
    // Western Asia, so that is where they are.
    'ARM', 'AZE', 'GEO',
    // Likewise Turkey: a sliver of Thrace is not enough to move it.
    'TUR',
  ],

  africa: [
    'AGO', 'BDI', 'BEN', 'BFA', 'BWA', 'CAF', 'CIV', 'CMR', 'COD', 'COG',
    'COM', 'CPV', 'DJI', 'DZA', 'ERI', 'ETH', 'GAB', 'GHA', 'GIN', 'GMB',
    'GNB', 'GNQ', 'KEN', 'LBR', 'LBY', 'LSO', 'MAR', 'MDG', 'MLI', 'MOZ',
    'MRT', 'MUS', 'MWI', 'NAM', 'NER', 'NGA', 'RWA', 'SDN', 'SEN', 'SLE',
    'SOM', 'SSD', 'STP', 'SWZ', 'SYC', 'TCD', 'TGO', 'TUN', 'TZA', 'UGA',
    'ZAF', 'ZMB', 'ZWE',

    // Sinai is in Asia; nobody thinks of Egypt as an Asian country.
    'EGY',
  ],

  // Central America and the Caribbean included — splitting them leaves three
  // groups too small to be a game on their own.
  'north-america': [
    'ATG', 'BHS', 'BLZ', 'BRB', 'CAN', 'CRI', 'CUB', 'DMA', 'DOM', 'GRD',
    'GTM', 'HND', 'HTI', 'JAM', 'KNA', 'LCA', 'MEX', 'NIC', 'PAN', 'SLV',
    'TTO', 'USA', 'VCT',
  ],

  'south-america': [
    'ARG', 'BOL', 'BRA', 'CHL', 'COL', 'ECU', 'GUY', 'PER', 'PRY', 'SUR',
    'URY', 'VEN',
  ],

  oceania: [
    'AUS', 'FJI', 'FSM', 'KIR', 'MHL', 'NRU', 'NZL', 'PLW', 'PNG', 'SLB',
    'TON', 'VUT', 'WSM',
  ],
}

/** Reverse lookup, built once. */
const OF_COUNTRY = new Map<CountryCode, ContinentId>()
for (const id of CONTINENT_IDS) {
  for (const code of CONTINENTS[id]) OF_COUNTRY.set(code, id)
}

export function continentOf(code: CountryCode): ContinentId | undefined {
  return OF_COUNTRY.get(code)
}

export function isContinentId(value: string): value is ContinentId {
  return CONTINENT_IDS.includes(value as ContinentId)
}
