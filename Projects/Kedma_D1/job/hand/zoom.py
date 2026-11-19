"""kedma-d1: cut a region of the native sheet with a px grid every 200 px (labels in native px), for reading positions by eye."""
import sys
from pathlib import Path
import cv2
job = Path(sys.argv[1]); name = sys.argv[2]; x0, y0, x1, y1 = map(int, sys.argv[3:7]); step = int(sys.argv[7]) if len(sys.argv) > 7 else 200
im = cv2.imread(str(job / "hand" / "sheet.png"))[y0:y1, x0:x1].copy()
for x in range((x0 // step + 1) * step, x1, step):
    cv2.line(im, (x - x0, 0), (x - x0, y1 - y0), (0, 0, 255), 1); cv2.putText(im, str(x), (x - x0 + 3, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
for y in range((y0 // step + 1) * step, y1, step):
    cv2.line(im, (0, y - y0), (x1 - x0, y - y0), (255, 0, 0), 1); cv2.putText(im, str(y), (3, y - y0 - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 0, 0), 2)
cv2.imwrite(str(job / "hand" / f"zoom-{name}.png"), im)
print(name, im.shape)
