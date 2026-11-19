"""band_edges.py — find VISIBLE BAND EDGES in an equirect picture (2026-11-05; parity R25).

A band repair (close-seam --u/--band-deg) repaints a vertical strip and feathers it 24 px into the picture. When the repainted strip
does not line up with what is left and right of it, the horizontal structure that crosses the strip's edge — a shelf, a counter front,
a backsplash line, a skirting — STEPS or doubles at that column (apt846 02-kitchen 2026-11-05: the upper shelf stepped down and the
counter edge went wavy at the oven column; the depth gate passed it, the eye did not).

The test, per column x: the vertical-gradient profile (rows 22-86 % of the height) a little LEFT of x and a little RIGHT of x is
cross-correlated; the vertical shift s(x) that aligns them is the local slope of the horizontal lines at x. A band edge shows as an
ANOMALY: s(x) differs from the slope measured just outside (x +- 3d) by >= MIN_STEP_PX, with enough line energy, over a run of
columns no wider than a feather. Natural geometry changes slope smoothly across the picture; it does not jump and come back.

    from band_edges import find_band_edges
    edges = find_band_edges(path)          # [{"u": .., "x": .., "step_px": .., "energy": .., "score": ..}, ...]
    python band_edges.py <picture> [<picture> ...] [--json]
"""
import json
import sys

import numpy as np
from PIL import Image

D = 12                # half-distance of the two profiles compared at x (columns)
STRIP = 4             # columns averaged into one profile
MAX_SHIFT = 8         # px searched
MIN_STEP_PX = 3.0     # the anomaly that counts as a visible step
MIN_ENERGY = 1.6      # the profile's line energy over the picture's median energy
ROWS = (0.22, 0.86)


def _profiles(g, x0, x1):
    return g[:, max(0, x0):max(1, x1)].mean(axis=1)


def _shift(a, b):
    a = a - a.mean(); b = b - b.mean()
    best, bs = -1e9, 0
    n = len(a)
    for s in range(-MAX_SHIFT, MAX_SHIFT + 1):
        if s >= 0:
            c = float(np.dot(a[s:], b[:n - s]))
        else:
            c = float(np.dot(a[:n + s], b[-s:]))
        if c > best:
            best, bs = c, s
    # sub-pixel by a parabola through the peak
    return float(bs)


def find_band_edges(path, step=2):
    im = Image.open(path).convert("L")
    if im.size != (2048, 1024):
        im = im.resize((2048, 1024))
    a = np.asarray(im, dtype=np.float32)
    H, W = a.shape
    r0, r1 = int(ROWS[0] * H), int(ROWS[1] * H)
    g = np.abs(np.diff(a[r0:r1 + 1], axis=0))                 # vertical gradient: horizontal lines light up
    wrap = np.concatenate([g[:, -64:], g, g[:, :64]], axis=1)  # the picture wraps left-right
    off = 64
    xs = list(range(0, W, step))
    s = {}
    e = {}
    for x in xs:
        X = x + off
        L = _profiles(wrap, X - D - STRIP, X - D)
        R = _profiles(wrap, X + D, X + D + STRIP)
        s[x] = _shift(L, R)
        e[x] = float((L.mean() + R.mean()) / 2)
    med_e = float(np.median(list(e.values()))) or 1.0
    out = []
    for x in xs:
        xl, xr = (x - 3 * D) % W, (x + 3 * D) % W
        xl -= xl % step; xr -= xr % step
        ref = (s.get(xl, 0.0) + s.get(xr, 0.0)) / 2
        anom = abs(s[x] - ref)
        en = e[x] / med_e
        if anom >= MIN_STEP_PX and en >= MIN_ENERGY and abs(s.get(xl, 0) - s.get(xr, 0)) <= 2:
            out.append({"x": x, "u": round(x / W, 4), "step_px": round(anom, 1), "energy": round(en, 2), "score": round(anom * en, 1)})
    # merge neighbouring columns into one edge (the strongest)
    merged = []
    for o in sorted(out, key=lambda q: q["x"]):
        if merged and o["x"] - merged[-1]["x"] <= 2 * D:
            if o["score"] > merged[-1]["score"]:
                merged[-1] = o
        else:
            merged.append(o)
    return merged


if __name__ == "__main__":
    files = [a for a in sys.argv[1:] if not a.startswith("--")]
    res = {f: find_band_edges(f) for f in files}
    if "--json" in sys.argv:
        print(json.dumps(res))
    else:
        for f, ed in res.items():
            print(f"{f}: {len(ed)} edge(s) " + " ".join(f"u{q['u']}(step {q['step_px']}px, e{q['energy']})" for q in ed))
