/**
 * Which countries are in play. Everything here is a judgement call, not data —
 * the graph generator reads these tables and `npm run graph` regenerates the
 * artifact. Comment a line out to change the game.
 *
 * Keys are Natural Earth's `properties.name` from world-atlas countries-50m,
 * which is the only join key the dataset gives us.
 */

import type { CountryCode } from './types.ts'

/**
 * Entities whose sovereignty is contested. Each one can either be played as its
 * own country or folded into the state that de facto administers it.
 *
 * Merging matters: these are not empty polygons. Dropping Western Sahara
 * outright would take Morocco's border with Mauritania with it, so a merged
 * entity donates its borders to its parent instead of disappearing.
 *
 * Flip `mode` to change your mind. That is the whole point of this table.
 */
export type DisputedEntity = {
  /** Used when mode is 'play'. X-prefixed where ISO has assigned nothing. */
  readonly code: CountryCode
  readonly name: string
  /** Used when mode is 'merge': who inherits the territory and its borders. */
  readonly parent: CountryCode
  readonly mode: 'play' | 'merge'
}

export const DISPUTED: Readonly<Record<string, DisputedEntity>> = {
  // Recognised by ~half the UN, and a country most players would expect to exist.
  Kosovo: { code: 'XKX', name: 'Kosovo', parent: 'SRB', mode: 'play' },

  // De facto independent since 1991, recognised by nobody. Merged into Somalia,
  // which keeps Somalia's borders with Djibouti and Ethiopia intact.
  Somaliland: { code: 'XSO', name: 'Somaliland', parent: 'SOM', mode: 'merge' },

  // Recognised only by Turkey. Merging it makes Cyprus a single island nation.
  'N. Cyprus': { code: 'XNC', name: 'Northern Cyprus', parent: 'CYP', mode: 'merge' },

  // ESH is a real ISO code; the territory is administered by Morocco. Merging
  // is what gives Morocco its land border with Mauritania.
  'W. Sahara': { code: 'ESH', name: 'Western Sahara', parent: 'MAR', mode: 'merge' },
}

/**
 * Dependent territories, uninhabited claims, and dataset artifacts. None of
 * these are sovereign states, and none of them are load-bearing for
 * connectivity — every one is either an island or an enclave inside its parent.
 */
export const EXCLUDED: ReadonlySet<string> = new Set([
  // Uninhabited or effectively so
  'Antarctica',
  'Fr. S. Antarctic Lands',
  'Heard I. and McDonald Is.',
  'S. Geo. and the Is.',
  'Ashmore and Cartier Is.',
  'Indian Ocean Ter.',
  'Br. Indian Ocean Ter.',
  'Siachen Glacier', // disputed no-man's-land; India-China and India-Pakistan borders survive without it

  // United Kingdom
  'Anguilla', 'Bermuda', 'British Virgin Is.', 'Cayman Is.', 'Falkland Is.',
  'Guernsey', 'Isle of Man', 'Jersey', 'Montserrat', 'Pitcairn Is.',
  'Saint Helena', 'Turks and Caicos Is.',

  // France
  'Fr. Polynesia', 'New Caledonia', 'St-Barthélemy', 'St-Martin',
  'St. Pierre and Miquelon', 'Wallis and Futuna Is.',

  // United States
  'American Samoa', 'Guam', 'N. Mariana Is.', 'Puerto Rico', 'U.S. Virgin Is.',

  // Netherlands
  'Aruba', 'Curaçao', 'Sint Maarten',

  // Denmark, Finland, New Zealand, Australia, China
  'Greenland', 'Faeroe Is.', 'Åland', 'Cook Is.', 'Niue', 'Norfolk Island',
  'Hong Kong', 'Macao',
])

/**
 * Borders that exist in the geometry but shouldn't exist in the game, because
 * the dataset folds an overseas territory into its parent's polygon.
 *
 * French Guiana is drawn as part of France, so France comes out of the topology
 * bordering Brazil and Suriname. Technically true, wildly misleading in a game
 * about walking across the world.
 */
export const EDGE_BLACKLIST: readonly (readonly [CountryCode, CountryCode])[] = [
  ['FRA', 'BRA'], // French Guiana
  ['FRA', 'SUR'], // French Guiana
]
