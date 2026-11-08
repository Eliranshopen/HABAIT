"""equi2faces.py - cut a GPT-skinned equirect (tour360 panos-ext/<node>.png) into the six cube faces whose cameras are in the
studio's faces.json (renders/clay-nodes-ortho/<node>/faces.json), so each face becomes an ordinary perspective projector
(lens 18 mm, sensor 36 mm, square) for project_skin.py. Inverse of studio/tools/cube2equi.py (same convention:
u = 0.5 faces centre_look on the horizon, u grows clockwise seen from above, v 0 = zenith).

  python -I equi2faces.py --node node-b-tower --equi <equirect.png> --faces <faces.json> --out panos/node-b-tower [--res 1024]
  prints the projector entries to append to a projectors json (also writes <out>/projectors.json)
"""
import argparse, json, os
import numpy as np
from PIL import Image
from scipy.ndimage import map_coordinates

ap = argparse.ArgumentParser()
ap.add_argument("--node", required=True)
ap.add_argument("--equi", required=True)
ap.add_argument("--faces", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--res", type=int, default=1024)
ap.add_argument("--yaw0-look", default=None)
a = ap.parse_args()
os.makedirs(a.out, exist_ok=True)

meta = json.load(open(a.faces, encoding="utf8"))
pos = np.array(meta["pos"], dtype=np.float64)
look = np.array([float(v) for v in a.yaw0_look.split(",")], dtype=np.float64) if a.yaw0_look else np.array(meta["centre_look"], dtype=np.float64)
c = look - pos
c[2] = 0.0
c /= np.linalg.norm(c)
r = np.array([c[1], -c[0], 0.0])  # c x Z, right when facing c
Z = np.array([0.0, 0.0, 1.0])

equi = np.asarray(Image.open(a.equi).convert("RGB"), dtype=np.float32)
H, W = equi.shape[:2]
N = a.res
f_over_sw = 18.0 / 36.0
# pixel centre -> camera-space direction (Blender camera: looks down -Z, +Y up, sensor fit horizontal, square)
px = (np.arange(N) + 0.5) / N
X, Y = np.meshgrid((px - 0.5) / f_over_sw, (0.5 - px) / f_over_sw)   # row 0 = top of image
dirs_cam = np.stack([X, Y, -np.ones_like(X)], axis=-1)

projectors = []
for face in meta["faces"]:
    M = np.array(face["matrix_world"], dtype=np.float64)
    R = M[:3, :3]
    d = dirs_cam @ R.T                                  # world direction per pixel
    d /= np.linalg.norm(d, axis=-1, keepdims=True)
    lon = np.arctan2(d @ r, d @ c)
    lat = np.arcsin(np.clip(d @ Z, -1, 1))
    u = 0.5 + lon / (2 * np.pi)
    v = 0.5 - lat / np.pi
    col = (u * W - 0.5) % W
    row = np.clip(v * H - 0.5, 0, H - 1)
    out = np.stack([map_coordinates(equi[..., k], [row, col], order=1, mode="wrap") for k in range(3)], axis=-1)
    name = f"face_{face['name']}.png"
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(os.path.join(a.out, name))
    projectors.append({"name": f"{a.node}-{face['name']}", "group": a.node, "image": os.path.abspath(os.path.join(a.out, name)).replace("\\", "/"),
                       "matrix_world": face["matrix_world"], "lens_mm": 18.0, "sensor_mm": 36.0, "res": [N, N]})
    print("wrote", name)
with open(os.path.join(a.out, "projectors.json"), "w", encoding="utf-8") as f:
    json.dump({"source_equirect": a.equi, "faces_json": a.faces, "projectors": projectors}, f, indent=1)
print("projectors ->", os.path.join(a.out, "projectors.json"))
