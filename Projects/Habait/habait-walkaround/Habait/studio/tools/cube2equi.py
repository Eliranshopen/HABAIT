"""cube2equi.py — six 90-degree cube faces (render_shots.py, shot kind "pano") -> one equirectangular panorama (2026-11-02).
  python -X utf8 -I tools/cube2equi.py --dir renders/clay/<node> --out renders/clay-pano/<node>.png [--width 4096] [--yaw0-look x,y,z]
Reads <dir>/faces.json (each face's camera matrix_world, Blender camera: looks down local -Z, up +Y), writes the RGB equirect
(<out>) and the id pass (<out stem>.id.png, 16-bit, nearest) the same way. The image centre (u = 0.5) faces --yaw0-look (default:
faces.json centre_look) projected to the horizon; u grows clockwise seen from above (the tour's yaw), v 0 = zenith."""
import os, sys, json, argparse
import numpy as np
import cv2

ap = argparse.ArgumentParser()
ap.add_argument("--dir", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--width", type=int, default=4096)
ap.add_argument("--yaw0-look", default=None, help="x,y,z world point the panorama centre faces (default faces.json centre_look)")
a = ap.parse_args()

meta = json.load(open(os.path.join(a.dir, "faces.json"), encoding="utf8"))
W = a.width; H = W // 2
pos = np.array(meta["pos"], dtype=np.float64)
look = np.array([float(v) for v in a.yaw0_look.split(",")], dtype=np.float64) if a.yaw0_look else np.array(meta["centre_look"] or [pos[0], pos[1] + 1, pos[2]], dtype=np.float64)
c = look - pos; c[2] = 0.0
c = c / (np.linalg.norm(c) or 1.0)                       # the centre direction on the horizon
r = np.array([c[1], -c[0], 0.0])                           # c x Z: the direction to the right when facing c (clockwise from above)
Z = np.array([0.0, 0.0, 1.0])

u = (np.arange(W) + 0.5) / W
v = (np.arange(H) + 0.5) / H
lon = (u - 0.5) * 2 * np.pi                                 # + = right = clockwise from above
lat = (0.5 - v) * np.pi                                     # + = up
LON, LAT = np.meshgrid(lon, lat)
d = (np.cos(LAT)[..., None] * (np.cos(LON)[..., None] * c + np.sin(LON)[..., None] * r) + np.sin(LAT)[..., None] * Z)  # H x W x 3 world

rgb = np.zeros((H, W, 3), np.uint8)
idp = np.zeros((H, W), np.uint16)
best = np.full((H, W), -1.0)                                # the largest forward component wins (the face the direction is most inside)
res = int(meta["face_res"])
for face in meta["faces"]:
    M = np.array(face["matrix_world"], dtype=np.float64)
    R = M[:3, :3]
    local = d @ R                                           # R^T d for every pixel (d @ R == (R^T d^T)^T)
    fwd = -local[..., 2]
    sel = (fwd > 1e-6) & (fwd > best)
    x = local[..., 0] / np.where(fwd > 1e-6, fwd, 1.0)
    y = local[..., 1] / np.where(fwd > 1e-6, fwd, 1.0)
    inside = sel & (np.abs(x) <= 1.0) & (np.abs(y) <= 1.0)
    mx = ((x + 1.0) * 0.5 * res - 0.5).astype(np.float32)
    my = ((1.0 - y) * 0.5 * res - 0.5).astype(np.float32)
    img = cv2.imread(os.path.join(a.dir, face["rgb"]), cv2.IMREAD_COLOR)
    if img is None:
        print("missing face", face["rgb"]); sys.exit(2)
    warped = cv2.remap(img, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    rgb[inside] = warped[inside]
    idf = os.path.join(a.dir, face["id"])
    if os.path.exists(idf):
        iid = cv2.imread(idf, cv2.IMREAD_UNCHANGED)
        if iid is not None:
            if iid.ndim == 3:
                iid = iid[..., 0]
            wid = cv2.remap(iid.astype(np.uint16), mx, my, cv2.INTER_NEAREST, borderMode=cv2.BORDER_REPLICATE)
            idp[inside] = wid[inside]
    best = np.where(inside, fwd, best)
os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
cv2.imwrite(a.out, rgb)
stem = os.path.splitext(a.out)[0]
cv2.imwrite(stem + ".id.png", idp)
uncovered = int((best < 0).sum())
print(f"{a.out}: {W}x{H}, centre faces {c.round(3).tolist()}, uncovered px {uncovered}")
