import { randomUUID } from 'node:crypto'
import { SETTINGS } from '../src/settings.ts'
import { applyMove, checkMove, newGame } from '../src/game/rules.ts'
import type { GameState, PlayerIndex } from '../src/game/rules.ts'
import type { CountryCode } from '../src/game/types.ts'
import { makeRoomCode } from './protocol.ts'
import type { GameSnapshot, RoomCode } from './protocol.ts'

/** Rooms are memory only. A restart drops every game, which is the right trade for a party game. */
const ROOM_LIFETIME_MS = 6 * 60 * 60 * 1000
const SWEEP_INTERVAL_MS = 10 * 60 * 1000

/**
 * How long a seat is held for a device that has gone quiet. Short enough that
 * losing your token — new phone, cleared browser data — does not brick the
 * room forever; long enough to survive a tunnel, a locked screen or a reload.
 * A device that still has its token gets its seat back regardless of this.
 */
const SEAT_GRACE_MS = 60 * 1000

export type Seat<Connection> = {
  /** Proves a reconnecting device owns this seat. */
  token: string
  connection: Connection | null
  /** When the seat went quiet, for the grace period above. */
  freeSince: number | null
}

export type Room<Connection> = {
  code: RoomCode
  game: GameState
  seats: [Seat<Connection> | null, Seat<Connection> | null]
  touchedAt: number
}

export type JoinResult<Connection> =
  | {
      ok: true
      room: Room<Connection>
      player: PlayerIndex
      token: string
      /** A device that was holding this seat and has just been replaced. */
      displaced?: Connection
    }
  | { ok: false; message: string }

const startGame = () => newGame({ minHops: SETTINGS.minHops, maxHops: SETTINGS.maxHops })

export function snapshot(game: GameState): GameSnapshot {
  return { starts: game.starts, moves: game.moves }
}

export type RoomsOptions = {
  /** Overridable so tests do not have to wait a minute. */
  seatGraceMs?: number
}

export class Rooms<Connection> {
  private readonly rooms = new Map<RoomCode, Room<Connection>>()
  private readonly sweeper: ReturnType<typeof setInterval>
  private readonly seatGraceMs: number

  constructor(options: RoomsOptions = {}) {
    this.seatGraceMs = options.seatGraceMs ?? SEAT_GRACE_MS
    this.sweeper = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS)
    this.sweeper.unref?.()
  }

  /** A code that is not already taken. */
  create(): Room<Connection> {
    let code = makeRoomCode()
    while (this.rooms.has(code)) code = makeRoomCode()

    const room: Room<Connection> = { code, game: startGame(), seats: [null, null], touchedAt: Date.now() }
    this.rooms.set(code, room)
    return room
  }

  get(code: RoomCode): Room<Connection> | undefined {
    return this.rooms.get(code)
  }

  /**
   * Seats a device. A known token always gets its original seat back, however
   * long it was away — that is what makes a dropped phone able to rejoin
   * mid-game rather than being told the room is full.
   */
  join(code: RoomCode, token: string | undefined, connection: Connection): JoinResult<Connection> {
    const room = this.rooms.get(code) ?? this.createWithCode(code)
    room.touchedAt = Date.now()

    if (token) {
      const index = room.seats.findIndex((seat) => seat?.token === token)
      if (index !== -1) {
        const seat = room.seats[index]!
        // One seat, one live device. Reopening the game on a second tab takes
        // the seat over rather than leaving a ghost connected to nothing.
        const displaced = seat.connection && seat.connection !== connection ? seat.connection : undefined
        seat.connection = connection
        seat.freeSince = null
        return { ok: true, room, player: index as PlayerIndex, token, displaced }
      }
    }

    const free = room.seats.findIndex((seat) => seat === null || this.abandoned(seat))
    if (free === -1) return { ok: false, message: 'That room already has two players.' }

    // A reclaimed seat gets a new token, so the old device cannot wander back
    // in and find itself sharing a seat with someone else.
    const seat: Seat<Connection> = { token: randomUUID(), connection, freeSince: null }
    room.seats[free] = seat
    return { ok: true, room, player: free as PlayerIndex, token: seat.token }
  }

  /** Keeps the seat and its token, so the same device can come back to it. */
  leave(room: Room<Connection>, connection: Connection): void {
    for (const seat of room.seats) {
      if (seat?.connection === connection) {
        seat.connection = null
        seat.freeSince = Date.now()
      }
    }
    room.touchedAt = Date.now()
  }

  private abandoned(seat: Seat<Connection>): boolean {
    return seat.connection === null && seat.freeSince !== null && Date.now() - seat.freeSince > this.seatGraceMs
  }

  guess(room: Room<Connection>, player: PlayerIndex, code: CountryCode): { ok: true } | { ok: false; message: string } {
    const check = checkMove(room.game, code)
    if (!check.ok) return { ok: false, message: check.message }

    room.game = applyMove(room.game, check.code, player)
    room.touchedAt = Date.now()
    return { ok: true }
  }

  restart(room: Room<Connection>): void {
    room.game = startGame()
    room.touchedAt = Date.now()
  }

  private createWithCode(code: RoomCode): Room<Connection> {
    const room: Room<Connection> = { code, game: startGame(), seats: [null, null], touchedAt: Date.now() }
    this.rooms.set(code, room)
    return room
  }

  private sweep(): void {
    const cutoff = Date.now() - ROOM_LIFETIME_MS
    for (const [code, room] of this.rooms) {
      const connected = room.seats.some((seat) => seat?.connection)
      if (!connected && room.touchedAt < cutoff) this.rooms.delete(code)
    }
  }

  get size(): number {
    return this.rooms.size
  }

  stop(): void {
    clearInterval(this.sweeper)
  }
}
