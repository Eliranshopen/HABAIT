#!/usr/bin/env python
"""intake_raster.py <plan.pdf> --out <dir> [options]

Lane A / A1: a raster sales plan (PDF) -> plan.json (schema 0.2.0-draft, geometry "general", cm, y down)
+ report.json / report.md (every room: measured vs printed; recall vs the known printed dims and the
ground-truth rooms; area sanity; edit-cost).

Steps (each cached in <out>; --force redoes them):
  1. rasterize      pymupdf, 288 dpi, grey                       -> sheet.png
  2. crop           the apartment drawing (intake/rasterize.py)  -> plan-crop.png, crop.json, tiles, small copies
  3. vlm            semantics + printed dims (intake/vlm.py)     -> vlm/vlm.json          [--vlm claude|none|file:x]
  4. trace A        rooms / walls / glazing, no labels (intake/tracer_cv.py) -> trace-a/
  5. assign         the VLM names the traced regions from the numbered overlay -> assign/assign.json [--assign ...]
  6. trace B        label-seeded: merged zones split, fixture-filled rooms seeded -> trace/
  7. calibrate      px -> cm from the printed room dimensions (nominal = dpi / 2.54 / scale)
  8. emit           plan.json + report.json + report.md

The default VLM backend is the Claude Code subscription CLI (`claude -p --model opus --allowedTools Read`):
no API key and no per-call charge. `--vlm none` runs the CV part alone.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import math
import os
import re
import sys

import cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import rasterize as rz  # noqa: E402
import tracer_cv  # noqa: E402
import vlm as vlm_mod  # noqa: E402

PLAN_TYPE = {"living": "living", "kitchen": "kitchen", "dining": "hall", "bedroom": "bedroom", "master_bedroom": "bedroom",
             "safe_room": "safe_room", "bathroom": "bathroom", "toilet": "toilet", "hall": "hall", "corridor": "corridor",
             "balcony": "balcony", "service_balcony": "service_balcony", "storage": "storage", "wardrobe": "storage",
             "shaft": "other", "passage": "balcony", "other": "other"}
NOT_A_TOUR_ROOM = {"shaft"}


def jdump(obj, path):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)


def jload(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def norm_he(s):
    return re.sub(r"[^א-ת]", "", s or "")


# ----------------------------------------------------------------------------------------------- assignment pass
def run_assign(overlay_png, crop_png, room_names, out_dir, backend, model):
    os.makedirs(out_dir, exist_ok=True)
    with open(os.path.join(HERE, "assign_prompt.md"), encoding="utf-8") as f:
        prompt = f.read()
    prompt = prompt.replace("{OVERLAY_PNG}", os.path.abspath(overlay_png)).replace("{CROP_PNG}", os.path.abspath(crop_png))
    prompt = prompt.replace("{ROOM_LIST}", "\n".join(f"  - {n}" for n in room_names))
    with open(os.path.join(out_dir, "prompt.md"), "w", encoding="utf-8") as f:
        f.write(prompt)
    if backend == "none":
        a = {"regions": {}, "unplaced": [], "label_positions": {}, "confidence": 0, "stub": True}
    elif backend.startswith("file:"):
        with open(backend[5:], encoding="utf-8") as f:
            a = vlm_mod.parse_reply(f.read())
    else:
        reply = vlm_mod.run_claude_cli(prompt, out_dir, model=model)
        a = vlm_mod.parse_reply(reply)
    a.setdefault("regions", {}); a.setdefault("unplaced", []); a.setdefault("label_positions", {})
    jdump(a, os.path.join(out_dir, "assign.json"))
    return a


def similarity_fit(src, dst):
    """least-squares similarity (scale, rotation, translation) src->dst; >= 2 pairs. Returns f(x,y)."""
    if len(src) < 2:
        return lambda x, y: (x, y), None
    s = np.array(src, float); d = np.array(dst, float)
    ms, md = s.mean(0), d.mean(0)
    s0, d0 = s - ms, d - md
    a = (s0[:, 0] * d0[:, 0] + s0[:, 1] * d0[:, 1]).sum()
    b = (s0[:, 0] * d0[:, 1] - s0[:, 1] * d0[:, 0]).sum()
    den = (s0 ** 2).sum()
    if den <= 0:
        return lambda x, y: (x, y), None
    ca, sa = a / den, b / den
    scale = math.hypot(ca, sa); rot = math.degrees(math.atan2(sa, ca))
    if len(src) < 3 or not (0.6 <= scale <= 1.6) or abs(rot) > 25:  # too few pairs or a wild fit: translation only
        t = md - ms
        return (lambda x, y: (x + t[0], y + t[1])), {"mode": "translation", "t": t.tolist(), "pairs": len(src)}
    t = md - np.array([ca * ms[0] - sa * ms[1], sa * ms[0] + ca * ms[1]])
    return (lambda x, y: (ca * x - sa * y + t[0], sa * x + ca * y + t[1])), {"mode": "similarity", "scale": scale, "rot_deg": rot, "t": t.tolist(), "pairs": len(src)}


SIDES = {"north": (0, -1), "south": (0, 1), "east": (1, 0), "west": (-1, 0), "north-east": (1, -1), "north-west": (-1, -1),
         "south-east": (1, 1), "south-west": (-1, 1), "top": (0, -1), "bottom": (0, 1), "right": (1, 0), "left": (-1, 0)}


def leftover_free(trace_a, trace_dir, W, H):
    """free space the trace-A regions did not claim (rooms full of fixtures, shafts, slivers)."""
    barrier = cv2.imread(os.path.join(trace_dir, "barrier.png"), 0)
    free = (barrier == 0).astype(np.uint8)
    free = cv2.erode(free, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
    claimed = np.zeros((H, W), np.uint8)
    for r in trace_a["rooms"]:
        cv2.fillPoly(claimed, [np.array(r["loop_px"], np.int32).reshape(-1, 1, 2)], 1)
    claimed = cv2.dilate(claimed, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
    return (free > 0) & (claimed == 0)


def seed_unplaced(entry, regions, leftover, px_per_cm, W, H, hint_xy=None):
    """the largest leftover free component within 0..350 cm beyond the adjacent region on the named side."""
    rid = entry.get("adjacent_region"); side = (entry.get("side") or "").lower().replace(" ", "-")
    if rid not in regions or side not in SIDES:
        return None
    dx, dy = SIDES[side]
    n = math.hypot(dx, dy); dx, dy = dx / n, dy / n
    x0, y0, x1, y1 = regions[rid]["bbox_px"]
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    half = (abs(dx) * (x1 - x0) + abs(dy) * (y1 - y0)) / 2
    ys, xs = np.nonzero(leftover)
    proj = (xs - cx) * dx + (ys - cy) * dy - half
    perp = np.abs(-(xs - cx) * dy + (ys - cy) * dx)
    band = (proj > -20) & (proj < 350 * px_per_cm) & (perp < max(x1 - x0, y1 - y0) * 0.9)
    if hint_xy is not None:
        band &= np.hypot(xs - hint_xy[0], ys - hint_xy[1]) < 450 * px_per_cm
    if not band.any():
        return None
    m = np.zeros((H, W), np.uint8); m[ys[band], xs[band]] = 1
    n_c, lab, st, _ = cv2.connectedComponentsWithStats(m, connectivity=8)
    if n_c <= 1:
        return None
    best = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
    if st[best, cv2.CC_STAT_AREA] < 0.15 * 1e4 * px_per_cm ** 2:
        return None
    comp = (lab == best).astype(np.uint8)
    dist = cv2.distanceTransform(comp, cv2.DIST_L2, 3)
    y, x = np.unravel_index(np.argmax(dist), dist.shape)
    return (float(x), float(y))


def build_labels(vlm, assign, trace_a, W, H, trace_dir=None, px_per_cm=1.0):
    """Seeds for trace B: one label per VLM room with a crop-px position inside the right region."""
    rooms = {r["name_en"]: r for r in vlm["rooms"]}
    regions = {r["id"]: r for r in trace_a["rooms"]}
    leftover = leftover_free(trace_a, trace_dir, W, H) if trace_dir else None
    unplaced = {u.get("room"): u for u in assign.get("unplaced", []) if isinstance(u, dict)}
    entrance_contacts = {}
    for o in trace_a.get("openings", []):
        if "outside" in o["rooms"] and o.get("kind") == "entrance_door":
            rid = [r for r in o["rooms"] if r != "outside"][0]
            entrance_contacts[rid] = o["centre_px"]
    raw_pos = {}
    for n, r in rooms.items():
        p = assign.get("label_positions", {}).get(n) or r.get("label_center_frac")
        if p:
            raw_pos[n] = (p[0] * W, p[1] * H)
    region_of = {}
    for rid, info in assign.get("regions", {}).items():
        for n in info.get("rooms", []) or []:
            if n in rooms and rid in regions:
                region_of[n] = rid
    # correction of the VLM coordinates from the single-room regions (region centre = that label's true place)
    src, dst = [], []
    for rid, info in assign.get("regions", {}).items():
        names = [n for n in (info.get("rooms") or []) if n in rooms]
        if len(names) == 1 and names[0] in raw_pos and rid in regions:
            src.append(raw_pos[names[0]]); dst.append(regions[rid]["inner_point_px"])
    corr, fit = (lambda x, y: (x, y)), {"mode": "none (raw VLM fractions; the region centre is not the label position)", "pairs": len(src)}
    labels = []
    for n, r in rooms.items():
        rid = region_of.get(n)
        if rid:
            names_here = [m for m in assign["regions"][rid].get("rooms", []) if m in rooms]
            if len(names_here) == 1:
                xy = regions[rid]["inner_point_px"]
                how = "region-centre"
            elif r["type"] in ("hall", "corridor") and rid in entrance_contacts:
                # an entrance hall usually has no printed label: seed it just inside the entrance door
                xy = snap_into(entrance_contacts[rid], regions[rid]["loop_px"], W, H)
                how = "entrance-door contact"
            else:
                xy = corr(*raw_pos[n]) if n in raw_pos else regions[rid]["inner_point_px"]
                xy = snap_into(xy, regions[rid]["loop_px"], W, H)
                how = "vlm-corrected, snapped into region"
        else:
            xy = None
            if n in unplaced and leftover is not None:
                hint = corr(*raw_pos[n]) if n in raw_pos else None
                xy = seed_unplaced(unplaced[n], regions, leftover, px_per_cm, W, H, hint)
                how = "leftover free space beside " + str(unplaced[n].get("adjacent_region")) + " " + str(unplaced[n].get("side"))
            if xy is None and n in raw_pos and leftover is not None:
                x, y = int(round(raw_pos[n][0])), int(round(raw_pos[n][1]))
                if 0 <= x < W and 0 <= y < H and leftover[y, x]:
                    xy = raw_pos[n]; how = "vlm position (unplaced, in leftover free space)"
            if xy is None:
                continue
        labels.append({"name": n, "name_en": n, "name_he": r["name_he"], "type": r["type"], "is_outdoor": r["is_outdoor"],
                       "printed_dims_cm": r.get("printed_dims_cm"), "xy_px": [float(xy[0]), float(xy[1])], "how": how,
                       "region_a": rid})
    return labels, fit


def snap_into(xy, loop_px, W, H):
    m = np.zeros((H, W), np.uint8)
    cv2.fillPoly(m, [np.array(loop_px, np.int32).reshape(-1, 1, 2)], 1)
    m = cv2.erode(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15)))
    x, y = int(round(xy[0])), int(round(xy[1]))
    if 0 <= x < W and 0 <= y < H and m[y, x]:
        return (x, y)
    ys, xs = np.nonzero(m)
    if not len(xs):
        return xy
    j = np.argmin(np.hypot(xs - x, ys - y))
    return (float(xs[j]), float(ys[j]))


# ----------------------------------------------------------------------------------------------- calibration
def calibrate(trace, nominal):
    samples = []
    for rm in trace["rooms"]:
        L = rm.get("label") or {}
        pd = L.get("printed_dims_cm")
        if not pd or rm.get("zone_of") is not None:
            continue  # a zone cut by a virtual boundary cannot calibrate anything
        a, b = rm["min_rect_px"]["size"]
        Wp, Dp = sorted(pd, reverse=True)
        r1, r2 = a / Wp, b / Dp
        agree = abs(r1 - r2) / max(r1, r2) <= 0.04
        samples.append({"room": L.get("name_en"), "ratio_long": r1, "ratio_short": r2, "agree": agree, "printed": [Wp, Dp]})
    for s_ in samples:
        if not s_["agree"]:
            dl, ds = abs(s_["ratio_long"] / nominal - 1), abs(s_["ratio_short"] / nominal - 1)
            if min(dl, ds) < 0.02 and max(dl, ds) > 0.06:
                s_["suspect_printed_value"] = s_["printed"][1] if ds > dl else s_["printed"][0]
                s_["tracer_says_cm"] = round((s_["ratio_short"] if ds > dl else s_["ratio_long"]) * s_["suspect_printed_value"] / nominal, 1)
    good = [s for s in samples if s["agree"] and abs((s["ratio_long"] + s["ratio_short"]) / 2 / nominal - 1) < 0.08]
    one_sided = [s for s in samples if s.get("suspect_printed_value")]
    if good:
        fit = float(np.median([(s["ratio_long"] + s["ratio_short"]) / 2 for s in good]))
        basis = "median of px/cm over the rooms whose long and short measured/printed ratios agree within 4 %: " + ", ".join(
            f"{s['room']} ({s['printed'][0]}x{s['printed'][1]})" for s in good)
    elif one_sided:
        vals = [(s["ratio_long"] if abs(s["ratio_long"] / nominal - 1) < abs(s["ratio_short"] / nominal - 1) else s["ratio_short"]) for s in one_sided]
        fit = float(np.median(vals))
        basis = "median of px/cm over the one printed value per room that the trace agrees with (the other value of the pair is flagged suspect): " + ", ".join(
            f"{s['room']} ({s['printed'][0]}x{s['printed'][1]}, suspect {s['suspect_printed_value']})" for s in one_sided)
    else:
        fit = nominal
        basis = "nominal only (no room gave a consistent printed pair)"
    return {"px_per_cm": fit, "nominal_px_per_cm": nominal, "deviation_pct": round((fit / nominal - 1) * 100, 2),
            "basis": basis, "samples": samples, "rooms_used": [s["room"] for s in good]}


# ----------------------------------------------------------------------------------------------- emit plan.json
def to_cm(pts, k):
    return [[round(x / k, 1), round(y / k, 1)] for x, y in pts]


def shoelace(poly):
    x = np.array([p[0] for p in poly]); y = np.array([p[1] for p in poly])
    return 0.5 * float(np.dot(x, np.roll(y, -1)) - np.dot(y, np.roll(x, -1)))


def is_virtual(o):
    """SCHEMA.md 9a: a kind 'opening' whose head is the ceiling is a virtual boundary between open-plan zones."""
    return o.get("kind") == "opening" and float(o.get("head_cm", 0)) >= 280


def disagreements(rooms):
    rows = []
    for r in rooms:
        pd = r.get("printed_dims_cm")
        if not pd:
            continue
        bb = r["clear_dims_cm"]
        for axis, pr, tr in (("w", pd[0], bb[0]), ("d", pd[1], bb[1])):
            if pr and abs(tr / pr - 1) > 0.05:
                why = "the bbox of a skewed (rotated) room is not its clear size; the tracer's min-rect reads " + \
                      f"{r['measured_dims_cm'][0]}x{r['measured_dims_cm'][1]}"
                if r.get("zone_boundary"):
                    why += "; the room is an open-plan zone cut by a virtual boundary (not a drawn wall)"
                if r["type"] == "bathroom":
                    why += "; fixtures drawn against the walls notch the traced floor"
                if r["is_outdoor"]:
                    why += "; the printed pair covers only part of the terrace"
                rows.append({"room_id": r["id"], "axis": axis, "printed_cm": pr, "traced_cm": tr, "delta_cm": round(tr - pr, 1),
                             "resolution": "printed wins in the record; geometry left as traced, for the correction screen",
                             "why": why, "auto": True})
    return rows


def emit_plan(args, trace, vlm, cal, crop_info, sheet_info, out_dir):
    k = cal["px_per_cm"]
    unit = vlm.get("unit", {}) or {}
    rooms, id_map = [], {}
    used = set()
    for rm in trace["rooms"]:
        L = rm.get("label") or {}
        t = L.get("type", "other")
        if t in NOT_A_TOUR_ROOM:
            continue
        base = "r-" + (re.sub(r"[^a-z0-9]+", "-", (L.get("name_en") or rm["id"]).lower()).strip("-") or rm["id"])
        rid = base; n = 2
        while rid in used:
            rid = f"{base}-{n}"; n += 1
        used.add(rid); id_map[rm["id"]] = rid
        loop = to_cm(rm["loop_px"], k)
        if shoelace(loop) < 0:
            loop = loop[::-1]
        xs = [p[0] for p in loop]; ys = [p[1] for p in loop]
        a, b = rm["min_rect_px"]["size"]
        rooms.append({
            "id": rid, "name_he": L.get("name_he") or f"חדר ללא שם ({rm['id']})", "name_en": L.get("name_en") or f"Unnamed room ({rm['id']})",
            "unnamed": not L.get("name_he"),
            "type": PLAN_TYPE.get(t, "other"), "type_detail": t, "is_outdoor": bool(L.get("is_outdoor")),
            "loop": loop, "printed_dims_cm": L.get("printed_dims_cm"),
            "clear_dims_cm": [round(max(xs) - min(xs), 1), round(max(ys) - min(ys), 1)],
            "measured_dims_cm": [round(a / k, 1), round(b / k, 1)],
            "bbox_cm": [round(min(xs), 1), round(min(ys), 1), round(max(xs), 1), round(max(ys), 1)],
            "area_m2": round(abs(shoelace(loop)) / 1e4, 3),
            "zone_boundary": "virtual (geodesic Voronoi of the labels; needs a hand check)" if rm.get("zone_of") is not None else None,
            "note": None,
        })
    walls = []
    for w in trace["walls"]:
        walls.append({"id": w["id"], "kind": "exterior" if w.get("touches_outside") else "interior", "height_cm": args.ceiling_cm,
                      "polygon_cm": to_cm(w["polygon_px"], k), "area_cm2": round(abs(shoelace(to_cm(w["polygon_px"], k))))})
    openings = []
    for o in trace["openings"]:
        rr = [id_map.get(r, r if r == "outside" else None) for r in o["rooms"]]
        if any(r is None for r in rr):
            continue
        head = 215 if o["kind"] in ("door", "entrance_door") else (args.ceiling_cm if o.get("virtual") else 220)
        openings.append({"id": o["id"], "kind": o["kind"], "a_cm": [round(v / k, 1) for v in o["a_px"]], "b_cm": [round(v / k, 1) for v in o["b_px"]],
                         "centre_cm": [round(v / k, 1) for v in o["centre_px"]], "angle_deg": round(o["angle_deg"], 1),
                         "width_cm": round(o["width_px"] / k, 1), "sill_cm": 0, "head_cm": head, "rooms": rr})
    panes = []
    for p in trace["panes"]:
        panes.append({"id": p["id"], "kind": p["kind"], "sill_cm": 0, "head_cm": args.ceiling_cm if p["kind"] == "facade" else 110,
                      "polygon_cm": to_cm(p["polygon_px"], k)})
    cams = []
    for rm in trace["rooms"]:
        rid = id_map.get(rm["id"])
        if not rid:
            continue
        ang = rm["min_rect_px"]["angle_deg"]
        cams.append({"id": "cp-" + rid[2:], "room_id": rid, "x": round(rm["inner_point_px"][0] / k, 1), "y": round(rm["inner_point_px"][1] / k, 1),
                     "z": 160, "yaw_deg": round((ang + 90) % 360, 1), "note": "auto: the room's pole of inaccessibility, yaw along the long axis"})
    today = dt.date.today().isoformat()
    plan = {
        "schema_version": "0.2.0-draft", "units": "cm", "geometry": "general",
        "axes": f"x right, y down on the plan crop (raster frame, {k:.4f} px/cm); origin = the crop's top-left; angles are bearings, 0 = up (-y), clockwise",
        "apartment_id": args.apartment_id,
        "plan_meta": {
            "source_file": os.path.relpath(args.pdf, start=os.path.dirname(os.path.abspath(out_dir))).replace("\\", "/"),
            "source_sha256": sha256(args.pdf),
            "source_label_he": f"דירה {unit.get('number')}" if unit.get("number") else None,
            "project": unit.get("project"), "unit_label": unit.get("number"),
            "tracer": "Habait/engine/intake/intake_raster.py (VLM: " + str(vlm.get("_meta", {}).get("backend")) + "/" + str(vlm.get("_meta", {}).get("model")) +
                      "; CV: tracer_cv.py, an OpenCV port of trace-rooms.mjs: grey fill = walls, double strokes = glazing, DT-watershed rooms, label-seeded zones)",
            "trace_date": today,
            "trace_method": "rasterize 288 dpi; auto-crop; VLM reads names, printed dims, unit table; CV: walls from the grey fill, glazing from double strokes, "
                            "rooms = watershed basins of the free-space distance transform (passages < 120 cm separate), open-plan zones split by geodesic "
                            "Voronoi of the VLM label positions; openings = basin contacts; scale fitted to the printed room dimensions",
            "scale_basis": cal["basis"] + f"; nominal {cal['nominal_px_per_cm']:.4f} px/cm from 1:{args.scale} at {sheet_info['dpi']} dpi; fitted {k:.4f} ({cal['deviation_pct']:+.2f} %)",
            "scale_px_per_cm": round(k, 4),
            "raster_origin_px": [0, 0],
            "source_crop_box_px": crop_info["crop_box_px"],
            "rights_state": args.rights_state,
            "rights_note": args.rights_note,
            "ceiling_height_cm": args.ceiling_cm,
            "assumptions": [
                f"ceiling {args.ceiling_cm} cm (a plan drawing has no section)",
                "door heads 215 cm, railing 110 cm, facade glazing floor to ceiling",
                "open-plan zone boundaries are geodesic Voronoi cuts between the VLM label positions, not drawn lines",
                "room polygons follow the free space the tracer saw: fixtures drawn against a wall may notch them",
            ],
            "disagreements": disagreements(rooms),
            "virtual_boundaries": [o["id"] + " " + "|".join(o["rooms"]) for o in openings if is_virtual(o)],
            "vlm_confidence": vlm.get("confidence"),
        },
        "rooms": rooms, "walls": walls, "openings": openings, "panes": panes, "camera_points": cams,
        "fixtures": [],
        "fixtures_note": "TODO: the drawn furniture (kitchen run, island, beds, wardrobes, tub, WC) is not extracted yet; the studio's plan.json has 19 hand-read fixtures",
    }
    add_edge_kinds(plan)
    jdump(plan, os.path.join(out_dir, "plan.json"))
    return plan


def add_edge_kinds(plan, wall_tol=15.0, open_tol=40.0):
    """rooms[].edge_kinds (SCHEMA.md 9a): 'wall' when the edge runs along a wall polygon, 'open' along a virtual
    zone cut, else 'line' (glazing, a slab edge, a drawn line). Sampled at the edge's mid and quarter points."""
    from shapely.geometry import LineString, Point, Polygon
    from shapely.ops import unary_union

    walls = [Polygon(w["polygon_cm"]).buffer(0) for w in plan["walls"] if len(w["polygon_cm"]) >= 3]
    walls_u = unary_union(walls) if walls else None
    cuts = [LineString([o["a_cm"], o["b_cm"]]) for o in plan["openings"] if is_virtual(o)]
    cuts_u = unary_union(cuts) if cuts else None
    for r in plan["rooms"]:
        loop = r["loop"]
        kinds = []
        for i in range(len(loop)):
            a, b = loop[i], loop[(i + 1) % len(loop)]
            pts = [Point(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t) for t in (0.25, 0.5, 0.75)]
            if cuts_u is not None and sum(cuts_u.distance(p) <= open_tol for p in pts) >= 2:
                kinds.append("open")
            elif walls_u is not None and sum(walls_u.distance(p) <= wall_tol for p in pts) >= 2:
                kinds.append("wall")
            else:
                kinds.append("line")
        r["edge_kinds"] = kinds


