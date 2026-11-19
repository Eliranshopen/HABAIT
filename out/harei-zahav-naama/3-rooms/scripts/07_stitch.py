"""Step 07 - stitch vertical render strips into one image (pads cross-faded), write a manifest row.

Usage: python 07_stitch.py <out.png> <strip0.png> <strip1.png> ...   (each strip has its <png>.json sidecar)
The equirectangular wrap: strip 0 starts at x=0 and the last strip ends at x=W, so the seam at the
panorama's back is the camera's own continuous wrap (checked later by 08_pano_qa.py).
"""
import json
import sys

import numpy as np
from PIL import Image

out, parts = sys.argv[1], sys.argv[2:]
metas = [json.load(open(p + ".json", encoding="utf-8")) for p in parts]
W, H = metas[0]["res"]
acc = np.zeros((H, W, 3), np.float64)
wsum = np.zeros((1, W, 1), np.float64)
secs = 0.0
for p, m in zip(parts, metas):
    s = m["strip"]
    im = np.asarray(Image.open(p).convert("RGB"), np.float64)
    x0, x1, pad = s["x0"], s["x1"], s["pad"]
    assert im.shape[1] == x1 - x0, (p, im.shape, x0, x1)
    core0 = round(s["i"] * W / s["n"])
    core1 = round((s["i"] + 1) * W / s["n"])
    xs = np.arange(x0, x1)
    w = np.ones(len(xs))
    ramp = max(1, pad)
    w = np.minimum(w, np.clip((xs - (core0 - pad / 2)) / ramp + 0.5, 0, 1)) if x0 > 0 else w
    w = np.minimum(w, np.clip(((core1 + pad / 2) - xs) / ramp + 0.5, 0, 1)) if x1 < W else w
    acc[:, x0:x1] += im * w[None, :, None]
    wsum[:, x0:x1] += w[None, :, None]
    secs += m["seconds"]
assert (wsum > 0).all(), "gap between strips"
img = (acc / wsum).round().clip(0, 255).astype(np.uint8)
Image.fromarray(img).save(out)
json.dump({"res": [W, H], "strips": len(parts), "render_seconds": round(secs, 1), "samples": metas[0]["samples"],
           "camera": metas[0].get("camera")}, open(out + ".json", "w", encoding="utf-8"), indent=1)
print("stitched", out, W, H, "render seconds", round(secs))
