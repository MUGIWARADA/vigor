# Vigor — Football Intelligence Platform

A context-specific football intelligence platform connecting player profiling, contextual analytics,
tactical simulation, scouting, research discussions and match analysis.

> **Phase status: Phase 2a backend implemented (not yet executed — see below); Phase 1 frontend
> complete and verified.** The Spring Boot core-domain service, Flyway schema, DEMO seed and test
> suite are written in [`backend/`](backend/) but have not been compiled or run in the authoring
> environment — follow [`backend/README.md`](backend/README.md) to build and verify on Windows.
> No real football data, live news, live AI or video analysis is connected yet.

---

## What is this?

Vigor evaluates players **in context**: select a player's role, match phase, league, comparison
group and team style, and the platform updates the relevant metrics, rankings, interpretations and
evidence accordingly. It is built for football analysts, scouts, coaches, researchers, developers and
knowledgeable enthusiasts — as a functional product, not a dashboard mockup.

**Every statistic in the interface carries a data provenance label** (DEMO / IMPORTED / CALCULATED /
MODEL_ESTIMATE / MANUAL / VERIFIED). In Phase 1 all data is fictional (DEMO) and is never presented as
real football facts.

## Repository layout

```
vigor/
├── frontend/          # React + TypeScript + Vite + Tailwind CSS (Phase 1 deliverable)
│   ├── src/
│   │   ├── api/       # Temporary mock API layer + AI assistant provider interface
│   │   ├── components/# Design system: ui/ primitives, shared analytical widgets, pitch, charts
│   │   │              (Volt Monochrome at night, a section-coloured daylight palette in light mode)
│   │   ├── data/      # Deterministic demo dataset generator (fictional, reproducible)
│   │   ├── hooks/     # Shared React hooks
│   │   ├── lib/       # Metric registry, analysis engine, similarity engine, stores, utils
│   │   ├── pages/     # One file per module (13 modules)
│   │   ├── state/     # Settings (demo mode), global filters, data provider contexts
│   │   ├── test/      # Test harness + setup
│   │   └── types/     # Domain types (mirror the planned database schema)
│   └── ...            # Vite / Vitest / tsconfig configuration
├── backend/           # Java 21 / Spring Boot 3.5 core-domain service (Phase 2a) — see backend/README.md
├── docs/
│   ├── ROADMAP.md     # Phase plan and approval gates
│   └── DATA-MODEL.md  # Draft PostgreSQL schema (planned tables and relationships)
└── README.md
```

## Modules (all navigable in Phase 1)

1. **Overview front page** (Phase 4c) — SofaScore-style tabs instead of one long scroll:
   **Home** (filters, top performers, title races, form changes, news, shortlists, scenarios),
   **Matches** (latest results → match reports), **Trending** (topics derived from the data;
   in-app discussion rooms, X search links for real topics only) and **Top performances**
   (single-match packs ranked by the **all-round rating v1** — SofaScore-style,
   position-tailored percentiles across finishing, creation, passing, carrying, defending,
   duels, goalkeeping and positioning, so defenders/keepers can top it; homepage slider shows
   the season leaders; ratings/xG/positioning carry `est.` tags; demo packs
   link to match reports, real packs link to YouTube highlight search and include only what
   the free feed provides — goals/assists/pens/apps). Works in both demo and real mode.
2. **Player database** — 240 fictional players, functional filters (position, team, age, minutes,
   foot, search), sorting, pagination, compare selection.
3. **Player profiles** — identity, per-90 performance by category, tactical identity (percentile
   radar, phase contributions, demo action map), match-by-match evidence with sample-size warnings,
   related intelligence.
4. **Contextual analysis** — the signature engine: pick player, phase, peer group, team style and
   minutes threshold; every metric row shows numerator/denominator, unit, direction, raw value,
   sample, percentile and interpretation. Unavailable metrics are gated with reasons.
5. **Player comparison** — up to 3 players, best-value highlighting by direction, percentile radar
   per player's own position peers.
6. **Similarity search** — deterministic z-score engine with adjustable dimension weights
   (progression / retention / creation / defending / finishing / carrying), explainable contributors,
   pairwise missing-metric exclusion.
7. **Top performers** — sortable rankings by any metric, phase filter, percentile column, opt-in
   composite score with visible weights, CSV export.
