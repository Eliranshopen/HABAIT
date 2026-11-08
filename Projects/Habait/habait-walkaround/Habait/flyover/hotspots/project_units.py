"""project_units.py - every unit's 3D box -> a polygon on the equirect of every frame of a flight segment -> hotspots.json (card 19, C4).

Pure numpy (no Blender at run time), so it runs anywhere the platform builds.

  python -I project_units.py --units <units.json> --camera <seg>/camera.json [--out <seg>/hotspots.json]
         [--occluder <tower-footprint.json> --occluder-z <z_ground,z_top | tower-mass.json>] [--debug 0,36]
         [--bg <equirect.png> --bg-pose <faces.json>] [--edge-samples 4] [--min-visible 0.10] [--stride 1] [--selftest]

Conventions (the same as Habait/studio/tools/world2equi.py, habait-98's, and card 17's render_segments.py; --selftest checks
both live):
  * world = plan-world metres: X = x_cm/100 (right), Y = -y_cm/100 (up the plan), Z up, the hero unit's floor at z 0.
  * box_world = [x0, y0, z0, x1, y1, z1] in that frame (units.json, card 03).
  * camera.json = the Studio form {"frames": [...]}: matrix_world = camera to world; the camera looks along local -Z,
    local +Y = up, local +X = right.
  * equirect: u 0.5 = the camera's look direction, u grows clockwise seen from above (= camera right), v 0 = zenith:
    u = 0.5 + lon/360, v = 0.5 - lat/180, lon = atan2(right, forward), lat = atan2(up, horizontal distance).
    For a level camera this is card 17's u = 0.5 + (bearing - yaw)/360 (bearing clockwise from +Y).
  * contract (Habait/platform/contracts/units.schema.json, $defs.hotspot): yaw_deg = (u - 0.5) * 360 in [-180, 180],
    pitch_deg = (0.5 - v) * 180, polygon = [[yaw_deg, pitch_deg], ...]. One hotspot per unit per frame (per --stride frames),
    t_start = (frame - 1) / fps, t_end = (frame - 1 + stride) / fps, seconds from the segment's first frame.

Polygon = convex hull of the box's 8 corners plus --edge-samples points on each of its 12 edges (straight edges bend on an
equirect), unwrapped around the box centre, then clipped to yaw [-180, 180]: a box across the u = 0/1 seam becomes TWO hotspots
for the same frame (same marker yaw/pitch = the box centre), never one polygon spanning the width.
Culled per frame: the camera inside the box; a box hidden behind the building (--occluder: a vertical prism of the floor plate;
the line of sight to a sample point on the box must first enter the building inside this unit's box; a visible fraction
< --min-visible is culled). An equirect has no "behind the camera": every direction is on the image, so "behind" = hidden.
A box straight above/below the camera (camera inside its plan rectangle) is culled as camera-in-column (with
--keep-pole-bands it becomes a band to the pole).
"""
import argparse
import hashlib
import json
import math
import os
import subprocess
import sys
import tempfile

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))   # Habait/flyover/hotspots -> repo root
WORLD2EQUI = os.path.join(REPO, "Habait", "studio", "tools", "world2equi.py")
DEF_SEG_ROOT = os.path.join(REPO, "Habait", "flyover", "equirect", "_local", "segments")
FIXTURES = os.path.join(HERE, "fixtures")
TOL_DEG = 0.5


def log(msg):
    print(msg, flush=True)


# ------------------------------------------------------------------------------------------------ geometry
def wrap180(x):
    return (np.asarray(x, float) + 180.0) % 360.0 - 180.0


def box_corners(b):
    return np.array([(x, y, z) for x in (b[0], b[3]) for y in (b[1], b[4]) for z in (b[2], b[5])], float)


BOX_EDGES = [(i, j) for i in range(8) for j in range(i + 1, 8) if bin(i ^ j).count("1") == 1]  # the 12 edges


def box_outline_points(b, edge_samples):
    c = box_corners(b)
    pts = [c]
    if edge_samples > 0:
        ts = np.arange(1, edge_samples + 1) / (edge_samples + 1.0)
        for i, j in BOX_EDGES:
            pts.append(c[i] + ts[:, None] * (c[j] - c[i]))
    return np.vstack(pts)


def box_surface_samples(b, n=4):
    """n x n points on each of the 6 faces, for the visibility test"""
    lo, hi = np.array(b[:3], float), np.array(b[3:], float)
    g = (np.arange(n) + 0.5) / n
    out = []
    for ax in range(3):
        o = [k for k in range(3) if k != ax]
        for side in (lo[ax], hi[ax]):
            for s in g:
                for t in g:
                    p = np.empty(3)
                    p[ax] = side
                    p[o[0]] = lo[o[0]] + s * (hi[o[0]] - lo[o[0]])
                    p[o[1]] = lo[o[1]] + t * (hi[o[1]] - lo[o[1]])
                    out.append(p)
    return np.array(out)