# ----------------------------------------------------------------------------------------------- report
def match_rooms(vlm_rooms, gt_rooms):
    """VLM rooms <-> ground-truth rooms by Hebrew name, then English name, then type among the unmatched."""
    pairs, used = [], set()
    for v in vlm_rooms:
        hit = None
        for g in gt_rooms:
            if g["id"] in used:
                continue
            if norm_he(g["name_he"]) and norm_he(g["name_he"]) == norm_he(v["name_he"]):
                hit = ("name_he", g); break
        if not hit:
            for g in gt_rooms:
                if g["id"] in used:
                    continue
                if (g.get("name_en") or "").lower() == (v.get("name_en") or "").lower():
                    hit = ("name_en", g); break
        if hit:
            used.add(hit[1]["id"]); pairs.append((v, hit[1], hit[0]))
    for v in vlm_rooms:
        if any(p[0] is v for p in pairs):
            continue
        vt = PLAN_TYPE.get(v["type"], "other")
        for g in gt_rooms:
            if g["id"] in used:
                continue
            if g["type"] == vt and g["type"] not in ("hall", "other"):
                used.add(g["id"]); pairs.append((v, g, "type")); break
    return pairs


def make_report(args, trace, vlm, cal, plan, out_dir, timing, crop_info=None):
    rep = {"pdf": args.pdf, "date": dt.date.today().isoformat(), "timing_s": timing, "vlm_backend": vlm.get("_meta"),
           "scale": {k: v for k, v in cal.items() if k != "samples"}, "scale_samples": cal["samples"]}
    # --- printed dims recall
    known = None
    if args.known_dims and os.path.exists(args.known_dims):
        kd = jload(args.known_dims)
        known = kd.get("drawing", {}).get("printed_dimensions_cm") if isinstance(kd, dict) else kd
    read = set(vlm.get("printed_dimensions_cm") or [])
    if known:
        kn = set(known)
        rep["printed_dims"] = {"known": sorted(kn), "read": sorted(read), "hits": sorted(kn & read), "missed": sorted(kn - read),
                               "false": sorted(read - kn), "recall": f"{len(kn & read)}/{len(kn)}"}
    else:
        rep["printed_dims"] = {"read": sorted(read), "known": None}
    # --- unit fields vs the known intake
    if args.known_dims and os.path.exists(args.known_dims):
        kd = jload(args.known_dims); ku = kd.get("unit", {}); vu = vlm.get("unit", {})
        rep["unit_fields"] = {f: {"known": ku.get(f), "read": vu.get(f), "ok": ku.get(f) == vu.get(f)} for f in ("number", "area_m2", "terrace_m2", "rooms_count", "type_mark")}
        rep["unit_fields"]["floor"] = {"known": kd.get("building", {}).get("floor_of_unit"), "read": vu.get("floor"),
                                       "ok": kd.get("building", {}).get("floor_of_unit") == vu.get("floor")}
    # --- rooms vs ground truth
    gt = jload(args.ground_truth) if args.ground_truth and os.path.exists(args.ground_truth) else None
    vlm_rooms = [r for r in vlm["rooms"] if r["type"] not in NOT_A_TOUR_ROOM]
    traced = plan["rooms"]
    if gt:
        pairs = match_rooms(vlm_rooms, gt["rooms"])
        gt_hit = {g["id"] for _, g, _ in pairs}
        traced_names = {r["name_en"] for r in traced}
        rooms_traced_of_gt = [g["id"] for v, g, _by in pairs if v["name_en"] in traced_names]
        rep["rooms_eval"] = {
            "gt_count": len(gt["rooms"]), "vlm_count": len(vlm_rooms), "traced_count": len(traced),
            "vlm_vs_gt_matched": f"{len(gt_hit)}/{len(gt['rooms'])}",
            "vlm_vs_gt_pairs": [{"vlm": v["name_en"], "gt": g["id"], "by": by} for v, g, by in pairs],
            "gt_missing_in_vlm": [g["id"] + " (" + g["name_en"] + ")" for g in gt["rooms"] if g["id"] not in gt_hit],
            "vlm_extra": [v["name_en"] for v in vlm_rooms if not any(p[0] is v for p in pairs)],
            "traced_vs_gt": f"{len(rooms_traced_of_gt)}/{len(gt['rooms'])}",
            "traced_unlabeled": [r["id"] for r in traced if r.get("unnamed")],
            "zones_split_virtually": [r["id"] for r in traced if r.get("zone_boundary")],
        }
        # area per matched room vs GT
        gt_by_id = {g["id"]: g for g in gt["rooms"]}
        tr_by_name = {r["name_en"]: r for r in traced}
        rows = []
        for v, g, by in pairs:
            t = tr_by_name.get(v["name_en"])
            if t:
                rows.append({"room": v["name_en"], "gt": g["id"], "traced_m2": t["area_m2"], "gt_m2": g["area_m2"],
                             "delta_pct": round((t["area_m2"] / g["area_m2"] - 1) * 100, 1) if g["area_m2"] else None})
        rep["rooms_eval"]["area_vs_gt"] = rows
        # openings vs GT by room pair
        gt_pairs = {frozenset(id_map_gt(o["rooms"], pairs, vlm_rooms)) for o in gt["openings"]}
        our_pairs = {frozenset(o["rooms"]) for o in plan["openings"] if not is_virtual(o)}
        rep["openings_eval"] = {"gt_count": len(gt["openings"]), "traced_count": len([o for o in plan["openings"] if not is_virtual(o)]),
                           "virtual_zone_cuts": len([o for o in plan["openings"] if is_virtual(o)]),
                           "pairs_matched": len(gt_pairs & our_pairs), "gt_pairs_missing": [sorted(p) for p in gt_pairs - our_pairs],
                           "extra_pairs": [sorted(p) for p in our_pairs - gt_pairs]}
        rep["walls"] = {"gt_count": len(gt["walls"]), "traced_count": len(plan["walls"]),
                        "gt_area_m2": round(sum(w.get("area_cm2", 0) for w in gt["walls"]) / 1e4, 2),
                        "traced_area_m2": round(sum(w["area_cm2"] for w in plan["walls"]) / 1e4, 2),
                        "panes_gt": len(gt.get("panes", [])), "panes_traced": len(plan["panes"])}
    else:
        rep["rooms_eval"] = {"vlm_count": len(vlm_rooms), "traced_count": len(traced)}
        rep["walls"] = {"traced_count": len(plan["walls"]), "traced_area_m2": round(sum(w["area_cm2"] for w in plan["walls"]) / 1e4, 2)}
    # --- per-room printed vs measured (+-3 %)
    rows = []
    for r in traced:
        pd = r.get("printed_dims_cm")
        row = {"room": r["name_en"], "printed": pd, "measured": r["measured_dims_cm"], "clear_bbox": r["clear_dims_cm"],
               "area_m2": r["area_m2"], "zone": bool(r.get("zone_boundary"))}
        if pd:
            Wp, Dp = sorted(pd, reverse=True); a, b = r["measured_dims_cm"]
            d1, d2 = (a / Wp - 1) * 100, (b / Dp - 1) * 100
            row.update({"delta_pct": [round(d1, 1), round(d2, 1)], "pass_3pct": abs(d1) <= 3 and abs(d2) <= 3,
                        "comparable": not r.get("zone_boundary")})
        rows.append(row)
    comp = [x for x in rows if x.get("comparable")]
    rep["dims_check"] = {"rows": rows, "comparable": len(comp), "pass": sum(1 for x in comp if x["pass_3pct"]),
                         "not_comparable": [x["room"] for x in rows if x.get("printed") and not x.get("comparable")]}
    # --- area sanity
    indoor = sum(r["area_m2"] for r in traced if not r["is_outdoor"])
    outdoor = sum(r["area_m2"] for r in traced if r["is_outdoor"])
    wall_m2 = rep["walls"]["traced_area_m2"]
    unit_area = (vlm.get("unit") or {}).get("area_m2")
    rep["area_sanity"] = {"indoor_rooms_m2": round(indoor, 2), "outdoor_rooms_m2": round(outdoor, 2), "walls_m2": wall_m2,
                          "indoor_plus_walls_m2": round(indoor + wall_m2, 2), "unit_area_m2_from_sheet": unit_area,
                          "terrace_m2_from_sheet": (vlm.get("unit") or {}).get("terrace_m2"),
                          "gap_pct": round(((indoor + wall_m2) / unit_area - 1) * 100, 1) if unit_area else None,
                          "note": "the contract area (תקן 2) counts walls, half the party walls and a share of the common parts; "
                                  "indoor rooms + traced walls should fall 0..15 % under it"}
    # --- edit cost
    ec = {"rooms_missing": len(rep["rooms_eval"].get("gt_missing_in_vlm", [])) if gt else 0,
          "rooms_unlabeled": len([r for r in traced if r.get("unnamed")]),
          "rooms_not_traced": len(vlm_rooms) - len([r for r in traced if not r.get("unnamed")]),
          "zone_boundaries_to_place": len([r for r in traced if r.get("zone_boundary")]),
          "dims_failing_3pct": len([x for x in comp if not x["pass_3pct"]]),
          "openings_missing": len(rep.get("openings_eval", {}).get("gt_pairs_missing", [])) if gt else 0,
          "openings_extra": len(rep.get("openings_eval", {}).get("extra_pairs", [])) if gt else 0,
          "fixtures_to_place": len(gt.get("fixtures", [])) if gt else 0}
    ec["rooms_not_traced"] = max(0, ec["rooms_not_traced"])
    ec["total_edits"] = sum(v for k, v in ec.items() if k != "fixtures_to_place")
    ec["note"] = "one edit = one room to add/rename/split-line to move, one dimension pair out of 3 %, one opening to add/remove; fixtures counted separately"
    rep["edit_cost"] = ec
    rep.update(correction_screen_block(args, plan, vlm, cal, rep, traced, gt))
    dims_all = dimensions_block(trace, vlm, plan, cal)
    rep["dimensions"] = [d for d in dims_all if d.get("anchor_cm")]
    rep["dimensions_unplaced"] = [d for d in dims_all if not d.get("anchor_cm")]
    rep["geometry_check_note"] = ("validate-plan.mjs is a schema/consistency check (it passes a room moved 10 cm); the geometry gates are "
                                  "dims_check here (printed vs min-rect, 3 % / 4 % under 5 m2) and gates/plan_gate.py on report.dimensions")
    rep["frames"] = frames_block(args, cal, crop_info)
    jdump(rep, os.path.join(out_dir, "report.json"))
    write_report_md(rep, os.path.join(out_dir, "report.md"))
    return rep


