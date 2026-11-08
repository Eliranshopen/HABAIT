#!/usr/bin/env python
"""auto_doors.py — door swing arcs on a plan image (auto-trace, 2026-11-04). Used by auto_finalize.py and trace_check.py.

detect_arcs(stroke_mask, wall_mask, ppc) -> [{hinge_px, r_px, r_cm, a0_deg, a1_deg, chord_px: [[x,y],[x,y]], leaf_px}]
A door is drawn as a quarter circle (radius = the leaf width, 60..110 cm) centred on the hinge. Candidates come from a Hough
circle vote on the thin strokes; a candidate is kept when the stroke pixels on its circle cover ONE contiguous angular span of
60..120 degrees (a quarter, not a full circle or a curved facade). The doorway chord is the radius at the end of the span whose
extension continues into wall (the wall the door sits in); the other radius is the open leaf.
"""
import math

import cv2
import numpy as np


def detect_arcs(stroke, wall, ppc, r_cm=(60, 110)):
    rmin, rmax = int(r_cm[0] * ppc), int(r_cm[1] * ppc)
    H, W = stroke.shape
    blur = cv2.GaussianBlur(stroke, (5, 5), 0)
    circles = cv2.HoughCircles(blur, cv2.HOUGH_GRADIENT, dp=1.5, minDist=max(8, rmin // 2), param1=80, param2=14, minRadius=rmin, maxRadius=rmax)
    out = []
    if circles is None:
        return out
    sy, sx = np.nonzero(stroke)
    for cx, cy, r in circles[0][:400].tolist():
        d = np.hypot(sx - cx, sy - cy)
        on = np.abs(d - r) <= max(2.0, 0.04 * r)
        if on.sum() < 0.6 * r:      # a quarter arc has ~1.57 r pixels
            continue
        ang = (np.degrees(np.arctan2(sy[on] - cy, sx[on] - cx)) + 360) % 360
        bins = np.zeros(72, bool)
        bins[(ang // 5).astype(int)] = True
        if bins.all():
            continue
        # the longest contiguous run of covered bins (circular)
        b2 = np.r_[bins, bins]
        best, run, start, bstart = 0, 0, 0, 0
        for i, v in enumerate(b2):
            if v:
                if run == 0:
                    start = i
                run += 1
                if run > best:
                    best, bstart = run, start
            else:
                run = 0
        span = min(best, 72) * 5
        if not (60 <= span <= 125) or bins.sum() * 5 > span + 30:
            continue
        a0 = (bstart * 5) % 360
        a1 = (a0 + span) % 360
        hinge = (float(cx), float(cy))
        # which radius sits in the wall line: its extension beyond the arc meets wall
        def wall_beyond(a):
            ex, ey = math.cos(math.radians(a)), math.sin(math.radians(a))
            hits = 0
            for t in np.linspace(1.02, 1.35, 8):
                x, y = int(cx + ex * r * t), int(cy + ey * r * t)
                if 0 <= x < W and 0 <= y < H and wall[y, x]:
                    hits += 1
            return hits
        ends = [a0, a1]
        wb = [wall_beyond(a) for a in ends]
        # (round 15) the doorway end of the arc lands on the far jamb (wall within ~12 cm of the end point); the leaf end is
        # free. The 'wall beyond' test is the tie-break only (a leaf drawn along a wall also has wall beyond it)
        def wall_near(a):
            ex_, ey_ = cx + r * math.cos(math.radians(a)), cy + r * math.sin(math.radians(a))
            rr = max(2, int(12 * ppc))
            x0_, y0_ = max(0, int(ex_) - rr), max(0, int(ey_) - rr)
            sub = wall[y0_:int(ey_) + rr + 1, x0_:int(ex_) + rr + 1]
            return int(sub.sum()) if sub.size else 0
        wn = [wall_near(a) for a in ends]
        def wall_behind(a):       # the hinge's wall runs on, straight, opposite the doorway
            ux_, uy_ = math.cos(math.radians(a)), math.sin(math.radians(a))
            hits = 0
            for t in np.linspace(4 * ppc, 25 * ppc, 8):
                x, y = int(cx - ux_ * t), int(cy - uy_ * t)
                if 0 <= x < W and 0 <= y < H and wall[y, x]:
                    hits += 1
            return hits
        # the fitted circle is a few degrees off: search +/-15 deg around each end for the angle with the most wall behind
        best_end = []
        for a_e in ends:
            cand = [(wall_behind(a_e + d_), a_e + d_) for d_ in range(-15, 16, 3)]
            best_end.append(max(cand))
        wbh = [b[0] for b in best_end]
        if wbh[0] != wbh[1] and max(wbh) >= 3:
            i_door = int(np.argmax(wbh))
            ends[i_door] = best_end[i_door][1]              # the doorway end on the jamb's line
        elif (wn[0] > 0) != (wn[1] > 0):
            i_door = 0 if wn[0] > 0 else 1
        else:
            i_door = int(np.argmax(wb))
        door_a = ends[i_door]
        leaf_a = ends[1 - i_door]
        chord_end = (cx + r * math.cos(math.radians(door_a)), cy + r * math.sin(math.radians(door_a)))
        leaf_end = (cx + r * math.cos(math.radians(leaf_a)), cy + r * math.sin(math.radians(leaf_a)))
        # one door per hinge: skip a near-duplicate
        if any(math.hypot(o["hinge_px"][0] - cx, o["hinge_px"][1] - cy) < 0.3 * r for o in out):
            continue
        out.append({"hinge_px": [round(hinge[0], 1), round(hinge[1], 1)], "r_px": round(float(r), 1), "r_cm": round(float(r) / ppc, 1), "span_deg": span,
                    "a0_deg": a0, "a1_deg": a1, "chord_px": [[round(hinge[0], 1), round(hinge[1], 1)], [round(chord_end[0], 1), round(chord_end[1], 1)]],
                    "leaf_px": [round(leaf_end[0], 1), round(leaf_end[1], 1)], "wall_hits": max(wb)})
    return out
