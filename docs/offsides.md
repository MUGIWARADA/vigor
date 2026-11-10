# Offside: 30 a match, then three

The aggregate from the open system (`npm run match -- --repeat 8`) showed the
engine catching a side offside **more often than it hit the target**: 27.8 a
match in the first reading, and 30.1 across forty seeds once the sample was
properly sized. Real football is about four, two per side.

It is now 2.96 — and the second half of that journey is not a bug fix but a
behaviour, added deliberately once the fix had gone too far (see §7).

This is that defect found, measured, fixed and guarded — in that order.

## 1. What the probe found

A probe ran ten twelve-minute matches and recorded, for every ball played to a
man the engine considered offside: who was flagged, where he stood, where the
ball was, and whether any legal team-mate existed at that moment.

| reading | value |
|---|---|
| offside passes played | 56.4 a match |
| converted to a whistle | 36.0 a match (64 %) |
| depth beyond the last defender | median **6.3 m**, p90 15.4 m |
| only 13 % were within 2 m | so these were not mistimed runs |
| legal team-mates available | **7.2 on average, never zero** |
| ball played from | local x ≈ 46, into a man standing at x ≈ 68 |
| flagged receiver | 45 % central/wide midfield, not forwards |

Two facts decided the diagnosis. First, **the carrier always had legal options**
— this was not a side with nothing on being forced to hit a hopeless ball.
Second, **the depth was enormous**: a player six metres beyond the line is not
mistiming a run, he is standing in an illegal position that the scoring function
found attractive.

## 2. Three defects, all the same shape

**a. Legality was a weight, not a filter.** `chooseReceiver` scored every
candidate and applied a flat `-60` to an offside receiver. But the positive terms
stack: angle up to +34, forward gain +18, space +13.8, runner +9, between-lines
+5.4, final-third +7, stage and support bonuses on top. A forward standing six
metres beyond the line with space in front of him could clear the penalty
comfortably.

**b. The driven-ball branch had no offside check at all.** `drivenPassOption`
exists to find "a man between the lines" and scored it as *final third, space,
forward gain* — which is exactly the description of a player standing beyond the
last defender, because **that is why the space is there**. 83 % of the offsides
came through it. The definition was wrong, not the tuning: "between the lines"
had been implemented as "advanced and uncrowded".

**c. The fast restart deliberately targeted an offside man.** A quick throw or
free kick looked for a team-mate `local.x > oppLine + 3` — beyond the opposition's
deepest outfield player — and gave him a +4 bonus. That is correct for a
throw-in, which cannot be offside, and wrong for a free kick or an offside
restart, which can. A stack trace at the point of the illegal pass named
`executeRestart` for every remaining case. Free kicks were also taking the ball
straight back offside, so the engine was sometimes producing two whistles in a
row from one mistake.

## 3. The fix

**A measure, not a constant.** `offsideOvershoot(state, receiver, passer)` returns
how far beyond the last defender a man is, in metres, or zero if he is legal. It
asks the referee's question in the referee's units, so the two places that choose
a pass can use it as a filter.

**Legality as a filter.** Both `chooseReceiver` and `drivenPassOption` drop
candidates whose overshoot exceeds `OFFSIDE_MARGIN_M = 1.2` — one stride, the
mistimed run that actually happens. If nobody is legal, the full list comes back:
a side with nothing on still has team-mates to consider. The cutback branch got
the same filter, since its target (a man arriving at x ≈ 83) was picked purely on
proximity to a spot beyond the line.

**The Laws, applied literally.** `quickRestartOpportunity` now skips candidates
beyond the second-last defender unless the restart is a throw-in. The quick
release survives where it is legal; the shortcut does not travel with it.

A fourth fix fell out of the probe: `state.ball.driven` was never cleared by a
plain pass, so the flag was sticky and the "how many of these were driven balls"
reading was wrong until it was reset in `executePass`.

## 4. Before and after, forty seeds, identical

`npm run match -- --seed 8100 --repeat 40 --minutes 12`

**Units, because this bit me:** goals are per match, everything else the engine
reports per side. Doubling a per-side figure is the difference between 1.5
offsides and 3, so the aggregate now names its units in the field names
(`offsidesPerSide`, `goalsPerMatch`) and prints them under two headings. The
first version of this document got it wrong.

