"""project_units_perspective.py - every unit's 3D box -> a pixel polygon on every frame of a PERSPECTIVE camera path
-> turntable.json (card 21, C6a: the residence-style availability spinner).

The perspective sibling of Habait/flyover/hotspots/project_units.py (card 19, equirect). That module is IMPORTED read-only
(convex_hull, clip_x, poly_area, load_units, load_occluder, Prism, visible_fraction); nothing in it is edited or copied.

  python -I project_units_perspective.py [--camera _local/camera.json] [--units units.json]
         [--occluder tower-footprint.json --occluder-z tower-mass.json] [--out _local/turntable.json]
         [--debug 0,18,36,54 [--debug-src <dir with NNN.png | NNN.webp>]] [--min-visible 0.25]
  python -I project_units_perspective.py --validate _local/turntable.json   # turntable.schema.json + bounds + >= 4 points
  python -I project_units_perspective.py --selftest [--camera _local/camera.json]   # maths (+ Blender probes if present)

Conventions (= card 19 / world2equi.py): world = plan-world metres (X right, Y up the plan sheet, Z up, floor 16 at z 0,
3.2 m per floor); box_world = [x0, y0, z0, x1, y1, z1]; camera.json = the Studio form {"frames": [{matrix_world (camera to
world; the camera looks along local -Z, +Y up, +X right), intrinsics {fx, fy, cx, cy, width, height}, ...}]}.
Pixel: x = cx + fx * right / fwd, y = cy - fy * up / fwd (origin top-left, y down) = Blender's world_to_camera_view with
sensor_fit HORIZONTAL, no lens shift, square pixels.

Polygon per unit per frame = the camera-facing VERTICAL faces of the unit's prism (plan outline x [z0, z1]): the facing
edges of the convex outline form one chain; polygon = chain at z1 + chain reversed at z0, clipped to the frame. Not the
convex hull of the 8 box corners: seen from above, the hull adds the box's roof, which lies over the unit one floor up, so
stacked units would overlap. Outline = unit.outline_world if present, else the box rectangle; units whose box xy equals the
hero unit's box xy (the 846 stack) use the hero outline from tower-footprint.json unit_cm. Every outline is then clipped to the plate's convex hull (a box corner
off the plate would stick out of the tower silhouette).
Hidden: visible_fraction (card 19's plate-prism ray test) < --min-visible (0.25), or no facing face inside the frame.
Floors: the same strip on the convex hull of the floor plate, one per residential floor (tower-mass.json floors).
Debug PNGs: drawn over the rendered frame when one exists, else over a blank soft canvas with the tower prism outline.
"""
import argparse
import hashlib
import json
import math
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))          # Habait/flyover/turntable -> repo root
sys.path.insert(0, os.path.join(REPO, "Habait", "flyover", "hotspots"))
sys.dont_write_bytecode = True                                          # no __pycache__ in card 19's read-only folder
import project_units as pu                                             # noqa: E402  (card 19, read-only import)

DEF_UNITS = os.path.join(REPO, "Habait", "engine", "_local", "rainbow", "units.json")
DEF_FOOT = os.path.join(REPO, "Habait", "studio", "_local", "projects", "apt846-rainbow-tlv", "derived", "tower-footprint.json")
DEF_MASS = os.path.join(REPO, "Habait", "engine", "_local", "rainbow", "mass-plan-world", "tower-mass.json")
DEF_OUT = os.path.join(HERE, "_local")
SCHEMA = os.path.join(HERE, "turntable.schema.json")
HERO = "apt846"
STATUS_COL = {"for-sale": (40, 200, 90), "available": (40, 200, 90), "reserved": (255, 176, 0), "sold": (230, 60, 60)}


def log(m):
    print("[ppersp] " + m, flush=True)


# ------------------------------------------------------------------------------------------------ camera maths
def intrinsics(lens_mm, sensor_w_mm, W, H):
    fx = lens_mm / sensor_w_mm * W
    return {"fx": round(fx, 6), "fy": round(fx, 6), "cx": W / 2.0, "cy": H / 2.0, "width": int(W), "height": int(H)}


