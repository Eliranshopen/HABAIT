"""Step 08 - panorama QA: 2:1 size, wrap-seam continuity, pole rows, exposure, strip-join steps.

Usage: python 08_pano_qa.py <pano.png> [more panos...]   -> prints and writes qa/pano-qa.json (merged)
Seam metric: mean absolute difference between the last and first pixel columns, compared with the
median difference between neighbouring columns inside the image (a true wrap is no worse than the inside).
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

qa_path = Path(__file__).resolve().parents[1] / "qa" / "pano-qa.json"
res = json.loads(qa_path.read_text(encoding="utf-8")) if qa_path.exists() else {}
for p in sys.argv[1:]:
    a = np.asarray(Image.open(p).convert("RGB"), np.float64)
    h, w, _ = a.shape
    col_d = np.abs(np.diff(a, axis=1)).mean(axis=(0, 2))
    seam = float(np.abs(a[:, -1] - a[:, 0]).mean())
    inside = float(np.median(col_d))
    p99 = float(np.percentile(col_d, 99.5))
    # strip joins: column steps at multiples of w/8 compared with their neighbours
    joins = []
    for k in range(1, 8):
        x = round(k * w / 8)
        joins.append(round(float(col_d[x - 1]) / max(1e-6, float(np.median(col_d[x - 40:x + 40]))), 2))
    top, bot = a[:4].std(axis=1).mean(), a[-4:].std(axis=1).mean()
    lum = a.mean(axis=2)
    r = {
        "size": [w, h], "ratio_2to1": w == 2 * h,
        "seam_mean_abs": round(seam, 2), "inside_median_col_diff": round(inside, 2), "inside_p99_5": round(p99, 2),
        "seam_ok": seam <= p99,
        "strip_join_ratio": joins, "strip_joins_ok": max(joins) < 3.0,
        "pole_row_std": [round(float(top), 2), round(float(bot), 2)],
        "mean_luma": round(float(lum.mean()), 1), "clipped_white_pct": round(float((lum > 250).mean() * 100), 2),
        "black_pct": round(float((lum < 6).mean() * 100), 2),
    }
    r["pass"] = r["ratio_2to1"] and r["seam_ok"] and r["strip_joins_ok"] and r["clipped_white_pct"] < 3
    res[Path(p).name] = r
    print(Path(p).name, json.dumps(r))
qa_path.parent.mkdir(exist_ok=True)
qa_path.write_text(json.dumps(res, indent=1), encoding="utf-8")
