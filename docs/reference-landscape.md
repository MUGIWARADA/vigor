# Reference landscape — who else builds this, and what they publish

*Question: are there public references for a football game like ours, and has
anyone published how they train their players? Answers below, split into what we
can read, what we can copy, and what is worth lifting into Vigor.*

## 1. The closest thing to our architecture

| project | stack | why it matters to us |
|---|---|---|
| [DeltaBitsSystem/FootballEngine](https://github.com/DeltaBitsSystem/FootballEngine) | F#, GPLv3, Avalonia | **Closest public match to our engine.** 2D spatial simulation at 40 Hz on a 105×68 pitch, steering behaviours, vision cones scaled by Vision/Positioning, an intent pipeline (`CollectiveModifiers → CollectiveIntents → SlotRole → DefensiveRole → EmergentState → pickIntent`, multiplicative weights, highest score wins), 30+ attributes in four groups, ball with drag/Magnus/restitution, deterministic (same seed → same scoreline). That is our design, written by someone else, in another language. |
| [Google Research Football](https://github.com/google-research/football) | C++, Apache 2.0 | Based on the open-source *Gameplay Football* (2017) — a PES-style 3D game with attributes and team tactics — wrapped as an RL environment. **Repository was archived on 19 Aug 2026** and the project points at a new game server, `research-football.dev`. Still the canonical public reference implementation; no longer developed. |
| [HELIOS base / agent2d](https://arxiv.org/abs/1812.10202) | C++, LGPL/GPL | RoboCup 2D's shared base code — the most-used public soccer AI there is. Its carrier decides by *chain action*: generate candidate passes, short passes and dribbles, search the action graph with a modified BFS, pick the best chain. Our `chooseReceiver` scores single passes; theirs scores sequences. |
| [Gliders2d](https://arxiv.org/abs/1812.10202) | GPL, papers | Documents **six sequential improvements** over the baseline (stamina management, pressing, action evaluation, attacking positioning, defensive positioning, riskier passes) worth +4 goals/game. Method: guided self-organisation + human-based evolutionary computation, one controlled change at a time. That is exactly the loop we have been running by hand. |
| [Cyrus2D base](https://github.com/Cyrus2D/Cyrus2DBase) | C++, MIT per repo | Helios + Gliders2d merged, plus 2021-champion features (blocking via simulated opponent dribble, etc.). |
| [Pyrus Base](https://arxiv.org/abs/2307.16875) | Python, **MIT** | Same league, Python, MIT — the only one in this group we could legally port code from. |
| [HeirsOfRuin/Football](https://github.com/HeirsOfRuin/Football) | plain JS, no build step, browser | See §4. Same problem we have: a match engine that must calibrate against real football rates, plus tooling to prove each tactical setting does something. **It is also called "Touchline"** — see the note at the end. |
| [openfootmanager](https://github.com/openfootmanager/openfootmanager) · [open-football](https://github.com/ZOXEXIVO/open-football) · [openengine](https://github.com/atas76/openengine) | Rust / C++ / Rust | Management-genre engines. Useful for *squad, training and development* modelling, not for on-pitch physics. `openengine`'s stated principle — "don't fake output: the input→output mapping must be consistent" — is the same discipline as our probes. |

## 2. How they actually "train" players — the public methods

Five distinct approaches are documented, and they are not interchangeable:

**a. Reinforcement learning from scratch.** GRF ships the *Football Academy* —
a dozen progressively harder scenarios — plus benchmarks, PPO/DQN/IMPALA
baselines, and a deterministic mode for reproducibility. In 2020 the Kaggle
*Google Research Football with Manchester City F.C.* competition drew 1,138
teams; agents see the full state (positions, speeds, tiredness) and pick one of
19 actions.

**b. Curriculum + self-play.** [TiZero](https://arxiv.org/abs/2302.07515)
(AAMAS 2023, [code](https://github.com/OpenRL-Lab/TiZero)) is the strongest
published result on full 11v11 from zero knowledge: 10 difficulty levels where
early episodes start close to an open goal, then "Challenge & Generalise"
self-play — 80 % of games against the newest copy of itself, 20 % against a
sampled historical pool to avoid niche exploitation. +30 % win rate over previous
systems, trained over ~45 days. [GRF_MARL](https://github.com/jidiai/GRF_MARL)
publishes a broader benchmark (IPPO, MAPPO, HAPPO, A2PO, MAT, league training),
and EA SEED's
[MARLING](https://github.com/electronicarts/marling) project (FDG '26, *Improving
Sample Efficiency in MARL for Simulated Football Games via Exploration*) builds
three TiZero variants — plain, with a Random Network Distillation bonus, and
with an added self-supervised intrinsic reward — on exactly this environment — i.e. EA is using GRF-family
simulations for research, and publishing the results.

**c. Human-guided evolution.** The RoboCup approach: take a working base,
change one thing, keep it if it wins. Gliders' six steps are published with the
code, so you can read a controlled experiment end to end. Slower than RL,
completely inspectable, and it fits a hand-written attribute engine like ours
far better than RL does.

**d. Learned tactical analysis, not learned control.** [TacticAI](https://www.nature.com/articles/s41467-024-45965-x)
(DeepMind × Liverpool, *Nature Communications*, March 2024) is the opposite
trade: the players are real, and a graph neural network over player nodes —
position, velocity, height, plus marking edges — predicts *who reaches the ball
first* (top-3 accuracy 0.78) and *whether a shot follows* (F1 0.71) from 7,176
to 9,693 Premier League corners. It also generates position adjustments that
Liverpool's analysts preferred to the real setups 90 % of the time. Key design
choice worth stealing: the model is built to respect pitch reflection symmetry,
so a left corner and its mirror are the same situation to the network.

**e. Per-player development (the other reading of "training").** If the question
was about *player growth* rather than AI: openfootmanager and HeirsOfRuin both publish their models — weekly fractional training points spent on
attributes, physical decline after ~30, mentals rising, playing time and
facilities modulating the rate. HeirsOfRuin uses the classic 38 attributes on a
1–20 scale; we use PES 1–99 and per-player weak-foot frequency, which is finer.

## 3. What the commercial games publish

- **EA SPORTS FC** publishes *process*, not decision logic: HyperMotion (a full
  11v11 90-minute mocap session driving a learned animation system, GDC talk),
  motion-matching patents (e.g. US20230310998A1), a "motion-inferred player
  characteristics" patent (US12508508B2) for deriving player style from capture
  data, and AI-assisted commentary. What is *not* public is the match AI: how a
  defender decides to step up.
- **Football Manager / Sports Interactive** publishes the attribute set and the
  match engine's *outputs*, but the engine itself is closed.
- **PES/eFootball** published its attribute definitions (the 1–99 set we already
  use) and nothing about the AI.

So: nobody has published how a commercial football game's player AI decides.
What is public is research environments (GRF), research agents (TiZero), a
competition league with open base code (RoboCup 2D), and indie engines whose
source you can read.

## 4. What is worth lifting into Vigor

Ranked by value per unit of work, and all of it is *method*, not code:

1. **An ablation harness.** `HeirsOfRuin/Football` runs `tools/ablate.js` over
   1,500 matches to answer "does each tactical setting actually change
   anything?" We found two settings that do nothing the hard way — the
   compactness/width dials barely move depth (0.0–1.8 m across four seeds), and
   the rating's distance term was a constant for every starter. A standing
   ablation test over our sliders and roles would have caught both on day one.
2. **A calibration table as a permanent gate.** Their published table — goals
   2.76 vs 2.75 real, shots 12.3 vs 12.6, corners 5.0 vs 5.0, fouls 10.8 vs
   10.8, cards 1.8 vs 1.9, penalties 0.26 vs 0.26 — is a test, not a README
   ornament. Ours exists as prose in `docs/` and a hand-run probe. Making it a
   test is what would have prevented the 12-seed "4.17 goals" figure from being
   believed for weeks.
3. **Scenario tests, GRF-style.** Their Football Academy measures competence per
   skill rather than per match: "score from a 3v2 in ten seconds", "keep
   possession under a press". Match aggregates hide which skill broke. We have
   exactly one such test (the chase fixture) and it has paid for itself.
4. **Chain-action search for the carrier.** agent2d's `Pass-Generator`,
   `Short-Generator`, `Dribble-Generator` + action-graph search, plus Gliders'
   "risk level" — a single number granting extra cycles to riskier passes. Our
   `chooseReceiver` is a one-step scored list; sequencing two or three actions
   would raise the AI's passing quality without touching attributes.
5. **TacticAI's corner framing and its numbers as benchmarks.** Their result is
   that the *setup* is the lever, not the delivery — which matches what our own
   corner work found: moving runners and retargeting the delivery did nothing,
   while changing what counts as a deflection (volume) did. Their published
   scores give us sanity targets if we ever compute receiver-prediction on our
   own corners.

## 5. Licence reality check

- **Copyable with attribution:** GRF (Apache 2.0), Pyrus (MIT), Cyrus2D base
  (MIT per repository, though it is a Helios/librcsc fork).
- **Ideas only:** FootballEngine (GPLv3), openfootmanager (GPLv3),
  HELIOS/agent2d (LGPL/GPL). Our engine is one TypeScript file; linking GPL code
  into it would put the whole app under GPL.
- **Unverified — treat as ideas only:** HeirsOfRuin/Football (no licence file
  seen), TiZero's code (no licence statement seen).
- **Not usable at all:** EA/FM internals (closed), and the
  `ai-football-analytics` repo (self-contradictory licence).

## 6. One thing to know before branding

`HeirsOfRuin/Football` is a browser-based, build-step-free, deterministic
football manager whose **app is named "Touchline"** (it became a PWA in Sept
2026), with its own calibration table against real-football rates. That is a
name collision with Vigor, in the same genre, in the same medium. Worth a
look before the name goes anywhere commercial — the idea space can be shared,
but a product name probably should not be.