def project_px(points, M, K):
    """world points (N,3) -> pixel x, y and forward depth, for camera-to-world M (4x4) and intrinsics K"""
    M = np.asarray(M, float)
    R, t = M[:3, :3], M[:3, 3]
    q = (np.atleast_2d(np.asarray(points, float)) - t) @ R
    right, up, fwd = q[:, 0], q[:, 1], -q[:, 2]
    with np.errstate(divide="ignore", invalid="ignore"):
        x = K["cx"] + K["fx"] * right / fwd
        y = K["cy"] - K["fy"] * up / fwd
    return x, y, fwd


def look_matrix(pos, target):
    """camera-to-world for a camera at pos looking at target, world +Z up, no roll"""
    pos, target = np.asarray(pos, float), np.asarray(target, float)
    f = target - pos
    f /= np.linalg.norm(f)
    r = np.cross(f, [0.0, 0.0, 1.0])
    r /= np.linalg.norm(r)
    u = np.cross(r, f)
    M = np.eye(4)
    M[:3, 0], M[:3, 1], M[:3, 2], M[:3, 3] = r, u, -f, pos
    return M


def bearing_deg(dx, dy):
    """plan bearing, clockwise from +Y (up the plan sheet)"""
    return math.degrees(math.atan2(dx, dy)) % 360.0


# ------------------------------------------------------------------------------------------------ polygon helpers
def ccw(P):
    P = np.asarray(P, float)
    if len(P) > 1 and np.allclose(P[0], P[-1]):
        P = P[:-1]
    sa = 0.5 * np.sum(P[:, 0] * np.roll(P[:, 1], -1) - np.roll(P[:, 0], -1) * P[:, 1])
    return P[::-1] if sa < 0 else P


def convex_ccw(P):
    return ccw(np.array(pu.convex_hull(np.asarray(P, float)), float))


def front_chain(P, cam_xy):
    """convex CCW outline P -> vertex chain of the edges whose outward normal faces cam_xy (contiguous); [] if none/all"""
    n = len(P)
    B = np.roll(P, -1, axis=0)
    e = B - P
    nrm = np.stack([e[:, 1], -e[:, 0]], 1)                     # outward for CCW
    facing = np.sum(nrm * (np.asarray(cam_xy, float) - (P + B) / 2.0), axis=1) > 1e-9
    if not facing.any() or facing.all():
        return []                                                # all facing = camera inside the outline in plan
    start = next(i for i in range(n) if facing[i] and not facing[i - 1])
    chain = [P[start]]
    i = start
    while facing[i % n]:
        chain.append(P[(i + 1) % n])
        i += 1
    return chain


def clip_rect(poly, W, H):
    p = pu.clip_x([tuple(v) for v in poly], 0.0, float(W))
    if len(p) < 3:
        return []
    q = pu.clip_x([(y, x) for x, y in p], 0.0, float(H))
    return [(x, y) for y, x in q] if len(q) >= 3 else []


def strip(P, z0, z1, M, K):
    """camera-facing vertical faces of prism P x [z0, z1] -> pixel polygon clipped to the frame; [] if none"""
    cam = np.asarray(M, float)[:3, 3]
    ch = front_chain(P, cam[:2])
    if len(ch) < 2:
        return []
    pts = [(x, y, z1) for x, y in ch] + [(x, y, z0) for x, y in reversed(ch)]
    x, y, fwd = project_px(pts, M, K)
    if np.any(fwd <= 0.1):
        return []                                                # behind / at the camera: never a turntable case
    return clip_rect(list(zip(x, y)), K["width"], K["height"])


def centroid(pl):
    a = np.asarray(pl, float)
    x, y = a[:, 0], a[:, 1]
    x1, y1 = np.roll(x, -1), np.roll(y, -1)
    c = x * y1 - x1 * y
    A = c.sum() / 2.0
    if abs(A) < 1e-9:
        return float(x.mean()), float(y.mean())
    return float(((x + x1) * c).sum() / (6 * A)), float(((y + y1) * c).sum() / (6 * A))


