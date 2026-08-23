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
}

export type CountryGraph = {
  readonly byCode: ReadonlyMap<CountryCode, Country>
  readonly codes: readonly CountryCode[]
}
