/**
 * The wire format, shared by the server and the browser so neither can drift
 * from the other.
 *
 * The server is authoritative and always sends whole game state rather than
 * deltas. A game is a start pair plus a move list — a few hundred bytes — so
 * there is nothing to gain from being clever, and resending everything makes a
 * dropped message self-healing.
 */

import type { Move, PlayerIndex } from '../src/game/rules.ts'
import type { CountryCode } from '../src/game/types.ts'

export type RoomCode = string

export type ClientMessage =
  /** `token` resumes a seat this device already held, after a reconnect. */
  | { type: 'join'; room: RoomCode; token?: string }
  | { type: 'guess'; code: CountryCode }
  | { type: 'restart' }

export type GameSnapshot = {
  starts: readonly [CountryCode, CountryCode]
  moves: readonly Move[]
}

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
  | { type: 'rejected'; message: string }
  | { type: 'error'; message: string }

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
