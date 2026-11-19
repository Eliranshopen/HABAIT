"""The blend proof for the walk: at each place, the frame at the midpoint hour must equal the LINEAR-LIGHT 50/50 mix of the two
keyframe frames (the shader mixes sRGB textures after decoding, and the live lights follow the same weight), within tolerance;
keyframes must differ; nothing blank. Writes qa-result.json next to the shots. Exit 1 on a failure.
python -I analyse.py <shots dir>"""
import json, sys, os
import numpy as np
from PIL import Image

d = sys.argv[1]
rep = json.load(open(os.path.join(d, "shots.json"), encoding="utf-8"))
lin = lambda x: np.where(x <= 0.04045, x / 12.92, ((x + 0.055) / 1.055) ** 2.4)
srgb = lambda x: np.where(x <= 0.0031308, x * 12.92, 1.055 * np.power(np.clip(x, 0, None), 1 / 2.4) - 0.055)
load = lambda f: np.asarray(Image.open(os.path.join(d, f)).convert("RGB"), float) / 255
res, ok = [], True
for p in rep["pairs"]:
    A, M, B = load(p["a"]), load(p["mid"]), load(p["b"])
    pred = srgb(0.5 * lin(A) + 0.5 * lin(B))
    err = np.abs(M - pred) * 255
    r = {"place": p["place"], "hours": p["hours"], "mean_err_255": round(float(err.mean()), 2), "p99_err_255": round(float(np.percentile(err, 99)), 2),
         "keys_differ_255": round(float(np.abs(A - B).mean() * 255), 1), "mean_levels": [round(float(x.mean() * 255), 1) for x in (A, M, B)]}
    r["pass"] = r["mean_err_255"] < 1.5 and r["keys_differ_255"] > 3 and min(r["mean_levels"]) > 1
    ok &= r["pass"]
    res.append(r)
    print(r)
json.dump({"pass": bool(ok), "pairs": res}, open(os.path.join(d, "qa-result.json"), "w"), indent=1)
sys.exit(0 if ok else 1)
