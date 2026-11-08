"""check_static.py - card 16 (C2) gate: the static scene must not move while the life layers animate.

Compares the FIRST and the LAST frame of a preview inside the tower mask. Pixels covered by a life element (bird, car,
person, tree) in either frame are excluded through the life mattes that life.py renders at those two frames, dilated by
--dilate px (anti-aliasing / chroma bleed). Everything else inside the mask must be bit-identical (--tol 0).

  $PY check_static.py <frames_dir | video.mp4> --mask tower-mask.png [--matte matte_first.png,matte_last.png] [--dilate 2] [--tol 0]
  $PY check_static.py --selftest

<frames_dir>: life.py's lossless PNG frames (the source of record for this gate). A video works too, but H.264 is lossy
between an I-frame and a P-frame, so on an mp4 expect a non-zero count unless --tol is raised; the 0-px claim is made on
the PNG frames.
mask: RGBA -> alpha > 127; RGB/L -> luminance > 127. matte: alpha >= 1 (any coverage) -> excluded.
Prints "tower mask diff first/last: N px"; exit 0 when N == 0, 1 when N > 0, 2 on bad input.
"""
import argparse
import os
import sys

import numpy as np
from PIL import Image


def load_rgb(path):
    return np.asarray(Image.open(path).convert("RGB"), dtype=np.int16)


def first_last(src):
    if os.path.isdir(src):
        files = sorted(f for f in os.listdir(src) if f.lower().endswith(".png"))
        if len(files) < 2:
            raise SystemExit("need >= 2 PNG frames in %s" % src)
        return load_rgb(os.path.join(src, files[0])), load_rgb(os.path.join(src, files[-1])), files[0], files[-1], len(files)
    import cv2
    cap = cv2.VideoCapture(src)
    n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    ok, a = cap.read()
    last = None
    k = 1
    while True:
        ok2, b = cap.read()
        if not ok2:
            break
        last = b
        k += 1
    cap.release()
    if not ok or last is None:
        raise SystemExit("cannot read 2 frames from %s" % src)
    return a[..., ::-1].astype(np.int16), last[..., ::-1].astype(np.int16), "frame 1", "frame %d" % k, k


def load_mask(path):
    im = Image.open(path)
    if im.mode in ("RGBA", "LA"):
        return np.asarray(im.getchannel("A")) > 127
    return np.asarray(im.convert("L")) > 127


def load_matte(path):
    im = Image.open(path)
    if im.mode in ("RGBA", "LA"):
        return np.asarray(im.getchannel("A")) >= 1
    return np.asarray(im.convert("L")) >= 1


def dilate(m, r):
    if r <= 0:
        return m
    out = m.copy()
    H, W = m.shape
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if dx * dx + dy * dy > r * r:
                continue
            ys = slice(max(dy, 0), H + min(dy, 0)); yd = slice(max(-dy, 0), H + min(-dy, 0))
            xs = slice(max(dx, 0), W + min(dx, 0)); xd = slice(max(-dx, 0), W + min(-dx, 0))
            out[yd, xd] |= m[ys, xs]
    return out


def compare(a, b, mask, excl, tol):
    if a.shape != b.shape or a.shape[:2] != mask.shape:
        raise SystemExit("size mismatch: first %s last %s mask %s" % (a.shape, b.shape, mask.shape))
    changed = (np.abs(a - b) > tol).any(axis=2)
    use = mask & ~excl
    return int((changed & use).sum()), int((changed & mask).sum()), int(mask.sum()), int((mask & excl).sum())


def selftest():
    rng = np.random.default_rng(0)
    H, W = 27, 48
    a = rng.integers(0, 255, (H, W, 3)).astype(np.int16)
    mask = np.zeros((H, W), bool); mask[5:22, 20:30] = True
    ok = True
    # 1 identical -> 0
    d, raw, n, e = compare(a, a.copy(), mask, np.zeros_like(mask), 0)
    ok &= d == 0
    # 2 one static pixel inside the mask changes by 1 -> 1
    b = a.copy(); b[10, 25, 1] += 1
    d, raw, n, e = compare(a, b, mask, np.zeros_like(mask), 0)
    ok &= d == 1
    # 3 the same change under a life matte -> excluded -> 0, raw 1
    m = np.zeros_like(mask); m[10, 25] = True
    d, raw, n, e = compare(a, b, mask, dilate(m, 2), 0)
    ok &= d == 0 and raw == 1
    # 4 a change outside the mask is ignored
    b2 = a.copy(); b2[0, 0] += 5
    d, raw, n, e = compare(a, b2, mask, np.zeros_like(mask), 0)
    ok &= d == 0
    # 5 dilation radius 2 covers a 2-px neighbour, not a 3-px one
    m2 = np.zeros_like(mask); m2[10, 22] = True
    ok &= bool(dilate(m2, 2)[10, 24]) and not bool(dilate(m2, 2)[10, 25])
    print("check_static selftest:", "PASS" if ok else "FAIL")
    return 0 if ok else 1


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src", nargs="?")
    ap.add_argument("--mask")
    ap.add_argument("--matte", default="")
    ap.add_argument("--dilate", type=int, default=2)
    ap.add_argument("--tol", type=int, default=0)
    ap.add_argument("--selftest", action="store_true")
    a = ap.parse_args()
    if a.selftest:
        return selftest()
    if not a.src or not a.mask:
        ap.print_usage()
        return 2
    fa, fb, na, nb, n = first_last(a.src)
    mask = load_mask(a.mask)
    excl = np.zeros_like(mask)
    for p in [x for x in a.matte.split(",") if x]:
        excl |= load_matte(p)
    excl = dilate(excl, a.dilate)
    d, raw, npx, nex = compare(fa, fb, mask, excl, a.tol)
    print("frames: %s .. %s (%d), %dx%d" % (na, nb, n, fa.shape[1], fa.shape[0]))
    print("tower mask: %d px; excluded by life matte (dilate %d): %d px; tol %d" % (npx, a.dilate, nex, a.tol))
    print("raw diff inside mask incl. life: %d px" % raw)
    print("tower mask diff first/last: %d px" % d)
    if npx == 0:
        print("FAIL: empty tower mask")
        return 2
    return 0 if d == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
