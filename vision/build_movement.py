#!/usr/bin/env python3
"""
Turn tracks into a movement description the engine can be fitted to.

The output is deliberately small and boring: for each of the three lines —
defence, midfield, attack — how far up the pitch it lives, how much it oscillates
longitudinally, how wide it spreads, how long its runs are, how curved they are,
how fast it moves and how often it sprints. Plus a handful of run *prototypes*
per line: the recurring shapes of movement, clustered rather than averaged,
because a mean of "run left" and "run right" is "stand still".

    python3 vision/build_movement.py --tracks /tmp/clip/tracks.json \
        --home-attacks right --out /tmp/clip/movement-target.json

These numbers are then the target of the fit in `frontend/src/game/motion.ts`:
the engine is asked to play as much like this as its role parameters allow.
"""
from __future__ import annotations

import argparse
import json
import math

import numpy as np

SPRINT = 5.5      # m/s, the band the engine already treats as high intensity
RUN_MIN_M = 3.0   # a run shorter than this is a step, not a movement
SPEED_MIN = 2.0   # m/s — below this a player is adjusting, not running
LINES = ("defence", "midfield", "attack")


def attacking_frame(x, y, pitch_w, pitch_h, attacks_right):
    return (x, y) if attacks_right else (pitch_w - x, pitch_h - y)


def kmeans(points, k, iterations=40, seed=11):
    rng = np.random.default_rng(seed)
    points = np.asarray(points, dtype=float)
    if len(points) <= k:
        return points, np.ones(len(points))
    centres = points[rng.choice(len(points), size=k, replace=False)]
    labels = np.zeros(len(points), dtype=int)
    for _ in range(iterations):
        d = ((points[:, None, :] - centres[None, :, :]) ** 2).sum(axis=2)
        labels = d.argmin(axis=1)
        for i in range(k):
            members = points[labels == i]
            if len(members):
                centres[i] = members.mean(axis=0)
    weights = np.array([(labels == i).mean() for i in range(k)])
    return centres, weights


def segments(samples):
    """Split one player's tracked samples into runs: sustained movement."""
    runs, current = [], []
    for a, b in zip(samples, samples[1:]):
        step = math.hypot(b["ax"] - a["ax"], b["ay"] - a["ay"])
        speed = step / max(1e-3, b["t"] - a["t"])
        if speed >= SPEED_MIN:
            current.append((a, b, step, speed))
        elif current:
            runs.append(current)
            current = []
    if current:
        runs.append(current)
    return runs


