#!/usr/bin/env python
"""trace_score.py <auto plan.general.json> <ground-truth plan.general.json> <out.json> [--map auto_id=gt_id,...]

Scores an automatic trace against a hand trace in the same crop frame (cm): per room the area error and the boundary
error (distance from the auto outline to the hand outline, mean / p90 / max, sampled every 2 cm), the openings by room
pair, the fixtures by kind within 60 cm. Rooms are matched by id, else by the largest overlap.
"""
import json
import sys

import numpy as np
from shapely.geometry import Polygon, Point
from shapely.ops import unary_union


def poly(r):
    p = Polygon(r["loop"])
    return p if p.is_valid else p.buffer(0)


def sample(p, step=2.0):
    out = []
    ring = p.exterior if p.geom_type == "Polygon" else max(p.geoms, key=lambda g: g.area).exterior
    n = max(8, int(ring.length / step))
    for k in range(n):
        q = ring.interpolate(k * ring.length / n)
        out.append(q)
    return out, ring


def main():
    auto = json.load(open(sys.argv[1], encoding="utf-8"))
    gt = json.load(open(sys.argv[2], encoding="utf-8"))
    out_path = sys.argv[3]
    remap = {}
    if "--map" in sys.argv:
        for kv in sys.argv[sys.argv.index("--map") + 1].split(","):
            a, b = kv.split("=")
            remap[a] = b
    G = {r["id"]: poly(r) for r in gt["rooms"]}
    A0 = {remap.get(r["id"], r["id"]): poly(r) for r in auto["rooms"]}
    # match auto rooms to hand rooms by shape: greedy on IoU (each auto room used once); the id is only a tie-break
    cand = []
    for gid, gp in G.items():
        for aid, ap in A0.items():
            inter = ap.intersection(gp).area
            if inter > 0:
                cand.append((inter / ap.union(gp).area + (0.001 if aid == gid else 0), gid, aid))
    cand.sort(reverse=True)
    amap, used_g, used_a = {}, set(), set()
    for iou, gid, aid in cand:
        if gid in used_g or aid in used_a or iou < 0.2:
            continue
        amap[aid] = gid; used_g.add(gid); used_a.add(aid)
    A = {amap[aid]: ap for aid, ap in A0.items() if aid in amap}
    unmatched_auto = [aid for aid in A0 if aid not in amap]
    rows = []
    for gid, gp in G.items():
        ap = A.get(gid)
        if ap is None:
            rows.append({"room": gid, "found": False})
            continue
        pts, _ = sample(ap)
        _, gring = sample(gp)
        d = np.array([gring.distance(q) for q in pts])
        rows.append({"room": gid, "auto_id": next(a for a, g in amap.items() if g == gid), "found": True, "gt_m2": round(gp.area / 1e4, 2), "auto_m2": round(ap.area / 1e4, 2),
                     "area_err_pct": round(100 * (ap.area - gp.area) / gp.area, 1),
                     "iou": round(ap.intersection(gp).area / ap.union(gp).area, 3),
                     "edge_mean_cm": round(float(d.mean()), 1), "edge_p90_cm": round(float(np.percentile(d, 90)), 1), "edge_max_cm": round(float(d.max()), 1)})
    remap = {**remap, **amap}
    pair = lambda o: tuple(sorted(remap.get(x, x) for x in o.get("rooms", []) if x))
    gpairs = {pair(o) for o in gt.get("openings", []) if len(o.get("rooms", [])) == 2}
    apairs = {pair(o) for o in auto.get("openings", []) if len(o.get("rooms", [])) == 2}
    fx = []
    for g in gt.get("fixtures", []):
        gc = Point(g.get("centre_cm") or Polygon(g["polygon_cm"]).centroid.coords[0])
        hit = None
        for a in auto.get("fixtures", []):
            ac = Point(a.get("centre_cm") or Polygon(a["polygon_cm"]).centroid.coords[0])
            if a.get("kind") == g.get("kind") and ac.distance(gc) <= 60:
                hit = round(ac.distance(gc), 1)
                break
        fx.append({"id": g["id"], "kind": g.get("kind"), "matched": hit is not None, "dist_cm": hit})
    res = {"rooms": rows,
           "openings": {"gt": len(gpairs), "auto": len(apairs), "matched": sorted(map(list, gpairs & apairs)),
                        "missed": sorted(map(list, gpairs - apairs)), "extra": sorted(map(list, apairs - gpairs))},
           "fixtures": {"gt": len(fx), "matched": sum(f["matched"] for f in fx), "rows": fx},
           "unmatched_auto_rooms": unmatched_auto, "union_open_plan": None}
    tz = [g for g in ("r-terrace-living", "r-terrace-bedroom") if g in G and g in A]
    if tz:
        gu = unary_union([G[g] for g in tz]); au = unary_union([A[g] for g in tz])
        res["union_terrace"] = {"rooms": tz, "gt_m2": round(gu.area / 1e4, 2), "auto_m2": round(au.area / 1e4, 2), "area_err_pct": round(100 * (au.area - gu.area) / gu.area, 1), "iou": round(au.intersection(gu).area / au.union(gu).area, 3)}
        print("terrace union:", res["union_terrace"])
    op = [g for g in ("r-entrance", "r-kitchen", "r-dining", "r-living") if g in G and g in A]
    if op:
        gu = unary_union([G[g] for g in op]); au = unary_union([A[g] for g in op])
        res["union_open_plan"] = {"rooms": op, "gt_m2": round(gu.area / 1e4, 2), "auto_m2": round(au.area / 1e4, 2),
                                  "area_err_pct": round(100 * (au.area - gu.area) / gu.area, 1), "iou": round(au.intersection(gu).area / au.union(gu).area, 3)}
    json.dump(res, open(out_path, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print(f"{'room':20s} {'gt m2':>7s} {'auto':>7s} {'err%':>6s} {'IoU':>6s} {'edge mean/p90/max cm':>22s}")
    for r in rows:
        if not r["found"]:
            print(f"{r['room']:20s}  NOT FOUND"); continue
        print(f"{r['room']:20s} {r['gt_m2']:7.2f} {r['auto_m2']:7.2f} {r['area_err_pct']:6.1f} {r['iou']:6.3f} {r['edge_mean_cm']:7.1f}/{r['edge_p90_cm']:6.1f}/{r['edge_max_cm']:6.1f}")
    if unmatched_auto: print("auto rooms with no hand counterpart:", unmatched_auto)
    if res["union_open_plan"]:
        print("open plan union:", res["union_open_plan"])
    o = res["openings"]; print(f"openings: gt {o['gt']} auto {o['auto']} matched {len(o['matched'])} missed {o['missed']} extra {o['extra']}")
    print(f"fixtures: {res['fixtures']['matched']}/{res['fixtures']['gt']}")


if __name__ == "__main__":
    main()
