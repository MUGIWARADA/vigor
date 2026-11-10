# Shots — why 11 per side is the right number, and the target of 13 is not

*Queue item: "shots ~11 vs 13/side". This is the probe. The conclusion is that
the engine is not short of shots by an accident to be fixed — it is short of
shots because two other things we have deliberately fixed require it to be.*

Measured on the standing 40-seed × 12 min aggregate unless noted. Probe scripts
were throwaway; every number below is reproducible from the copy-paste in §6.

## 1. The baseline

| | this engine | real football |
|---|---|---|
| shots / side | 10.65 | ~12.8 |
| on target / side | 8.65 (81 %) | ~4.3 (33 %) |
| goals / match | 5.78 | ~2.7 |
| **goals per on-target shot** | **33.5 %** | **~33 %** |
| xG per shot | 0.121 | ~0.10 |

The third row of that table is the one that closes the question. **Our keeper
concedes at exactly the rate a real keeper concedes, per shot on target.** The
finishing end of the model is calibrated. What is not calibrated is that our
players essentially never miss the target.

## 2. The arithmetic that decides it

Goals are a product of three locked numbers:

```
goals/match = shots/match × on-target % × conversion per on-target shot
5.78        = 21.3        × 0.81          × 0.335
```

`on-target 78–81 %` is a **stated requirement**, and `conversion per on-target
shot` matches real football to within half a percent. Hold both, and the goal
band dictates the shot count:

| goals / match | shots / side implied |
|---|---|
| 4 | 7.4 |
| 5 | 9.2 |
| **5.78 (actual)** | **10.7** |
| 6 | 11.1 |
| 9 | 16.6 |

The engine sits at 10.65 and scores 5.78. It is not in the wrong place; it is in
*exactly* the place that 78 % on target and a 4–6 goal band put it.

To take 13 shots a side while keeping the goal band, one of the other two
columns has to move:

- hold 78 % on target and take 13/side → **7.0 goals**, above the 4–6 band that
  most matches are supposed to sit in;
- hold the goal band and take 13/side → **on target falls to ~64 %**, which
  breaks the 78 % requirement.

Both of those are worse games by the standard set for this project. A side that
takes 26 shots and misses the target 36 % of the time is not more fluid than one
that takes 21 and hits the target 81 % of the time; it is the same match with
more noise in the shot log.

**Recommendation: close this item as correctly constrained.** The 13/side figure
comes from real football, where the on-target rate is 33 %. Importing that number
while overriding the number that governs it is how a calibration thread turns
into an unforced error.

## 3. The probes that got here, and what they ruled out

Shot volume was attacked at four levels before the arithmetic made it moot.

### 3.1 It is not the decision to shoot

Instrumented the central branch of `aiCarrierDecision` for 10 matches
(temporary counters, engine restored byte-identical afterwards):

| | per match |
|---|---|
| carrier evaluated the shooting branch | 27.2 |
| squared to a team-mate instead | 0.2 |
| reached the dice | 27.0 |
| **shot taken** | **7.8** |
| declined | 19.2 |
| all `executeShot` calls (incl. wide, breakaway, set pieces) | 21.3 |

Only 27 % of zone evaluations become shots — which looks like the leak until you
break the declines down by role and range:

```
ST:long   2 shot / 21 decline   9%
LB:long   0 / 17                0%
RW:long   3 / 14               18%
RB:long   1 / 12                8%
ST:25     2 / 10               17%
```

And the mean `shootChance` at a decline is **0.13**. The declined attempts are
almost all 22–35 m efforts by full-backs and centre-backs. The engine is
correctly refusing to let a full-back punt from 30 metres 17 times a match. In
the box the gate is already forced to 0.88–0.96, so **the box is maxed out —
there is no dial left to turn there.** Zero shots from inside 6.5 m is the only
oddity, and it is small.

### 3.2 It is not the shot mix

