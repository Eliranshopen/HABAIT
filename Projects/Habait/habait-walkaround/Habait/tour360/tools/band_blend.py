"""band_blend.py — paste a band repair's answer into the picture with no visible edge (2026-11-05; parity R25).

close-seam.mjs v1 cross-faded the answer into the picture over 24 px: where the two disagreed, shelves and counters showed twice (ghosts).
v2 cut hard at the column where they agree least badly: no ghost, but a TONE step (a wall a shade lighter inside the band) and any
structure that does not line up still showed as a vertical line (apt846 02-kitchen and 04-living 2026-11-05, found by Eliran's eye).

v3, this file: the cut column on each side is where the two pictures' STRUCTURE (the high-pass detail: edges, shelves, grout, texture)
agrees best; the paste is a Laplacian-pyramid blend over that cut, so fine detail switches sharply at the cut (no ghost) while tone and
light are blended over a wide zone (no tone step). What the blend cannot hide is structure that does not line up; that is measured at
each cut (`structure`, mean |high-pass difference| over rows 15-90 %) and the gate fails it (fidelity-gate R25, fidelity.json band_edge).

    python band_blend.py <picture_rolled.png> <answer.png> <b0> <b1> <out.png>   -> prints {"cuts": [{x, structure, tone}, ...]}
The pictures are in close-seam's rolled frame (the band in the middle, no wrap). Deterministic: same inputs, same bytes.
"""
import json
import os
import sys

import cv2
import numpy as np

LEVELS = 6          # 2048 wide -> 32 at the coarsest level: tone blends over ~100 px, detail over ~2 px
SEARCH_OUT, SEARCH_IN = int(os.environ.get("BAND_CUT_SEARCH", "40")), 8
ROWS = (0.15, 0.90)


def highpass(img):
    # band-pass (difference of Gaussians, sigma 1.5 and 20): the OBJECTS at a column (a shelf, a frame, a door edge, a white
    # strip) show; a whole wall's tone offset does not (the blend carries tone) and a texture's grain only weakly
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32)
    return cv2.GaussianBlur(g, (0, 0), 1.5) - cv2.GaussianBlur(g, (0, 0), 20.0)


def luma(img):
    return cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32)


def cut_scores(F, A):
    H = F.shape[0]
    r0, r1 = int(ROWS[0] * H), int(ROWS[1] * H)
    hs = np.abs(highpass(A) - highpass(F))[r0:r1]
    # structure at a column = the mean over a 9-px window: the cut goes where the two agree on what stands there, not only on
    # one column (a lone column of agreement beside a white strip the answer removed would leave the strip standing)
    st = cv2.blur(hs, (9, 1)).mean(axis=0)
    tn = np.abs(cv2.blur(luma(A), (9, 9)) - cv2.blur(luma(F), (9, 9)))[r0:r1].mean(axis=0)
    return st, tn


def pyramid_blend(F, A, M, levels=LEVELS):
    gf, ga, gm = [F.astype(np.float32)], [A.astype(np.float32)], [M.astype(np.float32)]
    for _ in range(levels):
        gf.append(cv2.pyrDown(gf[-1])); ga.append(cv2.pyrDown(ga[-1])); gm.append(cv2.pyrDown(gm[-1]))
    out = gm[-1][..., None] * ga[-1] + (1 - gm[-1][..., None]) * gf[-1]
    for i in range(levels - 1, -1, -1):
        size = (gf[i].shape[1], gf[i].shape[0])
        lf = gf[i] - cv2.pyrUp(gf[i + 1], dstsize=size)
        la = ga[i] - cv2.pyrUp(ga[i + 1], dstsize=size)
        m = gm[i][..., None]
        out = cv2.pyrUp(out, dstsize=size) + m * la + (1 - m) * lf
    return np.clip(np.rint(out), 0, 255).astype(np.uint8)


ALIGN_HALF = 24      # columns each side of a band edge where the answer's lines are matched to the picture's
ALIGN_BLOCK = 48     # rows per block
ALIGN_MAX = int(os.environ.get("BAND_ALIGN_MAX", "16"))   # px searched (16 since a 12-px skirting step at apt846 04, 2026-11-05; 10 before: close-seam --align-max 10 reproduces those composites byte for byte)


