import { format } from '../game/languages.ts'
import type { Strings } from '../game/languages.ts'
import type { Rejection } from '../game/rules.ts'
import type { ErrorCode } from '../../server/protocol.ts'
import type { CountryCode } from '../game/types.ts'

/**
 * Turns a refusal into a sentence in the reader's language.
 *
 * The rules and the server both hand back a reason and a country code rather
 * than prose, precisely so this can happen here — the two players may not be
 * reading the game in the same language.
 */
export function describeRejection(
  rejection: Rejection,
  t: Strings,
  name: (code: CountryCode) => string,
): string {
  const country = rejection.country ? name(rejection.country) : ''

  switch (rejection.reason) {
    case 'unknown-country':
      return format(t.rejectUnknown, { text: rejection.text ?? '' })
    case 'out-of-play':
      return format(t.rejectOutOfPlay, { country })
    case 'wrong-landmass':
      return format(t.rejectWrongLandmass, { country })
    case 'already-named':
      return format(t.rejectAlreadyNamed, { country })
    case 'wrong-continent':
      return format(t.rejectWrongContinent, { country })
    case 'game-over':
      return t.rejectGameOver
  }
}

export function describeError(error: ErrorCode, t: Strings): string {
  switch (error) {
    case 'bad-room':
      return t.errBadRoom
    case 'room-full':
      return t.errRoomFull
    case 'taken-over':
      return t.errTakenOver
    default:
      return t.errGeneric
  }
}
