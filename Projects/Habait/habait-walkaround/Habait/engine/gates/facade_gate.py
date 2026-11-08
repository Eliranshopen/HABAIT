#!/usr/bin/env python
"""facade_gate.py - is the tower in a rendered / skinned exterior frame where the traced mass says it is? ($0)

Engine gate A6 (board habait-workplan-2026-11-02, card 05). Generic: a building footprint (plan cm or world m),
floor heights from project.json, and the camera the frame was rendered from. Nothing is global: the mass is projected
through the camera into two CLASSES of expected edges, and each class is scored only on its own pixels:

  silhouette  the left/right outline of the projected prism (footprint extruded ground -> roof); expected edges run
              along the outline, so an image edge counts only if its gradient is within 30 deg of the outline normal.
  slabs       every floor level's footprint edges that face the camera and are not hidden by a nearer face
              (painter's id buffer); expected gradient within 30 deg of the slab line's normal.

A sample is "kept" if an oriented Canny edge lies within r px, r = f_px * tol_m / depth (default tol 1.5 m: how far
a slab edge may stand off the traced plate; the Rainbow mass waves 1.4 m). score = min(silhouette kept, slabs kept).
peak: the same samples displaced sideways by 20/30/40 px must score LOWER than in place (margin >= 0), because on a
dense facade edges match almost anywhere inside the tower. PASS = score >= 0.6 (the openings_gate kept convention)
AND peak margin >= 0. Colour change or noise passes; a tower moved sideways by ~2 deg of yaw (~30 px at
960 px / 32 mm) fails. BLIND SPOT (measured, selftest): a 2 deg pitch or roll, i.e. a vertical shift or a tilt of
<= 9 px, is NOT detected: slab bands repeat every few px and the sides are vertical. Catching it needs a top-of-
tower class, which needs the roof/crown height in project.json (not there today: a proposal to the schema owner).
Clay renders (untextured) are weaker than skinned frames (az+60 clay scores 0.235): the gate targets skinned frames.

Camera (the Blender convention of Habait/flyover/project_skin.py): pos + look in the plan world
(X = x_cm/100, Y = -y_cm/100, Z up, the reference floor at Z 0), lens_mm, sensor_mm (fit HORIZONTAL), no roll,
principal point at the centre; the intrinsics scale to the image size. --camera accepts a projectors.json
{"projectors":[...]} or a views.json {"views":[...]} (pick with --name; default: a view named like the image's
"<name>__" prefix, else the first entry).

Floors: --project project.json (building.floor_to_floor_cm, floors_total, ground_floor_index; the reference floor at
Z 0 = units[0].floor, or --ref-floor), or --ftf-m/--ground-floor/--top-floor/--ref-floor.

Usage:
  python facade_gate.py <frame.png> --camera projectors.json --footprint tower-footprint.json --project project.json
        [--name approach] [--out result.json] [--overlay overlay.png]
  python facade_gate.py --make-bad <frame.png> ... --yaw-deg 2 --out bad.png      # rotate the camera 2 deg (homography)
  python facade_gate.py --selftest <frame.png> ...    # colour/noise must PASS, yaw/roll 2 deg must FAIL
Exit: 0 PASS, 1 FAIL, 2 usage / input error.
"""
import argparse
import json
import math
import os
import sys

import cv2
import numpy as np

KEPT_MIN = 0.6
ORIENT_DEG = 30.0
TOL_M = 1.5
PEAK_SHIFTS = (-40, -30, -20, 20, 30, 40)


def load(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)


# ---------------------------------------------------------------- camera
class Cam:
    def __init__(self, pos, look, lens_mm, sensor_mm, w, h):
        self.C = np.array(pos, float)
        fwd = np.array(look, float) - self.C
        self.fwd = fwd / np.linalg.norm(fwd)
        r = np.cross(self.fwd, [0, 0, 1.0])
        self.right = r / np.linalg.norm(r)
        self.up = np.cross(self.right, self.fwd)
        self.f = lens_mm / sensor_mm * w          # sensor_fit HORIZONTAL
        self.w, self.h = w, h
        self.cx, self.cy = w / 2.0, h / 2.0

    def project(self, P):
        P = np.atleast_2d(np.asarray(P, float)) - self.C
        x, y, z = P @ self.right, P @ self.up, P @ self.fwd
        z = np.where(z <= 1e-6, np.nan, z)
        return np.stack([self.cx + self.f * x / z, self.cy - self.f * y / z], 1), z

    def K(self):
        return np.array([[self.f, 0, self.cx], [0, self.f, self.cy], [0, 0, 1.0]])


