"""Step 05 - check geometry.json against the sheet, before any 3D work.

1. overlay: walls, openings, items drawn over the plan (qa/geometry-overlay.png)
2. wall agreement: the model's wall footprint against the sheet's grey wall fill, pixel by pixel
3. printed dimensions against the model
4. areas: gross footprint against the printed 80 m2, rooms against the printed room areas
Writes qa/geometry-check.json and prints a summary. Exit 1 when a hard check fails.
Usage: python 05_check_geometry.py <job root>
"""
import json
import sys
from pathlib import Path

import cv2
import numpy as np
from shapely.geometry import Polygon, box
from shapely.ops import unary_union

root = Path(sys.argv[1])
geo = json.loads((root / "geometry" / "geometry.json").read_text(encoding="utf-8"))
OX, OY = geo["source"]["origin_px"]
img = cv2.imdecode(np.fromfile(str(root / "input" / "plan-hatzav-colour.png"), dtype=np.uint8), cv2.IMREAD_COLOR)
H, W = img.shape[:2]
qa = root / "qa"
qa.mkdir(exist_ok=True)


def P(u, v):
    return int(round(u + OX)), int(round(v + OY))


# ---- 2. wall agreement
walls = unary_union([box(*w["box"]) for w in geo["walls"]])
opens = unary_union([box(*o["box"]) for o in geo["openings"]])
solid = walls.difference(opens)  # what the sheet fills grey (openings are drawn as symbols, not grey)
model = np.zeros((H, W), np.uint8)
for g in getattr(solid, "geoms", [solid]):
    cv2.fillPoly(model, [np.array([P(x, y) for x, y in g.exterior.coords], np.int32)], 255)
    for hole in g.interiors:
        cv2.fillPoly(model, [np.array([P(x, y) for x, y in hole.coords], np.int32)], 0)
rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB).astype(int)
mx, mn = rgb.max(axis=2), rgb.min(axis=2)
sheet = (((mx - mn) <= 10) & (mx >= 150) & (mx <= 220)).astype(np.uint8) * 255
sheet = cv2.morphologyEx(sheet, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5)))
# only the house: mask out the trees and garden lines far from the footprint
roi = np.zeros((H, W), np.uint8)
fp = np.array([P(x, y) for x, y in geo["footprint"]], np.int32)
cv2.fillPoly(roi, [fp], 255)
roi = cv2.dilate(roi, np.ones((9, 9), np.uint8))
sheet &= roi
# the shaft is modelled solid; on the sheet it is a grey frame around a white core: compare outside it
sx0, sy0, sx1, sy1 = [w for w in geo["walls"] if w["id"] == "shaft"][0]["box"]
core = np.zeros((H, W), np.uint8)
cv2.rectangle(core, P(sx0 + 5, sy0 + 9), P(sx1 - 9, sy1 - 9), 255, -1)
keep = core == 0
inter = int(((model > 0) & (sheet > 0) & keep).sum())
union = int((((model > 0) | (sheet > 0)) & keep).sum())
only_model = int(((model > 0) & (sheet == 0) & keep).sum())
only_sheet = int(((model == 0) & (sheet > 0) & keep).sum())
iou = inter / union
# tolerant version: a 2 px (2 cm) band at edges is anti-aliasing, not a difference
k = np.ones((5, 5), np.uint8)
far_model = int(((model > 0) & (cv2.dilate(sheet, k) == 0) & keep).sum())
far_sheet = int(((sheet > 0) & (cv2.dilate(model, k) == 0) & keep).sum())

# ---- 3 + 4. dimensions and areas
dims = geo["dimensions"]
worst = max(dims, key=lambda d: d["delta_pct"])
foot = Polygon(geo["footprint"])
gross = foot.area / 1e4
rooms = []
for r in geo["rooms"]:
    a = Polygon(r["poly"]).area / 1e4
    rooms.append({"id": r["id"], "model_sqm": round(a, 2), "printed_sqm": r["printed_sqm"]})
bed = [r for r in rooms if r["id"] == "bedroom"][0]
band = [i for i in geo["items"] if i["id"] == "b-band"][0]["box"]
bed["model_sqm_without_band"] = round(bed["model_sqm"] - (band[2] - band[0]) * (band[3] - band[1]) / 1e4, 2)

