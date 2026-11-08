#!/usr/bin/env python
"""stack_units.py - interim "every apartment clickable" boxes (lane A, between A4 and C4).

Until every unit type has a traced plan, give every unit listed in the platform's units.json a 3D box in the
plan-world frame by STACKING the one real footprint (the hero unit's box from building.py) with the floor
pitch, and by offsetting the other units of a floor along the facade in bays of +-9 m (habait-89's
convention for the facade hotspots). Every stacked box is marked "stacked-approx" so C4 and the platform
can show it as a placeholder; the hero unit keeps its real box.

Plate clamp (2026-11-02, card 19 follow-up): a bay offset along a straight facade pushes boxes off a tower plate
(Rainbow: type M +9 m sat 26 % on the plate, PH -18 m 76 %). Every stacked type with a non-zero bay is therefore
moved to the nearest shift (along the facade, and inward only) whose box lies >= --min-plate on the floor-plate
polygon (units-geometry.json building.plate_en -> plan world, or --plate), without overlapping the types it shares a
floor with more than the nominal bay layout already does (--max-overlap, default = that nominal overlap). The hero's
type (bay 0) keeps the real footprint untouched. Coverage = share of a 12x12 grid of the box's plan rectangle inside
the plate (the same measure as flyover/hotspots/project_units.py), confirmed on a 40x40 grid.

Frame (platform contract units.schema.json, box_world): plan-world metres, X right, Y up the plan, Z up;
hero floor = z 0; z0 = (floor - hero_floor) * floor_to_floor; z1 = z0 + ceiling; ground = -(hero_floor * ftf).

Usage
  python stack_units.py --platform-units <platform units.json> --engine-units <engine units.json>
                        [--hero apt846] [--hero-platform-id 846] [--ftf 3.2] [--ceiling 2.9]
                        [--bay-m 9] [--facade-dir-deg <deg clockwise from plan-up>] [--out <units.json>]
                        [--validate-with <platform dir with flow.json/project.json>]
                        [--plate <json with polygon_world m | polygon_cm>] [--min-plate 0.90] [--max-overlap auto]
                        [--clamp-step 0.25] [--clamp-radius 30] [--no-clamp]
Exit 0 ok; 1 the output fails the platform schema or a clamped type stays under --min-plate; 2 missing input.
"""
from __future__ import annotations

import argparse
import copy
import json
import math
import os
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
PLATFORM = os.path.normpath(os.path.join(HERE, "..", "platform"))


def load(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)


# ------------------------------------------------------------------------------------------------ floor-plate clamp
def plate_from_geometry(g):
    """building.plate_en (site ENU m) -> plan-world m, inverting frame.plan_to_site:
    W = (x/100, -y/100) - origin_plan_m ; EN = rotate W counter-clockwise by north_deg"""
    fr, pe = g.get("frame") or {}, (g.get("building") or {}).get("plate_en")
    if not pe or fr.get("north_deg") is None or not fr.get("origin_plan_cm"):
        return None
    t = math.radians(fr["north_deg"])
    c, s = math.cos(t), math.sin(t)
    ox, oy = fr["origin_plan_cm"][0] / 100.0, -fr["origin_plan_cm"][1] / 100.0
    return [(c * e + s * n + ox, -s * e + c * n + oy) for e, n in pe]


def plate_from_file(path):
    d = load(path)
    for k in ("polygon_world", "plate_world"):
        if k in d:
            return [tuple(p) for p in d[k]]
    if "polygon_cm" in d:
        return [(x / 100.0, -y / 100.0) for x, y in d["polygon_cm"]]
    raise SystemExit(f"--plate {path}: no polygon_world / polygon_cm")


