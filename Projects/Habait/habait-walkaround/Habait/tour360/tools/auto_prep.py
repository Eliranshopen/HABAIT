#!/usr/bin/env python
"""auto_prep.py <crop.png> <plan-grey.png>

Turns a plan image into the greyscale trace-plan.mjs reads (walls = mid-grey 70..150, strokes = black < 70, free = white).

- A CAD sales plan (846: black and white, < 3 % saturated pixels) passes through unchanged: trace-plan's dark-band rule applies.
- A rendered brochure plan (colour, textures, furniture, plants): walls are taken from the WALL COLOUR only. The colour is sampled
  from the thickest dark, unsaturated band (the outer wall); the wall mask = pixels within a small colour distance of it, opened
  to a minimum thickness, small specks dropped. Furniture, rugs, tiles and planting never become walls. Light-blue window symbols
  become solid wall-grey bars (no leak) and are listed in glazing.json (panes); the thin dark strokes (door swing arcs, door
  leaves) are written to strokes.png for the door detector. Everything else is free (white).
Writes <dir>/prep.json with the mode and the sampled wall colour.
"""
import json
import os
import sys

import cv2
import numpy as np


def main():
    src, dst = sys.argv[1], sys.argv[2]
    out_dir = os.path.dirname(os.path.abspath(dst))
    img = cv2.imread(src, cv2.IMREAD_COLOR)
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    h, s, v = hsv[..., 0].astype(int), hsv[..., 1].astype(int), hsv[..., 2].astype(int)
    grey = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    sat = s > 55
    n = grey.size
    if sat.sum() / n < 0.03:
        cv2.imwrite(dst, grey)
        json.dump({"mode": "sheet", "saturated_pct": round(sat.sum() / n * 100, 2)}, open(os.path.join(out_dir, "prep.json"), "w"), indent=1)
        json.dump({"source": "auto_prep.py (sheet: none)", "glazing": []}, open(os.path.join(out_dir, "glazing.json"), "w"), indent=1)
        print(f"auto_prep: sheet mode (saturated {sat.sum() / n * 100:.2f} %), unchanged")
        return
    # --- the wall colour: the median of the thickest dark unsaturated band
    dark = ((grey < 130) & (s < 40)).astype(np.uint8)
    dist = cv2.distanceTransform(dark, cv2.DIST_L2, 5)
    thick_t = max(4.0, float(np.percentile(dist[dark > 0], 90)) * 0.6) if dark.any() else 4.0
    core = dist >= thick_t
    wall_bgr = np.median(img[core], 0) if core.sum() > 500 else np.array([107, 107, 107])
    diff = np.abs(img.astype(int) - wall_bgr.astype(int)).max(2)
    wall = ((diff <= 14) & (s < 40)).astype(np.uint8) * 255
    # minimum thickness: an interior wall is >= ~8 cm; drop thin lines, text, rug stripes; heal anti-aliased edges
    k_open = max(3, int(round(thick_t * 0.5)) | 1)
    wall = cv2.morphologyEx(wall, cv2.MORPH_OPEN, np.ones((k_open, k_open), np.uint8))
    wall = cv2.morphologyEx(wall, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    n_, lab, stats, _ = cv2.connectedComponentsWithStats(wall, connectivity=8)
    min_area = (k_open * 6) ** 2
    keep = np.zeros(n_, bool)
    keep[1:] = stats[1:, cv2.CC_STAT_AREA] >= min_area
    wall = (keep[lab] & (wall > 0)).astype(np.uint8) * 255
    # --- windows: light-blue symbols -> solid wall-grey bars + glazing.json
    blue = sat & (h >= 85) & (h <= 130) & (v > 90)
    bm = cv2.morphologyEx(blue.astype(np.uint8) * 255, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    nb, labb, statb, _ = cv2.connectedComponentsWithStats(bm, connectivity=8)
    glazing = []
    for k in range(1, nb):
        x, y, w, hh, area = statb[k]
        if area < 60 or max(w, hh) < 20:
            bm[labb == k] = 0
            continue
        cs, _ = cv2.findContours((labb == k).astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        box = cv2.boxPoints(cv2.minAreaRect(max(cs, key=cv2.contourArea)))
        glazing.append({"bbox_px": [int(x), int(y), int(x + w), int(y + hh)], "rect_px": [[round(float(px), 1), round(float(py), 1)] for px, py in box], "area_px": int(area)})
    # --- thin dark strokes (door arcs and leaves), for the door detector — not walls
    strokes = ((grey < 150) & (s < 50) & (wall == 0)).astype(np.uint8) * 255
    strokes = cv2.subtract(strokes, cv2.morphologyEx(strokes, cv2.MORPH_OPEN, np.ones((7, 7), np.uint8)))   # thin only
    cv2.imwrite(os.path.join(out_dir, "strokes.png"), strokes)
    out = np.full_like(grey, 255)
    out[wall > 0] = 110
    out[bm > 0] = 110
    cv2.imwrite(dst, out)
    json.dump({"source": "auto_prep.py blue components", "glazing": glazing}, open(os.path.join(out_dir, "glazing.json"), "w"), indent=1)
    json.dump({"mode": "brochure", "saturated_pct": round(sat.sum() / n * 100, 2), "wall_bgr": [int(c) for c in wall_bgr], "thick_px": round(thick_t, 1), "open_kernel_px": k_open,
               "wall_pct": round((wall > 0).sum() / n * 100, 2), "windows": len(glazing)}, open(os.path.join(out_dir, "prep.json"), "w"), indent=1)
    print(f"auto_prep: brochure mode, wall colour {[int(c) for c in wall_bgr]} (from bands >= {thick_t:.1f} px), walls {(wall > 0).sum() / n * 100:.1f} %, {len(glazing)} window bars")


if __name__ == "__main__":
    main()