def pick_camera(path, name, image_path, w, h):
    d = load(path)
    lst = (d.get("projectors") or []) + (d.get("views") or [])      # a views.json carries both
    if not lst:
        raise SystemExit(f"facade_gate: {path} has neither 'projectors' nor 'views' (a camera.json 'frames' list is not "
                         "supported: it needs pos + look + lens_mm per frame)")
    if not name:
        pre = os.path.basename(image_path).split("__")[0]
        name = pre if any(v.get("name") == pre for v in lst) else None
    v = next((v for v in lst if v.get("name") == name), None) if name else lst[0]
    if v is None:
        raise SystemExit(f"facade_gate: no camera named {name!r} in {path}")
    missing = [k for k in ("pos", "look", "lens_mm") if k not in v]
    if missing:
        raise SystemExit(f"facade_gate: camera {v.get('name')!r} lacks {missing}")
    return v, Cam(v["pos"], v["look"], float(v["lens_mm"]), float(v.get("sensor_mm", 36.0)), w, h)


# ---------------------------------------------------------------- geometry
def footprint_m(path):
    d = load(path)
    src = d.get("tower_footprint", d)
    if src.get("polygon_m"):
        poly = np.array(src["polygon_m"], float)
    else:
        poly = np.array([[x / 100.0, -y / 100.0] for x, y in src["polygon_cm"]], float)
    a = 0.5 * np.sum(poly[:, 0] * np.roll(poly[:, 1], -1) - np.roll(poly[:, 0], -1) * poly[:, 1])
    return poly if a > 0 else poly[::-1]     # ccw in X/Y (Z up): outward normal = (dy, -dx)


def floors(a):
    ftf, g, top, ref = a.ftf_m, a.ground_floor, a.top_floor, a.ref_floor
    if a.project:
        p = load(a.project)
        b = p.get("building", {})
        ftf = ftf or b.get("floor_to_floor_cm", 0) / 100.0 or None
        g = g if g is not None else b.get("ground_floor_index", 0)
        top = top if top is not None else b.get("floors_total")
        if ref is None and p.get("units"):
            ref = p["units"][0].get("floor")
    if None in (ftf, g, top, ref):
        raise SystemExit("facade_gate: floor heights unknown: pass --project or --ftf-m --ground-floor --top-floor --ref-floor")
    return [(f - ref) * ftf for f in range(g, top + 1)]       # slab levels; the last one is the roof


