# Learning movement from match video

A clip goes in; the engine's players move differently afterwards. That is the
whole point of this chunk, and it is worth stating what it is *not* before
stating what it is.

**It is not a neural policy.** Nothing here trains a network to output actions.
It is **system identification**: measure how a side actually moves in footage,
then ask six engine parameters — metres of depth and a lane-width multiplier for
each of defence, midfield and attack — to reproduce that measurement. The result
is a small JSON file a human can read and argue with, and a fit that reports how
much closer it got.

Why that shape: the engine is rule-based and legible. Dropping an opaque policy
into it would mean the manager's tactic sheet, the role system and every probe in
`docs/` stop explaining anything. Six bounded numbers keep the explanation.

---

## 1. The chain

```
clip.mp4 ──► vision/track.py ──► tracks.json ──► vision/build_movement.py ──► movement-target.json
                                                                                    │
                                                          frontend/scripts/fit-motion.ts
                                                                                    │
                                                                            movement-model.json
                                                                                    │
                                                              npm run match -- --motion …
```

Every link is a command and every link is a file. Nothing is hidden in memory.

```bash
# 1. a clip with a fixed camera — the first run needs four corner pixels, once
python3 vision/track.py --clip match.mp4 \
    --corners 412,988 1512,962 1455,318 470,296 \
    --home-colour "#c82020" --away-colour "#2f6fd0" --out match-tracks.json

# 2. what that side's movement actually looks like
python3 vision/build_movement.py --tracks match-tracks.json --out movement-target.json

# 3. fit the engine to it
cd frontend && npm run fit -- --target ../movement-target.json --out movement-model.json

# 4. play with it
npm run match -- --motion ../movement-model.json --repeat 8 --minutes 12
```

## 2. What travels between the stages

One schema, in pitch metres, so the video path and the engine path are the same
data:

```json
{ "fps": 20, "pitch": { "length": 105, "width": 68 },
  "frames": [ { "t": 0.05, "players": [ { "id": "home-3", "team": "home", "x": 41.2, "y": 27.8 } ] } ] }
```

`frontend/src/game/motion.ts` owns the TypeScript half, `vision/` the Python
half, and both compute the **same seven numbers per line**: mean position up the
pitch, its standard deviation (how much the line travels), lateral spread, speed,
sprint share, mean run length, mean run curvature. Comparing a video to a
simulation is only honest if the same definitions measure both; that shared
definition is the design, not a convenience.

## 3. Measured, on the validation clip

There is no real match footage in this workspace, so the pipeline is validated
against a **synthetic fixed-camera clip with known ground truth**
(`vision/make_synthetic_clip.py`): 20 seconds, 18 players, positions written down
before the frames are drawn.

**Tracking** — 400 frames, 7,200 player-detections, every one recovered:

| | |
|---|---|
| median position error | 0.06 m |
| 90th percentile | 0.10 m |
| 99th percentile | 0.28 m |
| within 1 m | 99.3 % |
| worst single detection | 16.1 m |

The 0.7 % tail is one player being handed another's id when two of them cross —
the classic failure of nearest-neighbour linking, and the reason a real
deployment wants a motion model in the tracker, not just proximity.

**The movement description** built from those tracks:

| line | lineX | advance | spread | run length | curvature | speed |
|---|---|---|---|---|---|---|
| defence | 23.0 | 12.1 | 8.2 | 8.7 m | 1.05 | 3.6 m/s |
| midfield | 55.3 | 17.9 | 8.2 | 20.6 m | 1.04 | 4.9 m/s |
| attack | 63.9 | 15.8 | 7.7 | 17.0 m | 1.03 | 5.1 m/s |

**The fit**, against those targets: relative movement error **0.5035 → 0.4216**
(16.3 % closer), in 99 s over 4-minute evaluation matches.

## 4. What the fit cannot do, measured

A closed-loop check — generate a clip *from the engine itself* with known priors,
then fit those priors back:

| | truth | recovered |
|---|---|---|
| defence | +4.0 m, ×1.10 | −4.0 m, ×1.68 |
| midfield | +6.0 m, ×1.20 | −8.0 m, ×1.23 |
| attack | +8.0 m, ×1.30 | 0.0 m, ×1.45 |
| movement error | 0.0853 | **0.0325** (62 % closer) |

The error fell by 62 % and **the parameters are wrong**. Six knobs move nine
correlated statistics of a chaotic match, so many parameter sets fit the summary
equally well. This is not a bug to be patched away with more optimiser rounds; it
is what fitting behaviour rather than physics looks like, and it is why the file
records `errorBefore`/`errorAfter` and the target it was matched to, rather than
posing as recovered truth.

Practical consequences, now fixed in the code:

- the search is **bounded** (depth ±8 m, width ×0.75–1.35) so a fit cannot win a
  hundredth of error by claiming a side plays twelve metres deeper and half as
  wide;
- the objective is dominated by correlation, so it needs **longer matches and
  more seeds** than the default to be worth believing — the honest next
  improvement, not a claim I can make today;
- on the synthetic clip, four of six parameters ended on a bound. That is the
  fitter saying the target is out of reach, which is correct: the clip's motion
  is scripted and far quieter than the engine's.

