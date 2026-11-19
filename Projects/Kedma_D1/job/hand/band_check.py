"""kedma-d1 ($0): what a room canvas still lacks inside the range the viewer can show (the eye-level rule: about -63..+59 deg on a
phone), split into floor, ceiling and the rest (walls, furniture). The rest is what a tilted view must still paint.
usage: python band_check.py <apartment dir> <tour dir> <asset> <camera id>"""
import sys, json, io, os
import cv2, numpy as np
apt, tour, asset, cam = sys.argv[1:5]
PT = cv2.imread(os.path.join(apt, "_local", "redo", asset, "painted.png"), cv2.IMREAD_GRAYSCALE); H, W = PT.shape
d = cv2.resize(cv2.imread(os.path.join(tour, "renders", cam, "depth.png")), (W, H), interpolation=cv2.INTER_NEAREST)
rng = (d[..., 2].astype(np.int64) << 16) | (d[..., 1].astype(np.int64) << 8) | d[..., 0].astype(np.int64)
cz = float(json.load(io.open(os.path.join(tour, "renders", cam, "pano.render.json"), encoding="utf-8"))["point"]["plan_cm"][2])
el = (0.5 - (np.arange(H) + 0.5) / H) * 180
z = cz + rng * np.sin(np.radians(el))[:, None]
floor = (z < 4) & (el[:, None] < 0); ceil = (z > 275) & (el[:, None] > 0)
out = {}
for name, lo, hi in (("down", -63, -40), ("up", 40, 59), ("mid", -40, 40)):
    rows = (el >= lo) & (el <= hi)
    un = PT[rows] <= 127
    rest = un & ~floor[rows] & ~ceil[rows]
    cols = rest.mean(0)
    yaws = [int((i / W - 0.5) * 360) for i in range(0, W, W // 36) if cols[i:i + W // 36].mean() > 0.03]
    out[name] = {"unpainted_pct": round(float(un.mean()) * 100, 1), "walls_or_furniture_pct": round(float(rest.mean()) * 100, 1), "at_yaws": yaws}
print(json.dumps(out))
