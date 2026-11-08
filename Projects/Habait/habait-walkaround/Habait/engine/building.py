#!/usr/bin/env python
"""building.py - lane A / A4 (board habait-workplan-2026-11-02, card 03).

project.json -> the building mass + a 3D box for every unit -> units.json v0 (platform contract) and
units-geometry.json (the 3D data the contract has no field for yet; see "proposed extension" below).

Generic: everything comes from project.json (site.north_deg, site.origin, building.*, units[].files.plan_json).
Nothing here names Rainbow or 846. The massing tool is pluggable:
  * --mass-tool <tower_mass.py>  wraps an external, read-only massing script (the Rainbow one lives in
    C:/RnD/Projects/Habait/tools/bench/site846/tower_mass.py, owned by habait-16; we import it, never edit it, and redirect
    its preview PNG away from its own folder);
  * --plain-mass                 a plain per-floor extrusion of the footprint (any project).

Frames
  plan cm     x right, y down (the unit plan / floor key; 360walkaround/pipeline/SCHEMA.md)
  plan world  X = x/100, Y = -y/100 (metres; render_shots.py / tower_mass.py)
  site-enu-m  +X east, +Y north, metres around site.origin (lat/lon); Z up, 0 = finished level of the ground
              floor (building.ground_floor_index). Plan world -> ENU = translate by -origin_plan, rotate
              counter-clockwise by site.north_deg (north_deg = bearing of true north clockwise from the top of the
              plan drawing, so a drawing bearing d becomes true bearing d - north_deg; the same transform as
              tools/bench/site846/fit_plot.py, without its 0.92 site-key scale: the unit plan is calibrated on
              printed dimensions, the scale belongs to the site key only).
  origin_plan: the plan point that IS site.origin. Read from site.origin_plan_cm when the project has it
              (proposed field), else from the studio's shots.json next to the footprint (unit_centre_m), which is
              where plot-fit.json took site.origin from.

Unit placement in the floor key (in order):
  1. units[].placement.key_polygon_cm / key_transform (proposed field; not in project.schema v0.1.0)
  2. identity: the unit's plan.json envelope (rooms + walls) matches footprint.fit.plan_envelope_cm within 2 %
     (the footprint was fitted onto that plan, so the plan frame IS the floor-key frame)
  3. stacking: the outline of an already placed unit of the same type and the same `mirrored`, when that unit
     is the only one of its (type, mirrored) on its floor (the card's "per type a polygon, per floor a Z shift")
  otherwise the unit is reported unplaced and the run exits 1.
Every placed unit must lie >= 95 % inside the floor plate (a moved or mis-framed unit fails here).

Usage
  python building.py --project <project.json> --out <dir> [--mass-tool <py> | --plain-mass]
                     [--expect <unit>:floor=<n>:facing=<16-wind>] [--tour-url-template <fmt>]
  python building.py --selftest      # the known-bad inputs must FAIL (north flipped, unit moved, unplaced)
Exit: 0 ok, 1 a unit unplaced / outside the plate / an --expect failed, 2 the project lacks an input.
"""
import argparse
import contextlib
import copy
import hashlib
import importlib.util
import io
import json
import math
import os
import sys

import numpy as np
from shapely import affinity
from shapely.geometry import LineString, MultiPolygon, Polygon
from shapely.geometry.polygon import orient
from shapely.ops import unary_union

R_EARTH = 6371000.0          # the radius fit_plot.py used for plot-fit.json
DEFAULT_MASS_TOOL = r"C:\RnD\Projects\Habait\tools\bench\site846\tower_mass.py"
WINDS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]
STATUS_MAP = {"available": "for-sale", "reserved": "reserved", "sold": "sold"}   # units.v0 has no unknown / not-for-sale
FACADE_TOL_M = 0.6           # a plate edge belongs to a unit when it runs within this of the unit outline
INSIDE_MIN = 0.95


class InputError(Exception):
    pass


def compass(b):
    return WINDS[int(round((b % 360) / 22.5)) % 16]


def bearing_of(e, n):
    return math.degrees(math.atan2(e, n)) % 360


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def biggest(g):
    if isinstance(g, MultiPolygon):
        return max(g.geoms, key=lambda p: p.area)
    return g


# ---------------------------------------------------------------- the site frame
class SiteFrame:
    def __init__(self, north_deg, origin_plan_m, origin_latlon):
        self.north = float(north_deg)
        self.ox, self.oy = origin_plan_m
        self.lat0, self.lon0 = origin_latlon
        t = math.radians(self.north)
        self.c, self.s = math.cos(t), math.sin(t)

    def plan_cm_to_enu(self, x, y):
        X, Y = x / 100.0 - self.ox, -y / 100.0 - self.oy
        return (X * self.c - Y * self.s, X * self.s + Y * self.c)

    def world_to_enu(self, X, Y):
        X, Y = X - self.ox, Y - self.oy
        return (X * self.c - Y * self.s, X * self.s + Y * self.c)

    def poly(self, ring_cm):
        return Polygon([self.plan_cm_to_enu(x, y) for x, y in ring_cm]).buffer(0)

    def geom(self, g_plan_cm):
        """a shapely geometry in plan cm -> ENU m"""
        g = affinity.scale(g_plan_cm, 0.01, -0.01, origin=(0, 0))
        g = affinity.translate(g, -self.ox, -self.oy)
        return affinity.rotate(g, self.north, origin=(0, 0))

    def latlon(self, e, n):
        kx = math.radians(1) * R_EARTH * math.cos(math.radians(self.lat0))
        ky = math.radians(1) * R_EARTH
        return (self.lat0 + n / ky, self.lon0 + e / kx)


