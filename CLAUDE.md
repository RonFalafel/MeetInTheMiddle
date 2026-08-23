# Meet in the Middle

Two-player cooperative geography game. Game design is in `Specs/SPEC.md`; how
the data pipeline fits together is in `README.md`. Read both before changing
anything about countries or rules.

## Stack

Vite + React + TypeScript, `d3-geo` and `topojson-client` for the map,
`world-atlas` 50m for the country shapes, vitest for tests. No backend, no
router, no state library — `useState` is enough for a hotseat game.

## Shape of the code

- `src/game/` — pure functions, no React imports. The graph, the rules, and the
  three hand-curated tables (`playSet.ts`, `seaLinks.ts`, `names.ts`).
- `src/game/data/countries.generated.ts` — generated. Never edit it; change a
  curation table and run `npm run graph`.
- `src/ui/` — rendering.
- `scripts/` — the graph generator and the terminal game runner.

The pure/rendering split is what makes the game testable without a browser.
Keep it.

## Verifying

```bash
npm test
npm run typecheck
npm run build
```

The country graph is data, so test it rather than asking to click around. The
generator already enforces symmetry, no self-borders, and connectivity, and
fails the build with the list of stranded countries — but a geography change
that survives those checks can still be wrong, so add a case to
`graph.test.ts`. Anything visual, say what changed and what to look at.

## Conventions

- Imports use explicit `.ts`/`.tsx` extensions; Node runs the scripts directly
  with type stripping, so no build step for `scripts/`.
- `erasableSyntaxOnly` is on: no enums, no parameter properties, no namespaces.
- Comment the geography, not the code. An enclave, a merged territory, or a sea
  crossing deserves a line saying why; a `for` loop does not.