| range | share | real football |
|---|---|---|
| inside the box | 52 % | ~55 % |
| 16.5–25 m (edge) | 37 % | ~32 % |
| beyond 25 m | 11 % | ~12 % |

Close enough that adding shots *of a different kind* would move the game away
from real football, not toward it.

### 3.3 It is not the attacking shape

The final-third occupation block in `anchorFor` already puts strikers at local
x ≥ 93 (the box begins at 88.5), the far-side winger at 95, the CAM at 86 and
interior midfielders at 82–88. The players are standing in the right places.

### 3.4 It is, weakly, delivery — and this is the one live thread left

The ball is in the final third 27.8 % of match time, and box touches are 3.0 % of
all touches (12.4 box touches a match, both sides). Real football is around 5 %.
That is a real gap, but correcting it would *raise* box touches and therefore
shots and therefore goals — feeding straight back into §2. It is only worth
opening in a chunk that also takes conversion down, which means revisiting the
on-target requirement, which is a decision for the project owner rather than a
tuning fix.

## 4. What this means for the queue

The agreed order was corners → shots → fouls. Shots closes here as *constrained,
not defective*. **Fouls is next** (7.49 vs ~11 a match), and it has no such
coupling: fouls do not enter the goals equation, so that thread can be worked on
its merits.

The one thing worth writing down before leaving shots: the formula in §2 is the
governing relationship for this entire engine. Any future proposal to change shot
count, on-target rate or conversion changes the goal band, and should be argued
against that identity rather than in isolation.

## 5. Honest limits of this work

- The box-touch comparison in §3.4 is not apples-to-apples and is treated as
  weak evidence. This engine counts a *possession change* as a touch (410 a
  match); public touch stats count every contact (~1,200). As a *share* of all
  touches the gap is 3.0 % vs ~5 %, not the 4× a raw count suggests. The raw
  figure was nearly misreported as a headline; it is not one.
- Cross-outcome detection was attempted and abandoned: the probe reported 98 % of
  crosses as "dead/out", which is a detector artifact (the ball transitions
  through flight and aerial resolution in ways a per-tick owner check does not
  see), not a finding. It is not used to support any claim here. If delivery is
  ever attacked, that probe needs to be built inside the engine, not beside it.
- The 40-seed aggregate is 40 matches. Differences under ~0.3 goals and ~0.5
  shots a side are inside noise and are not treated as results anywhere above.

## 6. Reproducing the two numbers that matter

```
cd frontend
npm run match -- --seed 8100 --repeat 40 --minutes 12
```

gives shots, on-target % and goals in one pass. The identity in §2 is then
`goals ÷ (shots × onTarget%)`, which is the whole argument.

## 7. Postscript — the foul chunk moved these numbers, and the identity still governs

The foul work (`docs/fouls.md`) changed how often defenders challenge and where,
and that moved this table. Measured like-for-like over 80 matches on each side
of the change (`docs/fouls.md` §6): shots went **10.89 → 11.46 a side** and goals
**5.62 → 5.97**. The relationship in §2 is unchanged and still predicts it —
plug the new numbers in:

```
5.97 goals / match ÷ (22.92 shots × 0.817 on target) = 0.319 per on-target shot
```

against 0.335 before, both rounding to real football's ~33 %. Shots and goals
moved together, exactly as the identity requires, which is the useful part: the
model was not re-tuned in two directions at once, one input shifted and the
output followed.

Two consequences worth carrying forward:

- **11.46 a side is closer to real football's ~12.8** than the 10.65 this
  document was written to defend, and it got there by fixing fouls rather
  than by adding shots. The deficit in §1 was, in part, defenders breaking up
  attacks with challenges that a real defender would have jockeyed through.
- **The goal band is the binding constraint, as argued in §2.** The foul chunk
  looked like it would cost 0.6 goals, and the shipped weighting was chosen
  specifically to avoid that: goals are **5.97**, inside the band and inside the
  "most matches 4–6" preference. §7 of `fouls.md` names the knob and the reason.