def project(points, M):
    """world points (N,3) -> (lon_deg, lat_deg) on the equirect of camera matrix_world M (4x4, camera to world)"""
    M = np.asarray(M, float)
    R, t = M[:3, :3], M[:3, 3]
    q = (np.asarray(points, float) - t) @ R          # row form of R^T (p - t): camera-local coordinates
    right, up, fwd = q[:, 0], q[:, 1], -q[:, 2]
    lon = np.degrees(np.arctan2(right, fwd))
    lat = np.degrees(np.arctan2(up, np.hypot(right, fwd)))
    return lon, lat


def lonlat_to_uv(lon, lat):
    return (0.5 + np.asarray(lon) / 360.0) % 1.0, 0.5 - np.asarray(lat) / 180.0


def convex_hull(pts):
    """Andrew's monotone chain; pts (N,2) -> hull counter-clockwise, no repeated vertex"""
    P = sorted(set(map(tuple, np.round(np.asarray(pts, float), 9))))
    if len(P) <= 2:
        return P

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lower, upper = [], []
    for p in P:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    for p in reversed(P):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)
    return lower[:-1] + upper[:-1]


def clip_x(poly, lo, hi):
    """Sutherland-Hodgman against lo <= x <= hi"""
    def clip(pl, keep, xcut):
        out = []
        for i in range(len(pl)):
            a, b = pl[i - 1], pl[i]
            ia, ib = keep(a[0]), keep(b[0])
            if ib:
                if not ia:
                    t = (xcut - a[0]) / (b[0] - a[0])
                    out.append((xcut, a[1] + t * (b[1] - a[1])))
                out.append(b)
            elif ia:
                t = (xcut - a[0]) / (b[0] - a[0])
                out.append((xcut, a[1] + t * (b[1] - a[1])))
        return out
    p = clip(list(poly), lambda x: x >= lo, lo)
    return clip(p, lambda x: x <= hi, hi) if len(p) >= 3 else []


def poly_area(pl):
    if len(pl) < 3:
        return 0.0
    a = np.asarray(pl, float)
    return 0.5 * abs(np.dot(a[:, 0], np.roll(a[:, 1], -1)) - np.dot(a[:, 1], np.roll(a[:, 0], -1)))


def seam_split(hull):
    """hull in unwrapped lon (may leave [-180, 180]) -> its parts inside [-180, 180] (1, or 2 across the seam)"""
    parts = []
    for k in (-360.0, 0.0, 360.0):
        p = clip_x([(x + k, y) for x, y in hull], -180.0, 180.0)
        if len(p) >= 3 and poly_area(p) > 1e-6:
            parts.append(p)
    return parts


# ------------------------------------------------------------------------------------------------ occluder (vertical prism)
class Prism:
    def __init__(self, poly_xy, z0, z1, src=""):
        P = np.asarray(poly_xy, float)
        if np.allclose(P[0], P[-1]):
            P = P[:-1]
        sa = 0.5 * np.sum(P[:, 0] * np.roll(P[:, 1], -1) - np.roll(P[:, 0], -1) * P[:, 1])
        if sa < 0:
            P = P[::-1]                                   # counter-clockwise
        self.P, self.z0, self.z1, self.src = P, float(z0), float(z1), src
        self.A, self.B = P, np.roll(P, -1, axis=0)

    def inside_xy(self, xy):
        xy = np.atleast_2d(np.asarray(xy, float))
        x, y = xy[:, 0:1], xy[:, 1:2]
        ax, ay, bx, by = self.A[:, 0], self.A[:, 1], self.B[:, 0], self.B[:, 1]
        cond = (ay > y) != (by > y)
        with np.errstate(divide="ignore", invalid="ignore"):
            xint = ax + (y - ay) * (bx - ax) / (by - ay)
        return (np.sum(cond & (x < xint), axis=1) % 2) == 1

    def first_entry(self, C, P):
        """segments C (3,) -> P (N,3): parameter t in (0, 1) where the segment first enters the solid, nan if never;
        all zeros if the camera itself is inside the solid"""
        C = np.asarray(C, float)
        D = P - C
        if self.z0 <= C[2] <= self.z1 and self.inside_xy(C[None, :2])[0]:
            return np.zeros(len(P))
        e = self.B - self.A
        nrm = np.stack([e[:, 1], -e[:, 0]], 1)            # outward normal of each edge (CCW polygon)
        d2 = D[:, :2]
        den = d2[:, 0:1] * e[None, :, 1] - d2[:, 1:2] * e[None, :, 0]
        wx = self.A[None, :, 0] - C[0]
        wy = self.A[None, :, 1] - C[1]
        with np.errstate(divide="ignore", invalid="ignore"):
            t = (wx * e[None, :, 1] - wy * e[None, :, 0]) / den
            s = (wx * d2[:, 1:2] - wy * d2[:, 0:1]) / den
        entering = (d2 @ nrm.T) < 0
        z = C[2] + t * D[:, 2:3]
        ok = entering & np.isfinite(t) & (t > 0) & (t < 1) & (s >= 0) & (s <= 1) & (z >= self.z0) & (z <= self.z1)
        tx = np.where(ok, t, np.inf).min(axis=1)
        # entry through the roof or the underside: z reaches the slab range while xy is inside the plate
        dz = D[:, 2]
        with np.errstate(divide="ignore", invalid="ignore"):
            if C[2] > self.z1:
                tz = (self.z1 - C[2]) / dz
            elif C[2] < self.z0:
                tz = (self.z0 - C[2]) / dz
            else:
                tz = np.full(len(P), np.nan)
        tz_ok = np.isfinite(tz) & (tz > 0) & (tz < 1)
        xy_tz = C[None, :2] + np.nan_to_num(tz, nan=0.0, posinf=0.0, neginf=0.0)[:, None] * d2
        tz_ok &= self.inside_xy(xy_tz)
        te = np.minimum(tx, np.where(tz_ok, tz, np.inf))
        return np.where(np.isfinite(te), te, np.nan)


