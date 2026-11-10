# Video analysis on the Tactical Lab — implementation plan

**Decisions taken (21 Oct 2026):** inference runs **in the browser**; footage support is
**staged — fixed camera first, broadcast later**; the detector may be **AGPL** (Ultralytics YOLO);
verification uses a **public sample clip**.

**What this document is:** the plan for turning uploaded match video into the same analytics the
simulation already produces. It is deliberately not a promise about accuracy, because nothing
downstream of the plumbing can be measured in this workspace. See §6.

---

## 1. The shape of the thing

```
upload ──► decode ──► sample frames ──► detect (ONNX Runtime Web)
                                            │
                                            ▼
                                     track (ByteTrack-lite)
                                            │
                          teams + roles from shirt colour & position
                                            │
                                            ▼
                            homography: pixels ──► pitch metres
                                            │
                                            ▼
                          ┌─────────────────┴──────────────────┐
                          │        MATCH TRACKS                │
                          │  per frame: id, team, role, x, y   │
                          └─────────────────┬──────────────────┘
                                            │
              ┌─────────────────────────────┼─────────────────────────────┐
              ▼                             ▼                             ▼
      tactical profile              hex heat map                  speed / distance
      (already built)               (already built)               (already built)
```

The bottom row is the point. `tactics.ts`, the hex heat map and the possession/speed metrics all
consume **positions in pitch metres**. The simulation produces those; video will produce those. So
video analysis reuses the analytics wholesale instead of growing a parallel silo.

**One interface, two providers:**

```
MatchTracks  = { fps, frames: [{ t, ball: {x,y} | null,
                                 players: [{ id, team, role, number?, x, y }] }] }
```

- `SimulationTracksProvider` — adapts `MatchState` (used now, by tests).
- `VideoTracksProvider` — the CV pipeline (stage 2+).
- `FixtureTracksProvider` — recorded JSON, used by every test.

---

## 2. Why browser-side

- The video **never leaves the machine**. For a football club uploading its own footage, that is
  the difference between "we can use this" and "legal will never approve it".
- No worker, no queue, no GPU rental, no upload bandwidth (a 90-minute match is 2–5 GB).
- ONNX Runtime Web with the WebGPU execution provider runs a small detector at usable rates on a
  laptop; WASM is the fallback for machines without WebGPU (slower, still workable at 5 fps).

**Costs, stated honestly:** smaller models than a server would run; the tracker is ours to write;
model files (10–40 MB) have to be fetched from the app's own origin; and **none of this works in
the sandboxed preview**, which has no network. It works in the real app only.

---

## 3. Stages

### Stage 1 — the seam (testable today, no model)

- Define `MatchTracks`, the provider interface, and adapters for simulation + fixtures.
- Port `tacticalProfile`, the heat map and speed/distance onto `MatchTracks` (the maths does not
  change; only the source of positions does).
- Tests: a fixture track file with a known shape must produce the same profile the engine does for
  the same shape; a KNOWN homography must map known pixels to known metres.
- **Verifiable here.** This is the chunk to do first.

### Stage 2 — ingestion and calibration, no detection yet

- Upload a file, decode in the browser, sample at a target fps (default 10, configurable).
- Downscale to 1280 px wide for processing; keep the original only for display.
- **Calibration UI**: click the pitch markings (touchline corners, six-yard box, halfway line) on a
  frozen frame → solve a homography → draw the projected pitch over the video so the user can see
  whether it is right before running anything. A wrong calibration silently ruins every downstream
  metric, so it gets a visual check, not a number.
- Fixed-camera assumption for now: one homography for the whole clip, with a warning if the user
  marks the shot as panning.

### Stage 3 — detection

- `onnxruntime-web`, WebGPU with WASM fallback.
- **Tiled inference** (overlapping crops, e.g. 4×3 tiles with 20 % overlap, detections merged by
  NMS). This is the single biggest accuracy lever on wide shots: a distant full-back is ~15 px tall
  at full-frame scale and invisible to a 640-px detector, but detectable in a tile.
- Classes from the COCO person/ball heads to start. **Known limitation:** COCO person recall on
  far-side players is materially worse than the 4-class sports detector their repo trained. Stage 6
  covers training our own; we should expect to need it.
