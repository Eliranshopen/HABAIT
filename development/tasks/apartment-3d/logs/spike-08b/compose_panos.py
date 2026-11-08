#!/usr/bin/env python3
"""compose_panos.py -- stage 2 of the pano projection (board apartment-3d, card 08b): the cache -> one colour atlas.

    python compose_panos.py --cache <project_panos cache> --dollhouse <dir: light.webp + report.json> \
        --set parquet --out <dir>/color-parquet.webp [--stats <json>]

Per texel (all on the GLB's lightmap UVs):
  * architecture (floors, walls, doors) seen by at least one tour camera takes the pano colour of the BEST camera
    (the highest eye-light value = nearest and most frontal);
  * where the AI skin drew something the 3D model does not have (its sofa, rug edge, plants over a floor or a wall), the
    painted colour is an outlier against that room's floor (or that camera's wall) colour: those texels, and the
    architecture no camera sees, take the room's median colour x the baked light's local variation;
  * everything else (furniture, built-ins, frames) keeps the clean model look: web colour x baked light, through the
    same Neutral tone mapping the viewer uses, so both read as one picture.
Deterministic, numpy + Pillow, $0. The panoramas are AI-skinned: the page keeps its הדמיה · AI-generated disclosure.
"""

import argparse
import glob
import hashlib
import json
import os

import numpy as np
from PIL import Image

KIND = {"other": 0, "floor": 1, "wall": 2, "door": 3}
LIGHT_GAIN = 0.45      # the viewer's baked-light gain (lightMapIntensity = PI * 0.45 / scale)
AMBIENT = 0.12         # what the live hemisphere/environment adds over the lightmap in the viewer


def srgb_to_lin(x):
    return np.where(x <= 0.04045, x / 12.92, ((x + 0.055) / 1.055) ** 2.4)


def lin_to_srgb(x):
    x = np.clip(x, 0, 1)
    return np.where(x <= 0.0031308, x * 12.92, 1.055 * np.power(x, 1 / 2.4) - 0.055)


def neutral_tonemap(c):
    """three.js NeutralToneMapping (Khronos PBR Neutral), exposure 1"""
    c = c.copy()
    x = c.min(axis=-1, keepdims=True)
    off = np.where(x < 0.08, x - 6.25 * x * x, 0.04)
    c -= off
    peak = c.max(axis=-1, keepdims=True)
    sc = 0.8 - 0.04
    d = 1 - sc
    newp = 1 - d * d / (peak + d - sc)
    comp = c * (newp / np.maximum(peak, 1e-6))
    g = 1 - 1 / (0.15 * (peak - newp) + 1)
    comp = comp * (1 - g) + newp * g
    return np.where(peak < sc, c, comp)


def blur(a, mask, r=2):
    """masked box-ish blur (binomial, separable) of a over mask"""
    k = np.array([1, 4, 6, 4, 1], np.float32) / 16
    m = mask.astype(np.float32)
    num = a * (m[..., None] if a.ndim == 3 else m)
    den = m.copy()
    for _ in range(r):
        for ax in (0, 1):
            num = sum(k[i] * np.roll(num, i - 2, axis=ax) for i in range(5))
            den = sum(k[i] * np.roll(den, i - 2, axis=ax) for i in range(5))
    d = den[..., None] if a.ndim == 3 else den
    return np.where(d > 1e-6, num / np.maximum(d, 1e-6), a)


