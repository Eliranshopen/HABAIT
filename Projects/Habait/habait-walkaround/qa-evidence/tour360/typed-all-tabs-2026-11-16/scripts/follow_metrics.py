# $0: candidate "did the editor redraw the furniture?" measures on the nine real follow answers of 2026-11-16 (view sent, picture answered).
# Usage: python follow_metrics.py <evidence dir>
import sys, os, glob, json, math
import numpy as np
from PIL import Image, ImageFilter

ev = sys.argv[1]
W, H = 632, 424
# my own reading of each answer, from the pictures: good = the people are there at a believable size and the furniture is where it was
LABEL = {
    ('real', 'dining', 'a1'): 'reframed', ('real', 'living', 'a1'): 'GOOD', ('real', 'dining', 'a2'): 'GOOD',
    ('real-fast', 'dining', 'a1'): 'GOOD', ('real-fast', 'living', 'a1'): 'BAD too large',
    ('real-fast-2', 'living', 'a1'): 'reframed', ('real-fast-2', 'living', 'a2'): 'GOOD', ('real-fast-2', 'dining', 'a1'): 'reframed', ('real-fast-2', 'dining', 'a2'): 'BAD table redrawn',
}


def load(f):
    return np.asarray(Image.open(f).convert('RGB').resize((W, H), Image.LANCZOS), dtype=np.float32)


def fit(a, b, ring=20):
    m = np.ones((H, W), bool); m[ring:H - ring, ring:W - ring] = False
    a = a.copy()
    for c in range(3):
        x, y = a[..., c][m], b[..., c][m]
        n = x.size; den = n * (x * x).sum() - x.sum() ** 2
        g = (n * (x * y).sum() - x.sum() * y.sum()) / den if den else 1.0
        o = (y.sum() - g * x.sum()) / n
        g, o = max(0.85, min(1.15, g)), max(-24, min(24, o))
        a[..., c] = np.clip(a[..., c] * g + o, 0, 255)
    return a, m


def grad(g):
    gx = np.zeros_like(g); gy = np.zeros_like(g)
    gx[:, 1:-1] = g[:, 2:] - g[:, :-2]; gy[1:-1, :] = g[2:, :] - g[:-2, :]
    return np.hypot(gx, gy)


def dilate(mask, r):
    im = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(2 * r + 1))
    return np.asarray(im) > 127


rows = []
for run in ('real', 'real-fast', 'real-fast-2'):
    rec = json.load(open(f'{ev}/{run}/real-1440x900-record.json', encoding='utf-8'))
    spot = rec['turn']['follow']['spot']; tg = {t['room']: t for t in rec['turn']['follow']['targets']}
    for s in sorted(glob.glob(f'{ev}/{run}/real-*-follow-*-sent.jpg')):
        name = os.path.basename(s); room = name.split('-follow-')[1].split('-a')[0]; att = 'a' + name.split('-a')[1][0]
        sent = load(s); ans, ringm = fit(load(s.replace('-sent.jpg', '-answer.jpg')), sent)
        d = np.abs(ans - sent).max(axis=2) > 22
        ring = float(d[ringm].mean()); frac = float(d.mean())
        ys, xs = np.nonzero(d)
        if len(xs) < 80:
            continue
        y0, y1 = np.percentile(ys, [3, 97]).astype(int); x0, x1 = np.percentile(xs, [3, 97]).astype(int)
        t = tg[room]
        vf = math.degrees(2 * math.atan(math.tan(math.radians(t['hfov'] / 2)) * 848 / 1264))
        expH = math.degrees(2 * math.atan(spot['h'] / (2 * t['dist'])))
        tall = (y1 - y0) / H * vf
        # edge persistence: of the strong edges the sent view has inside the changed box, how many does the answer still have nearby
        gs, ga = grad(sent.mean(axis=2)), grad(ans.mean(axis=2))
        box = np.zeros((H, W), bool); box[y0:y1 + 1, x0:x1 + 1] = True
        thr = np.percentile(gs[box], 85)
        es = (gs >= thr) & box
        ea = dilate(ga >= 0.6 * thr, 2)
        keep = float((es & ea).sum() / max(1, es.sum()))
        # the same, but only where the answer did NOT change much colour-wise is uninformative; so also: edges kept in the whole view outside the box
        out = ~box
        thr2 = np.percentile(gs[out], 85) if out.sum() > 500 else thr
        eo = (gs >= thr2) & out
        keep_out = float((eo & dilate(ga >= 0.6 * thr2, 2)).sum() / max(1, eo.sum()))
        rows.append((LABEL[(run, room, att)], run, room, att, ring, frac, (x1 - x0) / W, (y1 - y0) / H, tall / expH, keep, keep_out))

print(f"{'label':18} {'run':12} {'room':7} att  ring  frac  boxW  boxH  tall/exp  edges-kept-in-box  edges-kept-outside")
for r in sorted(rows, key=lambda r: r[0]):
    print(f"{r[0]:18} {r[1]:12} {r[2]:7} {r[3]}  {r[4]:.2f}  {r[5]:.2f}  {r[6]:.2f}  {r[7]:.2f}  {r[8]:8.2f}  {r[9]:17.2f}  {r[10]:18.2f}")
