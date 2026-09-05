import type { ContinentId } from './continents.ts'

/** ISO 3166-1 alpha-3, or an X-prefixed user-assigned code for entities without one. */
export type CountryCode = string

export type Country = {
  readonly code: CountryCode
  readonly name: string
  /** Alternative spellings accepted by the guess input. */
  readonly aliases: readonly string[]
  /** [longitude, latitude] — used to place labels and to draw microstates that are too small to see. */
  readonly centroid: readonly [number, number]
  readonly neighbours: readonly CountryCode[]
  /**
   * Which landmass this country belongs to, or null if it is out of play.
   *
   * Without ferry links the world is not one connected graph, so a game has to
   * keep both starts on the same landmass. Islands with no land route anywhere
   * get null: they still draw on the map, but they can never be a start and
   * can never join a route.
   */
  readonly component: number | null
  /**
   * Every country has one, including the islands that are out of play for
   * Meet in the Middle. Continent games do not care about land routes, so
   * Australia and Iceland are perfectly playable there.
   */
  readonly continent: ContinentId
}