def expected(cam, poly, zs):
    """id buffer of the visible side faces, silhouette samples, slab samples (u, v, nx, ny, depth)."""
    H, W = cam.h, cam.w
    n = len(poly)
    z0, z1 = zs[0], zs[-1]
    faces = []
    for i in range(n):
        a, b = poly[i], poly[(i + 1) % n]
        quad = np.array([[*a, z0], [*b, z0], [*b, z1], [*a, z1]])
        uv, dep = cam.project(quad)
        if np.isnan(dep).any():
            continue
        dist = np.linalg.norm(quad.mean(0) - cam.C)
        nout = np.array([b[1] - a[1], -(b[0] - a[0]), 0.0])
        facing = float(np.dot(nout, cam.C - quad.mean(0))) > 0
        faces.append((dist, i, uv, facing))
    idbuf = np.zeros((H, W), np.int32)
    mask = np.zeros((H, W), np.uint8)
    for dist, i, uv, facing in sorted(faces, key=lambda t: -t[0]):
        pts = np.round(uv).astype(np.int32)
        cv2.fillPoly(mask, [pts], 255)
        cv2.fillPoly(idbuf, [pts], i + 1 if facing else -1)
    roof_uv, _ = cam.project(np.c_[poly, np.full(n, z1)])
    cv2.fillPoly(mask, [np.round(roof_uv).astype(np.int32)], 255)
    cv2.fillPoly(idbuf, [np.round(roof_uv).astype(np.int32)], -2)

    # silhouette: per row, the outermost mask pixels; skip the roof band and rows touching the frame edge
    sil = []
    rows = np.where(mask.any(1))[0]
    if len(rows):
        top_row, bot_row = rows.min(), rows.max()
        band = max(3, int(0.03 * (bot_row - top_row)))
        cols_l, cols_r = {}, {}
        for r in range(top_row + band, bot_row + 1):
            c = np.where(mask[r])[0]
            if len(c) == 0 or r >= H - 2:
                continue
            if c.min() > 1:
                cols_l[r] = c.min()
            if c.max() < W - 2:
                cols_r[r] = c.max()
        for cols in (cols_l, cols_r):
            rs = sorted(cols)
            for k, r in enumerate(rs):
                ra, rb = rs[max(0, k - 3)], rs[min(len(rs) - 1, k + 3)]
                du, dv = cols[rb] - cols[ra], rb - ra
                L = math.hypot(du, dv) or 1.0
                nx, ny = dv / L, -du / L              # normal of the outline direction
                P = np.array([[cols[r], r]], float)
                sil.append((cols[r], r, nx, ny))
    # depth for the silhouette: the tower centre's depth is good enough for r
    ctr = np.r_[poly.mean(0), 0.5 * (z0 + z1)]
    _, dc = cam.project(ctr)
    sil = [(u, v, nx, ny, float(dc[0])) for u, v, nx, ny in sil]

    slabs = []
    for z in zs:
        for i in range(n):
            a, b = poly[i], poly[(i + 1) % n]
            nout = np.array([b[1] - a[1], -(b[0] - a[0]), 0.0])
            mid = np.r_[(a + b) / 2, z]
            if float(np.dot(nout, cam.C - mid)) <= 0:
                continue
            seg = np.array([[*a, z], [*b, z]])
            uv, dep = cam.project(seg)
            if np.isnan(dep).any():
                continue
            L = float(np.linalg.norm(uv[1] - uv[0]))
            if L < 3:
                continue
            d = (uv[1] - uv[0]) / L
            nx, ny = -d[1], d[0]
            for t in np.arange(1.0, L - 1.0, 2.0) / L:
                u, v = uv[0] + (uv[1] - uv[0]) * t
                iu, iv = int(round(u)), int(round(v))
                if not (2 <= iu < W - 2 and 2 <= iv < H - 2):
                    continue
                # visible if this face owns the pixel just below or above the slab line (the face is below/above it)
                own = idbuf[max(0, iv - 2):iv + 3, max(0, iu - 1):iu + 2]
                if (own == i + 1).any():
                    slabs.append((u, v, nx, ny, float(dep[0] + (dep[1] - dep[0]) * t)))
    return mask, idbuf, np.array(sil, float).reshape(-1, 5), np.array(slabs, float).reshape(-1, 5)


