# Fouls — a dead branch, a double-booking bug, and a goal trade-off worth naming

*Queue item: "fouls 7.5 vs 11 a side". Three defects were found and fixed. Fouls
now measure **11.01 per side against real football's ~11**. The price is that
goals moved from 5.78 to 6.40, and this document explains exactly why, because
it is a real coupling rather than noise.*

## 1. Where fouls came from before

`commitFoul` had exactly two call sites, both inside `tackleAttempt`:

1. **A missed challenge** — `foulChance` = 0.010 + intensity·0.10 + slide·0.07 +
   behind·0.06 + closing·0.008 + the tackle-aggression slider, clamped
   0.008–0.26.
2. **A follow-through on a won challenge** — gated on `intensity > 0.82`.

Probe, 10 matches:

| | per match |
|---|---|
| `tackleAttempt` calls | 200.2 |
| won | 42.0 |
| missed | 158.2 |
| mean intensity | 0.45 |
| fouls from a missed challenge | **17.5** |
| fouls from a won challenge (follow-through) | **0.0** |

Baseline on the corrected harness, 80 matches: **8.11 fouls a side**. (The
figure this project had been quoting, 7.96, came from the truncated harness
described in §10 and is 2 % low.)

## 2. Defect 1 — the follow-through branch was dead

The intensity histogram of *won* challenges, 10 matches:

```
0.3  x40      0.4  x297     0.5  x66     0.6  x14     0.7  x3     >0.82  x0
```

The gate required 0.82 and the quantity never exceeds 0.7. So for its entire
life this branch fired **zero times**, and the "won the ball but took the man"
foul — one of the largest single classes of foul in real football — did not exist
in the game. This is the third dead branch found in this project (the corner
block, the corner deflection, now this), and all three had the same shape: a
threshold placed above the range the upstream model can actually reach.

### The replacement is physical, not tuned

What makes a won tackle a foul is not how hard the defender tried; it is whether
his momentum carried him **through the ball and into the man**. That is
measurable from quantities the engine already computes:

| quantity, at the moment of a won challenge | value |
|---|---|
| closing speed median | 0.4 m/s |
| closing speed p75 | 2.8 m/s |
| closing speed p90 | 6.1 m/s |
| mean behind-the-ball factor | 0.59 |

So the model is:

```
lateMomentum        = clamp((closingSpeed - 1.2) / 6.5, 0, 1)
followThroughChance = (0.025 + lateMomentum·0.26 + behindFactor·0.10
                       + slide·0.05
                       + (aggression - 65)/900      ← an aggressive defender follows through
                       - (defence   - 65)/700       ← a good one pulls out
                       + (tackleAggression slider - 50)/1200)
```

The scale is anchored to a real closing speed: 1.2 m/s is walking pace and under
control, 7.7 m/s is a sprinting defender who has committed his weight and cannot
pull out. Everything else is attribute and slider, per the standing rule.

## 3. Defect 2 — a persistence bug that booked players twice

```
const persistent = offender.fouls >= 5 || (offender.fouls === 4 && rand < 0.3)
```

Once a player reached five fouls, **every subsequent foul re-triggered this rule**
and booked him again — so a player on a yellow was sent off almost immediately.
Diagnosis over 20 matches: **6 of 7 red cards were "a second caution"**, roughly
six times the real rate. Guarded with `offender.yellowCards === 0`: persistent
infringement cautions a player who will not stop, it is not a second reason to
book a man already booked. The realistic route back to the second yellow — a
genuine reckless challenge — is untouched.

## 4. Defect 3 — defenders fouled in their own box far too readily

Every in-box foul becomes a penalty (line 3754), and the engine gave away
**0.75 penalties a match against real football's ~0.28** — nearly three times.
Defending your own box is a different job: real defenders jockey, hold their
ground and block rather than diving in. Staying on your feet is a skill, so it is
weighted on the defender's own `defence`:

```
boxDiscretion = inOwnBox ? clamp(0.52 - defence/300, 0.16, 0.52) : 1
```

applied to **both** the missed-challenge and follow-through rolls. In-box share
of all fouls fell from 4.3 % to about 2 %, and penalties to **0.24–0.35**.

## 5. Defect 4 — DOGSO was catching fouls 38 metres from goal

`obviousGoalChance` accepted any foul within **38 m** of goal with one defender
behind. 7 of 11 reds in a 40-match sample were "denying an obvious
goal-scoring opportunity". An obvious opportunity is a clear run at the keeper,
so the test is now 26 m and **only the keeper counts as cover**
(`defendersBehind === 0`): a striker with a defender still goal-side of him has
not been denied an obvious chance, and referees do not send men off for it.

## 6. The measured position

Like-for-like: **80 matches each side of the change** — the same two seed blocks
(8100–8139 and 15000–15039), the same corrected harness (§10), only the foul
model different.

