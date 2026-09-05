# Meet in the Middle

Two-player cooperative geography game, played from two phones at once.

- `README.md` — how to run it, how the data pipeline works, how to deploy.
- `Specs/SPEC.md` — the game as it currently is. Keep it current: if a rule
  changes, change it there in the same commit.
- `Specs/DECISIONS.md` — why it is that way, in date order. Add an entry when a
  decision is worth not re-litigating later, and amend the old entry rather
  than contradicting it silently.

## Stack

Vite + React + TypeScript, `d3-geo` and `topojson-client` for the map,
`world-atlas` 50m for the shapes, `ws` for the sync server, vitest for tests.
No router, no state library, no database.

## Shape of the code

- `src/game/` — pure functions, no React and no Node imports. The graph, the
  rules, the language tables, and the hand-curated data tables (`playSet.ts`,
  `seaLinks.ts`, `names.ts`, `continents.ts`).
- `GameState` is a union over three modes. Anything mode-specific narrows on
  `game.mode` rather than taking optional fields; `applyMove` is generic so a
  caller holding a `MeetGame` still has one afterwards.
- `src/game/data/*.generated.ts` — generated. Never edit them; change a curation
  table and run `npm run graph`.
- `src/ui/` — rendering. `useLocalGame` and `useRoom` both return the same
  `Session`, so the screen never knows whether the game is local or networked.
- `server/` — rooms and the WebSocket protocol. Imports `src/game/rules.ts`
  directly and is authoritative; never duplicate a rule here.
- `scripts/` — the graph generator and the terminal game runner.

The purity of `src/game/` is what lets the same rules run in the browser, in
the server and in `npm run play`. Keep it.

## Verifying

```bash
npm test
npm run typecheck
npm run build
```

`npm test` covers the country graph, the rules and the room protocol end to end
over real WebSockets. The graph is data, so test it rather than asking to click
around — the generator already enforces symmetry, no self-borders, landmass
connectivity and that every playable landmass can host a game, but a geography
change that survives those can still be wrong, so add a case to `graph.test.ts`.

Anything visual, say what changed and what to look at. Two-device behaviour is
testable without a browser — see `server/serve.test.ts`.

## Conventions

- Imports use explicit `.ts`/`.tsx` extensions; Node runs the scripts and the
  server directly with type stripping, so neither has a build step.
- `erasableSyntaxOnly` is on: no enums, no parameter properties, no namespaces.
- The wire format is whole game state, never deltas. A game is a start pair and
  a move list, so resending everything is cheap and makes a dropped message
  self-healing.
- Comment the geography and the protocol decisions, not the code. A merged
  territory, a sea crossing or a seat-reclaim rule deserves a line saying why;
  a `for` loop does not.
- Player-facing text is never built in `src/game/rules.ts` or `server/`. Both
  return a reason and a country code; only `src/ui/` turns that into a
  sentence, because the two players may be reading different languages.
- Adding a language: a row in `LANGUAGES`, its `Strings` block, then
  `npm run graph`. Country names come from CLDR, so only the interface text is
  hand-written.
- A `GameRequest` is what the lobby asks for; a `Setup` is what was dealt and is
  what travels on the wire. Do not merge them — a request may leave the start
  pair open, a setup never may, or a reconnecting phone rejoins a different game.
