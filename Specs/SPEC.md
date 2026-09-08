# Meet in the Middle — game spec

A cooperative geography game for two people, built to be played from two phones
in the same room, out loud. Three modes share one board, one map and one set of
rules plumbing; only the goal changes.

| Mode | Goal | Ends when |
| --- | --- | --- |
| Meet in the middle | Join two secret starts | The named countries connect them |
| Fill a continent | Name every country in one continent | Nothing is left, or you give up |
| Name that country | Say which country is lit up | Ten rounds are done |
| Capital cities | Say whose capital that is | Ten rounds are done |
| Flags | Say whose flag that is | Ten rounds are done |
| Bigger or smaller | Tap the larger of two countries | Ten rounds are done |
| Which continent? | Tap the continent a country is on | Ten rounds are done |
| Name the neighbours | Name everything bordering one country | Nothing is left, or you give up |
| The long way round | Walk as far as you can, border by border | You run dry, or you give up |
| Hot and cold | Find one secret country | You name it, or you give up |

Only Meet in the middle needs a partner. The rest are as good alone.

Internally there are eight modes, not ten: Capital cities and Flags are both
`mode: 'identify'` with a different `prompt`, because the machinery is
identical and only the question changes.

Two of them — Bigger or smaller and Which continent? — are answered by tapping
rather than typing. They show buttons instead of the guess input, have no
give-up (there is nothing to get stuck on), and every answer moves the round
along whether it was right or not.

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

## Fill a continent

No starts. A continent is chosen, and you name every country in it between you.
The counter shows how many are left; there is no par, because the only possible
score is all of them.

**Land connectivity is irrelevant here** — there is no route to build — so the
islands that Meet in the Middle cannot use are fully in play, and Oceania
exists as a playable region only in this mode.

Giving up ends the game and lists what was missed, drawn on the map outlined in
red rather than filled, so the gaps read as absence rather than score.

| Continent | Countries | Reachable by land |
| --- | --- | --- |
| Africa | 54 | 48 |
| Asia | 48 | 43 |
| Europe | 46 | 43 |
| North America | 23 | 10 |
| Oceania | 13 | 1 |
| South America | 12 | 12 |

Continent membership is a judgement call, not data, so it lives in
`src/game/continents.ts` with the awkward cases commented: Russia and Cyprus in
Europe, Turkey and the South Caucasus in Asia, Egypt in Africa, the Caribbean
with North America.

## Name that country

One country lights up on the map; you name it. Ten per round, drawn from a
continent or the whole world, shuffled once at deal time and carried in the
setup so both phones ask the same question in the same order.

A wrong answer is **accepted and counted**, not refused — it is the only mode
where being wrong costs something, because otherwise you could name every
country in Europe until one stuck. The prompt stays put until you get it or
skip, and a skip marks that country missed and moves on.

**Capital cities** is the same round asked the other way: a capital is shown and
you name the country. Capitals are not translated — CLDR gives country names in
every language but there is no equivalent for cities in the browser, so the
prompt stays Latin even when the game is in Hebrew. The answer is a country
name, which is translated.

**Flags** is the same again with a picture. Flags come from `flag-icons` and are
copied into `public/flags/` at build time by `npm run flags`, which runs
automatically before a build. They are static files, not bundled: 1.3 MB of SVG
has no business in the JavaScript, and a round only ever shows ten of them.
Kosovo has no ISO code but flag-icons ships `xk`, which is what everyone uses.

This mode is where the outline toggle earns its keep: with outlines off, the
lit country is the only thing drawn, so you are identifying a shape with no
surrounding context at all.

## Name the neighbours

One country is lit up; name everything that borders it. Hubs are drawn from the
84 countries with at least four neighbours, so it is a puzzle rather than a
gimme — China and Russia have fourteen each.

The autocomplete deliberately does **not** narrow to the answers. Offering only
the nine countries that border Germany would be an answer sheet, so it offers
everything on the same landmass instead.

## Bigger or smaller

Two countries, tap the larger. The pair is coloured on the map to match the two
buttons, so the map is the question rather than decoration.

Areas come from the geometry itself — `geoArea` over every polygon of the
country, at build time. Summing rather than taking the largest piece matters:
Indonesia and the Philippines are archipelagos and their biggest island is not
their area. It does mean France comes out around 640,000 km² rather than
metropolitan France's 551,000, which is the official figure once the overseas
departments the dataset draws are counted.

The 50m outlines are simplified, so an area can be a few per cent off an atlas.
Pairs are therefore only offered when the larger is **between 1.2× and 6×** the
smaller — closer than that and our answer might disagree with a reference book,
which is worse than a boring question.

## More people

The same round asked about a different column. `CompareGame` carries a
`metric`, `'area'` or `'population'`, and everything else — the pairing, the
1.2×–6× band, the map colouring, the scoring — is shared. Two modes in the
lobby, one implementation.