def load_occluder(path, zspec):
    d = json.load(open(path, encoding="utf-8"))
    if "polygon_world" in d:
        poly = d["polygon_world"]
    elif "polygon_cm" in d:
        poly = [(x / 100.0, -y / 100.0) for x, y in d["polygon_cm"]]   # plan cm (+y down) -> plan world (Y up)
    else:
        raise SystemExit(f"--occluder {path}: no polygon_world / polygon_cm")
    if zspec and zspec.lower().endswith(".json"):
        m = json.load(open(zspec, encoding="utf-8"))
        fl = m.get("floors", m)
        z0, z1 = float(fl["z_ground_m"]), float(fl.get("z_top_m", fl.get("z_roof_m")))
    elif zspec:
        z0, z1 = [float(v) for v in zspec.split(",")]
    else:
        raise SystemExit("--occluder needs --occluder-z z_ground,z_top (or a tower-mass.json with floors.z_ground_m / z_top_m)")
    return Prism(poly, z0, z1, src=os.path.abspath(path))


def visible_fraction(prism, cam_pos, box, tol=0.75):
    """share of sample points on the box whose line of sight first enters the building inside this box (+tol m)"""
    if prism is None:
        return None
    S = box_surface_samples(box)
    te = prism.first_entry(cam_pos, S)
    if np.any(te == 0):
        return None                                    # the camera is inside the building: no test
    C = np.asarray(cam_pos, float)
    vis = np.isnan(te)
    hit = ~vis
    if hit.any():
        E = C + te[hit, None] * (S[hit] - C)
        lo, hi = np.array(box[:3], float) - tol, np.array(box[3:], float) + tol
        vis[hit] = np.all((E >= lo) & (E <= hi), axis=1)
    return float(vis.mean())


# ------------------------------------------------------------------------------------------------ one unit on one frame
def unit_on_frame(box, fr, edge_samples, prism, min_visible, keep_pole=False):
    M = np.asarray(fr["matrix_world"], float)
    pos = M[:3, 3]
    lo, hi = np.array(box[:3], float), np.array(box[3:], float)
    centre = (lo + hi) / 2.0
    clon, clat = project(centre[None], M)
    rec = {"centre": [float(clon[0]), float(clat[0])]}
    if np.all(pos >= lo) and np.all(pos <= hi):
        rec["culled"] = "camera-inside-box"
        return rec
    vf = visible_fraction(prism, pos, box)
    if prism is not None:
        rec["visible_frac"] = None if vf is None else round(vf, 3)
    if vf is not None and vf < min_visible:
        rec["culled"] = f"occluded (visible {vf:.2f} < {min_visible})"
        return rec
    pts = box_outline_points(box, edge_samples)
    lon, lat = project(pts, M)
    if lo[0] <= pos[0] <= hi[0] and lo[1] <= pos[1] <= hi[1]:      # straight above / below: a band to the pole
        below = pos[2] > hi[2]
        edge = float(lat.max() if below else lat.min())
        pole = -90.0 if below else 90.0
        rec["pole"] = "nadir" if below else "zenith"
        if not keep_pole:
            rec["culled"] = f"camera-in-column ({rec['pole']})"
            return rec
        rec["parts"] = [[(-180.0, edge), (180.0, edge), (180.0, pole), (-180.0, pole)]]
        return rec
    rel = wrap180(lon - clon[0])
    hull = convex_hull(np.stack([clon[0] + rel, lat], 1))
    rec["span_deg"] = round(float(rel.max() - rel.min()), 3)
    rec["parts"] = seam_split(hull)
    if not rec["parts"]:
        rec["culled"] = "degenerate"
    return rec


