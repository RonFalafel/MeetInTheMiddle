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

## 2026-09-06 — three more modes

**Capitals is a prompt, not a mode.** Asking "whose capital is Oslo?" and
"which country is this shape?" share every piece of machinery — the same
shuffled round, the same scoring, the same skip. It is `prompt: 'capital'` on
the identify mode rather than a fourth game, and the map deliberately stops
highlighting, because the highlight would answer the question.

**Capitals are not translated, and that is a deliberate stop.** CLDR gives
country names in every language through `Intl.DisplayNames`, but there is no
equivalent for cities, and hand-writing 196 of them in ten languages is not
worth it. A capital is a proper noun that mostly transliterates. The answer is
still a country name, which is fully translated.

**The neighbours autocomplete does not narrow to the answers.** Every other
mode restricts suggestions to what it would accept, which is a kindness. Here
it would be a cheat sheet — nine suggestions for Germany and the game is over —
so it offers the whole landmass instead.

**Hot and cold measures kilometres, not border hops.** Hops are the natural
metric for this codebase and the wrong one here: they are coarse, and islands
have none at all. Great-circle distance between centroids works for every
country on earth and gives a smooth gradient, which is the entire mechanic.

Haversine is written out in `rules.ts` rather than imported from `d3-geo`, so
the game layer stays free of the map's dependencies and the server does not
load a projection library to score a guess.

**The heat curve is exponential, not linear.** A linear ramp put the whole of
Europe inside one shade. At a 3,000 km scale a neighbour reads about 0.85, the
far side of a continent about 0.5, and another continent below 0.1 — which is
the spread that makes the map worth looking at.

**Giving up moved to the bottom of the page and grew a confirm.** It sat in the
row directly under the guess input, which is exactly where a thumb lands, and
was being hit by accident. The confirm puts Cancel in the original button's
position, so a repeated tap cancels rather than confirms.

## 2026-09-06 — flags, chains, and fixing hot/cold

**Hot and cold went to a single hue.** The first version ramped blue through
green to red, which looked good in isolation and was wrong in play: on a dark
map a cold blue guess is nearly the same value as unguessed land, so a distant
guess looked like it had not registered at all. Globle uses one hue and varies
the intensity, and that is right — every guess should read as *a guess*, with
how red it is carrying the information.

A related bug went with it: the outline early-return sat above the heat check,
so with outlines switched off a guessed country was skipped entirely and the
map stayed blank. Guesses now draw whatever the outline setting says, because
they are the only feedback this mode gives.

**Bordering the answer is called out explicitly.** It is the strongest clue in
the mode and it was buried in a distance number. We have exact border data, so
it costs nothing to say so — in the prompt as the guess lands, and as a badge
against that row afterwards.

**Flags are static files, not bundled assets.** `scripts/copyFlags.ts` pulls the
196 we need out of `flag-icons` into `public/flags/` as a prebuild step. 1.3 MB
of SVG in the JavaScript bundle would be absurd when a round shows ten of them,
and nginx already serves static files better than we could. `public/flags/` is
generated and gitignored.

**Flags is a prompt, not a mode** — the same call as capitals. Three prompts
now share one identify mode: shape, capital, flag.

**The long way round has no target.** Every other mode has a thing to reach or
complete; this one just runs until you dry up, and the score is the length.
Running the head out of unused neighbours counts as finishing rather than
failing, on the grounds that you exhausted it rather than gave up — though a
two-country cul-de-sac makes that a bit generous, which is noted in SPEC.

**Neither the chain nor the neighbours mode narrows its autocomplete.** Every
other mode restricts suggestions to what it would accept, which is a kindness.
In these two the accepted set *is* the answer, so the suggestion list would be
a cheat sheet. Both offer the whole landmass instead.

## 2026-09-06 — two modes you answer with your thumb

**Areas are measured, not looked up.** `geoArea` over the country's own polygons
gives square kilometres for free at build time, so there is no new data table to
maintain and nothing to go stale. The cost is precision: the 50m outlines are
simplified and areas land within about 5% of an atlas.

That accuracy sets the game design rather than the other way round. A pair is
only offered when one country is **1.2× to 6×** the other — below 1.2 our answer
could genuinely contradict a reference book, which is a worse failure than an
easy question. There is a test asserting no dealt pair is closer than that.

**Areas sum every polygon rather than taking the largest.** The centroid takes
the biggest piece, because "where is France" means metropolitan France. Area
cannot do the same or Indonesia would be measured by one island. Summing makes
France ~640,000 km², which is its official area including the overseas
departments the dataset actually draws — right rather than merely convenient.

**Both new modes are answered by tapping.** With two options, or six, letting
you type a name you can already see would be busywork, and a wrong answer
should move the round along rather than let you try the other one. So they
render buttons instead of the guess input, `namableCodes` returns an empty set,
and there is no give-up because there is nothing to be stuck on.

**A move is no longer always a country.** Which continent? answers with a
continent id, so `Move.code` widened from `CountryCode` to `string` with a
comment saying why. `SKIP` had already set that precedent; this makes it
explicit rather than a quiet special case.

**Bigger or smaller colours the pair to match its buttons.** The two countries
take the two player colours on the map and the buttons carry the same borders,
so the map is the question rather than decoration sitting above it.

**A `fill` attribute on an SVG path loses to any CSS rule.** Hot and cold set
the heat colour with `fill={...}`, which is a presentation attribute, and
`.land { fill: var(--land) }` beat it — so every guess rendered as plain
unguessed land and the map never coloured in at all. It is now an inline
`style`, which does win, and there is a comment on the line saying why.

Worth recording how it survived a check: the verification read the `fill`
*attribute* back and found it set, which proved nothing about what was drawn.
Anything about appearance has to be checked with `getComputedStyle` or a
screenshot, not by reading back the value that was just written.

## 2026-09-06 — the round of fixes that came from actually playing it

**The heat curve is a root, not a decay.** Third attempt at this. Exponential
(`e^-d/3000`) put every guess past a few thousand kilometres into the same
shade; linear flattened the near end instead. `1 - (d/20000)^0.6` spreads both,
and the colour ramp widened with it — lightness 28–58%, saturation 35–90%. The
observed spread went from a 19-point range in the red channel to 90. There are
tests asserting the bands stay apart, so this cannot quietly regress again.

**The map no longer frames the answer.** Capitals, flags and which-continent
were centring the map on the country being asked about, which gave the game
away outright — the position *is* the question in all three. They now open on
the whole world, and so does hot/cold.

**Clue is the deliberate version.** It zooms to 3× and puts the country in frame
but off centre, with the offset derived from the country code so it is stable
between presses. Centring would be the same as answering.

**Reveal replaced Skip.** Skipping moved on in silence, which wastes the one
moment you are most likely to remember something. Reveal shows what it was. The
underlying move is still `SKIP` and still counts as missed — only the framing
changed, plus the same idea applied to the two tap-through modes, which now say
what the right answer was after every question.

**Suggestions were selecting on `pointerdown`.** That fires the instant a finger
lands, so on a phone scrolling the list picked whatever happened to be under the
touch — the list could not be scrolled at all. Now `onClick` selects and
`onMouseDown` only suppresses the desktop blur; a touch generates its mousedown
after the tap, so scrolling is unaffected. The list also got `touch-action:
pan-y` and `overscroll-behavior: contain`.

**The title goes home.** It was the only screen with no way back to the mode
list short of the browser's back button.