8. **Tactical Lab** — interactive SVG pitch: formations for both teams, draggable players, pass /
   carry / run / movement drawing, numbered annotated actions, a ball token that travels with passes and
   carries (draggable), snap-to-player action endpoints, player links, save / load / duplicate
   / ghost-compare scenarios.
9. **Match Preview** — league/competition slabs lead to that competition's teams; selecting a team
   slides its played matches in from the right, with competition, opponent, result (won/drawn/lost)
   and season filters. A result opens a quick preview (score, match numbers, average positions, top-rated
   players and key events) with **Back to matches** pinned at the top and a route into the full match
   analysis: timelines, pitch visualisation, **average positions** and per-player event-based heat maps,
   validated manual event tagging (MANUAL), per-match tactical notes and Markdown report export.
10. **Football news** — 12 fictional articles, category filters, provenance labels, no fake external
    links.
11. **Discussion rooms** — per-player rooms with questions / observations / comparisons, replies with
    validation, deep links to players/metrics/matches/scenarios, save-to-research, reporting.
12. **AI research assistant** — deterministic mock provider (clearly labelled) that answers from the
    retrieved demo data with citations and limitations; provider interface ready for a real backend.
13. **Account & settings** — demo-mode master switch, provenance legend, connection status, local
    content management.
14. **Community Game Mode** (`/game-mode`) — a playable full-pitch 11v11 vertical slice with the
    fictional clubs Bracelonia and Banyarn Munic (26 registered players each; 20-player matchday
    squads). It includes Player vs AI, same-screen local Player vs Player, Watch AI and an AI Test
    Bench; full keyboard/controller parity; PES PS2 old-generation attribute sheets, special stars
    and form arrows; draggable Match Plans with formation presets, movement arrows, physical team
    sliders, strategy slots and automatic/manual set-piece assignments; persistent Human/CPU
    gameplay sliders for speed, passing/shooting, first touch, defending, positioning, goalkeeping,
    referee strictness and injuries; local plan saving plus export/import codes; fluid first-touch
    settling, smoothed player steering, hold-to-charge tackling with context-based cards, double-tap
    sprint knock-ahead, multi-player sprint recovery on genuinely loose BallStates, restart takers who
    run to the BallState before the restart unlocks, explicit in-behind decisions (push the BallState for the 1v1, square to a
    better support runner or finish), phase-based build-up/press/contain/drop behaviour with
    centre-backs owning the high line and the CDM linking in midfield, offside, continuously
    animated throw/free-kick/corner/goal-kick/penalty setups driven by Match Plan set-piece roles
    (everyone keeps shuffling and re-marking through the wait, box attackers hold deep then break in
    staggered timed runs, the taker walks back for his run-up and steps in, and the 21 players never
    settle into a freeze), a realistic set-up window before each restart is released — throw-ins are
    gathered and set rather than snapped, and only go immediately as a quick throw/quick free kick
    when a free man is beyond the line or in grass ahead — plus lofted throw-in arcs, offside-exempt
    throws, a match clock that only runs while the BallState is in play (a dead-ball set-up stops the
    timer and it picks up again on the kick, shown as “Clock stopped”), final-third spacing that sends
    runners to the near post, the back post and the edge of the box for tap-ins, cutbacks and the
    pass-and-shoot, wingers choosing between cutting inside to shoot and looking for the striker by
    comparing the two pieces of space, a whole defence sprinting back to delay the carrier and cover
    the goal once the back line has been played through, and defenders who step onto the shooting lane
    and throw themselves across shots instead of watching them go past; front players who follow the
    play in for the rebound while a team-mate is dribbling or shooting instead of retreating as soon as
    the BallState leaves his feet, and attacking runs timed off the last defender — the front line holds a
    staggered queue on the offside line, breaks beyond it only once the pass is on its way or a run has
    been sent, and commits to the box once the carrier reaches the final third; free kicks that keep the
    Law's 9.15 m clear of the taker (plus a short square option so the ball can be played through the
    set-up rather than into a crowd) and a goalkeeper who stands up with a caught BallState, walks to
    the edge of his box and holds it for a couple of seconds while his side reshapes and the opposition
    drops off, well inside the Law's eight-second limit, rather than releasing instantly; low driven
    passes (double-tap pass, power by hold) struck hard and flat into a team-mate between the lines
    when the short ball is standing in a crowd, dead balls that are shot when they are central and
    close, crossed when the box is actually loaded, and otherwise driven square rather than floated
    into nobody; wingers who only cross when there is a body in the box — two runners, a timed run or
    an unmarshalled striker — and cut inside to shoot when the corridor is the better picture; and a
    1v1 in which the nearest defender weighs his attributes, the marking and tackle-aggression sliders,
    his load and his own read of the break, and when he takes it on abandons his position to sprint flat
    out at the runner instead of holding a line — most breaks, not every one; role discipline in
    possession (central midfield stays behind the ball and supports the build-up unless the attackers
    are already beyond him, the CAM lives between their lines on the shoulder of the front three and
    fills the gap between the two most central forwards, wingers attack a marker they are genuinely
    faster than, any attacker with clear grass ahead of him takes it, and centre-backs hold the line and
    their spacing with a slice of mentality/response either side of it), full-backs who pick up the
    opposing winger goal-side when the side is not holding a synchronized trap line, a keeper treated as
    a real outlet — a back pass when the side is bottled up in its own half, with the centre-backs
    splitting wide and dropping level with the box, the full-backs pushing into the pivot line and the
    midfield showing for the throw out — a defending side that packs its own box for any dead ball
    within 35 m (posts, six-yard line, edge of the area, front man on the halfway line, each slot owning
    a zone so nobody stands on a team-mate), a loose ball contested by fanning the runners out instead of
    converging on one pixel; shots that are on target roughly three times in four with the keeper's
    reach, reaction and the pace and height of the strike doing the stopping, a loaded shot past
    four-fifths of the power bar spraying wide and climbing (crosses past that bar missing their man by
    metres), crosses aimed at the target man's lead and landing within a metre or three of him,
    weak-foot strikes decided by which side of the body the ball is actually on (the ball is carried on
    one side, a one-footed player rolls it onto his strong side when he has the yard and hits it as it
    lies when he does not, and PES Weak Foot Accuracy/Frequency decide the cost and the willingness), a
    big chance squared to a better-placed team-mate when the man on the ball is not a finisher, and a
    three-beat goal presentation — the scorers sprint for the corner flag while the conceding side walks
    back, then the huge scoreline, then a to-scale goal-mouth view with the ball's path to the exact spot
    it crossed the line;
    a 2.5D aerial BallState, aftertouch, substitutions, an AI manager, six training badges and local
    W/D/L records. A Ratings tab shows per-team OVR/PAC/SHO/PAS/DRI/DEF/PHY/GK values for all 26
    players, with locally editable PES attributes. Eight persistent pitch skins are available live and in
    reports, drawn as layered SVG rather than flat turf: Glass Turf (translucent panel with specular
    streaks), Gloss Carbon (polished near-black slab), Floodlit Night (deep emerald lit from both
    corners) and Bone Chalk (light board for the light theme) join Volt Turf, Midnight Glass, Carbon
    Mono and Emerald Broadcast. Every skin uses true chevron mowing, a narrow specular sweep, edge
    vignetting and hairline markings instead of cartoon grass. At full time, Game Mode shows a
    match report with scorers, comparative team statistics, player of the match, one switchable pitch
    showing either team’s attacking-direction average positions or clickable per-player monochrome
    hexagonal heat maps, ratings and the event timeline. Seven selectable player-circle designs give the
    same anatomy — body, rim, number, carrier ring — seven different visual languages: Volt halo (flat
    club disc with a hairline rim), Chrome bead (lit polished sphere), Kit stripe (club colour banded with
    the second colour, the shirt itself), Ring guard (dark core in a thick club-coloured hoop), Neon glass
    (translucent with a bright rim, best on the dark skins), Ink disc (chalk-white with a club rim, quiet and
    editorial on dark turf) and Flood gold (club colour under a gold rim). The choice is local, applies live and is
    remembered between sessions; selection stays volt in both themes. Live circles are at 70% size and show numbers only—the current BallState carrier alone
    receives a small, unboxed Times-style surname that fades in on reception and out when the BallState
    leaves him. Game Mode data is fictional Community content and is never mixed into the real/demo
    football database. Online play, saved replays/match history, career mode, tactical chess,
    custom-team editing, weather, commentary and touch gameplay remain outside v1.