- Ball detection will be unreliable (a football is a few pixels). Plan: treat COCO `sports ball` as
  a hint, fuse with a motion/differencing tracker, and fall back to "ball unknown this frame" —
  which the analytics must tolerate rather than crash on.

### Stage 4 — tracking and identity

- ByteTrack-lite: Kalman filter on position/velocity, IoU association in two passes, short-term
  lost-track buffer. Written by us.
- Team assignment: median shirt colour in the torso band, spherical k-means into two clusters —
  the same idea as their `role_refinement`, re-implemented.
- Keeper and referee separation **by geometry, not colour**: in front of a goal, or behind his own
  outfield on the midline. Their notes are right that a colour rule puts the keeper in with the
  officials, because a keeper's kit is deliberately different from both teams.
- Swap correction: appearance change-point on the shirt patch, with the exchange placed at the
  crossing rather than where the colour finally differs. This is the one their commit history
  spends the most effort on, and the reason is visible in their numbers (worst step 376 → 37
  px/frame).

### Stage 5 — metres and analytics

- Homography every frame → local pitch coordinates, oriented to each team.
- Feed the existing profile, heat map, speed/distance, possession.
- Emit `MatchTracks` JSON next to the video so a re-run never re-processes the footage.

### Stage 6 — broadcast footage

- Per-frame keypoint model + homography, camera-motion estimation and smoothing.
- This is the largest single piece of work in the plan and the one with the least certainty. It
  should not start until fixed-camera output has been checked against a real clip.

### Stage 7 — the page

- New **Video analysis** tab on the Tactical Lab: upload, calibrate, run with a progress bar,
  then the same panels the simulation shows — shape, heat map, profile readings, per-player
  speed/distance — plus JSON export.

---

## 4. Honest accuracy ceiling

| Input | Expectation |
|---|---|
| Fixed camera, whole pitch in frame, good light | Positions within ~1–2 m in the near half, worse at the far touchline. Usable for shape, width, block height, heat maps. Speed estimates coarse at 10 fps sampling. |
| Fixed camera, panning or zooming | Unusable without per-frame homography. |
| Broadcast | Requires stage 6. Until then, treat output as indicative only. |
| Ball-dependent metrics (possession, xG) | Weak until the ball tracker is reliable; the plan is to mark frames with no ball rather than invent one. |

**The ceiling is lower than the simulation's, and that is fine** — the simulation is a game; this is
measurement of real football, and real measurement is allowed to say "unknown".

---

## 5. Licence, recorded

- Ultralytics YOLO is **AGPL-3.0**. Accepted, with the consequence noted: serving the application
  over a network counts as distribution under §13, so a hosted product would carry AGPL obligations
  for the whole application, not just the model code.
- The seam is deliberately detector-agnostic. If that consequence becomes unacceptable, swapping to
  YOLOX or RT-DETR (Apache-2.0) changes one adapter, not the architecture.
- Their repo's weights are **not** used. Their licence contradicts itself (MIT badge, then a
  proprietary notice), so: ideas re-implemented, code and weights untouched.
- **The sample clip must be licensed for the purpose** (Creative Commons or similar). Broadcast
  footage is copyrighted; it must not be committed to the repo.

---

## 6. What can and cannot be verified here

**Can, in this workspace:**
- the `MatchTracks` contract and both adapters;
- homography maths, against known pixel→metre pairs;
- the tracker, against synthetic trajectories with a known correct answer;
- team clustering, against synthetic shirt colours;
- that every analytic tolerates missing ball frames and missing tracks;
- that the profile computed from a fixture matches the profile computed from the engine for the
  same shape.

**Cannot:**
- real detection accuracy, real tracking identity, real calibration error — all of which need
  weights and footage on a machine with a GPU, in a real browser, outside the sandbox.

So the test suite will assert the **plumbing and the maths**, and the accuracy claims will be made
by whoever runs it on a real clip, with a screenshot and a number. No claim of "works on real
footage" will be made from this workspace.

---

## 7. Order of work and first chunk

1. **Stage 1 (the seam) + tests** — no model, no video, fully verifiable here.
2. Stage 2 ingestion + calibration UI.
3. Stage 3 detection with tiling.
4. Stage 4 tracker + identity.
5. Stage 5 analytics reuse, then 7 (the page) as soon as there is something to show.
6. Stage 6 broadcast, only after 1–5 are measured on a real fixed-camera clip.

Stage 1 is the next chunk unless something more urgent interrupts.
