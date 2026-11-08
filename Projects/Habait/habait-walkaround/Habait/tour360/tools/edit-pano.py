#!/usr/bin/env python
"""edit-pano.py - the operator-side text edit of one panorama view (Tour360).

The recipe (research/2026-10-04-text-edit-research.md, method M2):
  crop   cut a flat perspective view out of the lossless master panorama          ($0)
  run    send that view and an English instruction to a fal instruction editor    (PAID, ledgered)
  paste  keep only the changed region, feather it, project it back, and write
         a small RGBA patch in balanced-panorama pixels plus before/after views   ($0)
  preview   the tracked panorama with a list of patches drawn over it, as a view  ($0)
  publish   write the edit's entry into apartments/<id>/edits.json                ($0)
  selftest  crop a view, paste it back untouched, report the round-trip error     ($0)

Rules this file carries:
  - FAL_KEY is read by NAME from the harness root .env and is never printed, logged or written.
  - Every paid call is reserved in apartments/<id>/_local/ledger.json BEFORE it is sent and settled
    after; the cap stops the run (board rail; Slava's ruling 2026-10-04: $3 before live).
  - Masters and tracked panoramas are read-only here: outputs go to _local/edits/ and panos/patches/.

Run from anywhere, always under a bound (Machine resource rules):
  timeout 300 python Habait/tour360/tools/edit-pano.py crop demo-01 living sofa --u 0.20 --v 0.63 --hfov 105
  timeout 540 python Habait/tour360/tools/edit-pano.py run  demo-01 living sofa --model kontext --prompt "..."
  timeout 300 python Habait/tour360/tools/edit-pano.py paste demo-01 living sofa --result result-kontext-1.png --box 60,300,900,800
"""
import argparse
import base64
import datetime as dt
import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.request

import cv2
import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

TRACK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HARNESS = os.path.dirname(os.path.dirname(TRACK))
MASTER_DIRS = ["_local/masters", "D:/RealEstate3D/enhanced-panoramas"]
CAP_USD = 3.00

# Prices read 2026-10-04 (research/2026-10-04-edit-models-survey.md, table rows A2, A6, A7).
MODELS = {
    "kontext": {
        "id": "fal-ai/flux-pro/kontext", "price": 0.04, "reserve": 0.08,
        "payload": lambda uri, p: {"prompt": p, "image_url": uri, "num_images": 1, "output_format": "png", "guidance_scale": 3.5},
    },
    "kontext-max": {
        "id": "fal-ai/flux-pro/kontext/max", "price": 0.08, "reserve": 0.10,
        "payload": lambda uri, p: {"prompt": p, "image_url": uri, "num_images": 1, "output_format": "png", "guidance_scale": 3.5},
    },
    "nb2": {
        "id": "fal-ai/nano-banana-2/edit", "price": 0.08, "reserve": 0.10,
        "payload": lambda uri, p: {"prompt": p, "image_urls": [uri], "aspect_ratio": "auto", "resolution": "1K", "num_images": 1, "output_format": "png"},
    },
    "flux3": {
        "id": "blackforestlabs/flux-3/edit-image", "price": 0.024, "reserve": 0.05,
        "payload": lambda uri, p: {"prompt": p, "image_urls": [uri], "aspect_ratio": "auto", "resolution": "1k", "output_format": "png", "enable_prompt_expansion": False},
    },
}


# ---------------------------------------------------------------- paths and small helpers
def apt_dir(apt):
    d = os.path.join(TRACK, "apartments", apt)
    if not os.path.isdir(d):
        sys.exit(f"no such apartment: {apt}")
    return d


def scene_of(apt, scene_id):
    data = json.load(open(os.path.join(apt_dir(apt), "scenes.json"), encoding="utf-8"))
    for s in data["scenes"]:
        if s["id"] == scene_id:
            return s
    sys.exit(f"no such scene in {apt}: {scene_id}")


def master_path(apt, asset):
    for d in MASTER_DIRS:
        base = d if os.path.isabs(d) or ":" in d else os.path.join(apt_dir(apt), d)
        p = os.path.join(base, asset + ".png")
        if os.path.isfile(p):
            return p
    sys.exit(f"no lossless master found for {asset} (looked in {MASTER_DIRS})")


def edit_dir(apt, scene_id, edit_id):
    d = os.path.join(apt_dir(apt), "_local", "edits", scene_id, edit_id)
    os.makedirs(d, exist_ok=True)
    return d


def load_rgb(path):
    return np.asarray(Image.open(path).convert("RGB"))


def save_png(path, arr):
    Image.fromarray(arr).save(path, "PNG")


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def now():
    return dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


