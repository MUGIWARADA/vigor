# Corner conversion — measured, and why it is already where it should be

*The queue item was "raise corner conversion". This is the measurement, five
attempts, and the conclusion: there is nothing wrong with the conversion rate.
The outlier is how few corners a match produces.*

All figures are 60 matches (5× the usual probe), seeds `8100 + i*331`,
`halfSeconds: 360`, no stalls in any run.

## 1. The baseline

| metric | value |
|---|---|
| goals / match | 3.65–3.72 |
| shots / match | 13.1–13.8 |
| corners / match | 2.25–2.27 |
| corners that produce a shot | ~85 % |
| shots per corner | ~1.15 |
| goals per corner (conversion) | **11–12.6 %** |
| corner goals / match | 0.25–0.28 |

Two comparisons change the whole question:

- **Real football converts about 3 % of corners.** This engine converts 11–12.6 %.
  Per corner, it is already three to four times more dangerous than the real
  thing.
- **Real football produces about 10 corners a match.** This engine produces 2.3.
  That is the outlier, and it is the only reason corners feel like an
  afterthought.

Net: corner goals per match here (0.25–0.28) are roughly what real football
produces (~0.31) — by converting a quarter of the corners at four times the
rate. The system is not broken; it is concentrated.

## 2. The anomaly underneath it

Corner shots average **6.1 m from goal** (median 5.5). Open-play shots average
**15.0 m** (median 16.1). Corner shots convert at **~10 % per shot**; ordinary
shots convert at **27 %**.

So the closest shots in the game are the least likely to go in. That looked like
the real bug and was worth chasing — it is the thing that would genuinely raise
conversion without adding corners.

## 3. Five attempts, all measured, all rejected

| change | corner goals | conv. | goals/match | verdict |
|---|---|---|---|---|
| baseline | 17 | 12.6 % | 3.65 | — |
| target the biggest, least-marked attacker in the zone instead of the nearest | 11 | 7.6 % | 3.63 | **worse** |
| start the box runners at the penalty spot so they attack the ball | 17 | 11.0 % | 3.53 | flat, and cut shot-producing corners from 84 % → 53 % |
| blocked shot that was heading into the goal mouth goes behind more often (62 % vs 22 %) | 13 | 9.0 % | 3.47 | flat |
| keeper claims fewer of the deliveries he reaches (ceiling 0.55 → 0.30) | 14 | 9.4 % | 3.48 | flat: 99 % of corners now produce a shot, still 9 % conversion |
| headers treated as close-range finishes, not tight-angle toe-pokes | 15 | 9.7 % | 3.55 | flat |

Every one of them is reverted. Two of the five look like they should work on
paper and do not, which is the useful part: the header's accuracy model is not
what keeps corner shots out, because most corner "shots" are not the header —
they are what happens next, from the edge of the box, into a crowded six-yard
area. And the delivery is not the problem either: the ball already follows the
runner, so pushing runners deeper just drags the delivery away from goal.

The honest caveat: at this sample size (≈145 corners per run) the difference
between 11 % and 13 % is inside noise. What the runs *do* support is the negative
claim — none of these levers moved conversion upward by more than noise, and two
moved it down.

## 4. What was actually fixed

While reverting, the keeper-screen attacker was left a metre off his mark
(99.5 m from goal instead of 100.5 m). The set-piece shape suite caught it —
`the routine decides which post the delivery attacks` failed with a delivery
landing on the touchline. Restored. That is the second time this session a shape
assertion has caught a regression I introduced myself while measuring.

## 5. Recommendation

Conversion is not the lever. **Volume is.** Real football gets ~10 corners a
match from three mechanisms this engine only partly models:

1. **Deflections** — a shot or cross touching a defender and going behind.
   Present, but only for blocks inside 27 m and headers inside 24 m.
2. **Saves pushed behind** — present, and it is currently where corners come from.
3. **Nothing else.** There is no post-and-out, no keeper tip-over that rebounds
   short, no shanked clearance out of play.

Adding (1) properly — any defensive touch on a ball travelling goalward, anywhere
in the box, with a geometry-dependent chance of going behind — would plausibly
take corners from 2.3 to 4–5 a match. At a 12 % conversion that is 0.5–0.6
corner goals a match instead of 0.27, and it is a real mechanic rather than a
tuned probability.

That is a separate chunk, and it should be measured on its own.

## 5a. What was actually built (after the recommendation above)

The recommendation was accepted: raise volume, not conversion. The mechanic now
in `engine.ts` is **deflections**, and it is general rather than a tuned
probability:

- any defensive touch inside his own box on a ball travelling **toward the goal
  he is defending** can ricochet behind — a header off a cross, a leg on a
  driven pass, a shin on a cutback;
- the chance rises with how close to the byline the contact happens
  (0.30 at 30 m out, 0.62 inside six metres);
- previously only a header of a *cross* within 24 m counted, which is why
  corners were so rare — most real corners come off legs, not heads.

