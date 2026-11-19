"""Classify the camera motion between consecutive frames of the reference video.

For each pair: ORB features (UI regions masked), RANSAC homography.
A pure rotation about the camera centre (what a 360 panorama viewer does) is
explained by ONE homography with sub-pixel error; a moving camera (video with
parallax) leaves a large residual / low inlier ratio.

Usage: python -I motion_model.py <frames_dir> <out_csv> [fps]
Writes one row per pair; deterministic (fixed RANSAC seed).
"""
import csv
import glob
import os
import sys

import numpy as np
from skimage import io, color, transform
from skimage.feature import ORB, match_descriptors
from skimage.measure import ransac


def load(path):
    g = color.rgb2gray(io.imread(path)[..., :3])
    return g


def mask_ok(kp, h, w):
    y, x = kp[:, 0], kp[:, 1]
    # UI: header band, bottom tab bar, bottom-left slider, right-bottom hint
    bad = (y < 70) | (y > h - 55) | ((y > h - 120) & (x < 300)) | ((y > h - 110) & (x > w - 160))
    return ~bad


def main():
    d, out = sys.argv[1], sys.argv[2]
    fps = float(sys.argv[3]) if len(sys.argv) > 3 else 10.0
    t0 = float(sys.argv[4]) if len(sys.argv) > 4 else 0.0
    files = sorted(glob.glob(os.path.join(d, "*.png")))
    orb = ORB(n_keypoints=800, fast_threshold=0.05)
    feats = []
    for f in files:
        g = load(f)
        try:
            orb.detect_and_extract(g)
            kp, de = orb.keypoints, orb.descriptors
            m = mask_ok(kp, *g.shape)
            feats.append((kp[m], de[m]))
        except RuntimeError:
            feats.append((np.zeros((0, 2)), np.zeros((0, 256), bool)))
    rows = []
    for i in range(len(files) - 1):
        (k1, d1), (k2, d2) = feats[i], feats[i + 1]
        row = {"t": round(t0 + (i + 0.5) / fps, 2), "matches": 0, "shift_px": "", "H_inlier": "", "H_resid": "", "T_resid": ""}
        if len(k1) > 20 and len(k2) > 20:
            mt = match_descriptors(d1, d2, cross_check=True, max_ratio=0.8)
            row["matches"] = len(mt)
            if len(mt) >= 12:
                src = k1[mt[:, 0]][:, ::-1]
                dst = k2[mt[:, 1]][:, ::-1]
                row["shift_px"] = round(float(np.median(np.linalg.norm(dst - src, axis=1))), 2)
                Hm, inl = ransac((src, dst), transform.ProjectiveTransform, min_samples=4,
                                 residual_threshold=1.5, max_trials=2000, rng=0)
                if Hm is not None and inl is not None:
                    r = np.linalg.norm(Hm(src[inl]) - dst[inl], axis=1)
                    row["H_inlier"] = round(float(inl.mean()), 3)
                    row["H_resid"] = round(float(r.mean()), 3)
                Tm, inl2 = ransac((src, dst), transform.EuclideanTransform, min_samples=2,
                                  residual_threshold=1.5, max_trials=2000, rng=0)
                if Tm is not None and inl2 is not None:
                    row["T_resid"] = round(float(inl2.mean()), 3)  # inlier ratio of a flat shift/rotation
        rows.append(row)
    with open(out, "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    print("pairs", len(rows), "->", out)


if __name__ == "__main__":
    main()
