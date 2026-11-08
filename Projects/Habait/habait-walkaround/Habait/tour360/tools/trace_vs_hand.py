#!/usr/bin/env python
"""trace_vs_hand.py <auto plan-dir> <hand plan.general.json> <hand crop.png> [--bar 1.0]

The acceptance gate for auto-trace (Eliran 2026-11-05): the portal's automatic trace of the 846 sales-plan PDF must equal the
hand trace made for Rainbow apt846. Both are registered in ONE frame: the hand crop is located on the auto run's 288 dpi
sheet (sheet.png) by template matching; every auto coordinate goes auto cm -> auto crop px -> sheet px -> hand crop px ->
hand cm (the hand's own 2.25 px/cm), so the numbers read in the hand trace's units.

Per hand room (matched to an auto room by overlap): area, both sides of the minimum rotated rectangle, centroid offset, IoU.
A room MATCHES when its area and both sides are within the bar (default 1 %) and its centroid within 10 cm.
Openings: each hand opening matched to an auto opening within 60 cm whose two rooms map to the same pair.
Walls: IoU of the wall footprints, rasterised at 2 cm.
Writes <auto plan-dir>/vs-hand.json and prints "matches hand trace: X/Y rooms".
"""
import json
import math
import os
import sys

import cv2
import numpy as np
from shapely.geometry import Polygon, Point
from shapely.ops import unary_union


def poly(loop):
    p = Polygon(loop)
    p = p if p.is_valid else p.buffer(0)
    if p.geom_type != "Polygon":
        p = max(p.geoms, key=lambda g: g.area)
    return p


def sides(p):
    m = p.minimum_rotated_rectangle
    xs, ys = m.exterior.coords.xy
    a = math.hypot(xs[1] - xs[0], ys[1] - ys[0]); b = math.hypot(xs[2] - xs[1], ys[2] - ys[1])
    return sorted([a, b], reverse=True)


