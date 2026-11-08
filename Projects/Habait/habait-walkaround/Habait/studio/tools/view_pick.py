"""view_pick.py: the best camera heading at each camera point, read from the REAL geometry (a 360 depth pano per
camera point), not from the plan. The plan cannot see door leaves, furniture, curtains or how close the glazing is;
a depth pano does.

  python -I tools/view_pick.py --renders <dir with cp-*/depth.png + pano.render.json> --plan derived/plan.json
         --out derived/views.json [--fov-mm 24] [--sheet views.png]

Depth pano contract (360walkaround pipeline/render_pano.py 0.3): equirect 2:1, u = 0.5 is the camera's forward
(its yaw_deg), u grows to the right, row 0 = top; depth = (R<<16 | G<<8 | B) / 100 metres, radial, 0 = invalid.

Score of a heading = mean log depth over the 16:9 frame (depth clipped to 0.4..12 m), minus a penalty for the share
of the frame nearer than 0.9 m (a wall or a door leaf in your face), minus a smaller one for the share nearer than
1.6 m in the frame's middle third (the subject should not be a blank surface). The output keeps every heading's
score so the planner can apply its own constraints (e.g. the living room keeps its arrival line).
"""
import argparse
import glob
import json
import math
import os

import cv2
import numpy as np


def load_depth(path):
    im = cv2.imdecode(np.fromfile(path, np.uint8), cv2.IMREAD_UNCHANGED)
    b, g, r = im[..., 0].astype(np.uint32), im[..., 1].astype(np.uint32), im[..., 2].astype(np.uint32)
    d = ((r << 16) | (g << 8) | b).astype(np.float32) / 100.0
    d[d <= 0] = np.nan
    return d


def frame_mask(h, w, yaw_rel, pitch, fov_h, fov_v):
    """Equirect pixels inside a perspective frame centred on (yaw_rel, pitch): exact per-pixel test."""
    lon = ((np.arange(w) + 0.5) / w - 0.5) * 2 * math.pi            # 0 = forward, + right
    lat = (0.5 - (np.arange(h) + 0.5) / h) * math.pi                  # + up
    LON, LAT = np.meshgrid(lon, lat)
    x, y, z = np.cos(LAT) * np.sin(LON), np.sin(LAT), np.cos(LAT) * np.cos(LON)
    ya, pa = math.radians(yaw_rel), math.radians(pitch)
    # rotate the ray into the camera frame: yaw about y, then pitch about x
    x1 = x * math.cos(ya) - z * math.sin(ya)
    z1 = x * math.sin(ya) + z * math.cos(ya)
    y2 = y * math.cos(pa) - z1 * math.sin(pa)
    z2 = y * math.sin(pa) + z1 * math.cos(pa)
    with np.errstate(divide="ignore", invalid="ignore"):
        u, v = x1 / z2, y2 / z2
    th, tv = math.tan(math.radians(fov_h / 2)), math.tan(math.radians(fov_v / 2))
    inside = (z2 > 0) & (np.abs(u) <= th) & (np.abs(v) <= tv)
    middle = inside & (np.abs(u) <= th / 3) & (np.abs(v) <= tv / 2)
    return inside, middle


def ray_hit(o, d, edges):
    best = None
    for a, b in edges:
        ex, ey = b[0] - a[0], b[1] - a[1]
        den = d[0] * ey - d[1] * ex
        if abs(den) < 1e-9:
            continue
        t = ((a[0] - o[0]) * ey - (a[1] - o[1]) * ex) / den
        u = ((a[0] - o[0]) * d[1] - (a[1] - o[1]) * d[0]) / den
        if t > 1 and 0 <= u <= 1 and (best is None or t < best):
            best = t
    return best


def poly_edges(polys):
    return [(p[i], p[(i + 1) % len(p)]) for p in polys for i in range(len(p))]


def window_share(o, yaw_deg, fov_h, walls, panes, n=9):
    """Share of the frame's horizontal rays that reach a facade pane before a wall (plan, 2-D)."""
    k = 0
    for i in range(n):
        b = math.radians(yaw_deg + (i / (n - 1) - 0.5) * fov_h)
        d = (math.sin(b), -math.cos(b))
        g, w = ray_hit(o, d, panes), ray_hit(o, d, walls)
        if g is not None and (w is None or g <= w + 5):
            k += 1
    return k / n


