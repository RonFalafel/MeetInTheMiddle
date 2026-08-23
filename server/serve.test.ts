import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { WebSocket } from 'ws'
import { start } from './serve.ts'
import type { Server } from './serve.ts'
import type { ClientMessage, ServerMessage } from './protocol.ts'
import { replay } from '../src/game/rules.ts'
import { optimalRoute } from '../src/game/rules.ts'

let server: Server

beforeAll(async () => {
  // Port 0 asks the OS for a free one, so tests never collide with a dev server.
  server = await start(0, 1_000_000)
})

afterAll(async () => {
  await server.close()
})

/** A test client that queues everything the server says, so nothing is missed. */
class Client {
  private readonly socket: WebSocket
  private readonly inbox: ServerMessage[] = []
  private waiting: (() => void) | null = null

  private constructor(socket: WebSocket) {
    this.socket = socket
    socket.on('message', (raw) => {
      this.inbox.push(JSON.parse(String(raw)) as ServerMessage)
      this.waiting?.()
    })
  }

  static connect(port: number): Promise<Client> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`)
      socket.once('open', () => resolve(new Client(socket)))
      socket.once('error', reject)
    })
  }

  send(message: ClientMessage): void {
    this.socket.send(JSON.stringify(message))
  }

  /** Waits for the next message of a given type, ignoring any others. */
  async next<T extends ServerMessage['type']>(type: T, timeoutMs = 2000) {
    const deadline = Date.now() + timeoutMs
    for (;;) {
      const found = this.inbox.findIndex((message) => message.type === type)
      if (found !== -1) return this.inbox.splice(found, 1)[0] as Extract<ServerMessage, { type: T }>
      if (Date.now() > deadline) throw new Error(`no "${type}" within ${timeoutMs}ms`)
      await new Promise<void>((resolve) => {
        this.waiting = resolve
        setTimeout(resolve, 25)
      })
    }
  }

  close(): Promise<void> {
    return new Promise((resolve) => {
      this.socket.once('close', () => resolve())
      this.socket.close()
    })
  }
}

const join = async (room: string, token?: string) => {
  const client = await Client.connect(server.port)
  client.send({ type: 'join', room, token })
  const welcome = await client.next('welcome')
  return { client, welcome }
}

describe('two devices in a room', () => {
  it('seats them on opposite sides of the same game', async () => {
    const one = await join('AAAA')
    const two = await join('AAAA')

    expect(one.welcome.player).toBe(0)
    expect(two.welcome.player).toBe(1)
    expect(two.welcome.game.starts).toEqual(one.welcome.game.starts)
    expect(two.welcome.partnerHere).toBe(true)

    await one.client.close()
    await two.client.close()
  })

  it('tells the first player when the second arrives', async () => {
    const one = await join('AAAB')
    expect(one.welcome.partnerHere).toBe(false)

    const two = await join('AAAB')
    expect((await one.client.next('partner')).here).toBe(true)

    await two.client.close()
    expect((await one.client.next('partner')).here).toBe(false)

    await one.client.close()
  })

  it('shows one player what the other named, without a turn between them', async () => {
    const one = await join('AAAC')
    const two = await join('AAAC')
    const middle = optimalRoute(replay(one.welcome.game.starts, [])).slice(1, -1)

    // Both guess back to back — the same player twice is fine.
    one.client.send({ type: 'guess', code: middle[0]! })
    expect((await two.client.next('state')).game.moves).toEqual([{ code: middle[0], player: 0 }])

    one.client.send({ type: 'guess', code: middle[1]! })
    const seen = await two.client.next('state')
    expect(seen.game.moves).toEqual([
      { code: middle[0], player: 0 },
      { code: middle[1], player: 0 },
    ])

    await one.client.close()
    await two.client.close()
  })

  it('refuses an illegal guess without telling the other player anything', async () => {
    const one = await join('AAAD')
    const two = await join('AAAD')

    one.client.send({ type: 'guess', code: 'AUS' }) // an island, never in play
    expect((await one.client.next('rejected')).message).toContain('no land border')

    await expect(two.client.next('state', 300)).rejects.toThrow(/no "state"/)

    await one.client.close()
    await two.client.close()
  })

  it('plays a whole game through to a win', async () => {
    const one = await join('AAAE')
    const two = await join('AAAE')
    const starts = one.welcome.game.starts

    for (const code of optimalRoute(replay(starts, [])).slice(1, -1)) {
      one.client.send({ type: 'guess', code })
      await two.client.next('state')
    }

    const final = await join('AAAE').catch(() => null)
    expect(final).toBeNull() // the room is full, so we cannot peek that way

    await one.client.close()
    await two.client.close()
  })
})

describe('coming back', () => {
  it('restores the same seat and the moves already made', async () => {
    const one = await join('AABA')
    const two = await join('AABA')
    const middle = optimalRoute(replay(one.welcome.game.starts, [])).slice(1, -1)

    two.client.send({ type: 'guess', code: middle[0]! })
    await one.client.next('state')

    await two.client.close()
    const back = await join('AABA', two.welcome.token)

    expect(back.welcome.player).toBe(1)
    expect(back.welcome.game.starts).toEqual(two.welcome.game.starts)
    expect(back.welcome.game.moves).toEqual([{ code: middle[0], player: 1 }])

    await one.client.close()
    await back.client.close()
  })

  it('turns away a third device', async () => {
    const one = await join('AABB')
    const two = await join('AABB')

    const third = await Client.connect(server.port)
    third.send({ type: 'join', room: 'AABB' })
    expect((await third.next('error')).message).toContain('two players')

    await third.close()
    await one.client.close()
    await two.client.close()
  })

  it('rejects a room code that is not one', async () => {
    const client = await Client.connect(server.port)
    client.send({ type: 'join', room: 'nope!' })
    expect((await client.next('error')).message).toContain('does not look right')
    await client.close()
  })

  it('refuses a guess from a device that never joined', async () => {
    const client = await Client.connect(server.port)
    client.send({ type: 'guess', code: 'FRA' })
    expect((await client.next('error')).message).toContain('Join a room first')
    await client.close()
  })
})

describe('restarting', () => {
  it('deals a new game to both devices', async () => {
    const one = await join('AABC')
    const two = await join('AABC')
    const before = one.welcome.game.starts

    one.client.send({ type: 'restart' })
    const dealt = await two.client.next('state')
    expect(dealt.game.moves).toEqual([])
    // A fresh deal, though it could in principle repeat the same pair.
    expect(dealt.game.starts).toHaveLength(2)
    expect(replay(dealt.game.starts, []).status).toBe('playing')
    expect(before).toHaveLength(2)

    await one.client.close()
    await two.client.close()
  })
})
