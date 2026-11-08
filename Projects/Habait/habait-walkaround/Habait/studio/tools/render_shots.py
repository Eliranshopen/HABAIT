"""render_shots.py — Habait Studio's clay renderer (runs INSIDE Blender, headless).

  blender -b --factory-startup -P tools/render_shots.py -- --blend scene.blend --shots shots.json
          [--site site.json] [--plan plan.json] --out renders/clay [--res 640x360] [--samples 16]
          [--engine CYCLES|EEVEE] [--shots-only ext-enter,room-living] [--max-frames N]

Opens the tour pipeline's scene.blend (the apartment: walls, openings, panes, furniture, HDRI, sun,
terrain), then ADDS what the flyover needs and the 360 tour never did:
  * the tower mass — the apartment's own footprint (convex hull + 1 m) extruded below and above the unit,
    with a thin plate per floor so it reads as a tower; or site.tower.footprint_m when a floor key was traced
  * the neighbours — OSM building footprints from site.json (local metres, +X east, +Y north) rotated into the
    plan frame by north_deg and placed around the unit, at ground level (plan_meta.ground_offset_cm)
  * the compound's other buildings from the sales plan's site key (--site-key, tools/site_key.py)
  * the sea west of the OSM coastline, and a 40 km ground plane at ground level
  * one perspective camera flown along each shot's keys (eased, piecewise-linear), rendered frame by frame
Writes <out>/<shot>/frame_%04d.png and <out>/<shot>/render.json. Pure clay: materials are flat greys.
"""
import argparse
import json
import math
import os
import struct
import sys
import time

import bpy
from mathutils import Vector


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser(prog="render_shots.py")
    p.add_argument("--blend", required=True)
    p.add_argument("--shots", required=True)
    p.add_argument("--site", default=None)
    p.add_argument("--plan", default=None)
    p.add_argument("--out", required=True)
    p.add_argument("--res", default="640x360")
    p.add_argument("--samples", type=int, default=16)
    p.add_argument("--engine", default="CYCLES", choices=["CYCLES", "EEVEE"])
    p.add_argument("--shots-only", default=None)
    p.add_argument("--max-frames", type=int, default=0, help="cap frames per shot (tests); 0 = all")
    p.add_argument("--design-massing", action="store_true",
                   help="replace the catalog furniture of the living/dining rooms with masses shaped like the design line "
                        "(rounded sofa and armchairs, round tables): the video model paints the shape it sees")
    p.add_argument("--frames", default=None, help="render only these 1-based frame numbers (tests), e.g. 150,300")
    p.add_argument("--hide", default=None, help="debug: hide objects whose name contains any of these comma-separated substrings")
    p.add_argument("--hide-from", type=int, default=0, help="apply --hide only from this 1-based frame on (e.g. the tower detail once the camera is inside: its shadow maps made interior frames 30x slower)")
    p.add_argument("--flat-floor", action="store_true",
                   help="every FLOOR_* object gets a flat untextured grey (no plank or tile lines for the video model "
                        "to follow: the keyframe alone decides the floor)")
    p.add_argument("--resume", action="store_true",
                   help="skip frames whose rgb/id/depth files are already complete in <out>/<shot> (a killed run continues)")
    p.add_argument("--no-site", action="store_true")
    p.add_argument("--orthophoto", default=None, help="tools/orthophoto.py mosaic (+ .json beside it): laid on the ground as a textured quad")
    p.add_argument("--tower-footprint", default=None,
                   help="json with polygon_cm (plan frame) from a traced floor key; overrides site.tower")
    p.add_argument("--tower-mass", default=None,
                   help="OBJ of the whole tower in the plan world (metres, Z up, the unit's floor at Z 0, the unit itself left open); "
                        "replaces the extruded footprint, its plates and the unit-floor fill")
    p.add_argument("--site-key", default=None,
                   help="json from tools/site_key.py: the compound's other buildings (polygon_cm, height_m), plan frame")
    return p.parse_args(argv)


def log(msg):
    print(f"[render_shots] {msg}", flush=True)


# ------------------------------------------------------------------------------------ geometry helpers
def convex_hull(points):
    pts = sorted(set((round(x, 4), round(y, 4)) for x, y in points))
    if len(pts) < 3:
        return pts
    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lower, upper = [], []
    for pt in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], pt) <= 0:
            lower.pop()
        lower.append(pt)
    for pt in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], pt) <= 0:
            upper.pop()
        upper.append(pt)
    return lower[:-1] + upper[:-1]


def offset_polygon(poly, d):
    """Grow a convex polygon by d metres (about its centroid; adequate for a massing block)."""
    cx = sum(p[0] for p in poly) / len(poly)
    cy = sum(p[1] for p in poly) / len(poly)
    out = []
    for x, y in poly:
        vx, vy = x - cx, y - cy
        r = math.hypot(vx, vy) or 1.0
        out.append((x + vx / r * d, y + vy / r * d))
    return out


def make_material(name, rgb, roughness=0.8):
    mat = bpy.data.materials.get(name)
    if mat:
        return mat
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
        bsdf.inputs["Roughness"].default_value = roughness
    return mat


def add_prism(name, footprint, z0, z1, mat, collection):
    """A vertical prism from a 2-D footprint (world metres) between z0 and z1."""
    n = len(footprint)
    if n < 3 or z1 <= z0:
        return None
    # counter-clockwise seen from above, so every face points outward (the exact boolean wants a clean manifold)
    if sum(footprint[i][0] * footprint[(i + 1) % n][1] - footprint[(i + 1) % n][0] * footprint[i][1] for i in range(n)) < 0:
        footprint = list(footprint)[::-1]
    verts = [(x, y, z0) for x, y in footprint] + [(x, y, z1) for x, y in footprint]
    faces = [list(range(n))[::-1], list(range(n, 2 * n))]
    for i in range(n):
        j = (i + 1) % n
        faces.append([i, j, n + j, n + i])
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    ob = bpy.data.objects.new(name, me)
    ob.data.materials.append(mat)
    collection.objects.link(ob)
    return ob