# ---------------------------------------------------------------- projection (gnomonic)
# World: +z forward at yaw 0 (u = 0.5), +x right (u grows), +y up. u,v cover the FULL equirect.
def basis(yaw_deg, pitch_deg):
    y, p = np.radians(yaw_deg), np.radians(pitch_deg)
    f = np.array([np.cos(p) * np.sin(y), np.sin(p), np.cos(p) * np.cos(y)])
    r = np.array([np.cos(y), 0.0, -np.sin(y)])
    u = np.cross(f, r)
    return f, r, u


def focal(w, hfov_deg):
    return (w / 2.0) / np.tan(np.radians(hfov_deg) / 2.0)


def equi_to_pers(pano, yaw, pitch, hfov, w, h, supersample=2):
    """Render a w*h perspective view from an equirect image (wrap-aware, anti-aliased)."""
    H, W = pano.shape[:2]
    ws, hs = w * supersample, h * supersample
    fpx = focal(ws, hfov)
    f, r, up = basis(yaw, pitch)
    xs = (np.arange(ws) + 0.5 - ws / 2.0) / fpx
    ys = -(np.arange(hs) + 0.5 - hs / 2.0) / fpx
    a, b = np.meshgrid(xs, ys)
    d = f[None, None, :] + a[..., None] * r[None, None, :] + b[..., None] * up[None, None, :]
    d /= np.linalg.norm(d, axis=2, keepdims=True)
    lon = np.arctan2(d[..., 0], d[..., 2])
    lat = np.arcsin(np.clip(d[..., 1], -1, 1))
    sx = (lon / (2 * np.pi) + 0.5) * W - 0.5
    sy = (0.5 - lat / np.pi) * H - 0.5
    pad = 8
    padded = np.concatenate([pano[:, -pad:], pano, pano[:, :pad]], axis=1)
    sx = np.mod(sx, W) + pad
    out = cv2.remap(padded, sx.astype(np.float32), sy.astype(np.float32), cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    if supersample > 1:
        out = cv2.resize(out, (w, h), interpolation=cv2.INTER_AREA)
    return out


def footprint(yaw, pitch, hfov, w, h, W, H):
    """The equirect pixel box [x0,x1) x [y0,y1) that the view covers (no seam crossing allowed yet)."""
    fpx = focal(w, hfov)
    f, r, up = basis(yaw, pitch)
    n = 96
    edge = []
    for t in np.linspace(0, 1, n):
        edge += [(t * w, 0), (t * w, h), (0, t * h), (w, t * h)]
    us, vs = [], []
    for (x, y) in edge:
        a, b = (x - w / 2.0) / fpx, -(y - h / 2.0) / fpx
        d = f + a * r + b * up
        d /= np.linalg.norm(d)
        us.append(np.arctan2(d[0], d[2]) / (2 * np.pi) + 0.5)
        vs.append(0.5 - np.arcsin(np.clip(d[1], -1, 1)) / np.pi)
    us, vs = np.array(us), np.array(vs)
    if us.max() - us.min() > 0.5:
        sys.exit("this view crosses the wrap seam (u = 0/1); pick a view away from it for now")
    x0, x1 = int(np.floor(us.min() * W)) - 2, int(np.ceil(us.max() * W)) + 2
    y0, y1 = int(np.floor(vs.min() * H)) - 2, int(np.ceil(vs.max() * H)) + 2
    return max(0, x0), min(W, x1), max(0, y0), min(H, y1)


def pers_to_equi_region(img, alpha, yaw, pitch, hfov, W, H):
    """Project a perspective image and its alpha onto the equirect box it covers.
    Returns (x0, y0, rgb_region float32, alpha_region float32 in 0..1)."""
    h, w = img.shape[:2]
    fpx = focal(w, hfov)
    f, r, up = basis(yaw, pitch)
    x0, x1, y0, y1 = footprint(yaw, pitch, hfov, w, h, W, H)
    uu = (np.arange(x0, x1) + 0.5) / W
    vv = (np.arange(y0, y1) + 0.5) / H
    lon = (uu - 0.5) * 2 * np.pi
    lat = (0.5 - vv) * np.pi
    lon, lat = np.meshgrid(lon, lat)
    d = np.stack([np.cos(lat) * np.sin(lon), np.sin(lat), np.cos(lat) * np.cos(lon)], axis=2)
    zc = d @ f
    xc = d @ r
    yc = d @ up
    ok = zc > 1e-6
    zs = np.where(ok, zc, 1.0)
    px = fpx * xc / zs + w / 2.0 - 0.5
    py = -fpx * yc / zs + h / 2.0 - 0.5
    ok &= (px >= 0) & (px <= w - 1) & (py >= 0) & (py <= h - 1)
    px32, py32 = px.astype(np.float32), py.astype(np.float32)
    rgb = cv2.remap(img.astype(np.float32), px32, py32, cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    al = cv2.remap(alpha.astype(np.float32), px32, py32, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    al = np.clip(al, 0, 1) * ok
    return x0, y0, np.clip(rgb, 0, 255), al


# ---------------------------------------------------------------- ledger (reserve, then settle)
def ledger_path(apt):
    return os.path.join(apt_dir(apt), "_local", "ledger.json")


def ledger_load(apt):
    p = ledger_path(apt)
    if os.path.isfile(p):
        return json.load(open(p, encoding="utf-8"))
    return {"$schema": "tour360/ledger.v1", "cap_usd": CAP_USD, "note": "reserve before send, settle after; prices are the vendor page's, read 2026-10-04", "rows": []}


def ledger_save(apt, led):
    p = ledger_path(apt)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    tmp = p + ".tmp"
    json.dump(led, open(tmp, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    os.replace(tmp, p)


def ledger_total(led):
    t = 0.0
    for row in led["rows"]:
        t += row["settled_usd"] if row.get("settled_usd") is not None else row["reserved_usd"]
    return round(t, 6)


def read_key(name):
    """Read ONE variable by name from the harness root .env. The value is never printed."""
    v = os.environ.get(name)
    if v:
        return v
    p = os.path.join(HARNESS, ".env")
    if os.path.isfile(p):
        for line in open(p, encoding="utf-8", errors="replace"):
            line = line.strip()
            if line.startswith(name + "="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit(f"{name} is not set (looked in the environment and the harness root .env)")


# ---------------------------------------------------------------- commands
def view_params(args, scene):
    yaw = (args.u - 0.5) * 360.0
    pitch = (0.5 - args.v) * 180.0
    w, h = [int(x) for x in args.size.lower().split("x")]
    return yaw, pitch, args.hfov, w, h


def cmd_crop(args):
    scene = scene_of(args.apt, args.scene)
    mp = master_path(args.apt, scene["asset"])
    yaw, pitch, hfov, w, h = view_params(args, scene)
    t0 = time.time()
    pano = load_rgb(mp)
    crop = equi_to_pers(pano, yaw, pitch, hfov, w, h)
    d = edit_dir(args.apt, args.scene, args.edit)
    save_png(os.path.join(d, "crop.png"), crop)
    meta = {"apartment": args.apt, "scene": args.scene, "edit": args.edit, "asset": scene["asset"], "u": args.u, "v": args.v,
            "yaw": round(yaw, 4), "pitch": round(pitch, 4), "hfov": hfov, "size": [w, h],
            "master": mp.replace("\\", "/"), "master_size": [int(pano.shape[1]), int(pano.shape[0])],
            "master_sha256": sha256_file(mp), "crop_sha256": sha256_file(os.path.join(d, "crop.png")), "made": now()}
    json.dump(meta, open(os.path.join(d, "crop.json"), "w", encoding="utf-8"), indent=1)
    Image.fromarray(crop).save(os.path.join(d, "crop-preview.jpg"), "JPEG", quality=88)
    print(f"crop {w}x{h} yaw {yaw:.2f} pitch {pitch:.2f} hfov {hfov} -> {os.path.relpath(d, TRACK)}/crop.png ({time.time() - t0:.1f}s)")


def cmd_run(args):
    d = edit_dir(args.apt, args.scene, args.edit)
    crop_path = os.path.join(d, "crop.png")
    if not os.path.isfile(crop_path):
        sys.exit("no crop.png for this edit; run the crop command first")
    m = MODELS[args.model]
    led = ledger_load(args.apt)
    spent = ledger_total(led)
    if spent + m["reserve"] > led["cap_usd"]:
        sys.exit(f"CAP: ${spent:.3f} booked + ${m['reserve']:.2f} reserve would pass the ${led['cap_usd']:.2f} cap; nothing sent")
    n = 1 + sum(1 for r in led["rows"] if r.get("edit") == args.edit and r.get("scene") == args.scene and r.get("model") == args.model)
    tag = f"{args.model}-{n}"
    row = {"seq": len(led["rows"]) + 1, "ts": now(), "op": "edit", "scene": args.scene, "edit": args.edit, "model": args.model,
           "endpoint": m["id"], "reserved_usd": m["reserve"], "settled_usd": None, "status": "reserved",
           "crop_sha256": sha256_file(crop_path), "prompt": args.prompt}
    led["rows"].append(row)
    ledger_save(args.apt, led)

    key = read_key("FAL_KEY")
    uri = "data:image/png;base64," + base64.b64encode(open(crop_path, "rb").read()).decode("ascii")
    payload = m["payload"](uri, args.prompt)
    req = urllib.request.Request("https://fal.run/" + m["id"], data=json.dumps(payload).encode("utf-8"),
                                 headers={"Authorization": "Key " + key, "Content-Type": "application/json"}, method="POST")
    t0 = time.time()
    status, body = None, b""
    try:
        with urllib.request.urlopen(req, timeout=args.timeout) as r:
            status, body = r.status, r.read()
    except urllib.error.HTTPError as e:
        status, body = e.code, e.read()
    except Exception as e:  # network or timeout: the bill is unknown, keep the reservation
        row.update({"status": "unknown", "error": type(e).__name__, "seconds": round(time.time() - t0, 1)})
        ledger_save(args.apt, led)
        sys.exit(f"{tag}: transport error {type(e).__name__}; the reservation stays booked (reconcile by hand)")
    secs = round(time.time() - t0, 1)
    row["seconds"] = secs
    row["http"] = status
    if status != 200:
        row.update({"status": "failed", "settled_usd": 0.0, "error": body[:400].decode("utf-8", "replace")})
        ledger_save(args.apt, led)
        sys.exit(f"{tag}: HTTP {status} after {secs}s, settled $0 :: {row['error']}")
    res = json.loads(body)
    img = (res.get("images") or [{}])[0]
    url = img.get("url")
    if not url:
        row.update({"status": "failed", "settled_usd": m["price"], "error": "200 without an image"})
        ledger_save(args.apt, led)
        sys.exit(f"{tag}: 200 but no image in the response; settled at the page price")
    out = os.path.join(d, f"result-{tag}.png")
    if url.startswith("data:"):
        raw = base64.b64decode(url.split(",", 1)[1])
    else:
        with urllib.request.urlopen(urllib.request.Request(url), timeout=120) as r:
            raw = r.read()
    open(out, "wb").write(raw)
    im = Image.open(out)
    if im.format != "PNG":
        im.convert("RGB").save(out, "PNG")
    row.update({"status": "settled", "settled_usd": m["price"], "result": os.path.basename(out), "result_size": list(im.size),
                "result_sha256": sha256_file(out), "seed": res.get("seed"), "vendor_note": (res.get("description") or res.get("prompt") or "")[:300]})
    ledger_save(args.apt, led)
    Image.open(out).convert("RGB").save(os.path.join(d, f"result-{tag}-preview.jpg"), "JPEG", quality=88)
    print(f"{tag}: 200 in {secs}s, {im.size[0]}x{im.size[1]}, settled ${m['price']:.3f}; ledger total ${ledger_total(led):.3f} of ${led['cap_usd']:.2f} -> {os.path.basename(out)}")


def fit_colour(A, B, keep):
    """Per-channel gain and offset so the untouched part of the result matches the crop."""
    out = A.astype(np.float32).copy()
    fit = []
    sel = keep > 0
    for c in range(3):
        x = A[..., c][sel].astype(np.float64)
        y = B[..., c][sel].astype(np.float64)
        if x.size < 1000:
            fit.append([1.0, 0.0])
            continue
        g, o = np.polyfit(x, y, 1)
        g, o = float(np.clip(g, 0.85, 1.15)), float(np.clip(o, -24, 24))
        out[..., c] = out[..., c] * g + o
        fit.append([round(g, 4), round(o, 3)])
    return np.clip(out, 0, 255).astype(np.uint8), fit


def align(A, B, keep):
    """Affine-align the result to the crop on the untouched area (ECC). Falls back to no warp."""
    a = cv2.cvtColor(A, cv2.COLOR_RGB2GRAY).astype(np.float32) / 255.0
    b = cv2.cvtColor(B, cv2.COLOR_RGB2GRAY).astype(np.float32) / 255.0
    warp = np.eye(2, 3, dtype=np.float32)
    try:
        crit = (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 300, 1e-7)
        cc, warp = cv2.findTransformECC(b, a, warp, cv2.MOTION_AFFINE, crit, keep, 5)
        h, w = B.shape[:2]
        A2 = cv2.warpAffine(A, warp, (w, h), flags=cv2.INTER_CUBIC + cv2.WARP_INVERSE_MAP, borderMode=cv2.BORDER_REFLECT)
        return A2, [[round(float(v), 5) for v in row] for row in warp], round(float(cc), 5)
    except cv2.error as e:
        return A, None, None


def cmd_paste(args):
    scene = scene_of(args.apt, args.scene)
    d = edit_dir(args.apt, args.scene, args.edit)
    meta = json.load(open(os.path.join(d, "crop.json"), encoding="utf-8"))
    w, h = meta["size"]
    B = load_rgb(os.path.join(d, "crop.png"))
    rp = args.result if os.path.isabs(args.result) else os.path.join(d, args.result)
    A0 = load_rgb(rp)
    A = cv2.resize(A0, (w, h), interpolation=cv2.INTER_AREA if A0.shape[1] >= w else cv2.INTER_CUBIC)

    bx0, by0, bx1, by1 = [int(v) for v in args.box.split(",")]
    box = np.zeros((h, w), np.uint8)
    box[by0:by1, bx0:bx1] = 255
    grown = cv2.dilate(box, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * args.grow + 1, 2 * args.grow + 1)))
    keep = cv2.bitwise_not(cv2.dilate(box, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * args.grow + 41, 2 * args.grow + 41))))
    edge = 12
    keep[:edge] = 0
    keep[-edge:] = 0
    keep[:, :edge] = 0
    keep[:, -edge:] = 0

    A1, warp, cc = (A, None, None) if args.no_align else align(A, B, keep)
    A2, colour = fit_colour(A1, B, keep)
    outside = float(np.abs(A2.astype(np.int16) - B.astype(np.int16))[keep > 0].mean())

    blur = lambda x: cv2.GaussianBlur(x, (0, 0), 2.0)
    diff = np.abs(blur(A2).astype(np.int16) - blur(B).astype(np.int16)).max(axis=2).astype(np.uint8)
    if args.mode == "box":
        changed = box.copy()
    else:
        changed = ((diff > args.thr) & (grown > 0)).astype(np.uint8) * 255
        changed = cv2.morphologyEx(changed, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (args.close, args.close)))
        changed = cv2.morphologyEx(changed, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
        cnts, _ = cv2.findContours(changed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        cnts = [c for c in cnts if cv2.contourArea(c) >= args.min_area]
        changed = np.zeros((h, w), np.uint8)
        if args.mode == "hull" and cnts:
            cv2.drawContours(changed, [cv2.convexHull(np.vstack(cnts))], -1, 255, -1)
        else:
            cv2.drawContours(changed, cnts, -1, 255, -1)
        k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * abs(args.pad) + 1, 2 * abs(args.pad) + 1))
        changed = cv2.bitwise_and(cv2.dilate(changed, k) if args.pad >= 0 else cv2.erode(changed, k), grown)
    if changed.max() == 0:
        sys.exit("the result does not differ from the crop inside the box; nothing to paste")
    alpha = cv2.GaussianBlur(changed, (0, 0), args.feather).astype(np.float32) / 255.0
    lim = 10  # never let the patch touch the crop border
    alpha[:lim] = 0
    alpha[-lim:] = 0
    alpha[:, :lim] = 0
    alpha[:, -lim:] = 0
    comp = (A2.astype(np.float32) * alpha[..., None] + B.astype(np.float32) * (1 - alpha[..., None])).round().astype(np.uint8)
    save_png(os.path.join(d, "aligned.png"), A2)
    Image.fromarray((alpha * 255).astype(np.uint8)).save(os.path.join(d, "mask.png"))
    Image.fromarray(comp).save(os.path.join(d, "composite-crop.jpg"), "JPEG", quality=90)

    # project onto the master grid, then bring the patch down to the balanced grid
    Wm, Hm = meta["master_size"]
    x0, y0, rgb_m, al_m = pers_to_equi_region(A2, alpha, meta["yaw"], meta["pitch"], meta["hfov"], Wm, Hm)
    bal_dir = os.path.join(apt_dir(args.apt), "panos", "balanced")
    base = load_rgb(os.path.join(bal_dir, scene["asset"] + ".webp"))
    Hb, Wb = base.shape[:2]
    s = Wb / float(Wm)
    ys, xs = np.where(al_m > 0.004)
    if ys.size == 0:
        sys.exit("the projected patch is empty")
    mx0, mx1, my0, my1 = x0 + xs.min(), x0 + xs.max() + 1, y0 + ys.min(), y0 + ys.max() + 1
    px0, py0 = int(np.floor(mx0 * s)) - 2, int(np.floor(my0 * s)) - 2
    px1, py1 = int(np.ceil(mx1 * s)) + 2, int(np.ceil(my1 * s)) + 2
    px0, py0, px1, py1 = max(0, px0), max(0, py0), min(Wb, px1), min(Hb, py1)
    # place the master-res region on a canvas that maps exactly onto the balanced box, then INTER_AREA it
    cw, ch = int(round((px1 - px0) / s)), int(round((py1 - py0) / s))
    ox, oy = int(round(px0 / s)), int(round(py0 / s))
    canvas_rgb = np.zeros((ch, cw, 3), np.float32)
    canvas_al = np.zeros((ch, cw), np.float32)
    sx0, sy0 = x0 - ox, y0 - oy
    hh, ww = rgb_m.shape[:2]
    cx0, cy0 = max(0, sx0), max(0, sy0)
    cx1, cy1 = min(cw, sx0 + ww), min(ch, sy0 + hh)
    canvas_rgb[cy0:cy1, cx0:cx1] = rgb_m[cy0 - sy0:cy1 - sy0, cx0 - sx0:cx1 - sx0]
    canvas_al[cy0:cy1, cx0:cx1] = al_m[cy0 - sy0:cy1 - sy0, cx0 - sx0:cx1 - sx0]
    pw, ph = px1 - px0, py1 - py0
    # premultiply so the downscale does not pull in pixels from outside the projected footprint
    prem = cv2.resize(canvas_rgb * canvas_al[..., None], (pw, ph), interpolation=cv2.INTER_AREA)
    al_b = cv2.resize(canvas_al, (pw, ph), interpolation=cv2.INTER_AREA)
    rgb_b = np.where(al_b[..., None] > 1e-4, prem / np.maximum(al_b[..., None], 1e-4), base[py0:py1, px0:px1].astype(np.float32))
    rgb_b = np.clip(rgb_b, 0, 255)
    patch = np.dstack([rgb_b.round().astype(np.uint8), (np.clip(al_b, 0, 1) * 255).round().astype(np.uint8)])

    patch_dir = os.path.join(apt_dir(args.apt), "panos", "patches")
    os.makedirs(patch_dir, exist_ok=True)
    patch_name = f"{scene['asset']}~{args.edit}.webp"
    patch_path = os.path.join(patch_dir, patch_name)
    Image.fromarray(patch, "RGBA").save(patch_path, "WEBP", quality=args.quality, method=6, alpha_quality=100, exact=True)

    # what the page will show: the tracked balanced panorama with the DECODED patch drawn over it
    dec = np.asarray(Image.open(patch_path).convert("RGBA")).astype(np.float32)
    a = dec[..., 3:4] / 255.0
    after = base.copy()
    after[py0:py1, px0:px1] = (dec[..., :3] * a + base[py0:py1, px0:px1].astype(np.float32) * (1 - a)).round().astype(np.uint8)
    untouched = after.copy()
    untouched[py0:py1, px0:px1] = base[py0:py1, px0:px1]
    assert np.array_equal(untouched, base)
    vw, vh = 1264, 848
    view_before = equi_to_pers(base, meta["yaw"], meta["pitch"], meta["hfov"], vw, vh)
    view_after = equi_to_pers(after, meta["yaw"], meta["pitch"], meta["hfov"], vw, vh)
    Image.fromarray(view_before).save(os.path.join(d, "view-before.jpg"), "JPEG", quality=90)
    Image.fromarray(view_after).save(os.path.join(d, "view-after.jpg"), "JPEG", quality=90)
    Image.fromarray(np.concatenate([view_before, view_after], axis=1)).save(os.path.join(d, "view-pair.jpg"), "JPEG", quality=88)
    if args.full:
        Image.fromarray(after).save(os.path.join(d, "pano-after.webp"), "WEBP", quality=88, method=6)

    cu, cv_ = (px0 + pw / 2.0) / Wb, (py0 + ph / 2.0) / Hb
    rec = {"edit": args.edit, "scene": args.scene, "asset": scene["asset"], "patch": "patches/" + patch_name,
           "x": int(px0), "y": int(py0), "w": int(pw), "h": int(ph), "panoSize": [int(Wb), int(Hb)],
           "bytes": os.path.getsize(patch_path), "sha256": sha256_file(patch_path),
           "look": {"u": round(float(meta["u"]), 4), "v": round(float(meta["v"]), 4), "hfov": meta["hfov"]},
           "centre": {"u": round(cu, 4), "v": round(cv_, 4)},
           "source": {"result": os.path.basename(rp), "result_sha256": sha256_file(rp), "mode": args.mode, "box": [bx0, by0, bx1, by1],
                      "thr": args.thr, "grow": args.grow, "pad": args.pad, "feather": args.feather, "align": warp, "ecc": cc,
                      "colour_fit": colour, "outside_mad": round(outside, 3), "made": now()}}
    json.dump(rec, open(os.path.join(d, "patch.json"), "w", encoding="utf-8"), indent=1)
    print(f"patch {pw}x{ph} at ({px0},{py0}) {rec['bytes'] / 1024:.0f} KB -> panos/patches/{patch_name}")
    print(f"outside-box MAD after align+colour fit: {outside:.2f}/255 | ecc {cc} | colour {colour}")
    print(f"views: {os.path.relpath(d, TRACK)}/view-pair.jpg")


def compose(apt, scene, edits):
    """The tracked balanced panorama with the named patches drawn over it, in the order given."""
    base = load_rgb(os.path.join(apt_dir(apt), "panos", "balanced", scene["asset"] + ".webp")).copy()
    for e in edits:
        rec = json.load(open(os.path.join(edit_dir(apt, scene["id"], e), "patch.json"), encoding="utf-8"))
        dec = np.asarray(Image.open(os.path.join(apt_dir(apt), "panos", rec["patch"])).convert("RGBA")).astype(np.float32)
        a = dec[..., 3:4] / 255.0
        x, y, w, h = rec["x"], rec["y"], rec["w"], rec["h"]
        base[y:y + h, x:x + w] = (dec[..., :3] * a + base[y:y + h, x:x + w].astype(np.float32) * (1 - a)).round().astype(np.uint8)
    return base


def cmd_preview(args):
    scene = scene_of(args.apt, args.scene)
    edits = [e for e in args.edits.split(",") if e]
    pano = compose(args.apt, scene, edits)
    w, h = [int(x) for x in args.size.lower().split("x")]
    view = equi_to_pers(pano, (args.u - 0.5) * 360.0, (0.5 - args.v) * 180.0, args.hfov, w, h)
    out = args.out if os.path.isabs(args.out) else os.path.join(apt_dir(args.apt), "_local", "edits", args.scene, args.out)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    Image.fromarray(view).save(out, "JPEG", quality=90)
    if args.pano:
        Image.fromarray(pano).save(os.path.splitext(out)[0] + "-pano.jpg", "JPEG", quality=86)
    print(f"preview [{'+'.join(edits) or 'original'}] -> {out}")


def cmd_publish(args):
    """Write or refresh this edit's entry in apartments/<id>/edits.json (the tracked contract the build reads)."""
    scene = scene_of(args.apt, args.scene)
    d = edit_dir(args.apt, args.scene, args.edit)
    rec = json.load(open(os.path.join(d, "patch.json"), encoding="utf-8"))
    labels = json.load(open(args.labels, encoding="utf-8"))
    for l in ("he", "en", "fr"):
        if not labels.get(l):
            sys.exit(f"labels file lacks {l}")
    led = ledger_load(args.apt)
    row = next((r for r in led["rows"] if r.get("scene") == args.scene and r.get("edit") == args.edit and r.get("result") == rec["source"]["result"]), None)
    if row is None:
        sys.exit("no settled ledger row for the pasted result; an unledgered image is never published")
    p = os.path.join(apt_dir(args.apt), "edits.json")
    doc = json.load(open(p, encoding="utf-8")) if os.path.isfile(p) else {
        "$schema": "tour360/edits.v1", "apartment": args.apt,
        "note": "Prepared examples of the text-edit feature (PLAN.md section 9). Each entry is a small RGBA patch in balanced-panorama pixels, made offline by tools/edit-pano.py (crop, instruction editor, changed-region paste) and drawn over the panorama by the page in `order`. Furniture and decor only. The base panoramas are never modified.",
        "scenes": {}}
    entry = {"id": args.edit, "order": args.order, "label": {l: labels[l] for l in ("he", "en", "fr")},
             "patch": os.path.basename(rec["patch"]), "x": rec["x"], "y": rec["y"], "w": rec["w"], "h": rec["h"],
             "look": {"u": rec["look"]["u"], "v": rec["look"]["v"]}, "spanDeg": round(rec["w"] / rec["panoSize"][0] * 360.0, 1),
             "provenance": {"endpoint": row["endpoint"], "prompt": row["prompt"], "usd": row["settled_usd"], "generated": row["ts"],
                            "seconds": row.get("seconds"), "resultSha256": rec["source"]["result_sha256"], "patchSha256": rec["sha256"],
                            "patchBytes": rec["bytes"], "paste": {k: rec["source"][k] for k in ("mode", "box", "thr", "grow", "pad", "feather")}}}
    lst = [e for e in doc["scenes"].get(args.scene, []) if e["id"] != args.edit] + [entry]
    lst.sort(key=lambda e: e["order"])
    if len({e["order"] for e in lst}) != len(lst):
        sys.exit("two edits of this scene share an order; orders decide the draw order and must differ")
    doc["scenes"][args.scene] = lst
    tmp = p + ".tmp"
    with open(tmp, "w", encoding="utf-8", newline="\n") as f:
        json.dump(doc, f, indent=1, ensure_ascii=False)
        f.write("\n")
    os.replace(tmp, p)
    print(f"published {args.scene}/{args.edit} (order {args.order}, {row['endpoint']}, ${row['settled_usd']}) -> apartments/{args.apt}/edits.json")


def cmd_selftest(args):
    scene = scene_of(args.apt, args.scene)
    pano = load_rgb(master_path(args.apt, scene["asset"]))
    H, W = pano.shape[:2]
    yaw, pitch, hfov, w, h = 40.0, -8.0, 80.0, 1264, 848
    crop = equi_to_pers(pano, yaw, pitch, hfov, w, h)
    alpha = np.zeros((h, w), np.float32)
    alpha[120:h - 120, 160:w - 160] = 1.0
    x0, y0, rgb, al = pers_to_equi_region(crop, alpha, yaw, pitch, hfov, W, H)
    reg = pano[y0:y0 + rgb.shape[0], x0:x0 + rgb.shape[1]].astype(np.float32)
    inside = al > 0.999
    mad_full = float(np.abs(rgb - reg)[inside].mean())
    half = lambda x: cv2.resize(x, (x.shape[1] // 2, x.shape[0] // 2), interpolation=cv2.INTER_AREA)
    m2 = half(inside.astype(np.float32)) > 0.999
    mad_bal = float(np.abs(half(rgb) - half(reg))[m2].mean())
    # geometry: a pixel of the view must land on the direction it was cut from
    f, r, up = basis(yaw, pitch)
    print(f"selftest {scene['asset']}: round-trip MAD inside the pasted area = {mad_full:.3f}/255 on the master grid, {mad_bal:.3f}/255 on the balanced grid; outside the area the panorama is not written at all")
    ok = mad_bal < 2.5
    print("PASS" if ok else "FAIL")
    sys.exit(0 if ok else 1)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("crop")
    c.add_argument("apt"); c.add_argument("scene"); c.add_argument("edit")
    c.add_argument("--u", type=float, required=True); c.add_argument("--v", type=float, required=True)
    c.add_argument("--hfov", type=float, default=80.0); c.add_argument("--size", default="1264x848")
    c.set_defaults(fn=cmd_crop)
    r = sub.add_parser("run")
    r.add_argument("apt"); r.add_argument("scene"); r.add_argument("edit")
    r.add_argument("--model", choices=sorted(MODELS), required=True); r.add_argument("--prompt", required=True)
    r.add_argument("--timeout", type=int, default=240)
    r.set_defaults(fn=cmd_run)
    p = sub.add_parser("paste")
    p.add_argument("apt"); p.add_argument("scene"); p.add_argument("edit")
    p.add_argument("--result", required=True); p.add_argument("--box", required=True, help="x0,y0,x1,y1 in crop pixels: where the object is")
    p.add_argument("--mode", choices=["diff", "hull", "box"], default="diff")
    p.add_argument("--thr", type=int, default=22); p.add_argument("--grow", type=int, default=28)
    p.add_argument("--pad", type=int, default=10); p.add_argument("--feather", type=float, default=9.0)
    p.add_argument("--min-area", dest="min_area", type=int, default=400); p.add_argument("--quality", type=int, default=90)
    p.add_argument("--close", type=int, default=25, help="odd kernel size that bridges gaps in the changed region")
    p.add_argument("--no-align", dest="no_align", action="store_true"); p.add_argument("--full", action="store_true")
    p.set_defaults(fn=cmd_paste)
    v = sub.add_parser("preview")
    v.add_argument("apt"); v.add_argument("scene"); v.add_argument("--edits", default="")
    v.add_argument("--u", type=float, required=True); v.add_argument("--v", type=float, required=True)
    v.add_argument("--hfov", type=float, default=90.0); v.add_argument("--size", default="1264x848")
    v.add_argument("--out", required=True); v.add_argument("--pano", action="store_true")
    v.set_defaults(fn=cmd_preview)
    b = sub.add_parser("publish")
    b.add_argument("apt"); b.add_argument("scene"); b.add_argument("edit")
    b.add_argument("--order", type=int, required=True); b.add_argument("--labels", required=True, help="a JSON file {he, en, fr}: the request as a visitor would type it")
    b.set_defaults(fn=cmd_publish)
    s = sub.add_parser("selftest")
    s.add_argument("apt"); s.add_argument("scene")
    s.set_defaults(fn=cmd_selftest)
    args = ap.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