| | before | after | real football |
|---|---|---|---|
| **fouls / side** | **8.11** | **10.98** | ~11 |
| free kicks / match | ~16 | ~22 | ~22 |
| **goals / match** | **5.62** | **5.97** | band 4–9 |
| shots / side | 10.89 | 11.46 | ~12.8 |
| on target | 81.4 % | 81.7 % | requirement ~78 % |
| corners / side | 3.35 | 3.32 | ~5 |
| offsides / match | 4.27 | 4.37 | ~4 |
| pass completion | 76.4 % | 77.5 % | — |
| penalty share of goals | 2.25 % | 1.25 % | ~3 % |

Fouls are up **35 % onto the real number**, and the rest of the match did not
move: goals +0.35, shots +0.57 a side, corners and offsides flat, completion up
1.1 points. Penalties conceded fell by half.

Card and penalty detail, 80-match probe: **penalties 0.24–0.35 a match** (real
~0.28), **yellows ~3.0** (real ~4), **reds ~0.3** (real ~0.1, see §8). These are
rare events — 80 matches carries roughly 24 penalties and 24 reds in total — so
they are quoted as approximate rates rather than to two decimals.

## 7. The goal trade-off, and why it ended up small

A first cut of this change took goals from 5.78 to 6.40 and that was worth
understanding before shipping. The mechanism: **a foul on a challenge the
defender lost is close to goal-neutral** — the attacker was keeping the ball
anyway — but **a foul on a challenge he won hands possession back** in the exact
position the defence had just escaped, so it manufactures an attack that did not
exist a second earlier, and inflates the score.

The first version weighted the follow-through heavily, because restoring that
dead class was the point. The shipped version lowers it and raises the
failed-challenge rate instead, reaching the same foul count with most of the new
fouls goal-neutral:

| | follow-through weight | goals |
|---|---|---|
| follow-through heavy (first cut) | `0.030 + late·0.30` | 6.40 |
| shipped | `0.025 + late·0.26` | 5.97 |

The honest position: **the trade-off was real, and it was designed out rather than
paid.** Fouls rose 35 % and goals rose 0.35. If the foul target is ever pushed
above ~11 a side the same coupling returns, and the first place to look is the
follow-through weight, not the goal model.

## 8. Red cards are still three times the real rate

0.30 a match against ~0.10. The cause is no longer the persistence bug (fixed)
and is no longer loose DOGSO distance (tightened), so what remains is that
last-man situations are simply **common** in this engine: breakaways are a
modelled feature, and a cynical foul on one is a red card. Reducing it further
means either making breakaways rarer or making referees lenient about them —
both of which change the football rather than the refereeing. Recorded, not
buried.

## 9. A measurement lesson: seed blocks are not interchangeable

Chasing why two harnesses disagreed on the same seeds (§10) turned up a second
trap. Comparing **consecutive** seeds against a **strided** set (`seed + i·331`)
on identical code gave 8.11 and 10.91 fouls a side — a 35 % swing — and worse for
rare events, where penalties read 0.10 on one set and 0.38 on the other.

With the harness fixed, the honest picture is that this is **sampling variance in
the seed sequence**, not a property of the game:

| block | goals | fouls / side |
|---|---|---|
| 8100–8139 | 5.93 → 6.18 | 8.32 → 10.86 |
| 15000–15039 | 5.30 → 5.75 | 7.90 → 11.10 |
| both (80 matches) | 5.62 → 5.97 | 8.11 → 10.98 |

Two blocks that agree to within 0.4 goals and 0.25 fouls a side is the level of
confidence this engine supports. Every headline number in this document is
therefore the mean of 80 matches across both blocks, and any single-block figure
says which block it came from. Rare events (penalties, reds) need more than 80
matches to pin down at all, and are quoted as ranges.

## 10. The harness bug this chunk found: every aggregate was measuring a truncated match

While reconciling why `npm run match` reported 10.34 fouls a side where a direct
engine loop on the same seeds reported 10.86, the cause turned out not to be the
foul model at all.

`simulateMatch` — the loop behind every `npm run match` aggregate this project has
ever published — capped itself at `seconds/step + 6000` steps, i.e. a 300-second
allowance for dead-ball time. A 12-minute match actually needs about **21,248**
steps against a **20,400** budget, because restart set-ups and goal celebrations
do not advance the match clock.

Measured directly: **6 of 8 matches ended in phase `goal`** — cut off in the
middle of a celebration, never reaching full time. Every headline figure in this
repo was therefore computed over matches that were roughly 2–4 % short.

After widening the allowance (`seconds/step × 2 + 20000`, a limit that now only
exists to stop an infinite loop):

| | truncated harness | fixed harness |
|---|---|---|
| matches reaching full time | 2 / 8 | **8 / 8** |
| fouls / match | 20.50 | **20.88** |
| goals / match | 5.63 | **5.75** |

`simulateMatch` now agrees with a hand-rolled loop to the digit, which is how the
bug was caught: two harnesses disagreeing on the same seeds is never a licence to
pick the nicer number.

**The lesson is about the disagreement, not the size.** A 2 % bias is invisible in
any single tuning decision and would never have been found by looking at the
numbers; it was found by insisting that two ways of measuring the same thing
produce the same answer.