TOL_PCT, TOL_SMALL_PCT, SMALL_ROOM_M2 = 3.0, 4.0, 5.0


def frames_block(args, cal, crop_info):
    """Which raster plan.json refers to, and how the ground-truth frame maps onto it (measured, not assumed)."""
    k = cal["px_per_cm"]
    out = {"plan_frame": "cm in Habait/engine/_local/<apt>/plan-crop.png (origin = its top-left), scale report.raster.px_per_cm",
           "engine_crop_box_on_sheet_px": crop_info["crop_box_px"],
           "engine_cm_to_engine_px": [round(k, 4), 0, 0, 0, round(k, 4), 0]}
    if args.ground_truth and os.path.exists(args.ground_truth):
        gtp = jload(args.ground_truth)
        gk = gtp.get("plan_meta", {}).get("scale_px_per_cm")
        tb = args.tour_crop_box_px
        if gk and tb:
            cb = crop_info["crop_box_px"]
            dx, dy = tb[0] - cb[0], tb[1] - cb[1]
            out["ground_truth_frame"] = {"file": args.ground_truth, "crop": "Habait/tour360/apartments/apt846/_local/plan/plan-crop.png",
                                         "tour_crop_box_on_sheet_px": tb, "px_per_cm": gk,
                                         "offset_tour_to_engine_px": [dx, dy],
                                         "gt_cm_to_engine_px": [gk, 0, dx, 0, gk, dy],
                                         "gt_cm_to_engine_cm": [round(gk / k, 5), 0, round(dx / k, 1), 0, round(gk / k, 5), round(dy / k, 1)],
                                         "how": "the tour crop was located on sheet.png by template matching (corr 1.000); engine_px = tour_px + offset"}
    return out


