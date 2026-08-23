import type { GameState, PlayerIndex } from '../game/rules.ts'
import type { CountryCode } from '../game/types.ts'

/**
 * What the screen needs, whether the game lives in this tab or on the server.
 * Keeping both behind one shape is what lets the UI ignore the difference.
 */
export type Session = {
  /** Null while a room is still connecting. */
  readonly game: GameState | null
  readonly me: PlayerIndex
  /** Only offered on one device — in a room the server decides your seat. */
  readonly setMe: ((player: PlayerIndex) => void) | null
  readonly guess: (code: CountryCode) => void
  readonly restart: (() => void) | null
  readonly connection: 'local' | 'connecting' | 'live' | 'dropped'
  readonly roomCode: string | null
  readonly partnerHere: boolean
  /** A message from the server worth showing — a refusal, or why the join failed. */
  readonly notice: string | null
}
