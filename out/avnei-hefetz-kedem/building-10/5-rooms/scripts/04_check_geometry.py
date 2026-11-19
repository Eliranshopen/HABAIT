"""Step 04 ($0) - the geometry file drawn back on the sales-plan sheet, and measured against it.

Usage: python 04_check_geometry.py <job root>
Writes qa/geometry-overlay.jpg   (sheet + model: walls red outline, windows cyan, doors green, fixtures orange, furniture violet)
       qa/model-only.png         (the model alone, same frame: what the 3D scene is built from)
       qa/geometry-check.json    (printed dimensions, wall-mask agreement, areas)
"""
import json
import sys
from pathlib import Path

import cv2
import numpy as np

root = Path(sys.argv[1])
g = json.loads((root / "geometry" / "geometry.json").read_text(encoding="utf-8"))
S = g["meta"]["px_per_cm"]
X0, Y0 = g["meta"]["origin_px"]
img = cv2.imdecode(np.fromfile(str(root / "input" / "b10-floor1-apts-3-4.jpg"), dtype=np.uint8), cv2.IMREAD_COLOR)
mask = cv2.imdecode(np.fromfile(str(root / "work" / "wall-mask.png"), dtype=np.uint8), cv2.IMREAD_GRAYSCALE)


def P(x, y):
    return [int(round(X0 + x * 100 * S)), int(round(Y0 - y * 100 * S))]


def poly(pts):
    return np.array([P(x, y) for x, y in pts], dtype=np.int32)


def rpoly(r):
    return poly([(r[0], r[1]), (r[2], r[1]), (r[2], r[3]), (r[0], r[3])])


ov = img.copy()
model = np.full_like(img, 255)
wall_img = np.zeros(mask.shape, np.uint8)
for w in g["walls"]:
    cv2.fillPoly(wall_img, [poly(w["exterior"])], 255)
    for h in w["holes"]:
        cv2.fillPoly(wall_img, [poly(h)], 0)
    cv2.polylines(ov, [poly(w["exterior"])], True, (0, 0, 255), 3)
    cv2.fillPoly(model, [poly(w["exterior"])], (90, 90, 90))
for o in g["openings"]:
    col = (255, 200, 0) if o["kind"] in ("window", "sliding_door") else (0, 170, 0)
    for im in (ov, model):
        cv2.fillPoly(im, [rpoly(o["r"])], col)
    c = P((o["r"][0] + o["r"][2]) / 2, (o["r"][1] + o["r"][3]) / 2)
    cv2.putText(model, o["id"], (c[0] - 60, c[1] - 12), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 2, cv2.LINE_AA)
for f in g["fixtures"]:
    for im in (ov, model):
        cv2.polylines(im, [rpoly(f["r"])], True, (0, 140, 255), 4)
    c = P(f["r"][0], f["r"][3])
    cv2.putText(model, f["kind"], (c[0] + 4, c[1] + 22), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 90, 200), 2, cv2.LINE_AA)
for f in g["furniture"]:
    for im in (ov, model):
        if "r" in f:
            cv2.polylines(im, [rpoly(f["r"])], True, (200, 0, 160), 4)
        else:
            rad = int(round(f.get("radius", 0.22) * 100 * S))
            cv2.circle(im, tuple(P(*f["c"])), rad, (200, 0, 160), 4)
    c = P(f["r"][0], f["r"][3]) if "r" in f else P(*f["c"])
    cv2.putText(model, f["kind"], (c[0] + 4, c[1] + 22), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (150, 0, 120), 2, cv2.LINE_AA)
for im in (ov, model):
    cv2.polylines(im, [poly(g["balcony"]["deck"])], True, (0, 120, 60), 4)
    cv2.polylines(im, [poly(g["balcony"]["parapet_outer"])], False, (0, 120, 60), 4)
    cv2.polylines(im, [rpoly(g["lightwell"]["r"])], True, (120, 120, 0), 4)
    cv2.polylines(im, [rpoly(g["laundry"]["r"])], True, (120, 120, 0), 4)
for r in g["rooms"]:
    a = r["rects"][0]
    c = P((a[0] + a[2]) / 2, (a[1] + a[3]) / 2)
    cv2.putText(model, f"{r['id']} {r['printed'] or ''}", (c[0] - 110, c[1]), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 0), 2, cv2.LINE_AA)

x0, y0, x1, y1 = 250, 200, 3400, 3100
s = 1800 / (x1 - x0)
for name, im in (("geometry-overlay.jpg", ov), ("model-only.jpg", model)):
    out = cv2.resize(im[y0:y1, x0:x1], None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
    cv2.imencode(".jpg", out, [cv2.IMWRITE_JPEG_QUALITY, 88])[1].tofile(str(root / "qa" / name))

# agreement of the model's walls with the sheet's wall fill (pixel IoU, and the share of each that the other misses)
m = mask > 0
w = wall_img > 0
inter = int((m & w).sum())
res = {
    "px_per_cm": S,
    "wall_iou": round(inter / float((m | w).sum()), 4),
    "sheet_wall_px_not_in_model_pct": round(100 * float((m & ~w).sum()) / float(m.sum()), 2),
    "model_wall_px_not_on_sheet_pct": round(100 * float((w & ~m).sum()) / float(w.sum()), 2),
    "printed_dimensions": json.loads((root / "work" / "scale-fit.json").read_text(encoding="utf-8"))["rows"],
    "rooms_net_m2": {r["id"]: r["area_m2"] for r in g["rooms"]},
}
# gross area: the outer outline of walls + rooms (holes filled), the way a sales area is usually counted
allm = np.zeros(mask.shape, np.uint8)
allm[w] = 255
for r in g["rooms"]:
    for a in r["rects"]:
        cv2.fillPoly(allm, [rpoly(a)], 255)
for o in g["openings"]:
    cv2.fillPoly(allm, [rpoly(o["r"])], 255)
allm = cv2.morphologyEx(allm, cv2.MORPH_CLOSE, np.ones((25, 25), np.uint8))
cs, _ = cv2.findContours(allm, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
big = max(cs, key=cv2.contourArea)
res["gross_outline_m2"] = round(cv2.contourArea(big) / (S * S) / 1e4, 1)
res["printed_area_m2"] = g["meta"]["printed_area_m2"]
res["net_rooms_m2"] = round(sum(r["area_m2"] for r in g["rooms"]), 1)
ok = sum(1 for r in res["printed_dimensions"] if r["ok"])
res["printed_dimensions_ok"] = f"{ok}/{len(res['printed_dimensions'])}"
(root / "qa" / "geometry-check.json").write_text(json.dumps(res, indent=1), encoding="utf-8")
print({k: v for k, v in res.items() if k not in ("printed_dimensions", "rooms_net_m2")})