# items inside their rooms, items not inside walls
problems = []
room_poly = {r["id"]: Polygon(r["poly"]) for r in geo["rooms"]}
for it in geo["items"]:
    b = box(*it["box"])
    if it["kind"] in ("tv",):
        continue
    inside = b.intersection(room_poly[it["room"]]).area / b.area
    if inside < 0.97 and "rot_deg" not in it:
        problems.append(f'{it["id"]}: only {inside:.0%} inside room {it["room"]}')
    hit = b.intersection(solid).area
    if hit > 30:
        problems.append(f'{it["id"]}: {hit:.0f} cm2 inside a wall')
for o in geo["openings"]:
    if box(*o["box"]).intersection(walls).area < 0.9 * box(*o["box"]).area:
        problems.append(f'{o["id"]}: opening not inside a wall')

# ---- 1. overlay
ov = img.copy()
tint = ov.copy()
for g in getattr(solid, "geoms", [solid]):
    cv2.fillPoly(tint, [np.array([P(x, y) for x, y in g.exterior.coords], np.int32)], (60, 60, 230))
    for hole in g.interiors:
        cv2.fillPoly(tint, [np.array([P(x, y) for x, y in hole.coords], np.int32)], (255, 255, 255))
ov = cv2.addWeighted(tint, 0.45, ov, 0.55, 0)
for o in geo["openings"]:
    x0, y0, x1, y1 = o["box"]
    cv2.rectangle(ov, P(x0, y0), P(x1, y1), (0, 160, 0), 2)
col = {"VERIFIED": (200, 110, 0), "DERIVED": (0, 140, 255), "ASSUMED": (180, 0, 180)}
for it in geo["items"]:
    x0, y0, x1, y1 = it["box"]
    if "rot_deg" in it:
        cx, cy, w2, h2 = (x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2
        rect = ((cx + OX, cy + OY), (2 * w2, 2 * h2), it["rot_deg"])
        cv2.polylines(ov, [cv2.boxPoints(rect).astype(np.int32)], True, col[it["cls"]], 2)
    else:
        cv2.rectangle(ov, P(x0, y0), P(x1, y1), col[it["cls"]], 2)
for e in geo["outside"]:
    x0, y0, x1, y1 = e["box"]
    cv2.rectangle(ov, P(x0, y0), P(x1, y1), (150, 150, 0), 1)
cv2.polylines(ov, [fp], True, (0, 0, 0), 1)
cv2.putText(ov, "red = model walls | green = openings | blue = drawn items | orange = derived", (30, H - 16),
            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 1)
cv2.imencode(".png", ov)[1].tofile(str(qa / "geometry-overlay.png"))
diff = np.full((H, W, 3), 255, np.uint8)
diff[(model > 0) & (sheet > 0)] = (190, 190, 190)
diff[(model > 0) & (sheet == 0) & keep] = (0, 0, 255)   # model only: red
diff[(model == 0) & (sheet > 0) & keep] = (255, 120, 0)  # sheet only: blue
cv2.imencode(".png", diff[230:1360, 440:1660])[1].tofile(str(qa / "wall-diff.png"))

res = {
    "wall_iou": round(iou, 4), "wall_px_model_only": only_model, "wall_px_sheet_only": only_sheet,
    "wall_px_beyond_2cm_model_only": far_model, "wall_px_beyond_2cm_sheet_only": far_sheet,
    "gross_footprint_sqm": round(gross, 2), "printed_gross_sqm": 80,
    "rooms": rooms, "worst_dimension": worst, "dimensions_over_1pct": [d for d in dims if d["delta_pct"] > 1.0],
    "dimensions_over_2pct": [d for d in dims if d["delta_pct"] > 2.0], "problems": problems,
}
(qa / "geometry-check.json").write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf-8")
print(json.dumps({k: v for k, v in res.items() if k != "worst_dimension"}, ensure_ascii=False, indent=1))
print("worst dim:", worst["label"], worst["printed_cm"], worst["model_cm"], worst["delta_pct"], "%")
print("printed dimensions:")
for d in dims:
    print(f'  {d["label"]:<46} printed {d["printed_cm"]:>5}  model {d["model_cm"]:>5}  delta {d["delta_cm"]:+d} cm  {d["delta_pct"]} %')
wall_px = int(((sheet > 0) & keep).sum())
far_pct = round((far_model + far_sheet) / wall_px * 100, 2)
print(f"wall pixels on the sheet {wall_px}; further than 2 cm from the model or the sheet: {far_pct} % (bar 1 %)")
res["wall_px_sheet"] = wall_px
res["wall_beyond_2cm_pct"] = far_pct
(qa / "geometry-check.json").write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf-8")
bad = far_pct > 1.0 or res["dimensions_over_1pct"] or abs(gross - 80) > 0.8 or problems
sys.exit(1 if bad else 0)