def dimensions_block(trace, vlm, plan, cal):
    """report.dimensions[]: every printed value with, when a straight stroke of that length exists, its line in the
    plan frame (format of gates/fixtures/apt846.dims.json: value_cm, kind, rooms, a_cm, b_cm, anchor_cm, angle_deg)."""
    k = cal["px_per_cm"]
    nominal = cal["nominal_px_per_cm"]
    lines = trace.get("dimension_lines", [])
    for L in lines:
        L["length_cm"] = round(L["length_cm_nominal"] * nominal / k, 1)
    room_of_value = {}
    for r in plan["rooms"]:
        for v in (r.get("printed_dims_cm") or []):
            room_of_value.setdefault(v, []).append(r["id"])
    extra = set()
    for vr in vlm.get("rooms", []):
        extra.update(vr.get("extra_printed_cm") or [])
    out, used = [], set()
    biggest_room = max([max(r["clear_dims_cm"]) for r in plan["rooms"]] or [0])
    for v in sorted(vlm.get("printed_dimensions_cm") or [], reverse=True):
        rooms = room_of_value.get(v, [])
        kind = "room_clear" if rooms else ("sub_element" if v in extra else ("overall" if v >= biggest_room * 0.9 else "partial"))
        cands = [(abs(L["length_cm"] / v - 1), i) for i, L in enumerate(lines) if i not in used and abs(L["length_cm"] / v - 1) <= 0.04]
        cands.sort(key=lambda c: (c[0] - 0.02 * min(lines[c[1]]["digits_near"], 2)))
        row = {"value_cm": v, "kind": kind, "rooms": rooms, "label": f"VLM printed value {v}" + (" of " + ",".join(rooms) if rooms else "")}
        if cands:
            i = cands[0][1]; used.add(i); L = lines[i]
            a = [round(L["a_px"][0] / k, 1), round(L["a_px"][1] / k, 1)]; b = [round(L["b_px"][0] / k, 1), round(L["b_px"][1] / k, 1)]
            row.update({"a_cm": a, "b_cm": b, "anchor_cm": [round(L["mid_px"][0] / k, 1), round(L["mid_px"][1] / k, 1)],
                        "angle_deg": L["angle_deg"], "line_length_cm": L["length_cm"], "digits_near": L["digits_near"],
                        "match": "a straight stroke of the printed length (+-4 %)"})
        else:
            row["match"] = None
        out.append(row)
    return out


