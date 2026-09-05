import type { GameRequest, GameState, PlayerIndex, Rejection } from '../game/rules.ts'
import type { ErrorCode } from '../../server/protocol.ts'
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
  /** Omitting the request deals another game of the same kind. */
  readonly restart: ((request?: GameRequest) => void) | null
  /** Continent games only: end it early and show what was missed. */
  readonly reveal: (() => void) | null
  readonly connection: 'local' | 'connecting' | 'live' | 'dropped'
  readonly roomCode: string | null
  readonly partnerHere: boolean
  /** Something worth showing — a refused guess, or why the room would not take us. */
  readonly notice: Notice | null
}

export type Notice =
  | { readonly kind: 'rejected'; readonly rejection: Rejection }
  | { readonly kind: 'error'; readonly error: ErrorCode }
