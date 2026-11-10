# Shape and lines — what the panel measures, and what the engine will not do

*Written after the shape panel went on screen and immediately showed a problem
it could not explain: Bracelonia's attack line averaged 58.2 m from their own
goal while their midfield averaged 60.4 m. The forward line was sitting behind
the midfield. This is the record of chasing that, including the fix that was
built, measured, and thrown away.*

## 1. What the numbers were

Eleven outfield players, one position sample per second, expressed in each
team's own attacking frame (0 m = your own goal line, 105 m = the goal you
attack):

| side | phase | defence | midfield | attack |
|---|---|---|---|---|
| BRA | with the ball | 33–50 | 50–67 | 55–69 |
| BRA | without the ball | 39–48 | 56–69 | 57–76 |
| BAM | with the ball | 26–52 | 32–62 | 65–71 |

Two facts, both real:

- **The units ascend, but barely.** Defence to midfield is a healthy 17–20 m.
  Midfield to attack is 2–5 m. Three banks of a team should not measure the
  same height as one bank and a half.
- **The striker is not behind the midfield because he is lazy.** He is standing
  on the opposition's back line. Measured over matches, the striker's line and
  the opponent's line differ by between −9 m and +16 m and hover around zero:
  he is pinned, correctly, by the last defender.

So the flat shape is mostly the *opponent's* line compressing the game, and the
midfield's height is the thing that looks wrong.

## 2. The fix that was built

A unit-ordering pass after the block geometry: measure the striker's line, and
hold the midfield a fixed distance behind it (never ahead of it). Football
obvious. Three variants were tried, because the first was expensive and it was
worth finding out how much of the cost was the amount and how much was the idea.

| variant | goals / match | shots / match |
|---|---|---|
| baseline (no ordering pass) | **4.17** | **14.4** |
| midfield may never exceed the striker's line | 2.96 | 11.6 |
| midfield held 8 m behind, skipped in the final third | 2.63 | 11.3 |
| midfield held 9 m behind, unconditional | 2.38 | 8.4 |
| only DM/CM held 12 m behind, CAM free to arrive | 2.42 | 8.5 |

All 24 matches per variant, seeds `8100 + i*331`, no stalls in any run.

Every version fixes the diagram and breaks the attack. The cheapest one still
costs 1.2 goals and 2.8 shots a match. Against a target of 4–9 goals with the
baseline already at the floor of that band, that is not a trade worth making —
and the reason it costs so much is not geometry, it is football: **the
midfielder who gets beyond the front line is the second wave.** He is the
cutback, the late run, the player arriving at the edge of the box. A shape
invariant that says "never be ahead of the striker" deletes him.

The pass was removed. `engine.ts` carries a note where it used to be so nobody
helpfully re-adds it.

## 3. What was kept instead

The panel now answers the question the flattened average could not:

- **The shape is split by possession.** `RuntimePlayer` records `inX/inY/inCount`
  and `outX/outY/outCount` alongside the whole-match averages, so "with the
  ball" and "without the ball" are measured separately rather than blended into
  an average of two different teams.
- **The opposition's line is on screen.** Their back four's average distance
  from the goal they defend, converted into this team's frame, published next to
  the striker's line as **room ahead of the front line**. Negative means the
  front line is short of the space; ~zero means it is pinned; positive means
  there is grass to run into.
- **Every reading carries its reason**, including the new one, which says
  outright when the units are stacking because there is nothing to run into.

## 4. Still open

- The 2–5 m midfield-to-attack gap is a real property of this engine, not a
  measurement artefact. It is bought and paid for by the attack. Whether to buy
  a longer shape at the cost of goals is a design decision, not a bug fix, and
  it needs a way to lengthen the block *without* removing the second wave —
  most likely by raising the front line's legal ceiling (timed runs off the last
  defender) rather than by lowering the midfield.
- Out-of-possession numbers read *higher* than in-possession ones for the same
  side, which is unintuitive for a team defending. Recorded, not explained.
- Distance and sprint metrics still use whole-match samples; a per-phase split
  of those would be the natural next step now that the plumbing exists.