def correction_screen_block(args, plan, vlm, cal, rep, traced, gt):
    """The fields the correction screen (card 02, Habait/engine/correct/README-he.md) reads from report.json.
    plan.json is in the crop frame, so cm -> px on plan-crop.png is the fitted scale and no offset.
    Tolerance: 3 % as the plan says, widened to 4 % for rooms under 5 m2 (a 212x210 bathroom traced at
    218x218 is 3.6 % off and is the truth: at that size the wall-face reading of a 2.25 px/cm raster is
    +-2 px = +-1 cm per side, i.e. +-1 % per side already)."""
    k = cal["px_per_cm"]
    unit = vlm.get("unit") or {}
    rooms_out, mism, n_checked, n_within, max_dev = [], [], 0, 0, 0.0
    open_by_room = {}
    for o in plan["openings"]:
        for r in o["rooms"]:
            open_by_room.setdefault(r, []).append(o["id"])
    for r in traced:
        pd = r.get("printed_dims_cm")
        meas = None; dev = None; status = "no_print"; scope = "room"
        if pd:
            a, b = r["measured_dims_cm"]
            order = sorted(range(2), key=lambda i: -pd[i])      # printed index of the long side first
            meas = [None, None]; meas[order[0]] = a; meas[order[1]] = b
            devs = [abs(meas[i] / pd[i] - 1) * 100 for i in range(2)]
            dev = round(max(devs), 1)
            tol = TOL_SMALL_PCT if r["area_m2"] < SMALL_ROOM_M2 else TOL_PCT
            if r.get("zone_boundary"):
                scope, status = "part", "part"
            else:
                n_checked += 1
                status = "ok" if dev <= tol else "bad"
                n_within += status == "ok"
                max_dev = max(max_dev, dev)
                if status == "bad":
                    mism.append({"id": f"m-{len(mism) + 1}", "kind": "dims", "target": r["id"],
                                 "message_he": f"{r['name_he'] or r['name_en']}: נמדד {meas[0]:.0f}×{meas[1]:.0f} מול מודפס {pd[0]}×{pd[1]} ({dev} %)"})
        rooms_out.append({"room_id": r["id"], "name_he": r["name_he"], "name_en": r["name_en"], "type": r["type"],
                          "label_he": None if r.get("unnamed") else r["name_he"], "printed_dims_cm": pd, "printed_scope": scope,
                          "measured_dims_cm": meas, "deviation_pct": dev, "status": status,
                          "openings": open_by_room.get(r["id"], []),
                          "notes_he": "גבול אזור וירטואלי (חלוקה אוטומטית של חלל פתוח), לבדיקה" if r.get("zone_boundary") else None})
    if gt:
        for pair in rep.get("openings_eval", {}).get("gt_pairs_missing", []):
            ids = {x["room_id"] for x in rooms_out}
            if all(p_ in ids for p_ in pair):
                mism.append({"id": f"m-{len(mism) + 1}", "kind": "opening_missing", "target": pair[0], "rooms": list(pair),
                             "message_he": "חסר פתח בין " + " ל-".join(pair)})
    for r in rooms_out:
        if r["status"] == "no_print" and r["name_en"].startswith("Unnamed"):
            mism.append({"id": f"m-{len(mism) + 1}", "kind": "label", "target": r["room_id"], "message_he": "חדר ללא שם: לבחור שם מהרשימה"})
    known_n = len(rep["printed_dims"].get("known") or []) or None
    return {
        "schema": "habait.intake-report/0.1",
        "apartment_id": plan["apartment_id"],
        "title_he": f"דירה {unit.get('number', '')} · {unit.get('project') or ''}, קומה {unit.get('floor', '?')}".strip(),
        "source": {"pdf": os.path.basename(args.pdf), "unit": unit.get("number"), "project_he": unit.get("project"),
                   "plan_date": unit.get("date"), "sha256": plan["plan_meta"]["source_sha256"]},
        "plan": "plan.json",
        "raster": {"image": "plan-crop.png", "cm_to_px": [round(k, 4), 0, 0, 0, round(k, 4), 0], "px_per_cm": round(k, 4),
                   "origin_px": [0, 0], "rotation_deg": 0,
                   "note": "plan.json is in the frame of plan-crop.png (origin = crop top-left); the crop box on sheet.png is plan_meta.source_crop_box_px"},
        "summary": {"rooms_total": len(traced), "rooms_named": sum(1 for r in traced if not r.get("unnamed")),
                    "dims_total": known_n, "dims_read": len(rep["printed_dims"].get("hits", rep["printed_dims"].get("read", []))),
                    "dims_checked": n_checked, "dims_within_tol": n_within, "max_dev_pct": max_dev,
                    "tol_pct": TOL_PCT, "tol_small_rooms_pct": TOL_SMALL_PCT, "small_room_m2": SMALL_ROOM_M2,
                    "tolerance_note": "3 % per the work plan; 4 % for rooms under 5 m2 (the ground truth's main bathroom 218x218 vs printed 212x210 = 3.6 % is a true residual of the raster, not an error)",
                    "edit_cost": rep["edit_cost"]["total_edits"]},
        "rooms": rooms_out,
        "openings": [{"opening_id": o["id"], "kind": o["kind"], "rooms": o["rooms"], "width_cm": o["width_cm"], "virtual": is_virtual(o)} for o in plan["openings"]],
        "mismatches": mism,
    }