def resolve(base, rel):
    if not rel:
        return None
    p = rel if os.path.isabs(rel) else os.path.join(base, rel)
    return os.path.normpath(p)


def load_json(p):
    with open(p, encoding="utf-8") as fh:
        return json.load(fh)


def plan_outline(plan):
    """the unit envelope in plan cm: rooms (indoor + outdoor) and wall footprints."""
    parts, outdoor = [], []
    for r in plan.get("rooms", []):
        if r.get("loop") and len(r["loop"]) >= 3:
            p = Polygon(r["loop"]).buffer(0)
            parts.append(p)
            if r.get("is_outdoor"):
                outdoor.append(p)
    for w in plan.get("walls", []):
        if w.get("polygon_cm") and len(w["polygon_cm"]) >= 3:
            parts.append(Polygon(w["polygon_cm"]).buffer(0))
    if not parts:
        return None, None
    # traced rooms and wall pieces leave hairline gaps (apt846: 43 pieces): close by 10 cm, drop the holes
    env = biggest(unary_union(parts).buffer(10.0, join_style=2).buffer(-10.0, join_style=2))
    env = Polygon(env.exterior)
    out = unary_union(outdoor) if outdoor else None
    return env, out


def facade_bearing(plate_enu, zone_enu):
    """length-weighted outward normal of the plate edges that run along `zone` -> (bearing, metres of facade)."""
    ring = orient(plate_enu, 1.0).exterior                     # ccw in the y-up ENU frame
    pts = list(ring.coords)
    acc = np.zeros(2)
    total = 0.0
    for p, q in zip(pts[:-1], pts[1:]):
        dx, dy = q[0] - p[0], q[1] - p[1]
        L = math.hypot(dx, dy)
        if L < 1e-6:
            continue
        w = LineString([p, q]).intersection(zone_enu).length
        if w <= 0:
            continue
        acc += w * np.array([dy / L, -dx / L])                  # outward for a ccw ring
        total += w
    if total <= 0:
        return None, 0.0
    return bearing_of(acc[0], acc[1]), total


# ---------------------------------------------------------------- the mass
def load_mass_tool(path):
    # no bytecode: the tool's folder belongs to another session (a first run left __pycache__ there, 2026-11-02)
    prev = sys.dont_write_bytecode
    sys.dont_write_bytecode = True
    try:
        spec = importlib.util.spec_from_file_location("habait_wrapped_mass_tool", path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
    finally:
        sys.dont_write_bytecode = prev
    return mod


def run_mass_tool(tool_path, studio_project_dir, raw_dir, hero_floor, ftf_m, top_floor, keep_preview=False):
    """call the external massing script's main() unchanged, with its floor constants set from project.json and every
    image it writes redirected into raw_dir (tower_mass.py writes its preview next to itself otherwise). Unless
    keep_preview, the tool's own preview is cut off at its first drawing call (tower_mass.py's preview block comes after
    its OBJ + JSON are written and costs ~4 minutes: a per-vertex min() over 214k vertices); building.py draws its own
    evidence (units-check.png)."""
    mod = load_mass_tool(tool_path)
    for name, val in (("UNIT_FLOOR", hero_floor), ("FTF", ftf_m), ("RES_FLOORS", top_floor)):
        if hasattr(mod, name):
            setattr(mod, name, val)
    import cv2
    orig_imwrite = cv2.imwrite
    redirected = []

    orig_poly = cv2.polylines

    class _StopPreview(Exception):
        pass

    def stop(*a, **k):
        raise _StopPreview()

    def guarded(path, img, *a, **k):
        tgt = os.path.join(raw_dir, os.path.basename(path))
        redirected.append((path, tgt if keep_preview else "(suppressed)"))
        return orig_imwrite(tgt, img, *a, **k) if keep_preview else True

    argv = sys.argv
    cv2.imwrite = guarded
    if not keep_preview:
        cv2.polylines = stop
    sys.argv = [tool_path, "--project", studio_project_dir, "--out-dir", raw_dir]
    buf = io.StringIO()
    try:
        with contextlib.redirect_stdout(buf):
            try:
                mod.main()
            except _StopPreview:
                redirected.append(("tower_mass preview", "(suppressed)"))
    finally:
        cv2.imwrite = orig_imwrite
        cv2.polylines = orig_poly
        sys.argv = argv
    return load_json(os.path.join(raw_dir, "tower-mass.json")), redirected


def read_obj(path):
    groups, cur, verts = {}, None, []
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            if line.startswith("o "):
                cur = line[2:].strip()
                groups[cur] = []
            elif line.startswith("v "):
                verts.append([float(t) for t in line.split()[1:4]])
            elif line.startswith("f "):
                groups.setdefault(cur, []).append([int(t.split("/")[0]) - 1 for t in line.split()[1:4]])
    return np.array(verts), groups


def write_obj(path, verts, groups, header):
    lines = list(header)
    used_total = 0
    for name, faces in groups.items():
        if not faces:
            continue
        f = np.array(faces)
        idx = np.unique(f)
        remap = {int(o): i for i, o in enumerate(idx)}
        lines.append(f"o {name}")
        lines += [f"v {x:.4f} {y:.4f} {z:.4f}" for x, y, z in verts[idx]]
        lines += [f"f {remap[a] + 1 + used_total} {remap[b] + 1 + used_total} {remap[c] + 1 + used_total}" for a, b, c in f]
        used_total += len(idx)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines) + "\n")


