# travle-duo

Two-player cooperative geography game. Game design lives in `SPEC.md` — read it
before implementing anything gameplay-related.

## Stack

- Vite + React + TypeScript
- `d3-geo` + `topojson-client` for projection and map rendering
- `world-atlas` (110m TopoJSON) as the country dataset
- `vitest` for tests
- No backend in v1. No router. No state library — `useReducer` is enough.

## Rules

- **Ask before adding a dependency.** Every new package needs a one-line
  justification and my approval first. The default answer is no.
- **No backend, no auth, no accounts** until `SPEC.md` says v2.
- Game logic goes in `src/game/` as pure functions with no React imports.
  Rendering goes in `src/ui/`. This split is not negotiable — the whole test
  strategy depends on the graph and rules layer being pure.
- TypeScript strict mode. No `any`. No `@ts-ignore`.
- Prefer editing an existing file over creating a new one.
- Don't write comments that restate the code. Comment only non-obvious
  geography edge cases (enclaves, sea links, disputed borders).

## Verification

Run these before telling me something works:

```bash
npm run test        # vitest
npx tsc --noEmit    # type check
npm run build       # catches import errors vitest misses
```

The country graph is pure data, so it is fully testable — write tests for graph
changes rather than asking me to click around. Invariants that must hold:

- adjacency is symmetric: if A borders B, B borders A
- no country is adjacent to itself
- every country in the playable set is reachable from every other
- island nations reachable only through the manual sea-link table
- the sea-link table is symmetric and references only valid country codes

Anything visual, I check myself. Say what you changed and what to look at.

## Working style

- For anything non-trivial, propose a plan and wait. Don't start editing.
- One task at a time. Finish it, get it green, stop.
- If something is ambiguous, ask instead of guessing. A wrong assumption
  implemented across six files is far more expensive than a question.
- If you get an approach wrong twice, stop and say so rather than trying a
  third variation.

## Country data notes

- Use ISO 3166-1 alpha-3 codes as the internal country key everywhere.
- Land adjacency is derived from shared arcs in the TopoJSON topology, not
  hand-written. Regenerate it with a script, don't edit the output by hand.
- Sea links (Spain–Morocco, Italy–Greece, Indonesia–Malaysia, etc.) are a
  hand-maintained table in `src/game/seaLinks.ts`. Additions need a comment
  saying why that crossing counts.
- Excluded from play: Antarctica, uninhabited territories, and any country
  with no land or sea link. Keep the exclusion list explicit and commented.