def wall_points_from_plan(plan):
    pts = []
    for w in plan.get("walls", []):
        if w.get("polygon_cm"):
            pts += [(x / 100.0, -y / 100.0) for x, y in w["polygon_cm"]]
        elif w.get("rect_cm"):
            x0, y0, x1, y1 = w["rect_cm"]
            pts += [(x0 / 100.0, -y0 / 100.0), (x1 / 100.0, -y1 / 100.0)]
    for r in plan.get("rooms", []):
        if r.get("loop"):
            pts += [(x / 100.0, -y / 100.0) for x, y in r["loop"]]
    return pts


def wall_points_from_scene():
    pts = []
    for ob in bpy.data.objects:
        if ob.type == "MESH" and ("WALL" in ob.name.upper() or "FACADE" in ob.name.upper() or "PANE" in ob.name.upper()):
            for v in ob.bound_box:
                w = ob.matrix_world @ Vector(v)
                pts.append((w.x, w.y))
    return pts


def site_to_world(site, shots):
    """local metres (+X east, +Y north) -> plan-world metres: rotate by north_deg, translate to the unit centre."""
    north = site.get("north_deg")
    north = float(north) if north is not None else 0.0
    ucx, ucy = shots.get("unit_centre_m", [0, 0, 0])[:2]

    def f(e, n):
        r = math.hypot(e, n)
        if r < 1e-9:
            return (ucx, ucy)
        b = math.degrees(math.atan2(e, n))          # bearing from true north, clockwise
        th = math.radians(b + north)                 # drawing bearing: 0 = up (+Y world), clockwise
        return (ucx + r * math.sin(th), ucy + r * math.cos(th))
    return f