def plain_mass(plate_enu, g, top, ftf):
    import trimesh
    slabs, glass = [], []
    inner = plate_enu.buffer(-1.0, join_style=2)
    for f in range(g, top + 1):
        z = (f - g) * ftf
        s = trimesh.creation.extrude_polygon(plate_enu, 0.30)
        s.apply_translation([0, 0, z - 0.25])
        slabs.append(s)
        gl = trimesh.creation.extrude_polygon(inner, ftf - 0.30)
        gl.apply_translation([0, 0, z + 0.05])
        glass.append(gl)
    out = {}
    base = 0
    verts = []
    for name, ms in (("mass_slab_edges", slabs), ("mass_glass", glass)):
        m = trimesh.util.concatenate(ms)
        verts.append(m.vertices)
        out[name] = (m.faces + base).tolist()
        base += len(m.vertices)
    return np.vstack(verts), out


# ---------------------------------------------------------------- the run
def build(project_path, out_dir, mass_tool=None, plain=False, tour_tpl=None, expects=(), project_override=None,
          write=True, log=print, mass_preview=False):
    base = os.path.dirname(os.path.abspath(project_path))
    proj = project_override if project_override is not None else load_json(project_path)
    site, bld, units = proj.get("site", {}), proj.get("building", {}), proj.get("units", [])
    missing = []
    if "north_deg" not in site:
        missing.append("site.north_deg")
    if not (site.get("origin") or {}).get("lat"):
        missing.append("site.origin.lat/lon")
    fp_rel = (bld.get("footprint") or {}).get("file")
    fp_path = resolve(base, fp_rel)
    if not fp_path or not os.path.exists(fp_path):
        missing.append(f"building.footprint.file ({fp_rel or 'absent'}: a traced floor plate is required)")
    if (bld.get("footprint") or {}).get("frame", "unit-plan-cm") != "unit-plan-cm":
        missing.append("building.footprint.frame = unit-plan-cm (site-local-m is not supported yet)")
    if missing:
        raise InputError("project lacks: " + "; ".join(missing))

    fp = load_json(fp_path)
    north = float(site["north_deg"])
    g = int(bld.get("ground_floor_index", 0))
    ftf = float(bld["floor_to_floor_cm"]) / 100.0
    top = g + int(bld["floors_total"]) - 1                       # floors_total counts the levels from ground up
    ceil_m = float(bld.get("ceiling_height_cm", bld["floor_to_floor_cm"] - 30)) / 100.0

    # origin_plan: proposed site.origin_plan_cm, else the studio's shots.json beside the footprint
    origin_src = None
    if site.get("origin_plan_cm"):
        ox, oy = site["origin_plan_cm"][0] / 100.0, -site["origin_plan_cm"][1] / 100.0
        origin_src = "project.site.origin_plan_cm"
    else:
        shots_p = os.path.join(os.path.dirname(fp_path), "shots.json")
        if os.path.exists(shots_p) and load_json(shots_p).get("unit_centre_m"):
            ox, oy = load_json(shots_p)["unit_centre_m"][:2]
            origin_src = f"fallback: {os.path.relpath(shots_p, base)} unit_centre_m (site.origin_plan_cm absent)"
        else:
            raise InputError("project lacks site.origin_plan_cm (the plan point of site.origin) and no studio shots.json "
                             "with unit_centre_m sits beside the footprint")
    frame = SiteFrame(north, (ox, oy), (site["origin"]["lat"], site["origin"]["lon"]))

    plate_cm = Polygon(fp["polygon_cm"]).buffer(0)
    plate = frame.geom(plate_cm)
    core = frame.geom(Polygon(fp["core_cm"]).buffer(0)) if fp.get("core_cm") else None
    fit_env = (fp.get("fit") or {}).get("plan_envelope_cm")

    # ---- place every unit
    placed, unplaced, outlines = [], [], {}
    plan_cache = {}
    for u in units:
        uid = u["id"]
        env_cm = out_cm = None
        how = None
        pj = resolve(base, (u.get("files") or {}).get("plan_json"))
        if pj and os.path.exists(pj):
            if pj not in plan_cache:
                plan_cache[pj] = plan_outline(load_json(pj))
            env_cm, out_cm = plan_cache[pj]
        pl = u.get("placement") or {}
        if pl.get("key_polygon_cm"):
            env_cm = Polygon(pl["key_polygon_cm"]).buffer(0)
            out_cm = None
            how = "placement.key_polygon_cm"
        elif env_cm is not None and pl.get("key_transform"):
            t = pl["key_transform"]          # {rotate_deg, mirror_x, translate_cm}
            gg = env_cm
            if t.get("mirror_x"):
                gg = affinity.scale(gg, -1, 1, origin=(0, 0))
            gg = affinity.rotate(gg, t.get("rotate_deg", 0), origin=(0, 0))
            env_cm = affinity.translate(gg, *t.get("translate_cm", [0, 0]))
            out_cm = None
            how = "placement.key_transform"
        elif env_cm is not None and fit_env and not u.get("mirrored"):
            bx = env_cm.bounds
            span = max(fit_env[2] - fit_env[0], fit_env[3] - fit_env[1])
            err = max(abs(a - b) for a, b in zip(bx, fit_env)) / span
            if err <= 0.02:
                how = f"identity (plan.json envelope = footprint.fit.plan_envelope_cm within {err * 100:.2f} %)"
            else:
                env_cm = None
                how = None
        if how is None:
            same = [p for p in placed if p["type"] == u["type"] and bool(p["mirrored"]) == bool(u.get("mirrored"))]
            if same:
                src = same[0]
                peers = [x for x in units if x["floor"] == src["floor"] and x["type"] == src["type"]
                         and bool(x.get("mirrored")) == bool(src["mirrored"])]
                if len(peers) == 1:
                    env_cm, out_cm = outlines[src["id"]]
                    how = f"stacked on {src['id']} (same type {u['type']}, the only one on floor {src['floor']})"
        if how is None or env_cm is None:
            unplaced.append({"id": uid, "reason": "no placement in the floor key: no units[].placement, plan_json "
                             "envelope does not match the footprint fit, and no single same-type unit to stack on"})
            continue
        outlines[uid] = (env_cm, out_cm)
        placed.append({"id": uid, "type": u["type"], "floor": int(u["floor"]), "mirrored": bool(u.get("mirrored")),
                       "how": how, "unit": u})

    # ---- 3D boxes, facade bearings
    # plan world (the studio / world2equi.py frame): X = x/100, Y = -y/100, Z up with the hero unit's floor at 0 (the
    # unit the footprint was fitted to = the unit the scene is built from); floors step by floor_to_floor, the box
    # top is the clear ceiling (habait-ab 2026-11-02: box_world is what world2equi.py --units reads)
    hero = next((p for p in placed if p["how"].startswith("identity")), None)
    hero_floor = hero["floor"] if hero else g
    geo_units, errors = [], []
    for p in placed:
        u, uid, f = p["unit"], p["id"], p["floor"]
        if not (g - int(bld.get("floors_below_ground", 0)) <= f <= top):
            errors.append(f"{uid}: floor {f} outside the building ({g}..{top})")
            continue
        env_cm, out_cm = outlines[uid]
        env = frame.geom(env_cm)
        inside = env.intersection(plate).area / env.area
        if inside < INSIDE_MIN:
            errors.append(f"{uid}: only {inside * 100:.1f} % of the unit lies inside the floor plate (< {INSIDE_MIN * 100:.0f} %)")
        z0 = (f - g) * ftf
        z1 = z0 + ftf
        mrr = orient(env.minimum_rotated_rectangle, 1.0)
        rect = list(mrr.exterior.coords)[:4]
        corners = [[round(e, 3), round(n, 3), round(z, 3)] for z in (z0, z1) for e, n in rect]
        b = env.bounds
        fac_b, fac_len = facade_bearing(plate, env.buffer(FACADE_TOL_M))
        ter_b = ter_len = None
        if out_cm is not None and not out_cm.is_empty:
            ter_b, ter_len = facade_bearing(plate, frame.geom(out_cm).buffer(FACADE_TOL_M))
        cen = env.centroid
        pc = plate.centroid
        rad_b = bearing_of(cen.x - pc.x, cen.y - pc.y)
        lat, lon = frame.latlon(cen.x, cen.y)
        pb = env_cm.bounds
        zw0 = (f - hero_floor) * ftf
        box_world = [round(pb[0] / 100.0, 3), round(-pb[3] / 100.0, 3), round(zw0, 3),
                     round(pb[2] / 100.0, 3), round(-pb[1] / 100.0, 3), round(zw0 + ceil_m, 3)]
        geo_units.append({
            "id": uid, "floor": f, "type": u["type"], "placement": p["how"],
            "box_world": box_world,
            "bbox3d": {"frame": "site-enu-m", "min": [round(b[0], 3), round(b[1], 3), round(z0, 3)],
                       "max": [round(b[2], 3), round(b[3], 3), round(z1, 3)]},
            "obb_corners": corners,
            "prism": {"polygon_en": [[round(x, 3), round(y, 3)] for x, y in list(orient(env, 1.0).exterior.coords)[:-1]],
                      "z0": round(z0, 3), "z1": round(z1, 3), "z_ceiling": round(z0 + ceil_m, 3)},
            "centroid_en": [round(cen.x, 3), round(cen.y, 3)], "centroid_latlon": [round(lat, 7), round(lon, 7)],
            "inside_plate": round(inside, 3),
            "facade_bearing_deg": None if fac_b is None else round(fac_b, 1),
            "facade_compass": None if fac_b is None else compass(fac_b),
            "facade_length_m": round(fac_len, 2),
            "terrace_bearing_deg": None if ter_b is None else round(ter_b, 1),
            "terrace_compass": None if ter_b is None else compass(ter_b),
            "radial_bearing_deg": round(rad_b, 1), "radial_compass": compass(rad_b),
            "declared_facing": u.get("facing"),
            "tour_id": u.get("tour_id"),
        })

    for x in unplaced:
        errors.append(f"{x['id']}: unplaced ({x['reason']})")

    # ---- expectations
    for ex in expects:
        uid, *conds = ex.split(":")
        gu = next((x for x in geo_units if x["id"] == uid), None)
        if gu is None:
            errors.append(f"--expect {ex}: unit {uid} has no box")
            continue
        for c in conds:
            k, v = c.split("=", 1)
            if k == "floor" and gu["floor"] != int(v):
                errors.append(f"--expect {ex}: floor {gu['floor']} != {v}")
            if k == "facing":
                want = WINDS.index(v.upper()) * 22.5
                got = gu["terrace_bearing_deg"] if gu["terrace_bearing_deg"] is not None else gu["facade_bearing_deg"]
                d = abs((got - want + 180) % 360 - 180) if got is not None else 999
                if d > 22.5:
                    errors.append(f"--expect {ex}: facing {got} deg ({compass(got) if got is not None else '-'}) is {d:.1f} deg from {v}")

    result = {"hero_floor": hero_floor, "frame": frame, "plate": plate, "core": core, "geo_units": geo_units, "errors": errors,
              "origin_src": origin_src, "g": g, "top": top, "ftf": ftf, "proj": proj, "fp_path": fp_path, "base": base}
    if not write:
        return result

    # ---- write
    os.makedirs(out_dir, exist_ok=True)
    mass_info = write_mass(result, out_dir, mass_tool, plain, placed, log, mass_preview)
    units_json = units_v0(proj, geo_units, tour_tpl)
    with open(os.path.join(out_dir, "units.json"), "w", encoding="utf-8") as fh:
        json.dump(units_json, fh, ensure_ascii=False, indent=1)
    geo = {
        "schema": "habait/engine/units-geometry.v0",
        "project": proj["id"],
        "generated_by": "Habait/engine/building.py",
        "inputs": {"project": os.path.relpath(os.path.abspath(project_path), out_dir).replace("\\", "/"),
                   "footprint": fp_path.replace("\\", "/"), "footprint_sha256": sha256(fp_path)},
        "frame": {"name": "site-enu-m", "x": "east", "y": "north", "z": f"up; 0 = finished level of floor {g} (ground)",
                  "origin_latlon": [frame.lat0, frame.lon0], "north_deg": north,
                  "origin_plan_cm": [round(ox * 100, 2), round(-oy * 100, 2)], "origin_source": origin_src,
                  "plan_to_site": "W = (x/100, -y/100) - origin_plan_m; rotate W counter-clockwise by north_deg; no scale"},
        "plan_world": {"axes": "X = x_cm/100 (right), Y = -y_cm/100 (up the plan), Z up; metres",
                       "z0_floor": result["hero_floor"], "z_ground_m": round((g - result["hero_floor"]) * ftf, 3),
                       "box_world": "[x0,y0,z0,x1,y1,z1]: plan AABB of the unit envelope (rooms+walls+terraces); "
                                    "z0 = (floor - z0_floor) * floor_to_floor, z1 = z0 + ceiling",
                       "consumer": "Habait/studio/tools/world2equi.py --units"},
        "building": {"ground_floor_index": g, "top_floor": top, "floor_to_floor_m": ftf, "ceiling_m": ceil_m,
                     "plate_area_m2": round(plate.area, 1),
                     "plate_en": [[round(x, 3), round(y, 3)] for x, y in list(orient(plate, 1.0).exterior.coords)[:-1]]},
        "mass": mass_info,
        "units": geo_units,
        "unplaced": unplaced,
    }
    with open(os.path.join(out_dir, "units-geometry.json"), "w", encoding="utf-8") as fh:
        json.dump(geo, fh, ensure_ascii=False, indent=1)
    try:
        draw_png(result, os.path.join(out_dir, "tower-mass.obj"), os.path.join(out_dir, "units-check.png"))
    except Exception as e:  # the PNG is evidence, not a product
        log(f"warn  units-check.png not drawn: {e}")
    return result