def dedupe(pl):
    """round to integer pixels, drop repeats (also a closing repeat)"""
    out = []
    for x, y in pl:
        p = (int(round(x)), int(round(y)))
        if not out or out[-1] != p:
            out.append(p)
    if len(out) > 1 and out[0] == out[-1]:
        out.pop()
    return out


def pts_str(pl):
    return " ".join("%d,%d" % p for p in pl)


# ------------------------------------------------------------------------------------------------ scene inputs
def load_plate(foot_path):
    d = json.load(open(foot_path, encoding="utf-8"))
    plate = np.asarray([(x / 100.0, -y / 100.0) for x, y in d["polygon_cm"]], float)
    hero = np.asarray([(x / 100.0, -y / 100.0) for x, y in d["unit_cm"]], float) if d.get("unit_cm") else None
    return plate, hero


def load_floors(mass_path):
    fl = json.load(open(mass_path, encoding="utf-8"))["floors"]
    g0 = int(fl.get("ground_index", 0))
    return {"ftf": float(fl["ftf_m"]), "unit_floor": int(fl["unit_floor"]), "z_ground": float(fl["z_ground_m"]),
            "z_top": float(fl.get("z_top_m", fl.get("z_roof_m"))),
            "floors": list(range(g0 + 1, g0 + int(fl["residential"]) + 1))}


def unit_label(uid):
    s = str(uid)
    d = s.lstrip("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_-")
    return d if d.isdigit() else s


def clip_convex(S, C):
    """Sutherland-Hodgman: polygon S clipped by the convex CCW polygon C (both (N,2)) -> CCW array, maybe empty"""
    out = [tuple(p) for p in S]
    for i in range(len(C)):
        a, b = C[i], C[(i + 1) % len(C)]

        def side(p):
            return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])   # >= 0 = inside (left of a->b)
        inp, out = out, []
        for j in range(len(inp)):
            p, q = inp[j - 1], inp[j]
            sp, sq = side(p), side(q)
            if sq >= 0:
                if sp < 0:
                    t = sp / (sp - sq)
                    out.append((p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])))
                out.append(q)
            elif sp >= 0:
                t = sp / (sp - sq)
                out.append((p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])))
        if len(out) < 3:
            return np.zeros((0, 2))
    return ccw(np.asarray(out, float))


def outline_for(u, hero_box, hero_outline, plate_hull=None):
    """unit plan outline (convex, CCW), clipped to the plate hull so no polygon sticks out of the tower silhouette"""
    P, src = outline_raw(u, hero_box, hero_outline)
    if plate_hull is not None:
        Q = clip_convex(P, plate_hull)
        if len(Q) >= 3:
            a0, a1 = pu.poly_area([tuple(p) for p in P]), pu.poly_area([tuple(p) for p in Q])
            return Q, "%s, clipped to the plate hull (%.0f%% kept)" % (src, 100.0 * a1 / max(a0, 1e-9))
    return P, src


def outline_raw(u, hero_box, hero_outline):
    b = u["box_world"]
    if u.get("outline_world"):
        return convex_ccw(u["outline_world"]), "outline_world"
    if hero_outline is not None and hero_box is not None and np.allclose(b[0:2], hero_box[0:2], atol=0.05) \
            and np.allclose(b[3:5], hero_box[3:5], atol=0.05):
        return convex_ccw(hero_outline), "hero-outline (tower-footprint unit_cm)"
    return convex_ccw([(b[0], b[1]), (b[3], b[1]), (b[3], b[4]), (b[0], b[4])]), "box"


def facade_bearing(outline, plate, tol=1.0):
    """length-weighted outward normal of the outline edges on the plate boundary (outside the plate within tol m)"""
    prism = pu.Prism(plate, -1, 1)
    P = ccw(outline)
    acc = np.zeros(2)
    for i in range(len(P)):
        a, b = P[i], P[(i + 1) % len(P)]
        e = b - a
        n = np.array([e[1], -e[0]])
        probe = (a + b) / 2.0 + n / (np.linalg.norm(n) + 1e-12) * tol
        if not prism.inside_xy(probe[None])[0]:
            acc += n
    return None if not acc.any() else round(bearing_deg(acc[0], acc[1]), 1)


