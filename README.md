# Meet in the Middle

A cooperative geography game for two people. You each start in a different
secret country and walk toward each other by naming bordering countries. The
game ends when you meet. Your score is every country you both named — lower is
better, and you never find out where your partner started until you meet them.

Game design lives in [Specs/SPEC.md](Specs/SPEC.md).

## Running it

```bash
npm install
npm run dev
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm test` | vitest, once |
| `npm run typecheck` | `tsc -b` across app and scripts |
| `npm run build` | typecheck then production bundle |
| `npm run graph` | regenerate the country graph |
| `npm run play` | play a game in the terminal |

## How the country data works

The country graph is generated, never hand-edited. `npm run graph` reads
[world-atlas](https://github.com/topojson/world-atlas) 50m TopoJSON, derives
land borders from shared arcs in the topology, folds in the hand-written tables
below, and writes `src/game/data/countries.generated.ts`. It refuses to write a
graph that is asymmetric, self-bordering, or disconnected, and tells you which
countries were stranded.

The three files worth editing are all curation, not code:

- **[`src/game/playSet.ts`](src/game/playSet.ts)** — which countries exist.
  Dependent territories are excluded; contested entities are either played or
  merged into the state that administers them. A merged entity donates its
  borders to its parent, which is why Morocco still borders Mauritania after
  Western Sahara is folded in.
- **[`src/game/seaLinks.ts`](src/game/seaLinks.ts)** — the crossings, grouped by
  kind and each carrying its distance. Roughly forty countries have no land
  border at all, so without this table the world is in 25 pieces.
- **[`src/game/names.ts`](src/game/names.ts)** — display names and the
  alternatives a player might type.

196 countries, 374 borders, 60 of them by sea.

Rules and graph code in `src/game/` are pure functions with no React imports, so
the whole game is testable without a browser — `npm run play` walks a full game
in the terminal. Rendering lives in `src/ui/`.

The knobs SPEC.md says to settle by playing rather than arguing are in
[`src/settings.ts`](src/settings.ts): how far apart the starts are, and whether
you can see where your partner is.

## Deploying

Hosted at `meet.ronfalafel.com` — a static bundle behind nginx, reached through
the Cloudflare tunnel already running on the VM.

```bash
docker compose up -d --build
```

The container binds to `127.0.0.1:8080`, so nothing is exposed on the VM's
public interface; the tunnel is the only way in. Add the hostname to the
cloudflared config:

```yaml
ingress:
  - hostname: meet.ronfalafel.com
    service: http://localhost:8080
  - service: http_status:404
```

Then point DNS at the tunnel once:

```bash
cloudflared tunnel route dns <tunnel-name> meet.ronfalafel.com
```

If cloudflared runs as a container rather than on the host, put it on the same
compose network and use `http://meet:80` instead of localhost.
