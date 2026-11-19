"""Step 11 - the model seen from above (orthographic render, roof hidden) laid over the sales plan, 1 px = 1 cm.
Usage: python 11_plan_overlay.py <job root> <top-render.png>  -> qa/model-over-plan.png"""
import sys
from pathlib import Path
import cv2, numpy as np
root = Path(sys.argv[1])
plan = cv2.imdecode(np.fromfile(str(root / "input" / "plan-hatzav-colour.png"), np.uint8), cv2.IMREAD_COLOR)
top = cv2.imdecode(np.fromfile(sys.argv[2], np.uint8), cv2.IMREAD_COLOR)
# the top render covers u -80..1180, v -80..1100 at 1 px/cm; the sheet has u = x - 480, v = y - 267
x0, y0 = 480 - 80, 267 - 80
crop = plan[y0:y0 + top.shape[0], x0:x0 + top.shape[1]]
edges = cv2.Canny(cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY), 60, 160)
ov = cv2.addWeighted(top, 0.65, crop, 0.35, 0)
ov[edges > 0] = (0, 0, 255)
side = np.concatenate([crop, ov], axis=1)
cv2.imencode(".png", side)[1].tofile(str(root / "qa" / "model-over-plan.png"))
print("written", side.shape)
