"""Audit helper: bounding box and centre of the dark (text) pixels inside given windows of the sheet.
Printed dimension labels sit at the midpoint of the span they measure; the centre tells where a span is."""
from pathlib import Path
import cv2
import numpy as np
here = Path(__file__).resolve().parent
root = here.parent.parent
img = cv2.imdecode(np.fromfile(str(root / "input" / "plan-hatzav-colour.png"), dtype=np.uint8), cv2.IMREAD_GRAYSCALE)
wins = {
    "335": (640, 325, 715, 355), "270": (535, 405, 565, 470), "315": (990, 303, 1055, 332),
    "410": (898, 465, 928, 530), "295": (1000, 663, 1065, 693), "180": (568, 628, 622, 660),
    "190": (640, 655, 668, 720), "500": (648, 1010, 676, 1075), "730": (888, 1180, 950, 1208),
    "400": (1055, 768, 1115, 796), "565": (1150, 978, 1178, 1042), "380": (1530, 1085, 1560, 1170),
    "300": (1428, 1205, 1492, 1233),
    "830top": (860, 145, 930, 172), "725": (810, 180, 875, 206), "105": (1235, 180, 1285, 206),
    "1050": (318, 760, 345, 825), "540": (360, 510, 388, 565), "510": (360, 1035, 388, 1090),
    "50": (488, 1423, 522, 1450), "780": (895, 1423, 945, 1450), "830bot": (868, 1467, 922, 1495),
}
for k, (x0, y0, x1, y1) in wins.items():
    sub = img[y0:y1, x0:x1]
    ys, xs = np.where(sub < 90)
    if len(xs) == 0:
        print(k, "no dark pixels"); continue
    bx0, bx1, by0, by1 = xs.min() + x0, xs.max() + x0, ys.min() + y0, ys.max() + y0
    print(f"{k:7s} bbox x {bx0}-{bx1} y {by0}-{by1}  centre ({(bx0 + bx1) / 2:.1f}, {(by0 + by1) / 2:.1f})  n={len(xs)}")