## Running the frontend on Windows

Prerequisites: **Node.js 20.19+ or 22 LTS** (from <https://nodejs.org>) and PowerShell or CMD.

```powershell
cd vigor\frontend
npm install
npm run dev
```

Open <http://localhost:5173>. Other commands:

```powershell
npm test          # run the Vitest suite (unit + component + page tests)
npm run test:watch
npm run build     # type-check (tsc) + production build → dist/
npm run preview   # serve the production build locally
npm run typecheck # type-check only
```

The dev server accepts the sandbox preview host (`allowedHosts: true`); tighten this for production
deployments.

### Environment

Copy `frontend/.env.example` to `frontend/.env.local` to point the frontend at the backend once it
is running locally:

```
VITE_API_BASE_URL=http://localhost:8080   # empty = in-browser mock API (Phase 1 demo mode)
```

`VITE_*` variables are **public by design** — never put secrets there. See the security notes in
`backend/README.md`.

## The demo dataset (important)

Phase 1 ships a **deterministic, fictional dataset** generated in the browser:

- 6 fictional competitions (dataset v2) — five national leagues played for the first 8 matchdays of
  2026/27: the **Bremya League** (England, 20 teams), **La Ligarse** (Spain, 20), **Serie Ass**
  (Italy, 20), **Bundassliga** (Germany, 18) and **Ligue Stirfry** (France, 18) — plus the
  **Atlantica Cup**, a 16-team cross-league knockout (each league's top 3 + the best remaining side;
  round of 16 → final) played after the league rounds
- 96 teams × 24 players = 2,304 players with roles, feet, ages, classic shirt numbers, per-90
  statistical templates and per-country name pools (~30% foreign signings)
- 399 matches (384 league + 15 cup) with lineups, minutes, ratings, ~200k events (goals, cards, subs,
  shots, tactical tags, and a **stratified pass sample** stored with start *and* end coordinates) —
  most with pitch positions; away-team events are mirrored to the correct attacking direction, and
  per-match shot events reconcile exactly with the recorded shot totals
- Position coverage includes second strikers (SS), centre forwards (CF), wing-backs (WB) and wide
  midfielders (LMF/RMF), with stat packs for them: goalkeeping (saves, xG prevented, penalties
  stopped), long/short pass split, chances created, carry distance, tackles/duels won, shots
  blocked, attacking/defensive aerials, and 0–100 positioning estimates (model estimates, tagged
  "est.")
- **Where to see it**: the Competitions page shows every fictional league table, fixtures and
  per-competition scorers (computed in-browser from stored matches and goal events), plus the
  Atlantica Cup knockout rounds; the match list and per-match analysis live under Match analysis
- Internally consistent: season minutes equal summed match minutes, goals/assists equal counted
  events, match scores equal goal events, shot events equal recorded shot totals, completion
  counts never exceed attempts
- Reproducible: fixed seed (`20261015`) — same data on every run, so all percentiles, similarity
  scores and rankings are stable and unit-tested

The dataset powers the **same analysis formulas** that will later run against real imported data:
per-90 normalisation, direction-aware percentiles, peer-group filtering and z-score similarity are
all real, tested code.

**Event-derived metrics (Phase 3):** the Contextual Analysis module computes pass completion,
progressive passes/carries, final-third entries and build-up turnovers directly from the stored
event records — filtered by competition and season — instead of reading provider season aggregates.
Every such row is marked **CALCULATED** and shows the number of events behind it. The pass feed is
a deliberate **sample** (roughly 85–110 stored passes per match, not a full feed), so counts are
indicative rather than exhaustive; the sample size is disclosed next to each value. Line-breaking
passes remain provider-based: they need opponent positions at pass time (tracking data), which
event-only records cannot provide.

**Real competition data (Phase 4a):** a new **Competitions** section imports league tables,
fixtures/results and top scorers from [football-data.org](https://www.football-data.org)'s free
tier (top-5 leagues + Champions League; the Europa and Conference Leagues are paid-only there —
verified 2026-10). It is **off by default**: Settings → *Real competition data* toggles it on, and
every imported value is labelled `IMPORTED` with its source and fetch timestamp. Data flows
browser → our Spring Boot backend → provider, so the API key never leaves the server; the backend
caches responses (5 min) and respects the provider's rate-limit response headers (free tier: 10
requests/minute, delayed data). The mapper layer is unit-tested against captured real API
responses. Requires the backend running with `FOOTBALL_DATA_TOKEN` set — see `backend/README.md`.

**Disabling demo data:** Settings → *Demo data* off. Every module then shows an explicit empty
state — sample values are never silently substituted (spec §19).

### Data provenance labels

| Label | Meaning |
|---|---|
| DEMO | Fictional data for interface testing. Not real football facts. |
| IMPORTED | Loaded from a named external source (source, time, attribution recorded). |
| CALCULATED | Derived from stored records with a documented definition and version. |
| MODEL_ESTIMATE | Output of an analytical model (e.g. xG/xA) — interpretation, not measured fact. |
| MANUAL | Human-entered annotation (local to your browser in Phase 1). |
| VERIFIED | Reviewed by an authorised person, process recorded. |

## Match simulation script (demo generator)

Every demo match runs a minute-ordered match script before goals, shots, passes
and tags are generated, so dismissals, injuries and substitutions change who can
act next — and therefore minutes, per-match ratings and average positions.
Each substitution event stores its reason in the event note.

- **Five substitutions per team, maximum** (hard cap). Average ≈ 3.8/team.
- **Serious injuries** (ACL, Achilles, knee hyperextension, hamstring tear,
  muscle pull, ankle/MCL sprain): can happen any time, player comes off
  immediately; if the team has no substitutions left it plays on a man down.
  When caused by a tackle: 6/10 red card, 3/10 yellow, 1/10 no card (awkward
  landing / non-foul causes make up the rest).
- **Knocks** (dead leg, ankle knock, muscle tightness, heavy collision, rolled
  ankle): physio assesses first; the player tries to continue ~55% of the time,
  otherwise he is replaced 3–8 minutes later. Tackle-caused: 6/10 yellow,
  3/10 red, 1/10 no card.
- **Tired players**: usually 2–3 changes between 45' and 75', aimed at the
  highest-workload players (touches/carries/recoveries rates) and at players
  having an unusually good or bad day (a per-match form roll).
- **Late changes** (75'–89'): scoreline-aware — winning teams shore up with
  defensive swaps, losing teams chase with attacking ones.
- **Bookings**: a first-half yellow can trigger a protective substitution
  20–30 minutes later; a 46'–60' yellow leads to a change more often when
  winning (50%) than drawing (30%) or losing (15%). A second yellow is a red.
- **Red cards**: the player is gone for the rest of the match (no further
  events). Defender/midfielder dismissed → 75% chance of a defensive
  reinforcement 1–5 minutes later. Forward dismissed → no substitution.
  Goalkeeper dismissed → an outfielder is sacrificed for the spare keeper.

In Match Analysis, the **average positions** view shows starters only by
default; **Show subs** adds each substitute's own average position (smaller
dot, dashed ring, sub-on minute in the player list). Heat maps register
progressive carries along their path, use a data-driven kernel scaled in
metres (so the 105m × 68m pitch does not squash the cloud), reflect density
at the touchlines, and render above other average-position markers: a
genuinely broad spread can therefore overshadow nearby players while the
underlying markers remain clickable through the pointer-transparent layer. Overview's **Top
performances** can be filtered by position view (Overall / Goalkeepers /
Defenders / Midfielders / Forwards), competition, team, sort metric (overall
rating, goals + assists, goals/90, goals + assists/90, chances created,
passes, recoveries, carry distance and shots), minimum minutes and result
count. The Overview Home **Top performers** table likewise defaults to the
all-round Overall rating and can instead be ranked by goals/90, goal
involvement/90, assists, xG/xA, chance creation, progression, passing,
defending, duels or goalkeeper saves.