# ---------------------------------------------------------------- image edges
def edges(img):
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img
    g = cv2.GaussianBlur(g, (3, 3), 0)
    gx = cv2.Sobel(g, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(g, cv2.CV_32F, 0, 1, ksize=3)
    mag = np.hypot(gx, gy) + 1e-6
    # scale-invariant thresholds (a brightness change scales every gradient alike): the 90th percentile of |grad|
    hi = float(max(20.0, np.percentile(mag, 90)))
    lo = 0.4 * hi
    E = cv2.Canny(g, lo, hi, L2gradient=True) > 0
    lo, hi = round(lo, 1), round(hi, 1)
    return E, gx / mag, gy / mag, (lo, hi)


def kept(samples, E, ux, uy, f, tol_m):
    if len(samples) == 0:
        return None, 0
    H, W = E.shape
    cmin = math.cos(math.radians(ORIENT_DEG))
    ok = 0
    for u, v, nx, ny, dep in samples:
        r = max(2, int(math.ceil(f * tol_m / max(dep, 1.0))))
        iu, iv = int(round(u)), int(round(v))
        y0, y1, x0, x1 = max(0, iv - r), min(H, iv + r + 1), max(0, iu - r), min(W, iu + r + 1)
        e = E[y0:y1, x0:x1]
        if not e.any():
            continue
        c = np.abs(ux[y0:y1, x0:x1] * nx + uy[y0:y1, x0:x1] * ny)
        if (e & (c >= cmin)).any():
            ok += 1
    return ok / len(samples), len(samples)


def shifted(a, dx):
    b = a.copy()
    b[:, 0] += dx
    return b


def run(img, cam, poly, zs, tol_m):
    mask, idbuf, sil, slabs = expected(cam, poly, zs)
    E, ux, uy, th = edges(img)
    ks, ns = kept(sil, E, ux, uy, cam.f, tol_m)
    kl, nl = kept(slabs, E, ux, uy, cam.f, tol_m)
    parts = [k for k in (ks, kl) if k is not None]
    score = min(parts) if parts else 0.0
    # alignment peak: the projected pose must beat the same samples displaced sideways by PEAK_SHIFTS px (>= 4 r, so
    # each is a distinct alignment). Dense facades match edges almost anywhere inside the tower; a tower that moved
    # sideways scores higher displaced than in place. Vertical displacements are NOT tested: slab bands repeat every
    # few px and the sides are vertical, so a pure vertical shift is invisible to edge classes (see the selftest).
    alts = []
    for dx in PEAK_SHIFTS:
        a_, _ = kept(shifted(sil, dx), E, ux, uy, cam.f, tol_m)
        b_, _ = kept(shifted(slabs, dx), E, ux, uy, cam.f, tol_m)
        alts.append((min(x for x in (a_, b_) if x is not None) if parts else 0.0, dx))
    best_alt, best_dx = max(alts)
    margin = score - best_alt
    out = {"gate": "facade_gate", "version": 2, "score": round(score, 3),
           "pass": bool(parts) and score >= KEPT_MIN and margin >= 0,
           "peak": {"margin": round(margin, 3), "best_displaced": round(best_alt, 3), "at_dx_px": best_dx},
           "classes": {"silhouette": {"kept": None if ks is None else round(ks, 3), "samples": ns},
                       "slabs": {"kept": None if kl is None else round(kl, 3), "samples": nl}},
           "tower_px": int((mask > 0).sum()), "canny": th,
           "thresholds": {"kept_min": KEPT_MIN, "orient_deg": ORIENT_DEG, "tol_m": tol_m}}
    return out, (mask, sil, slabs, E)


def overlay(img, mask, sil, slabs, path):
    o = img.copy()
    cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    cv2.drawContours(o, cnts, -1, (255, 200, 0), 1)
    for u, v, *_ in slabs:
        cv2.circle(o, (int(u), int(v)), 0, (0, 0, 255), -1)
    for u, v, *_ in sil:
        cv2.circle(o, (int(u), int(v)), 1, (0, 255, 0), -1)
    cv2.imwrite(path, o)


def rotate(img, cam, yaw=0.0, roll=0.0, pitch=0.0):
    """the image a camera rotated by (yaw, pitch, roll) deg would see (pure rotation = homography K R K^-1)."""
    y, p, r = (math.radians(x) for x in (yaw, pitch, roll))
    Ry = np.array([[math.cos(y), 0, math.sin(y)], [0, 1, 0], [-math.sin(y), 0, math.cos(y)]])
    Rp = np.array([[1, 0, 0], [0, math.cos(p), -math.sin(p)], [0, math.sin(p), math.cos(p)]])
    Rr = np.array([[math.cos(r), -math.sin(r), 0], [math.sin(r), math.cos(r), 0], [0, 0, 1]])
    K = cam.K()
    Hm = K @ (Rr @ Rp @ Ry) @ np.linalg.inv(K)
    return cv2.warpPerspective(img, Hm, (img.shape[1], img.shape[0]), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("image")
    ap.add_argument("--camera", required=True)
    ap.add_argument("--footprint", required=True)
    ap.add_argument("--project")
    ap.add_argument("--name")
    ap.add_argument("--ftf-m", type=float)
    ap.add_argument("--ground-floor", type=int)
    ap.add_argument("--top-floor", type=int)
    ap.add_argument("--ref-floor", type=int)
    ap.add_argument("--tol-m", type=float, default=TOL_M)
    ap.add_argument("--out")
    ap.add_argument("--overlay")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--make-bad", action="store_true")
    ap.add_argument("--yaw-deg", type=float, default=0.0)
    ap.add_argument("--roll-deg", type=float, default=0.0)
    ap.add_argument("--pitch-deg", type=float, default=0.0)
    ap.add_argument("--selftest", action="store_true")
    a = ap.parse_args()
    img = cv2.imread(a.image, cv2.IMREAD_COLOR)
    if img is None:
        print(f"facade_gate: cannot read {a.image}", file=sys.stderr)
        return 2
    H, W = img.shape[:2]
    try:
        v, cam = pick_camera(a.camera, a.name, a.image, W, H)
        poly, zs = footprint_m(a.footprint), floors(a)
    except SystemExit as e:
        print(e, file=sys.stderr)
        return 2
    if a.make_bad:
        if not a.out:
            print("--make-bad needs --out", file=sys.stderr)
            return 2
        cv2.imwrite(a.out, rotate(img, cam, a.yaw_deg, a.roll_deg, a.pitch_deg))
        print(f"wrote {a.out}: camera rotated yaw {a.yaw_deg} pitch {a.pitch_deg} roll {a.roll_deg} deg")
        return 0
    if a.selftest:
        rng = np.random.default_rng(846)
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV).astype(np.int32)
        hsv[..., 0] = (hsv[..., 0] + 40) % 180
        hue = cv2.cvtColor(np.clip(hsv, 0, 255).astype(np.uint8), cv2.COLOR_HSV2BGR)
        cases = [("good", img, True),
                 ("hue+80deg", hue, True),
                 ("darker x0.7", np.clip(img * 0.7, 0, 255).astype(np.uint8), True),
                 ("noise s=6", np.clip(img + rng.normal(0, 6, img.shape), 0, 255).astype(np.uint8), True),
                 ("yaw +2", rotate(img, cam, yaw=2), False), ("yaw -2", rotate(img, cam, yaw=-2), False),
                 ("pitch +2", rotate(img, cam, pitch=2), None), ("roll +2", rotate(img, cam, roll=2), None)]
        ok_all = True
        for nm, im, want in cases:
            o, _ = run(im, cam, poly, zs, a.tol_m)
            good = want is None or o["pass"] == want
            ok_all &= good
            c = o["classes"]
            print(f"  {'ok ' if good else 'BAD'} {nm:<12} {'PASS' if o['pass'] else 'FAIL'} score={o['score']:.3f} "
                  f"silhouette={c['silhouette']['kept']} slabs={c['slabs']['kept']} peak_margin={o['peak']['margin']:+.3f} (want {'-- blind spot, reported' if want is None else ('PASS' if want else 'FAIL')})")
        print(f"selftest: {'PASS' if ok_all else 'FAIL'}")
        return 0 if ok_all else 1
    out, (mask, sil, slabs, E) = run(img, cam, poly, zs, a.tol_m)
    out["input"] = os.path.abspath(a.image)
    out["camera"] = {"file": os.path.abspath(a.camera), "name": v.get("name"), "pos": v["pos"], "look": v["look"],
                     "lens_mm": v["lens_mm"], "sensor_mm": v.get("sensor_mm", 36.0)}
    out["levels"] = {"n": len(zs), "z_first_m": round(zs[0], 2), "z_roof_m": round(zs[-1], 2)}
    if a.overlay:
        overlay(img, mask, sil, slabs, a.overlay)
        out["overlay"] = os.path.abspath(a.overlay)
    if a.out:
        os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
        with open(a.out, "w", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=False, indent=1)
    c = out["classes"]
    print(json.dumps(out, ensure_ascii=False, indent=1) if a.json else
          f"facade_gate: {'PASS' if out['pass'] else 'FAIL'}  score={out['score']:.3f}  silhouette={c['silhouette']['kept']} "
          f"({c['silhouette']['samples']})  slabs={c['slabs']['kept']} ({c['slabs']['samples']})  peak_margin={out['peak']['margin']:+.3f}  camera={v.get('name')}")
    return 0 if out["pass"] else 1


if __name__ == "__main__":
    sys.exit(main())
