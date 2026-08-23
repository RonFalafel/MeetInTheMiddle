import { describe, expect, it } from 'vitest'
import { Rooms } from './rooms.ts'
import { makeRoomCode, normaliseRoomCode } from './protocol.ts'
import { optimalRoute } from '../src/game/rules.ts'

/** Stand-in for a socket — rooms only ever compare these by identity. */
const socket = (name: string) => ({ name })

const seatIn = (rooms: Rooms<object>, code: string, connection: object, token?: string) => {
  const result = rooms.join(code, token, connection)
  if (!result.ok) throw new Error(result.message)
  return result
}

describe('room codes', () => {
  it('are four characters with nothing ambiguous in them', () => {
    for (let i = 0; i < 200; i++) {
      const code = makeRoomCode()
      expect(code).toMatch(/^[A-Z0-9]{4}$/)
      expect(code).not.toMatch(/[OI015S]/)
    }
  })

  it('forgive how a person actually types them', () => {
    expect(normaliseRoomCode('abcd')).toBe('ABCD')
    expect(normaliseRoomCode(' ab-cd ')).toBe('ABCD')
  })

  it('reject anything that is not a code', () => {
    expect(normaliseRoomCode('ABC')).toBeNull()
    expect(normaliseRoomCode('ABCDE')).toBeNull()
    expect(normaliseRoomCode('AB0D')).toBeNull() // 0 is not in the alphabet
  })
})

describe('seating', () => {
  it('gives the first two devices a seat each', () => {
    const rooms = new Rooms<object>()
    const first = seatIn(rooms, 'ABCD', socket('a'))
    const second = seatIn(rooms, 'ABCD', socket('b'))
    expect(first.player).toBe(0)
    expect(second.player).toBe(1)
    expect(first.token).not.toBe(second.token)
    rooms.stop()
  })

  it('turns away a third device', () => {
    const rooms = new Rooms<object>()
    seatIn(rooms, 'ABCD', socket('a'))
    seatIn(rooms, 'ABCD', socket('b'))
    expect(rooms.join('ABCD', undefined, socket('c'))).toMatchObject({ ok: false })
    rooms.stop()
  })

  it('creates the room on first join, so neither player has to go first', () => {
    const rooms = new Rooms<object>()
    expect(rooms.get('ABCD')).toBeUndefined()
    seatIn(rooms, 'ABCD', socket('a'))
    expect(rooms.get('ABCD')).toBeDefined()
    rooms.stop()
  })
})

