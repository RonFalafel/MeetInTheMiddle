/**
 * The knobs SPEC.md says to resolve by playing rather than arguing. They live
 * together so a rule change is one edit and a reload, not a code change.
 */
export const SETTINGS = {
  /** Fewest borders between the two secret starts. Below 2 the game starts won. */
  minHops: 5,
  /** Most borders between the two secret starts. Higher is a longer game. */
  maxHops: 9,
  /**
   * Show each player the countries their partner has named, including their
   * start. Visible is friendlier; hidden turns it into a real deduction game.
   * Try both.
   */
  showPartnerCountries: true,
  /**
   * Show how many more countries are needed to join the two sides up. This is
   * the only signal that makes naming a country far from home worth doing, so
   * turning it off makes the game much harder.
   */
  showCountriesNeeded: true,
  /**
   * Draw the countries nobody has named yet. Off is the Travle experience:
   * an empty ocean that fills in only where you were right, so you are
   * recalling the world rather than reading it. This is only the starting
   * value — there is a toggle on the map, remembered per device.
   */
  showOutlines: true,
}