def id_map_gt(gt_pair, pairs, vlm_rooms):
    """GT room ids in an opening -> our plan ids via the VLM<->GT pairing (unmatched stay as GT ids)."""
    out = []
    for g in gt_pair:
        if g == "outside":
            out.append("outside"); continue
        hit = next((v for v, gg, _ in pairs if gg["id"] == g), None)
        out.append(("r-" + re.sub(r"[^a-z0-9]+", "-", hit["name_en"].lower()).strip("-")) if hit else g)
    return out


def write_report_md(rep, path):
    L = []
    L.append(f"# Intake report: {os.path.basename(rep['pdf'])} ({rep['date']})\n")
    L.append(f"VLM backend: `{rep['vlm_backend']}`; timings (s): {rep['timing_s']}\n")
    s = rep["scale"]
    L.append(f"## Scale\n\nfitted **{s['px_per_cm']:.4f} px/cm** vs nominal {s['nominal_px_per_cm']:.4f} ({s['deviation_pct']:+.2f} %). {s['basis']}\n")
    pdm = rep["printed_dims"]
    if pdm.get("known"):
        L.append(f"## Printed dimensions\n\nrecall **{pdm['recall']}**; missed {pdm['missed']}; false {pdm['false']}\n")
    if "unit_fields" in rep:
        L.append("## Unit table\n\n| field | known | read | ok |\n|---|---|---|---|")
        for f, v in rep["unit_fields"].items():
            L.append(f"| {f} | {v['known']} | {v['read']} | {'yes' if v['ok'] else 'NO'} |")
        L.append("")
    r = rep["rooms_eval"]
    L.append("## Rooms\n")
    for k in ("gt_count", "vlm_count", "traced_count", "vlm_vs_gt_matched", "traced_vs_gt", "gt_missing_in_vlm", "vlm_extra", "traced_unlabeled", "zones_split_virtually"):
        if k in r:
            L.append(f"- {k}: {r[k]}")
    if r.get("area_vs_gt"):
        L.append("\n| room | GT id | traced m2 | GT m2 | delta % |\n|---|---|---|---|---|")
        for x in r["area_vs_gt"]:
            L.append(f"| {x['room']} | {x['gt']} | {x['traced_m2']} | {x['gt_m2']} | {x['delta_pct']} |")
    d = rep["dims_check"]
    L.append(f"\n## Printed vs measured (±3 %): {d['pass']}/{d['comparable']} comparable rooms pass; not comparable (virtual zone): {d['not_comparable']}\n")
    L.append("| room | printed | measured (min-rect) | delta % | pass | zone |\n|---|---|---|---|---|---|")
    for x in d["rows"]:
        L.append(f"| {x['room']} | {x['printed']} | {x['measured']} | {x.get('delta_pct', '')} | {x.get('pass_3pct', '')} | {'virtual' if x['zone'] else ''} |")
    if "openings_eval" in rep:
        o = rep["openings_eval"]
        L.append(f"\n## Openings\n\nGT {o['gt_count']}, traced {o['traced_count']} (+{o['virtual_zone_cuts']} virtual zone cuts); pairs matched {o['pairs_matched']}; "
                 f"GT pairs missing {o['gt_pairs_missing']}; extra {o['extra_pairs']}\n")
    w = rep["walls"]
    L.append(f"## Walls\n\n{w}\n")
    a = rep["area_sanity"]
    L.append(f"## Area sanity\n\nindoor rooms {a['indoor_rooms_m2']} m2 + walls {a['walls_m2']} m2 = {a['indoor_plus_walls_m2']} m2 vs sheet {a['unit_area_m2_from_sheet']} m2 "
             f"(gap {a['gap_pct']} %); outdoor rooms {a['outdoor_rooms_m2']} m2 vs sheet terrace {a['terrace_m2_from_sheet']} m2\n")
    e = rep["edit_cost"]
    L.append("## Edit cost\n")
    for k, v in e.items():
        L.append(f"- {k}: {v}")
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(L) + "\n")