## Open match system (headless)

The match engine plays without the game around it. One request in, one result
out — no browser, no React, no clock:

```
cd frontend
npm run match -- --seed 8100 --minutes 12          # text summary
npm run match -- --repeat 8 --minutes 12           # a calibration batch
npm run match -- --request examples/match-request.json --json > match.json
```

Same request, byte-identical output: every figure in the docs can be re-derived
from a command instead of trusted. Request/result schema, determinism rules and
the measured calibration table are in [`docs/open-system.md`](docs/open-system.md).

## Learning movement from match video

Footage in, movement out. A clip is tracked (fixed camera), described as seven
numbers per line, and the engine's role parameters are fitted to that
description — six bounded numbers, written to a JSON file that plays with
`npm run match -- --motion`.

```bash
python3 vision/track.py --clip match.mp4 --corners ... --out tracks.json
python3 vision/build_movement.py --tracks tracks.json --out movement-target.json
cd frontend && npm run fit -- --target ../movement-target.json --out movement-model.json
npm run match -- --motion ../movement-model.json --repeat 8
```

It is system identification, not a neural policy — and the doc says exactly where
that stops: [`docs/motion-learning.md`](docs/motion-learning.md). Examples of
each artefact are in `vision/examples/`.

## Theme system

Two themes share one token set (`frontend/src/index.css`), swapped under `html.light`.