def score_view(d, inside, middle, cap=12.0):
    dd = d[inside]
    dd = dd[np.isfinite(dd)]
    if dd.size == 0:
        return -99.0, {}
    # depth counts only up to the room's own size: a view out through a door is not a view of the room
    depth = float(np.mean(np.log(np.clip(dd, 0.4, cap))))
    near = float(np.mean(dd < 0.9))
    dm = d[middle]
    dm = dm[np.isfinite(dm)]
    mid_near = float(np.mean(dm < 1.6)) if dm.size else 0.0
    return depth - 3.0 * near - 1.0 * mid_near, {"mean_log_depth": round(depth, 3), "near_0_9": round(near, 3), "mid_near_1_6": round(mid_near, 3), "median_m": round(float(np.median(dd)), 2)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--renders", required=True)
    ap.add_argument("--plan", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--fov-mm", type=float, default=24.0)
    ap.add_argument("--pitch", type=float, default=-1.4)
    ap.add_argument("--step", type=float, default=5.0)
    ap.add_argument("--sheet", default=None)
    a = ap.parse_args()
    plan = json.load(open(a.plan, encoding="utf-8"))
    fov_h = 2 * math.degrees(math.atan(18.0 / a.fov_mm))
    fov_v = 2 * math.degrees(math.atan(math.tan(math.radians(fov_h / 2)) * 9 / 16))
    out = {"schema": "habait-studio/views.v1", "fov_h_deg": round(fov_h, 2), "pitch_deg": a.pitch, "points": {}}
    tiles = []
    walls = poly_edges([w_["polygon_cm"] for w_ in plan.get("walls", []) if w_.get("polygon_cm")])
    panes = poly_edges([p_["polygon_cm"] for p_ in plan.get("panes", []) if p_.get("polygon_cm")])
    for cp in plan.get("camera_points", []):
        dpath = os.path.join(a.renders, cp["id"], "depth.png")
        if not os.path.exists(dpath):
            continue
        d = load_depth(dpath)
        small = cv2.resize(np.nan_to_num(d, nan=0.0), (512, 256), interpolation=cv2.INTER_NEAREST)
        small[small <= 0] = np.nan
        h, w = small.shape
        room = next((r for r in plan.get("rooms", []) if r.get("id") == cp.get("room_id")), {})
        outdoor = bool(room.get("is_outdoor"))
        o = (cp["x"], cp["y"])
        cap = 12.0 if outdoor or not room.get("loop") else max(math.dist(o, q) for q in room["loop"]) / 100.0 + 0.5
        rows = []
        for k in range(int(360 / a.step)):
            yr = -180 + k * a.step
            yaw = (cp.get("yaw_deg", 0) + yr) % 360
            inside, middle = frame_mask(h, w, yr, a.pitch, fov_h, fov_v)
            sc, parts = score_view(small, inside, middle, cap)
            win = 0.0 if outdoor else window_share(o, yaw, fov_h, walls, panes)
            sc += 0.6 * win
            rows.append({"yaw_rel_deg": yr, "yaw_deg": round(yaw, 1), "score": round(sc, 3), "window_share": round(win, 2), "depth_cap_m": round(cap, 2), **parts})
        best = max(rows, key=lambda r: r["score"])
        out["points"][cp["id"]] = {"best": best, "pano_yaw_deg": cp.get("yaw_deg", 0), "scores": rows}
        print(f"{cp['id']:20s} best yaw {best['yaw_deg']:6.1f} (rel {best['yaw_rel_deg']:+6.1f}) score {best['score']:.2f} median {best.get('median_m')} m window {best['window_share']} cap {best['depth_cap_m']}")
        if a.sheet:
            vis = np.clip(np.nan_to_num(small, nan=0) / 8.0, 0, 1)
            vis = cv2.cvtColor((vis * 255).astype(np.uint8), cv2.COLOR_GRAY2BGR)
            inside, _ = frame_mask(h, w, best["yaw_rel_deg"], a.pitch, fov_h, fov_v)
            vis[inside] = (0.6 * vis[inside] + 0.4 * np.array([0, 200, 255])).astype(np.uint8)
            cv2.putText(vis, cp["id"], (4, 14), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 255, 0), 1)
            tiles.append(vis)
    json.dump(out, open(a.out, "w", encoding="utf-8"), indent=1)
    if a.sheet and tiles:
        while len(tiles) % 3:
            tiles.append(np.zeros_like(tiles[0]))
        rows_img = [np.hstack(tiles[i:i + 3]) for i in range(0, len(tiles), 3)]
        cv2.imencode(".png", np.vstack(rows_img))[1].tofile(a.sheet)


if __name__ == "__main__":
    main()
