/**
 * The sync server for two-device games.
 *
 * It holds rooms in memory and is authoritative about the rules — it imports
 * the same `src/game/rules.ts` the browser does, so a client cannot talk its
 * way into an illegal move. Nginx puts it behind /ws on the same origin, which
 * is why there is no CORS handling here.
 */

import { createServer } from 'node:http'
import { WebSocketServer } from 'ws'
import type { WebSocket } from 'ws'
import { Rooms, snapshot } from './rooms.ts'
import type { Room } from './rooms.ts'
import { normaliseRoomCode } from './protocol.ts'
import type { ClientMessage, ServerMessage } from './protocol.ts'
import type { PlayerIndex } from '../src/game/rules.ts'

const HEARTBEAT_MS = 30_000

export type Server = {
  readonly port: number
  close: () => Promise<void>
}

type Attachment = {
  room: Room<WebSocket>
  player: PlayerIndex
  alive: boolean
}

export function start(port: number, heartbeatMs = HEARTBEAT_MS): Promise<Server> {
  const rooms = new Rooms<WebSocket>()
  const attachments = new WeakMap<WebSocket, Attachment>()

  const send = (socket: WebSocket, message: ServerMessage) => {
    if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message))
  }

  const broadcast = (room: Room<WebSocket>, message: ServerMessage) => {
    for (const seat of room.seats) if (seat?.connection) send(seat.connection, message)
  }

  const announcePresence = (room: Room<WebSocket>) => {
    for (const [index, seat] of room.seats.entries()) {
      const partner = room.seats[index === 0 ? 1 : 0]
      if (seat?.connection) send(seat.connection, { type: 'partner', here: Boolean(partner?.connection) })
    }
  }

  const http = createServer((request, response) => {
    if (request.url === '/health') {
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ ok: true, rooms: rooms.size }))
      return
    }
    response.writeHead(404)
    response.end()
  })

  const sockets = new WebSocketServer({ server: http, path: '/ws' })

  const handle = (socket: WebSocket, message: ClientMessage): void => {
    if (message.type === 'join') {
      const code = normaliseRoomCode(message.room)
      if (!code) {
        send(socket, { type: 'error', error: 'bad-room' })
        return
      }

      const result = rooms.join(code, message.token, socket)
      if (!result.ok) {
        send(socket, { type: 'error', error: result.error })
        return
      }

      if (result.displaced) {
        send(result.displaced, { type: 'error', error: 'taken-over' })
        attachments.delete(result.displaced)
        result.displaced.close()
      }

      attachments.set(socket, { room: result.room, player: result.player, alive: true })
      const partner = result.room.seats[result.player === 0 ? 1 : 0]
      send(socket, {
        type: 'welcome',
        room: result.room.code,
        player: result.player,
        token: result.token,
        game: snapshot(result.room.game),
        partnerHere: Boolean(partner?.connection),
      })
      // Only the other seat needs telling — `welcome` already said who is here.
      if (partner?.connection) send(partner.connection, { type: 'partner', here: true })
      return
    }

    const attachment = attachments.get(socket)
    if (!attachment) {
      send(socket, { type: 'error', error: 'not-joined' })
      return
    }

    if (message.type === 'guess') {
      const result = rooms.guess(attachment.room, attachment.player, message.code)
      if (!result.ok) {
        send(socket, { type: 'rejected', rejection: result })
        return
      }
      broadcast(attachment.room, { type: 'state', game: snapshot(attachment.room.game) })
      return
    }

    if (message.type === 'restart') {
      rooms.restart(attachment.room)
      broadcast(attachment.room, { type: 'state', game: snapshot(attachment.room.game) })
    }
  }

  sockets.on('connection', (socket) => {
    socket.on('pong', () => {
      const attachment = attachments.get(socket)
      if (attachment) attachment.alive = true
    })

    socket.on('message', (raw) => {
      let message: ClientMessage
      try {
        message = JSON.parse(String(raw)) as ClientMessage
      } catch {
        send(socket, { type: 'error', error: 'bad-message' })
        return
      }
      handle(socket, message)
    })

    socket.on('close', () => {
      const attachment = attachments.get(socket)
      if (!attachment) return
      rooms.leave(attachment.room, socket)
      attachments.delete(socket)
      announcePresence(attachment.room)
    })
  })

  /** Drops sockets that stopped answering, so a locked phone frees its presence. */
  const heartbeat = setInterval(() => {
    for (const socket of sockets.clients) {
      const attachment = attachments.get(socket)
      if (attachment && !attachment.alive) {
        socket.terminate()
        continue
      }
      if (attachment) attachment.alive = false
      socket.ping()
    }
  }, heartbeatMs)
  heartbeat.unref?.()

  return new Promise((resolve) => {
    http.listen(port, () => {
      const address = http.address()
      resolve({
        port: typeof address === 'object' && address ? address.port : port,
        close: () =>
          new Promise((done) => {
            clearInterval(heartbeat)
            rooms.stop()
            for (const socket of sockets.clients) socket.terminate()
            sockets.close(() => http.close(() => done()))
          }),
      })
    })
  })
}
