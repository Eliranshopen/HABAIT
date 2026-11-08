"""Geometry-stability metrics: does a generated video keep the clay's geometry, frame by frame? ($0, local CPU)

python -I edge_stability.py --clay CLAY.mp4 --video OUT.mp4 --name NAME --json OUT.json [--offset 0] [--map auto]
                            [--overlay OUT.jpg]

Output frame t <-> clay frame round(t * fps_clay / fps_out) + offset. Both are mapped to the output framing (cover-crop or
stretch; 'auto' picks the better on the first frames) and analysed at 480 px high.

1. Edge metrics (Canny, Gaussian 5x5, 50/150; tolerance r = 2 px):
   edge_iou   IoU of the dilated edge maps (asked for by the brief; dominated by how much texture the output adds)
   recall     clay edges with an output edge within r. Inflated by dense texture: a busy frame "explains" any edge.
   kappa      chance-corrected, orientation-aware recall: a clay edge counts only if an output edge of the same
              orientation (4 bins, +-1 bin) lies within r, and the chance level (share of pixels covered by such
              dilated output edges) is subtracted: (rec_o - chance) / (1 - chance). 0 = chance, 1 = every clay edge kept.
2. Clay-flow warp error (fwe): dense optical flow is measured on the CLAY (DIS, frame t+k -> t, k = 4), the OUTPUT frame t
   is warped with it and compared with output frame t+k (mean abs error, 0-255, inside the clay's structure band = pixels
   within 6 px of a clay edge). If the output moves exactly like the 3D model, this is small; a tower that changes shape,
   boils or slides raises it. fwe_ratio = fwe / (error without warping) (< 1 = the clay motion explains the output).
3. fwe_self: the same warp test with flow measured on the OUTPUT itself (whole frame): what its own motion cannot
   explain = boiling textures, popping, morphing. Lower = more temporally coherent, independent of clay alignment.
Temporal: t_cons = mean edge IoU(out_t, out_t+1) / the same for the clay; drift = recall last third - first third.
"""
import argparse, json

import cv2
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument("--clay", required=True)
ap.add_argument("--video", required=True)
ap.add_argument("--name", required=True)
ap.add_argument("--json", default=None)
ap.add_argument("--offset", type=int, default=0)
ap.add_argument("--map", default="auto", choices=["auto", "cover", "stretch"])
ap.add_argument("--max-frames", type=int, default=10000)
ap.add_argument("--overlay", default=None)
ap.add_argument("--k", type=int, default=4)
a = ap.parse_args()
K = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
KB = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13))


