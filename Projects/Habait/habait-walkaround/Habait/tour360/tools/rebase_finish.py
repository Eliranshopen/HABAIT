"""rebase_finish.py — carry a floor finish over to a repaired source picture, $0 (2026-11-06; parity R26b).

A floor finish is made from one source picture. When that source later gets a band repair (the oven under the hob), the finish must
show the repair too, but a fresh finish costs a paid call and may redraw other things. This takes the OLD finish everywhere except where
the NEW source differs from the OLD source above the floor (the repair), and there takes the new source. The floor (CG depth: height
under FLOOR_CM) is never taken from the new source, so the finish's floor stays the finish's.

    python rebase_finish.py <old source.png> <new source.png> <old finish (png|webp)> <cg depth.png> <camera z cm> <out.png>
        [--stretched top left aw ah]   the old finish is a raw answer that was STRETCHED to 2:1 (an unregistered nano answer): the
                                       repair is mapped into its frame (finish x',y' <- source left + x'*aw/W, top + y'*ah/H)
    -> prints {"changed_share": .., "taken_px": ..}
"""
import json
import math
import sys

import cv2
import numpy as np

FLOOR_CM = 3.0
DIFF = 12


def main():
    a = sys.argv
    S0, S1, F = cv2.imread(a[1]), cv2.imread(a[2]), cv2.imread(a[3])
    H, W = S0.shape[:2]
    if F.shape[:2] != (H, W):
        F = cv2.resize(F, (W, H), interpolation=cv2.INTER_AREA)
    d = cv2.resize(cv2.imread(a[4], cv2.IMREAD_COLOR), (W, H), interpolation=cv2.INTER_NEAREST)
    rng = (d[..., 2].astype(np.int64) << 16) | (d[..., 1].astype(np.int64) << 8) | d[..., 0].astype(np.int64)
    elev = (0.5 - (np.arange(H) + 0.5) / H) * math.pi
    z = float(a[5]) + rng * np.sin(elev)[:, None]
    above = (z >= FLOOR_CM).astype(np.uint8)
    diff = cv2.GaussianBlur(np.abs(S1.astype(np.int16) - S0.astype(np.int16)).max(axis=2).astype(np.float32), (0, 0), 1.5)
    M = ((diff > DIFF) & (above > 0)).astype(np.uint8)
    M = cv2.morphologyEx(M, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    M = cv2.dilate(M, np.ones((3, 3), np.uint8)).astype(np.float32)
    src = S1
    if '--stretched' in a:
        i = a.index('--stretched')
        top, left, aw, ah = (float(v) for v in a[i + 1:i + 5])
        xs, ys = np.meshgrid(np.arange(W, dtype=np.float32), np.arange(H, dtype=np.float32))
        mx = (left + xs * aw / W).astype(np.float32)
        my = (top + ys * ah / H).astype(np.float32)
        src = cv2.remap(S1, mx, my, cv2.INTER_LINEAR)
        M = cv2.remap(M, mx, my, cv2.INTER_LINEAR)
    M = cv2.GaussianBlur(M, (0, 0), 1.0)[..., None]
    out = (F * (1 - M) + src * M).astype(np.uint8)
    cv2.imwrite(a[6], out)
    print(json.dumps({"changed_share": round(float(M.mean()), 5), "taken_px": int((M[..., 0] > 0.5).sum())}))


if __name__ == "__main__":
    main()
