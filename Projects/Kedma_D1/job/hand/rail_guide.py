"""kedma-d1 ($0): draw the balcony's glass railing into the CG view of a flat-view fix, from the plan.

Why: the CG render's railing is clear glass, so in the CG view it cannot be seen and the image model has nothing to keep; the designed
panorama drew the railing as a level line (as if it were far away), which is a bow in the viewer. The plan knows the railing exactly:
pane railing-1 (a straight line, head 110 cm) and the camera point cp-balcony (x, y, eye height, the bearing of the panorama's yaw 0).

How: every point of the railing's top (110 cm) and foot (0 cm) is turned into a panorama direction and then into the view's pixel, the
same frame as hand/flatfix.py. The top rail, the foot, the panel joints and a faint tint of the glass are drawn on cg.png (the first
copy is kept as cg.orig.png). The foot line must fall on the deck edge the CG view already shows: that is the check.

usage: python rail_guide.py <apartment dir> <asset> <tag> --plan <tour plan.json>
"""
import argparse
import json
import math
import os
import shutil

import cv2
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument("apt"); ap.add_argument("asset"); ap.add_argument("tag")
ap.add_argument("--plan", required=True)
ap.add_argument("--camera", default="cp-balcony"); ap.add_argument("--pane", default="railing-1")
a = ap.parse_args()
D = os.path.join(a.apt, "_local", "flatfix", f"{a.asset}-{a.tag}")
P = json.load(open(os.path.join(D, "params.json"), encoding="utf-8"))
plan = json.load(open(a.plan, encoding="utf-8"))
cam = next(c for c in plan["camera_points"] if c["id"] == a.camera)
pane = next(p for p in plan["panes"] if p["id"] == a.pane)
x0, y0, x1, y1 = pane["bbox_cm"]
head = float(pane["head_cm"])
# the long run of the railing: the bbox's long side, on the pane's own line (its thin side's middle)
if (y1 - y0) >= (x1 - x0):
    xs = sorted(p[0] for p in pane["polygon_cm"]); xl = float(np.median(xs[: max(2, len(xs) // 2)]))
    run = [(xl, y) for y in np.arange(y0, y1 + 0.1, 5.0)]
else:
    ys = sorted(p[1] for p in pane["polygon_cm"]); yl = float(np.median(ys[: max(2, len(ys) // 2)]))
    run = [(x, yl) for x in np.arange(x0, x1 + 0.1, 5.0)]

src = os.path.join(D, "cg.png"); keep = os.path.join(D, "cg.orig.png")
if not os.path.exists(keep):
    shutil.copyfile(src, keep)
im = cv2.imread(keep)
S = im.shape[0]
yaw, pitch = math.radians(P["yaw"]), math.radians(P["pitch"])
F = np.array([math.cos(pitch) * math.sin(yaw), math.sin(pitch), math.cos(pitch) * math.cos(yaw)])
R = np.array([math.cos(yaw), 0.0, -math.sin(yaw)])
U = np.array([-math.sin(pitch) * math.sin(yaw), math.cos(pitch), -math.sin(pitch) * math.cos(yaw)])
f = (S / 2) / math.tan(math.radians(P["hfov"]) / 2)


def pixel(px, py, z_cm):
    """plan point (cm) at a height (cm) -> the view's pixel, or None behind the camera"""
    dx, dy = px - cam["x"], py - cam["y"]
    bearing = math.atan2(dx, -dy)                       # 0 = up (-y), clockwise
    psi = bearing - math.radians(cam["yaw_deg"])         # the panorama's yaw
    t = math.hypot(dx, dy)
    th = math.atan2(z_cm - cam["z"], t)
    d = np.array([math.cos(th) * math.sin(psi), math.sin(th), math.cos(th) * math.cos(psi)])
    al = float(d @ F)
    if al <= 0.05:
        return None
    return (float(d @ R) / al * f + S / 2, S / 2 - float(d @ U) / al * f)


def line(z):
    pts = [pixel(x, y, z) for x, y in run]
    return [p for p in pts if p is not None and -3 * S < p[0] < 4 * S and -3 * S < p[1] < 4 * S]


top, foot = line(head), line(0.0)
out = im.copy()
if len(top) > 1 and len(foot) > 1:
    poly = np.array(top + foot[::-1], np.int32)
    tint = out.copy(); cv2.fillPoly(tint, [poly], (225, 215, 200))
    out = cv2.addWeighted(tint, 0.40, out, 0.60, 0)
    for k in range(0, len(run), 24):                      # a panel joint every 120 cm
        pt, pf = pixel(*run[k], head), pixel(*run[k], 0.0)
        if pt and pf:
            cv2.line(out, (int(pt[0]), int(pt[1])), (int(pf[0]), int(pf[1])), (70, 70, 70), 3, cv2.LINE_AA)
    cv2.polylines(out, [np.array(foot, np.int32)], False, (60, 60, 60), 5, cv2.LINE_AA)
    cv2.polylines(out, [np.array(top, np.int32)], False, (15, 15, 15), 10, cv2.LINE_AA)
cv2.imwrite(src, out)
vis = [p for p in top if 0 <= p[0] < S and 0 <= p[1] < S]
print(json.dumps({"view": [P["yaw"], P["pitch"], P["hfov"]], "top_points_in_view": len(vis),
                  "top_first": [round(t) for t in vis[0]] if vis else None, "top_last": [round(t) for t in vis[-1]] if vis else None}))