class Plate:
    def __init__(self, poly):
        import numpy as np
        self.np = np
        P = np.asarray(poly, float)
        if np.allclose(P[0], P[-1]):
            P = P[:-1]
        self.A, self.B = P, np.roll(P, -1, axis=0)

    def inside(self, xy):
        np = self.np
        x, y = xy[:, 0:1], xy[:, 1:2]
        ax, ay, bx, by = self.A[:, 0], self.A[:, 1], self.B[:, 0], self.B[:, 1]
        cond = (ay > y) != (by > y)
        with np.errstate(divide="ignore", invalid="ignore"):
            xint = ax + (y - ay) * (bx - ax) / (by - ay)
        return (np.sum(cond & (x < xint), axis=1) % 2) == 1

    def cover(self, box, shifts, n=12):
        """share of an n x n grid on the plan rectangle of box (shifted by each (dx, dy)) inside the plate"""
        np = self.np
        g = (np.arange(n) + 0.5) / n
        G = np.array([(box[0] + a * (box[3] - box[0]), box[1] + b * (box[4] - box[1])) for a in g for b in g])
        S = np.atleast_2d(np.asarray(shifts, float))
        pts = (S[:, None, :] + G[None, :, :]).reshape(-1, 2)
        return self.inside(pts).reshape(len(S), len(G)).mean(axis=1)


def overlap_frac(b1, b2):
    """plan-rectangle intersection / area of b1"""
    ix = max(0.0, min(b1[3], b2[3]) - max(b1[0], b2[0]))
    iy = max(0.0, min(b1[4], b2[4]) - max(b1[1], b2[1]))
    a = (b1[3] - b1[0]) * (b1[4] - b1[1])
    return ix * iy / a if a > 0 else 0.0


def shifted(box, dx, dy):
    return [box[0] + dx, box[1] + dy, box[2], box[3] + dx, box[4] + dy, box[5]]


