# Decisions

Why the game is the way it is. Newest last. The point of this file is that a
decision already argued through does not get re-argued from scratch six weeks
later — if something here looks wrong, it is fair to change it, but change the
entry too.

## 2026-08-23 — first build

**Country data is generated, never hand-written.** Land borders come from
shared arcs in the world-atlas TopoJSON. Only three things are hand-curated:
which countries exist (`playSet.ts`), which sea crossings count
(`seaLinks.ts`), and what things are called (`names.ts`). Everything else is
derived by `npm run graph`, which refuses to write a broken world.

**50m resolution, not 110m.** 110m has no Singapore, Malta, Andorra, Monaco,
San Marino, Liechtenstein, Bahrain, Mauritius or Maldives. Those microstates
are some of the most fun countries in the game. 50m has all of them for 225 KB
gzipped.

**Sovereign states only.** Dependent territories are excluded. This matters
more than it sounds: the dataset draws French Guiana as part of France, so
France came out of the topology bordering Brazil and Suriname. Those two edges
are explicitly blacklisted.

**Contested entities are merged, not deleted.** Western Sahara, Somaliland and
Northern Cyprus are folded into the state that administers them, and donate
their borders to it. Deleting Western Sahara outright would have silently taken
Morocco's border with Mauritania with it. Kosovo is played as its own country.
All four are one-word switches in `playSet.ts`.

**Alpha-3 codes everywhere**, with `XKX` / `XSO` / `XNC` for the entities ISO
never assigned.

## 2026-08-23 — rules overhaul, after playing it

**No turns, no adjacency.** Borrowed from [travle.earth](https://travle.earth):
name any country, any time. The original turn-based, must-border-your-position
rules were replaced wholesale. A game is now a start pair plus an unordered
pool of named countries, and you win when that pool connects the two starts.

**The still-needed counter exists because free guessing needs it.** Without
some signal, naming a country far from home is blind. With it, a distant guess
is a hypothesis you get an answer to. It is the single change that makes the
free-guess rule work.

**Ferries and open-water crossings are all disabled.** They never felt like
legal moves. Only fixed links — Channel Tunnel, Øresund Bridge, King Fahd and
Johor causeways — survive, on the grounds that you can drive across them.

**The generator decides what is playable, rather than trusting the sea-link
table.** Dropping ferries fragments the world into 41 pieces. Rather than
hand-maintaining which islands are safe, the generator computes landmasses,
keeps only those big enough to host a game, and marks the rest out of play. A
start pair is always drawn from one landmass. This is why an unwinnable game is
structurally impossible rather than merely unlikely.

*Cost of that decision:* 39 island nations left the game, including Australia,
New Zealand, Japan, Cuba, Iceland, Madagascar and the whole Caribbean.

**The sync server is authoritative and shares the rules module.** It imports
`src/game/rules.ts` directly. There is deliberately no second implementation of
the rules to drift.

**Whole state on the wire, never deltas.** A game is a few hundred bytes, so
resending everything makes a dropped message self-healing.

**One seat, one live device — but a seat frees up after a minute.** Losing your
token (new phone, cleared browser data) used to hold a seat forever and brick
the room. A token holder still always wins; only an unclaimed seat expires.

## 2026-08-23 — languages

**CLDR via `Intl.DisplayNames`, not the ISO package's names.** The package ships
official long forms — "Bondsrepubliek Duitsland", "Koninkrijk der Nederlanden",
and one entry literally reading "Birmania  Myanmar". CLDR gives what people
actually say, for free, in every browser. English is the exception and still
comes from Natural Earth, because its names are shorter than CLDR's
("Democratic Republic of the Congo" beats "Congo - Kinshasa").

**Matching ignores the chosen language.** She reads it in Hebrew, he reads it
in English, and both type into the same board. A guess is checked against every
language's names at once.

**Normalising had to stop being Latin-only.** The old filter kept `[a-z0-9]`,
which would have reduced every Hebrew name to an empty string. It now strips
combining marks and keeps any letter or digit in any script — which as a bonus
makes Hebrew geresh optional and folds Arabic hamza variants together.

**Counts are rendered as `label: n`, never folded into a sentence.** "3 more
countries" needs different agreement in most of these languages, and Arabic has
six plural forms. A label sidesteps every one of those rules.

**Refusals are structured, not prose.** `checkMove` returns a reason and a
country code; the screen turns that into a sentence. Otherwise the server would
be shipping English to a Hebrew phone.

## 2026-09-05 — two more modes, and hiding the map

**The map can be blanked, per device.** Travle draws nothing but what you got
right, and it turns out that is a different game rather than a harder skin on
the same one: with outlines on you are reading a map, with them off you are
recalling one. It is a view preference, so it lives in `localStorage`, is never
sent to the other player, and is never part of the game state.

Outlines stay **on** by default. Off is the better mode once you know the
world, but it is a steep first impression, and the toggle is right there.

**Continent games ignore land connectivity entirely.** Meet in the Middle drops
39 island nations because there is no land route to them; a continent game has
no route to build, so those islands come back. That is what makes Oceania
playable at all, and it means the two modes deliberately disagree about which
countries exist — the check is per mode, not global.

**Continents are hand-written, not imported.** Russia, Turkey, Cyprus, Egypt
and the Caucasus all sit on a line somebody drew, and a table in the repo with
the reasoning next to each awkward case is more honest than inheriting a
package's answer. The generator refuses to build unless every country is placed
exactly once.

**A wrong answer in Name that country is accepted, not refused.** Every other
mode hands a bad guess back for free, on the grounds that a refusal is not a
move. That rule breaks here: without a cost you would just name every country
in Europe until one stuck. So identify is the one mode where being wrong is
recorded, and the prompt does not move until you get it or skip.

**`Setup` and `GameRequest` are different types.** The lobby asks for "a meet
game" without knowing the start pair; the wire has to carry the exact pair or a
reconnecting phone would rejoin a different game. Conflating them let the lobby
send an incomplete setup, so they were split: request in, setup out.

**Identify carries its shuffled order in the setup.** Deriving it from a seed
would work, but the order is only ten codes and putting it in the setup means
replay is exact and both phones ask the same question with no shared RNG.
