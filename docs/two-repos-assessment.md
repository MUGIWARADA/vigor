# Two repos, assessed against Vigor

**Date:** 21 October 2026 · **Scope:** what is worth taking, what is worth taking *with*, and what to leave alone.

---

## 1. `morluto/rea` — Reverse Engineer Anything

**What it actually is:** an MCP server plus CLI (`rea-agents` on npm) that lets an agent inspect
native binaries (via Hopper / Ghidra / IDA bridges), JavaScript and Electron bundles, .NET
assemblies, and websites, returning findings with the evidence behind them. MIT, Node 22+, ~4,000
commits, 172 branches, heavy CI. It is a *general reverse-engineering instrument*, not a football
library.

**Verdict: nothing to implement from it in the product.** Forcing it into Vigor would be
invented work. Three uses are real, and only one is a product use:

| Use | Value | Notes |
|---|---|---|
| **Bundle audit of our own build** — `rea analyze-javascript-application dist/` | **Real, small** | Our in-app preview runs inside a sandboxed iframe with no network. A build that quietly references an external font, CDN or API is a bug we can only see by inspecting the emitted bundle. An automated audit of `dist/` (and of `make-single-file.mjs` output) as a release check is genuinely useful. |
| **Feature study of a rival game** (e.g. "how does this web match engine do substitutions") | **Situational** | Legitimate as *learning*: read behaviour, write our own implementation. Not a way to obtain data. |
| **Native inspection of a console/PC football game** to pull attribute tables | **Rejected** | This directly contradicts your own standing rule — attributes must be original conversions from observable profiles, never copied from a game. It is also the one route that would put the whole project in a legal hole. Do not do it. |

**What I am not proposing:** adopting its agent-skills architecture, its MCP plumbing, or its
20-language docs. None of that touches our problem.

---

## 2. `Mhmdwael77/ai-football-analytics` — the useful one

**What it is:** a 12-stage computer-vision pipeline (YOLO11 detection → BoT-SORT tracking →
dynamic team/role discovery → pitch-keypoint homography → metres projection → speed/distance →
heatmaps → tactical profile → possession → natural-language match report). Python, ~15 analytics
modules, 628 tests.

### ⚠️ Licence, first

The README carries an MIT badge **and** a trailing paragraph asserting the project is proprietary
with "no permission granted to copy, modify, distribute…". Those two statements cannot both be
true, and a contradiction resolves conservatively. **So: re-implement the ideas, do not copy the
code.** Everything below is maths and design patterns — statistics, thresholds, a shape of API —
which is safe to write ourselves. I have not pasted a line of their source anywhere.

### The insight that makes it applicable

Their input is broadcast video projected to pitch metres. **Our engine already produces that
exactly** — 22 players plus the ball in real metres at 20 Hz, with no detection error. Their
analytics layer is therefore not just portable, it is *strictly easier* for us: no tracking noise,
no calibration error, no identity swaps to correct.

### What we can build, in priority order

#### Phase 1 — measurement we are already missing (high value, low risk)

| From their repo | What it becomes in Vigor |
|---|---|
| `tracking_quality.py` — *"measure how good the tracks actually are, not whether the code ran"*: impossible links, mid-pitch births, identity changepoints | **Engine integrity suite.** `frontend/src/game/__tests__/engine-integrity.test.ts` — **already shipped this turn**, see §3. This is the direct answer to "random glitches": the world is now asserted to stay physically possible, per match, by number. |
| `tactical_analysis.py` — compactness (mean distance to centroid), width/depth as per-frame standard deviations, lateral thirds, block height from own goal, transition speed, build-up style, pressure band | **A tactical profile per team per match**, with the label *and* the metric *and* a reason string (their core principle: every label carries its number). Fits Team Ratings and the Post-Match Report, and finally lets us argue "Banyarn's block sits 41 m up the pitch and is 12 m wide" instead of looking at a screenshot. |
| `speed_distance.py` — per-player distance, average and top speed, with impossible-jump rejection | We already track `distance`, `load`, `burst`; adding **top speed and sprint distance** per player gives the live bars they show under each player, and a real work-rate column. |
| `possession_engine.py` — field-space possession (who is nearest the ball, contested zones) rather than a possession *timer* | Our `possessionSeconds` is a clock. Theirs is spatial. Swapping to a zone-weighted model makes the possession stat agree with what the pitch is showing. |

#### Phase 2 — presentation that closes the loop on your complaints