def sha256(p):
    with open(p, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()


def rel(p):
    return os.path.relpath(os.path.abspath(p), REPO).replace("\\", "/")


# ------------------------------------------------------------------------------------------------ the run
def run(a):
    cam = json.load(open(a.camera, encoding="utf-8"))
    doc, units = pu.load_units(a.units)
    prism = pu.load_occluder(a.occluder, a.occluder_z)
    plate, hero_outline = load_plate(a.occluder)
    hull = convex_ccw(plate)
    fl = load_floors(a.occluder_z)
    hero = next((u for u in units if u.get("id") == HERO), None)
    hero_box = hero["box_world"] if hero else None
    outl = {u["id"]: outline_for(u, hero_box, hero_outline, hull) for u in units if len(u.get("box_world") or []) == 6}
    facade = {unit_label(k): facade_bearing(v[0], plate) for k, v in outl.items()}
    frames_out, vis_angles = [], {}
    nh = nhid = 0
    for fr in cam["frames"]:
        M = np.asarray(fr["matrix_world"], float)
        K = fr["intrinsics"]
        pos = M[:3, 3]
        hs = []
        for u in units:
            if u["id"] not in outl:
                continue
            b = u["box_world"]
            vf = pu.visible_fraction(prism, pos, b)
            if vf is not None and vf < a.min_visible:
                nhid += 1
                continue
            pl = dedupe(strip(outl[u["id"]][0], b[2], b[5], M, K))
            if len(pl) < 4:
                nhid += 1
                continue
            cx, cy = centroid(pl)
            lab = unit_label(u["id"])
            hs.append({"unit": lab, "id": u["id"], "floor": int(u.get("floor", 0)), "type": u.get("type", ""),
                       "status": u.get("status") or "available", "points": pts_str(pl),
                       "labelPoints": "%d,%d" % (round(cx), round(cy)),
                       "visible_frac": None if vf is None else round(vf, 3)})
            vis_angles.setdefault(lab, []).append(fr["angle"])
            nh += 1
        hs.sort(key=lambda h: (-h["floor"], h["unit"]))
        floors = []
        for f in fl["floors"]:
            z0 = (f - fl["unit_floor"]) * fl["ftf"]
            pl = dedupe(strip(hull, z0, z0 + fl["ftf"], M, K))
            if len(pl) < 4:
                continue
            cx, cy = centroid(pl)
            floors.append({"floor": f, "points": pts_str(pl), "labelPoints": "%d,%d" % (round(cx), round(cy)),
                           "units": [unit_label(u["id"]) for u in units if int(u.get("floor", -1)) == f]})
        frames_out.append({"src": "%03d.webp" % fr["index"], "angle": fr["angle"],
                           "camera_bearing_deg": fr.get("camera_bearing_deg"), "hotspots": hs, "floors": floors})
    K0 = cam["frames"][0]["intrinsics"]
    out = {"schema": "habait.turntable.v0", "project": doc.get("project", "") if isinstance(doc, dict) else "",
           "width": K0["width"], "height": K0["height"], "step_deg": cam.get("step_deg", 5), "frames": frames_out,
           "meta": {"generator": "Habait/flyover/turntable/project_units_perspective.py (card 21)",
                    "angle": "camera plan bearing = bearing0_deg + angle (clockwise seen from above); frame 0 = the hold-pose side",
                    "bearing0_deg": cam.get("bearing0_deg"), "min_visible": a.min_visible,
                    "polygon": "camera-facing vertical faces of the unit prism, clipped to the frame; pixels, origin top-left",
                    "facade_bearing_deg": facade,
                    "outline_source": {unit_label(k): v[1] for k, v in outl.items()},
                    "visible_angles": {k: sorted(v) for k, v in vis_angles.items()},
                    "inputs": {"units": rel(a.units), "units_sha256": sha256(a.units), "occluder": rel(a.occluder),
                               "occluder_z": rel(a.occluder_z), "camera": rel(a.camera)},
                    "counts": {"hotspots": nh, "hidden": nhid}}}
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    with open(a.out, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    log("wrote %s: %d frames, %d unit hotspots (%d hidden), %d KB" % (rel(a.out), len(frames_out), nh, nhid,
                                                                       os.path.getsize(a.out) // 1024))
    return out


# ------------------------------------------------------------------------------------------------ debug overlay
def blank_canvas(cam_fr, plate_hull, fl, W, H):
    """no render yet: soft sky/ground canvas + the tower prism outline (plate at ground and top, hull vertical edges)"""
    from PIL import Image, ImageDraw
    M, K = np.asarray(cam_fr["matrix_world"], float), cam_fr["intrinsics"]
    im = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(im)
    # horizon row of a level direction
    fwd = -M[:3, 2]
    far = M[:3, 3] + np.array([fwd[0], fwd[1], 0.0]) / (np.hypot(fwd[0], fwd[1]) + 1e-9) * 5000.0
    _, hy, _ = project_px([far], M, K)
    hy = int(np.clip(hy[0], 0, H))
    for y in range(H):
        if y < hy:
            t = y / max(hy, 1)
            c = tuple(int(a + (b - a) * t) for a, b in zip((196, 214, 232), (236, 238, 240)))
        else:
            t = (y - hy) / max(H - hy, 1)
            c = tuple(int(a + (b - a) * t) for a, b in zip((214, 212, 204), (188, 186, 178)))
        d.line([(0, y), (W, y)], fill=c)
    zg, zt = fl["z_ground"], fl["z_top"]
    for z in (zg, zt):
        x, y, _ = project_px([(p[0], p[1], z) for p in plate_hull], M, K)
        pts = list(zip(x, y))
        d.line(pts + [pts[0]], fill=(90, 96, 104), width=1)
    ch = front_chain(plate_hull, M[:3, 3][:2])
    pts = [(p[0], p[1], zt) for p in ch] + [(p[0], p[1], zg) for p in reversed(ch)]
    x, y, _ = project_px(pts, M, K)
    d.polygon(list(zip(x, y)), fill=(150, 156, 164), outline=(70, 74, 80))
    return im


def draw_debug(tt, cam, idx, src_dir, out_dir, plate_hull, fl, scale=0.5):
    from PIL import Image, ImageDraw
    fr = tt["frames"][idx]
    W, H = tt["width"], tt["height"]
    src = None
    for name in ("%03d.png" % idx, fr["src"]):
        p = os.path.join(src_dir, name) if src_dir else ""
        if p and os.path.exists(p):
            src = p
            break
    if src:
        im = Image.open(src).convert("RGB")
        if im.size != (W, H):
            im = im.resize((W, H), Image.LANCZOS)
        bg = "render " + os.path.basename(src)
    else:
        im = blank_canvas(cam["frames"][idx], plate_hull, fl, W, H)
        bg = "blank canvas (no render yet)"
    ov = Image.new("RGBA", im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)

    def P(s):
        return [tuple(map(int, t.split(","))) for t in s.split()]
    for f in fr["floors"]:
        pts = P(f["points"])
        d.line(pts + [pts[0]], fill=(255, 255, 255, 90), width=1)
    for h in fr["hotspots"]:
        c = STATUS_COL.get(h["status"], (40, 200, 90))
        pts = P(h["points"])
        hero = h["id"] == HERO
        d.polygon(pts, fill=c + (140 if hero else 70,))
        d.line(pts + [pts[0]], fill=(255, 255, 255, 255) if hero else c + (230,), width=4 if hero else 2)
        lx, ly = map(int, h["labelPoints"].split(","))
        d.text((lx - 9, ly - 6), h["unit"], fill=(255, 255, 255, 255) if hero else (20, 20, 20, 255))
    im = Image.alpha_composite(im.convert("RGBA"), ov).convert("RGB")
    d2 = ImageDraw.Draw(im)
    d2.rectangle([0, 0, W, 22], fill=(0, 0, 0))
    d2.text((6, 5), "frame %03d  angle %d  bearing %.1f  units %d  846 %s  | %s" % (
        idx, fr["angle"], fr.get("camera_bearing_deg") or -1, len(fr["hotspots"]),
        "VISIBLE" if any(h["id"] == HERO for h in fr["hotspots"]) else "hidden", bg), fill=(255, 255, 255))
    if scale != 1.0:
        im = im.resize((int(W * scale), int(H * scale)), Image.LANCZOS)
    out = os.path.join(out_dir, "debug-%03d.png" % idx)
    im.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(out, optimize=True)
    log("debug %s (%d KB, %s)" % (rel(out), os.path.getsize(out) // 1024, bg))


# ------------------------------------------------------------------------------------------------ the tiny schema
def check_schema(node, sch, path, errs):
    t = sch.get("type")
    tmap = {"object": dict, "array": list, "string": str, "integer": int, "number": (int, float), "boolean": bool}
    if isinstance(t, list):
        if not any(isinstance(node, tmap[x]) if x != "null" else node is None for x in t):
            errs.append("%s: want %s" % (path, t))
        return
    if t and (not isinstance(node, tmap[t]) or (t in ("integer", "number") and isinstance(node, bool))):
        errs.append("%s: want %s" % (path, t))
        return
    if "enum" in sch and node not in sch["enum"]:
        errs.append("%s: %r not in enum" % (path, node))
    if "minimum" in sch and node < sch["minimum"]:
        errs.append("%s: < minimum" % path)
    if "maximum" in sch and node > sch["maximum"]:
        errs.append("%s: > maximum" % path)
    if "pattern" in sch:
        import re
        if not re.fullmatch(sch["pattern"], node):
            errs.append("%s: pattern %s" % (path, sch["pattern"]))
    if t == "object":
        for k in sch.get("required", []):
            if k not in node:
                errs.append("%s: missing %s" % (path, k))
        for k, s in sch.get("properties", {}).items():
            if k in node:
                check_schema(node[k], s, path + "." + k, errs)
    if t == "array":
        if "minItems" in sch and len(node) < sch["minItems"]:
            errs.append("%s: minItems %d" % (path, sch["minItems"]))
        if "maxItems" in sch and len(node) > sch["maxItems"]:
            errs.append("%s: maxItems %d" % (path, sch["maxItems"]))
        if "items" in sch:
            for i, it in enumerate(node):
                check_schema(it, sch["items"], "%s[%d]" % (path, i), errs)


def validate(path):
    tt = json.load(open(path, encoding="utf-8"))
    sch = json.load(open(SCHEMA, encoding="utf-8"))
    errs = []
    check_schema(tt, sch, "$", errs)
    W, H = tt.get("width", 1280), tt.get("height", 720)
    npoly = 0
    for i, fr in enumerate(tt.get("frames", [])):
        for kind in ("hotspots", "floors"):
            for j, h in enumerate(fr.get(kind, [])):
                pts = [tuple(map(float, t.split(","))) for t in h["points"].split()]
                npoly += 1
                if len(pts) < 4:
                    errs.append("frames[%d].%s[%d]: %d points < 4" % (i, kind, j, len(pts)))
                if any(not (0 <= x <= W and 0 <= y <= H) for x, y in pts):
                    errs.append("frames[%d].%s[%d]: point outside 0..%d x 0..%d" % (i, kind, j, W, H))
        if fr.get("angle") != i * tt.get("step_deg", 5) or fr.get("src") != "%03d.webp" % i:
            errs.append("frames[%d]: angle/src out of order" % i)
    for e in errs[:20]:
        print("  FAIL " + e)
    print("validate %s: frames %d, polygons %d, errors %d -> %s" % (
        os.path.basename(path), len(tt.get("frames", [])), npoly, len(errs), "PASS" if not errs else "FAIL"))
    return 0 if not errs else 1


# ------------------------------------------------------------------------------------------------ selftest
def selftest(a):
    ok = True

    def chk(name, cond, info=""):
        nonlocal ok
        ok &= bool(cond)
        print("  %s %s %s" % ("PASS" if cond else "FAIL", name, info))
    K = intrinsics(50.0, 36.0, 1280, 720)
    M = look_matrix([0, -100, 0], [0, 0, 0])
    x, y, f = project_px([[0, 0, 0], [10, 0, 0], [0, 0, 10]], M, K)
    chk("centre -> image centre", abs(x[0] - 640) < 1e-6 and abs(y[0] - 360) < 1e-6, "%.3f,%.3f" % (x[0], y[0]))
    chk("+X world (camera right) -> x grows", x[1] > 640)
    chk("+Z up -> y shrinks", y[2] < 360)
    chk("pinhole scale fx*X/Z", abs((x[1] - 640) - K["fx"] * 10 / 100) < 1e-6)
    sq = convex_ccw([(-1, -1), (1, -1), (1, 1), (-1, 1)])
    pl = dedupe(strip(sq, -1, 1, M, K))
    chk("face-on box -> 4 points", len(pl) == 4, str(len(pl)))
    M2 = look_matrix([60, -60, 30], [0, 0, 0])
    pl2 = dedupe(strip(sq, -1, 1, M2, K))
    chk("corner view from above -> 6 points (2 faces, no roof)", len(pl2) == 6, str(len(pl2)))
    st_a, st_b = dedupe(strip(sq, 0, 1, M2, K)), dedupe(strip(sq, 1, 2, M2, K))
    chk("stacked strips share their edge (no roof overlap)", len(set(st_a) & set(st_b)) >= 2)
    cl = clip_rect([(-50, 100), (300, 100), (300, -40), (-50, -40)], 1280, 720)
    chk("clip to frame", len(cl) == 4 and all(0 <= px <= 1280 and 0 <= py <= 720 for px, py in cl))
    chk("unit_label apt846 -> 846", unit_label("apt846") == "846" and unit_label("826") == "826")
    cc = clip_convex(sq * 2, sq)
    chk("clip_convex: a 4x4 box to a 2x2 plate", len(cc) == 4 and abs(pu.poly_area([tuple(p) for p in cc]) - 4.0) < 1e-9)
    if a.camera and os.path.exists(a.camera):
        cam = json.load(open(a.camera, encoding="utf-8"))
        chk("72 frames at 5 deg", len(cam["frames"]) == 72 and all(fr["angle"] == 5 * i for i, fr in enumerate(cam["frames"])))
        errs = []
        for fr in cam["frames"]:
            for pr in fr.get("probe", []):
                px, py, _ = project_px([pr["world"]], fr["matrix_world"], fr["intrinsics"])
                errs.append(math.hypot(px[0] - pr["px"][0], py[0] - pr["px"][1]))
        if errs:
            chk("Blender world_to_camera_view cross-check", max(errs) < 0.5, "%d probes, max %.4f px" % (len(errs), max(errs)))
        else:
            print("  SKIP Blender cross-check (camera.json has no Blender probes yet; turntable.py --render adds them)")
    print("SELFTEST %s" % ("PASS" if ok else "FAIL"))
    return 0 if ok else 1


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--camera", default=os.path.join(DEF_OUT, "camera.json"))
    ap.add_argument("--units", default=DEF_UNITS)
    ap.add_argument("--occluder", default=DEF_FOOT)
    ap.add_argument("--occluder-z", default=DEF_MASS)
    ap.add_argument("--out", default=os.path.join(DEF_OUT, "turntable.json"))
    ap.add_argument("--min-visible", type=float, default=0.25)
    ap.add_argument("--debug", default="", help="frame indices, e.g. 0,18,36,54")
    ap.add_argument("--debug-src", default="", help="dir with NNN.png (raw renders) or NNN.webp; default = next to --out")
    ap.add_argument("--validate", default="")
    ap.add_argument("--selftest", action="store_true")
    a = ap.parse_args()
    if a.selftest:
        return selftest(a)
    if a.validate:
        return validate(a.validate)
    tt = run(a)
    if a.debug:
        cam = json.load(open(a.camera, encoding="utf-8"))
        plate, _ = load_plate(a.occluder)
        fl = load_floors(a.occluder_z)
        src = a.debug_src or os.path.dirname(os.path.abspath(a.out))
        for i in [int(s) for s in a.debug.split(",") if s.strip()]:
            draw_debug(tt, cam, i, src, os.path.dirname(os.path.abspath(a.out)), convex_ccw(plate), fl)
    return validate(a.out)


if __name__ == "__main__":
    sys.exit(main())