def build_site(site, shots, plan, ground_m, ceiling_m):
    coll = bpy.data.collections.new("STUDIO_SITE")
    bpy.context.scene.collection.children.link(coll)
    mat_tower = make_material("STUDIO_clay_tower", (0.62, 0.62, 0.60))
    mat_plate = make_material("STUDIO_clay_plate", (0.45, 0.45, 0.44))
    mat_nb = make_material("STUDIO_clay_neighbour", (0.70, 0.69, 0.66))
    mat_ground = make_material("STUDIO_clay_ground", (0.36, 0.38, 0.33), 1.0)
    mat_sea = make_material("STUDIO_clay_sea", (0.10, 0.20, 0.27), 0.08)
    mat_podium = make_material("STUDIO_clay_podium", (0.80, 0.79, 0.76))
    count = {"neighbours": 0, "plates": 0, "podium": 0, "sea": 0}

    # ground: a 160 km plane at ground level, so an aerial horizon never shows its edge (the pipeline's 200 m
    # terrain stays where it is)
    # the tour's own 200 m terrain sits exactly at ground level, where the ground, the sea and every footing also
    # meet: at aerial range the depth buffer cannot tell them apart (EEVEE drew it all grey). It goes; the ground
    # sits 1.5 m down and the sea at ground level, and every prism starts 2 m below ground.
    for ob in bpy.data.objects:
        if "TERRAIN" in ob.name.upper():
            ob.hide_render = True
    slab_drop = 2.0 if site.get("_orthophoto") else 0.0  # under the orthophoto quad the slab is only the far horizon: 2 m lower, out of the depth buffer's reach
    add_prism("STUDIO_ground", [(-80000, -80000), (80000, -80000), (80000, 80000), (-80000, 80000)], ground_m - 2.5 - slab_drop, ground_m - 1.5 - slab_drop, mat_ground, coll)
    # the orthophoto (2026-11-02, tools/orthophoto.py: a north-up satellite mosaic with its extent in local metres): a textured
    # quad just above the grey ground and below the sea, so an aerial 360 node sees the real streets, roofs and beach
    ortho = site.get("_orthophoto")
    if ortho and os.path.exists(ortho) and os.path.exists(ortho + ".json"):
        with open(ortho + ".json", "r", encoding="utf-8") as f:
            om = json.load(f)
        ex = om["local_extent_m"]
        to_w0 = site_to_world(site, shots)
        corners = [to_w0(ex["west"], ex["north"]), to_w0(ex["east"], ex["north"]), to_w0(ex["east"], ex["south"]), to_w0(ex["west"], ex["south"])]
        uvs = [(0.0, 1.0), (1.0, 1.0), (1.0, 0.0), (0.0, 0.0)]
        mesh = bpy.data.meshes.new("STUDIO_ortho")
        z = ground_m - 1.2  # 30 cm above the grey ground slab: 5 cm z-fought with it at 500 m (EEVEE depth, 1-6000 m clip) and drew grey patches
        mesh.from_pydata([(x, y, z) for x, y in corners], [], [(0, 1, 2, 3)])
        uv = mesh.uv_layers.new(name="UVMap")
        for li, loop in enumerate(mesh.loops):
            uv.data[li].uv = uvs[loop.vertex_index]
        mat = bpy.data.materials.new("STUDIO_ortho")
        mat.use_nodes = True
        nt = mat.node_tree
        bsdf = nt.nodes.get("Principled BSDF")
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = bpy.data.images.load(ortho)
        nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
        bsdf.inputs["Roughness"].default_value = 1.0
        mesh.materials.append(mat)
        ob = bpy.data.objects.new("STUDIO_ortho", mesh)
        ob.pass_index = 5
        coll.objects.link(ob)
        log(f"orthophoto: {os.path.basename(ortho)} {om['size_px'][0]}x{om['size_px'][1]} px, {om['m_per_px']:.2f} m/px, laid at z {z:.1f}")

    # the sea: everything west of the OSM coastline, the ends of the line carried 80 km on along its own direction
    coast_ways = ((site or {}).get("context") or {}).get("coast") or []
    if coast_ways and site.get("north_deg") is not None:
        to_w = site_to_world(site, shots)
        line = max(coast_ways, key=len)
        # keep the way's own vertex order (sorting by latitude scrambles breakwaters and ports into a
        # self-intersecting polygon that floods the land); only make it run north to south
        line = list(line) if line[0][1] >= line[-1][1] else list(line)[::-1]
        if len(line) >= 2:
            def extend(a, b, d):
                vx, vy = a[0] - b[0], a[1] - b[1]
                L = math.hypot(vx, vy) or 1.0
                return (a[0] + vx / L * d, a[1] + vy / L * d)
            n_end = extend(line[0], line[min(5, len(line) - 1)], 80000)
            s_end = extend(line[-1], line[max(-6, -len(line))], 80000)
            west = min(q[0] for q in line) - 80000
            ring = [n_end] + [tuple(q) for q in line] + [s_end, (west, s_end[1] - 20000), (west, n_end[1] + 20000)]
            fp_sea = [to_w(e, n) for e, n in ring]
            if sum(fp_sea[i][0] * fp_sea[(i + 1) % len(fp_sea)][1] - fp_sea[(i + 1) % len(fp_sea)][0] * fp_sea[i][1] for i in range(len(fp_sea))) < 0:
                fp_sea = fp_sea[::-1]
            sea = add_prism("STUDIO_sea", fp_sea, ground_m - 1.0, ground_m, mat_sea, coll)
            if sea:
                count["sea"] = 1

    # the tower: footprint from the site (traced floor key) or the unit's hull
    tower = (site or {}).get("tower") or {}
    ftf = float((site or {}).get("floor_to_floor_cm") or 320) / 100.0
    floor_of_unit = (site or {}).get("floor_of_unit")
    floors_total = tower.get("floors_total") or (site or {}).get("floors_total")
    if tower.get("footprint_plan_cm"):
        # a traced floor key in the PLAN frame (cm, +y down) -> world directly
        fp = [(x / 100.0, -y / 100.0) for x, y in tower["footprint_plan_cm"]]
    elif tower.get("footprint_m"):
        to_w = site_to_world(site, shots)
        fp = [to_w(e, n) for e, n in tower["footprint_m"]]
    else:
        pts = wall_points_from_plan(plan) if plan else wall_points_from_scene()
        fp = offset_polygon(convex_hull(pts), 1.0) if len(pts) >= 3 else None
    mass = (site or {}).get("_tower_mass_obj")
    if mass and os.path.exists(mass):
        before = set(bpy.data.objects)
        bpy.ops.wm.obj_import(filepath=mass, forward_axis="Y", up_axis="Z")
        n_mass = 0
        mat_bush = make_material("STUDIO_clay_bush", (0.30, 0.40, 0.26), 0.9)
        mat_rail = make_material("STUDIO_clay_railglass", (0.80, 0.86, 0.90), 0.05)
        mat_glaz = make_material("STUDIO_clay_glazing", (0.74, 0.80, 0.86), 0.45)  # the facade glazing: light, barely reflective (a mirror shows the dark world)
        try:  # it sits 1.9 m under the slab above, in shadow: a little self-light keeps it reading as bright glazing, not a dark recess
            _b = mat_glaz.node_tree.nodes.get("Principled BSDF")
            _b.inputs["Emission Color"].default_value = (0.74, 0.80, 0.86, 1.0)
            _b.inputs["Emission Strength"].default_value = 0.55
        except Exception:
            pass
        mat_mull = make_material("STUDIO_clay_mullion", (0.22, 0.23, 0.24), 0.5)
        for ob in set(bpy.data.objects) - before:
            for c in list(ob.users_collection):
                c.objects.unlink(ob)
            coll.objects.link(ob)
            orig = ob.name.lower()
            # the part's name survives (…_GLASS makes EEVEE draw it as glass; the id pass reads STUDIO_MASS as site)
            ob.name = f"STUDIO_mass_{n_mass:03d}_{orig}"
            if ob.type == "MESH":
                ob.data.materials.clear()
                ob.data.materials.append(mat_bush if "bush" in orig else mat_rail if "railing" in orig else mat_glaz if orig.endswith("mass_glass") else mat_mull if "mullion" in orig else mat_tower)
                # the OBJ's extruded prisms carry inconsistent normals (the slab tops shaded as if lit from below: a dark,
                # noisy mass in EEVEE): make them point outward, and shade flat
                try:
                    bpy.ops.object.select_all(action="DESELECT")
                    ob.select_set(True)
                    bpy.context.view_layer.objects.active = ob
                    bpy.ops.object.mode_set(mode="EDIT")
                    bpy.ops.mesh.select_all(action="SELECT")
                    bpy.ops.mesh.normals_make_consistent(inside=False)
                    bpy.ops.object.mode_set(mode="OBJECT")
                    bpy.ops.object.shade_flat()
                except Exception as e:  # noqa: BLE001
                    log(f"  normals of {ob.name}: {e}")
            n_mass += 1
        log(f"tower mass from {os.path.basename(mass)}: {n_mass} objects (extruded footprint skipped): "
            + ", ".join(f"{ob.name}->{ob.data.materials[0].name if ob.type == 'MESH' and ob.data.materials else '-'}" for ob in bpy.data.objects if ob.name.startswith("STUDIO_mass_")))
        fp = None
    if fp:
        top = ground_m + (float(floors_total) if floors_total else (float(floor_of_unit or 16) + 8)) * ftf
        add_prism("STUDIO_tower_below", fp, ground_m - 2.0, -0.35, mat_tower, coll)
        if top > ceiling_m + 0.7:
            add_prism("STUDIO_tower_above", fp, ceiling_m + 0.35, top, mat_tower, coll)
        # the unit's own floor: the rest of the floor plate, minus the apartment and its terrace (the convex hull of
        # the plan's walls and rooms, 5 cm proud); without it a band of nothing crosses the tower at the unit
        hull_pts = wall_points_from_plan(plan) if plan else wall_points_from_scene()
        if tower.get("footprint_plan_cm") and len(hull_pts) >= 3:
            band = add_prism("STUDIO_tower_unitfloor", fp, -0.35, ceiling_m + 0.35, mat_tower, coll)
            cutter = add_prism("STUDIO_cut_unit", offset_polygon(convex_hull(hull_pts), 0.05), -1.0, ceiling_m + 1.0, mat_tower, coll)
            if band and cutter:
                mod = band.modifiers.new("cut_unit", "BOOLEAN")
                mod.operation = "DIFFERENCE"
                mod.solver = "EXACT"
                mod.object = cutter
                cutter.hide_render = True
                cutter.hide_viewport = True
                log("tower: unit floor filled around the apartment (boolean)")
        # a typical floor: the unit's terraces repeat on every floor, so they are cut out of the whole stack (the
        # floor plates stay and become the terraces' floors and ceilings)
        outdoor = [r.get("loop") for r in (plan or {}).get("rooms", []) if r.get("is_outdoor") and r.get("loop")]
        if tower.get("footprint_plan_cm") and outdoor:
            cut_coll = bpy.data.collections.new("STUDIO_cut_terraces")
            bpy.context.scene.collection.children.link(cut_coll)
            for i, loop in enumerate(outdoor):
                tp = [(x / 100.0, -y / 100.0) for x, y in loop]
                add_prism(f"STUDIO_cut_terrace_{i}", tp, ground_m - 1.0, top + 1.0, mat_tower, cut_coll)
            cut_coll.hide_render = True
            cut_coll.hide_viewport = True
            for name in ("STUDIO_tower_below", "STUDIO_tower_above"):
                ob = bpy.data.objects.get(name)
                if ob:
                    m = ob.modifiers.new("cut_terraces", "BOOLEAN")
                    m.operation = "DIFFERENCE"
                    m.solver = "EXACT"
                    m.operand_type = "COLLECTION"
                    m.collection = cut_coll
            log(f"tower: {len(outdoor)} terrace(s) stacked on every floor")
        plate_fp = offset_polygon(fp, 0.15)
        z = ground_m
        k = 0
        while z < top - 0.5 and k < 80:
            if not (-0.6 < z < 0.6):  # the unit's own floor slab is the scene's; the one above roofs its terrace
                add_prism(f"STUDIO_plate_{k:02d}", plate_fp, z - 0.12, z + 0.12, mat_plate, coll)
                count["plates"] += 1
            z += ftf
            k += 1
        log(f"tower mass: {len(fp)}-gon, ground {ground_m:.1f} m -> top {top:.1f} m, {count['plates']} plates, ftf {ftf:.2f}")
    elif not (mass and os.path.exists(mass)):
        log("tower mass: no footprint (no plan, no walls found)")

    # neighbours from OSM
    ctx_ = (site or {}).get("context") or {}
    if ctx_.get("buildings"):
        to_w = site_to_world(site, shots)
        for b in ctx_["buildings"]:
            fp_local = b.get("footprint_m") or []
            if len(fp_local) < 3:
                continue
            ce = sum(p[0] for p in fp_local) / len(fp_local)
            cn = sum(p[1] for p in fp_local) / len(fp_local)
            if math.hypot(ce, cn) < 12.0:
                continue  # that would be our own plot
            fp = [to_w(e, n) for e, n in fp_local[:-1] if True] if fp_local[0] == fp_local[-1] else [to_w(e, n) for e, n in fp_local]
            if len(fp) < 3:
                continue
            add_prism(f"STUDIO_nb_{count['neighbours']:04d}", fp, ground_m - 2.0, ground_m + float(b.get("height_m") or 9.0), mat_nb, coll)
            count["neighbours"] += 1
        log(f"neighbours placed: {count['neighbours']} (north_deg {site.get('north_deg')})")

    # the compound's own buildings from the sales plan's site key (plan frame, registered on the tower)
    for b in (site or {}).get("site_key_buildings") or []:
        poly = b.get("polygon_cm") or []
        if len(poly) < 3:
            continue
        fp_b = [(x / 100.0, -y / 100.0) for x, y in poly]
        if sum(fp_b[i][0] * fp_b[(i + 1) % len(fp_b)][1] - fp_b[(i + 1) % len(fp_b)][0] * fp_b[i][1] for i in range(len(fp_b))) < 0:
            fp_b = fp_b[::-1]
        add_prism(f"STUDIO_podium_{count['podium']:02d}", fp_b, ground_m - 2.0, ground_m + float(b.get("height_m") or 26.0), mat_podium, coll)
        count["podium"] += 1
    log(f"site: sea {count['sea']}, compound buildings {count['podium']}")
    return count