def main():
    d, hand_p, hand_crop = sys.argv[1], sys.argv[2], sys.argv[3]
    bar = float(sys.argv[sys.argv.index("--bar") + 1]) if "--bar" in sys.argv else 1.0
    auto = json.load(open(os.path.join(d, "plan.general.json"), encoding="utf-8"))
    hand = json.load(open(hand_p, encoding="utf-8"))
    rj = json.load(open(os.path.join(d, "raster.json"), encoding="utf-8"))
    cx0, cy0 = rj["crop"]["crop_box_px"][:2]
    ppc_a = float(auto["plan_meta"].get("scale_px_per_cm") or json.load(open(os.path.join(d, "report.json")))["scale_px_per_cm"])
    ppc_h = float(hand["plan_meta"].get("scale_px_per_cm") or 2.25)
    # register: the hand crop on the auto sheet (both 288 dpi renders of the same PDF page)
    sheet = cv2.imread(os.path.join(d, "sheet.png"), cv2.IMREAD_GRAYSCALE)
    hc = cv2.imread(hand_crop, cv2.IMREAD_GRAYSCALE)
    f = 4
    r = cv2.matchTemplate(cv2.resize(sheet, (sheet.shape[1] // f, sheet.shape[0] // f), interpolation=cv2.INTER_AREA),
                          cv2.resize(hc, (hc.shape[1] // f, hc.shape[0] // f), interpolation=cv2.INTER_AREA), cv2.TM_CCOEFF_NORMED)
    _, score0, _, (mx, my) = cv2.minMaxLoc(r)
    best = (-1, 0, 0)
    for dy in range(-f * 2, f * 2 + 1):
        for dx in range(-f * 2, f * 2 + 1):
            X, Y = mx * f + dx, my * f + dy
            if X < 0 or Y < 0 or Y + hc.shape[0] > sheet.shape[0] or X + hc.shape[1] > sheet.shape[1]:
                continue
            sub = sheet[Y:Y + hc.shape[0]:8, X:X + hc.shape[1]:8].astype(np.float32)
            tpl = hc[::8, ::8].astype(np.float32)
            c = float(np.corrcoef(sub.ravel(), tpl.ravel())[0, 1])
            if c > best[0]:
                best = (c, X, Y)
    reg_score, hx0, hy0 = best
    to_h = lambda x, y: (((x * ppc_a + cx0) - hx0) / ppc_h, ((y * ppc_a + cy0) - hy0) / ppc_h)
    A = {r_["id"]: poly([to_h(*p_) for p_ in r_["loop"]]) for r_ in auto["rooms"] if len(r_.get("loop", [])) >= 3}
    Hh = {r_["id"]: poly(r_["loop"]) for r_ in hand["rooms"] if len(r_.get("loop", [])) >= 3}
    name_a = {r_["id"]: r_.get("name_he") for r_ in auto["rooms"]}
    name_h = {r_["id"]: r_.get("name_he") for r_ in hand["rooms"]}
    cand = sorted(((hp.intersection(ap).area / max(1e-9, hp.union(ap).area), hid, aid) for hid, hp in Hh.items() for aid, ap in A.items()
                   if hp.intersects(ap)), reverse=True)
    mh, ma, amap = set(), set(), {}
    for iou, hid, aid in cand:
        if hid in mh or aid in ma or iou < 0.15:
            continue
        amap[hid] = aid; mh.add(hid); ma.add(aid)
    rows, n_ok = [], 0
    for hid, hp in Hh.items():
        aid = amap.get(hid)
        if not aid:
            rows.append({"room": hid, "name_he": name_h[hid], "auto": None, "match": False, "why": "no auto room overlaps it"})
            continue
        ap = A[aid]
        sh, sa = sides(hp), sides(ap)
        area_err = 100 * (ap.area - hp.area) / hp.area
        side_err = [100 * (sa[i] - sh[i]) / sh[i] for i in range(2)]
        c_off = hp.centroid.distance(ap.centroid)
        iou = hp.intersection(ap).area / hp.union(ap).area
        ok = abs(area_err) <= bar and all(abs(e) <= bar for e in side_err) and c_off <= 10
        n_ok += ok
        rows.append({"room": hid, "name_he": name_h[hid], "auto": aid, "auto_name_he": name_a.get(aid), "hand_m2": round(hp.area / 1e4, 2), "auto_m2": round(ap.area / 1e4, 2),
                     "area_err_pct": round(area_err, 1), "hand_sides_cm": [round(v) for v in sh], "auto_sides_cm": [round(v) for v in sa],
                     "side_err_pct": [round(e, 1) for e in side_err], "centroid_off_cm": round(c_off, 1), "iou": round(iou, 3), "match": bool(ok)})
    extra = [aid for aid in A if aid not in ma]
    # openings
    inv = {aid: hid for hid, aid in amap.items()}
    hand_o = [o for o in hand.get("openings", []) if o.get("centre_cm")]
    auto_o = [o for o in auto.get("openings", []) if o.get("centre_cm")]
    used, o_rows = set(), []
    for o in hand_o:
        pair_h = sorted(x for x in (o.get("rooms") or []))
        best_o = None
        for j, a_ in enumerate(auto_o):
            if j in used:
                continue
            ca = to_h(*a_["centre_cm"])
            dist = math.hypot(ca[0] - o["centre_cm"][0], ca[1] - o["centre_cm"][1])
            pair_a = sorted(inv.get(x, x) for x in (a_.get("rooms") or []))
            if dist <= 60 and (pair_a == pair_h or not pair_h) and (best_o is None or dist < best_o[0]):
                best_o = (dist, j)
        if best_o:
            used.add(best_o[1])
        o_rows.append({"id": o["id"], "rooms": pair_h, "matched": bool(best_o), "dist_cm": round(best_o[0], 1) if best_o else None})
    # walls
    def raster(polys, shape, s=0.5):
        m = np.zeros(shape, np.uint8)
        for pl in polys:
            if len(pl) >= 3:
                cv2.fillPoly(m, [np.round(np.array(pl) * s).astype(np.int32)], 1)
        return m > 0
    allp = [p_ for r_ in hand["rooms"] for p_ in r_["loop"]] + [p_ for w in hand.get("walls", []) for p_ in w.get("polygon_cm", [])]
    Wd = int(max(p_[0] for p_ in allp) * 0.5) + 200; Hd = int(max(p_[1] for p_ in allp) * 0.5) + 200
    wh = raster([w["polygon_cm"] for w in hand.get("walls", [])], (Hd, Wd))
    wa = raster([[to_h(*p_) for p_ in w["polygon_cm"]] for w in auto.get("walls", [])], (Hd, Wd))
    w_iou = float((wh & wa).sum()) / max(1, int((wh | wa).sum()))
    out = {"bar_pct": bar, "registration": {"hand_crop_at_sheet_px": [hx0, hy0], "corr": round(reg_score, 3), "ppc_auto": ppc_a, "ppc_hand": ppc_h},
           "rooms_matched": n_ok, "rooms_hand": len(Hh), "rooms": rows, "auto_rooms_without_hand_counterpart": extra,
           "openings": {"hand": len(hand_o), "auto": len(auto_o), "matched": sum(o["matched"] for o in o_rows), "rows": o_rows},
           "walls_iou": round(w_iou, 3)}
    json.dump(out, open(os.path.join(d, "vs-hand.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    lines = [f"matches hand trace: {n_ok}/{len(Hh)} rooms (bar {bar} %; registration corr {reg_score:.3f} at sheet px {hx0},{hy0})"]
    for r_ in rows:
        if r_.get("auto"):
            lines.append(f"  {'OK ' if r_['match'] else 'NO '} {r_['room']:22s} area {r_['area_err_pct']:+6.1f} %  sides {r_['side_err_pct']}  centroid {r_['centroid_off_cm']:6.1f} cm  IoU {r_['iou']}")
        else:
            lines.append(f"  NO  {r_['room']:22s} {r_['why']}")
    lines.append(f"  openings: {out['openings']['matched']}/{out['openings']['hand']} hand openings matched (auto has {out['openings']['auto']}); walls IoU {out['walls_iou']}")
    if extra:
        lines.append(f"  auto rooms with no hand counterpart: {extra}")
    sys.stdout.buffer.write(("\n".join(lines) + "\n").encode("utf-8"))


if __name__ == "__main__":
    main()
