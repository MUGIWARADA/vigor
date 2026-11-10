# The stepping line: 2.96 offsides, then 4.26

`docs/offsides.md` ended on 2.96 offsides a match against real football's four,
and named the missing fourth as defensive: *"real offsides come from a line that
steps up late, and our back line holds a depth set by the shape rather than
compressing as the ball travels."*

This is that chunk. The line was already stepping. What was missing was the other
half — and the second half is not the defence at all.

## 1. What was already there

The engine has had a defensive line for a long time: `anchorFor` places it from
the ball's position, the `lineHeight` and `pressing` sliders, and
`defensiveTrapContext` gives an extra shove when the carrier is under pressure or
facing his own goal. There is even a slider called `offsideTrap`, at 88/100 for
Bracelonia. The line moves, fast, as a unit.

And it produced almost no offsides, because of the other half:

```ts
const limit = lineLocal - shoulder + allowance + gamble
if (local.x > limit) local.x = limit - Math.min(3, overshoot * 0.25)
```

Every attacker's target was clamped against the **live** line, every frame. A
defence could step up as far as it liked and the front line would be dragged
along behind it like a shadow. Nobody could be stranded, therefore nobody was
ever offside except by the deliberate one-stride gamble. The line was never the
problem; the coupling to it was.

## 2. The fix: a half-second of stale information

Real players are not linesmen. They track the last defender with their eyes, and
a line that moves takes about half a second to register. That gap is the whole
mechanism of a stepping line: the defence goes, the attacker is still standing
where the line used to be, and the carrier plays a pass he believes is legal.

So the engine now carries two lines per side:

- **the true line** — `secondLastOpponentX`, used by `isOffsideAtPass` and by the
  flag, exactly as before;
- **the seen line** — `state.lineSeenX[teamId]`, a first-order lag of
  `LINE_REACTION_S = 0.5`, used by the two things a player does with it: the
  attacker's ceiling in `holdAttackingLine`, and the carrier's pass filter.

The referee judges the truth. The players act on what they have registered. That
asymmetry is the behaviour, and it is not a tolerance being loosened — every
distance in the system is still measured the same way.

`lineSeenX` is initialised from the actual line at kickoff rather than a default
of 52.5, because a stale start held the whole front line at halfway for the
opening seconds of every match. That showed up as a test failure before it showed
up in a match, which is the right order.

## 3. Measured

Forty seeds, twelve minutes, identical fixtures:
`npm run match -- --seed 8100 --repeat 40 --minutes 12`

| | before this chunk | after | real football |
|---|---|---|---|
| **offsides per match** | 2.96 | **3.86** | ~4 |
| offsides per side | 1.48 | 1.93 | ~2 |
| goals per match | 5.95 | 5.93 | 2.7 |
| shots per side | 11.18 | 10.98 | ~13 |
| on target | 79.6 % | 80.4 % | ~33 % |
| corners per side | 2.75 | 2.69 | ~5 |
| fouls per side | 7.98 | 7.49 | ~11 |
| pass completion | 78.1 % | 77.5 % | 75–85 % |

Pass completion gives up 0.6 points. That is the correct price: the carrier is no
longer omniscient about the line, so a small number of passes are played into a
position a linesman will flag.

An eight-match probe of the mechanism:

| reading | value |
|---|---|
| gap between the seen and true line at the moment of a flagged pass | mean **1.71 m**, median 1.86 m, p90 2.72 m |
| overshoot past the true line | median **1.52 m**, p90 2.98 m |
| how far the line had travelled in the second before the flag | **−3.4 m** (it was dropping) |

## 4. The experiment that failed, and why it is worth keeping

I built the classic trap first: a decaying step-up (`trapStep`) triggered by a
backward pass, pushing the whole line 3–7 m up the pitch for about a second —
exactly the cue a real back four uses, because the ball is going away from goal
and every attacker is behind it.

It did nothing. Measured two ways:

- **Attribution:** the share of flagged passes occurring within a live step-up
  went from 0 % to 2 % when the strength was doubled.
- **A/B, 24 matches each:** goals 5.38 vs 5.25 without it, offsides 4.16 vs 4.34,
  corners 2.85 vs 2.15, pass completion 77.8 vs 76.9. Every difference is inside
  the noise of twenty-four matches.

It was removed, because a field that is written and never read is not a feature.

**Why it cannot work here** is the interesting part, and it is a property of the
architecture rather than of the tuning. The attacker's ceiling is a *clamp
against the line*: his target may not exceed it, but nothing pushes him up to it.
An advancing line therefore **raises his ceiling** — it gives him more room, it
does not strand him. Only a line moving *away* from him can leave him beyond it.
The probe confirms it: at the moment of every flagged pass, the line had been
retreating for a second, not stepping up.

So the model reproduces the offside that comes from a defence dropping away from
a stationary forward, and cannot reproduce the trap. Getting the trap would mean
changing the ceiling from a live clamp into a memory — "where was he last legal?"
— so that an attacker who stops tracking the line can genuinely be left behind.
That is a different piece of work, and it would make attackers worse at their
primary job, so it wants its own evidence rather than a paragraph here.

A related overclaim is now documented: the `offsideTrap` slider lifts the line's
base height and changes where the block lives, but it does **not** generate
offsides in this engine. Its name promises more than it does.

## 5. Guarded

`offsides.test.ts`, three tests:

- **legality:** no pass to a man standing more than 6.5 m beyond the *true* line.
  The bound is loose on purpose now — with a lagging picture, some overshoot is
  the design. It still excludes the old defect, which was six metres on a third
  of all passes.
- **rate:** 1.5 to 8 offsides a match across four seeds. Real football is four;
  a collapse to zero and a regression to thirty both fall outside.
- **character:** the *median* mistiming stays under 2.5 m. If someone starts
  choosing illegal passes again, the size of the whistles changes before the
  count does.

## 6. Where this leaves the offside thread

| | per match |
|---|---|
| original | 30.1 |
| legality as a filter, not a weight | 2.32 |
| deliberate mistimed runs | 2.96 |
| **a defence the attack cannot see perfectly** | **3.86** |
| real football | ~4 |

Three chunks, one defect, and the third one closed it. What remains is not a
number but a behaviour: the trap itself (§4), which needs a different model of how
an attacker holds a line.