| | before | after the legality fix | after mistimed runs | real football |
|---|---|---|---|---|
| **offsides, per match** | **30.1** | **2.32** | **2.96** | ~4 |
| offsides, per side | 15.06 | 1.16 | 1.48 | ~2 |
| depth beyond the line | median 6.3 m | median 0.75 m | median 0.56 m | a stride |
| goals per match | 5.10 | 5.98 | 5.95 | 2.7 |
| shots per side | 10.13 | 10.54 | 11.18 | ~13 |
| on target | 80.7 % | 83.0 % | 79.6 % | ~33 % |
| corners per side | 2.01 | 2.58 | 2.75 | ~5 |
| fouls per side | 7.13 | 7.28 | 7.98 | ~11 |
| **pass completion** | **64.5 %** | **77.9 %** | **78.1 %** | 75–85 % |

Pass completion is the quiet result. Roughly thirteen passes a match used to be
played into an illegal position and thrown away; with them gone the side keeps
the ball, and the number landed inside the real range for the first time without
anything being tuned to make it happen. It survives the mistimed runs, which is
the point of §7: three offsides a match is the cost of forwards gambling, and it
costs about a tenth of a pass per team.

## 5. Guarded

`offsides.test.ts` holds the fix from both ends:

- **no illegal pass** — across three matches, the worst overshoot of any pass the
  engine plays is ≤ 1.3 m (the allowance plus rounding);
- **offside still happens** — across four matches, at least one and no more than
  sixteen whistles, because a rule that never fires is indistinguishable from a
  rule that was deleted.

The old assertion in `frontline-timing.test.ts` allowed up to twelve offsides per
team. It passed before this work and after it, which means it was guarding
nothing. It now asserts fewer than four per team — a bound the old engine
violated by a factor of three.

## 6. What is still not right

**1.16 is under real football's four.** The gap is not a legality problem and
should not be closed by widening the allowance — that would re-open exactly the
defect this chunk fixed. The missing behaviour is *mistiming*: a runner who goes a
half-second early because his `response` or `anticipation` told him to, and the
pass arriving after the line has stepped up. That is a decision to model, not a
tolerance to loosen, and it is the next lever if the figure matters.

**The other calibration gaps are untouched**: corners at 2.58 against ~10, shots
at 10.5 against ~13, fouls at 7.3 against ~10.8. Corners are the largest and were
already the subject of `docs/corner-conversion.md`; the deflection mechanic that
took them from 2.26 to 2.88 has not been re-measured against this change.

## 7. Mistimed runs

The legality fix produced a side that was **never** offside in any way that
mattered: 2.3 a match, and all of it accidental, from the one-stride allowance
left in the filter. Real sides are caught about four times. The difference is not
tolerance, it is behaviour: forwards gamble a stride early and are sometimes
wrong. A rule that never fires is indistinguishable from a rule that was deleted,
and `docs/offsides.md` §6 said so before this chunk existed.

`lineGambleM` is that behaviour, in two halves:

- **Appetite.** `(aggression + attack) / 2 − response × 0.62` decides how far past
  his shoulder a player is willing to play. The poacher gambles; the false nine,
  who reads the moment better, does not. Per player, no slider, no new attribute.
- **Timing.** Going early is an event, not a personality. A slow oscillation with
  a per-player phase means the same man does not mistime every run, and it is
  deterministic — the same seed still produces the same match.

The result is capped **where he may end up**, not how far he may travel: a stride
past the line at most, inside the referee's allowance. The first version capped
the travel, which sounds equivalent and is not — with travel capped, only the man
already standing on the shoulder could ever gamble, and the rest of the line was
structurally incapable of mistiming anything. That is why the first attempt moved
the number from 1.16 to 1.48 and stopped.

| | per side | per match |
|---|---|---|
| legality fix only | 1.16 | 2.32 |
| + mistimed runs | **1.48** | **2.96** |
| real football | ~2 | ~4 |

Median overshoot at the moment the pass is played: **0.56 m**. Conversion of a
flagged pass into a whistle: 84 %.

### Why it stopped at three, and what finished it

`2.96` against `~4` is 74 % of the real rate, and closing the rest by widening the
gamble would re-open exactly the defect §3 fixed — a bigger gamble is a longer
allowance, and a longer allowance is how the engine got to thirty.

The remaining fourth came from the other side of the ball. Attackers were tracking
the last defender **perfectly, every frame**, so no defence could ever strand
anyone: a line that stepped up simply dragged the front line with it. Giving the
attack a half-second of reaction lag — the flag still judged on the true line, the
pass played against the line the carrier has registered — took it to **3.86**,
which is where real football lives. That is `docs/stepping-line.md`.

The one thing it did not deliver is the classic trap, which needs a different
model of how a forward holds a line. That is documented there, with the experiment
that failed and the reason.
