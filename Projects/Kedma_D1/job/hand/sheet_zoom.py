"""kedma-d1 ($0): a part of the sales-plan sheet, enlarged, with a centimetre grid in the plan's own frame and the traced fixtures of
one room drawn on it, so a fixture's rectangle is READ off the drawing and not estimated (2026-11-17: the hand trace's island and
tall units were about 30 cm off the sheet; Eliran: «אתה חייב לעבור על תכנית המכר ולהתאים את הכיוונים והפרופורציות»).

usage: python sheet_zoom.py <plan-crop.png> <plan.json> <x0,y0,x1,y1 cm> <out.jpg> [--zoom 2] [--grid 10] [--rooms r-kitchen,r-pantry]
The sheet is 2.25 px/cm; the grid is in cm of the plan frame (x right, y down, origin the crop's top-left).
"""
import argparse
import json

import cv2
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument("sheet"); ap.add_argument("plan"); ap.add_argument("box"); ap.add_argument("out")
ap.add_argument("--zoom", type=float, default=2.0); ap.add_argument("--grid", type=int, default=10); ap.add_argument("--rooms", default="")
# --placements <_furnish/placements.json>: draw what the furnish step BUILT (every placed model's footprint, green) instead of the
# traced rectangles: the 3D model seen from above, on the sheet
ap.add_argument("--placements", default="")
a = ap.parse_args()
S = 2.25
x0, y0, x1, y1 = [float(t) for t in a.box.split(",")]
im = cv2.imread(a.sheet)
c = im[int(y0 * S):int(y1 * S), int(x0 * S):int(x1 * S)]
c = cv2.resize(c, None, fx=a.zoom, fy=a.zoom, interpolation=cv2.INTER_CUBIC)
k = S * a.zoom                                              # px per cm in the picture
P = lambda x, y: (int(round((x - x0) * k)), int(round((y - y0) * k)))
o = c.copy()
g = a.grid
for gx in range(int(x0 // g) * g, int(x1) + 1, g):
    if gx < x0: continue
    major = gx % (5 * g) == 0
    cv2.line(o, P(gx, y0), P(gx, y1), (0, 150, 255) if major else (200, 225, 255), 1)
    if major: cv2.putText(o, str(gx), (P(gx, y0)[0] + 2, 14), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 90, 200), 1)
for gy in range(int(y0 // g) * g, int(y1) + 1, g):
    if gy < y0: continue
    major = gy % (5 * g) == 0
    cv2.line(o, P(x0, gy), P(x1, gy), (0, 150, 255) if major else (200, 225, 255), 1)
    if major: cv2.putText(o, str(gy), (2, P(x0, gy)[1] - 3), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 90, 200), 1)
plan = json.load(open(a.plan, encoding="utf-8"))
rooms = set(t for t in a.rooms.split(",") if t)
built = json.load(open(a.placements, encoding="utf-8"))["resolved"]["placements"] if a.placements else []
for it in built:
    if rooms and it.get("room_id") not in rooms: continue
    fp = it.get("footprint_cm") or []
    if len(fp) < 3: continue
    pts = np.array([P(x, y) for x, y in fp], np.int32)
    if pts[:, 0].max() < 0 or pts[:, 1].max() < 0 or pts[:, 0].min() > o.shape[1] or pts[:, 1].min() > o.shape[0]: continue
    rug = it.get("layer") == "rug"
    cv2.polylines(o, [pts], True, (190, 190, 0) if rug else (0, 150, 0), 1 if rug else 2)
    if not rug:
        fx_, fy_ = int(pts[:, 0].mean()), int(pts[:, 1].mean())
        yaw = np.radians(float(it.get("yaw_deg") or 0)); ln = 14
        cv2.arrowedLine(o, (fx_, fy_), (int(fx_ + np.sin(yaw) * ln), int(fy_ - np.cos(yaw) * ln)), (0, 110, 0), 2, tipLength=0.45)   # the front
        cv2.putText(o, it["id"].replace("-m", ".").replace("ffp-", "+"), (max(2, int(pts[:, 0].min()) + 2), max(26, int(pts[:, 1].min()) + 12)), cv2.FONT_HERSHEY_SIMPLEX, 0.36, (0, 90, 0), 1)
for f in ([] if a.placements else plan.get("fixtures", [])):
    if rooms and f.get("room_id") not in rooms: continue
    pts = np.array([P(x, y) for x, y in f["polygon_cm"]], np.int32)
    if pts[:, 0].max() < 0 or pts[:, 1].max() < 0 or pts[:, 0].min() > o.shape[1] or pts[:, 1].min() > o.shape[0]: continue
    cv2.polylines(o, [pts], True, (0, 0, 255), 2)
    cv2.putText(o, f["id"], (max(2, int(pts[:, 0].min()) + 4), max(28, int(pts[:, 1].min()) + 16)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 0, 0), 1)
cv2.imwrite(a.out, o, [cv2.IMWRITE_JPEG_QUALITY, 90])
print("wrote", a.out, o.shape)
