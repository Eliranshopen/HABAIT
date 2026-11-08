"""site_key.py: the sales plan's site key (the small compound map in a corner of the sheet) → building footprints
in the PLAN frame, registered on the tower.

  python -I tools/site_key.py --page page-1.png --crop x,y,w,h --tower-footprint derived/tower-footprint.json
         --out derived/site-key.json [--sheet site-key.png] [--floors 8] [--ftf-cm 320]

The key draws every building of the compound as a closed outline and hatches the tower the unit is in. The
hatched outline is matched to the traced floor key (tower-footprint.json, plan cm): scale from the area ratio,
rotation by a brute-force IoU search (0.5 degree steps, mirror not allowed), translation from the centroids.
With --key-north-deg/--plan-north-deg the rotation comes from the two north arrows instead (the outline match is
weak: a schematic rounded quad against the traced floor key). Every other closed outline in the key goes through
the same similarity transform. Geometry only: no names
from the key are invented; the label inside each outline is not read (ids are b1..bn, left to right).
"""
import argparse
import json
import math

import cv2
import numpy as np


def poly_area(p):
    return 0.5 * abs(sum(p[i][0] * p[(i + 1) % len(p)][1] - p[(i + 1) % len(p)][0] * p[i][1] for i in range(len(p))))


def centroid(p):
    a = cx = cy = 0.0
    for i in range(len(p)):
        x0, y0 = p[i]
        x1, y1 = p[(i + 1) % len(p)]
        f = x0 * y1 - x1 * y0
        a += f
        cx += (x0 + x1) * f
        cy += (y0 + y1) * f
    a *= 0.5
    return (cx / (6 * a), cy / (6 * a)) if abs(a) > 1e-9 else (sum(q[0] for q in p) / len(p), sum(q[1] for q in p) / len(p))