| | before | after |
|---|---|---|
| corners / match | 2.25–2.27 | **2.88** |
| corner goals / match | 0.25 | 0.27 |
| conversion per corner | 11–12.6 % | 9.2 % |
| goals / match | 4.0–4.3 | 4.08 |
| shots / match | 13.6 | 13.8 |
| stalls | 0 | 0 |

Corners up 27 %, goals untouched, and the conversion *rate* fell because more of
the corners are indirect deflections — which is exactly what real football looks
like. 60 matches, same seeds.

## 6. One more thing the sample size exposed

The long-standing "4.17 goals per match" figure comes from 12 seeds. Across 60
seeds the same engine averages **3.65–3.72** — below the floor of the 4–9 target
band. Nothing changed between those measurements except how many matches were
played. The 12-match number was a lucky sample, and the tuning decisions that
were validated against it deserve a re-check on the larger one.

## 7. The two bugs that were actually holding volume down

§5a claimed deflections were the mechanic that would take corners to 4–5 a
match, and measured 2.88. That number was real but it was produced by a branch
that was firing for the wrong reason. Both faults are the same mistake, and it
is a mistake this codebase has made before: **`goalTarget(state, teamId)` is the
goal a side *attacks*; `ownGoal(state, teamId)` is the one it *defends*.** Every
defensive branch in this file has to use the second one.

### Bug 1 — the block branch measured the wrong box (~line 5162)

The branch that turns a blocked shot into a corner tested the shot's distance to
`goalTarget` for the *defender's* team — i.e. the box at the far end. A defender
can only block a shot inside *his own* box, so the condition was never true.
The branch was **dead**: it contributed 0 % of corners, on every seed.

The probe made this concrete. Monkey-patching the branch entry points showed 24
shots reached the interception logic across 3 matches, 7 were blocked, and
**0 were blocked within 27 m of the goal** — not because defenders never block
close to their own goal, but because the branch was looking 80 metres away.

### Bug 2 — the deflection branch awarded the corner to the wrong team (~line 5196)

Worse, and quieter. The deflection branch also used `goalTarget`, so its
"toward the goal he is defending" test only passed when the *defender's own team
was attacking*. It then set a corner — **for the defending side**. Two faults in
one branch: the geometry was inverted, and a corner is legally the attacker's
when the defender puts it behind his own line.

`behindX` was derived from the same wrong goal, which is why the resulting
restart sometimes appeared at the wrong end.

### Why it was invisible for so long

There were no tags. Four structurally different events — a header off a cross, a
keeper pushing a shot behind, a blocked shot, a ricochet off a shin — all
produced an identical `restart: { type: 'corner' }` on the stats sheet. "Corners
are low" had no diagnosable component, so §3's five rejected levers were all
tested against a number that averaged together one working mechanism (keeper),
one half-working one (header) and two dead ones. That is why they all read as
noise.

`RestartState.cause` now exists for exactly this reason. Every corner site tags
itself: `header`, `keeper`, `block`, `deflection`, `goal-line:<kind>`, and the
tag is carried onto `state.restart`.

### The measured effect of each fix

12 seeds × 6 min, fixed fixtures, corners per **side**:

| state | corners/side | /match | cause mix |
|---|---|---|---|
| before | 2.29 | 4.58 | keeper 53 %, header 33 %, deflection 15 %, block **0 %** |
| block branch → `ownGoal` | 2.67 | 5.34 | block now 19 % |
| deflection branch → `ownGoal` | **3.88** | **7.75** | header 33 %, keeper 31 %, block 26 %, deflection 9 %, goal-line 1 % |

Re-measured on the standing 40-seed × 12 min aggregate, which is the number to
quote: **corners 3.34 per side (6.68 per match)**, up from 2.69 before this
chunk — **+24 %**, against real football's ~10. (Re-measured again after the
harness fix in `fouls.md` §10: 3.32 per side over 80 matches, i.e. unchanged.)

The rate is not the whole story. The *mix* is now plausible for the first time:
headers, keeper saves and blocks in roughly equal thirds, rather than two thirds
of everything coming from saves.

### Supply was checked, and it was never the bottleneck

Before accepting the branch fixes as the cause, the feed was measured directly
over 8 matches: **5.7 crosses per side**, **2.13 block-corners per match**,
10.9 shots per side, 1.4 crosses per corner. The deliveries and the blocked
shots were always happening. They were being thrown away by geometry.

## 8. Where this leaves the volume target

6.68 per match is ~67 % of real football on the strict aggregate, ~78 % on the
12-seed probe. The remaining gap is one mechanism, not four: a defensive touch
anywhere in the box on a ball travelling goalward should have a
geometry-dependent chance of going behind, and the branch shape now supports it.
What is *not* present is the class of corner that never follows a shot at all —
a shanked clearance, a keeper tip that rebounds short, a ball off the post and
out.

Pushing further has a cost that is now visible: corners carry a **22.4 % set-piece
share of goal origins**, so every corner added is also a small change to where
goals come from. Goals are at 5.78–5.93, comfortably inside the 4–9 band, and
the fluidity requirement outranks the corner count. **Volume stops here** unless
a later chunk finds corner goals drifting away from real football's ~0.31/match.
