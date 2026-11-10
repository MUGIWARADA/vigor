# The open match system

The engine can now play a match with nothing around it: no browser, no React,
no canvas, no clock. One request in, one result out.

```
npm run match -- --seed 8100 --minutes 12
npm run match -- --repeat 8 --minutes 12          # a calibration batch
npm run match -- --request examples/match-request.json --json > match.json
```

That is the whole claim. Anything that can run a command — a shell script, a
notebook, a CI job, an outside agent — can drive the game and read the same
numbers the post-match report reads.

## Why this and not something else

Because the alternative is trusting prose. Every figure in `docs/` was produced
by a hand-written probe that lived in a `zz.tmp` file, ran once, and was deleted.
The corner table, the goal-origin split, the 78 % on-target figure — all of them
are only as good as a test file nobody can run any more. An engine that can be
asked a question in one command is a different kind of object: the claim and the
evidence ship together.

It also happens to be the thing the reference landscape said was worth copying
(§4 of `docs/reference-landscape.md`): an ablation and calibration harness. This
is the substrate for that, not the harness itself.

## The contract

`src/game/open.ts` is the public surface. Three functions matter:

| | |
|---|---|
| `parseMatchRequest(unknown)` | anything that arrived as JSON → a request, or a list of errors naming the field |
| `runMatch(request)` | a request → a result. Pure: no I/O, no clock, no `Math.random` |
| `resultJson(result)` | key-sorted JSON, so equal results are equal strings |

**Request**

```json
{
  "seed": 8100,
  "minutes": 12,
  "home": "bracelonia",
  "away": "banyarn",
  "difficulty": "normal",
  "rules": "standard"
}
```

`home` and `away` are either a club id or `{ "team": "...", "plan": { ... } }`
where `plan` is a full tactic sheet (`TeamPlan` from `game/data`). A plan that
belongs to the other club is refused rather than silently ignored. Everything
but the two sides has a default.

**Result** — `engine` (version string), `request` (echoed, normalised), `score`,
`teams` (per side: every `TeamStats` field plus `possession`, `passCompletion`,
`shotAccuracy`), `goalOrigins` (counts by the dead ball that started the move),
`goals`, `events` (the full match log), `players` (rating, distance, the
possession split, top speed) and `fullTime`.

**Refusals name the field.** `home: "arse" is not a side (bracelonia, banyarn)`,
not `invalid request`. A system that cannot say what is wrong with an input is
not open, it is just unguarded.

## Determinism

Same request → byte-identical JSON, on any machine, forever. That is asserted in
`open-system.test.ts`, not merely intended:

- `runMatch` reads no clock and no global RNG (the engine carries its own `rng`
  in state);
- `resultJson` sorts object keys, so insertion order cannot leak into a diff;
- the seed advances by one per match in `--repeat`, so a batch is reproducible
  from its first seed and its length alone.

Which is what makes a figure like "4.08 goals a match" checkable by someone who
does not believe it.

## What it already shows

Eighty matches (two blocks of forty, seeds 8100–8139 and 15000–15039), twelve
minutes each, default plans — the documented figures, two commands:

| | measured | target / real |
|---|---|---|
| goals per match | 5.97 | 4–9, most 4–6 ✓ |
| on target | 81.7 % | ~78 % ✓ |
| shots per match | 22.9 | ~26 real |
| corners per match | 6.6 | ~10 real |
| fouls per match | 22.0 | ~22 real ✓ |
| pass completion | 77.5 % | 75–85 % real ✓ |
| set-piece share of goals | ~26 % | ~28 % real ✓ |
| offsides per match | 4.37 | ~4 real ✓ |

Every figure in this table was re-measured after a harness bug was found in
October 2026: `simulateMatch` was stopping matches a few percent early, so all
prior aggregates were slightly low (`docs/fouls.md` §10). Two seed blocks are
quoted rather than one because a single block moves goals by up to 0.4 and fouls
by 0.25 a side purely on which seeds were picked (`fouls.md` §9).

The last row is the one that mattered. When this table was first produced the
engine was caught offside **27.8 times a match** — more offsides than shots on
target, seven times the real rate, visible for weeks as "roughly 9 per team" in a
test nobody read. The aggregate made it impossible to ignore, and it was fixed in
two chunks: legality as a filter rather than a weight, then deliberately
re-introducing mistimed runs once the fix had over-corrected. See
`docs/offsides.md`.

## Limits, stated plainly

- **No human input.** `humanTeams` is empty by construction: this plays the AI
  against itself. Driving a match with an external agent's actions needs
  `stepMatch` exposed in the same way, which is a second, larger job.
- **Minutes are engine minutes.** Twelve minutes of play is a compressed match,
  not twelve minutes of a ninety-minute clock. `possessionSeconds` is scaled to
  a ninety-minute frame inside the engine; distances and speeds are not. Do not
  divide one by the other.
- **No frame-by-frame trace.** Ball position and player positions per tick are
  not in the result; the event log and the per-player totals are. Adding a trace
  would multiply the file size by about a thousand.
- **Stability.** `1.0.0` is the schema. Fields may be added; renaming or removing
  one bumps the major version.
- **Licence.** This is our code, MIT-inclined, and `docs/bundle-audit.md` is
  where the bundle's licence position lives. The reference projects that shaped
  it are ideas only — see `docs/reference-landscape.md` §5.