def write_mass(res, out_dir, mass_tool, plain, placed, log, mass_preview=False):
    frame, g, top, ftf = res["frame"], res["g"], res["top"], res["ftf"]
    obj_out = os.path.join(out_dir, "tower-mass.obj")
    hdr = ["# tower-mass.obj - building mass in site-enu-m (X east, Y north, Z up, 0 = ground floor level), metres",
           "# written by Habait/engine/building.py"]
    if not plain and mass_tool and os.path.exists(mass_tool):
        hero = next((p for p in placed if p["how"].startswith("identity")), None)
        if hero is None:
            raise InputError("the mass tool needs the unit the footprint was fitted to (an identity-placed unit)")
        studio_dir = os.path.dirname(os.path.dirname(res["fp_path"]))      # <studio project>/derived/<footprint>
        raw = os.path.join(out_dir, "mass-plan-world")
        os.makedirs(raw, exist_ok=True)
        tool_sha_before = sha256(mass_tool)
        meta, redirected = run_mass_tool(mass_tool, studio_dir, raw, hero["floor"], ftf, top, keep_preview=mass_preview)
        if sha256(mass_tool) != tool_sha_before:
            raise RuntimeError("the mass tool changed during the run")
        fl = meta.get("floors", {})
        if fl.get("ground_index") != g or abs(fl.get("ftf_m", ftf) - ftf) > 1e-6:
            raise InputError(f"mass tool frame disagrees with project.json: tool ground {fl.get('ground_index')} "
                             f"ftf {fl.get('ftf_m')} vs project ground {g} ftf {ftf}")
        verts, groups = read_obj(os.path.join(raw, "tower-mass.obj"))
        dz = (hero["floor"] - g) * ftf                                      # tool frame: hero floor at Z 0
        e, n = frame.world_to_enu(verts[:, 0], verts[:, 1])
        v2 = np.stack([e, n, verts[:, 2] + dz], axis=1)
        write_obj(obj_out, v2, groups, hdr + [f"# wrapped read-only: {mass_tool} (sha256 {tool_sha_before[:16]})"])
        return {"obj": "tower-mass.obj", "tool": mass_tool.replace("\\", "/"), "tool_sha256": tool_sha_before,
                "tool_constants": {"UNIT_FLOOR": hero["floor"], "FTF": ftf, "RES_FLOORS": top},
                "raw_plan_world": "mass-plan-world/tower-mass.obj", "tool_meta": meta,
                "redirected_writes": [[a.replace("\\", "/"), b if b == "(suppressed)" else os.path.relpath(b, out_dir).replace("\\", "/")]
                                      for a, b in redirected]}
    verts, groups = plain_mass(res["plate"], g, top, ftf)
    write_obj(obj_out, verts, groups, hdr + ["# plain per-floor extrusion of the footprint"])
    return {"obj": "tower-mass.obj", "tool": "plain extrusion (building.py)"}


