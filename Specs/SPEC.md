# Meet in the Middle — game spec

A cooperative geography game for two people. Both players are trying to reach
each other across the world map by naming bordering countries.

## Core loop

1. Each player is given a different secret start country.
2. On each turn, both players name one country that borders their own current
   chain head. That country is appended to their chain.
3. The game ends when the two chains touch — either the players land on the
   same country, or their two chain heads border each other.
4. Score is the total number of countries named by both players combined.
   Lower is better.

The tension: you don't know where your partner started, so early moves are a
guess about where they're coming from. Late moves become a negotiation.

## Undecided — resolve by playing, not by arguing

These are deliberately open. Build the first one, play it, then change it.

- **Do you see your partner's chain?** Visible is friendlier and probably more
  fun for a couple; hidden is tenser and makes it a real deduction game.
  Build it visible first, but keep it behind a flag so it can be flipped.
- **Any communication allowed?** Sitting on a sofa, you'll talk regardless. The
  question is whether the game should lean into that or forbid it.
- **What happens on an invalid guess?** Free retry, or a scoring penalty.
- **Start distance.** Countries should be far enough apart to be interesting.
  Pick starts with a shortest path between 5 and 9 hops, tunable.

## v1 scope — hotseat, one device, no server

Everything runs locally in the browser. Two players share a phone or laptop and
pass it back and forth. This proves whether the game is fun before any sync
code exists.

- Random start pair each game (no dailies, no seeds, no calendar)
- Country autocomplete input
- World map with both chains drawn in different colours
- Move counter and an end-of-game summary
- The optimal solution revealed at the end, so you can see how you did
- State in memory only; a page refresh starts a new game

Explicitly NOT in v1: accounts, rooms, persistence, sharing, leaderboards,
sound, animation beyond a basic transition, difficulty settings.

## v2 — two devices

A room code pairs two phones. Each player sees the map and their own input;
guesses relay between them in real time.

- Single Cloudflare Worker with a Durable Object per room, or Supabase realtime
- Room state is just: two chains, two start countries, a move counter
- No accounts. Room codes expire after a few hours.
- Reconnect handling: rejoining with the same room code restores state

## Data model

```ts
type CountryCode = string; // ISO 3166-1 alpha-3

type Adjacency = Map<CountryCode, Set<CountryCode>>;

type Chain = {
  player: 0 | 1;
  countries: CountryCode[]; // index 0 is the secret start
};

type GameState = {
  chains: [Chain, Chain];
  turn: 0 | 1;
  status: "playing" | "won";
  optimalDistance: number; // shortest path between the two starts
};
```

## Build order

Each step should end green and committed before the next one starts.

1. **Graph.** Script that reads the TopoJSON, derives land adjacency from
   shared arcs, merges the sea-link table, writes a JSON artifact. Tests for
   all the invariants in `CLAUDE.md`. No UI at all yet.
2. **Rules.** Pure functions: `startPair(minHops, maxHops)`, `isLegalMove`,
   `applyMove`, `hasMet`, `shortestPath`. Fully unit tested. Still no UI.
3. **Headless game.** A script that plays a full game from a scripted list of
   moves and prints the result. This is the point where the game either works
   or doesn't, and it costs nothing to change.
4. **Map.** Render the world, colour the two chains, no interaction.
5. **Input.** Autocomplete, validation, turn handoff.
6. **Play it.** With a real second person. Change the rules based on what
   happened, not on what seemed sensible in step 2.

Steps 1–3 are where the leverage is: pure logic, fully verifiable without a
human looking at a screen. Don't skip ahead to the map because it's the fun
part.
