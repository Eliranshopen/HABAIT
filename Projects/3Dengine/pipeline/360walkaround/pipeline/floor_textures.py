#!/usr/bin/env python3
"""floor_textures.py -- the dollhouse floors' real texture, taken from the tour's own panoramas (board apartment-3d, 08b).

    python floor_textures.py --tour <tour360/apartments/apt846> --out <dollhouse dir> \
        [--pick parquet=entrance:1.2:0,concrete=...] [--contact <png>]

For each floor finish (the tour's pano sets panos-<finish>): a square of floor IN FRONT of one tour camera is rectified
from the equirectangular pano (camera eye at cameras.json eye_m above the floor; a floor point at (forward, right)
metres is seen at u = 0.5 + atan2(right, forward) / 2pi, elevation atan2(-eye, dist)), its photographed light is
divided out (the dollhouse adds its own baked light), and it is made tileable (a half-offset copy blended in across a
feathered cross). Output floor-<finish>.webp (TILE_M metres per repeat) + floor-textures.json (source, crop, sha256).
--contact writes a sheet of every candidate (camera x distance) for choosing the picks; the picks are recorded in the
json, so a rebuild is deterministic. numpy + Pillow, $0. The panoramas are AI-skinned: the disclosure stays.
"""

import argparse
import hashlib
import json
import math
import os

import numpy as np
from PIL import Image

TILE_M = 2.0       # metres one texture repeat covers
PX = 512           # pixels per repeat (256 px/m: the panos give ~170 px/m at 1-2 m)


def bilinear(img, x, y):
    h, w = img.shape[:2]
    x = np.mod(x, w)
    y = np.clip(y, 0, h - 1.001)
    x0 = np.floor(x).astype(int)
    y0 = np.floor(y).astype(int)
    x1 = (x0 + 1) % w
    y1 = np.minimum(y0 + 1, h - 1)
    fx = (x - x0)[..., None]
    fy = (y - y0)[..., None]
    a = img[y0, x0] * (1 - fx) + img[y0, x1] * fx
    b = img[y1, x0] * (1 - fx) + img[y1, x1] * fx
    return a * (1 - fy) + b * fy


def rectify(pano, eye, ahead, side, size=TILE_M, px=PX):
    """the floor square [ahead - size/2, ahead + size/2] x [side - size/2, side + size/2] (camera frame: forward, right)"""
    h, w = pano.shape[:2]
    t = (np.arange(px) + 0.5) / px * size - size / 2
    fwd = ahead - t[:, None] + 0 * t[None, :]        # image row 0 = far edge (looking down at the floor, forward = up)
    rgt = side + t[None, :] + 0 * t[:, None]
    dist = np.hypot(fwd, rgt)
    u = 0.5 + np.arctan2(rgt, fwd) / (2 * math.pi)
    el = np.arctan2(-eye, dist)
    v = 0.5 - el / math.pi
    return bilinear(pano, u * w, v * h)