def main(a):
    base = np.load(os.path.join(a.cache, "base.npz"))
    albedo = base["albedo"].astype(np.float32) / 65535
    kind, room, covered = base["kind"], base["room"], base["covered"]
    res = covered.shape[0]
    rep = json.load(open(os.path.join(a.dollhouse, "report.json"), encoding="utf-8"))
    scale = float(rep["bake"]["scale"])
    lw = np.asarray(Image.open(os.path.join(a.dollhouse, "light.webp")).convert("RGB"), np.float32) / 255
    if lw.shape[0] != res:
        raise SystemExit(f"light.webp {lw.shape[0]} px vs cache {res} px")
    # Blender images are stored bottom row first; the cache came from Blender pixels -> flip to file order
    albedo, kind, room, covered = albedo[::-1], kind[::-1], room[::-1], covered[::-1]
    L = srgb_to_lin(lw) * (LIGHT_GAIN / scale)                     # irradiance-ish, as the viewer applies it
    Lum = L.mean(axis=-1)
    fallback = neutral_tonemap(albedo * (L + AMBIENT))             # the clean model look, display-referred
    # ---- cameras ----
    cams = sorted({os.path.basename(p)[4:-4] for p in glob.glob(os.path.join(a.cache, "vis-*.npz"))})
    # which room each camera stands in (plan camera_points), which rooms are outdoor, and the cache's room order
    plan = json.load(open(os.path.join(a.tour, "plan.general.json"), encoding="utf-8"))
    cam_room = {c["id"][len("cp-"):]: c.get("room_id") for c in plan.get("camera_points", [])}
    outdoor = {r["id"] for r in plan.get("rooms", []) if r.get("is_outdoor")}
    room_ids = [str(x) for x in base["rooms"]]
    room_index = {rid: i + 1 for i, rid in enumerate(room_ids)}
    best = np.zeros((res, res), np.float32)
    owner = np.full((res, res), -1, np.int16)
    painted = np.zeros((res, res, 3), np.float32)
    used = []
    for i, c in enumerate(cams):
        cp = os.path.join(a.cache, f"col-{c}-{a.set}.npz")
        if not os.path.isfile(cp):
            continue
        vis = np.load(os.path.join(a.cache, f"vis-{c}.npz"))["vis"][::-1]
        col = np.load(cp)["col"][::-1].astype(np.float32) / 255
        # a floor is painted only by its own room's camera (no grazing paint through doors and glass);
        # walls and doors by whichever camera sees them best
        own = room_index.get(cam_room.get(c), -1)
        allowed = np.where(kind == KIND["floor"], room == own, True)
        take = (vis > 1e-4) & (vis > best) & allowed
        best = np.where(take, vis, best)
        owner = np.where(take, i, owner)
        painted = np.where(take[..., None], col, painted)
        used.append(c)
    arch = covered & np.isin(kind, [KIND["floor"], KIND["wall"], KIND["door"]])
    seen = arch & (owner >= 0)
    # ---- outliers: per floor room, and per camera for walls/doors, against the median colour ----
    plin = srgb_to_lin(painted)
    lum = plin.mean(axis=-1) + 1e-4
    chroma = plin / lum[..., None]                                   # colour without brightness
    ratio = lum / (Lum + 1e-4)                                       # brightness vs. the baked light
    ok = np.zeros_like(seen)
    groups = []
    out_idx = {room_index[r] for r in outdoor if r in room_index}
    for r in np.unique(room[seen & (kind == KIND["floor"])]):
        groups.append(seen & (kind == KIND["floor"]) & (room == r))
    for i in range(len(cams)):
        groups.append(seen & (kind != KIND["floor"]) & (owner == i))
    med_col = np.zeros((res, res, 3), np.float32)
    stats = []
    for g in groups:
        n = int(g.sum())
        if n < 50:
            continue
        ch = chroma[g]
        mc = np.median(ch, axis=0)
        dc = np.abs(ch - mc).sum(axis=1)
        mad = np.median(dc) + 1e-3
        rr = np.log(ratio[g])
        mr = np.median(rr)
        madr = np.median(np.abs(rr - mr)) + 1e-3
        good = (dc < max(3 * mad, 0.06)) & (np.abs(rr - mr) < max(3 * madr, 0.35))
        gi = np.where(g)
        # outdoor floors are never painted: the AI skin furnished the terraces (loungers, planters) the model has not;
        # they take their tile colour (the median) x the baked light
        is_out = bool(np.any(np.isin(room[g], list(out_idx)))) and bool(np.all(kind[g] == KIND["floor"]))
        if not is_out:
            ok[gi[0][good], gi[1][good]] = True
        # the fill colour of this group: its median painted colour, carried by the local baked light
        medlin = np.median(plin[g][good], axis=0) if good.any() else np.median(plin[g], axis=0)
        medL = np.median(Lum[g]) + 1e-4
        med_col[g] = medlin[None, :] / medL
        stats.append({"texels": n, "kept": int(good.sum())})
    # architecture a group fill could not reach (unseen walls, a tiny group): the room/wall median of everything kept
    reach = med_col.sum(axis=-1) > 0
    glob_med = np.median(plin[ok], axis=0) / (np.median(Lum[ok]) + 1e-4) if ok.any() else np.array([0.6, 0.55, 0.5])
    med_col = np.where(reach[..., None], med_col, glob_med[None, None, :])
    Ls = blur(Lum, covered, r=3)                                     # smooth light: no dashes in the fill
    fill = lin_to_srgb(med_col * Ls[..., None])
    arch_rgb = np.where(ok[..., None], painted, fill)
    # feather painted <-> fill inside architecture (2 px), so the outlier holes have no hard rim
    m = np.clip(blur(ok.astype(np.float32), arch, r=2) * 1.5, 0, 1)    # 1 inside painted areas, a soft rim at holes
    arch_rgb = painted * m[..., None] + fill * (1 - m[..., None])
    out = np.where(arch[..., None], arch_rgb, lin_to_srgb(fallback))
    out = np.where(covered[..., None], out, out[covered].mean(axis=0))
    img = Image.fromarray((np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8), "RGB")
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    img.save(a.out, "WEBP", quality=a.quality, method=6)
    data = open(a.out, "rb").read()
    st = {"set": a.set, "out": a.out.replace("\\", "/"), "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(),
          "cameras": used, "arch_texels": int(arch.sum()), "seen": int(seen.sum()), "painted_kept": int(ok.sum()),
          "rejected_as_ai_furniture": int((seen & ~ok).sum()), "unseen_filled": int((arch & ~seen).sum()),
          "groups": len(stats), "quality": a.quality, "light_scale": scale, "outdoor_fill_only": sorted(outdoor)}
    if a.stats:
        json.dump(st, open(a.stats, "w", encoding="utf-8"), indent=1)
    print(json.dumps(st))
    return 0


if __name__ == "__main__":
    ap = argparse.ArgumentParser(prog="compose_panos.py")
    ap.add_argument("--cache", required=True)
    ap.add_argument("--dollhouse", required=True)
    ap.add_argument("--tour", required=True, help="tour360/apartments/<apt> (plan.general.json)")
    ap.add_argument("--set", default="parquet")
    ap.add_argument("--out", required=True)
    ap.add_argument("--stats", default=None)
    ap.add_argument("--quality", type=int, default=86)
    raise SystemExit(main(ap.parse_args()))