def view_hint_box(fr):
    vh = fr.get("view_hint") or {}
    if "u" not in vh:
        return None
    hf = float(vh.get("hfov_deg", 65.5))
    vf = math.degrees(2 * math.atan(math.tan(math.radians(hf / 2)) * 9 / 16))
    return (vh["u"] - 0.5) * 360.0, (0.5 - vh["v"]) * 180.0, hf, vf


def inside_plate_report(prism, units, n=12):
    """share of each box's plan rectangle that lies on the floor plate (a box mostly off the plate is a bad box, not a hotspot)"""
    if prism is None:
        return None
    g = (np.arange(n) + 0.5) / n
    rep = {}
    for u in units:
        b = u.get("box_world")
        if isinstance(b, list) and len(b) == 6:
            xy = np.array([(b[0] + s * (b[3] - b[0]), b[1] + t * (b[4] - b[1])) for s in g for t in g])
            rep[u.get("id")] = round(float(prism.inside_xy(xy).mean()), 3)
    return rep


# ------------------------------------------------------------------------------------------------ the run
def sha256(path):
    with open(path, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()


def load_units(path):
    doc = json.load(open(path, encoding="utf-8"))
    units = doc["units"] if isinstance(doc, dict) else doc
    return doc, units


def run(a, prism):
    doc, units = load_units(a.units)
    cam = json.load(open(a.camera, encoding="utf-8"))
    frames = cam["frames"]
    seg = a.segment or cam.get("segment") or os.path.basename(os.path.dirname(a.camera))
    fps = float(cam.get("fps", 24))
    out = a.out or os.path.join(DEF_SEG_ROOT, seg, "hotspots.json")
    os.makedirs(os.path.dirname(out), exist_ok=True)

    per_unit = {u.get("id"): [] for u in units}
    meta_frames = []
    counts = {"hotspots": 0, "seam_splits": 0, "culled": 0, "pole_bands": 0}
    stride = max(1, a.stride)
    for idx in range(0, len(frames), stride):
        fr = frames[idx]
        n = int(fr.get("frame", idx + 1))
        t0, t1 = (n - 1) / fps, (n - 1 + min(stride, len(frames) - idx)) / fps
        vh = view_hint_box(fr)
        mrow = {"index": idx, "frame": n, "t_start": round(t0, 4), "units": {}}
        for u in units:
            b = u.get("box_world")
            if not (isinstance(b, list) and len(b) == 6):
                mrow["units"][u.get("id")] = {"culled": "no box_world"}
                continue
            r = unit_on_frame(b, fr, a.edge_samples, prism, a.min_visible, a.keep_pole_bands)
            cy, cp = r["centre"]
            m = {"yaw": round(cy, 3), "pitch": round(cp, 3), "u": round((0.5 + cy / 360) % 1, 5), "v": round(0.5 - cp / 180, 5)}
            for k in ("visible_frac", "culled", "pole", "span_deg"):
                if k in r:
                    m[k] = r[k]
            if vh:
                m["in_view_hint"] = bool(abs(float(wrap180(cy - vh[0]))) <= vh[2] / 2 and abs(cp - vh[1]) <= vh[3] / 2)
            if "culled" in r:
                counts["culled"] += 1
            else:
                m["parts"] = len(r["parts"])
                counts["seam_splits"] += len(r["parts"]) > 1
                counts["pole_bands"] += "pole" in r
                for part in r["parts"]:
                    per_unit[u.get("id")].append({
                        "segment": seg, "t_start": round(t0, 4), "t_end": round(t1, 4),
                        "yaw_deg": round(float(cy), 3), "pitch_deg": round(float(cp), 3),
                        "polygon": [[round(float(x), 3), round(float(y), 3)] for x, y in part]})
                    counts["hotspots"] += 1
            mrow["units"][u.get("id")] = m
        meta_frames.append(mrow)

    # the contract file = units.json with this segment's hotspots replaced (other segments' hotspots kept)
    res = json.loads(json.dumps(doc))
    for u in (res["units"] if isinstance(res, dict) else res):
        keep = [h for h in u.get("hotspots", []) if h.get("segment") != seg]
        u["hotspots"] = keep + per_unit.get(u.get("id"), [])
    with open(out, "w", encoding="utf-8") as f:
        json.dump(res, f, ensure_ascii=False, separators=(",", ":"))
    meta = {
        "schema": "habait-flyover/hotspots-meta.v0", "segment": seg, "generated_by": "Habait/flyover/hotspots/project_units.py",
        "units": a.units, "units_sha256": sha256(a.units), "camera": a.camera, "camera_sha256": sha256(a.camera),
        "occluder": None if prism is None else {"file": prism.src, "z": [prism.z0, prism.z1], "min_visible": a.min_visible},
        "edge_samples": a.edge_samples, "stride": stride, "fps": fps,
        "convention": "u 0.5 = camera look_dir, u grows clockwise seen from above, v 0 = zenith; yaw = (u-0.5)*360, "
                      "pitch = (0.5-v)*180; t in seconds from the segment's first frame; a seam-split unit has 2 hotspots "
                      "with the same t and the same marker",
        "units_inside_plate": inside_plate_report(prism, units),
        "counts": counts, "frames": meta_frames}
    meta_path = os.path.splitext(out)[0] + ".meta.json"
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, separators=(",", ":"))
    log(f"[hotspots] {seg}: {len(frames)} frames (stride {stride}) x {len(units)} units -> {counts['hotspots']} hotspots, "
        f"{counts['seam_splits']} seam splits, {counts['pole_bands']} pole bands, {counts['culled']} unit-frames culled; "
        f"occluder {'none' if prism is None else os.path.basename(prism.src)}")
    ip = meta["units_inside_plate"]
    if ip:
        low = {k: v for k, v in ip.items() if v < 0.8}
        log(f"[hotspots] box on the floor plate: {min(ip.values()):.2f}..{max(ip.values()):.2f}"
            + (f"; WARNING mostly off the plate (< 0.80): {low}" if low else ""))
    log(f"[hotspots] wrote {out} ({os.path.getsize(out) / 1024:.0f} KB) + {os.path.basename(meta_path)}")
    return out, cam, units


