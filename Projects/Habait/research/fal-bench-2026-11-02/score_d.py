"""score_d.py - branch continuity: how exactly does each clip start from the anchor frame, and does it follow the clay?

Per clip: frame-0 fidelity vs the anchor (SSIM on grey, mean abs diff, edge share), the same for frames 1..5 (does it hold
or snap), clay-edge agreement at 25/50/75/100 % of the clip (exterior-ish part only matters up to the slider), the
end-frame similarity to the Kling full flight's frame 409 (the look the graph continues into). Writes scores-D.json and
review/D_*.jpg (first 6 frames per model vs the anchor; 8-frame strips).
"""
import glob
import json
import os

import cv2
import numpy as np
from skimage.metrics import structural_similarity as ssim

HERE = os.path.dirname(os.path.abspath(__file__)).replace("\\", "/")
anchor = cv2.imread(f"{HERE}/inputs/D_anchor_f193.png")
end_ref = cv2.imread(f"{HERE}/inputs/D_end_f409.png")
clay = cv2.VideoCapture(f"{HERE}/inputs/D_clay_193_409.mp4")
NC = int(clay.get(7))


def grey(im, w=640, h=360):
    return cv2.cvtColor(cv2.resize(im, (w, h)), cv2.COLOR_BGR2GRAY)


def fit(im, ref):
    """centre-crop im to ref's aspect, resize to ref."""
    H, W = ref.shape[:2]
    h, w = im.shape[:2]
    ar = W / H
    if w / h > ar + 0.01:
        nw = int(h * ar); x0 = (w - nw) // 2; im = im[:, x0:x0 + nw]
    elif w / h < ar - 0.01:
        nh = int(w / ar); y0 = (h - nh) // 2; im = im[y0:y0 + nh]
    return cv2.resize(im, (W, H))


def edge_share(a, b):
    e = lambda im: cv2.Canny(im, 60, 160)  # noqa: E731
    ea, eb = e(a), e(b)
    k = np.ones((7, 7), np.uint8)
    return float(((ea > 0) & (cv2.dilate(eb, k) > 0)).sum()) / max(1, float((ea > 0).sum()))


def sim(a, b):
    ga, gb = grey(a), grey(b)
    return {"ssim": round(float(ssim(ga, gb)), 3), "mad": round(float(np.abs(ga.astype(np.float32) - gb.astype(np.float32)).mean()), 1),
            "edges": round(edge_share(ga, gb), 3)}


def frames(p):
    cap = cv2.VideoCapture(p)
    out = []
    while True:
        ok, f = cap.read()
        if not ok:
            break
        out.append(f)
    return out


res = {}
strips = []
firsts = [cv2.resize(anchor, (320, 180))]
cv2.putText(firsts[0], "ANCHOR", (6, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
for p in sorted(glob.glob(f"{HERE}/D-branch/*.mp4")):
    name = os.path.basename(p)[:-4]
    fr = frames(p)
    n = len(fr)
    fr = [fit(f, anchor) for f in fr]
    first = sim(fr[0], anchor)
    hold = [sim(fr[i], anchor)["ssim"] for i in range(1, min(6, n))]
    # clay agreement at 25/50/75/100 %
    agree = []
    for rel in (0.0, 0.25, 0.5, 0.75, 1.0):
        i = int(round(rel * (n - 1))); clay.set(1, int(round(rel * (NC - 1)))); ok, c = clay.read()
        agree.append(round(edge_share(grey(c), grey(fr[i])), 2))
    endsim = sim(fr[-1], end_ref)
    res[name] = {"frames": n, "first_vs_anchor": first, "ssim_frames_1_5": hold, "clay_edges_found_0_25_50_75_100": agree,
                 "last_vs_kling_f409": endsim}
    # review tiles: first 6 frames
    row = [cv2.resize(anchor, (320, 180))]
    cv2.putText(row[0], "anchor", (6, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
    for i in range(6):
        t = cv2.resize(fr[min(i, n - 1)], (320, 180)); cv2.putText(t, f"{name[:14]} f{i + 1}", (6, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 2); row.append(t)
    firsts.append(np.hstack(row))
    idx = [int(round(i * (n - 1) / 7)) for i in range(8)]
    tiles = [cv2.resize(fr[i], (480, 270)) for i in idx]
    for t, i in zip(tiles, idx):
        cv2.putText(t, f"f{i + 1}", (6, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
    s = np.vstack([np.hstack(tiles[:4]), np.hstack(tiles[4:])])
    bar = np.zeros((34, s.shape[1], 3), np.uint8); cv2.putText(bar, name, (8, 26), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 255), 2)
    strips.append(np.vstack([bar, s]))
json.dump(res, open(f"{HERE}/scores-D.json", "w", encoding="utf-8"), indent=1)
firsts[0] = np.hstack([firsts[0]] + [np.zeros((180, 320, 3), np.uint8)] * 6)
cv2.imwrite(f"{HERE}/review/D_first_frames.jpg", np.vstack(firsts), [cv2.IMWRITE_JPEG_QUALITY, 88])
for i in range(0, len(strips), 3):
    cv2.imwrite(f"{HERE}/review/D_strip_{i // 3}.jpg", np.vstack(strips[i:i + 3]), [cv2.IMWRITE_JPEG_QUALITY, 84])
for k, v in res.items():
    print(f"{k:28s} n={v['frames']} first ssim {v['first_vs_anchor']['ssim']} mad {v['first_vs_anchor']['mad']} edges {v['first_vs_anchor']['edges']} | hold {v['ssim_frames_1_5']} | clay {v['clay_edges_found_0_25_50_75_100']} | end ssim {v['last_vs_kling_f409']['ssim']}")