- **Dark — Volt Monochrome.** Neutral black/charcoal surfaces with a single volt accent reserved for
  selection, focus and key figures. Structure stays neutral so volt always means "this is selected".
- **Light — section-coloured daylight.** Not white paper: the background is a low-alpha wash of three
  hues that changes with the area of the product (`data-app-section` on `<html>`), sourced from the
  navigation section's `hue`:

  | Section | Daylight hues |
  |---|---|
  | Intelligence | mint → sky → teal |
  | Analysis tools | sky → lilac → teal |
  | Community | amber → rose → lilac |
  | Account & settings | lilac → sky → mint |

  Panels are translucent so the wash reads through them, data bars run a mint → sky → lilac gradient,
  table headers and zebra rows are section-tinted, stat values take a hue from the `--color-chart-*`
  palette, and each nav group's heading carries a coloured dot whose hue also colours icon hovers.
  Volt remains the only "selected" colour in both themes.

## Technology stack

| Layer | Choice |
|---|---|
| Frontend | React 19, TypeScript 5.9, Vite 7, Tailwind CSS 4, shadcn-style components on Radix UI, Lucide icons, Recharts 3, SVG pitch |
| Backend (Phase 2a, implemented) | Java 21, Spring Boot 3.5, REST (`/api/v1`), Maven, Spring Data JPA, Bean Validation |
| Database (Phase 2a, implemented) | PostgreSQL + Flyway migrations (`V1` schema, `V2` DEMO seed) |
| Testing | Vitest + React Testing Library (frontend), JUnit 5 + Spring Boot Test + Testcontainers (backend) |

