# Meet in the Middle — game spec

A cooperative geography game for two people, built to be played from two phones
in the same room, out loud.

This describes the game **as it is**, not as it was first imagined. When the
built game and this file disagree, the game is right and this file is stale —
fix it. The reasoning behind each rule is in [DECISIONS.md](DECISIONS.md).

## Core loop

1. Each player is given a different secret start country. Both starts are
   always on the same landmass.
2. Either player, at any time, names any country. There are no turns and no
   adjacency requirement.
3. Every named country goes on the shared board, coloured by who named it.
4. The game ends when the named countries form an unbroken chain of land
   borders from one start to the other.
5. Score is the total number of countries named. Lower is better. Par is one
   fewer than the number of borders between the two starts.

The tension: you don't know where your partner started, so early guesses are a
bet on where they might be coming from. The **still needed** counter — the
shortest number of countries that would still complete the chain — is the only
signal you get, and it is what makes a distant guess worth trying.

A guess that joins nothing up is perfectly legal and still costs a point. A
guess that is refused costs nothing.

## Rejections

Refusals are free and always explain themselves:

| Reason | When |
| --- | --- |
| `unknown-country` | Not a country the game knows, in any language |
| `out-of-play` | An island with no land route anywhere — Australia, Japan, Cuba |
| `wrong-landmass` | A real country, but it could never connect to your start |
| `already-named` | Already on the board, whoever put it there |
| `game-over` | You already met |

These are returned as a reason plus a country code, never as English prose, so
each device can render them in its own language.

## Borders

Only land borders count. Bridges and tunnels you can drive across count as
land; ferries and open water do not.

The consequence is that the world is not one connected graph. There are two
playable landmasses:

| | countries |
| --- | --- |
| Afro-Eurasia | 135 |
| The Americas | 22 |
| Out of play — no land route anywhere | 39 |

Islands still draw on the map, greyed out. They can never be a start, are never
suggested, and are refused with a reason. Both starts always come from the same
landmass, so a game can never be unwinnable — the generator refuses to build a
world where that is possible.

## Languages

Ten: English, Hebrew, Arabic, Spanish, French, German, Italian, Dutch,
Portuguese, Russian. Hebrew and Arabic lay the page out right to left.

Country names come from CLDR at build time. Interface text is hand-written in
`src/game/languages.ts`.

**Guess matching ignores the chosen language.** Two people reading the game in
different languages share one board, and neither should be told their own word
for Germany is wrong.

## Data model

```ts
type CountryCode = string // ISO 3166-1 alpha-3, or X-prefixed where ISO has none

type Move = { code: CountryCode; player: 0 | 1 }

type GameState = {
  starts: readonly [CountryCode, CountryCode]
  moves: readonly Move[]
  status: 'playing' | 'won'
  optimalDistance: number // borders between the two starts
}
```

Everything else is derived. A game is a start pair plus a move list, which is
what makes it trivially serialisable — two devices stay in sync by agreeing on
that and nothing else, and a reconnecting phone catches up by replaying it.

## Two devices

A four-character room code, carried in the URL so it can be shared as a link.
Rooms live in memory on the sync server, hold two seats, and expire after six
hours. The server is authoritative and imports the same rules module the
browser does.

A device keeps its seat through a token in `localStorage` and reclaims it on
reconnect. A seat nobody returns to opens up after a minute, so a lost token
cannot permanently brick a room.

## Still undecided — resolve by playing

- **Do you see your partner's countries?** Visible today. Hidden makes it a
  real deduction game. `SETTINGS.showPartnerCountries`.
- **Should the still-needed counter exist?** It is a strong hint, and without
  it a far-flung guess is pure blind luck. `SETTINGS.showCountriesNeeded`.
- **Start distance.** 5 to 9 borders apart today.
- **Should a useless guess cost anything?** It costs one point today, the same
  as a useful one.
- **Ferries.** All disabled. `src/game/seaLinks.ts` has them grouped and
  commented out; uncommenting `NARROW_STRAITS` alone would put Japan, Sri Lanka
  and the Bering Strait back and reconnect the Americas to Eurasia.

## Not built, and not obviously wanted

Accounts, persistence beyond a room's six hours, leaderboards, dailies, seeds,
sound, more than two players.
