/**
 * Hand-maintained sea crossings. Shared coastline is not enough to make the
 * world connected — roughly forty sovereign states have no land border at all —
 * and a few crossings exist purely to open up the map.
 *
 * Every link carries the distance, so "is that really a border?" is a question
 * you can answer by reading. Comment out anything you disagree with; comment
 * out a whole spread at the bottom to drop a region from the game.
 */

import type { CountryCode } from './types.ts'

export type SeaLink = {
  readonly a: CountryCode
  readonly b: CountryCode
  readonly why: string
}

/** You can drive across these. Hard to argue with. */
const FIXED_LINKS: readonly SeaLink[] = [
  { a: 'GBR', b: 'FRA', why: 'Channel Tunnel, 50 km' },
  { a: 'DNK', b: 'SWE', why: 'Øresund Bridge, 16 km' },
  { a: 'BHR', b: 'SAU', why: 'King Fahd Causeway, 25 km' },
  { a: 'SGP', b: 'MYS', why: 'Johor–Singapore Causeway, 1 km' },
]

/** Close enough to see across on a clear day. */
const NARROW_STRAITS: readonly SeaLink[] = [
  { a: 'ESP', b: 'MAR', why: 'Strait of Gibraltar, 14 km' },
  { a: 'EGY', b: 'SAU', why: 'Strait of Tiran, 13 km' },
  { a: 'YEM', b: 'DJI', why: 'Bab-el-Mandeb, 30 km' },
  { a: 'OMN', b: 'IRN', why: 'Strait of Hormuz, Musandam to Iran, 39 km' },
  { a: 'IND', b: 'LKA', why: "Palk Strait / Adam's Bridge, 30 km" },
  { a: 'RUS', b: 'JPN', why: 'La Pérouse Strait, Sakhalin to Hokkaido, 43 km' },
  { a: 'TTO', b: 'VEN', why: 'Columbus Channel, 11 km' },
  { a: 'RUS', b: 'USA', why: 'Bering Strait — the Diomede Islands are 3.8 km apart, 82 km shore to shore' },
]

/** Routine ferry distance. */
const SHORT_CROSSINGS: readonly SeaLink[] = [
  { a: 'ITA', b: 'ALB', why: 'Strait of Otranto, 72 km' },
  { a: 'ITA', b: 'MLT', why: 'Malta to Sicily, 80 km' },
  { a: 'ITA', b: 'TUN', why: 'Sicily to Cap Bon, 150 km' },
  { a: 'ITA', b: 'GRC', why: 'Adriatic ferry, Bari to Igoumenitsa, 160 km' },
  { a: 'CYP', b: 'TUR', why: 'Cyprus to Anatolia, 75 km' },
  { a: 'EST', b: 'FIN', why: 'Gulf of Finland, Tallinn to Helsinki, 80 km' },
  { a: 'KOR', b: 'JPN', why: 'Korea Strait, Busan to Fukuoka, 200 km' },
  { a: 'CHN', b: 'TWN', why: 'Taiwan Strait, 130 km' },
  { a: 'PHL', b: 'TWN', why: 'Luzon Strait via the Batanes, 250 km' },
  { a: 'PHL', b: 'IDN', why: 'Celebes Sea, Sangihe to Mindanao, 100 km' },
  { a: 'AUS', b: 'PNG', why: 'Torres Strait, 150 km' },
  { a: 'STP', b: 'GAB', why: 'Gulf of Guinea, 250 km' },
]

/** The Antilles, strung end to end. */
const CARIBBEAN: readonly SeaLink[] = [
  { a: 'USA', b: 'CUB', why: 'Florida Straits, 150 km' },
  { a: 'USA', b: 'BHS', why: 'Bimini to Florida, 90 km' },
  { a: 'BHS', b: 'CUB', why: '90 km' },
  { a: 'CUB', b: 'JAM', why: '145 km' },
  { a: 'CUB', b: 'HTI', why: 'Windward Passage, 80 km' },
  { a: 'DOM', b: 'KNA', why: 'Leeward Islands chain, 700 km, hopping territories not in play' },
  { a: 'KNA', b: 'ATG', why: '110 km' },
  { a: 'ATG', b: 'DMA', why: '150 km, past Guadeloupe' },
  { a: 'DMA', b: 'LCA', why: '50 km, past Martinique' },
  { a: 'LCA', b: 'BRB', why: '150 km' },
  { a: 'LCA', b: 'VCT', why: '40 km' },
  { a: 'VCT', b: 'GRD', why: '100 km' },
  { a: 'GRD', b: 'TTO', why: '130 km' },
]

/** Islands with nothing nearby. Long, but each is the shortest hop that exists. */
const OPEN_WATER: readonly SeaLink[] = [
  { a: 'ISL', b: 'GBR', why: 'via the Faroes, 800 km' },
  // Without this the only way between Europe and the Americas is the Bering
  // Strait, which makes Russia a chokepoint in a third of all games.
  { a: 'ISL', b: 'CAN', why: 'North Atlantic via Greenland, 1,500 km' },
  { a: 'CPV', b: 'SEN', why: '570 km' },
  { a: 'MDG', b: 'MOZ', why: 'Mozambique Channel, 400 km' },
  { a: 'COM', b: 'MDG', why: '300 km' },
  { a: 'COM', b: 'TZA', why: '300 km' },
  { a: 'SYC', b: 'MDG', why: '1,100 km — nothing is closer' },
  { a: 'MUS', b: 'MDG', why: '1,100 km via Réunion — the loneliest link in the table' },
  { a: 'MDV', b: 'LKA', why: '700 km' },
  { a: 'TLS', b: 'AUS', why: 'Timor Sea, 450 km' },
  { a: 'AUS', b: 'NZL', why: 'Tasman Sea, 2,000 km' },
]

/**
 * Oceania. Distances here are flights, not ferries, and there is no honest way
 * around that — the alternative is leaving eleven countries unreachable.
 * Comment out the spread below to drop the whole region.
 */
const PACIFIC: readonly SeaLink[] = [
  { a: 'PNG', b: 'SLB', why: '500 km' },
  { a: 'SLB', b: 'VUT', why: '300 km' },
  { a: 'VUT', b: 'FJI', why: '800 km' },
  { a: 'FJI', b: 'NZL', why: '2,000 km' },
  { a: 'FJI', b: 'TON', why: '800 km' },
  { a: 'TON', b: 'WSM', why: '900 km' },
  { a: 'SLB', b: 'NRU', why: '1,400 km' },
  { a: 'NRU', b: 'KIR', why: '700 km' },
  { a: 'KIR', b: 'MHL', why: '800 km' },
  { a: 'MHL', b: 'FSM', why: '1,200 km' },
  { a: 'FSM', b: 'PLW', why: '1,000 km' },
  { a: 'PLW', b: 'PHL', why: '800 km' },
]

export const SEA_LINKS: readonly SeaLink[] = [
  ...FIXED_LINKS,
  ...NARROW_STRAITS,
  ...SHORT_CROSSINGS,
  ...CARIBBEAN,
  ...OPEN_WATER,
  ...PACIFIC,
]