It is a genuinely different question. Russia is the largest country on earth and
ninth by population; Bangladesh is the reverse. If the two ever agreed the mode
would be a duplicate, so there is a test asserting they disagree.

Population lives in [`src/game/population.ts`](../src/game/population.ts),
hand-written, roughly 2024, rounded to the nearest thousand. Neither
`world-countries` nor `countries-list` carries the field any more. The figures
go out of date and that is fine: the game only ever asks which of two countries
has more people, the pairs are never close, and that ordering moves far more
slowly than the numbers do. The generator fails the build if a country has no
entry.

## Trivia

Ten multiple-choice questions, four options each. Nothing is hand-written — the
graph already knows borders, capitals, currencies, languages and whether a
country touches the sea, so questions are generated from it and the supply never
runs out. Seven kinds:

| Kind | Asks | Answers with |
| --- | --- | --- |
| `borders` | Which of these borders X? | a country |
| `not-borders` | Which of these does *not* border X? | a country |
| `capital-of` | What is the capital of X? | a city |
| `whose-capital` | X is the capital of which country? | a country |
| `currency` | What money do they use in X? | a currency |
| `language` | Which language is spoken in X? | a language |
| `landlocked` | Which of these has no coast? | a country |

**The distractors are the part that can quietly be wrong**, and a wrong one is
invisible in play — it just marks a correct answer incorrect. Switzerland has
four official languages, so a generator that knew only the first would offer
German as a *wrong* answer about Switzerland. `Country` therefore carries
`currencies` and `languages` as arrays, and every kind excludes the subject's
whole list rather than the one value it picked. There is a test per kind
checking the options back against the graph.