def delight(tex, sigma_frac=0.18):  # noqa: D401
    """divide out the low-frequency light (sun patches, falloff), keep the material: tex / blur(tex) * mean"""
    k = max(3, int(tex.shape[0] * sigma_frac))
    small = Image.fromarray((np.clip(tex, 0, 1) * 255).astype(np.uint8)).resize((max(1, tex.shape[1] // k), max(1, tex.shape[0] // k)), Image.BILINEAR)
    low = np.asarray(small.resize((tex.shape[1], tex.shape[0]), Image.BICUBIC), np.float32) / 255
    mean = tex.reshape(-1, 3).mean(axis=0)
    return np.clip(tex / np.maximum(low, 1e-3) * mean, 0, 1)


def despecular(tex, k=3.0):
    """specular glints (a bright dot or streak on marble): pixels far above their neighbourhood take the neighbourhood"""
    lum = tex.mean(axis=-1)
    n = tex.shape[0]
    small = Image.fromarray((np.clip(tex, 0, 1) * 255).astype(np.uint8)).resize((n // 16, n // 16), Image.BILINEAR)
    low = np.asarray(small.resize((n, n), Image.BICUBIC), np.float32) / 255
    d = lum - low.mean(axis=-1)
    mad = np.median(np.abs(d)) + 1e-3
    bad = d > k * 1.4826 * mad
    # grow the mask a little so the glint's halo goes too
    for _ in range(3):
        bad = bad | np.roll(bad, 1, 0) | np.roll(bad, -1, 0) | np.roll(bad, 1, 1) | np.roll(bad, -1, 1)
    return np.where(bad[..., None], low, tex)


def tileable(tex, feather=0.25):
    """blend in the half-offset copy across a feathered cross: the edges become continuous, the middle stays original"""
    n = tex.shape[0]
    rolled = np.roll(np.roll(tex, n // 2, axis=0), n // 2, axis=1)
    t = np.abs((np.arange(n) + 0.5) / n - 0.5) * 2           # 0 at the centre, 1 at the edges
    ramp = np.clip((t - (1 - 2 * feather)) / (2 * feather), 0, 1)
    m = np.maximum(ramp[:, None], ramp[None, :])[..., None]  # 1 near an edge -> take the rolled copy (its centre)
    return tex * (1 - m) + rolled * m


def main(a):
    cams = json.load(open(os.path.join(a.tour, "cameras.json"), encoding="utf-8"))
    scenes = json.load(open(os.path.join(a.tour, "scenes.json"), encoding="utf-8"))
    eye = float(cams["eye_m"])
    asset = {s["id"]: s["asset"] for s in scenes["scenes"] if s.get("asset")}
    finishes = [f for f in a.finishes.split(",") if f]
    if a.contact:
        rows = []
        for fin in finishes:
            for cid in [c for c in a.candidates.split(",") if c]:
                p = os.path.join(a.tour, "_local", f"panos-{fin}", f"{asset[cid]}.webp")
                if not os.path.isfile(p):
                    continue
                pano = np.asarray(Image.open(p).convert("RGB"), np.float32) / 255
                for ahead in (1.0, 1.6, 2.2):
                    for side in (-1.2, 0.0, 1.2):
                        rows.append((f"{fin} {cid} {ahead}:{side}", rectify(pano, eye, ahead, side, px=192)))
        n = len(rows)
        cols = 9
        sheet = Image.new("RGB", (cols * 200, ((n + cols - 1) // cols) * 216), "white")
        from PIL import ImageDraw
        d = ImageDraw.Draw(sheet)
        for i, (lab, t) in enumerate(rows):
            x, y = (i % cols) * 200, (i // cols) * 216
            sheet.paste(Image.fromarray((np.clip(t, 0, 1) * 255).astype(np.uint8)), (x + 4, y + 18))
            d.text((x + 4, y + 2), lab, fill=(0, 0, 0))
        sheet.save(a.contact)
        print(f"contact sheet: {n} candidates -> {a.contact}")
        return 0
    picks = dict(p.split("=", 1) for p in a.pick.split(",") if p)
    out = {"tile_m": TILE_M, "px": PX, "eye_m": eye, "finishes": {}}
    for fin, spec in picks.items():
        cid, ahead, side = spec.split(":")
        p = os.path.join(a.tour, "_local", f"panos-{fin}", f"{asset[cid]}.webp")
        pano = np.asarray(Image.open(p).convert("RGB"), np.float32) / 255
        tex = tileable(delight(despecular(delight(rectify(pano, eye, float(ahead), float(side)), 0.12)), 0.3))
        dst = os.path.join(a.out, f"floor-{fin}.webp")
        Image.fromarray((np.clip(tex, 0, 1) * 255 + 0.5).astype(np.uint8)).save(dst, "WEBP", quality=a.quality, method=6)
        data = open(dst, "rb").read()
        out["finishes"][fin] = {"file": os.path.basename(dst), "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(),
                                "source": p.replace("\\", "/"), "source_sha256": hashlib.sha256(open(p, "rb").read()).hexdigest(),
                                "camera": cid, "ahead_m": float(ahead), "side_m": float(side),
                                "mean_srgb": [round(float(v), 4) for v in tex.reshape(-1, 3).mean(axis=0)]}
        print(f"{fin}: {cid} {ahead}:{side} -> {dst} ({len(data):,} B)")
    json.dump(out, open(os.path.join(a.out, "floor-textures.json"), "w", encoding="utf-8"), indent=1)
    return 0


if __name__ == "__main__":
    ap = argparse.ArgumentParser(prog="floor_textures.py")
    ap.add_argument("--tour", required=True)
    ap.add_argument("--out", default=".")
    ap.add_argument("--finishes", default="parquet,concrete,marble")
    ap.add_argument("--candidates", default="entrance,kitchen,dining,living,bedroomMain,bedroom2")
    ap.add_argument("--contact", default=None)
    ap.add_argument("--pick", default="")
    ap.add_argument("--quality", type=int, default=90)
    raise SystemExit(main(ap.parse_args()))