def units_v0(proj, geo_units, tour_tpl):
    """units.json v0: the platform contract's fields, plus box_world (asked for by habait-ab 2026-11-02 for
    world2equi.py; ab adds it to units.schema.json as optional, until then the strict validator flags it)."""
    by_id = {x["id"]: x for x in geo_units}
    out = []
    for u in proj["units"]:
        if u["id"] not in by_id:
            continue
        gu = by_id[u["id"]]
        st = STATUS_MAP.get(u.get("status"), "for-sale")
        tour = (tour_tpl.format(tour_id=u["tour_id"]) if u.get("tour_id")
                else (proj.get("project", {}).get("website") or proj.get("developer", {}).get("brand", {}).get("website") or "about:blank"))
        notes = []
        if u.get("status") not in STATUS_MAP:
            notes.append(f"status '{u.get('status')}' in project.json; for-sale is a v0 placeholder")
        if "price_ils" not in u:
            notes.append("price 0 = no price in project.json")
        fb = gu["terrace_bearing_deg"] if gu["terrace_bearing_deg"] is not None else gu["facade_bearing_deg"]
        notes.append(f"bbox3d in units-geometry.json (site-enu-m): z {gu['bbox3d']['min'][2]}-{gu['bbox3d']['max'][2]} m, "
                     f"facing {fb} deg {compass(fb) if fb is not None else '-'}")
        out.append({"id": u["id"], "floor": int(u["floor"]), "box_world": gu["box_world"], "type": u["type"],
                    "rooms": u.get("rooms_count") or 1, "area_m2": u.get("area_m2", 10),
                    "outdoor_m2": u.get("terrace_m2", 0), "price": u.get("price_ils", 0), "status": st,
                    "tour_url": tour, "hotspots": [], "note": "; ".join(notes)})
    return {"project": proj["id"], "currency": "ILS",
            "price_note": "written by Habait/engine/building.py from project.json; hotspots are filled by C4 (card 19)",
            "units": out}


