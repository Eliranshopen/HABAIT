"""floor_composite.py — a floor finish that changes ONLY the floor (2026-11-05; parity R26).

finish-pano.mjs asks GPT Image 2.5 to change the floor of a passed picture and keep every wall, opening and piece at the same pixel; the
model does not always keep them (apt846 04-living marble, three seeds: a door drawn into the hallway at 239 deg, an invented wall end
the gate failed each time, while the passed source picture had none). The fix is deterministic and $0: the finished picture takes the
FLOOR from the finish and everything else from its passed source, so the finish can only ever change the floor.

The floor is read from the CG, not guessed from colours: Blender's depth.png (radial centimetres, rgb24 big-endian, render_pano.py's
contract) and the camera height give each pixel's height above the floor; a pixel lower than FLOOR_CM is floor. The two pictures meet
through a Laplacian-pyramid blend (band_blend.py), so no seam line is drawn where the floor meets the skirting.

    python floor_composite.py <source.png> <finish.png> <cg depth.png> <camera z cm> <out.png> [--restore u0,u1 ...]
        -> prints {"floor_share": .., "restored": [..]}
Two modes. Without --restore: the whole picture is the source's except the CG floor (strict; where the CG's furniture placeholders
differ from the painted furniture the finish's floor can be missed). With --restore u0,u1 (the gate's flagged bearings as u, the fix
loop's $0 step): the finish everywhere EXCEPT in those columns, where everything above the CG floor is the source's; each side's cut
column is moved (within 40 px) to where the two pictures' structure agrees best, as close-seam v3 does.
"""
import json
import math
import sys

import cv2
import numpy as np

sys.path.insert(0, __import__("os").path.dirname(__import__("os").path.abspath(__file__)))   # run with python -I
from band_blend import pyramid_blend  # noqa: E402

FLOOR_CM = 4.0      # a pixel this close to the floor plane is floor
GROW_PX = 2         # the mask is shrunk this much so the skirting line stays the source's
FLOOR_SLACK = int(__import__("os").environ.get("FLOOR_SLACK", "140"))   # rows above the render's floor line where the painted floor may start (env FLOOR_SLACK)
FLOOR_GROW = int(__import__('os').environ.get('FLOOR_GROW', '12'))   # --keep-furniture: the render's floor grown this much (px)
CHANGED_LUMA = 10   # the finish changed this pixel (luma, blurred) -> it is repainted floor


def floor_mask(depth_png, cam_z, W, H):
    d = cv2.imread(depth_png, cv2.IMREAD_COLOR)
    d = cv2.resize(d, (W, H), interpolation=cv2.INTER_NEAREST)
    b, g, r = d[..., 0].astype(np.int64), d[..., 1].astype(np.int64), d[..., 2].astype(np.int64)
    rng = (r << 16) | (g << 8) | b                       # cm, radial
    elev = (0.5 - (np.arange(H) + 0.5) / H) * math.pi    # +up
    z = cam_z + rng * np.sin(elev)[:, None]
    m = ((z < FLOOR_CM) & (rng > 0) & (elev[:, None] < 0)).astype(np.uint8)
    if GROW_PX:
        m = cv2.erode(m, np.ones((2 * GROW_PX + 1, 2 * GROW_PX + 1), np.uint8))
    return m.astype(np.float32)


