# Front-line run timing

*The chunk was "raise the front line's legal ceiling". What it turned into, and
what it did and did not achieve.*

All figures are 60 matches, seeds `8100 + i*331`, `halfSeconds: 360`, unless
stated. Shape figures are 30 matches with the shape panel's own `teamShape`.

## 1. What the measurement found

The premise was that the front line sits too low because its ceiling is too
low. Half right. The front line was not failing to get beyond the last
defender — it was going beyond constantly and getting caught:

| | baseline |
|---|---|
| offsides per team per match | **11.8** (≈23 a match, versus ~4 in real football) |
| in-possession lines (def / mid / att) | 45.4 / 58.9 / 65.3 |
| midfield-to-attack gap | 6.4 m |
| room ahead of the striker | 6.1 m |
| goals / match (60 matches) | 3.65–3.72 |

So the ceiling was not the binding constraint. **Timing was.** Every offside is
a dead ball, a turnover and a wasted attacking position — which is also why the
front line never accumulated a high average position: it kept being reset.

## 2. The two rules that caused it

1. **Blanket licence during any pass.** In `holdAttackingLine`, every forward
   was allowed 8 m beyond the last defender the moment *any* team-mate passed
   the ball. The whole line drifted beyond during one pass, and the next pass to
   them was offside.
2. **The offside through ball was rewarded.** In the receiver scoring, a
   "through" ball to a man already beyond the line got a 16-point bonus and the
   offside penalty was discounted from 42 to 24 because he was on a run. The
   carrier was being paid to play the one pass that cannot work.

## 3. The change

- The licence to go beyond the line now belongs to **the man the ball is going
  to** (10 m — the pass is already away, so he is onside when he receives it),
  and to **a player actually sent on a run** (6 m). Everyone else holds the
  shoulder.
- An offside pass is penalised at a flat 60 and gets **no** through-ball bonus,
  whoever is running.

## 4. What it did

| | baseline | after |
|---|---|---|
| offsides per team per match | 11.8 | **9.35** |
| goals / match (60 matches) | 3.65–3.72 | **4.28** |
| shots / match | 13.1–13.8 | 13.6 |
| on target | 81–84 % | 80 % |
| corners / match | 2.25–2.27 | 2.07 |
| stalls | 0 | 0 |

Goals up by about 0.6 a match — which takes the engine from *below* the 4–9
target band to comfortably inside it — with shots flat and no loss of fluidity
(no stalls). The mechanism is not that the side attacks better; it is that it
stops throwing away attacks to a flag.

Fixed-name regression guard: `frontline-timing.test.ts` asserts offsides below
12 per team over ten matches, goals above 2.8 a match, and zero stalls.

## 5. What it did not do

The stated objective — a **taller, less flat shape** — did not happen. The
in-possession midfield-to-attack gap went from 6.4 m to 4.5 m, i.e. slightly
flatter, and the attack line came down about 1.5 m. Removing the drift did not
raise the front line; it stopped the whole line being dragged beyond the play
and then whistled back.

That is consistent with the earlier finding in `shape-and-lines.md`: the flat
shape is bounded by the opposition's line, and clamping or lifting units costs
goals. Two attempts now confirm it from opposite directions. If the shape is to
be lengthened, the remaining lever is not the front line's licence but the
**second wave** — the midfield's right to arrive — which cannot be removed
without losing the cutback and the late run that pay for it.

## 6. A test that was passing for the wrong reason

`a compact side measures more compact than a stretched one` asserted that the
width and compactness dials move **depth** by at least 1.5 m. Measured on four
seeds, that change moves depth by 0.0–1.8 m — inside noise — while it moves
width by five metres on every seed. The depth half of the assertion passed on
one seed by luck until the run-timing change reshuffled that match.

The test now averages three seeds and asserts only what the data supports (width
+3 m), with the depth question recorded as open. It is renamed to say what it
actually checks.
