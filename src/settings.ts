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
   * Show each player where their partner is. Visible is friendlier; hidden
   * turns it into a real deduction game. Try both.
   */
  showPartnerChain: true,
}