def describe_run(run):
    a, b = run[0][0], run[-1][1]
    length = sum(r[2] for r in run)
    chord = math.hypot(b["ax"] - a["ax"], b["ay"] - a["ay"])
    duration = b["t"] - a["t"]
    curvature = length / chord if chord > 0.5 else 1.0
    return {
        "dx": b["ax"] - a["ax"],
        "dy": b["ay"] - a["ay"],
        "length": length,
        "duration": duration,
        "curvature": curvature,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--tracks", required=True)
    ap.add_argument("--home-attacks", choices=("right", "left"), default="right")
    ap.add_argument("--away-attacks", choices=("right", "left"), default=None,
                    help="defaults to the opposite of --home-attacks")
    ap.add_argument("--prototypes", type=int, default=4)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    with open(args.tracks) as fh:
        data = json.load(fh)
    pitch_w = data["pitch"]["length"]
    pitch_h = data["pitch"]["width"]
    away_right = (args.home_attacks == "left") if args.away_attacks is None else (args.away_attacks == "right")

    # Per player: a time series in the attacking frame.
    series: dict[str, dict[str, list]] = {}
    per_team_series: dict[str, dict[str, list]] = {}
    for frame in data["frames"]:
        t = frame["t"]
        for p in frame["players"]:
            attacks_right = (args.home_attacks == "right") if p["team"] == "home" else away_right
            ax, ay = attacking_frame(p["x"], p["y"], pitch_w, pitch_h, attacks_right)
            per_team_series.setdefault(p["team"], {}).setdefault(p["id"], []).append({"t": t, "ax": ax, "ay": ay})

    # Lines are inferred, not supplied: a fixed camera does not know who is a
    # centre-back. Cluster each side by mean longitudinal position, then name the
    # three clusters in order from own goal.
    grouped: dict[str, list[list[dict]]] = {line: [] for line in LINES}
    for team, players in per_team_series.items():
        ids = list(players.keys())
        means = np.array([[np.mean([s["ax"] for s in players[i]]), np.mean([s["ay"] for s in players[i]])] for i in ids])
        centres, _ = kmeans(means, 3)
        order = np.argsort(centres[:, 0])
        for idx, player_id in enumerate(ids):
            line = LINES[int(np.where(order == np.argmin(((means[idx] - centres) ** 2).sum(axis=1)))[0][0])]
            grouped[line].append(players[player_id])

    report: dict[str, dict] = {}
    prototypes: dict[str, list[dict]] = {}
    for line in LINES:
        tracks = grouped[line]
        if not tracks:
            continue
        xs = [s["ax"] for track in tracks for s in track]
        ys = [s["ay"] for track in tracks for s in track]
        speeds, distances, run_rows = [], [], []
        for track in tracks:
            for a, b in zip(track, track[1:]):
                step = math.hypot(b["ax"] - a["ax"], b["ay"] - a["ay"])
                dt = max(1e-3, b["t"] - a["t"])
                speeds.append(step / dt)
                distances.append(step)
            for run in segments(track):
                row = describe_run(run)
                if row["length"] >= RUN_MIN_M:
                    run_rows.append(row)

        report[line] = {
            "lineX": round(float(np.mean(xs)), 2),
            "advanceX": round(float(np.std(xs)), 2),
            "spreadY": round(float(np.std(ys)), 2),
            "speed": round(float(np.mean(speeds)) if speeds else 0.0, 2),
            "sprintShare": round(float(np.mean([s >= SPRINT for s in speeds])) if speeds else 0.0, 3),
            "runLength": round(float(np.mean([r["length"] for r in run_rows])) if run_rows else 0.0, 2),
            "curvature": round(float(np.mean([r["curvature"] for r in run_rows])) if run_rows else 1.0, 3),
            "players": len(tracks),
            "samples": len(xs),
        }

        if run_rows:
            features = np.array([[r["dx"], r["dy"], r["length"], r["curvature"], r["duration"]] for r in run_rows])
            centres, weights = kmeans(features, min(args.prototypes, len(features)))
            prototypes[line] = [
                {
                    "dx": round(float(c[0]), 2), "dy": round(float(c[1]), 2),
                    "length": round(float(c[2]), 2), "curvature": round(float(c[3]), 3),
                    "duration": round(float(c[4]), 2), "share": round(float(w), 3),
                }
                for c, w in sorted(zip(centres, weights), key=lambda t: -t[1])
            ]

    out = {
        "version": 1,
        "source": {
            "clip": data.get("source"),
            "fps": data.get("fps"),
            "seconds": round(data["frames"][-1]["t"] - data["frames"][0]["t"], 1) if data["frames"] else 0,
            "players": sum(len(t) for t in grouped.values()),
        },
        "pitch": data["pitch"],
        "groups": report,
        "prototypes": prototypes,
        "notes": {
            "frame": "positions are in an attacking frame: ax grows toward the goal a side attacks, ay toward its left touchline",
            "lines": "defence/midfield/attack are inferred by clustering mean longitudinal position, not supplied by the clip",
        },
    }
    with open(args.out, "w") as fh:
        json.dump(out, fh, indent=2)
    for line in LINES:
        if line in report:
            r = report[line]
            print(f"{line:9s} lineX {r['lineX']:5.1f}  advance {r['advanceX']:4.1f}  spread {r['spreadY']:4.1f} "
                  f" run {r['runLength']:4.1f} m  curve {r['curvature']:4.2f}  {r['speed']:4.1f} m/s")
    print(f"-> {args.out}")


if __name__ == "__main__":
    main()
