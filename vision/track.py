#!/usr/bin/env python3
"""
Fixed-camera tracker: pixels in, pitch metres out.

This is the honest scope: **one fixed camera, one kit colour per side**. It
finds blobs of each kit colour, takes their centroids, maps them through a
homography built from four corners of the playing area, and links them frame to
frame by nearest neighbour. Broadcast footage (cuts, zoom, crowd, adverts) is a
different problem and this file does not pretend to solve it — see
docs/motion-learning.md §5.

    python3 vision/track.py --clip /tmp/clip/clip.mp4 --calibration /tmp/clip/clip.json \
        --out /tmp/clip/tracks.json

    # a real clip: four corner pixels, clicked once, in this order:
    # (0,0) (105,0) (105,68) (0,68) in pitch coordinates
    python3 vision/track.py --clip match.mp4 \
        --corners 412,988 1512,962 1455,318 470,296 \
        --home-colour "#c82020" --away-colour "#2f6fd0" --out match-tracks.json
"""
from __future__ import annotations

import argparse
import json
import math
import os

import numpy as np


def hex_to_bgr(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    r, g, b = (int(value[i:i + 2], 16) for i in (0, 2, 4))
    return (b, g, r)


def homography(corners_px, pitch_w, pitch_h):
    import cv2
    src = np.array(corners_px, dtype=np.float32)
    dst = np.array([[0, 0], [pitch_w, 0], [pitch_w, pitch_h], [0, pitch_h]], dtype=np.float32)
    return cv2.getPerspectiveTransform(src, dst)


def apply_h(H, px, py):
    v = np.array([px, py, 1.0]) @ H.T
    if abs(v[2]) < 1e-9:
        return None
    return float(v[0] / v[2]), float(v[1] / v[2])


def main() -> None:
    import cv2

    ap = argparse.ArgumentParser()
    ap.add_argument("--clip", required=True)
    ap.add_argument("--calibration", help="clip.json written by make_synthetic_clip.py")
    ap.add_argument("--corners", nargs=4, help="4 corner pixels: x,y x,y x,y x,y")
    ap.add_argument("--home-colour", default=None)
    ap.add_argument("--away-colour", default=None)
    ap.add_argument("--tolerance", type=float, default=60.0, help="per-pixel distance in BGR")
    ap.add_argument("--min-area", type=int, default=30)
    ap.add_argument("--max-jump", type=float, default=4.0, help="metres a player may move in one frame")
    ap.add_argument("--pitch", default="105x68")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    pitch_w, pitch_h = (float(v) for v in args.pitch.split("x"))
    calib = {}
    if args.calibration:
        with open(args.calibration) as fh:
            calib = json.load(fh)

    corners = calib.get("corners_px")
    if args.corners:
        corners = [[float(v) for v in pair.split(",")] for pair in args.corners]
    if not corners:
        raise SystemExit("no calibration: pass --calibration or --corners")

    colours = {}
    for side in ("home", "away"):
        spec = getattr(args, f"{side}_colour") or (calib.get("kit_colours_bgr") or {}).get(side)
        if spec is None:
            raise SystemExit(f"no kit colour for {side}")
        colours[side] = tuple(spec) if isinstance(spec, (list, tuple)) else hex_to_bgr(spec)

    H = homography(corners, pitch_w, pitch_h)

    cap = cv2.VideoCapture(args.clip)
    if not cap.isOpened():
        raise SystemExit(f"could not open {args.clip}")
    fps = cap.get(cv2.CAP_PROP_FPS) or 20.0

    tracks: list[dict] = []
    previous: dict[str, dict[str, tuple[float, float]]] = {"home": {}, "away": {}}
    next_id = {"home": 1, "away": 1}
    frame_index = 0

    while True:
        ok, frame = cap.read()
        if not ok:
            break
        t = round(frame_index / fps, 3)
        blob = cv2.GaussianBlur(frame, (5, 5), 0)
        found: list[dict] = []

        for side, colour in colours.items():
            distance = np.linalg.norm(blob.astype(np.int16) - np.array(colour, dtype=np.int16), axis=2)
            mask = (distance < args.tolerance).astype(np.uint8) * 255
            mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
            count, _labels, stats, centroids = cv2.connectedComponentsWithStats(mask, connectivity=8)
            detections = []
            for i in range(1, count):
                if stats[i, cv2.CC_STAT_AREA] < args.min_area:
                    continue
                world = apply_h(H, float(centroids[i][0]), float(centroids[i][1]))
                if world is None:
                    continue
                x, y = world
                if not (-2 <= x <= pitch_w + 2 and -2 <= y <= pitch_h + 2):
                    continue
                detections.append((x, y, float(stats[i, cv2.CC_STAT_AREA])))

            # Nearest neighbour linking within a side: a person cannot cross
            # four metres in a frame, so anything further is a new player.
            free = [d for d in detections]
            for player_id in list(previous[side].keys()):
                last = previous[side][player_id]
                if not free:
                    previous[side].pop(player_id, None)
                    continue
                dists = [math.hypot(d[0] - last[0], d[1] - last[1]) for d in free]
                best = int(np.argmin(dists))
                if dists[best] > args.max_jump:
                    previous[side].pop(player_id, None)
                    continue
                x, y, area = free.pop(best)
                previous[side][player_id] = (x, y)
                found.append({"id": f"{side}-{player_id}", "team": side, "x": round(x, 2), "y": round(y, 2),
                              "area": int(area), "lost": 0})
            for x, y, area in free:
                player_id = next_id[side]
                next_id[side] += 1
                previous[side][player_id] = (x, y)
                found.append({"id": f"{side}-{player_id}", "team": side, "x": round(x, 2), "y": round(y, 2),
                              "area": int(area), "lost": 0})

        tracks.append({"t": t, "players": found})
        frame_index += 1

    cap.release()

    out = {
        "source": os.path.basename(args.clip),
        "fps": fps,
        "pitch": {"length": pitch_w, "width": pitch_h},
        "frames": tracks,
    }
    with open(args.out, "w") as fh:
        json.dump(out, fh)
    kept = sum(len(f["players"]) for f in tracks) / max(1, len(tracks))
    print(f"{frame_index} frames, {kept:.1f} players tracked per frame -> {args.out}")


if __name__ == "__main__":
    main()
