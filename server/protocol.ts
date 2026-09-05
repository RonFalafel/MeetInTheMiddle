/**
 * The wire format, shared by the server and the browser so neither can drift
 * from the other.
 *
 * The server is authoritative and always sends whole game state rather than
 * deltas. A game is a start pair plus a move list — a few hundred bytes — so
 * there is nothing to gain from being clever, and resending everything makes a
 * dropped message self-healing.
 */

import type { GameRequest, PlayerIndex, Rejection, Snapshot } from '../src/game/rules.ts'
import type { CountryCode } from '../src/game/types.ts'

export type RoomCode = string

/** Reasons a device cannot be in a room. The client renders these translated. */
export type ErrorCode = 'bad-room' | 'room-full' | 'taken-over' | 'not-joined' | 'bad-message'

export type ClientMessage =
  /**
   * `token` resumes a seat this device already held, after a reconnect.
   * `request` only applies when the room does not exist yet — whoever gets there
   * first picks the game, and the second player joins whatever is already running.
   */
  | { type: 'join'; room: RoomCode; token?: string; request?: GameRequest }
  | { type: 'guess'; code: CountryCode }
  /** Omitting `request` deals another game of the same kind. */
  | { type: 'restart'; request?: GameRequest }
  /** Continent games only: end it early and show what was missed. */
  | { type: 'reveal' }

/** The whole game, as `rules.ts` serialises it. */
export type GameSnapshot = Snapshot

export type ServerMessage =
  | {
      type: 'welcome'
      room: RoomCode
      player: PlayerIndex
      /** Store this and send it back to reclaim the same seat. */
      token: string
      game: GameSnapshot
      partnerHere: boolean
    }
  | { type: 'state'; game: GameSnapshot }
  | { type: 'partner'; here: boolean }
  /** A guess the server would not accept. Costs nothing; the board is unchanged. */
  | { type: 'rejected'; rejection: Rejection }
  | { type: 'error'; error: ErrorCode }

/** Unambiguous in speech and on a phone keyboard: no O/0, I/1, or S/5. */
const ALPHABET = 'ABCDEFGHJKLMNPQRTUVWXYZ2346789'

export function makeRoomCode(random: () => number = Math.random): RoomCode {
  let code = ''
  for (let i = 0; i < 4; i++) code += ALPHABET[Math.floor(random() * ALPHABET.length)]
  return code
}

/** Accepts what a person actually types: lowercase, spaces, a stray hyphen. */
export function normaliseRoomCode(input: string): RoomCode | null {
  const code = input.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (code.length !== 4) return null
  if ([...code].some((character) => !ALPHABET.includes(character))) return null
  return code
}
