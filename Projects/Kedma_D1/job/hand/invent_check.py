"""kedma-d1 ($0): does an answer of the image model draw STRUCTURE the 3D model does not have? Run before an answer goes into a room canvas.

Why (2026-11-17): on the pantry, the living room and the dining room the image model drew a niche, an opening, a door on a plain corridor
wall, a skirting board, a framed picture on a table - each one found by eye, after the answer was already in the canvas. Eliran asked
what would help; this is the automatic part of the answer.

A door, an opening, a niche, a skirting board or a frame is made of LONG STRAIGHT edges. The render of the same view (cg.png) has an
edge wherever the model has one. So: the long straight lines of the answer (Hough) are taken where the answer will be used (the view's
unpainted part, painted.png < 128); a line that runs, over most of its length, more than --far px from any edge of the render is a line
the model does not have. Marble veins and fabric folds are not long straight lines; the floor's tile joints and every real edge are in
the render. The verdict is FLAG when such lines add up to more than --limit of the view's width, else PASS.

usage: python invent_check.py <view dir> [--answer <png>] [--far 20] [--smooth 5] [--limit 0.5] [--min-len 0.07] [--out check.jpg]
<view dir> = <apartment>/_local/flatfix/<asset>-r-<tag> (cg.png, painted.png, answer-*.png). Prints one JSON row; exit 3 on FLAG.
"""
import argparse
import glob
import json
import os
import sys

import cv2
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument("dir"); ap.add_argument("--answer"); ap.add_argument("--far", type=float, default=20.0); ap.add_argument("--smooth", type=float, default=5.0)
ap.add_argument("--limit", type=float, default=0.5); ap.add_argument("--min-len", type=float, default=0.07); ap.add_argument("--out")
a = ap.parse_args()
ans_p = a.answer or sorted((p for p in glob.glob(os.path.join(a.dir, "answer-*.png")) if not p.endswith(".reg.png")), key=os.path.getmtime)[-1]
reg = ans_p[:-4] + ".reg.png"
cg = cv2.imread(os.path.join(a.dir, "cg.png")); S = cg.shape[0]
ans = cv2.imread(reg if os.path.exists(reg) else ans_p)
if ans.shape[:2] != cg.shape[:2]:
    ans = cv2.resize(ans, (cg.shape[1], cg.shape[0]), interpolation=cv2.INTER_AREA)
pm = cv2.imread(os.path.join(a.dir, "painted.png"), cv2.IMREAD_GRAYSCALE)
use = (cv2.resize(pm, (cg.shape[1], cg.shape[0]), interpolation=cv2.INTER_NEAREST) < 128) if pm is not None else np.ones(cg.shape[:2], bool)
g = lambda B: cv2.GaussianBlur(cv2.cvtColor(B, cv2.COLOR_BGR2GRAY), (5, 5), 0)
e_cg = cv2.Canny(g(cg), 20, 60)
dist = cv2.distanceTransform((e_cg == 0).astype(np.uint8), cv2.DIST_L2, 5)
e_an = cv2.Canny(g(ans), 40, 110)
L = cv2.HoughLinesP(e_an, 1, np.pi / 360, threshold=int(0.04 * S), minLineLength=int(a.min_len * S), maxLineGap=int(0.006 * S) + 2)
bad, total = [], 0.0
far = a.far * S / 2048.0
off_px = 14 * S / 2048.0
ga = cv2.cvtColor(ans, cv2.COLOR_BGR2GRAY).astype(np.float32)
k = int(9 * S / 2048) | 1
tex = np.sqrt(np.maximum(cv2.blur(ga * ga, (k, k)) - cv2.blur(ga, (k, k)) ** 2, 0))     # local texture (grey-level std)
for ln in (L.reshape(-1, 4) if L is not None else []):
    x1, y1, x2, y2 = (int(v) for v in ln)
    n = max(2, int(np.hypot(x2 - x1, y2 - y1)))
    xs = np.clip(np.linspace(x1, x2, n).round().astype(int), 0, cg.shape[1] - 1)
    ys = np.clip(np.linspace(y1, y2, n).round().astype(int), 0, cg.shape[0] - 1)
    in_use = use[ys, xs]
    if in_use.mean() < 0.6:
        continue
    off = (dist[ys, xs] > far) & in_use
    if off.mean() < 0.7:
        continue
    # a structure edge (a door frame, an opening, a niche, a skirting board, a frame) parts two SMOOTH areas; a fabric or a stone texture
    # draws lines inside a textured area (2026-11-17: bouclé and the table's grain flagged good answers)
    nx, ny = -(y2 - y1) / n, (x2 - x1) / n
    side = []
    for sgn in (1, -1):
        sx = np.clip((xs + sgn * nx * off_px).round().astype(int), 0, cg.shape[1] - 1)
        sy = np.clip((ys + sgn * ny * off_px).round().astype(int), 0, cg.shape[0] - 1)
        side.append(float(np.median(tex[sy, sx])))
    if max(side) > a.smooth:
        continue
    bad.append([x1, y1, x2, y2]); total += n
row = {"step": "invent-check", "view": os.path.basename(a.dir.rstrip("/\\")), "answer": os.path.basename(ans_p),
       "lines_not_in_model": len(bad), "length_px": int(total), "share_of_width": round(total / S, 3), "limit": a.limit,
       "verdict": "FLAG" if total / S > a.limit else "PASS"}
print(json.dumps(row))
if a.out:
    over = ans.copy()
    for x1, y1, x2, y2 in bad:
        cv2.line(over, (x1, y1), (x2, y2), (0, 0, 255), max(2, S // 400))
    cv2.imwrite(a.out, cv2.resize(over, (min(S, 900), min(S, 900)), interpolation=cv2.INTER_AREA), [cv2.IMWRITE_JPEG_QUALITY, 85])
sys.exit(3 if row["verdict"] == "FLAG" else 0)