# ----------------------------------------------------------------------------------------------- main
def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("pdf")
    ap.add_argument("--out", required=True)
    ap.add_argument("--dpi", type=int, default=288)
    ap.add_argument("--scale", type=int, default=50, help="drawing scale denominator (1:50); overridden by the VLM's reading when it parses")
    ap.add_argument("--vlm", default="claude", help="claude | none | file:<reply or json>")
    ap.add_argument("--assign", default="claude", help="claude | none | file:<reply or json>  (the region-naming pass)")
    ap.add_argument("--model", default="opus")
    ap.add_argument("--apartment-id", default=None)
    ap.add_argument("--ceiling-cm", type=float, default=290)
    ap.add_argument("--rights-state", default="partner-supplied")
    ap.add_argument("--rights-note", default="")
    ap.add_argument("--known-dims", default=None, help="an apt intake fixture (drawing.printed_dimensions_cm, unit.*) to score against")
    ap.add_argument("--ground-truth", default=None, help="a hand-checked plan.json to score rooms/openings/walls against")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--tour-crop-box-px", type=json.loads, default=None,
                    help="the ground truth's own crop box on sheet.png, [x0,y0,x1,y1], for report.frames (846: [1750,380,5500,4280], template-matched)")
    ap.add_argument("--publish", default="v1", help="sub-folder of --out that receives plan.json, report.json, report.md, plan-crop.png (the correction screen reads it)")
    args = ap.parse_args(argv)
    out = args.out
    os.makedirs(out, exist_ok=True)
    import time
    T = {}

    t0 = time.time()
    sheet = os.path.join(out, "sheet.png")
    if args.force or not os.path.exists(os.path.join(out, "sheet.json")):
        info = rz.rasterize(args.pdf, sheet, dpi=args.dpi); jdump(info, os.path.join(out, "sheet.json"))
    sheet_info = jload(os.path.join(out, "sheet.json"))
    crop = os.path.join(out, "plan-crop.png")
    if args.force or not os.path.exists(os.path.join(out, "crop.json")):
        ci = rz.autocrop(sheet, crop, dpi=args.dpi); jdump(ci, os.path.join(out, "crop.json"))
        rz.downscale(sheet, os.path.join(out, "sheet-small.png"), 2400)
        rz.downscale(crop, os.path.join(out, "plan-crop-vlm.png"), 2000)
        jdump(rz.tiles(crop, out), os.path.join(out, "tiles.json"))
    crop_info = jload(os.path.join(out, "crop.json"))
    T["rasterize_crop"] = round(time.time() - t0, 1)
    img = cv2.imread(crop, 0); H, W = img.shape

    t0 = time.time()
    vlm_dir = os.path.join(out, "vlm")
    if args.force or not os.path.exists(os.path.join(vlm_dir, "vlm.json")) or args.vlm.startswith("file:"):
        vlm = vlm_mod.run_vlm(os.path.join(out, "plan-crop-vlm.png"), os.path.join(out, "sheet-small.png"), vlm_dir, args.vlm, args.model, jload(os.path.join(out, "tiles.json")))
    else:
        vlm = jload(os.path.join(vlm_dir, "vlm.json"))
    T["vlm"] = round(time.time() - t0, 1)
    m = re.match(r"1:(\d+)", str((vlm.get("unit") or {}).get("scale") or ""))
    if m:
        args.scale = int(m.group(1))
    nominal = args.dpi / 2.54 / args.scale
    if not args.apartment_id:
        args.apartment_id = "apt" + str((vlm.get("unit") or {}).get("number") or "unit")

    t0 = time.time()
    trace_a = tracer_cv.trace(crop, nominal, os.path.join(out, "trace-a"))
    T["trace_a"] = round(time.time() - t0, 1)

    t0 = time.time()
    names = [r["name_en"] for r in vlm["rooms"]]
    if names and args.assign != "none":
        rz.downscale(os.path.join(out, "trace-a", "overlay.png"), os.path.join(out, "trace-a", "overlay-vlm.png"), 2000)
        assign = run_assign(os.path.join(out, "trace-a", "overlay-vlm.png"), os.path.join(out, "plan-crop-vlm.png"), names, os.path.join(out, "assign"), args.assign, args.model)
    else:
        assign = {"regions": {}, "unplaced": [], "label_positions": {}}
    T["assign"] = round(time.time() - t0, 1)
    labels, fit = build_labels(vlm, assign, trace_a, W, H, os.path.join(out, "trace-a"), nominal)
    jdump({"labels": labels, "position_fit": fit}, os.path.join(out, "labels.json"))

    t0 = time.time()
    trace = tracer_cv.trace(crop, nominal, os.path.join(out, "trace"), labels=[dict(L) for L in labels])
    T["trace_b"] = round(time.time() - t0, 1)

    cal = calibrate(trace, nominal)
    jdump(cal, os.path.join(out, "calibration.json"))
    plan = emit_plan(args, trace, vlm, cal, crop_info, sheet_info, out)
    rep = make_report(args, trace, vlm, cal, plan, out, T, crop_info)
    if args.publish:
        import shutil
        pub = os.path.join(out, args.publish)
        os.makedirs(pub, exist_ok=True)
        for fn in ("plan.json", "report.json", "report.md", "plan-crop.png"):
            shutil.copyfile(os.path.join(out, fn), os.path.join(pub, fn))
        print(f"published to {pub}")
    print(open(os.path.join(out, "report.md"), encoding="utf-8").read())
    return 0


if __name__ == "__main__":
    sys.exit(main())
