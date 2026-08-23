import { useCallback, useState } from 'react'
import { SETTINGS } from '../settings.ts'
import { applyMove, newGame } from '../game/rules.ts'
import type { GameState, PlayerIndex } from '../game/rules.ts'
import type { CountryCode } from '../game/types.ts'
import type { Session } from './session.ts'

const start = () => newGame({ minHops: SETTINGS.minHops, maxHops: SETTINGS.maxHops })

/**
 * One device, one board. Both players share it, so which side a guess counts
 * for is a choice rather than something the network decides.
 */
export function useLocalGame(): Session {
  const [game, setGame] = useState<GameState>(start)
  const [me, setMe] = useState<PlayerIndex>(0)

  const guess = useCallback((code: CountryCode) => {
    setGame((current) => applyMove(current, code, me))
  }, [me])

  const restart = useCallback(() => setGame(start()), [])

  return {
    game,
    me,
    setMe,
    guess,
    restart,
    connection: 'local',
    roomCode: null,
    partnerHere: true,
    notice: null,
  }
}
