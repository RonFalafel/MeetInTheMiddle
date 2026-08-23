import { useCallback, useEffect, useRef, useState } from 'react'
import { replay } from '../game/rules.ts'
import type { GameState, PlayerIndex } from '../game/rules.ts'
import type { CountryCode } from '../game/types.ts'
import type { ClientMessage, ServerMessage } from '../../server/protocol.ts'
import type { Session } from './session.ts'

const RECONNECT_DELAY_MS = 1500

const socketUrl = () =>
  `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`

/** The seat token is per room, so two rooms in two tabs do not fight over one. */
const tokenKey = (room: string) => `mitm:seat:${room}`

/**
 * A game that lives on the server. The browser never decides anything: it
 * sends guesses and redraws whatever comes back, which is what keeps two
 * phones from disagreeing.
 */
export function useRoom(room: string | null): Session {
  const [game, setGame] = useState<GameState | null>(null)
  const [me, setMe] = useState<PlayerIndex>(0)
  const [connection, setConnection] = useState<Session['connection']>('connecting')
  const [partnerHere, setPartnerHere] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const socket = useRef<WebSocket | null>(null)
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Set when the server refuses us outright, so we stop trying to get back in.
  const rejected = useRef(false)

  const post = useCallback((message: ClientMessage) => {
    const live = socket.current
    if (live?.readyState === WebSocket.OPEN) live.send(JSON.stringify(message))
  }, [])

  useEffect(() => {
    if (!room) return
    rejected.current = false
    let closed = false

    const connect = () => {
      if (closed || rejected.current) return
      setConnection((current) => (current === 'live' ? 'live' : 'connecting'))

      const live = new WebSocket(socketUrl())
      socket.current = live

      live.addEventListener('open', () => {
        const token = localStorage.getItem(tokenKey(room)) ?? undefined
        live.send(JSON.stringify({ type: 'join', room, token } satisfies ClientMessage))
      })

      live.addEventListener('message', (event) => {
        let message: ServerMessage
        try {
          message = JSON.parse(String(event.data)) as ServerMessage
        } catch {
          return
        }

        switch (message.type) {
          case 'welcome':
            localStorage.setItem(tokenKey(room), message.token)
            setMe(message.player)
            setPartnerHere(message.partnerHere)
            setGame(replay(message.game.starts, message.game.moves))
            setConnection('live')
            setNotice(null)
            break
          case 'state':
            setGame(replay(message.game.starts, message.game.moves))
            break
          case 'partner':
            setPartnerHere(message.here)
            break
          case 'rejected':
            setNotice(message.message)
            break
          case 'error':
            rejected.current = true
            setNotice(message.message)
            setConnection('dropped')
            break
        }
      })

      live.addEventListener('close', () => {
        if (closed || rejected.current) return
        setConnection('dropped')
        retry.current = setTimeout(connect, RECONNECT_DELAY_MS)
      })

      // 'close' always follows, so reconnection is handled in one place.
      live.addEventListener('error', () => live.close())
    }

    connect()

    return () => {
      closed = true
      if (retry.current) clearTimeout(retry.current)
      socket.current?.close()
      socket.current = null
    }
  }, [room])

  const guess = useCallback(
    (code: CountryCode) => {
      setNotice(null)
      post({ type: 'guess', code })
    },
    [post],
  )

  const restart = useCallback(() => post({ type: 'restart' }), [post])

  return {
    game,
    me,
    setMe: null,
    guess,
    restart,
    connection,
    roomCode: room,
    partnerHere,
    notice,
  }
}
