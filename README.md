# Meet in the Middle

A cooperative geography game for two people. You each start in a different
secret country and name countries — any country, in any order — until the
countries on the board join your two starts into one unbroken chain of land
borders. Your score is every country you both named; lower is better.

There are no turns. Either of you can name a country whenever you think of one,
which is the point: it is meant to be played out loud, at the same time, from
two phones.

[Specs/SPEC.md](Specs/SPEC.md) is the game as it currently stands;
[Specs/DECISIONS.md](Specs/DECISIONS.md) is why.

## Running it

```bash
npm install
npm run dev
```

For two-device games you also need the sync server:

```bash
npm run sync
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server, proxying `/ws` to the sync server |
| `npm run sync` | WebSocket server for two-device rooms, on :8081 |
| `npm test` | vitest, once — game rules and the room protocol |
| `npm run typecheck` | `tsc -b` across app, scripts and server |
| `npm run build` | typecheck then production bundle |
| `npm run graph` | regenerate the country graph |
| `npm run play` | play a game in the terminal |

## The rules, as built

- **Name any country, any time.** No adjacency requirement and no turn order.
  A country that joins nothing up is still a legal guess and still costs you a
  point, so the risk is naming something useless.
- **You win when the board connects the two starts.** Not when the players are
  adjacent — when there is an unbroken run of named countries from one start to
  the other. Who named which country does not matter.
- **Par is one fewer than the gap.** Two starts five borders apart need four
  countries between them, so par is four.
- **Only land borders count.** Bridges and tunnels you can drive across count
  as land; ferries and open water do not.

The knobs worth arguing about live in [src/settings.ts](src/settings.ts): how
far apart the starts are, whether you can see your partner's countries, and
whether the game tells you how many more countries are needed.

## Languages

Ten: English, עברית, العربية, Español, Français, Deutsch, Italiano, Nederlands,
Português, Русский. The picker is in the header; the choice is remembered, and
a new visitor gets their phone's language if the game speaks it. Hebrew and
Arabic lay the page out right to left.

Country names come from CLDR via `Intl.DisplayNames` at build time. Interface
text is hand-written in [`src/game/languages.ts`](src/game/languages.ts), which
is also the whole cost of adding a language — add a row to `LANGUAGES`, write
its `Strings`, run `npm run graph`.

**Guesses are matched against every language at once**, whichever one is on
screen. One of you can read the game in Hebrew and the other in English and
you can both type into the same board.

## Two phones

One player taps **Start a game** and sends the other the link — the room code is
four characters and lives in the URL. Both devices then see the same board and
either can name a country at any moment.

The server is authoritative: it imports the same rules module the browser does,
so a client cannot talk its way into an illegal move. Rooms live in memory,
hold two seats, and expire after six hours. A device that drops off keeps its
seat via a token in `localStorage`, and gets it back on reconnect; a seat
nobody returns to opens up after a minute so a lost token cannot brick a room.

Two tabs of the same browser share `localStorage`, so they fight over one seat.
That is only a problem when testing on one machine — use a private window.

## How the country data works

The country graph is generated, never hand-edited. `npm run graph` reads
[world-atlas](https://github.com/topojson/world-atlas) 50m TopoJSON, derives
land borders from shared arcs in the topology, folds in the hand-written tables
below, and writes `src/game/data/countries.generated.ts`.

The three files worth editing are all curation, not code:

- **[`src/game/playSet.ts`](src/game/playSet.ts)** — which countries exist.
  Dependent territories are excluded; contested entities are either played or
  merged into the state that administers them. A merged entity donates its
  borders to its parent, which is why Morocco still borders Mauritania after
  Western Sahara is folded in.
- **[`src/game/seaLinks.ts`](src/game/seaLinks.ts)** — crossings, grouped by
  kind and each carrying its distance. Only the fixed links — Channel Tunnel,
  Øresund Bridge, King Fahd and Johor causeways — are switched on. Uncomment a
  group to bring back a region.
- **[`src/game/names.ts`](src/game/names.ts)** — display names and the
  alternatives a player might type.

Without ferries the world is not one connected graph, so the generator works
out which landmasses can host a game and marks the rest out of play:

| | countries |
| --- | --- |
| Afro-Eurasia | 135 |
| The Americas | 22 |
| Out of play — no land route anywhere | 39 |

Islands still draw on the map, greyed out, and the game will not suggest them
or accept them. Both starts always come from the same landmass, so a game can
never be unwinnable — the generator refuses to build a world where that is
possible, and there is a test for it.

Rules and graph code in `src/game/` are pure functions with no React imports,
which is what lets the same code run in the browser, in the server, and in
`npm run play`. Rendering lives in `src/ui/`, the sync server in `server/`.

## Deploying

Hosted at `meet.ronfalafel.com` — nginx serving the bundle, the sync server
behind it on the same origin, both reached through the Cloudflare tunnel
already running on the VM.

```bash
docker compose up -d --build
```

How the tunnel reaches it depends on where cloudflared runs.

### cloudflared on the host

The default. Nothing is published beyond loopback, so the tunnel is the only
way in. Point the ingress rule at `http://localhost:8090`.

### cloudflared in a container

A container cannot reach the host's loopback, so the default bind gives a 502.
Two ways round it, best first.

**Share a Docker network — nothing exposed on the LAN.** Find the network
cloudflared is attached to:

```bash
docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' cloudflared
```

Put it in `.env` as `TUNNEL_NETWORK=<that name>`, then bring the stack up with
the tunnel overlay:

```bash
docker compose -f compose.yaml -f compose.tunnel.yaml up -d
```

Point the ingress rule at `http://meet-web:80` — no host address, and it keeps
working if the VM's LAN address changes.

Note the **80**, not 8090. `MEET_PORT` is the port published on the host; over
a shared Docker network you reach the container's own port, and nginx listens
on 80 inside the container. Using the host port here is the easy mistake and
gives a 502.

Check it from another container on that network — cloudflared's own image is
too minimal to have a shell client:

```bash
docker run --rm --network "$TUNNEL_NETWORK" nginx:1.27-alpine wget -qO- http://meet-web:80 | head -3
```

The catch: that network belongs to whichever Compose project defined
cloudflared, so tearing that project down takes this one's network with it. A
dedicated network shared by cloudflared and everything it fronts is tidier if
the collection keeps growing.

**Or publish on all interfaces.** Put `MEET_BIND=0.0.0.0` in a `.env` file next
to `compose.yaml` and point the ingress rule at the host's LAN address —
`http://192.168.10.90:8090`. Simpler, and it matches how most self-hosted
setups are wired, but the port is then reachable by anything on the LAN.

Either way the port is set by `MEET_PORT`, default 8090; if something else has
it, change it and change the ingress rule to match. Find what is holding a port
with `sudo ss -ltnp | grep <port>`.

Cloudflare tunnels carry WebSockets without extra configuration, so two-device
games work over the tunnel with no additional setup.
