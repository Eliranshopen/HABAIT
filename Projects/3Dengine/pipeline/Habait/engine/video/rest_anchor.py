"""$0 gate: WHERE in a real (v2v) track is the pose of a reference photo-real frame?

Use: a hold track (hold-arc / hold-ring) must show the orbit's end pose at its rest frame, or the cut orbit -> hold jumps
and the labels projected at rest use the wrong camera. Both images are model outputs of the same look, so ORB features
match (a clay frame against a real one does NOT: edge F-score and gradient NCC both failed to discriminate on Rainbow,
2026-11-03). Per candidate frame: ORB (4000) + cross-checked Hamming matches + RANSAC homography; the score is the
inlier count, the position is the median horizontal shift of the inliers. The rest frame is the frame with the most
inliers, refined to the zero crossing of that shift between its neighbours.

Measured on Rainbow (orbit_real.mp4 last frame vs arc_real.mp4): most inliers at real frame 65 (1144 inliers, shift
-2.5 px; 62: +20.2, 68: -23.0), so the hold pose sits at real ~64.9 while the clay map puts it at 91: 26 frames early.

CLI:  python rest_anchor.py <ref.png|video.mp4[:last]> <track.mp4> [--expect N] [--tol 3] [--json out.json]
      exit 0 = found and within tol of --expect (or no --expect), 1 = off by more than tol, 2 = no confident match.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import cv2
import numpy as np

MIN_INLIERS = 150          # below this the match is not trusted (descent-846 vs the orbit end: 5-11 inliers)
TOL_FRAMES = 3
WORK_W = 1280


def _gray(img):
    if img.ndim == 3:
        img = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    h, w = img.shape[:2]
    if w != WORK_W:
        img = cv2.resize(img, (WORK_W, int(round(h * WORK_W / w))), interpolation=cv2.INTER_AREA)
    return img


class Matcher:
    def __init__(self, ref):
        self.orb = cv2.ORB_create(4000)
        self.ref = _gray(ref)
        self.kr, self.dr = self.orb.detectAndCompute(self.ref, None)
        self.bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)

    def score(self, img):
        """(inliers, median dx of the inliers in px at WORK_W)."""
        if self.dr is None:
            return 0, None
        k, d = self.orb.detectAndCompute(_gray(img), None)
        if d is None or len(k) < 8:
            return 0, None
        m = self.bf.match(self.dr, d)
        if len(m) < 8:
            return 0, None
        a = np.float32([self.kr[x.queryIdx].pt for x in m])
        b = np.float32([k[x.trainIdx].pt for x in m])
        H, mask = cv2.findHomography(a, b, cv2.RANSAC, 4.0)
        if H is None or mask is None:
            return 0, None
        sel = mask.ravel() > 0
        if not sel.any():
            return 0, None
        return int(sel.sum()), float(np.median((b - a)[sel][:, 0]))


def find_rest(ref, frames, min_inliers=MIN_INLIERS, loop=False) -> dict:
    """ref: an image (BGR / gray); frames: a sequence of images (index 0 = real frame 1). Returns
    {rest_real (float, 1-based), best_frame, inliers, dx_px, confident, scores: [[frame, inliers, dx], ...]}."""
    mt = Matcher(ref)
    rows = [(i + 1, *mt.score(f)) for i, f in enumerate(frames)]
    best = max(rows, key=lambda r: r[1])
    j, inl, dx = best
    rest = float(j)
    if dx is not None and abs(dx) > 0.5:                 # refine: the nearest zero crossing of dx within +-3 frames
        n = len(rows)

        def at(f):
            q = ((f - 1) % n) + 1 if loop else f
            if not 1 <= q <= n:
                return None
            _, i2, d2 = rows[q - 1]
            return d2 if (d2 is not None and i2 >= min_inliers / 2) else None
        best_x = None
        for a in range(j - 3, j + 3):
            da, db = at(a), at(a + 1)
            if da is None or db is None or da == db or (da > 0) == (db > 0):
                continue
            x = a + da / (da - db)                       # linear zero crossing between a and a+1
            if best_x is None or abs(x - j) < abs(best_x - j):
                best_x = x
        if best_x is not None:
            rest = best_x
    return {"rest_real": round(rest, 2), "best_frame": j, "inliers": inl,
            "dx_px": None if dx is None else round(dx, 2), "confident": inl >= min_inliers,
            "scores": [[r[0], r[1], None if r[2] is None else round(r[2], 1)] for r in rows]}


def gate(found: dict, expect_real: float | None, tol=TOL_FRAMES, deg_per_frame: float | None = None) -> dict:
    """The gate verdict for a measured rest vs the rest the camera map predicts."""
    if not found["confident"]:
        return {"gate": "video_rest_anchor", "pass": False, "status": "no-confident-match", "blocking": False,
                "score": found["inliers"], "measured_rest": found["rest_real"], "expected_rest": expect_real,
                "note": f"best match {found['inliers']} inliers < {MIN_INLIERS}: the pose cannot be located"}
    off = None if expect_real is None else round(found["rest_real"] - expect_real, 2)
    ok = off is None or abs(off) <= tol
    g = {"gate": "video_rest_anchor", "pass": ok, "status": "ok" if ok else "off", "blocking": False,
         "score": found["inliers"], "measured_rest": found["rest_real"], "expected_rest": expect_real,
         "offset_frames": off, "tol_frames": tol}
    if off is not None and deg_per_frame:
        g["offset_deg"] = round(off * deg_per_frame, 2)
    return g


def last_frame(video):
    """The last decoded frame of a video as a grayscale image at WORK_W."""
    from video import media
    return media.decode_gray(video, size=(WORK_W, 720))[-1]


def _load_ref(spec: str):
    """An image path, or a video path (its LAST frame)."""
    if spec.lower().endswith((".mp4", ".mov", ".webm")):
        return last_frame(spec)
    img = cv2.imread(spec)
    if img is None:
        raise SystemExit(f"cannot read {spec}")
    return img


def main(argv=None):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from video import media
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("ref")
    ap.add_argument("track")
    ap.add_argument("--expect", type=float)
    ap.add_argument("--tol", type=float, default=TOL_FRAMES)
    ap.add_argument("--json")
    a = ap.parse_args(argv)
    ref = _load_ref(a.ref)
    frames = media.decode_gray(a.track, size=(WORK_W, 720))
    found = find_rest(ref, frames)
    g = gate(found, a.expect, a.tol)
    out = {**g, "best_frame": found["best_frame"], "dx_px": found["dx_px"]}
    print(json.dumps(out, ensure_ascii=False))
    if a.json:
        Path(a.json).write_text(json.dumps({**out, "scores": found["scores"]}, ensure_ascii=False, indent=1),
                                encoding="utf-8")
    return 0 if g["pass"] else (2 if g["status"] == "no-confident-match" else 1)


if __name__ == "__main__":
    sys.exit(main())
