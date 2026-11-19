"""Step 08 ($0) - panorama QA + copy into the viewer.

Usage: python 08_qa_and_publish.py <job root>
For every panoramas/*.png: 2:1 ratio, the wrap seam (column 0 vs the last column: mean absolute difference, and the same
metric between two neighbouring columns inside the image as the baseline), pole rows (no black / no hole), black pixels.
Writes qa/panorama-qa.json, viewer/panos/<id>.jpg (quality 90) and viewer/panos.js (the scene list).
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

root = Path(sys.argv[1])
NAMES = {"pano_living": "סלון ופינת אוכל", "pano_kitchen": "מטבח", "pano_parents": "חדר שינה הורים",
         "pano_mamad": "חדר שינה / ממ\"ד", "pano_bedA": "חדר שינה 265/380", "pano_bedB": "חדר שינה 325/270",
         "pano_bath": "חדר רחצה"}
ORDER = list(NAMES)
cams = {c["id"]: c for c in json.loads((root / "geometry" / "cameras.json").read_text(encoding="utf-8"))["panoramas"]}
rows, panos = [], []
(root / "viewer" / "panos").mkdir(parents=True, exist_ok=True)
for pid in ORDER:
    f = root / "panoramas" / f"{pid}.png"
    if not f.exists():
        continue
    im = Image.open(f).convert("RGB")
    a = np.asarray(im).astype(np.float32)
    h, w = a.shape[:2]
    seam = float(np.abs(a[:, 0] - a[:, -1]).mean())
    inner = float(np.mean([np.abs(a[:, k] - a[:, k + 1]).mean() for k in range(0, w - 1, max(1, w // 64))]))
    top, bot = a[:2].reshape(-1, 3), a[-2:].reshape(-1, 3)
    black = float((a.max(axis=2) < 3).mean() * 100)
    r = {"id": pid, "w": w, "h": h, "ratio_2_1": w == 2 * h, "seam_mad": round(seam, 2), "inner_column_mad": round(inner, 2),
         "seam_ok": seam <= max(3.0, 2.0 * inner), "pole_top_std": round(float(top.std(axis=0).mean()), 2),
         "pole_bottom_std": round(float(bot.std(axis=0).mean()), 2), "black_pct": round(black, 3)}
    r["pass"] = r["ratio_2_1"] and r["seam_ok"] and black < 0.5
    rows.append(r)
    im.save(root / "viewer" / "panos" / f"{pid}.jpg", quality=90)
    # the viewer's yaw is measured from the panorama's centre; our centre looks along the camera's yaw, so open at 0
    panos.append({"id": pid, "he": NAMES[pid], "file": f"panos/{pid}.jpg", "yaw": 0, "ai": False})
(root / "qa" / "panorama-qa.json").write_text(json.dumps(rows, indent=1), encoding="utf-8")
(root / "viewer" / "panos.js").write_text("const PANOS = " + json.dumps(panos, ensure_ascii=False, indent=1) + ";\n", encoding="utf-8")
for r in rows:
    print(r)
print("viewer scenes:", len(panos))