# ------------------------------------------------------------------------------------ camera
def smoothstep(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def sample_keys(keys, t_eased):
    keys = sorted(keys, key=lambda k: k["t"])
    T = keys[-1]["t"] or 1.0
    t = t_eased * T
    for a, b in zip(keys, keys[1:]):
        if a["t"] <= t <= b["t"]:
            f = 0.0 if b["t"] == a["t"] else (t - a["t"]) / (b["t"] - a["t"])
            pos = [a["pos"][i] + (b["pos"][i] - a["pos"][i]) * f for i in range(3)]
            look = [a["look"][i] + (b["look"][i] - a["look"][i]) * f for i in range(3)]
            return pos, look
    k = keys[-1]
    return list(k["pos"]), list(k["look"])


def aim(cam, pos, look):
    cam.location = Vector(pos)
    d = Vector(look) - Vector(pos)
    if d.length < 1e-6:
        d = Vector((0, 1, 0))
    cam.rotation_mode = "XYZ"
    cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()


ID_CLASSES = (("STUDIO_", 5), ("DOOR", 3), ("LEAF", 3), ("PANE", 2), ("GLASS", 2), ("FACADE", 2), ("RAIL", 2),
              ("WALL", 1), ("POST_", 1), ("FLOOR", 6), ("CEIL", 6), ("TERRAIN", 6))


def assign_ids():
    """pass_index per object class, for the ID pass the fidelity gate reads:
    1 walls · 2 glazing · 3 door leaves · 4 furniture / other · 5 site (tower, neighbours, ground) · 6 floors, ceilings, terrain"""
    counts = {}
    for ob in bpy.data.objects:
        if ob.type != "MESH":
            continue
        nm = ob.name.upper()
        idx = 4
        for needle, v in ID_CLASSES:
            if needle in nm:
                idx = v
                break
        ob.pass_index = idx
        counts[idx] = counts.get(idx, 0) + 1
    return counts


def setup_passes(scene, out_dir):
    """Compositor: RGB to the normal output; Depth (metres, 32-bit EXR) and IndexOB (16-bit PNG, value/65535)
    to <out_dir>/depth_####.exr and <out_dir>/id_####.png. Frame numbers follow scene.frame_current."""
    vl = bpy.context.view_layer
    vl.use_pass_z = True
    vl.use_pass_object_index = True
    # EEVEE has no IndexOB pass: every material writes its object's pass_index to a VALUE AOV instead
    aov_name = None
    if scene.render.engine != "CYCLES":
        aov_name = "objidx"
        if aov_name not in [x.name for x in vl.aovs]:
            aov = vl.aovs.add()
            aov.name = aov_name
            aov.type = "VALUE"
        n_mat = 0
        for mat in bpy.data.materials:
            if not mat.use_nodes:
                mat.use_nodes = True
            nt = mat.node_tree
            if any(n.bl_idname == "ShaderNodeOutputAOV" and n.aov_name == aov_name for n in nt.nodes):
                continue
            info = nt.nodes.new("ShaderNodeObjectInfo")
            out = nt.nodes.new("ShaderNodeOutputAOV")
            out.aov_name = aov_name
            nt.links.new(info.outputs["Object Index"], out.inputs["Value"])
            n_mat += 1
        log(f"id pass via AOV '{aov_name}' on {n_mat} materials (EEVEE)")
    scene.use_nodes = True
    tree = scene.node_tree
    for n in list(tree.nodes):
        tree.nodes.remove(n)
    rl = tree.nodes.new("CompositorNodeRLayers")
    comp = tree.nodes.new("CompositorNodeComposite")
    tree.links.new(rl.outputs["Image"], comp.inputs["Image"])
    fo_depth = tree.nodes.new("CompositorNodeOutputFile")
    fo_depth.name = "STUDIO_depth"
    fo_depth.base_path = out_dir
    fo_depth.format.file_format = "OPEN_EXR"
    fo_depth.format.color_depth = "32"
    fo_depth.format.color_mode = "RGB"
    fo_depth.file_slots[0].path = "depth_"
    tree.links.new(rl.outputs["Depth"], fo_depth.inputs[0])
    div = tree.nodes.new("CompositorNodeMath")
    div.operation = "DIVIDE"
    div.inputs[1].default_value = 65535.0
    tree.links.new(rl.outputs[aov_name] if aov_name else rl.outputs["IndexOB"], div.inputs[0])
    fo_id = tree.nodes.new("CompositorNodeOutputFile")
    fo_id.name = "STUDIO_id"
    fo_id.base_path = out_dir
    fo_id.format.file_format = "PNG"
    fo_id.format.color_depth = "16"
    fo_id.format.color_mode = "BW"
    fo_id.format.compression = 50
    fo_id.file_slots[0].path = "id_"
    tree.links.new(div.outputs[0], fo_id.inputs[0])
    # depth again as a 16-bit PNG in CENTIMETRES (value = cm, 0..655 m) for readers without OpenEXR
    cm = tree.nodes.new("CompositorNodeMath")
    cm.operation = "MULTIPLY"
    cm.inputs[1].default_value = 100.0 / 65535.0
    tree.links.new(rl.outputs["Depth"], cm.inputs[0])
    fo_cm = tree.nodes.new("CompositorNodeOutputFile")
    fo_cm.name = "STUDIO_depth_cm"
    fo_cm.base_path = out_dir
    fo_cm.format.file_format = "PNG"
    fo_cm.format.color_depth = "16"
    fo_cm.format.color_mode = "BW"
    fo_cm.file_slots[0].path = "depthcm_"
    tree.links.new(cm.outputs[0], fo_cm.inputs[0])
    return fo_depth, (fo_id, fo_cm)


def configure(scene, args, w, h):
    scene.render.resolution_x, scene.render.resolution_y = w, h
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.film_transparent = False
    if args.engine == "CYCLES":
        scene.render.engine = "CYCLES"
        scene.cycles.device = "CPU"
        scene.cycles.samples = args.samples
        scene.cycles.use_adaptive_sampling = True
        scene.cycles.adaptive_threshold = 0.05
        scene.cycles.use_denoising = True
        try:
            scene.cycles.denoiser = "OPENIMAGEDENOISE"
            scene.cycles.denoising_use_gpu = False
        except Exception:
            pass
        scene.cycles.max_bounces = 4
        scene.cycles.caustics_reflective = False
        scene.cycles.caustics_refractive = False
    else:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
        scene.eevee.taa_render_samples = max(4, args.samples)
        try:
            scene.eevee.shadow_pool_size = "1024"  # the detailed tower mass (railings, planters, mullions) overflows the 512 MB default
        except Exception:
            pass
        # EEVEE draws our glass as opaque grey (refraction through the world probe): ray tracing on, and every
        # glazing material made a thin, mostly transparent blended surface, so rooms see out and the facade sees in
        for attr, val in (("use_raytracing", True), ("use_shadows", True), ("use_fast_gi", True)):
            try:
                setattr(scene.eevee, attr, val)
            except Exception:
                pass
        n_glass = 0
        for ob in bpy.data.objects:
            if ob.type != "MESH" or not any(k in ob.name.upper() for k in ("GLASS", "PANE", "WINDOW")):
                continue
            if ob.name.lower().endswith("_mass_glass"):
                continue  # the tower's facade glazing stays an opaque light reflective surface: a see-through pane shows the hollow mass as dark/brown glass
            for slot in ob.material_slots:
                mat = slot.material
                if not mat or mat.get("_studio_glass"):
                    continue
                mat["_studio_glass"] = True
                mat.use_nodes = True
                try:
                    mat.surface_render_method = "BLENDED"
                except Exception:
                    mat.blend_method = "BLEND"
                bsdf = mat.node_tree.nodes.get("Principled BSDF")
                if bsdf:
                    bsdf.inputs["Alpha"].default_value = 0.12
                    for k in ("Transmission Weight", "Transmission"):
                        if k in bsdf.inputs:
                            bsdf.inputs[k].default_value = 0.0
                    bsdf.inputs["Roughness"].default_value = 0.05
                n_glass += 1
        log(f"EEVEE: ray tracing on, {n_glass} glazing materials made transparent")


def main():
    args = parse_args()
    # Blender resolves a relative render path against the .blend's folder, not the shell's cwd: make them absolute
    args.out = os.path.abspath(args.out)
    for k in ("shots", "site", "plan", "tower_footprint", "site_key", "tower_mass"):
        v = getattr(args, k)
        if v:
            setattr(args, k, os.path.abspath(v))
    w, h = [int(v) for v in args.res.lower().split("x")]
    bpy.ops.wm.open_mainfile(filepath=os.path.abspath(args.blend))
    scene = bpy.context.scene
    with open(args.shots, "r", encoding="utf-8") as f:
        shots = json.load(f)
    site = None
    if args.site and not args.no_site and os.path.exists(args.site):
        with open(args.site, "r", encoding="utf-8") as f:
            site = json.load(f)
    plan = None
    if args.plan and os.path.exists(args.plan):
        with open(args.plan, "r", encoding="utf-8") as f:
            plan = json.load(f)
    if args.tower_footprint and os.path.exists(args.tower_footprint):
        with open(args.tower_footprint, "r", encoding="utf-8") as f:
            tf = json.load(f)
        poly = tf.get("polygon_cm") or tf.get("tower_footprint_cm")
        if poly:
            site = site or {}
            site.setdefault("tower", {})["footprint_plan_cm"] = poly
            log(f"tower footprint from {os.path.basename(args.tower_footprint)}: {len(poly)} points (plan cm)")
    if args.tower_mass and os.path.exists(args.tower_mass):
        site = site or {}
        site["_tower_mass_obj"] = args.tower_mass
    if args.orthophoto and os.path.exists(args.orthophoto):
        site = site or {}
        site["_orthophoto"] = os.path.abspath(args.orthophoto)
    if args.site_key and os.path.exists(args.site_key):
        with open(args.site_key, "r", encoding="utf-8") as f:
            sk = json.load(f)
        site = site or {}
        site["site_key_buildings"] = sk.get("buildings") or []
        log(f"site key: {len(site['site_key_buildings'])} compound buildings")
    ground_m = float(shots.get("ground_offset_cm") or (site or {}).get("ground_offset_cm") or -300) / 100.0
    ceiling_m = float((plan or {}).get("plan_meta", {}).get("ceiling_height_cm", 290)) / 100.0 if plan else 2.9
    log(f"blend opened: {len(bpy.data.objects)} objects; ground {ground_m:.2f} m; engine {args.engine} {w}x{h} @ {args.samples}")
    if not args.no_site:
        build_site(site or {}, shots, plan, ground_m, ceiling_m)

    cam_data = bpy.data.cameras.new("CAM_shots")
    cam_data.clip_start = 0.05
    cam_data.clip_end = 6000.0
    cam_data.sensor_fit = "HORIZONTAL"
    cam_data.sensor_width = 36.0
    cam = bpy.data.objects.new("CAM_shots", cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    configure(scene, args, w, h)
    if args.flat_floor:
        flatten_floors()
    if args.design_massing:
        design_massing()
    def apply_hide():
        nh = 0
        for ob in bpy.data.objects:
            if any(k.lower() in ob.name.lower() for k in args.hide.split(",")):
                ob.hide_render = True
                nh += 1
        log(f"hide: {nh} objects ({args.hide})")
    if args.hide and not args.hide_from:
        apply_hide()
    id_counts = assign_ids()
    log(f"pass indices: {json.dumps({str(k): v for k, v in sorted(id_counts.items())})}")
    fo_depth, fo_id = setup_passes(scene, args.out)

    only = set(args.shots_only.split(",")) if args.shots_only else None
    only_frames = set(int(x) for x in args.frames.split(",")) if args.frames else None
    fps = int(shots.get("fps") or 24)
    total_t0 = time.time()
    for shot in shots["shots"]:
        if only and shot["id"] not in only:
            continue
        out_dir = os.path.join(args.out, shot["id"])
        os.makedirs(out_dir, exist_ok=True)
        if shot.get("kind") == "pano":
            # a 360 node (2026-11-02, Eliran: "הכל הדמיות של 360"): six 90-degree cube faces from one point, any engine; the
            # stitcher (tools/cube2equi.py) reads each face's camera matrix from faces.json, so the eulers below need no convention
            fo_depth.base_path = out_dir
            for fo in fo_id:
                fo.base_path = out_dir
            face_res = int(shot.get("face_res") or 1024)
            scene.render.resolution_x = scene.render.resolution_y = face_res
            cam_data.lens = 18.0  # 36 mm sensor, square: exactly 90 degrees
            cam_data.clip_start = 1.0 if shot.get("far", True) else float(shot.get("clip_start") or 0.3)  # a pano node hovers outside the railing, never within 30 cm; 5 cm z-fought the ground far away
            pos = shot["pos"]
            cam.location = Vector(pos)
            eulers = {"front": (90, 0, 0), "right": (90, 0, -90), "back": (90, 0, 180), "left": (90, 0, 90), "up": (180, 0, 0), "down": (0, 0, 0)}
            faces = []
            t0 = time.time()
            for k, (name, e) in enumerate(eulers.items()):
                cam.rotation_euler = [math.radians(v) for v in e]
                bpy.context.view_layer.update()
                scene.frame_set(k + 1)
                scene.render.filepath = os.path.join(out_dir, f"face_{name}.png")
                if args.resume and os.path.exists(scene.render.filepath) and os.path.getsize(scene.render.filepath) > 1000:
                    pass
                else:
                    bpy.ops.render.render(write_still=True)
                faces.append({"name": name, "frame": k + 1, "rgb": f"face_{name}.png", "id": f"id_{k + 1:04d}.png",
                              "matrix_world": [list(r) for r in cam.matrix_world]})
                log(f"  {shot['id']} face {name} {(time.time() - t0):.0f}s")
            with open(os.path.join(out_dir, "faces.json"), "w", encoding="utf-8") as f:
                json.dump({"shot": shot["id"], "pos": pos, "centre_look": shot.get("look"), "face_res": face_res, "lens_mm": 18.0, "sensor_mm": 36.0,
                           "frame_world": "X = x_cm/100, Y = -y_cm/100, Z up, unit floor at 0", "faces": faces}, f, indent=1)
            scene.render.resolution_x, scene.render.resolution_y = w, h
            log(f"shot {shot['id']} (pano node) done in {time.time() - t0:.0f}s")
            continue
        n = max(2, int(round(float(shot["duration_s"]) * fps)))
        n_render = min(n, args.max_frames) if args.max_frames else n
        cam_data.lens = float(shot.get("fov_mm") or 35)
        # a far aerial never comes near geometry: a 1 m near clip buys the depth precision the ground/sea need
        uc = shots.get("unit_centre_m") or [0, 0, 0]
        far = min(math.dist(k["pos"][:2], uc[:2]) for k in shot["keys"]) > 20.0 if shot.get("kind") == "exterior" else False
        cam_data.clip_start = 1.0 if far else 0.05
        hidden = []
        for needle in shot.get("hide") or []:
            for ob in bpy.data.objects:
                nm = ob.name.lower()
                if needle.lower() in nm and ("door" in nm or "leaf" in nm) and not ob.hide_render:
                    ob.hide_render = True
                    hidden.append(ob)
        # an open slider: hide the glazing whose footprint covers the entry point (plan "opening" kinds are not
        # cut out of the panes by build_scene)
        og = shot.get("open_glass_at_m")
        if og:
            px, py = float(og[0]), float(og[1])
            for ob in bpy.data.objects:
                if ob.type != "MESH" or ob.hide_render:
                    continue
                nm = ob.name.upper()
                if not ("GLASS" in nm or "PANE" in nm) or nm.startswith("STUDIO_MASS"):
                    continue  # the tower mass's glazing and railings span the whole plate: never "the slider"
                bb = [ob.matrix_world @ Vector(v) for v in ob.bound_box]
                xs = [b.x for b in bb]
                ys = [b.y for b in bb]
                if min(xs) - 0.3 <= px <= max(xs) + 0.3 and min(ys) - 0.3 <= py <= max(ys) + 0.3:
                    ob.hide_render = True
                    hidden.append(ob)
                    log(f"  open slider: hiding {ob.name} for this shot")
        log(f"shot {shot['id']}: {n_render}/{n} frames, lens {cam_data.lens:.0f} mm, hidden {len(hidden)}")
        fo_depth.base_path = out_dir
        for fo in fo_id:
            fo.base_path = out_dir
        cam_log = []
        t0 = time.time()
        skipped = 0
        for i in range(n_render):
            frac = i / (n_render - 1) if n_render > 1 else 0.0
            # a shot with its own timing (keys per frame, e.g. the continuous flight) is not eased again
            pos, look = sample_keys(shot["keys"], frac if shot.get("easing") == "linear" else smoothstep(frac))
            aim(cam, pos, look)
            scene.frame_set(i + 1)
            scene.render.filepath = os.path.join(out_dir, f"frame_{i + 1:04d}.png")
            if only_frames and (i + 1) not in only_frames:
                continue
            if args.hide and args.hide_from and (i + 1) == args.hide_from:
                apply_hide()
            if args.resume and frame_complete(out_dir, i + 1, (w, h), os.path.getmtime(args.blend)):
                skipped += 1
            else:
                bpy.ops.render.render(write_still=True)
            cam_log.append({"frame": i + 1, "t_s": round(frac * float(shot["duration_s"]), 3), "pos": [round(v, 4) for v in pos],
                            "look": [round(v, 4) for v in look], "lens_mm": cam_data.lens, "sensor_mm": 36.0, "res": [w, h]})
            if i == 0 or (i + 1) % 12 == 0:
                log(f"  {shot['id']} frame {i + 1}/{n_render}  {(time.time() - t0):.0f}s")
        for ob in hidden:
            ob.hide_render = False
        with open(os.path.join(out_dir, "camera.json"), "w", encoding="utf-8") as f:
            json.dump({"shot": shot["id"], "frame_world": "X = x_cm/100, Y = -y_cm/100, Z up, unit floor at 0", "id_classes":
                       {"1": "walls", "2": "glazing", "3": "door leaves", "4": "furniture/other", "5": "site: tower, neighbours, ground", "6": "floors, ceilings, terrain"},
                       "files": {"rgb": "frame_####.png", "depth_m": "depth_####.exr (32-bit float)", "depth_cm": "depthcm_####.png (16-bit, value = centimetres, sky = 65535)",
                                 "id": "id_####.png (16-bit, value = pass_index)"}, "frames": cam_log}, f, indent=1)
        with open(os.path.join(out_dir, "render.json"), "w", encoding="utf-8") as f:
            json.dump({"shot": shot["id"], "frames": n_render, "frames_planned": n, "fps": fps, "res": [w, h], "samples": args.samples,
                       "engine": args.engine, "seconds": round(time.time() - t0, 1), "lens_mm": cam_data.lens}, f, indent=2)
        log(f"shot {shot['id']} done in {time.time() - t0:.0f}s" + (f" ({skipped} frames kept from the earlier run)" if skipped else ""))
    log(f"all done in {time.time() - total_t0:.0f}s")


def flatten_floors():
    """--flat-floor: the FLOOR_* objects' materials lose their texture (planks, tiles, grout) and become one flat
    grey, so the video model has no floor pattern to follow; the keyframe alone paints the floor."""
    done = set()
    n = 0
    for ob in bpy.data.objects:
        if ob.type != "MESH" or not ob.name.upper().startswith("FLOOR"):
            continue
        for slot in ob.material_slots:
            mat = slot.material
            if not mat or mat.name in done:
                continue
            done.add(mat.name)
            mat.use_nodes = True
            bsdf = mat.node_tree.nodes.get("Principled BSDF")
            if not bsdf:
                continue
            for key in ("Base Color", "Roughness", "Normal", "Specular IOR Level"):
                inp = bsdf.inputs.get(key)
                if inp is None:
                    continue
                for link in list(inp.links):
                    mat.node_tree.links.remove(link)
            bsdf.inputs["Base Color"].default_value = (0.74, 0.72, 0.68, 1.0)
            bsdf.inputs["Roughness"].default_value = 0.55
            n += 1
    log(f"flat floor: {n} floor material(s) flattened to one grey")


def design_massing():
    """--design-massing (2026-11-01, Eliran: the furniture must follow the design line and never change shape between
    frames): the catalog pieces of the living and dining rooms are hidden and replaced by masses with the design's
    silhouettes — a rounded boucle sofa and armchairs, a round travertine coffee table, a round dining table with tub chairs —
    sized from each piece's own bounding box, so the plan's layout holds and the video model paints the shape it sees."""
    import mathutils
    mat = make_material("STUDIO_design_mass", (0.78, 0.76, 0.72), 0.7)
    mat_dark = make_material("STUDIO_design_mass_dark", (0.42, 0.40, 0.38), 0.6)
    n = 0
    for emp in list(bpy.data.objects):
        if not emp.name.startswith("FURN_"):
            continue
        tag = emp.name.split("_")[-1].lower()
        kids = [c for c in emp.children_recursive if c.type == "MESH"]
        pts = [c.matrix_world @ mathutils.Vector(v) for c in kids for v in c.bound_box]
        if not pts:
            continue
        xs, ys, zs = [p.x for p in pts], [p.y for p in pts], [p.z for p in pts]
        cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
        w, d, h, z0 = max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs), min(zs)
        shape = None
        if "sofa" in tag:
            shape = ("rounded", w, d, min(h, 0.72), 0.16, mat)
        elif "armchair" in tag:
            shape = ("rounded", min(w, 1.0), min(d, 1.0), 0.74, 0.18, mat)
        elif "coffee" in tag:
            shape = ("cylinder", min(w, d) / 2, 0.36, mat)
        elif tag == "d-table":
            shape = ("cylinder", min(w, d) / 2 * 0.92, 0.75, mat_dark)
        elif "chair" in tag:
            shape = ("rounded", 0.5, 0.5, 0.82, 0.14, mat)
        elif tag.endswith("-bed") or tag == "bed":
            shape = ("rounded", w, d, max(h, 0.5), 0.12, mat)
        if not shape:
            continue
        for c in kids:
            c.hide_render = True
        if shape[0] == "rounded":
            _, sw, sd, sh, bev, m = shape
            bpy.ops.mesh.primitive_cube_add(size=1.0, location=(cx, cy, z0 + sh / 2))
            ob = bpy.context.active_object
            ob.scale = (sw, sd, sh)
            bpy.ops.object.transform_apply(scale=True)
            mod = ob.modifiers.new("bevel", "BEVEL")
            mod.width = min(bev, sw / 2.2, sd / 2.2, sh / 2.2)
            mod.segments = 6
        else:
            _, r, sh, m = shape
            bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=sh, vertices=48, location=(cx, cy, z0 + sh / 2))
            ob = bpy.context.active_object
        ob.name = f"DESIGN_{emp.name[5:]}"
        ob.data.materials.append(m)
        bpy.ops.object.shade_smooth()
        n += 1
    # the doors: zero-line leaves in CREAM (Eliran 2026-11-01 20:40), never wood — the model paints the colour it sees
    mat_door = make_material("STUDIO_design_door", (0.86, 0.83, 0.76), 0.6)
    nd = 0
    for ob in bpy.data.objects:
        if ob.type != "MESH":
            continue
        nm = ob.name.upper()
        if ("DOOR" in nm or "LEAF" in nm) and "DOORFRAME" not in nm and "GLASS" not in nm and "FRIDGE" not in nm and "FREEZER" not in nm:
            ob.data.materials.clear()
            ob.data.materials.append(mat_door)
            nd += 1
    # the kitchen: handleless sand-grey lacquer fronts (the catalog's tan/blue cabinets would be painted as such)
    mat_kitchen = make_material("STUDIO_design_kitchen", (0.72, 0.70, 0.66), 0.5)
    nk = 0
    for ob in bpy.data.objects:
        if ob.type != "MESH":
            continue
        nm = ob.name.lower()
        if nm.startswith(("kitchen", "cabinet", "doorfridge", "doorfreezer", "drawer")) and ob.data.materials:
            for i in range(len(ob.data.materials)):
                ob.data.materials[i] = mat_kitchen
            nk += 1
    log(f"design massing: {n} pieces replaced by design-line masses, {nd} door objects in cream, {nk} kitchen/cabinet objects in sand-grey")