def raster(poly, size=400, extent=None):
    img = np.zeros((size, size), np.uint8)
    pts = np.array([[(x + extent) / (2 * extent) * size, (y + extent) / (2 * extent) * size] for x, y in poly], np.int32)
    cv2.fillPoly(img, [pts], 255)
    return img > 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--page", required=True)
    ap.add_argument("--crop", required=True, help="x,y,w,h of the site key on the page image, px")
    ap.add_argument("--tower-footprint", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--sheet", default=None)
    ap.add_argument("--floors", type=int, default=8)
    ap.add_argument("--ftf-cm", type=float, default=320)
    ap.add_argument("--scale-adjust", type=float, default=1.0,
                    help="multiply the area-ratio scale (e.g. 0.91 from a fit of the compound onto the cadastral plot)")
    ap.add_argument("--key-north-deg", type=float, default=None, help="bearing of the key's own north arrow in the key image (0 = up, cw)")
    ap.add_argument("--plan-north-deg", type=float, default=None, help="bearing of the plan's north arrow (site.json north_deg)")
    a = ap.parse_args()

    page = cv2.imdecode(np.fromfile(a.page, np.uint8), cv2.IMREAD_GRAYSCALE)
    x, y, w, h = [int(v) for v in a.crop.split(",")]
    key = page[y:y + h, x:x + w]
    ink = (key < 140).astype(np.uint8) * 255

    # the hatched tower: dense diagonal lines; close them into a solid blob, keep the biggest dense blob
    dense = cv2.morphologyEx(ink, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
    dense = cv2.morphologyEx(dense, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
    cnts, _ = cv2.findContours(dense, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cnts = [c for c in cnts if cv2.contourArea(c) > 0.004 * w * h]
    if not cnts:
        raise SystemExit("no hatched tower found in the key")
    hatched = max(cnts, key=cv2.contourArea)
    hp = [tuple(map(float, q[0])) for q in cv2.approxPolyDP(hatched, 1.5, True)]

    # building outlines: holes (white interiors) enclosed by ink, of building size, not the hatched one
    inv = cv2.bitwise_not(cv2.dilate(ink, np.ones((2, 2), np.uint8)))
    n, lab, stats, cents = cv2.connectedComponentsWithStats(inv, 4)
    blds = []
    hx, hy = centroid(hp)
    for i in range(1, n):
        bx, by, bw, bh, area = stats[i]
        if bx == 0 or by == 0 or bx + bw >= w or by + bh >= h:
            continue  # the outside of the compound
        if area < 0.006 * w * h or area > 0.25 * w * h:
            continue
        m = (lab == i).astype(np.uint8) * 255
        c = max(cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)[0], key=cv2.contourArea)
        if cv2.pointPolygonTest(c, (hx, hy), False) >= 0:
            continue  # inside the tower's own plot outline
        if cv2.pointPolygonTest(hatched, tuple(map(float, cents[i])), False) >= 0:
            continue
        poly = [tuple(map(float, q[0])) for q in cv2.approxPolyDP(c, 1.5, True)]
        blds.append({"px": poly, "area_px": float(area), "c_px": tuple(map(float, cents[i]))})

    tf = json.load(open(a.tower_footprint, encoding="utf-8"))
    fp = tf["polygon_cm"]
    s = math.sqrt(poly_area(fp) / poly_area(hp)) * a.scale_adjust  # cm per key px
    fc, kc = centroid(fp), centroid(hp)
    fpn = [(p[0] - fc[0], p[1] - fc[1]) for p in fp]
    ext = max(max(abs(v) for q in fpn for v in q), 1.0) * 1.4
    target = raster(fpn, extent=ext)
    best = (-1, 0)
    for k in range(720):
        th = math.radians(k * 0.5)
        ct, st = math.cos(th), math.sin(th)
        cand = [((p[0] - kc[0]) * s * ct - (p[1] - kc[1]) * s * st, (p[0] - kc[0]) * s * st + (p[1] - kc[1]) * s * ct) for p in hp]
        r = raster(cand, extent=ext)
        iou = (r & target).sum() / max(1, (r | target).sum())
        if iou > best[0]:
            best = (iou, th)
    iou, th = best
    rot_source = "shape IoU search"
    if a.key_north_deg is not None and a.plan_north_deg is not None:
        # the outline alone is a weak cue (a rounded quad vs the traced key: IoU is flat within 0.07 over all angles);
        # the two north arrows fix the rotation: plan bearing = key bearing + (plan north - key north)
        th = math.radians((a.plan_north_deg - a.key_north_deg) % 360)
        ct0, st0 = math.cos(th), math.sin(th)
        cand = [((p[0] - kc[0]) * s * ct0 - (p[1] - kc[1]) * s * st0, (p[0] - kc[0]) * s * st0 + (p[1] - kc[1]) * s * ct0) for p in hp]
        r = raster(cand, extent=ext)
        iou = (r & target).sum() / max(1, (r | target).sum())
        rot_source = f"north arrows: key {a.key_north_deg} deg, plan {a.plan_north_deg} deg"
    ct, st = math.cos(th), math.sin(th)

    def to_plan(p):
        dx, dy = (p[0] - kc[0]) * s, (p[1] - kc[1]) * s
        return [round(fc[0] + dx * ct - dy * st, 1), round(fc[1] + dx * st + dy * ct, 1)]

    blds.sort(key=lambda b: (b["c_px"][0], b["c_px"][1]))
    out = {
        "schema": "habait/site-key.v1",
        "frame": "plan cm (x right, y down), registered on tower-footprint.json",
        "fit": {"cm_per_px": round(s, 3), "scale_adjust": a.scale_adjust, "rotation_deg": round(math.degrees(th), 1), "rotation_source": rot_source, "iou": round(float(iou), 3)},
        "tower_in_key_px": [[round(p[0], 1), round(p[1], 1)] for p in hp],
        "buildings": [
            {"id": f"b{i + 1}", "polygon_cm": [to_plan(p) for p in b["px"]], "area_m2": round(b["area_px"] * s * s / 1e4, 1),
             "floors": a.floors, "height_m": round(a.floors * a.ftf_cm / 100 + 1.5, 1), "key_centre_px": [round(v, 1) for v in b["c_px"]]}
            for i, b in enumerate(blds)
        ],
    }
    json.dump(out, open(a.out, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print(json.dumps({"fit": out["fit"], "buildings": [(b["id"], b["area_m2"], b["key_centre_px"]) for b in out["buildings"]]}))

    if a.sheet:
        sheet = cv2.cvtColor(key, cv2.COLOR_GRAY2BGR)
        cv2.polylines(sheet, [np.array(hp, np.int32)], True, (0, 0, 255), 2)
        for b in blds:
            cv2.polylines(sheet, [np.array(b["px"], np.int32)], True, (0, 160, 0), 2)
        cv2.imencode(".png", sheet)[1].tofile(a.sheet)


if __name__ == "__main__":
    main()
