"""stitch_depth.py - per-node equirect DEPTH (ray distance, metres) from the six depthcm cube faces, with EXACTLY the
mapping of tools/cube2equi.py (centre u=0.5 faces centre_look, u clockwise from above, v 0 = zenith). Also downsizes the
RGB pano to the same width and writes nodes.json for the three.js viewer.

  python -X utf8 -I stitch_depth.py --project <apt846 project dir> --out data/ [--width 2048] [--node node-c-facade ...]

Outputs per node: data/<node>.jpg (RGB), data/<node>.depth.png (16-bit, metres * 100, 65535 = sky), data/nodes.json.
The RGB comes from renders/clay-pano/<node>.png unless --rgb-dir points elsewhere (e.g. the GPT-skinned nodes).
"""
import argparse
import json
import os

import cv2
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument("--project", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--width", type=int, default=2048)
ap.add_argument("--rgb-dir", default=None, help="dir with <node>.png skinned equirects (default renders/clay-pano)")
ap.add_argument("--node", action="append", default=None)
a = ap.parse_args()
nodes = a.node or ["node-a-aerial", "node-b-tower", "node-c-facade", "node-d-terrace"]
W = a.width
H = W // 2
os.makedirs(a.out, exist_ok=True)
rgb_dir = a.rgb_dir or os.path.join(a.project, "renders", "clay-pano")
out_nodes = []
for node in nodes:
    ndir = os.path.join(a.project, "renders", "clay-nodes-ortho", node)
    if not os.path.isdir(ndir):
        ndir = os.path.join(a.project, "renders", "clay-nodes", node)
    meta = json.load(open(os.path.join(ndir, "faces.json"), encoding="utf8"))
    pos = np.array(meta["pos"], dtype=np.float64)
    look = np.array(meta["centre_look"], dtype=np.float64)
    c = look - pos; c[2] = 0.0; c = c / (np.linalg.norm(c) or 1.0)
    r = np.array([c[1], -c[0], 0.0]); Z = np.array([0.0, 0.0, 1.0])
    u = (np.arange(W) + 0.5) / W; v = (np.arange(H) + 0.5) / H
    lon = (u - 0.5) * 2 * np.pi; lat = (0.5 - v) * np.pi
    LON, LAT = np.meshgrid(lon, lat)
    d = (np.cos(LAT)[..., None] * (np.cos(LON)[..., None] * c + np.sin(LON)[..., None] * r) + np.sin(LAT)[..., None] * Z)
    depth = np.full((H, W), np.inf, np.float64)
    best = np.full((H, W), -1.0)
    res = int(meta["face_res"])
    for face in meta["faces"]:
        M = np.array(face["matrix_world"], dtype=np.float64); R = M[:3, :3]
        local = d @ R
        fwd = -local[..., 2]
        sel = (fwd > 1e-6) & (fwd > best)
        x = local[..., 0] / np.where(fwd > 1e-6, fwd, 1.0)
        y = local[..., 1] / np.where(fwd > 1e-6, fwd, 1.0)
        inside = sel & (np.abs(x) <= 1.0) & (np.abs(y) <= 1.0)
        mx = ((x + 1.0) * 0.5 * res - 0.5).astype(np.float32)
        my = ((1.0 - y) * 0.5 * res - 0.5).astype(np.float32)
        dcm = cv2.imread(os.path.join(ndir, f"depthcm_{face['frame']:04d}.png"), cv2.IMREAD_UNCHANGED)
        if dcm is None:
            raise SystemExit(f"missing depth face {node} {face['frame']}")
        if dcm.ndim == 3:
            dcm = dcm[..., 0]
        zm = dcm.astype(np.float32) / 100.0                          # planar depth along the face axis, metres
        zm[dcm >= 65535] = np.inf
        wz = cv2.remap(zm, mx, my, cv2.INTER_NEAREST, borderMode=cv2.BORDER_REPLICATE)
        ray = wz / np.maximum(fwd, 1e-6)                             # planar depth -> distance along the ray
        depth[inside] = ray[inside]
        best = np.where(inside, fwd, best)
    sky = ~np.isfinite(depth)
    dcm_out = np.where(sky, 65535, np.clip(depth * 100.0, 0, 65534)).astype(np.uint16)
    cv2.imwrite(os.path.join(a.out, f"{node}.depth.png"), dcm_out)
    fallback_dir = os.path.join(a.project, "renders", "clay-pano-ortho")
    cands = [os.path.join(d, f"{node}.{ext}") for d in (rgb_dir, fallback_dir) for ext in ("webp", "png", "jpg")]
    rgb_src = next((c for c in cands if os.path.exists(c)), cands[1])
    rgb = cv2.imread(rgb_src)
    if rgb is None:
        raise SystemExit(f"missing rgb {rgb_src}")
    rgb = cv2.resize(rgb, (W, H), interpolation=cv2.INTER_AREA)
    cv2.imwrite(os.path.join(a.out, f"{node}.jpg"), rgb, [cv2.IMWRITE_JPEG_QUALITY, 90])
    finite = depth[np.isfinite(depth)]
    out_nodes.append({"id": node, "pos": pos.tolist(), "centre_dir": c.tolist(), "rgb": f"{node}.jpg", "depth": f"{node}.depth.png",
                      "depth_m_range": [float(finite.min()), float(finite.max())] if finite.size else None,
                      "sky_share": float(sky.mean())})
    print(f"{node}: depth {finite.min():.1f}..{finite.max():.1f} m, sky {sky.mean():.0%}, rgb {rgb_src}")
json.dump({"frame": "X east, Y north, Z up, metres (plan-world; unit floor z=0)", "width": W, "nodes": out_nodes,
           "hotspot_terrace": [14.85, -14.11, 2.02], "hotspot_look": [8.88, -10.66, 1.50]},
          open(os.path.join(a.out, "nodes.json"), "w", encoding="utf8"), indent=1)
print("nodes.json written")