def main():
    ps, pf, pd, cz, po = sys.argv[1], sys.argv[2], sys.argv[3], float(sys.argv[4]), sys.argv[5]
    S = cv2.imread(ps, cv2.IMREAD_COLOR)
    F = cv2.imread(pf, cv2.IMREAD_COLOR)
    H, W = S.shape[:2]
    if F.shape[:2] != (H, W):
        F = cv2.resize(F, (W, H), interpolation=cv2.INTER_AREA)
    M = floor_mask(pd, cz, W, H)
    restores = [tuple(float(v) for v in a.split(',')) for i, a in enumerate(sys.argv) if i > 0 and sys.argv[i - 1] == '--restore']
    done = []
    if restores:
        from band_blend import cut_scores
        st, _ = cut_scores(S, F)
        Mf = np.ones((H, W), np.float32)                 # 1 = the finish
        changed = cv2.GaussianBlur(np.abs(cv2.cvtColor(F, cv2.COLOR_BGR2GRAY).astype(np.float32) - cv2.cvtColor(S, cv2.COLOR_BGR2GRAY).astype(np.float32)), (0, 0), 3)
        for u0, u1 in restores:
            x0, x1 = int(u0 * W), int(u1 * W)
            lo = np.arange(max(1, x0 - 40), min(W - 2, x0 + 8) + 1); hi = np.arange(max(1, x1 - 8), min(W - 2, x1 + 40) + 1)
            cl, cr = int(lo[np.argmin(st[lo])]), int(hi[np.argmin(st[hi])])
            # per column: everything from the CG's first floor row down is the finish (the floor and what stands on it, which the finish
            # keeps), everything above is the passed source; the CG's floor pixels alone left patches of the old floor where the painted
            # room differs from the render's placeholders (apt846 08 concrete, 2026-11-06)
            # the painted floor line can sit up to FLOOR_SLACK rows above the render's: there, a pixel the finish CHANGED (the floor it
            # repainted) is the finish's, an unchanged one stays the source's
            for x in range(cl, cr + 1):
                ys = np.nonzero(M[:, x] > 0)[0]
                Mf[:, x] = 0.0
                if len(ys):
                    top = int(ys.min())
                    Mf[top:, x] = 1.0
                    a = max(0, top - FLOOR_SLACK)
                    Mf[a:top, x] = (changed[a:top, x] > CHANGED_LUMA).astype(np.float32)
            done.append({"u": [round(cl / W, 4), round(cr / W, 4)], "structure": [round(float(st[cl]), 2), round(float(st[cr]), 2)]})
        out = pyramid_blend(S, F, Mf, levels=2)
    elif '--whole' in sys.argv:
        # (2026-11-06) the floor of the WHOLE picture from the finish, the rest from the passed source: per column, from the render's
        # first floor row down the finish (the floor and what stands on it, which a finish keeps); in the FLOOR_SLACK rows above it the
        # finish only where it changed the pixel (the painted floor line can sit higher than the render's); above that the source
        changed = cv2.GaussianBlur(np.abs(cv2.cvtColor(F, cv2.COLOR_BGR2GRAY).astype(np.float32) - cv2.cvtColor(S, cv2.COLOR_BGR2GRAY).astype(np.float32)), (0, 0), 3)
        Mf = np.zeros((H, W), np.float32)
        KEEP_FURNITURE = '--keep-furniture' in sys.argv
        Mg = cv2.dilate(M, np.ones((2 * FLOOR_GROW + 1, 2 * FLOOR_GROW + 1), np.uint8))
        for x in range(W):
            ys = np.nonzero(M[:, x] > 0)[0]
            if not len(ys):
                continue
            top = int(ys.min())
            if KEEP_FURNITURE:
                # (2026-11-06, 02 concrete: a cheap finish redrew the far sofa) below the floor line only the render's floor (grown a
                # little) is the finish's; what stands on the floor stays the source's
                Mf[top:, x] = Mg[top:, x]
            else:
                Mf[top:, x] = 1.0
            a = max(0, top - FLOOR_SLACK)
            Mf[a:top, x] = (changed[a:top, x] > CHANGED_LUMA).astype(np.float32)
        Mf = cv2.morphologyEx(Mf, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
        out = pyramid_blend(S, F, Mf, levels=2)
        done.append({"mode": "whole", "finish_share": round(float(Mf.mean()), 4)})
    else:
        out = pyramid_blend(S, F, M, levels=2)   # a region swap, not a seam: tone must not bleed up the walls
    cv2.imwrite(po, out)
    print(json.dumps({"floor_share": round(float(M.mean()), 4), "floor_cm": FLOOR_CM, "restored": done}))


if __name__ == "__main__":
    main()
