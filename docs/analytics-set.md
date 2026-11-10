# Analytics set — territory, work rate, and ratings that explain themselves

## 0. The repo, still being watched

`Mhmdwael77/ai-football-analytics` latest commit is **20 Sep 2026** — "Fixed squad
numbers, pitch-role detection, and quality metrics that measure output" — with
tests at 628. What changed since the assessment:

- **`tracking/roster.py`** — stable ids 1–11 per team, 0 for the ball, officials
  unnumbered. Identity is assigned before the footage exists, so a failure to
  assign is visible instead of silent.
- **`tracking/swap_corrector.py`** — the repaired exchange is placed at the
  *crossing*, not where the jersey colour finally changes. Appearance tells you
  *that* two tracks swapped, never *when*; cutting at the colour boundary made
  each repaired track teleport (worst step 376 → 37 px/frame).
- **`analytics/pitch_role.py`** — keeper versus match official decided from where
  a figure walks, in metres, because kit colour cannot do it: a keeper's kit
  differs from both teams by design, so a colour rule benches him with the
  officials.
- **`calibration/auto_calibrator.py`** — scores candidate homographies against
  paint they were *not* fitted to, drops the wrong ones, propagates survivors.
  Not yet wired into `main.py`.
- **`tests/test_tracking_quality_real.py`** — the first tests that measure real
  output against recorded fixtures. Their note: baselines are **ceilings, not
  targets**, and remaining faults are asserted by name.

Still directly relevant to us: the roster-id idea and the "assert the fault by
name" discipline. Still not usable as code — the licence remains
self-contradictory (MIT badge plus an "all rights reserved, no permission
granted" notice). Ideas only.

## 1. Territory — where you had the ball, not just how long

`tactics.ts` now records the ball's position, in each side's own attacking frame,
on every one-second sample, into all three phase buckets. That gives two numbers
that "60 % possession" hides:

- **Territory** — mean ball position in possession, in metres from own goal.
- **Possession thirds** — share of in-possession time spent in own / middle /
  final third.

Measured on one match: Bracelonia 48.4 m territory, thirds 23 / 65 / 12; the
opposition 47.6 m, 24 / 66 / 10. Both sides spend two-thirds of their possession
in the middle third, which is exactly the sort of thing possession percentage
cannot tell you and the panel now shows.

The reading also prints the out-of-possession figure and compares both to the
block height, so you can see whether the side's ball was ahead of or behind its
own shape.

## 2. Work rate — sprint distance and top speed

Per player, per frame: `topSpeedMps` (fastest single frame), `sprintDistance`
(metres covered above 7 m/s / 25.2 km/h) and `highIntensityDistance` (above
5.5 m/s / 19.8 km/h). Sample output from one match:

| | distance | sprint | high intensity | top speed |
|---|---|---|---|---|
| Bracelonia (squad) | 38.0 km | 4.85 km | 9.68 km | 31.1 km/h |
| Banyarn (squad) | 36.7 km | 3.35 km | 9.32 km | 30.2 km/h |
| busiest player | 3.91 km | — | — | 28.8 km/h |

**Top speed is the honest number here** — 28–31 km/h sits exactly where elite
players sit (33–35 km/h is the record end, 30 is a normal sprint).

**Distance is not.** These matches run 12 simulated minutes while the clock
displays ninety, so a starter covers 3–4.5 km against a real 11 km. The panel
therefore leads with **sprint share** (percent of a player's running above the
threshold — scale-free and genuinely comparable) and labels distance as
simulated. Pretending 3.9 km is a workload would be the kind of number that looks
authoritative and means nothing.

## 3. Ratings that explain themselves

`ratingReasons(player)` returns every contribution to a match rating with the
number behind it — goals weighted by position, 0.018 a completed pass, 0.13 an
interception, distance, fouls, cards — and `playerRating` is now defined as the
sum of exactly those deltas, so the explanation and the score cannot drift apart.
Every rating in the report opens on click.

One real bug surfaced while writing it: **the distance term was constant.** It
capped at 0.45 above 9 km, and nobody in this engine covers 9 km, so every
starter scored ~0.43 and the term distinguished nobody. Rescaled to 4.5 km,
where the engine actually operates, so hard running now separates players.

Sprint distance is deliberately reported with **zero rating weight**, and says so
in the panel. It is already paid for through the distance total; paying twice
would reward the wrong players.

## 3a. The phase split, and the per-90 decision

Distance is now recorded **in two phases** as well as in total: metres covered
with the ball and without it, and sprint metres in each. The counters partition
the same distance exactly (a test asserts the two halves sum to the total), so
nothing is invented or lost — a full-back who overlapped reads differently from
one who spent the match shuffling across in a block.

**Per-90 normalisation was deliberately not shipped.** The engine plays 12
simulated minutes while the clock displays ninety, and its players never walk, so
a "per 90" figure would have to multiply by 7.5 and would claim ~29 km a player.
The panel instead reports **metres per minute of engine play**, which needs no
fudge factor, and says in the caption that a real player covers about 122 of them
and why these players cover more. Sprint share and top speed remain the two
figures that compare directly to real football.

## 4. Verified

336 tests green (5 new in `analytics-set.test.tsx`), typecheck clean, build ✓
8.4 s. The new tests assert that territory lands on the pitch and the thirds add
up, that sprint distance is a subset of total distance and top speed is a human
speed, that a rating's reasons sum to its score, and that the panels render and
the rating detail opens.

## 5. Not done

- **Per-90 normalisation** — decided against, see 3a: metres per minute of engine
  play is honest and needs no scaling.
- **Output-quality metrics** — the repo's `tracking_quality.py` equivalents
  (mid-pitch births, impossible links, kit changepoints) are in
  `engine-integrity.test.ts` for impossible steps and teleports, but there is no
  equivalent yet for identity stability, because the simulation has no reason to
  swap identities. That gap opens when the video pipeline starts.