# ---------------------------------------------------------------- evidence PNG (cv2; matplotlib is not in the venv)
def draw_png(res, obj_path, png_path):
    import cv2
    plate, core, gus = res["plate"], res["core"], res["geo_units"]
    W, H = 1800, 1000
    img = np.full((H, W, 3), 255, np.uint8)
    # left: top view, north up
    pad = 6.0
    bx = plate.buffer(pad).bounds
    sc = 860 / max(bx[2] - bx[0], bx[3] - bx[1])

    def tp(x, y):
        return (int(60 + (x - bx[0]) * sc), int(940 - (y - bx[1]) * sc))

    def poly_px(geom):
        return [np.array([tp(x, y) for x, y in gg.exterior.coords], np.int32) for gg in getattr(geom, "geoms", [geom])]

    cv2.fillPoly(img, poly_px(plate), (225, 225, 225))
    cv2.polylines(img, poly_px(plate), True, (60, 60, 60), 2)
    if core is not None:
        cv2.fillPoly(img, poly_px(core), (190, 190, 190))
    for gu in gus:
        pts = np.array([tp(x, y) for x, y in gu["prism"]["polygon_en"]], np.int32)
        ov = img.copy()
        cv2.fillPoly(ov, [pts], (60, 60, 230))
        img[:] = cv2.addWeighted(ov, 0.35, img, 0.65, 0)
        cv2.polylines(img, [pts], True, (0, 0, 200), 2)
        c = np.array(gu["obb_corners"][:4])[:, :2]
        cv2.polylines(img, [np.array([tp(x, y) for x, y in c], np.int32)], True, (0, 120, 0), 1)
        fb = gu["terrace_bearing_deg"] if gu["terrace_bearing_deg"] is not None else gu["facade_bearing_deg"]
        if fb is not None:
            cx, cy = gu["centroid_en"]
            ex, ey = cx + 14 * math.sin(math.radians(fb)), cy + 14 * math.cos(math.radians(fb))
            cv2.arrowedLine(img, tp(cx, cy), tp(ex, ey), (0, 0, 200), 3, tipLength=0.15)
            cv2.putText(img, f"{gu['id']} f{gu['floor']} {fb:.0f} deg {compass(fb)}", (tp(ex, ey)[0] - 40, tp(ex, ey)[1] + 30),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 200), 2)
    cv2.arrowedLine(img, (880, 140), (880, 60), (0, 0, 0), 3, tipLength=0.3)
    cv2.putText(img, "N", (870, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 0, 0), 2)
    x0 = 60
    cv2.line(img, (x0, 970), (x0 + int(10 * sc), 970), (0, 0, 0), 3)
    cv2.putText(img, "10 m", (x0 + int(10 * sc) + 8, 976), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 1)
    cv2.putText(img, "top view, true north up (site-enu-m): plate grey, core dark, unit red, OBB green",
                (20, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 1)
    # right: elevation looking at the first unit's facade from outside (screen right = facade tangent)
    if not gus or not os.path.exists(obj_path):
        cv2.imwrite(png_path, img)
        return
    gu = gus[0]
    fb = gu["terrace_bearing_deg"] if gu["terrace_bearing_deg"] is not None else gu["facade_bearing_deg"] or 0.0
    nrm = np.array([math.sin(math.radians(fb)), math.cos(math.radians(fb))])
    right = np.array([-nrm[1], nrm[0]])          # the viewer outside faces -nrm; their right hand, clockwise from above
    verts, groups = read_obj(obj_path)
    u_all = verts[:, :2] @ right
    zmin, zmax = verts[:, 2].min(), verts[:, 2].max()
    umin, umax = u_all.min(), u_all.max()
    zs = 880 / max(zmax - zmin, umax - umin)

    def ep(u, z):
        return (int(1000 + (u - umin) * zs), int(950 - (z - zmin) * zs))
    for name in ("mass_glass", "mass_slab_edges"):
        col = (205, 205, 205) if name == "mass_glass" else (150, 150, 150)
        for tri in groups.get(name, []):
            p = verts[tri]
            pts = np.array([ep(x, z) for x, z in zip(p[:, :2] @ right, p[:, 2])], np.int32)
            cv2.fillConvexPoly(img, pts, col)
    for f in range(res["g"], res["top"] + 2, 5):
        z = (f - res["g"]) * res["ftf"]
        cv2.putText(img, f"{f}", (960, ep(0, z)[1] + 5), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 0, 0), 1)
    for g2 in gus:
        c = np.array(g2["obb_corners"])
        uu = c[:, :2] @ right
        a, b2 = ep(uu.min(), g2["bbox3d"]["min"][2]), ep(uu.max(), g2["bbox3d"]["max"][2])
        cv2.rectangle(img, a, b2, (0, 0, 220), 3)
        cv2.putText(img, f"{g2['id']} floor {g2['floor']}", (b2[0] + 10, b2[1] + 15), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 220), 2)
    cv2.putText(img, f"elevation seen from {compass(fb)} ({fb:.0f} deg), floor numbers every 5", (1000, 28),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 1)
    cv2.imwrite(png_path, img)


