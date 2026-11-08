#!/usr/bin/env python
"""dimline-reader.py (2026-11-05) — read a printed dimension off the sales-plan raster mechanically: refine the dimension line through a
rough probe (point + bearing), find its tick marks (45-degree strokes crossing the line), and report the drawn distance between the
number's own two ticks against the printed number. In a dimension chain the number's ticks are the nearest on each side.
The ticks it reports are the a_cm/b_cm of plan_meta.printed_dimensions (tools/printed-dimensions.mjs measures the trace against them).
On apt846 it read 12 dimensions at drawn/printed 0.9989..1.0038 (the sheet is to scale at 2.268 px/cm).
usage: python -I dimline-reader.py <raster.png> <px_per_cm> <overlay.jpg> id:printed:x_cm:y_cm:bearing_deg[:text_px] ...
"""
import sys, math
import numpy as np
from PIL import Image, ImageDraw

img_path, PX, out = sys.argv[1], float(sys.argv[2]), sys.argv[3]
specs = sys.argv[4:]
im = np.asarray(Image.open(img_path).convert('L')).astype(int)
H, W = im.shape
dark = im < 90

def px(x, y):
    xi, yi = int(round(x)), int(round(y))
    return 0 <= xi < W and 0 <= yi < H and dark[yi, xi]

def refine(cx, cy, br):
    """best offset (perp) and angle (+-2 deg) for the thin dark line through (cx,cy) px"""
    best = None
    for dang in np.arange(-3.0, 3.01, 0.25):
        a = math.radians(br + dang); ux, uy = math.sin(a), -math.cos(a); nx, ny = -uy, ux
        for off in np.arange(-40, 40.01, 0.5):
            hits = sum(px(cx + nx * off + ux * t, cy + ny * off + uy * t) for t in np.arange(-120, 121, 2))
            if best is None or hits > best[0]: best = (hits, off, br + dang)
    _, off, b = best
    a = math.radians(b); ux, uy = math.sin(a), -math.cos(a); nx, ny = -uy, ux
    return cx + nx * off, cy + ny * off, b

def ticks(cx, cy, br, span_px, text_px=40.0):
    a = math.radians(br); ux, uy = math.sin(a), -math.cos(a); nx, ny = -uy, ux
    feats = []
    for t in np.arange(-span_px, span_px, 0.5):
        x, y = cx + ux * t, cy + uy * t
        on = any(px(x + nx * o, y + ny * o) for o in (-1, 0, 1))
        # a TICK is an oblique stroke at ~45 deg to the dimension line: dark at (+o along, +o across) AND (-o, -o) for most o in 3..9,
        # or the mirrored diagonal; an extension line (perpendicular) or a crossing drawing line does not make that pattern
        def diag(sg):
            hits = 0
            for o in range(3, 10):
                h1 = any(px(x + ux * (o + e) + nx * sg * o, y + uy * (o + e) + ny * sg * o) for e in (-1, 0, 1))
                h2 = any(px(x - ux * (o + e) - nx * sg * o, y - uy * (o + e) - ny * sg * o) for e in (-1, 0, 1))
                hits += h1 and h2
            return hits >= 5
        feats.append((t, on, diag(1) or diag(-1)))
    # the line's own continuous run: from the number's window (the densest stretch near the probe) walk outward on each side and
    # stop where the line is absent for more than 8 px (a tick/extension crossing does not break it; the end of the line does)
    by_t = {round(t * 2): (on, x) for t, on, x in feats}
    def run_end(start, step):
        t, gap, last_on = start, 0.0, start
        while abs(t) < span_px:
            on, _ = by_t.get(round(t * 2), (False, False))
            if on: last_on, gap = t, 0.0
            else:
                gap += 0.5
                if gap > 8: break
            t += step
        return last_on
    # start a little outside the number on each side (the number interrupts the line within +-40 px of the probe)
    lo = run_end(-text_px, -0.5); hi = run_end(text_px, 0.5)
    mid = 0.0
    cross = [t for t, on, x in feats if x and on and lo - 1 <= t <= hi + 1 and abs(t) > text_px - 5]
    left = [t for t in cross if t < mid]; right = [t for t in cross if t > mid]
    if not left or not right: return None
    # in a dimension CHAIN the number's own ticks are the NEAREST ticks on each side of the number (the chain continues past them)
    def near_cluster(ts, toward_min):
        ts = sorted(ts, reverse=toward_min)   # nearest to the number first
        c = [ts[0]]
        for t in ts[1:]:
            if abs(t - c[-1]) <= 3: c.append(t)
            else: break
        return sum(c) / len(c)
    return near_cluster(left, True), near_cluster(right, False), (lo, hi), (ux, uy)

canvas = Image.open(img_path).convert('RGB'); d = ImageDraw.Draw(canvas)
rows = []
for s in specs:
    parts = s.split(':'); did, printed, x, y, br = parts[:5]; printed = float(printed); text_px = float(parts[5]) if len(parts) > 5 else 40.0
    cx, cy, b = refine(float(x) * PX, float(y) * PX, float(br))
    r = ticks(cx, cy, b, span_px=printed * PX * 0.75, text_px=text_px)
    if not r:
        print(f"{did:12s} printed {printed:6.0f} | no ticks found"); continue
    t1, t2, (lo, hi), (ux, uy) = r
    drawn = (t2 - t1) / PX
    p1 = (cx + ux * t1, cy + uy * t1); p2 = (cx + ux * t2, cy + uy * t2)
    d.line([p1, p2], fill=(255, 0, 0), width=3)
    for q in (p1, p2): d.ellipse([q[0] - 8, q[1] - 8, q[0] + 8, q[1] + 8], outline=(255, 0, 0), width=3)
    rows.append((did, printed, drawn))
    print(f"{did:12s} printed {printed:6.0f} | line bearing {b:6.2f} | ticks {[round(v / PX, 1) for v in p1]} -> {[round(v / PX, 1) for v in p2]} cm | drawn {drawn:7.1f} cm | {100 * (drawn - printed) / printed:+.2f}%")
canvas.resize((canvas.width // 3, canvas.height // 3)).save(out, quality=85)
if rows:
    ratios = [dr / pr for _, pr, dr in rows]
    print(f"drawn/printed: mean {sum(ratios) / len(ratios):.4f}, min {min(ratios):.4f}, max {max(ratios):.4f} over {len(rows)} dimension lines")
