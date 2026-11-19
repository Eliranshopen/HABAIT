"""kedma-d1 ($0): the sales plan against the 3D model, room by room, as pictures and numbers a person can check.

Why (Eliran, 2026-11-17: «אתה חייב להשתמש בכלים שיודעים לקרוא יותר טוב את תכנית המכר ולהפיק ממנה את הממצאים»): the pictures can only be
as right as the reading of the sheet. For every room this writes
  review/audit/room-<id>.jpg   left: the sheet itself, untouched; right: ONLY what the model holds, drawn at the same scale - the room's
                               outline, its openings (windows blue, doors and passages orange, widths in cm) and every built piece with
                               its class name (fixtures of the sheet green, pieces the rules derived violet); the camera as a cross
  review/audit/audit.json      per room: the dimensions the sheet prints against the model's wall-to-wall spans through the room's
                               middle, with the deviation; the built pieces; the openings
The right panel is drawn from the model's data alone, so a second reader can compare the two without seeing the first reading.

usage: python plan_audit.py <plan-crop.png> <apartment plan.general.json> <hand/geometry.json> <tour _furnish/placements.json> <out dir>
"""
import io
import json
import os
import sys

import cv2
import numpy as np

sheet_p, plan_p, geo_p, plc_p, out = sys.argv[1:6]
os.makedirs(out, exist_ok=True)
S = 2.25                                            # sheet px per cm
Z = 1.6                                             # enlargement of both panels
sheet = cv2.imread(sheet_p)
plan = json.load(io.open(plan_p, encoding="utf-8"))
geo = json.load(io.open(geo_p, encoding="utf-8"))
res = json.load(io.open(plc_p, encoding="utf-8"))["resolved"]
prints = {("r-" + r["id"]): r.get("print_cm") for r in geo["rooms"]}
FIX_IDS = {f["id"] for f in plan["fixtures"]}


def span(loop, c, axis):
    """the clear span through point c along an axis: the nearest boundary crossings on both sides"""
    lo, hi = -1e9, 1e9
    n = len(loop)
    for i in range(n):
        a, b = loop[i], loop[(i + 1) % n]
        o = 1 - axis
        if (a[o] - c[o]) * (b[o] - c[o]) > 0 or a[o] == b[o]:
            continue
        t = (c[o] - a[o]) / (b[o] - a[o])
        v = a[axis] + t * (b[axis] - a[axis])
        if v <= c[axis]:
            lo = max(lo, v)
        else:
            hi = min(hi, v)
    return hi - lo if lo > -1e8 and hi < 1e8 else None


def inside_point(loop):
    """a point well inside the room: the pole of its distance transform on a 1 cm raster"""
    pts = np.array(loop)
    x0, y0 = pts.min(0) - 2
    w, h = (pts.max(0) - pts.min(0) + 4).astype(int)
    m = np.zeros((h, w), np.uint8)
    cv2.fillPoly(m, [np.round(pts - [x0, y0]).astype(np.int32)], 1)
    d = cv2.distanceTransform(m, cv2.DIST_L2, 5)
    j, i = np.unravel_index(int(d.argmax()), d.shape)
    return (float(i + x0), float(j + y0))