# ---------------------------------------------------------------- self-test: known-bad inputs must fail
def selftest(project_path):
    base = load_json(project_path)
    ok = True

    def run(label, proj, expects, want_fail):
        nonlocal ok
        try:
            r = build(project_path, None, project_override=proj, expects=expects, write=False, log=lambda *_: None)
            failed = bool(r["errors"])
            msg = "; ".join(r["errors"]) if r["errors"] else "no errors"
        except InputError as e:
            failed, msg = True, f"InputError: {e}"
        if want_fail is None:                       # informative: reported, not asserted
            print(f"selftest INFO  {label}: {'failed' if failed else 'passed'} - {msg[:240]}")
            return r if not failed else None
        good = failed == want_fail
        ok &= good
        print(f"selftest {'PASS' if good else 'FAIL'}  {label}: {'failed' if failed else 'passed'} "
              f"(want {'fail' if want_fail else 'pass'}) - {msg[:240]}")
        return r if not failed else None

    hero = next(u for u in base["units"] if u.get("files", {}).get("plan_json"))
    exp = [f"{hero['id']}:floor={hero['floor']}:facing=SSE"]
    r = run("the fixture as is", copy.deepcopy(base), exp, False)
    p = copy.deepcopy(base)
    p["site"]["north_deg"] = (p["site"]["north_deg"] + 180) % 360
    run("north flipped 180 deg (known-bad)", p, exp, True)
    p = copy.deepcopy(base)
    p["site"]["north_deg"] = 291.6
    run("the sheet's arrow 291.6 (12.8 deg off; marginal at +-22.5, informative)", p, exp, None)
    p = copy.deepcopy(base)
    h = next(u for u in p["units"] if u["id"] == hero["id"])
    h["placement"] = {"key_transform": {"translate_cm": [2500, 0]}}
    run("unit moved 25 m in the key (known-bad)", p, [], True)
    p = copy.deepcopy(base)
    extra = copy.deepcopy(hero)
    extra.update(id=hero["id"] + "-up", floor=hero["floor"] + 1, files={"plan_pdf": "x.pdf"}, tour_id=None)
    p["units"].append(extra)
    r2 = run("same type one floor up (stacking)", p, [], False)
    if r2:
        a = next(x for x in r2["geo_units"] if x["id"] == hero["id"])
        b = next(x for x in r2["geo_units"] if x["id"] == extra["id"])
        dz = b["bbox3d"]["min"][2] - a["bbox3d"]["min"][2]
        same_xy = a["bbox3d"]["min"][:2] == b["bbox3d"]["min"][:2]
        good = abs(dz - r2["ftf"]) < 1e-6 and same_xy
        ok &= good
        print(f"selftest {'PASS' if good else 'FAIL'}  stacked box is the hero box + {dz:.2f} m in Z, same plan position: {same_xy}")
    p = copy.deepcopy(base)
    stray = copy.deepcopy(hero)
    stray.update(id="stray-1", type="ZZ", files={"plan_pdf": "x.pdf"})
    p["units"].append(stray)
    run("a unit of an unknown type without placement (known-bad)", p, [], True)
    p = copy.deepcopy(base)
    p["building"].pop("footprint", None)
    run("no building.footprint (known-bad input)", p, [], True)
    print("SELFTEST " + ("OK" if ok else "FAILED"))
    return 0 if ok else 1


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--project", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures", "rainbow-846.project.json"))
    ap.add_argument("--out")
    ap.add_argument("--mass-tool", default=os.environ.get("HABAIT_MASS_TOOL", DEFAULT_MASS_TOOL))
    ap.add_argument("--plain-mass", action="store_true")
    ap.add_argument("--mass-preview", action="store_true", help="keep the mass tool's own preview PNG (+3 min), redirected into <out>/mass-plan-world")
    ap.add_argument("--expect", action="append", default=[], help="<unit>:floor=<n>:facing=<16-wind>, repeatable")
    ap.add_argument("--tour-url-template", default="http://127.0.0.1:8848/?scope=apartment&tour={tour_id}")
    ap.add_argument("--selftest", action="store_true")
    a = ap.parse_args()
    if a.selftest:
        return selftest(a.project)
    if not a.out:
        ap.error("--out is required")
    try:
        r = build(a.project, a.out, mass_tool=a.mass_tool, plain=a.plain_mass, tour_tpl=a.tour_url_template, expects=a.expect,
                  mass_preview=a.mass_preview)
    except InputError as e:
        print(f"ERROR {e}")
        return 2
    print(f"frame   site-enu-m, north {r['frame'].north} deg, origin {r['frame'].lat0},{r['frame'].lon0}; origin_plan from {r['origin_src']}")
    print(f"tower   floors {r['g']}..{r['top']} x {r['ftf']} m, plate {r['plate'].area:.1f} m2")
    for gu in r["geo_units"]:
        fb = gu["terrace_bearing_deg"] if gu["terrace_bearing_deg"] is not None else gu["facade_bearing_deg"]
        print(f"unit    {gu['id']} floor {gu['floor']} type {gu['type']}: box_world {gu['box_world']} (plan world, floor {r['hero_floor']} at z 0)")
        print(f"        site-enu z {gu['bbox3d']['min'][2]}..{gu['bbox3d']['max'][2]} m, "
              f"bbox E {gu['bbox3d']['min'][0]}..{gu['bbox3d']['max'][0]} N {gu['bbox3d']['min'][1]}..{gu['bbox3d']['max'][1]}, "
              f"inside plate {gu['inside_plate']}")
        print(f"        azimuth: terrace {gu['terrace_bearing_deg']} deg {gu['terrace_compass']}, facade {gu['facade_bearing_deg']} deg "
              f"{gu['facade_compass']}, radial {gu['radial_bearing_deg']} deg {gu['radial_compass']}; declared facing {gu['declared_facing']}; "
              f"placement: {gu['placement']}")
    for e in r["errors"]:
        print(f"ERROR {e}")
    print(f"wrote   {os.path.join(a.out, 'units.json')}, units-geometry.json, tower-mass.obj, units-check.png")
    return 1 if r["errors"] else 0


if __name__ == "__main__":
    sys.exit(main())