def read(path, n=10000):
    cap = cv2.VideoCapture(path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 24.0
    fr = []
    while len(fr) < n:
        ok, f = cap.read()
        if not ok:
            break
        fr.append(f)
    return fr, fps


def cover(img, W, H):
    h, w = img.shape[:2]
    s = max(W / w, H / h)
    img = cv2.resize(img, (int(round(w * s)), int(round(h * s))), interpolation=cv2.INTER_AREA)
    y0, x0 = (img.shape[0] - H) // 2, (img.shape[1] - W) // 2
    return img[y0:y0 + H, x0:x0 + W]


def to480(img):
    h, w = img.shape[:2]
    return cv2.resize(img, (int(round(w * 480.0 / h)), 480), interpolation=cv2.INTER_AREA)


def edges(img480):
    g = cv2.GaussianBlur(cv2.cvtColor(img480, cv2.COLOR_BGR2GRAY), (5, 5), 1.2)
    e = cv2.Canny(g, 50, 150) > 0
    gx = cv2.Sobel(g, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(g, cv2.CV_32F, 0, 1, ksize=3)
    ang = (np.degrees(np.arctan2(gy, gx)) + 180.0) % 180.0
    b = ((ang + 22.5) // 45).astype(np.int32) % 4  # 0, 45, 90, 135
    return e, b


def score(ec, eo):
    dc, do = cv2.dilate(ec.astype(np.uint8), K) > 0, cv2.dilate(eo.astype(np.uint8), K) > 0
    rec = (ec & do).sum() / max(1, ec.sum())
    pre = (eo & dc).sum() / max(1, eo.sum())
    iou = (dc & do).sum() / max(1, (dc | do).sum())
    return float(rec), float(pre), float(iou)


def kappa(ec, bc, eo, bo):
    hit, chance_px, n = 0, 0.0, max(1, ec.sum())
    for b in range(4):
        sel = ec & (bc == b)
        if not sel.any():
            continue
        ok = eo & ((bo == b) | (bo == (b + 1) % 4) | (bo == (b + 3) % 4))
        d = cv2.dilate(ok.astype(np.uint8), K) > 0
        hit += (sel & d).sum()
        chance_px += sel.sum() * d.mean()
    rec_o = hit / n
    ch = chance_px / n
    return float((rec_o - ch) / max(1e-6, 1 - ch)), float(rec_o), float(ch)


clay, fps_c = read(a.clay)
out, fps_o = read(a.video, a.max_frames)
H, W = out[0].shape[:2]
pairs = []
for t in range(len(out)):
    ci = int(round(t * fps_c / fps_o)) + a.offset
    if 0 <= ci < len(clay):
        pairs.append((t, ci))
mapping = a.map
if mapping == "auto":
    best = None
    for m in ("cover", "stretch"):
        r = np.mean([score(edges(to480(cover(clay[ci], W, H) if m == "cover" else cv2.resize(clay[ci], (W, H))))[0],
                           edges(to480(out[t]))[0])[0] for t, ci in pairs[:5]])
        if best is None or r > best[1]:
            best = (m, r)
    mapping = best[0]


def cmap(img):
    return cover(img, W, H) if mapping == "cover" else cv2.resize(img, (W, H), interpolation=cv2.INTER_AREA)


C480 = [to480(cmap(clay[ci])) for _, ci in pairs]
O480 = [to480(out[t]) for t, _ in pairs]
rows, tc_out, tc_clay = [], [], []
prev = None
for i, (t, ci) in enumerate(pairs):
    (ec, bc), (eo, bo) = edges(C480[i]), edges(O480[i])
    rec, pre, iou = score(ec, eo)
    kap, rec_o, ch = kappa(ec, bc, eo, bo)
    rows.append([t, ci, rec, pre, iou, kap, ch])
    if prev is not None:
        tc_out.append(score(prev[1], eo)[2])
        tc_clay.append(score(prev[0], ec)[2])
    prev = (ec, eo)

# clay-flow warp error
dis = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
fwe, fwe0, fwe_clay, fwe_self = [], [], [], []
for i in range(0, len(pairs) - a.k, 2):
    j = i + a.k
    gc0, gc1 = cv2.cvtColor(C480[i], cv2.COLOR_BGR2GRAY), cv2.cvtColor(C480[j], cv2.COLOR_BGR2GRAY)
    flow = dis.calc(gc1, gc0, None)  # for each pixel of frame j: where it was in frame i
    h, w = gc1.shape
    gx, gy = np.meshgrid(np.arange(w, dtype=np.float32), np.arange(h, dtype=np.float32))
    mx, my = gx + flow[..., 0], gy + flow[..., 1]
    valid = (mx >= 0) & (mx <= w - 1) & (my >= 0) & (my <= h - 1)
    band = (cv2.dilate(edges(C480[j])[0].astype(np.uint8), KB) > 0) & valid
    if band.sum() < 500:
        continue
    o0 = cv2.cvtColor(O480[i], cv2.COLOR_BGR2GRAY).astype(np.float32)
    o1 = cv2.cvtColor(O480[j], cv2.COLOR_BGR2GRAY).astype(np.float32)
    warped = cv2.remap(o0, mx, my, cv2.INTER_LINEAR)
    fwe.append(np.abs(warped - o1)[band].mean())
    fwe0.append(np.abs(o0 - o1)[band].mean())
    cw = cv2.remap(gc0.astype(np.float32), mx, my, cv2.INTER_LINEAR)
    fwe_clay.append(np.abs(cw - gc1.astype(np.float32))[band].mean())
    # self-consistency: flow measured on the OUTPUT itself; residual = boiling / morphing the flow cannot explain
    fo = dis.calc(o1.astype(np.uint8), o0.astype(np.uint8), None)
    sx, sy = gx + fo[..., 0], gy + fo[..., 1]
    sv = (sx >= 0) & (sx <= w - 1) & (sy >= 0) & (sy <= h - 1)
    sw = cv2.remap(o0, sx, sy, cv2.INTER_LINEAR)
    fwe_self.append(np.abs(sw - o1)[sv].mean())

A = np.array(rows, dtype=np.float64)
R, P, I, KA = A[:, 2], A[:, 3], A[:, 4], A[:, 5]
k3 = max(1, len(R) // 3)
res = {
    "name": a.name, "video": a.video, "frames": len(rows), "size": [W, H], "fps": fps_o, "map": mapping, "offset": a.offset,
    "edge_iou_mean": round(float(I.mean()), 4), "recall_mean": round(float(R.mean()), 4),
    "precision_mean": round(float(P.mean()), 4),
    "kappa_mean": round(float(KA.mean()), 4), "kappa_p10": round(float(np.percentile(KA, 10)), 4),
    "kappa_min": round(float(KA.min()), 4), "chance_mean": round(float(A[:, 6].mean()), 4),
    "drift_kappa_last_minus_first_third": round(float(KA[-k3:].mean() - KA[:k3].mean()), 4),
    "t_cons": round(float(np.mean(tc_out) / max(1e-6, np.mean(tc_clay))), 4) if tc_out else None,
    "fwe": round(float(np.mean(fwe)), 3) if fwe else None,
    "fwe_ratio": round(float(np.mean(fwe) / max(1e-6, np.mean(fwe0))), 4) if fwe else None,
    "fwe_clay_floor": round(float(np.mean(fwe_clay)), 3) if fwe_clay else None,
    "fwe_self": round(float(np.mean(fwe_self)), 3) if fwe_self else None,
    "per_frame_cols": ["t", "clay_t", "recall", "precision", "edge_iou", "kappa", "chance"],
    "per_frame": [[int(r[0]), int(r[1])] + [round(float(x), 4) for x in r[2:]] for r in rows],
}
if a.overlay and rows:
    i = len(rows) // 2
    ec, eo = edges(C480[i])[0], edges(O480[i])[0]
    vis = (O480[i] * 0.45).astype(np.uint8)
    vis[eo] = (0, 255, 0)
    vis[ec] = (0, 0, 255)
    vis[ec & (cv2.dilate(eo.astype(np.uint8), K) > 0)] = (0, 255, 255)
    cv2.putText(vis, f"{a.name} t={rows[i][0]}  red=clay edge lost  yellow=kept  green=output only", (8, 22),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)
    cv2.imwrite(a.overlay, vis, [cv2.IMWRITE_JPEG_QUALITY, 88])
if a.json:
    json.dump(res, open(a.json, "w"), indent=1)
print(json.dumps({k: v for k, v in res.items() if k not in ("per_frame", "per_frame_cols")}))