def clamp_shift(plate, hbox, off, along, inward, placed, thr, max_ov, step, radius):
    """nearest (a, b) to (off, 0), b >= 0 (inward only), with cover12 and cover40 >= thr and overlap with every box in
    placed <= max_ov. Returns (a, b, cover12, reason)."""
    np = plate.np
    ux, uy = along
    vx, vy = inward
    a = np.arange(off - radius, off + radius + 1e-9, step)
    b = np.arange(0.0, radius + 1e-9, step)
    A, Bv = np.meshgrid(a, b, indexing="ij")
    A, Bv = A.ravel(), Bv.ravel()
    d = np.hypot(A - off, Bv)
    keep = d <= radius
    A, Bv, d = A[keep], Bv[keep], d[keep]
    order = np.lexsort((Bv, np.abs(A - off), d))       # nearest first; ties: less along-change, then less inward
    A, Bv = A[order], Bv[order]
    best = None
    for i0 in range(0, len(A), 4000):
        sa, sb = A[i0:i0 + 4000], Bv[i0:i0 + 4000]
        S = np.stack([ux * sa + vx * sb, uy * sa + vy * sb], 1)
        c12 = plate.cover(hbox, S, 12)
        for j in np.nonzero(c12 >= thr)[0]:
            dx, dy = S[j]
            bx = shifted(hbox, dx, dy)
            if any(overlap_frac(bx, o) > max_ov + 1e-9 for o in placed):
                continue
            if plate.cover(hbox, S[j:j + 1], 40)[0] < thr:
                continue
            return float(sa[j]), float(sb[j]), float(c12[j]), "clamped"
        k = int(np.argmax(c12))
        if best is None or c12[k] > best[2]:
            best = (float(sa[k]), float(sb[k]), float(c12[k]), "best-effort (no shift within the radius meets --min-plate)")
    return best


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--platform-units", default=os.path.join(PLATFORM, "fixtures", "rainbow", "units.json"))
    ap.add_argument("--engine-units", default=os.path.join(HERE, "_local", "rainbow", "units.json"))
    ap.add_argument("--out", default=None, help="default: overwrite --engine-units (the hero's real box is kept)")
    ap.add_argument("--hero", default="apt846", help="engine id of the unit with the real box")
    ap.add_argument("--hero-platform-id", default="846", help="the same unit's id in the platform file")
    ap.add_argument("--ftf", type=float, default=3.2)
    ap.add_argument("--ceiling", type=float, default=2.9)
    ap.add_argument("--bay-m", type=float, default=9.0)
    ap.add_argument("--facade-dir-deg", type=float, default=None,
                    help="direction ALONG the facade, degrees clockwise from plan-up; default from units-geometry.json "
                         "(facing bearing and north_deg) or plan-up when absent")
    ap.add_argument("--validate-with", default=os.path.join(PLATFORM, "fixtures", "rainbow"))
    ap.add_argument("--plate", default=None, help="floor-plate polygon json (polygon_world m or polygon_cm plan cm); "
                                                  "default: units-geometry.json building.plate_en beside --engine-units")
    ap.add_argument("--min-plate", type=float, default=0.90, help="minimum share of a stacked box on the plate")
    ap.add_argument("--max-overlap", default="auto", help="max plan overlap with another type on the same floor; "
                                                         "auto = the nominal bay layout's own neighbour overlap")
    ap.add_argument("--clamp-step", type=float, default=0.25, help="search step in metres")
    ap.add_argument("--clamp-radius", type=float, default=30.0, help="search radius around the nominal bay, metres")
    ap.add_argument("--no-clamp", action="store_true", help="the old behaviour: bays along the facade, no plate test")
    args = ap.parse_args(argv)
    for p in (args.platform_units, args.engine_units):
        if not os.path.exists(p):
            print(f"missing {p}", file=sys.stderr); return 2
    plat = load(args.platform_units)
    eng = load(args.engine_units)
    hero = next((u for u in eng["units"] if u["id"] == args.hero), None)
    if not hero or not hero.get("box_world"):
        print(f"hero {args.hero} with box_world not in {args.engine_units}", file=sys.stderr); return 2
    hx0, hy0, hz0, hx1, hy1, hz1 = hero["box_world"]
    hero_floor = hero["floor"]
    if abs(hz0) > 1e-6:
        print(f"warning: hero box z0 = {hz0}, expected 0 (hero floor = z 0)", file=sys.stderr)

    # direction along the facade in plan world
    geom_path = os.path.join(os.path.dirname(args.engine_units), "units-geometry.json")
    geom = load(geom_path) if os.path.exists(geom_path) else None
    facade_note = None
    if args.facade_dir_deg is None and os.path.exists(geom_path):
        g = load(geom_path)
        north = g.get("frame", {}).get("north_deg")
        facing = None
        for u in g.get("units", []):
            if u.get("id") == args.hero:
                facing = u.get("facing_deg") or (u.get("facade") or {}).get("bearing_deg")
        if facing is None:
            # the hero's note in units.json carries "facing <deg> deg"
            import re
            m = re.search(r"facing ([0-9.]+) deg", hero.get("note", ""))
            facing = float(m.group(1)) if m else None
        if north is not None and facing is not None:
            # true bearing b = drawing bearing d - north_deg  =>  d = b + north_deg ; along the facade = d - 90
            args.facade_dir_deg = (facing + north - 90.0) % 360.0
            facade_note = f"along the facade: true facing {facing} deg, north_deg {north} -> {args.facade_dir_deg:.1f} deg clockwise from plan-up"
    if args.facade_dir_deg is None:
        args.facade_dir_deg = 0.0
        facade_note = "along the facade unknown: bays offset along plan-up"
    t = math.radians(args.facade_dir_deg)
    ux, uy = math.sin(t), math.cos(t)          # plan-world (X right, Y up): bearing 0 = +Y, 90 = +X

    # bays: the hero's type sits at offset 0; the other types of a floor get -bay, +bay, -2bay, ... in a fixed order
    types_by_floor = {}
    for u in plat["units"]:
        types_by_floor.setdefault(u["floor"], set()).add(u["type"])
    other_types = sorted({tp for s in types_by_floor.values() for tp in s} - {hero["type"]})
    bay_of = {hero["type"]: 0.0}
    for i, tp in enumerate(other_types):
        k = i // 2 + 1
        bay_of[tp] = (-args.bay_m if i % 2 == 0 else args.bay_m) * k

    # floor-plate clamp: one shift per type (a type stacks at the same plan position on every floor)
    hbox = [hx0, hy0, hz0, hx1, hy1, hz1]
    inward = (-uy, ux)                                   # perpendicular to the facade, into the building
    floors_of = {}
    for u in plat["units"]:
        floors_of.setdefault(u["type"], set()).add(u["floor"])
    shift_of = {tp: (bay_of[tp], 0.0) for tp in bay_of}
    clamp = {"applied": False}
    plate = None
    if not args.no_clamp:
        poly = plate_from_file(args.plate) if args.plate else (plate_from_geometry(geom) if geom else None)
        if poly:
            plate = Plate(poly)
        else:
            print("warning: no floor plate (units-geometry.json building.plate_en or --plate): bays are not clamped", file=sys.stderr)
    rc_clamp = 0
    if plate is not None:
        def box_of(tp):
            a, b = shift_of[tp]
            return shifted(hbox, ux * a + inward[0] * b, uy * a + inward[1] * b)

        def same_floor(t1, t2):
            return bool(floors_of.get(t1, set()) & floors_of.get(t2, set())) or hero["type"] in (t1, t2)

        # the nominal layout's own overlap between neighbours sharing a floor = the most a clamp may add
        tps = list(bay_of)
        nominal = [overlap_frac(box_of(t1), box_of(t2)) for i, t1 in enumerate(tps) for t2 in tps[i + 1:] if same_floor(t1, t2)]
        max_ov = max(nominal or [0.0]) if args.max_overlap == "auto" else float(args.max_overlap)
        hero_cover = float(plate.cover(hbox, [(0.0, 0.0)])[0])
        clamp = {"applied": True,
                 "plate_source": os.path.abspath(args.plate) if args.plate else f"{geom_path} building.plate_en -> plan world",
                 "min_plate": args.min_plate, "max_overlap": round(max_ov, 3),
                 "max_overlap_rule": "auto: the nominal bay layout's neighbour overlap" if args.max_overlap == "auto" else "given",
                 "measure": "share of a 12x12 grid on the box's plan rectangle inside the plate (as flyover/hotspots/project_units.py); confirmed on 40x40",
                 "hero_plate_cover": round(hero_cover, 3),
                 "hero_note": "the hero type (bay 0) keeps the real footprint; its AABB covers less of the plate than its true outline",
                 "types": {}}
        placed = {hero["type"]: box_of(hero["type"])}
        for tp in other_types:
            off = bay_of[tp]
            nom_box = shifted(hbox, ux * off, uy * off)
            nom_cover = float(plate.cover(hbox, [(ux * off, uy * off)])[0])
            others = [placed[o] for o in placed if same_floor(tp, o)]
            if nom_cover >= args.min_plate and all(overlap_frac(nom_box, o) <= max_ov + 1e-9 for o in others):
                a, b, cov, why = off, 0.0, nom_cover, "nominal bay already on the plate"
            else:
                a, b, cov, why = clamp_shift(plate, hbox, off, (ux, uy), inward, others, args.min_plate, max_ov,
                                             args.clamp_step, args.clamp_radius)
            shift_of[tp] = (round(a, 3), round(b, 3))
            placed[tp] = box_of(tp)
            ov = max([overlap_frac(placed[tp], o) for o in others] or [0.0])
            clamp["types"][tp] = {"bay_m": off, "nominal_plate_cover": round(nom_cover, 3), "along_m": round(a, 3), "inward_m": round(b, 3),
                                  "plate_cover": round(cov, 3), "max_overlap_same_floor": round(ov, 3), "result": why}
            print(f"clamp {tp}: bay {off:+.1f} m covers {nom_cover:.3f} -> along {a:+.2f} m, inward {b:+.2f} m covers {cov:.3f}"
                  f" (overlap {ov:.3f} {"<=" if ov <= max_ov + 1e-9 else ">"} {max_ov:.3f}): {why}")
            if cov < args.min_plate:
                rc_clamp = 1
        print(f"clamp: hero type {hero['type']} keeps the real footprint (box covers {hero_cover:.3f}; not moved)")

    out = copy.deepcopy(eng)
    out["units"] = [u for u in eng["units"] if u["id"] == args.hero]
    out["price_note"] = (eng.get("price_note", "") + " | stack_units.py: every unit except the hero has a stacked-approx box "
                         f"(hero footprint, {args.ftf} m floor pitch, {args.ceiling} m ceiling, bays of +-{args.bay_m} m along the facade); "
                         "prices/status/areas copied from the platform fixture").strip(" |")
    stacked = []
    for u in plat["units"]:
        if u["id"] == args.hero_platform_id:
            # the hero: keep the engine's real box, refresh nothing else
            continue
        dz = (u["floor"] - hero_floor) * args.ftf
        off = bay_of.get(u["type"], 0.0)
        sa, sb = shift_of.get(u["type"], (off, 0.0))
        dx, dy = ux * sa + inward[0] * sb, uy * sa + inward[1] * sb
        moved = (sa, sb) != (off, 0.0)
        box = [round(hx0 + dx, 3), round(hy0 + dy, 3), round(dz, 3), round(hx1 + dx, 3), round(hy1 + dy, 3), round(dz + args.ceiling, 3)]
        row = {"id": u["id"], "floor": u["floor"], "box_world": box, "type": u["type"], "rooms": u["rooms"], "area_m2": u["area_m2"],
               "outdoor_m2": u["outdoor_m2"], "price": u["price"], "status": u["status"], "tour_url": u["tour_url"],
               "hotspots": u.get("hotspots", []),
               "note": f"box_source: stacked-approx (hero {args.hero} footprint stacked to floor {u['floor']}, bay {off:+.0f} m along the facade"
                       + (f", clamped onto the floor plate: along {sa:+.2f} m, inward {sb:+.2f} m" if moved else "") + "); "
                       + (u.get("note") or "")}
        if u.get("segments"):
            row["segments"] = u["segments"]
        out["units"].append(row)
        row_s = {"id": u["id"], "floor": u["floor"], "type": u["type"], "box_world": box, "box_source": "stacked-approx", "bay_m": off,
                 "along_m": sa, "inward_m": sb}
        if plate is not None:
            row_s["plate_cover"] = round(float(plate.cover(box, [(0.0, 0.0)])[0]), 3)
        stacked.append(row_s)
    out["units"].sort(key=lambda u: (u["floor"], u["id"]))
    out_path = args.out or args.engine_units
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    side = {"schema": "habait/engine/units-stacked.v0", "hero": args.hero, "hero_box_world": hero["box_world"], "hero_floor": hero_floor,
            "floor_to_floor_m": args.ftf, "ceiling_m": args.ceiling, "ground_z_m": -hero_floor * args.ftf, "bay_m": args.bay_m,
            "facade_dir_deg_from_plan_up": args.facade_dir_deg, "facade_note": facade_note, "bay_of_type": bay_of,
            "shift_of_type": {tp: {"along_m": a, "inward_m": b} for tp, (a, b) in shift_of.items()}, "plate_clamp": clamp,
            "units": stacked,
            "caveat": "every box except the hero's is the hero's footprint moved (and clamped onto the floor plate): the real K/M/PH footprints and positions are unknown until their plans are traced"}
    side_path = os.path.join(os.path.dirname(out_path), "units-stacked.json")
    with open(side_path, "w", encoding="utf-8") as f:
        json.dump(side, f, ensure_ascii=False, indent=1)
    print(f"wrote {out_path} ({len(out['units'])} units: 1 real + {len(stacked)} stacked-approx) and {side_path}")
    print(facade_note)

    # validate against the platform contract: the units.v0 SCHEMA only (validateSchema(unitsSchema) from validate.mjs).
    # The project-folder cross-check of validate.mjs is not run here: the engine file is keyed "rainbow-tlv"/"apt846"
    # while the platform fixture is "rainbow"/"846", and the fixture's media are not beside this file, so it always
    # failed (10 errors) before the 2026-11-02 clamp too. Pass --validate-with "" to skip.
    rc = 0
    if args.validate_with is not None and args.validate_with != "":
        node = shutil.which("node")
        url = "file:///" + os.path.join(PLATFORM, "contracts", "validate.mjs").replace(os.sep, "/").lstrip("/")
        js = ("const {validateSchema, unitsSchema} = await import(process.argv[1]);"
              "const fs = await import('node:fs');"
              "const e = validateSchema(unitsSchema, JSON.parse(fs.readFileSync(process.argv[2], 'utf8')));"
              "for (const x of e.slice(0, 20)) console.log('ERROR ' + x);"
              "console.log(e.length ? `schema: ${e.length} error(s)` : 'schema: OK (units.v0)'); process.exit(e.length ? 1 : 0);")
        r = subprocess.run([node, "--input-type=module", "-e", js, url, os.path.abspath(out_path)], capture_output=True, text=True, cwd=PLATFORM)
        print(r.stdout.strip()[-1500:])
        if r.stderr.strip():
            print(r.stderr.strip()[-800:], file=sys.stderr)
        rc = 1 if r.returncode else 0
    if rc_clamp:
        print(f"FAIL: a clamped type stays under --min-plate {args.min_plate}", file=sys.stderr)
    return rc or rc_clamp


if __name__ == "__main__":
    sys.exit(main())