def vertical_offsets(F, A, x):
    """dy(y): how far DOWN the answer draws what the picture draws at row y, near column x (A(y + dy) ~ F(y)).
    The model redraws a band a few px higher or lower (a ceiling line, a skirting, a counter edge step at the cut); per block of
    rows the vertical-gradient profiles are cross-correlated; a block with no line in it carries no vote."""
    H = F.shape[0]
    x0, x1 = max(0, x - ALIGN_HALF), min(F.shape[1], x + ALIGN_HALF)
    gf = np.abs(np.diff(cv2.GaussianBlur(luma(F[:, x0:x1]), (0, 0), 1.0).mean(axis=1)))
    ga = np.abs(np.diff(cv2.GaussianBlur(luma(A[:, x0:x1]), (0, 0), 1.0).mean(axis=1)))
    ys, ds, ws = [], [], []
    for y0 in range(ALIGN_MAX, H - ALIGN_BLOCK - ALIGN_MAX - 1, ALIGN_BLOCK // 2):
        f = gf[y0:y0 + ALIGN_BLOCK]
        if f.max() < 3.0:
            continue
        sc = [float(np.dot(f - f.mean(), ga[y0 + d:y0 + d + ALIGN_BLOCK] - ga[y0 + d:y0 + d + ALIGN_BLOCK].mean()))
              for d in range(-ALIGN_MAX, ALIGN_MAX + 1)]
        k = int(np.argmax(sc))
        if sc[k] <= 0 or k in (0, 2 * ALIGN_MAX):
            continue
        ys.append(y0 + ALIGN_BLOCK / 2); ds.append(k - ALIGN_MAX); ws.append(sc[k])
    if not ys:
        return np.zeros(H, np.float32), 0.0
    d = np.array(ds, np.float32)
    if len(d) >= 3:                                   # a lone block that disagrees with both neighbours is noise
        d = np.array([np.median(d[max(0, i - 1):i + 2]) for i in range(len(d))], np.float32)
    dy = np.interp(np.arange(H), ys, d).astype(np.float32)
    return cv2.GaussianBlur(dy.reshape(-1, 1), (1, 0), ALIGN_BLOCK / 2).ravel(), float(np.abs(d).max())


def align_answer(F, A, b0, b1):
    """Bend the answer so its lines meet the picture's at both band edges: full offset at the edge, fading to none at the band's
    middle (the repaint keeps its own drawing where nothing meets it). Returns the bent answer and the largest offset per side."""
    H, W = F.shape[:2]
    dl, ml = vertical_offsets(F, A, b0)
    dr, mr = vertical_offsets(F, A, b1)
    mid = (b0 + b1) / 2.0
    xs = np.arange(W, dtype=np.float32)
    wl = np.clip((mid - xs) / max(1.0, mid - b0), 0, 1)       # 1 at and left of b0, 0 at the middle
    wr = np.clip((xs - mid) / max(1.0, b1 - mid), 0, 1)
    my = np.arange(H, dtype=np.float32)[:, None] + dl[:, None] * wl[None, :] + dr[:, None] * wr[None, :]
    mx = np.repeat(xs[None, :], H, axis=0)
    return cv2.remap(A, mx, my.astype(np.float32), cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE), (ml, mr)


ALIGN_AT = os.environ.get("BAND_ALIGN_AT", "cut")   # "edge" reproduces the composites made before 2026-11-05 late
LINE_ROWS = (0.12, 0.94)
LINE_MIN_GRAD = 4.0     # luma per px: a skirting, counter edge, shelf, wall-ceiling line; texture grain stays below
LINE_SEARCH = 18        # px a line may move across a cut and still be "the same line"


def _peaks(p, thr):
    a = np.abs(p)
    return [y for y in range(2, len(p) - 2) if a[y] >= thr and a[y] >= a[y - 1] and a[y] >= a[y + 1] and a[y] > a[y - 2] and a[y] > a[y + 2]]


def pair_steps(F, A, x):
    """R25b: line continuity at a cut, measured where it is decided. Left of the cut the picture is F (the picture), right of it A (the
    repaint), and both draw the same room, so every near-horizontal line they both carry (a skirting, a counter edge, a shelf, the
    wall-ceiling line) must sit at the same row in both at the cut. Per strong line in either picture (columns x-6..x+6), the other
    picture's profile is correlated (normalised, window 21 rows, search 18): a confident match (>= 0.7) at a shift of s px is a step of
    s px at the seam. A line only one picture carries has no confident match and is left to the structure score. Largest first."""
    H, W = F.shape[:2]
    r0, r1 = int(LINE_ROWS[0] * H), int(LINE_ROWS[1] * H)
    c0, c1 = max(0, x - 6), min(W, x + 7)

    def prof(img):
        g = cv2.GaussianBlur(luma(img[:, max(0, c0 - 4):min(W, c1 + 4)]), (0, 0), 1.2)
        return np.diff(g, axis=0)[r0:r1, (c0 - max(0, c0 - 4)):(c0 - max(0, c0 - 4)) + (c1 - c0)].mean(axis=1)
    pf, pa = prof(F), prof(A)
    HW = 10
    out = []
    for P, Q in ((pf, pa), (pa, pf)):
        for y in _peaks(P, LINE_MIN_GRAD):
            if y < HW + LINE_SEARCH or y > len(P) - HW - LINE_SEARCH - 1:
                continue
            wa = P[y - HW:y + HW + 1] - P[y - HW:y + HW + 1].mean(); na = np.linalg.norm(wa)
            best, bc = 0, -1.0
            for d in range(-LINE_SEARCH, LINE_SEARCH + 1):
                wb = Q[y + d - HW:y + d + HW + 1]; wb = wb - wb.mean(); nb = np.linalg.norm(wb)
                if na < 1e-6 or nb < 1e-6:
                    continue
                c = float(np.dot(wa, wb) / (na * nb))
                if c > bc:
                    best, bc = d, c
            if bc >= 0.7 and abs(best) < LINE_SEARCH:     # a peak on the search's edge located nothing (two different grout patterns)
                out.append(abs(best))
    return sorted(out, reverse=True)

def main():
    pf, pa, b0, b1, po = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), sys.argv[5]
    F = cv2.imread(pf, cv2.IMREAD_COLOR)
    A = cv2.imread(pa, cv2.IMREAD_COLOR)
    H, W = F.shape[:2]
    if A.shape[:2] != (H, W):
        A = cv2.resize(A, (W, H), interpolation=cv2.INTER_AREA)
    lo = np.arange(max(1, b0 - SEARCH_OUT), min(W - 2, b0 + SEARCH_IN) + 1)
    hi = np.arange(max(1, b1 - SEARCH_IN), min(W - 2, b1 + SEARCH_OUT) + 1)
    if ALIGN_AT == 'cut':
        # (2026-11-05) the lines are matched where the cut will be, not at the band's edge: a cut 40 px outside the band met the
        # picture's skirting 12 px off while the edge had matched (apt846 04, the coordinator's skirting step)
        st0, _ = cut_scores(F, A)
        xl, xr = int(lo[np.argmin(st0[lo])]), int(hi[np.argmin(st0[hi])])
        A, shifts = align_answer(F, A, xl, xr)
    else:
        A, shifts = align_answer(F, A, b0, b1)
    st, tn = cut_scores(F, A)
    cl = int(lo[np.argmin(st[lo])])
    cr = int(hi[np.argmin(st[hi])])
    M = np.zeros((H, W), np.float32)
    M[:, cl:cr + 1] = 1.0
    out = pyramid_blend(F, A, M)
    cv2.imwrite(po, out)
    def ls(c):
        st_ = pair_steps(F, A, c)
        return {"line_step_px": float(st_[0]) if st_ else 0.0, "lines": len(st_)}
    print(json.dumps({"blend": f"aligned@{ALIGN_AT}+laplacian-{LEVELS}", "cuts": [
        {"x": c, "structure": round(float(st[c]), 2), "tone": round(float(tn[c]), 2), "aligned_px": round(s, 1), **ls(c)}
        for c, s in ((cl, shifts[0]), (cr, shifts[1]))]}))


if __name__ == "__main__":
    main()