A `TriviaQuestion` carries a kind, a subject and bare strings — country codes
for the kinds that answer with a country, plain text for the rest. It never
carries a sentence, so the two phones can be reading different languages; the
screen builds the question. Capitals, currencies and language names are not
translated, for the same reason as [capitals](#name-that-country): CLDR has no
table for them and the English names are what an atlas prints.

Questions are dealt into the `Setup`, not generated per device. Deal them twice
and the two phones would be answering different questions.

## Which continent?

A country lights up; tap one of six buttons. No keyboard at all, which makes it
the fastest thing here on a phone. The answer is a continent id rather than a
country, which is why `Move.code` is a plain string.

## The long way round

Start somewhere and keep going, one border at a time, never repeating a
country. There is no target; the score is how long a chain you manage. It ends
when the head has no unused neighbours left, which counts as finishing rather
than failing — you exhausted it.

Starts are drawn from the same 84 hubs as the neighbours mode, because a
country with one neighbour is a chain that ends on the first move. The
autocomplete does not narrow to the head's neighbours, for the same reason it
does not in the neighbours mode.

## Hot and cold

One secret country, anywhere on earth. Every guess is coloured by how close it
is, and **a guess that borders the answer says so** — in the prompt and against
that row in the list. Islands are perfectly good secrets here, because distance
does not care about land routes.

### Heat

Distance is great-circle between centroids, and heat is
`1 - (distance / 20,000 km) ^ 0.6`. The exponent is doing real work: an
exponential decay collapses everything past a few thousand kilometres into one
value, and a linear ramp flattens the near end instead. A root curve spreads
both.

| From France | | heat |
| --- | --- | --- |
| Belgium | 480 km | 0.89 |
| Poland | 1,370 km | 0.80 |
| Egypt | 3,286 km | 0.66 |
| United States | 7,644 km | 0.44 |
| Australia | 15,192 km | 0.15 |
| New Zealand | 19,044 km | 0.03 |

### Colour

A **thermal ramp**, in [`src/ui/heatColour.ts`](../src/ui/heatColour.ts):
indigo, purple, fuchsia, pink, red, orange, amber, yellow, white-hot.

It got there the long way. Blue-to-red was tried first and read wrong — on a
dark map a cold blue guess was hard to tell from unguessed land, so far guesses
looked like they had not registered. The fix was a single red hue with lightness
and saturation doing the work, Globle-style, and that was reported as
indistinguishable **twice**, because it was: Belgium at 480 km and Poland at
1,370 km came out eight points apart on ΔE, which is invisible on a country the
size of Belgium.

Hue is what the eye actually discriminates. The same two guesses are now 136
apart. Nothing on the ramp resembles `--land` (`#2b3543`, dark and desaturated),
so the original complaint stays fixed.

**The stops are deliberately crowded at the hot end.** Five of the nine sit
above 0.6, which is everything within about 4,000 km — where a game is actually
won. The far half only has to read as "nowhere near"; the list gives exact
kilometres for anyone who wants them. Consequently two guesses 9,000 km out may
look alike, and two 700 km apart never will.

`heatColour.test.ts` asserts all of this in ΔE, so it cannot quietly regress a
third time.

## What the map may give away

The map opens framed on something useful only where that cannot answer the
question:

| Mode | Opens on |
| --- | --- |
| Meet in the middle | Your own start |
| Fill a continent | The continent (already stated) |
| Name the neighbours | The hub (already named) |
| Bigger or smaller / More people | Nothing; the whole world |
| The long way round | The head of the chain |
| Name that country | The country — it *is* the question |
| Trivia | Nothing; the whole world |
| Capitals, Flags, Which continent?, Hot and cold | Nothing; the whole world |

Framing the answer in the capital and flag rounds was handing them over, which
is why those stay put.

**Drawing the country is the same trap**, and it took longer to spot. Which
continent? used to light the country up, which shows you where it is — the whole
question. Bigger or smaller used to draw both countries in the buttons' colours,
which lets you compare them by eye instead of knowing. Both now open on a blank
world, with the country named in the prompt where it used to be lit up.

**Clue** is the deliberate version of that, and every tap-through mode has one.
Pressing it zooms the map to 3× and puts the country in frame but **off
centre** — dead centre would be as good as naming it. The offset is derived from
the country code, so asking twice moves the map to the same place rather than
jittering.

Two modes ask for something else and get it:

- **Which continent?** lights the country up as well as framing it. The
  highlight *is* the clue.
- **Bigger or smaller / More people** draws both countries in the buttons'
  colours and centres between them, without zooming. You cannot compare two
  countries one at a time, so a 3× zoom on one of them would be no help.

A clue lasts exactly one question. It is remembered as the move count it was
asked at, so the next answer moves the count on and the map goes quiet again —
otherwise one clue would light up the rest of the round.

## Learning as you go

Rounds that move on regardless of the answer say what the answer was:

- **Name that country / Capitals / Flags** — **Reveal** gives up on the current
  question and shows what it was, rather than skipping in silence.
- **Bigger or smaller / More people / Which continent? / Trivia** — every answer
  is followed by what the right one was, since a wrong tap otherwise teaches
  nothing.

## Showing the map

A per-device toggle, remembered in `localStorage` and never shared:

- **Outlines on** — the whole world is drawn in grey and fills in with colour.
- **Outlines off** — Travle's version: empty ocean, and only what is on the
  board is drawn. You are recalling the world rather than reading it.

The starting value is `SETTINGS.showOutlines`.

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

type GameState =
  | { mode: 'meet'; starts: [CountryCode, CountryCode]; moves: Move[]
      status: 'playing' | 'won'; optimalDistance: number }
  | { mode: 'continent'; continent: ContinentId; moves: Move[]
      status: 'playing' | 'won' | 'revealed' }
  | { mode: 'identify'; scope: Scope; order: CountryCode[]; moves: Move[]
      status: 'playing' | 'won' | 'revealed' }
```

Everything else is derived. A game is a **setup plus a move list**, which is
what makes it trivially serialisable — two devices stay in sync by agreeing on
that and nothing else, and a reconnecting phone catches up by replaying it.

A `Setup` describes a specific game and always names what was dealt; a
`GameRequest` is what someone asks for and leaves the dealing open. The lobby
sends a request; the wire carries a setup.

A `Snapshot` is a setup, the moves, and `revealed` — the one piece of state no
move list implies. Leaving it out meant one player could give up and the other
never find out.

## Ending a game early

Giving up sits at the bottom of the page, well away from the guess input, and
takes two presses. The confirm puts **Cancel** where the original button was, so
a second tap in the same place cancels rather than confirms.

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
- **Should a continent game be timed?** Nothing is timed today, so the only
  pressure is patience.
- **Ten per round** in Name that country. Longer is more of a test, shorter is
  more of a warm-up.
- **Four neighbours** is the bar for a hub. Lower would let in more countries
  and more one-answer puzzles.
- **3,000 km** is the hot/cold falloff. Shorter makes the map colder and the
  hunt longer.
- **Should the chain end when it runs dry?** It counts as a win today, which
  may be too generous for a two-country cul-de-sac.
- **1.2× to 6×** is the band for a fair comparison, and it is shared by area
  and population. Narrower makes it harder and riskier; wider makes it obvious.
- **Four options** in trivia. Three would be too easy; five crowds a phone.
- **Should trivia let you pick which kinds to ask?** `GameRequest` already
  carries an optional `kinds`, and the lobby never sets it.
- **Ferries.** All disabled. `src/game/seaLinks.ts` has them grouped and
  commented out; uncommenting `NARROW_STRAITS` alone would put Japan, Sri Lanka
  and the Bering Strait back and reconnect the Americas to Eurasia.

## Not built, and not obviously wanted

Accounts, persistence beyond a room's six hours, leaderboards, dailies, seeds,
sound, more than two players.
