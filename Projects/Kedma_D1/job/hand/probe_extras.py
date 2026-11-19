"""kedma-d1 hand trace, step 3 ($0): extents of the elements the wall mask does not hold (lighter partitions, cistern boxes, balcony lines)."""
import sys
from pathlib import Path
import cv2, numpy as np
job = Path(sys.argv[1]); im = cv2.cvtColor(cv2.imread(str(job / "hand" / "sheet.png")), cv2.COLOR_BGR2RGB).astype(int)
def comp(name, x, y, tol=7):
    c = im[y, x]; m = (np.abs(im - c).sum(axis=2) <= tol * 3).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(m, connectivity=4); i = lab[y, x]
    print(f"{name}: colour {c.tolist()} bbox x{st[i,0]}-{st[i,0]+st[i,2]} y{st[i,1]}-{st[i,1]+st[i,3]} area {st[i,4]} fill {st[i,4]/(st[i,2]*st[i,3]):.2f}")
comp("partition kitchen|living", 1900, 1303); comp("cistern box shower", 1345, 4000); comp("cistern box bathroom", 3340, 3550)
g = im.sum(axis=2) // 3; neutral = (np.abs(im[..., 0] - im[..., 1]) <= 6) & (np.abs(im[..., 1] - im[..., 2]) <= 6)
def runs(mask1d, minlen=3):
    out = []; s = None
    for i, v in enumerate(mask1d):
        if v and s is None: s = i
        if not v and s is not None:
            if i - s >= minlen: out.append((s, i))
            s = None
    if s is not None: out.append((s, len(mask1d)))
    return out
wall = neutral & (np.abs(g - 85) <= 10); dark = g < 110
print("top wall row y=430, wall runs x<1500:", [r for r in runs(wall[430, :1500], 8)])
print("top wall col x=420 (wall rows y<600):", runs(wall[:600, 420], 5))
for y in (700, 1500, 2200): print(f"dark runs row y={y}, x<300:", runs(dark[y, :300], 1))
for x in (260, 300): print(f"dark runs col x={x}, y 2380-2560:", [(a + 2380, b + 2380) for a, b in runs(dark[2380:2560, x], 1)])
print("dark runs row y=2480, x 100-420:", [(a + 100, b + 100) for a, b in runs(dark[2480, 100:420], 1)])
print("laundry bottom: dark runs col x=3700, y 4150-4700:", [(a + 4150, b + 4150) for a, b in runs(dark[4150:4700, 3700], 1)])
print("laundry opening row y=4130 x 3380-4040:", [(a + 3380, b + 3380) for a, b in runs(dark[4130, 3380:4040], 1)])
print("dashed 'balcony above' col x=552:", runs(dark[440:1000, 552], 2)[:6], " row y=977:", runs(dark[977, 200:600], 2)[:6])