# ------------------------------------------------------------------------------------------------ debug PNG
def find_bg(fr, a):
    """(equirect path, note) of a rendered equirect whose pose matches this frame within 1 m / 0.5 deg, else (None, why)"""
    cands = []
    if a.bg and a.bg_pose:
        cands.append((a.bg, a.bg_pose))
    for img_dir, pose_dir in a.bg_search:
        if not os.path.isdir(img_dir):
            continue
        for f in sorted(os.listdir(img_dir)):
            if f.endswith(".png") and not f.endswith(".id.png"):
                fj = os.path.join(pose_dir, f[:-4], "faces.json")
                if os.path.exists(fj):
                    cands.append((os.path.join(img_dir, f), fj))
    M = np.asarray(fr["matrix_world"], float)
    pos, fwd = M[:3, 3], -M[:3, 2]
    best, bd = (None, f"no rendered equirect within 1 m / 0.5 deg of this pose ({len(cands)} candidates)"), 1e9
    for img, fj in cands:
        meta = json.load(open(fj, encoding="utf-8"))
        p = np.array(meta["pos"], float)
        look = np.array(meta.get("centre_look") or [p[0], p[1] + 1, p[2]], float)
        d = look - p
        dyaw = abs(float(wrap180(math.degrees(math.atan2(d[0], d[1])) - math.degrees(math.atan2(fwd[0], fwd[1])))))
        dist = float(np.linalg.norm(p - pos))
        if dist <= 1.0 and dyaw <= 0.5 and dist < bd:
            bd = dist
            best = (img, f"bg {os.path.relpath(img, REPO)} (pose {meta.get('shot')}, offset {dist:.2f} m, yaw {dyaw:.2f} deg)")
    return best


COLOURS = [(64, 200, 255), (255, 200, 0), (120, 255, 120), (255, 120, 255), (255, 150, 60), (160, 160, 255),
           (0, 255, 200), (255, 255, 255), (200, 160, 90), (150, 220, 0), (255, 110, 170), (90, 140, 255)]


