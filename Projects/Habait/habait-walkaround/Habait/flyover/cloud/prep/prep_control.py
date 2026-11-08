"""Build the control inputs for the open-weights video routes from one clay clip (runs on Kaggle, GPU optional).

python prep_control.py --clay clay_5s.mp4 --kf kf_first.png --ref ref_aerial.png --size 1280x704 --frames 121 --out DIR

Writes DIR/clay.mp4 (cropped clay), DIR/depth.mp4 (Depth-Anything-V2-Small, one global normalisation for the whole
clip so the control does not flicker), DIR/canny.mp4 (white edges on black), DIR/kf.png, DIR/ref.png, DIR/prep.json.
Frames are resized to cover the target size and centre-cropped (no stretching), so output frame t lines up with
clay frame t for the stability metric.
"""
import argparse, json, os, time

import cv2
import numpy as np
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument("--clay", required=True)
ap.add_argument("--kf", default=None)
ap.add_argument("--ref", default=None)
ap.add_argument("--size", default="1280x704")
ap.add_argument("--frames", type=int, default=121)
ap.add_argument("--fps", type=int, default=24)
ap.add_argument("--out", required=True)
ap.add_argument("--canny", default="60,140")
a = ap.parse_args()
W, H = map(int, a.size.split("x"))
os.makedirs(a.out, exist_ok=True)
t0 = time.time()


def cover(img):  # HxWx3 uint8 -> HxW cover-resize + centre crop
    h, w = img.shape[:2]
    s = max(W / w, H / h)
    img = cv2.resize(img, (int(round(w * s)), int(round(h * s))), interpolation=cv2.INTER_AREA)
    y0 = (img.shape[0] - H) // 2
    x0 = (img.shape[1] - W) // 2
    return img[y0:y0 + H, x0:x0 + W]


cap = cv2.VideoCapture(a.clay)
frames = []
while len(frames) < a.frames:
    ok, f = cap.read()
    if not ok:
        break
    frames.append(cover(cv2.cvtColor(f, cv2.COLOR_BGR2RGB)))
n = len(frames)


def write(path, arr_list):
    vw = cv2.VideoWriter(path, cv2.VideoWriter_fourcc(*"mp4v"), a.fps, (W, H))
    for x in arr_list:
        if x.ndim == 2:
            x = np.stack([x] * 3, -1)
        vw.write(cv2.cvtColor(x, cv2.COLOR_RGB2BGR))
    vw.release()


write(os.path.join(a.out, "clay.mp4"), frames)

# canny (deterministic, clay renders do not flicker so neither does this)
lo, hi = map(int, a.canny.split(","))
canny = [cv2.Canny(cv2.GaussianBlur(cv2.cvtColor(f, cv2.COLOR_RGB2GRAY), (3, 3), 0), lo, hi) for f in frames]
write(os.path.join(a.out, "canny.mp4"), canny)

# depth: Depth-Anything-V2-Small (Apache-2.0), relative inverse depth, global percentile normalisation
info = {"frames": n, "size": [W, H]}
try:
    import torch
    from transformers import AutoImageProcessor, AutoModelForDepthEstimation

    dev = "cuda" if torch.cuda.is_available() else "cpu"
    mid = "depth-anything/Depth-Anything-V2-Small-hf"
    proc = AutoImageProcessor.from_pretrained(mid)
    model = AutoModelForDepthEstimation.from_pretrained(mid).to(dev).eval()
    raw = []
    with torch.no_grad():
        for f in frames:
            inp = proc(images=Image.fromarray(f), return_tensors="pt").to(dev)
            d = model(**inp).predicted_depth
            d = torch.nn.functional.interpolate(d[:, None], size=(H, W), mode="bicubic", align_corners=False)[0, 0]
            raw.append(d.float().cpu().numpy())
    allv = np.concatenate([r.ravel()[::97] for r in raw])
    lo_v, hi_v = np.percentile(allv, 1), np.percentile(allv, 99.5)
    depth = [np.clip((r - lo_v) / (hi_v - lo_v + 1e-6) * 255, 0, 255).astype(np.uint8) for r in raw]
    write(os.path.join(a.out, "depth.mp4"), depth)
    info["depth"] = {"model": mid, "norm": [float(lo_v), float(hi_v)]}
except Exception as e:  # noqa: BLE001
    info["depth_error"] = repr(e)

for key, src in (("kf", a.kf), ("ref", a.ref)):
    if src:
        Image.fromarray(cover(np.asarray(Image.open(src).convert("RGB")))).save(os.path.join(a.out, f"{key}.png"))
# a few control frames for the record
for t in (0, n // 2, n - 1):
    Image.fromarray(canny[t]).save(os.path.join(a.out, f"canny_{t:03d}.png"))
info["prep_s"] = round(time.time() - t0, 1)
json.dump(info, open(os.path.join(a.out, "prep.json"), "w"), indent=1)
print("prep", json.dumps(info))
