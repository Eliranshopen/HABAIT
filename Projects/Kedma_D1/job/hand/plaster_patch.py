"""kedma-d1 ($0): a plain plastered face that the image model painted as something else is painted again from the painted plaster
of the SAME wall beside it.

Why (2026-11-17, the pantry): the end of the wall beside the pantry's opening - 14 cm of plain plaster - came out of the image model as
a white door frame with a glassy, rainbow-tinted strip. The fidelity gate read it as an opening (FAIL 28.68 %), and it is not what the
model shows. A plain face needs no image model: the wall's other face, a hand's width away, is already painted plaster.

The two faces meet at a vertical corner, which is one column of the panorama. Each pixel of the face (the pixels whose 3D point, by the
render's depth, lies in --box) takes the painted pixel at the mirrored column on the other side of the corner (--corner x,y in plan
cm; --clear px away from the corner line itself), in the same row - only when that pixel is painted and lies in --src-box (the plain
face). Its light is the model's own: the render's brightness on the face against the render's brightness at the source.
Nothing else is touched.

usage: python plaster_patch.py <apartment dir> <tour dir> <asset> --cam cp-pantry --box x0,y0,x1,y1,z0,z1 --src-box x0,y0,x1,y1,z0,z1
                               --corner x,y [--clear 8] [--dry]
Keeps canvas.before-plaster.png / painted.before-plaster.png. Deterministic.
"""
import argparse
import io
import json
import math
import os

import cv2
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument("apt"); ap.add_argument("tour"); ap.add_argument("asset"); ap.add_argument("--cam", required=True)
ap.add_argument("--box", required=True); ap.add_argument("--src-box", required=True); ap.add_argument("--corner", required=True)
ap.add_argument("--clear", type=float, default=8.0); ap.add_argument("--dry", action="store_true")
a = ap.parse_args()
R = lambda n: os.path.join(a.apt, "_local", "redo", a.asset, n)
REN = lambda n: os.path.join(a.tour, "renders", a.cam, n)

C = cv2.imread(R("canvas.png")); PT = cv2.imread(R("painted.png"), cv2.IMREAD_GRAYSCALE); G = cv2.imread(R("cg.png"))
H, W = C.shape[:2]
SC = W / 4096.0
j = json.load(io.open(REN("pano.render.json"), encoding="utf-8"))["point"]
tx, ty, tz = (float(v) for v in j["plan_cm"]); tyaw = float(j["yaw_deg"])
d = cv2.resize(cv2.imread(REN("depth.png"), cv2.IMREAD_COLOR), (W, H), interpolation=cv2.INTER_NEAREST)
rT = ((d[..., 2].astype(np.int64) << 16) | (d[..., 1].astype(np.int64) << 8) | d[..., 0].astype(np.int64)).astype(np.float32)
psi = np.radians(tyaw + (np.arange(W) + 0.5) / W * 360.0 - 180.0)[None, :]
lat = ((0.5 - (np.arange(H) + 0.5) / H) * math.pi)[:, None]
X = tx + rT * np.cos(lat) * np.sin(psi)
Y = ty - rT * np.cos(lat) * np.cos(psi)
Z = tz + rT * np.sin(lat)


def inbox(spec):
    x0, y0, x1, y1, z0, z1 = (float(v) for v in spec.split(","))
    return (X >= x0) & (X <= x1) & (Y >= y0) & (Y <= y1) & (Z >= z0) & (Z <= z1)


dst = inbox(a.box)
src_ok = (inbox(a.src_box) & (PT > 127)).astype(np.uint8)
kx, ky = (float(v) for v in a.corner.split(","))
bear = math.degrees(math.atan2(kx - tx, -(ky - ty)))
uc = (((bear - tyaw) / 360.0 + 0.5) % 1.0) * W                      # the corner's column
cols = np.arange(W, dtype=np.float32)[None, :] + 0.5
side = np.sign(uc - cols)                                           # +1: the face is left of the corner, its source is right of it
mx = (uc + (uc - cols) + side * a.clear * SC - 0.5).astype(np.float32) * np.ones((H, 1), np.float32)
my = (np.arange(H, dtype=np.float32)[:, None]) * np.ones((1, W), np.float32)
src = cv2.remap(C, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_WRAP).astype(np.float32)
valid = dst & (cv2.remap(src_ok, mx, my, cv2.INTER_NEAREST, borderMode=cv2.BORDER_WRAP) > 0)
lum = lambda B: 0.114 * B[..., 0] + 0.587 * B[..., 1] + 0.299 * B[..., 2]
GL = cv2.GaussianBlur(lum(G.astype(np.float32)), (0, 0), 3.0 * SC)
ratio = np.clip(GL / np.maximum(cv2.remap(GL, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_WRAP), 1.0), 0.75, 1.25)
patch = np.clip(src * ratio[..., None], 0, 255)
v = valid.astype(np.float32)
alpha = np.minimum(v, np.clip(cv2.GaussianBlur(v, (0, 0), 0.8 * SC) * 1.6, 0, 1))[..., None]   # full inside, a pixel of ramp at its rim
OUT = np.round(C.astype(np.float32) * (1 - alpha) + patch * alpha).astype(np.uint8)
PT2 = np.maximum(PT, (valid * 255).astype(np.uint8))
row = {"step": "plaster-patch", "cam": a.cam, "box": a.box, "src_box": a.src_box, "corner": [kx, ky], "corner_col": round(float(uc), 1),
       "face_pct": round(float(dst.mean()) * 100, 3), "patched_pct": round(float(valid.mean()) * 100, 3),
       "face_not_patched_px": int((dst & ~valid).sum())}
print(json.dumps(row))
if not a.dry:
    for n, im in (("canvas", C), ("painted", PT)):
        if not os.path.exists(R(f"{n}.before-plaster.png")):
            cv2.imwrite(R(f"{n}.before-plaster.png"), im)
    cv2.imwrite(R("canvas.png"), OUT); cv2.imwrite(R("painted.png"), PT2)
    lp = R("log.json")
    log = json.load(io.open(lp, encoding="utf-8")) if os.path.exists(lp) else []
    log.append(row); io.open(lp, "w", encoding="utf-8", newline="").write(json.dumps(log, indent=1, ensure_ascii=False))