def frame_complete(out_dir, n, size, newer_than=0.0):
    """--resume: the frame's rgb, id and depth files exist, are NEWER than the .blend (a frame of an older scene build is
    re-rendered), the PNGs are at the run's resolution (a stale test render at another size is re-rendered) and carry
    their IEND trailer (a killed Blender leaves the file it was writing truncated)."""
    def png_ok(path):
        try:
            if os.path.getsize(path) < 1000 or os.path.getmtime(path) < newer_than:
                return False
            with open(path, "rb") as f:
                head = f.read(24)
                if head[1:4] != b"PNG" or struct.unpack(">II", head[16:24]) != tuple(size):
                    return False
                f.seek(-8, os.SEEK_END)
                return b"IEND" in f.read()
        except OSError:
            return False
    rgb = os.path.join(out_dir, f"frame_{n:04d}.png")
    idp = os.path.join(out_dir, f"id_{n:04d}.png")
    cmp = os.path.join(out_dir, f"depthcm_{n:04d}.png")
    exr = os.path.join(out_dir, f"depth_{n:04d}.exr")
    return (png_ok(rgb) and png_ok(idp) and png_ok(cmp) and os.path.exists(exr) and os.path.getsize(exr) > 1000
            and os.path.getmtime(exr) >= newer_than)


if __name__ == "__main__":
    main()