## 5. Where it is wired into the engine

One block in `computeTargets`, after the shape, the sliders and the role have
done their work, so the learned geometry is applied last and cannot fight the
tactic sheet:

```ts
if (state.config.motion) {
  const learned = state.config.motion.lines[lineOfPosition(pos) ?? 'midfield']
  if (learned) {
    if (inPossession && owner?.id !== p.id) x += clamp(learned.depthM ?? 0, -12, 12)
    const widthScale = clamp(learned.widthScale ?? 1, 0.6, 1.6)
    if (widthScale !== 1) y = clamp(34 + (y - 34) * widthScale, 2, 66)
  }
}
```

- **Absent a model, nothing runs.** `MatchConfig.motion` is optional and the 348
  existing tests pass untouched.
- **The vertical is not touched.** Goalkeepers keep their own logic.
- **The line a player belongs to comes from his slot**, not from his position.
  This mattered: with rank-inferred lines, widening a defence reclassified its
  players as midfield and the measurement moved without anyone moving. Declared
  lines are used whenever the source knows them; a camera does not, and there the
  fallback is rank — stated as a limitation, not hidden.

Measured effect of loading a model (two minutes, one seed, identity vs
depth +4 m / width ×1.15 on all three lines):

| line | mean position | lateral spread |
|---|---|---|
| defence | 51.9 → 53.9 | 14.8 → 15.6 |
| midfield | 52.7 → 55.9 | 12.3 → 13.7 |
| attack | 54.5 → 50.2 | 12.7 → 15.1 |

The front line going *down* is the onside cap doing its job: it cannot stand
higher than the last defender, so depth there converts into spread.

## 6. Limits, stated plainly

1. **Fixed camera only.** One tripod, one kit colour per side, no cuts, no zoom.
   Broadcast tracking (camera panning, adverts, crowd) is a different and much
   larger problem; `docs/video-analysis-plan.md` stages it, this chunk does not
   deliver it.
2. **Validation is synthetic.** The 6 cm error figure is against a rendered clip,
   not a real match. Real footage will be worse for reasons this workspace cannot
   measure: motion blur, overlapping players, referees in the same colour,
   shadows.
3. **One description, not one player.** Movement is learned per line. Individual
   idiosyncrasy — a winger who always cuts inside — is not in the model yet.
4. **The fit is behavioural, not structural** (§4). It makes the engine move more
   like the footage; it does not recover parameters.
5. **No browser inference yet.** The plan calls for ONNX Runtime Web so footage
   never leaves the machine. This pipeline runs in Python on the command line.
   The schema is the seam that lets the browser path replace the Python detector
   without touching anything downstream.
6. **A model is not a tactic.** Loading one changes where lines stand and how
   wide they play. It does not change roles, set pieces or the manager's sliders,
   and it cannot make a bad tactic good.

## 7. What would make it real

In order of value per unit of work:

1. **Fit on more football**: several clips, many seeds, longer evaluation
   matches, and a hold-out clip the fit never saw. Without a hold-out, "closer to
   the target" means "closer to one clip".
2. **A better tracker**: constant-velocity prediction before association, and
   appearance features, to kill the 0.7 % id-switch tail.
3. **Per-role rather than per-line priors** — once a tracker can tell a
   full-back from a centre-back, which a fixed camera cannot.
4. **Broadcast footage**, which is where the actual value is and where the plan's
   Stage 3+ lives.

## A test that was measuring nothing

`motion.test.ts` carried an assertion that loading a learned model widens
**every** line, checked on a single two-minute seed, plus a second assertion that
it raises the mean `lineX`. Between them they produced two failures across two
sessions, each time on one line, each time while the average moved the right way.
Both assertions are now gone, and the reason matters more than the fix.

**The per-line width claim is not true at any sample size a test can afford.**
Measured as paired differences over 8 identical seeds with the same prior applied:

| line | width effect | sd of the paired difference |
|---|---|---|
| attack | +1.01 m | 1.15 |
| defence | +0.83 m | 1.54 |
| midfield | +0.41 m | 0.77 |

The back line's effect is **smaller than its own standard error**. Match-flow
variety moves a back line by more than the prior does. Pooling lines and seeds
the effect is clean — 16 seeds of a one-minute match give **+0.77 m** of mean
line spread, sd 0.63, se 0.16, learned side wider in **14 of 16** seeds, about
5 standard errors. That is what the test now asserts, at six seeds with a 0.2 m
margin (~2 se), and it has run green three times consecutively.

**The depth assertion was structurally impossible, not merely noisy.**
`movementStats` pools both teams into the same per-line bucket, and `lineX` is
absolute pitch x. Both sides receive the same depth prior, so they push in
opposite directions and cancel *exactly*. The old assertion was comparing that
cancelling quantity — it failed at 51.2 vs 52.7 and could not have passed
reliably no matter how many seeds were added. Depth is now asserted only where it
is visible: the deterministic `withMotionPrior` case, where a ±40 m depth prior
must move `depth` by exactly ±12 in one player's own frame.

The general lesson, already paid for twice in this project: an assertion that
pools teams into one pool of pitch coordinates is measuring the symmetry of the
pitch, not the behaviour of a team.