rows = []
for room in plan["rooms"]:
    rid = room["id"]
    bx0, by0, bx1, by1 = room["bbox_cm"]
    m = 28.0
    x0, y0, x1, y1 = bx0 - m, by0 - m, bx1 + m, by1 + m
    crop = sheet[max(0, int(y0 * S)):int(y1 * S), max(0, int(x0 * S)):int(x1 * S)]
    left = cv2.resize(crop, None, fx=Z, fy=Z, interpolation=cv2.INTER_CUBIC)
    k = S * Z
    H, W = left.shape[:2]
    right = np.full((H, W, 3), 255, np.uint8)
    P = lambda x, y: (int(round((x - max(0, x0)) * k)), int(round((y - max(0, y0)) * k)))
    poly = lambda pts: np.array([P(*p) for p in pts], np.int32)
    # every room outline in view, this room's bold
    for r2 in plan["rooms"]:
        cv2.polylines(right, [poly(r2["loop"])], True, (60, 60, 60) if r2["id"] == rid else (190, 190, 190), 3 if r2["id"] == rid else 1)
    items = []
    flat = ("rug", "bath_mat", "door_mat")                              # what lies on the floor is drawn first, under the pieces
    for q in sorted(res["placements"], key=lambda q: q["class"] not in flat):
        if q["room_id"] != rid:
            continue
        fixed = q["source"].startswith("fixture:")
        col = (70, 150, 70) if fixed else (170, 90, 170)
        if q["class"] not in flat:
            cv2.fillPoly(right, [poly(q["footprint_cm"])], (225, 240, 225) if fixed else (240, 225, 240))
        cv2.polylines(right, [poly(q["footprint_cm"])], True, col, 2)
        c = np.mean(np.array(q["footprint_cm"]), 0)
        cv2.putText(right, q["class"], (P(*c)[0] - 30, P(*c)[1] + 4), cv2.FONT_HERSHEY_SIMPLEX, 0.42, col, 1, cv2.LINE_AA)
        items.append({"id": q["id"], "class": q["class"], "from": "sheet" if fixed else "rule", "size_cm": [round(q["width_cm"]), round(q["depth_cm"])],
                      "height_cm": round(q["height_cm"]) if q.get("height_cm") else None})
    for q in res["procedural"]:
        if q["room_id"] != rid:
            continue
        fp = q.get("footprint_cm") or []
        if len(fp) < 3:                             # an assembly without a footprint of its own (wall shelves): the box of its parts
            pp = np.array([p for part in q["parts"] for p in part["poly_cm"]])
            (ax, ay), (bx, by) = pp.min(0), pp.max(0)
            fp = [[ax, ay], [bx, ay], [bx, by], [ax, by]]
        cv2.fillPoly(right, [poly(fp)], (225, 240, 225)); cv2.polylines(right, [poly(fp)], True, (70, 150, 70), 2)
        c = np.mean(np.array(fp), 0)
        cv2.putText(right, q["kind"], (P(*c)[0] - 30, P(*c)[1] + 4), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (70, 150, 70), 1, cv2.LINE_AA)
        items.append({"id": q["id"], "class": q["kind"], "from": "sheet", "size_cm": None, "height_cm": None})
    ops = []
    for o in plan["openings"]:
        if rid not in (o.get("rooms") or []):
            continue
        win = o["kind"] == "window"
        col = (200, 110, 30) if win else (30, 130, 230)
        cv2.line(right, P(*o["a_cm"]), P(*o["b_cm"]), col, 5)
        c = o["centre_cm"]
        cv2.putText(right, f"{o['kind']} {round(o['width_cm'])}", (P(*c)[0] - 34, P(*c)[1] - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.42, col, 1, cv2.LINE_AA)
        ops.append({"id": o["id"], "kind": o["kind"], "width_cm": round(o["width_cm"]), "to": [r for r in o.get("rooms", []) if r != rid]})
    cam = next((c for c in plan["camera_points"] if c["room_id"] == rid), None)
    if cam:
        cv2.drawMarker(right, P(cam["x"], cam["y"]), (0, 0, 220), cv2.MARKER_CROSS, 18, 2)
    cv2.putText(left, "SALES PLAN", (8, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 200), 2, cv2.LINE_AA)
    cv2.putText(right, f"3D MODEL  {rid}", (8, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 200), 2, cv2.LINE_AA)
    both = np.hstack([left, np.full((H, 6, 3), 0, np.uint8), right])
    cv2.imwrite(os.path.join(out, f"room-{rid}.jpg"), both, [cv2.IMWRITE_JPEG_QUALITY, 88])
    # the printed dimensions against the model's spans through the room's middle
    c = inside_point(room["loop"])
    sx, sy = span(room["loop"], c, 0), span(room["loop"], c, 1)
    pr = prints.get(rid)
    dims = None
    if pr:
        # A printed dimension is a clear span between two wall faces SOMEWHERE in the room (a room with a window recess, a door lobby or
        # a wardrobe bay has several). So every span of the model's outline is taken - one per 2 cm scan line, both ways - and each
        # printed number is matched with the span nearest to it; `lines_pct` = how much of the room has that span (within 2 %).
        pts = np.array(room["loop"]); spans = []
        for axis in (0, 1):
            o = 1 - axis
            for t in np.arange(pts[:, o].min() + 1.0, pts[:, o].max(), 2.0):
                xs = []
                n = len(room["loop"])
                for i in range(n):
                    a, b = room["loop"][i], room["loop"][(i + 1) % n]
                    if (a[o] - t) * (b[o] - t) < 0:
                        xs.append(a[axis] + (t - a[o]) / (b[o] - a[o]) * (b[axis] - a[axis]))
                xs.sort()
                spans += [xs[k + 1] - xs[k] for k in range(0, len(xs) - 1, 2)]
        spans = np.array(spans)
        dims = []
        for v in [v for v in pr if v]:
            near = float(spans[np.abs(spans - v).argmin()])
            dims.append({"printed_cm": v, "model_cm": round(near, 1), "diff_cm": round(near - v, 1), "diff_pct": round((near - v) / v * 100, 2),
                         "lines_pct": round(float((np.abs(spans - v) <= 0.02 * v).mean()) * 100, 1)})
    rows.append({"room": rid, "name_he": room.get("name_he"), "area_m2": room.get("area_m2"), "printed_cm": pr,
                 "model_span_cm": [round(sx, 1) if sx else None, round(sy, 1) if sy else None], "dims": dims, "pieces": items, "openings": ops,
                 "picture": f"room-{rid}.jpg"})
json.dump({"rooms": rows}, io.open(os.path.join(out, "audit.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
for r in rows:
    d = r["dims"]
    print(r["room"].ljust(11), "printed", r["printed_cm"], "| model spans", r["model_span_cm"], "|",
          " ; ".join(f"{x['printed_cm']}->{x['model_cm']} ({x['diff_pct']:+.1f}%, {x['lines_pct']}% of lines)" for x in d) if d else "no printed dimension", "| pieces", len(r["pieces"]))