describe('coming back after a dropped connection', () => {
  it('returns the same seat to a device holding its token', () => {
    const rooms = new Rooms<object>()
    const first = seatIn(rooms, 'ABCD', socket('a'))
    const room = rooms.get('ABCD')!

    rooms.leave(room, room.seats[0]!.connection!)
    expect(room.seats[0]!.connection).toBeNull()
    expect(room.seats[0]!.token).toBe(first.token)

    const again = seatIn(rooms, 'ABCD', socket('a2'), first.token)
    expect(again.player).toBe(0)
    expect(again.token).toBe(first.token)
    rooms.stop()
  })

  it('evicts the old device when a seat is reclaimed while still connected', () => {
    const rooms = new Rooms<object>()
    const phone = socket('phone')
    const first = seatIn(rooms, 'ABCD', phone)

    const laptop = socket('laptop')
    const again = rooms.join('ABCD', first.token, laptop)
    expect(again).toMatchObject({ ok: true, player: 0, displaced: phone })
    expect(rooms.get('ABCD')!.seats[0]!.connection).toBe(laptop)
    rooms.stop()
  })

  it('does not report a displaced device when the seat was already free', () => {
    const rooms = new Rooms<object>()
    const first = seatIn(rooms, 'ABCD', socket('a'))
    const room = rooms.get('ABCD')!
    rooms.leave(room, room.seats[0]!.connection!)

    expect(seatIn(rooms, 'ABCD', socket('a2'), first.token).displaced).toBeUndefined()
    rooms.stop()
  })

  it('lets a stranger take a seat nobody has come back to', async () => {
    // Losing the token — a new phone, cleared browser data — must not brick
    // the room, so the seat opens up once the grace period passes.
    const rooms = new Rooms<object>({ seatGraceMs: 5 })
    seatIn(rooms, 'ABCD', socket('a'))
    seatIn(rooms, 'ABCD', socket('b'))
    const room = rooms.get('ABCD')!

    rooms.leave(room, room.seats[0]!.connection!)
    expect(rooms.join('ABCD', undefined, socket('c'))).toMatchObject({ ok: false })

    await new Promise((resolve) => setTimeout(resolve, 20))
    const stranger = seatIn(rooms, 'ABCD', socket('c'))
    expect(stranger.player).toBe(0)
    rooms.stop()
  })

  it('retires the token of a seat that was taken over', async () => {
    const rooms = new Rooms<object>({ seatGraceMs: 5 })
    const first = seatIn(rooms, 'ABCD', socket('a'))
    const room = rooms.get('ABCD')!
    rooms.leave(room, room.seats[0]!.connection!)

    await new Promise((resolve) => setTimeout(resolve, 20))
    const stranger = seatIn(rooms, 'ABCD', socket('c'))
    expect(stranger.token).not.toBe(first.token)

    // The original device is now just another newcomer, and takes the free seat.
    expect(seatIn(rooms, 'ABCD', socket('a2'), first.token).player).toBe(1)
    rooms.stop()
  })

  it('does not hand a vacated seat to a stranger', () => {
    const rooms = new Rooms<object>()
    const first = seatIn(rooms, 'ABCD', socket('a'))
    seatIn(rooms, 'ABCD', socket('b'))
    const room = rooms.get('ABCD')!
    rooms.leave(room, room.seats[0]!.connection!)

    // The room is full even though one player is away: the seat is still theirs.
    expect(rooms.join('ABCD', undefined, socket('c'))).toMatchObject({ ok: false })
    expect(seatIn(rooms, 'ABCD', socket('a2'), first.token).player).toBe(0)
    rooms.stop()
  })

  it('keeps the game going while a player is away', () => {
    const rooms = new Rooms<object>()
    seatIn(rooms, 'ABCD', socket('a'))
    seatIn(rooms, 'ABCD', socket('b'))
    const room = rooms.get('ABCD')!
    const middle = optimalRoute(room.game).slice(1, -1)

    rooms.leave(room, room.seats[1]!.connection!)
    expect(rooms.guess(room, 0, middle[0]!)).toEqual({ ok: true })
    expect(room.game.moves).toHaveLength(1)
    rooms.stop()
  })
})

describe('guessing through a room', () => {
  it('applies a legal country and attributes it to the player', () => {
    const rooms = new Rooms<object>()
    seatIn(rooms, 'ABCD', socket('a'))
    const room = rooms.get('ABCD')!
    const middle = optimalRoute(room.game).slice(1, -1)

    expect(rooms.guess(room, 1, middle[0]!)).toEqual({ ok: true })
    expect(room.game.moves[0]).toEqual({ code: middle[0], player: 1 })
    rooms.stop()
  })

  it('refuses a country the rules reject, and leaves the board alone', () => {
    const rooms = new Rooms<object>()
    seatIn(rooms, 'ABCD', socket('a'))
    const room = rooms.get('ABCD')!

    const result = rooms.guess(room, 0, 'NOWHERE')
    expect(result).toMatchObject({ ok: false })
    expect(room.game.moves).toHaveLength(0)
    rooms.stop()
  })

  it('refuses the same country twice', () => {
    const rooms = new Rooms<object>()
    seatIn(rooms, 'ABCD', socket('a'))
    const room = rooms.get('ABCD')!
    const middle = optimalRoute(room.game).slice(1, -1)

    expect(rooms.guess(room, 0, middle[0]!)).toEqual({ ok: true })
    expect(rooms.guess(room, 1, middle[0]!)).toMatchObject({ ok: false })
    expect(room.game.moves).toHaveLength(1)
    rooms.stop()
  })

  it('reaches a win through the room, not just in the rules', () => {
    const rooms = new Rooms<object>()
    seatIn(rooms, 'ABCD', socket('a'))
    const room = rooms.get('ABCD')!
    for (const code of optimalRoute(room.game).slice(1, -1)) {
      expect(rooms.guess(room, 0, code)).toEqual({ ok: true })
    }
    expect(room.game.status).toBe('won')
    rooms.stop()
  })

  it('deals a fresh game on restart, keeping the seats', () => {
    const rooms = new Rooms<object>()
    const first = seatIn(rooms, 'ABCD', socket('a'))
    const room = rooms.get('ABCD')!
    rooms.guess(room, 0, optimalRoute(room.game)[1]!)

    rooms.restart(room)
    expect(room.game.moves).toHaveLength(0)
    expect(room.seats[0]!.token).toBe(first.token)
    rooms.stop()
  })
})
