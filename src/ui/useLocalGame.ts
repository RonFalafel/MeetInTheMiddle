import { useCallback, useState } from 'react'
import { SETTINGS } from '../settings.ts'
import { applyMove, deal, repeatOf, reveal } from '../game/rules.ts'
import type { GameRequest, GameState, PlayerIndex } from '../game/rules.ts'
import type { CountryCode } from '../game/types.ts'
import type { Session } from './session.ts'

const start = (request?: GameRequest): GameState =>
  deal(request, { minHops: SETTINGS.minHops, maxHops: SETTINGS.maxHops })

/**
 * One device, one board. Both players share it, so which side a guess counts
 * for is a choice rather than something the network decides.
 */
export function useLocalGame(initial?: GameRequest): Session {
  const [game, setGame] = useState<GameState>(() => start(initial))
  const [me, setMe] = useState<PlayerIndex>(0)

  const guess = useCallback(
    (code: CountryCode) => {
      setGame((current) => applyMove(current, code, me))
    },
    [me],
  )

  const restart = useCallback((request?: GameRequest) => {
    // "Again" on a continent game means the same continent; on Meet in the
    // Middle it means a new pair of starts.
    setGame((current) => start(request ?? repeatOf(current)))
  }, [])

  const revealRest = useCallback(() => {
    setGame((current) => (current.mode === 'meet' ? current : reveal(current)))
  }, [])

  return {
    game,
    me,
    setMe,
    guess,
    restart,
    reveal: revealRest,
    connection: 'local',
    roomCode: null,
    partnerHere: true,
    notice: null,
  }
}