The backend was **written but not compiled/executed** in the authoring environment (Java 11 only, no
Maven — it cannot run Java 21/Spring Boot). Per the project specification nothing is claimed to
work until it is actually built and tested: run `mvn clean verify` on Windows following the exact
commands in [`backend/README.md`](backend/README.md). The schema as implemented is documented in
[`docs/DATA-MODEL.md`](docs/DATA-MODEL.md). Docker is not required for the first local version
(a Testcontainers-free test mode is documented). Authentication is deferred to Phase 2b by scope
decision — see [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Known limitations (Phase 1 + Phase 2a)

- **Backend written but not yet executed** — the Phase 2a service (bootstrap + core reads + manual
  event tagging) needs local verification (`mvn clean verify`) before anything is claimed to work.
- **No authentication yet** — accounts, roles and server-side permission checks are Phase 2b; do
  not expose the backend publicly before then.
- **No real football data** — no licensed provider is connected; nothing real is claimed. The
  backend seed is a smaller DEMO dataset (4 teams, 24 players, 4 matches) labelled DEMO everywhere;
  the richer in-browser demo dataset (2,304 players) still powers demo mode when no backend is set.
- **User content stays client-side** — scenarios, notes, tags, posts live in `localStorage` (MANUAL
  label); server-side persistence arrives in Phase 2b/6.
- **News is fictional** — no feeds are fetched; real integration requires official/licensed sources.
- **AI assistant is a deterministic mock** — clearly labelled; no LLM API is called.
- **No video analysis** — no upload, tracking or automatic event detection exists or is claimed.
- **Tactical Lab is a planning tool** — drawn sequences are not validated simulations.
- Single competition, no i18n, limited a11y testing beyond keyboard focus states and ARIA labels;
  ESLint not yet configured.

> **Frontend audit (Oct 2026):** every route and interactive control was reviewed and exercised
> automatically before new feature work. 8 defects were found and fixed (per-90 mislabeling in
> rankings, tactical-scenario save collision/autosave/deep links, discussion replies to demo posts,
> cross-match/cross-room state leaks, manual-tag team attribution). Full findings and the
> functional-vs-placeholder classification: [`docs/PHASE1-AUDIT.md`](docs/PHASE1-AUDIT.md).
> Test suite: 66/66 (11 files), TypeScript clean.

## Development workflow

Each phase follows: inspect → list changes → implement small coherent features → build & test → fix
→ verify → report → update docs → **wait for approval**. See [`docs/ROADMAP.md`](docs/ROADMAP.md)
for the full plan and the Phase 2 approval checklist.