| From their repo | What it becomes |
|---|---|
| `minimap_hud.py` — tactical top-down map with average lines per unit | **A shape panel next to the pitch**: average line per unit, block width/depth, and the space behind, drawn over our existing `Pitch`. This is the visual answer to "Bayern's defence is not it" — you would see the line and the gap rather than infer them. |
| `heatmap_generator.py` — Gaussian positional heatmap | Our hex heat map is platform-wide already; a **Gaussian-smoothed per-team/per-player map** with the same hex language is a natural upgrade, plus a per-team overlay so both sides can be compared on one pitch. |
| `rating_engine.py` — 0–10 rating with the metric and reason behind it | We have `playerRating`; adding the *why* (three strongest contributors with values) turns a number into something a manager can act on. |
| `match_report.py` — dominant team, MOTM, weakest, key insights, recommendations | We have `PostMatchReport`; theirs is more explicit about *decision-shaped* sentences. Worth mining for phrasing structure, nothing else. |
| `pitch_role.py` — role inferred from **where a player walks, in metres** ("in front of a goal, or behind his own outfield and on the midline") | Validation for our role system: an automatic check that the RB is where an RB should be, and that the keeper is the keeper. Cheap, and it catches role regressions in tests. |

#### Phase 3 — research-grade, only if you want it

- **`evaluation/mota_eval.py` (MOTA/HOTA-style scoring)** — no meaning for a simulation with ground truth, but the *shape* of it (a scored, baselined accuracy per behaviour) is a good model for a "does our shape match the plan" score.
- **`calibration/auto_calibrator.py`** — keypoint homography scoring. Only relevant if we ever ingest real video, which we are not doing (all data is demo-labelled).
- **`manual_correction/`** — human-in-the-loop overlays. We have nothing to correct, because we generate the truth.
- **YOLO / BoT-SORT / pose / ReID / Streamlit** — irrelevant to us. Not a criticism; it is simply a different product.

---

## 3. Proof of concept, shipped this turn

Their strongest idea is not a metric, it is a discipline: **assert the output, not the code path**,
because a green suite fed fake frames cannot tell you the picture is wrong. I ported that to the
engine, then fixed what it found.

**Measured before the fix, four full matches:**

| Check | Result |
|---|---|
| player step per frame | max 0.44 m (8.7 m/s) — clean |
| ball step per frame | 0 jumps — clean |
| non-finite positions | 0 — clean |
| **frames with two bodies inside 1.0 m** | **249–318 per match**, deepest 0.18 m |

That last row is the "clashing" you see: the separation solver capped its correction at 0.09 m per
frame, so when two players' targets converged on the same patch the corrector was simply
overwhelmed and they stood inside each other.

**Fix:** a tangle (d ≥ 1.0 m) still resolves with the small capped lean, but genuine occupancy
(d < 1.0 m) is resolved outright; and a ball carrier now absorbs contact with Balance instead of
bouncing off the first shoulder he meets, which is what otherwise kills a breakaway.

**After:** 0–1 overlap frames per match, deepest overlap ≥ 1.0 m, all **317 tests green**,
typecheck clean, build ✓.

The suite is permanent: `engine-integrity.test.ts` asserts, per match, no impossible step, no ball
teleport, no non-finite state, fewer than six overlap frames, zero same-pixel frames, and at most
six firings of the 4.5 s anti-stall.

---

## 4. Recommendation

1. **Now:** tactical profile + engine integrity (**integrity done**; profile is the next chunk).
2. **Next:** the shape panel (average lines, block width/depth, space behind) — it is the single
   most direct answer to the defensive-shape argument, and it reuses the profile maths.
3. **Then:** spatial possession, top speed / sprint distance, rating-with-reasons.
4. **Park:** heatmap re-skin, match-report phrasing, role validation.
5. **Ignore:** rea in the product; ai-football-analytics' vision stack; anything that would mean
   extracting data from a shipped football game.

Everything in Phase 1 and 2 is a re-implementation in TypeScript inside `frontend/src/game/` and
`frontend/src/lib/` — no Python, no new runtime, no model weights, and no external network at
runtime, which keeps the sandboxed preview working.

### Sources
- Repo A: <https://github.com/morluto/rea> · README: <https://raw.githubusercontent.com/morluto/rea/main/README.md>
- Repo B: <https://github.com/Mhmdwael77/ai-football-analytics> · technical files read: `analytics/tactical_analysis.py`, `analytics/tracking_quality.py`, `README.md`
