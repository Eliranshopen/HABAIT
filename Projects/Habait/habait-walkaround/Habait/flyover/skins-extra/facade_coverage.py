"""facade_coverage.py - tower coverage per facade direction and height band from a bake (bake_skins.py output), $0, venv python.

  python -X utf8 -I facade_coverage.py --baked <renders/baked-vN> [--out <json>] [--md]

Re-creates the method of renders/baked/facade_coverage.json (v4, written inline by the C1 sub-agent, no script was kept):
tower atlas texels (every 2nd row/column of tower_valid.npy) whose normal is horizontal and outward (|nz| < 0.5, dot(n_xy, radial
from TOWER_C) > 0.3), binned by the plan bearing of the normal relative to node-b's bearing from TOWER_C (114.74 deg) in 30 deg
bins; covered = coverage code 1..3 (sharp, soft, smeared) of <baked>/tower_cov.png; sharp_or_soft = code 1..2.
Height bands (floor 16 = z 0, 3.2 m per floor): low = floors 1-10 (z < -16), mid = floors 11-25 (z < 32), high = above.
On renders/baked (v4) this reproduces the stored table to +-0.01.
"""
import argparse, json, math
import numpy as np
import cv2

TOWER_C = (-5.9, -13.0)
NODE_B = (68.4477, -47.2597)
NORTH = 304.4          # compass = plan bearing + (360 - 304.4)


def run(baked):
    c = baked.rstrip("/") + "/_cache/"
    valid = np.load(c + "tower_valid.npy")[::2, ::2]
    pos = np.load(c + "tower_pos.npy", mmap_mode="r")[::2, ::2][valid].astype(np.float32)
    nrm = np.load(c + "tower_nrm.npy", mmap_mode="r")[::2, ::2][valid].astype(np.float32)
    cov = cv2.imread(baked.rstrip("/") + "/tower_cov.png")[::-1, :, ::-1][::2, ::2]   # RGB, row 0 = bake row 0
    code = np.rint(cov[..., 0] / 20).astype(int)[valid]
    nrm /= np.maximum(np.linalg.norm(nrm, axis=1), 1e-6)[:, None]
    rad = pos[:, :2] - np.array(TOWER_C, np.float32)
    rad /= np.maximum(np.linalg.norm(rad, axis=1), 1e-6)[:, None]
    sel = (np.abs(nrm[:, 2]) < 0.5) & ((nrm[:, :2] * rad).sum(1) > 0.3)
    bb = math.degrees(math.atan2(NODE_B[0] - TOWER_C[0], NODE_B[1] - TOWER_C[1])) % 360
    rel = (np.degrees(np.arctan2(nrm[:, 0], nrm[:, 1])) % 360 - bb) % 360
    b = (rel // 30).astype(int)
    z = pos[:, 2]
    covd = (code >= 1) & (code <= 3)
    ss = (code >= 1) & (code <= 2)
    bands = {"low": z < -16.0, "mid": (z >= -16.0) & (z < 32.0), "high": z >= 32.0}
    bins = []
    for k in range(12):
        m = sel & (b == k)
        pb = bb + 30 * k + 15
        row = {"rel_to_b": 30 * k, "plan_bearing": int(pb) % 360, "compass": int(pb + 360 - NORTH) % 360, "texels": int(m.sum())}
        for name, bm in bands.items():
            mm = m & bm
            row[name] = round(float(covd[mm].mean()), 2) if mm.any() else None
        row["all"] = round(float(covd[m].mean()), 2) if m.any() else None
        row["sharp_or_soft"] = round(float(ss[m].mean()), 2) if m.any() else None
        bins.append(row)
    tot = {"covered": round(float(covd[sel].mean()), 3), "sharp_or_soft": round(float(ss[sel].mean()), 3), "texels": int(sel.sum())}
    return {"bins_rel_to_node_b_deg": bins, "envelope": tot,
            "note": "tower atlas texels (every 2nd) with outward horizontal normals (|nz|<0.5, radial>0.3), covered = code 1..3; "
                    "low = floors 1-10 (z < -16), mid = floors 11-25, high = 26+ (skins-extra/facade_coverage.py)"}


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--baked", required=True)
    ap.add_argument("--out", default=None)
    a = ap.parse_args()
    r = run(a.baked)
    if a.out:
        json.dump(r, open(a.out, "w", encoding="utf8"), indent=1)
    for row in r["bins_rel_to_node_b_deg"]:
        print(row)
    print(r["envelope"])
