"""kedma-d1 hand trace, step 2 ($0): the wall mask as axis-aligned polygons (native px), for measuring gaps by number."""
import json, sys
from pathlib import Path
import cv2, numpy as np
job = Path(sys.argv[1]); m = cv2.imread(str(job / "hand" / "wallmask.png"), cv2.IMREAD_GRAYSCALE)
cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
out = []
for c in sorted(cs, key=lambda c: (cv2.boundingRect(c)[1], cv2.boundingRect(c)[0])):
    p = cv2.approxPolyDP(c, 4, True).reshape(-1, 2).tolist()
    out.append(p); x, y, w, h = cv2.boundingRect(c)
    print(f"bbox x{x}-{x+w} y{y}-{y+h} n={len(p)}: " + " ".join(f"{a},{b}" for a, b in p))
(job / "hand" / "wall_polys.json").write_text(json.dumps(out), encoding="utf-8")