def draw_debug(out_dir, idx, cam, units, a, prism):
    from PIL import Image, ImageDraw
    fr = cam["frames"][idx]
    bg, note = find_bg(fr, a)
    if bg:
        im = Image.open(bg).convert("RGB")
        if im.width != 2 * im.height or im.width > 4096:
            im = im.resize((min(4096, im.width), min(4096, im.width) // 2), Image.LANCZOS)
    else:
        im = Image.new("RGB", (2048, 1024), (28, 30, 34))
    W, H = im.size
    clean = im.copy()
    dr = ImageDraw.Draw(im, "RGBA")
    X = lambda yaw: (0.5 + yaw / 360.0) * W
    Y = lambda pitch: (0.5 - pitch / 180.0) * H
    for yaw in range(-180, 181, 30):
        dr.line([(X(yaw), 0), (X(yaw), H)], fill=(255, 255, 255, 60), width=1)
        dr.text((X(yaw) + 2, Y(0) + 2), f"{yaw:+d}", fill=(255, 255, 255, 160))
    for p in range(-60, 61, 30):
        dr.line([(0, Y(p)), (W, Y(p))], fill=(255, 255, 255, 60), width=1)
    dr.line([(X(0), 0), (X(0), H)], fill=(255, 255, 0, 170), width=2)            # the camera's look direction = u 0.5
    dr.text((X(0) + 4, 4), "camera look (u 0.5)", fill=(255, 255, 0, 255))
    vh = view_hint_box(fr)
    if vh:
        y0, p0, hf, vf = vh
        dr.rectangle([X(y0 - hf / 2), Y(p0 + vf / 2), X(y0 + hf / 2), Y(p0 - vf / 2)], outline=(255, 255, 0, 200), width=2)
        dr.text((X(y0 - hf / 2) + 4, Y(p0 + vf / 2) + 4), f"view_hint {hf:.1f} deg", fill=(255, 255, 0, 255))
    hero = a.selftest_unit
    order = sorted(range(len(units)), key=lambda k: units[k].get("id") == hero)          # hero drawn last (on top)
    for k in order:
        u = units[k]
        b = u.get("box_world")
        if not (isinstance(b, list) and len(b) == 6):
            continue
        r = unit_on_frame(b, fr, a.edge_samples, prism, a.min_visible, a.keep_pole_bands)
        is_hero = u.get("id") == hero
        col = (255, 40, 40) if is_hero else COLOURS[k % len(COLOURS)]
        cy, cp = r["centre"]
        if "culled" in r:
            dr.text((X(cy) + 3, Y(cp)), f"{u.get('id')} x {r['culled'].split(' ')[0]}", fill=col + (150,))
            continue
        for part in r["parts"]:
            pts = [(X(x), Y(y)) for x, y in part]
            dr.polygon(pts, fill=col + (45 if is_hero else 18,))
            dr.line(pts + [pts[0]], fill=col + (255,), width=3 if is_hero else 1)
        dr.ellipse([X(cy) - 4, Y(cp) - 4, X(cy) + 4, Y(cp) + 4], fill=col + (255,))
        dr.text((X(cy) + 6, Y(cp) - 6), str(u.get("id")), fill=col + (255,))
    head = (f"{cam.get('segment')} frame {fr.get('frame')} (index {idx}) pos {[round(v, 2) for v in fr['pos']]} "
            f"yaw {fr.get('yaw_deg_from_plus_y_cw')} | {note if bg else 'blank grid: ' + note}")
    dr.rectangle([0, H - 18, W, H], fill=(0, 0, 0, 180))
    dr.text((6, H - 15), head, fill=(255, 255, 255, 255))
    path = os.path.join(out_dir, f"debug-{idx:04d}.png")
    im.save(path)
    if vh:                                                                             # 2x crop of the director's framing
        y0, p0, hf, vf = vh
        crop = im.crop((int(X(y0 - hf / 2)), int(Y(p0 + vf / 2)), int(X(y0 + hf / 2)), int(Y(p0 - vf / 2))))
        crop.resize((crop.width * 2, crop.height * 2), Image.LANCZOS).save(os.path.join(out_dir, f"debug-{idx:04d}-view.png"))
    hr = next((u for u in units if u.get("id") == hero), None)
    if hr and isinstance(hr.get("box_world"), list):                                    # 3x crop around the hero unit
        rr = unit_on_frame(hr["box_world"], fr, a.edge_samples, prism, a.min_visible, a.keep_pole_bands)
        cy, cp = rr["centre"]
        half = 10.0
        d2 = ImageDraw.Draw(clean, "RGBA")
        for part in rr.get("parts", []):
            pts = [(X(x), Y(y)) for x, y in part]
            d2.line(pts + [pts[0]], fill=(255, 40, 40, 255), width=2)
        d2.ellipse([X(cy) - 3, Y(cp) - 3, X(cy) + 3, Y(cp) + 3], outline=(255, 40, 40, 255))
        crop = clean.crop((int(X(cy - half)), int(Y(cp + half / 2)), int(X(cy + half)), int(Y(cp - half / 2))))
        crop.resize((crop.width * 3, crop.height * 3), Image.LANCZOS).save(os.path.join(out_dir, f"debug-{idx:04d}-{hero}.png"))
    log(f"[debug] {path} (+ -view.png, -{hero}.png): {note if bg else 'blank grid; ' + note}")
    return path


# ------------------------------------------------------------------------------------------------ selftest
def level_matrix(pos, yaw):
    """camera-to-world of a level camera heading at plan bearing yaw (render_segments.py's; used for the fixtures only)"""
    s, c = math.sin(math.radians(yaw)), math.cos(math.radians(yaw))
    return np.array([[c, 0.0, -s, pos[0]], [-s, 0.0, -c, pos[1]], [0.0, 1.0, 0.0, pos[2]], [0.0, 0.0, 0.0, 1.0]])


def expected_level(fr, p):
    """independent of matrix_world: card 17's bearing formula on the frame's pos + yaw (a level camera)"""
    pos = fr["pos"]
    dx, dy, dz = p[0] - pos[0], p[1] - pos[1], p[2] - pos[2]
    yaw = float(wrap180(math.degrees(math.atan2(dx, dy)) - fr["yaw_deg_from_plus_y_cw"]))
    pitch = math.degrees(math.atan2(dz, math.hypot(dx, dy)))
    return 0.5 + yaw / 360.0, 0.5 - pitch / 180.0


def ang(du, dv):
    du = (du + 0.5) % 1.0 - 0.5
    return math.hypot(du * 360.0, dv * 180.0)


def world2equi_crosscheck(fr, units_path):
    """habait-98's world2equi.py (read-only; run as a subprocess because it parses argv at import) on this frame's pose"""
    if not os.path.exists(WORLD2EQUI):
        return None, f"SKIP (not found: {WORLD2EQUI})"
    pos, d = fr["pos"], fr["look_dir"]
    faces = {"shot": "card19-selftest", "pos": pos, "centre_look": [pos[0] + 10 * d[0], pos[1] + 10 * d[1], pos[2]]}
    with tempfile.TemporaryDirectory() as td:
        fj = os.path.join(td, "faces.json")
        with open(fj, "w", encoding="utf-8") as f:
            json.dump(faces, f)
        r = subprocess.run([sys.executable, "-I", "-B", WORLD2EQUI, "--faces", fj, "--units", units_path],
                           capture_output=True, text=True, encoding="utf-8")
    if r.returncode != 0:
        return None, f"FAIL (world2equi exit {r.returncode}: {r.stderr.strip()[:200]})"
    return {u["id"]: u for u in json.loads(r.stdout)["units"] if "u" in u}, "ok"


def selftest(a, cam, units):
    res = []

    def ok(name, cond, detail):
        res.append((name, bool(cond), detail))

    fr = cam["frames"][0]
    hero = next((u for u in units if u.get("id") == a.selftest_unit), None) or \
        next((u for u in units if "846" in str(u.get("id"))), None)
    if hero is None:
        ok("hero unit present", False, f"{a.selftest_unit} not in units")
    else:
        b = hero["box_world"]
        c = [(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2]
        lon, lat = project(np.array([c]), fr["matrix_world"])
        u, v = lonlat_to_uv(lon[0], lat[0])
        ue, ve = expected_level(fr, c)
        err = ang(u - ue, v - ve)
        line = (f"unit {hero['id']} center projects to (u,v) ({u:.5f}, {v:.5f}) vs expected ({ue:.5f}, {ve:.5f}) "
                f"[{err:.4f} deg] {'within' if err <= TOL_DEG else 'NOT within'} {TOL_DEG}deg of expected")
        print(f"selftest: {line}", flush=True)
        ok("846 centre: matrix_world path vs the bearing formula (frame 0)", err <= TOL_DEG, line)
        vh = view_hint_box(fr)
        yaw = (u - 0.5) * 360
        ok("846 centre lies inside the director's framing on frame 0", vh is not None and abs(float(wrap180(yaw - vh[0]))) <= vh[2] / 2,
           f"yaw {yaw:+.2f} deg, pitch {(0.5 - v) * 180:+.2f} deg; view_hint +-{(vh[2] / 2) if vh else 0:.2f} deg")
        bad = ang((1 - u) - ue, v - ve)
        ok("known-bad: mirrored u (counter-clockwise) is caught", bad > TOL_DEG, f"misses by {bad:.2f} deg")
        for name, p in (("plan Y not flipped (Y = +y_cm/100)", [c[0], -c[1], c[2]]), ("one floor up (+3.2 m)", [c[0], c[1], c[2] + 3.2])):
            l2, t2 = project(np.array([p]), fr["matrix_world"])
            u2, v2 = lonlat_to_uv(l2[0], t2[0])
            ok(f"known-bad: {name} is caught", ang(u2 - ue, v2 - ve) > TOL_DEG, f"misses by {ang(u2 - ue, v2 - ve):.2f} deg")

    w2e, why = world2equi_crosscheck(fr, a.units)
    if w2e is None:
        if why.startswith("SKIP"):
            print(f"  [SKIP] world2equi.py cross-check: {why}", flush=True)
        else:
            ok("world2equi.py cross-check", False, why)
    else:
        worst_c, worst_e, n = 0.0, 0.0, 0
        for un in units:
            b = un.get("box_world")
            if un.get("id") not in w2e or not b:
                continue
            ref = w2e[un["id"]]
            c = [(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2]
            lon, lat = project(np.array([c]), fr["matrix_world"])
            u, v = lonlat_to_uv(lon[0], lat[0])
            worst_c = max(worst_c, ang(u - ref["u"], v - ref["v"]))
            if not ref.get("wraps_seam"):
                l8, t8 = project(box_corners(b), fr["matrix_world"])
                u8, v8 = lonlat_to_uv(l8, t8)
                worst_e = max(worst_e, abs(u8.min() - ref["u_min"]) * 360, abs(u8.max() - ref["u_max"]) * 360,
                              abs(v8.min() - ref["v_min"]) * 180, abs(v8.max() - ref["v_max"]) * 180)
            n += 1
        ok("world2equi.py cross-check (habait-98's, read-only, frame 0)", n > 0 and worst_c <= 0.05 and worst_e <= 0.05,
           f"{n} units: worst centre {worst_c:.4f} deg, worst 8-corner extent {worst_e:.4f} deg (world2equi rounds to 1e-4)")

    fx = json.load(open(os.path.join(FIXTURES, "synthetic.json"), encoding="utf-8"))
    M = level_matrix(fx["camera"]["pos"], fx["camera"]["yaw"])
    for p in fx["probes"]:
        lon, lat = project(np.array([p["point"]]), M)
        u, _ = lonlat_to_uv(lon[0], lat[0])
        ok(f"convention probe '{p['name']}'", abs(((u - p["u"]) + 0.5) % 1 - 0.5) * 360 <= 0.1, f"u {u:.4f} want {p['u']}")
    frx = {"matrix_world": M.tolist()}
    prism = Prism(fx["occluder"]["polygon_world"], *fx["occluder"]["z"])
    for case in fx["boxes"]:
        r = unit_on_frame(case["box"], frx, 4, prism if case.get("occluder") else None, 0.10, bool(case.get("keep_pole")))
        want = case["want"]
        parts = r.get("parts", [])
        if want == "split":
            spans = [max(x for x, _ in pp) - min(x for x, _ in pp) for pp in parts]
            good = "culled" not in r and len(parts) == 2 and all(s < 180 for s in spans) and \
                all(-180 <= x <= 180 for pp in parts for x, _ in pp)
            ok(f"seam: {case['name']}", good, f"{len(parts)} parts, widths {[round(float(s), 2) for s in spans]} deg")
        elif want == "single":
            ok(f"no split: {case['name']}", "culled" not in r and len(parts) == 1, f"{len(parts)} part(s)")
        elif want == "visible":
            ok(f"occlusion: {case['name']}", "culled" not in r, f"visible_frac {r.get('visible_frac')}")
        else:
            ok(f"cull: {case['name']}", str(r.get("culled", "")).startswith(want) or r.get("pole") == want,
               f"culled={r.get('culled')} pole={r.get('pole')}")
    for name, good, detail in res:
        print(f"  [{'PASS' if good else 'FAIL'}] {name}: {detail}", flush=True)
    nfail = sum(1 for _, g, _ in res if not g)
    print(f"selftest: {len(res) - nfail}/{len(res)} pass", flush=True)
    return nfail == 0


# ------------------------------------------------------------------------------------------------ CLI
def main():
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    p.add_argument("--units", required=True)
    p.add_argument("--camera", required=True, help="a segment camera.json (Studio {'frames': [...]} form, card 17)")
    p.add_argument("--out", default="", help="default: Habait/flyover/equirect/_local/segments/<segment>/hotspots.json")
    p.add_argument("--segment", default="", help="default: camera.json 'segment'")
    p.add_argument("--occluder", default="", help="floor-plate polygon json (polygon_world m, or polygon_cm plan cm +y down)")
    p.add_argument("--occluder-z", default="", help="z_ground,z_top in plan-world m, or a tower-mass.json")
    p.add_argument("--min-visible", type=float, default=0.10)
    p.add_argument("--edge-samples", type=int, default=4)
    p.add_argument("--stride", type=int, default=1, help="one hotspot every N frames (t_end covers the N frames)")
    p.add_argument("--debug", default="", help="0-based frame indices for debug PNGs, e.g. 0,36")
    p.add_argument("--bg", default="", help="an equirect to draw on (with --bg-pose <faces.json>)")
    p.add_argument("--bg-pose", default="")
    p.add_argument("--keep-pole-bands", action="store_true",
                   help="keep a unit straight above/below the camera as a band to the pole (default: cull, it would eat every click)")
    p.add_argument("--selftest", action="store_true")
    p.add_argument("--selftest-unit", default="apt846")
    a = p.parse_args()
    for k in ("units", "camera", "out", "occluder", "bg", "bg_pose"):
        if getattr(a, k):
            setattr(a, k, os.path.abspath(getattr(a, k)))
    if a.occluder_z and a.occluder_z.lower().endswith(".json"):
        a.occluder_z = os.path.abspath(a.occluder_z)
    studio = os.path.join(REPO, "Habait", "studio", "_local", "projects")
    a.bg_search = []
    if os.path.isdir(studio):
        for prj in sorted(os.listdir(studio)):
            r = os.path.join(studio, prj, "renders")
            a.bg_search.append((os.path.join(r, "clay-pano-ortho"), os.path.join(r, "clay-nodes-ortho")))
    prism = load_occluder(a.occluder, a.occluder_z) if a.occluder else None
    out, cam, units = run(a, prism)
    for s in [s for s in a.debug.split(",") if s.strip()]:
        draw_debug(os.path.dirname(out), int(s), cam, units, a, prism)
    if a.selftest:
        sys.exit(0 if selftest(a, cam, units) else 1)


if __name__ == "__main__":
    main()
