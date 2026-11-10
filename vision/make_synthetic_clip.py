#!/usr/bin/env python3
"""
Generate a synthetic fixed-camera match clip with known ground truth.

Why this exists: a CV pipeline that has only ever been run on "a real match"
cannot be checked. Here the true position of every player is written down before
the frames are drawn, so tracking error is a number rather than an opinion.

The motion is deliberately simple and legible — each player oscillates around a
formation slot with an advance amplitude and a lateral spread — because the point
is that the estimator recovers those two quantities back out of the pixels.

    python3 vision/make_synthetic_clip.py --out /tmp/clip --advance 14 --width 1.35
    # writes /tmp/clip/clip.mp4, /tmp/clip/ground-truth.json, /tmp/clip/clip.json
"""
from __future__ import annotations

import argparse
import json
import math
import os
import shutil
import subprocess

import cv2
import numpy as np

PITCH_W, PITCH_H = 105.0, 68.0  # metres
FPS = 20


def formation_slots() -> list[tuple[str, str, float, float]]:
    """(id, line, x, y) in metres for one side, attacking left to right."""
    slots = [
        ("d1", "defence", 18, 20), ("d2", "defence", 16, 34), ("d3", "defence", 18, 48),
        ("m1", "midfield", 42, 18), ("m2", "midfield", 38, 34), ("m3", "midfield", 42, 50),
        ("a1", "attack", 68, 22), ("a2", "attack", 74, 34), ("a3", "attack", 68, 46),
    ]
    return slots


def player_path(slot, t, advance, width, phase, flip):
    """Where a player is at time t, in metres, before flipping for the other side."""
    _id, line, x0, y0 = slot
    rate = 2 * math.pi / 11.0
    amp = advance * (0.55 if line == "defence" else 0.8 if line == "midfield" else 1.0)
    spread = width * (0.5 if line == "defence" else 0.9 if line == "midfield" else 1.25)
    x = x0 + amp * math.sin(rate * t + phase)
    y = 34 + (y0 - 34) * spread + 3.0 * math.sin(rate * 0.7 * t + phase * 1.3)
    if flip:
        x, y = PITCH_W - x, PITCH_H - y
    return x, y


def draw_pitch(img, scale, pad):
    img[:] = (46, 96, 52)
    line = (225, 235, 225)
    w, h = int(PITCH_W * scale), int(PITCH_H * scale)
    cv2.rectangle(img, (pad, pad), (pad + w, pad + h), line, 2)
    cv2.line(img, (pad + w // 2, pad), (pad + w // 2, pad + h), line, 2)
    cv2.circle(img, (pad + w // 2, pad + h // 2), int(9.15 * scale), line, 2)
    for side in (0, 1):
        x = pad + (0 if side == 0 else w)
        cv2.rectangle(img, (x - 16 * int(scale) * (1 - 2 * side), pad + h // 2 - int(20 * scale)),
                      (x + 16 * int(scale) * (2 * side - 1), pad + h // 2 + int(20 * scale)), line, 2)


def to_px(x, y, scale, pad):
    return int(round(pad + x * scale)), int(round(pad + y * scale))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="/tmp/touchline-clip")
    ap.add_argument("--seconds", type=float, default=30.0)
    ap.add_argument("--advance", type=float, default=14.0, help="metres of longitudinal oscillation")
    ap.add_argument("--width", type=float, default=1.15, help="lateral spread multiplier")
    ap.add_argument("--scale", type=float, default=7.0, help="pixels per metre")
    ap.add_argument("--noise", type=float, default=6.0, help="pixel noise sigma")
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)
    pad = 24
    w = int(PITCH_W * args.scale) + 2 * pad
    h = int(PITCH_H * args.scale) + 2 * pad
    frames = int(args.seconds * FPS)
    path = os.path.join(args.out, "clip.mp4")
    writer = cv2.VideoWriter(path, cv2.VideoWriter_fourcc(*"mp4v"), FPS, (w, h))

    home = formation_slots()
    away = formation_slots()
    ground_truth = {"fps": FPS, "frames": [], "pitch": {"length": PITCH_W, "width": PITCH_H}}
    rng = np.random.default_rng(7)

    for f in range(frames):
        t = f / FPS
        img = np.zeros((h, w, 3), dtype=np.uint8)
        draw_pitch(img, args.scale, pad)
        players = []
        for team, slots, colour, flip, phase0 in (
            ("home", home, (40, 40, 205), False, 0.0),      # red kit (BGR)
            ("away", away, (215, 120, 30), True, 2.1),      # blue kit
        ):
            for i, slot in enumerate(slots):
                x, y = player_path(slot, t, args.advance, args.width, phase0 + i * 0.6, flip)
                players.append({"id": f"{team}-{slot[0]}", "team": team, "line": slot[1], "x": x, "y": y})
                px, py = to_px(x, y, args.scale, pad)
                cv2.circle(img, (px, py), max(3, int(0.9 * args.scale)), colour, -1)
        if args.noise > 0:
            img = np.clip(img.astype(np.float32) + rng.normal(0, args.noise, img.shape), 0, 255).astype(np.uint8)
        writer.write(img)
        ground_truth["frames"].append({"t": round(t, 3), "players": players})

    writer.release()

    meta = {
        "clip": path, "fps": FPS, "frames": frames, "pitch": {"length": PITCH_W, "width": PITCH_H},
        "pixels": {"width": w, "height": h, "pad": pad, "scale": args.scale},
        # The four corners of the playing area in pixels, in the order
        # (near-left, near-right, far-right, far-left) in *pitch* coordinates
        # (0,0) (105,0) (105,68) (0,68) — this is what a real clip needs a human
        # to click once.
        "corners_px": [
            list(to_px(0, 0, args.scale, pad)), list(to_px(PITCH_W, 0, args.scale, pad)),
            list(to_px(PITCH_W, PITCH_H, args.scale, pad)), list(to_px(0, PITCH_H, args.scale, pad)),
        ],
        "kit_colours_bgr": {"home": [40, 40, 205], "away": [215, 120, 30]},
        "motion": {"advance": args.advance, "width": args.width},
    }
    with open(os.path.join(args.out, "clip.json"), "w") as fh:
        json.dump(meta, fh, indent=2)
    with open(os.path.join(args.out, "ground-truth.json"), "w") as fh:
        json.dump(ground_truth, fh)
    print(f"wrote {path} — {frames} frames, {w}x{h}, {os.path.getsize(path) / 1e6:.1f} MB")
    print(f"corners_px {meta['corners_px']}")


if __name__ == "__main__":
    main()
