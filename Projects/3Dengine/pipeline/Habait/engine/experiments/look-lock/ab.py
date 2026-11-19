"""ab.py - card 12 (B2, "look lock"): the A/B of three painters on ONE clay view of the apt846 living room.

  A  GPT Image 2.5 edit (openai/gpt-image-2.5/sunburst/edit), the model of record: image 1 = the clay view, images
     2-4 = crops of the finished tour (the look), prompt "Keep image 1 exactly as framed, change only the grey
     materials". No seed parameter on this endpoint: "seed" 1/2 = two independent samples.
  B  FLUX.1 Depth [pro] (fal-ai/flux-pro/v1/depth): control image = the Blender depth of the SAME clay view, drawn
     linear in metres, near = bright; a text prompt (this model takes no look image). fal runs its own depth
     preprocessor on the control image, there is no raw-depth input on any fal FLUX depth endpoint (2026-11-02).
  C  Qwen-Image-Edit-2511 + the card's LoRA (fal-ai/qwen-image-edit-2511/lora): image 1 = the clay view, the LoRA
     trained by train.py (fal-ai/qwen-image-2512-trainer, trigger "hbt846 style"), no look images.
  ctrl-C-nolora       C without the LoRA, one seed: is the LoRA doing anything?
  ctrl-B-claycontrol  B with the clay RGB as its control (fal estimates the depth): through glazing the Blender
                      depth is the pane, so B's own control cannot show mullions. Neither control is in the 6-row A/B.

The view (all three get the SAME pixels): a rectilinear crop of the cp-living clay equirect
(360walkaround/tours/apt846-furnished/renders/cp-living/pano.webp, 2048x1024, Cycles 2026-11-01), camera at plan
(685.3, 935.1) cm, eye 1.60 m, bearing 111.3 deg (the pano's own forward = u 0.5), pitch 0, HFOV 90 deg, 1536x1024
(lens 18 mm on a 36 mm sensor). Depth = the pano's radial depth.png resampled the same way and turned planar
(z = r / |d_cam|), written as depthcm_0001.png (16-bit cm), which openings_gate.py reads.

Subcommands
  ab.py --probe                     fal storage-token probe (no spend)
  ab.py --inputs                    build the shot dir + the depth control + the look refs, and run the $0 gates on the
                                    clay itself (kf_check.py; openings_gate.py clay-vs-clay); no network
  ab.py --gen [--only A1,B1] [--cap 40]   the paid calls (skips existing outputs; ledgered before and after each call)
  ab.py --gate-only                 recompute openings_gate (and kf_check) on the 6 files ON DISK, check each file's
                                    sha256 against the ledger, print the 6-row table; exit 0 = 6 rows, hashes match,
                                    at least one candidate keeps >= 0.60 on every judged opening; 1 = none does;
                                    2 = a file is missing or its hash differs
  ab.py --page                      write compare.html (Hebrew) from gate-table.json
FAL_KEY is read by name from C:/RnD/Projects/Habait/habait-walkaround/.env and never printed.
"""
import argparse
import base64
import hashlib
import json
import math
import os
import re
import subprocess
import sys
import time
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = Path("C:/RnD/Projects/Habait/habait-walkaround")
LOCAL = ROOT / "Habait" / "engine" / "_local"
OUT = LOCAL / "experiments" / "look-lock"
SHOT = OUT / "inputs" / "shot"
GEN = OUT / "gen"
GATE = OUT / "gate"
VIEW = OUT / "view"
LEDGER = LOCAL / "ledger-B2.json"
BENCH = Path("C:/RnD/Projects/Habait/tools/bench")
PY = sys.executable

CP = ROOT / "360walkaround/tours/apt846-furnished/renders/cp-living"
CLAY_PANO, DEPTH_PANO = CP / "pano.webp", CP / "depth.png"
PLAN = ROOT / "360walkaround/tours/apt846-furnished/plan.json"
TOUR = ROOT / "Habait/tour360/apartments/apt846/panos/balanced"

# the view: the clay pano's own forward, HFOV 90, 3:2
YAW0 = 111.3                    # pano.render.json point.yaw_deg (u 0.5 = this plan bearing)
POS = [6.853, -9.351, 1.6]      # pano.render.json point.world_m (X = x/100, Y = -y/100, Z up)
VIEW_BEARING, VIEW_PITCH, VIEW_HFOV = 111.3, 0.0, 90.0
W, H = 1536, 1024

TRIGGER = "hbt846 style"
CAP_USD = 40.0

FINISHES = (
    "large pale limestone floor slabs with no visible grout lines, matte; warm off-white plaster walls and ceiling; "
    "the grey sofa block becomes a cream boucle sofa on its own footprint; the floor lamp stays a slim floor lamp; "
    "the media unit becomes a floating sand-grey matte lacquer unit under the same TV; every door is a zero-line flush "
    "door in cream, frameless, no architrave; no skirting; slim black frames on the glass, sheer linen curtains; "
    "outside the glass a sunlit terrace with the same small table, chairs and potted plant, and a hazy Tel Aviv "
    "skyline. Soft natural daylight, photoreal, a very high-end finish. No people, no text, no logos, no watermark.")

PROMPT_A = (
    "Image 1 is a plain computer render of the living room of a real apartment, a 90-degree eye-level camera facing "
    "its glass wall. Keep image 1 exactly as framed, change only the grey materials: every wall, ceiling line, "
    "column, glass pane, glass slider, frame and piece of furniture stays at exactly the same pixel position, size and "
    "perspective; nothing is added, removed or moved. Images 2 to 4 are crops of this apartment's finished tour: take "
    "ONLY their materials, colours and light from them, never their layout. The finishes: " + FINISHES)

PROMPT_B = (
    "Eye-level photograph of a luxury apartment living room facing a full-height glass wall with slim black frames "
    "and glass sliding doors onto a sunlit terrace with a small bistro table, two chairs and a potted plant, a hazy "
    "Tel Aviv skyline beyond. Large pale limestone floor slabs with no grout lines, warm off-white plaster walls and "
    "ceiling, a cream boucle sofa in the left foreground, a slim white floor lamp, a floating sand-grey media unit "
    "with a TV at the right, sheer linen curtains. Soft natural daylight, photoreal, very high-end interior "
    "photography. No people, no text, no logos.")

PROMPT_C = (
    TRIGGER + " interior. Keep image 1 exactly as framed, change only the grey materials of this plain computer "
    "render of a living room: every wall, ceiling line, column, glass pane, glass slider, frame and piece of "
    "furniture stays at exactly the same pixel position, size and perspective; nothing is added, removed or moved. "
    "The finishes: " + FINISHES)

PROMPT_CTRL = PROMPT_C.replace(TRIGGER + " interior. ", "")

# candidates: id -> (label, endpoint, booked usd, seed or sample)
GPT_EP = "openai/gpt-image-2.5/sunburst/edit"
FLUXD_EP = "fal-ai/flux-pro/v1/depth"
QWEN_LORA_EP = "fal-ai/qwen-image-edit-2511/lora"
QWEN_EP = "fal-ai/qwen-image-edit-2511"
MP = W * H / 1e6
CANDS = {
    "A1": {"label": "A · GPT Image 2.5 (בסיס)", "endpoint": GPT_EP, "usd": 1.20, "seed": 1},
    "A2": {"label": "A · GPT Image 2.5 (בסיס)", "endpoint": GPT_EP, "usd": 1.20, "seed": 2},
    "B1": {"label": "B · FLUX.1 Depth [pro]", "endpoint": FLUXD_EP, "usd": round(0.05 * MP + 0.005, 3), "seed": 1},
    "B2": {"label": "B · FLUX.1 Depth [pro]", "endpoint": FLUXD_EP, "usd": round(0.05 * MP + 0.005, 3), "seed": 2},
    "C1": {"label": "C · Qwen-Image-Edit-2511 + LoRA", "endpoint": QWEN_LORA_EP, "usd": round(0.035 * MP + 0.005, 3), "seed": 1},
    "C2": {"label": "C · Qwen-Image-Edit-2511 + LoRA", "endpoint": QWEN_LORA_EP, "usd": round(0.035 * MP + 0.005, 3), "seed": 2},
}
CONTROLS = {
    "ctrl-C-nolora": {"label": "בקרה · Qwen-Image-Edit-2511 בלי LoRA", "endpoint": QWEN_EP, "usd": round(0.03 * MP + 0.005, 3), "seed": 1},
    "ctrl-B-claycontrol": {"label": "בקרה · FLUX.1 Depth [pro], ה-clay כ-control (fal מחשב עומק)", "endpoint": FLUXD_EP,
                           "usd": round(0.05 * MP + 0.005, 3), "seed": 1, "control": "clay"},
}
ALL = {**CANDS, **CONTROLS}


# ---------------------------------------------------------------- small helpers
def sha_bytes(b):
    return hashlib.sha256(b).hexdigest()


def sha_file(p):
    return sha_bytes(Path(p).read_bytes())


def load_key():
    if os.environ.get("FAL_KEY"):
        return os.environ["FAL_KEY"]
    for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
        if line.startswith("FAL_KEY="):
            os.environ["FAL_KEY"] = line.split("=", 1)[1].strip().strip('"')
            return os.environ["FAL_KEY"]
    sys.exit("FAL_KEY missing in .env")


def now():
    return time.strftime("%Y-%m-%dT%H:%M:%S")


# ---------------------------------------------------------------- the ledger (shape fixed by habait-4b)
def ledger_load():
    if LEDGER.exists():
        return json.loads(LEDGER.read_text(encoding="utf-8"))
    return {"owner": "habait-4b", "card": 12, "cap_usd": CAP_USD, "calls": []}


def ledger_save(d):
    LEDGER.parent.mkdir(parents=True, exist_ok=True)
    # pure ASCII (Hebrew escaped): the card's Check reads it with open() in the console codepage (cp1255)
    LEDGER.write_text(json.dumps(d, indent=1, ensure_ascii=True), encoding="ascii")


def ledger_total(d=None):
    d = d or ledger_load()
    return round(sum(float(c.get("cost", 0)) for c in d["calls"]), 4)


class ledger_lock:
    """an exclusive lock file around a read-modify-write of the ledger (train.py may run beside ab.py --gen)."""

    def __init__(self):
        self.p = LEDGER.with_suffix(".lock")

    def __enter__(self):
        LEDGER.parent.mkdir(parents=True, exist_ok=True)
        t0 = time.time()
        while True:
            try:
                self.fd = os.open(self.p, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
                return self
            except FileExistsError:
                if time.time() - t0 > 60:            # a crashed holder: take it over
                    os.unlink(self.p)
                time.sleep(0.1)

    def __exit__(self, *exc):
        os.close(self.fd)
        os.unlink(self.p)


def probe():
    import requests
    key = load_key()
    r = requests.post("https://rest.fal.ai/storage/auth/token?storage_type=fal-cdn-v3",
                      headers={"Authorization": f"Key {key}", "Content-Type": "application/json"}, json={}, timeout=60)
    ok = r.status_code == 200
    print(f"[probe] fal storage token: HTTP {r.status_code} {'OK' if ok else r.text[:200].replace(key, '***')}")
    if r.status_code == 403 and "xhausted" in r.text:
        print("[probe] Exhausted balance: no paid call will be made")
    return ok


class Exhausted(Exception):
    pass


def fal_run(name, endpoint, args, files, usd, purpose, cap=CAP_USD, timeout_s=900, on_result=None, out_file=None):
    """one ledgered fal call. files: {placeholder: path}; any string in args (also inside lists / dicts) equal to a
    placeholder becomes the uploaded URL. The ledger row is written BEFORE (cost = booked estimate, status started) and
    settled AFTER. Refuses past the cap; raises Exhausted on a 403 balance lock. Returns the fal result dict or None."""
    import fal_client
    load_key()
    inputs_hash = sha_bytes(json.dumps({"endpoint": endpoint, "args": args,
                                        "files": {k: sha_file(v) for k, v in files.items()}}, sort_keys=True).encode())
    with ledger_lock():
        led = ledger_load()
        spent = ledger_total(led)
        if spent + usd > cap + 1e-9:
            print(f"[{name}] REFUSED: ${spent:.2f} spent + ${usd:.2f} would pass the cap ${cap:.2f}")
            return None
        led["calls"].append({"ts": now(), "model": endpoint, "purpose": purpose, "cost": usd, "inputs_hash": inputs_hash,
                             "output": str(out_file) if out_file else None, "status": "started", "booked_usd": usd})
        ledger_save(led)
        idx = len(led["calls"]) - 1

    def settle(cost, **kw):
        with ledger_lock():
            d = ledger_load()
            d["calls"][idx].update({"cost": cost, **kw})
            ledger_save(d)

    def subst(x, urls):
        if isinstance(x, str):
            return urls.get(x, x)
        if isinstance(x, list):
            return [subst(v, urls) for v in x]
        if isinstance(x, dict):
            return {k: subst(v, urls) for k, v in x.items()}
        return x

    t0 = time.time()
    stage = "upload"
    try:
        urls = {k: fal_client.upload_file(str(v)) for k, v in files.items()}
        real = subst(json.loads(json.dumps(args)), urls)
        stage = "submit"
        h = fal_client.submit(endpoint, arguments=real)
        stage = "run"
        print(f"[{name}] {endpoint}: request {h.request_id}", flush=True)
        res = None
        while time.time() - t0 < timeout_s:
            st = fal_client.status(endpoint, h.request_id)
            if isinstance(st, fal_client.Completed):
                res = fal_client.result(endpoint, h.request_id)
                break
            time.sleep(5)
        if res is None:
            raise TimeoutError(f"no result after {timeout_s} s")
    except Exception as e:  # noqa: BLE001
        msg = str(e)[:500].replace(os.environ.get("FAL_KEY", "\0"), "***")
        if "xhausted" in msg:
            settle(0.0, status="http-403-exhausted", error=msg)
            raise Exhausted(msg)
        # nothing is billed before the request runs (upload / submit / 4xx validation); once it ran, book the estimate
        billed = 0.0 if stage in ("upload", "submit") or "422" in msg or "400" in msg else usd
        settle(billed, status=f"error-{stage}", error=msg)
        print(f"[{name}] FAILED at {stage}: {msg}", file=sys.stderr)
        return None
    secs = round(time.time() - t0)
    extra = on_result(res) if on_result else {}
    if extra is None:
        settle(usd, status="billed-no-output", secs=secs, request_id=h.request_id)
        return None
    settle(usd, status="ok", secs=secs, request_id=h.request_id, **extra)
    print(f"[{name}] OK in {secs}s, booked ${usd:.3f}; ledger ${ledger_total():.3f} of ${cap:.0f}")
    return res


def download(url):
    import requests
    for _ in range(4):
        try:
            if url.startswith("data:"):
                return base64.b64decode(url.split(",", 1)[1])
            r = requests.get(url, timeout=300)
            r.raise_for_status()
            return r.content
        except Exception:  # noqa: BLE001
            time.sleep(5)
    return None


# ---------------------------------------------------------------- the view (equirect -> rectilinear)
def load_pano():
    rgb = np.asarray(Image.open(CLAY_PANO).convert("RGB"))[:, :, ::-1].copy()
    d = np.asarray(Image.open(DEPTH_PANO).convert("RGB")).astype(np.uint32)
    r = ((d[..., 0] << 16) | (d[..., 1] << 8) | d[..., 2]).astype(np.float32) / 100.0   # pano.render.json depth_decode
    return rgb, r


def rectilinear(pano_bgr, bearing_rel_deg, hfov, w, h, pitch=0.0, depth=None, u_centre=0.5):
    """sample a pinhole view out of an equirect: the column u_centre is straight ahead, bearing_rel_deg turns right.
    Same pinhole as openings_gate.Perspective (f_px = lens/sensor * w, sensor 36 mm on the long side).
    Returns (bgr, planar depth or None, lens_mm, forward vector in the pano's own frame)."""
    lens = 36.0 / (2 * math.tan(math.radians(hfov) / 2))
    b, p = math.radians(bearing_rel_deg), math.radians(pitch)
    fwd = np.array([math.sin(b) * math.cos(p), math.cos(b) * math.cos(p), math.sin(p)])
    right = np.cross(fwd, [0, 0, 1.0])
    right /= np.linalg.norm(right)
    up = np.cross(right, fwd)
    f = lens / 36.0 * w
    xs = (np.arange(w) + 0.5 - w / 2) / f
    ys = -(np.arange(h) + 0.5 - h / 2) / f
    X, Y = np.meshgrid(xs, ys)
    D = X[..., None] * right + Y[..., None] * up + fwd
    n = np.linalg.norm(D, axis=-1)
    br = np.degrees(np.arctan2(D[..., 0], D[..., 1]))
    el = np.degrees(np.arctan2(D[..., 2], np.hypot(D[..., 0], D[..., 1])))
    PH, PW = pano_bgr.shape[:2]
    u = (u_centre + br / 360.0) % 1.0
    v = 0.5 - el / 180.0
    mx = (u * PW - 0.5).astype(np.float32)
    my = np.clip(v * PH - 0.5, 0, PH - 1).astype(np.float32)
    img = cv2.remap(pano_bgr, mx, my, cv2.INTER_CUBIC, borderMode=cv2.BORDER_WRAP)
    z = None
    if depth is not None:
        rr = cv2.remap(depth, mx, my, cv2.INTER_NEAREST, borderMode=cv2.BORDER_WRAP)
        z = rr / n                                         # radial -> planar (distance along the view axis)
    return img, z, lens, fwd


def build_inputs():
    SHOT.mkdir(parents=True, exist_ok=True)
    rgb, r = load_pano()
    img, z, lens, fwd = rectilinear(rgb, VIEW_BEARING - YAW0, VIEW_HFOV, W, H, VIEW_PITCH, depth=r)
    # the look direction in world: plan bearing b -> world (sin b, cos b) (bearing 0 = plan up = +Y world)
    b = math.radians(VIEW_BEARING)
    look = [POS[0] + math.sin(b), POS[1] + math.cos(b), POS[2] + math.tan(math.radians(VIEW_PITCH))]
    cam = {"frame": 1, "pos": POS, "look": look, "lens_mm": round(lens, 6), "sensor_mm": 36, "res": [W, H]}
    cv2.imwrite(str(SHOT / "frame_0001.png"), img)
    cv2.imwrite(str(SHOT / "depthcm_0001.png"), np.clip(np.round(z * 100), 0, 65534).astype(np.uint16))
    (SHOT / "camera.json").write_text(json.dumps({
        "shot": "cp-living-fwd90", "frames": [cam],
        "made_by": "Habait/engine/experiments/look-lock/ab.py --inputs",
        "source": {"pano": str(CLAY_PANO), "pano_sha256": sha_file(CLAY_PANO), "depth": str(DEPTH_PANO),
                   "depth_sha256": sha_file(DEPTH_PANO)},
        "crop": {"bearing_deg": VIEW_BEARING, "pano_yaw_deg": YAW0, "pitch_deg": VIEW_PITCH, "hfov_deg": VIEW_HFOV,
                 "res": [W, H], "lens_mm": round(lens, 6), "sensor_mm": 36,
                 "depth": "radial depth.png resampled nearest, made planar z = r/|d_cam|, centimetres (16-bit)"}},
        indent=1), encoding="utf-8")
    # B's control: near = bright (the MiDaS / Depth-Anything convention FLUX depth was trained on), LINEAR in metres
    # between the 0.5 and 99.5 percentiles: an inverse-depth ramp left the glass wall (3-4 m) almost black.
    # Through glazing Blender's depth is the distance to the PANE (pano.render.json), so the terrace is not in it.
    lo, hi = np.percentile(z, 0.5), np.percentile(z, 99.5)
    g = (np.clip((hi - z) / (hi - lo), 0, 1) * 255).round().astype(np.uint8)
    cv2.imwrite(str(OUT / "inputs" / "depth-control.png"), cv2.merge([g, g, g]))
    # the look refs for A = the interior tour crops of the training set (train.py writes them; build here if absent)
    refs = look_refs()
    print(f"[inputs] shot dir {SHOT} (1536x1024, lens {lens:.3f} mm), depth z {np.nanmin(z):.2f}-{np.nanmax(z):.2f} m, "
          f"depth control written, {len(refs)} look refs")
    # $0 gates on the clay itself before any money: kf_check (keyframe = the clay frame) and openings_gate clay vs clay
    GATE.mkdir(parents=True, exist_ok=True)
    k = subprocess.run([PY, "-X", "utf8", str(BENCH / "kf_check.py"), "--plan", str(PLAN), "--shot-dir", str(SHOT),
                        "--keyframe", str(SHOT / "frame_0001.png"), "--json", str(GATE / "clay.kf.json")],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    print(k.stdout.strip())
    print(f"[inputs] kf_check exit {k.returncode}")
    g2 = subprocess.run([PY, "-X", "utf8", str(BENCH / "openings_gate.py"), "--plan", str(PLAN), "--shot-dir", str(SHOT),
                         "--json", str(GATE / "clay.gate.json"), "--sheet", str(GATE / "clay.sheet.png")],
                        capture_output=True, text=True, encoding="utf-8", errors="replace")
    print(g2.stdout.strip())
    print(f"[inputs] openings_gate (clay vs clay) exit {g2.returncode}")
    return k.returncode == 0 and g2.returncode == 0


# interior look crops: (pano, u_centre, bearing_rel, pitch, hfov) ; shared with train.py
TOUR_CROPS = [
    ("02-kitchen", 0.12, 0.0, -8.0, 85.0), ("02-kitchen", 0.52, 0.0, -5.0, 85.0),
    ("04-living", 0.45, 0.0, -6.0, 85.0), ("04-living", 0.80, 0.0, -5.0, 85.0),
    ("07-bedroom-main", 0.27, 0.0, -8.0, 85.0), ("07-bedroom-main", 0.60, 0.0, -5.0, 85.0),
]


def tour_crop(spec, out_dir):
    name, uc, brel, pitch, hfov = spec
    f = Path(out_dir) / f"tour-{name}-u{int(round(uc * 100)):02d}.png"
    if not f.exists():
        f.parent.mkdir(parents=True, exist_ok=True)
        pano = np.asarray(Image.open(TOUR / f"{name}.webp").convert("RGB"))[:, :, ::-1].copy()
        img, _, _, _ = rectilinear(pano, brel, hfov, 1216, 832, pitch, u_centre=uc)
        cv2.imwrite(str(f), img)
    return f


def look_refs():
    """A's images 2-4: one tour crop per training panorama (kitchen, living, bedroom)."""
    d = OUT / "inputs" / "refs"
    return [tour_crop(TOUR_CROPS[i], d) for i in (1, 2, 4)]


# ---------------------------------------------------------------- generation
def out_path(cid):
    return GEN / cid / "out.png"      # a digit-free basename: openings_gate reads --out with cv2.VideoCapture, which
    #                                   turns a name like x1.png into an image SEQUENCE (x1, x2, ...); out.png = 1 frame


def save_output(cid, res, args, files):
    url = (res.get("images") or [{}])[0].get("url")
    if not url:
        return None
    data = download(url)
    if data is None:
        return None
    p = out_path(cid)
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(".raw")
    tmp.write_bytes(data)
    im = Image.open(tmp)
    im.convert("RGB").save(p)                 # normalise to PNG RGB (some endpoints answer jpeg)
    raw_fmt = im.format
    tmp.unlink()
    sha = sha_file(p)
    (p.parent / "call.json").write_text(json.dumps({
        "candidate": cid, "endpoint": ALL[cid]["endpoint"], "args": args,
        "files": {k: {"path": str(v), "sha256": sha_file(v)} for k, v in files.items()},
        "answer_format": raw_fmt, "answer_size": list(Image.open(p).size), "output_sha256": sha,
        "result_meta": {k: v for k, v in res.items() if k != "images"}}, indent=1, ensure_ascii=False), encoding="utf-8")
    return {"output": str(p), "output_sha256": sha}


def lora_url():
    f = OUT / "train" / "lora.json"
    if not f.exists():
        return None
    return json.loads(f.read_text(encoding="utf-8")).get("diffusers_lora_file", {}).get("url")


def gen_one(cid, cap):
    c = ALL[cid]
    p = out_path(cid)
    if p.exists():
        print(f"[{cid}] skip (exists): {p}")
        return True
    clay = SHOT / "frame_0001.png"
    if c["endpoint"] == GPT_EP:
        refs = look_refs()
        files = {"@clay": clay, **{f"@ref{i + 2}": r for i, r in enumerate(refs)}}
        args = {"prompt": PROMPT_A, "image_urls": list(files.keys()), "image_size": {"width": W, "height": H},
                "quality": "high", "num_images": 1}
    elif c["endpoint"] == FLUXD_EP:
        files = {"@depth": clay if c.get("control") == "clay" else OUT / "inputs" / "depth-control.png"}
        args = {"prompt": PROMPT_B, "control_image_url": "@depth", "image_size": {"width": W, "height": H},
                "num_inference_steps": 28, "guidance_scale": 3.5, "seed": c["seed"], "output_format": "png",
                "safety_tolerance": "2"}
    elif c["endpoint"] == QWEN_LORA_EP:
        url = lora_url()
        if not url:
            print(f"[{cid}] no LoRA yet: run train.py first")
            return False
        files = {"@clay": clay}
        args = {"prompt": PROMPT_C, "image_urls": ["@clay"], "loras": [{"path": url, "scale": 1.0}],
                "image_size": {"width": W, "height": H}, "num_inference_steps": 28, "guidance_scale": 4.5,
                "seed": c["seed"], "output_format": "png", "num_images": 1}
    else:                                                    # the no-LoRA control
        files = {"@clay": clay}
        args = {"prompt": PROMPT_CTRL, "image_urls": ["@clay"], "image_size": {"width": W, "height": H},
                "num_inference_steps": 28, "guidance_scale": 4.5, "seed": c["seed"], "output_format": "png",
                "num_images": 1}
    res = fal_run(cid, c["endpoint"], args, files, c["usd"], f"card 12 A/B {cid}: {c['label']} seed {c['seed']}",
                  cap=cap, on_result=lambda r: save_output(cid, r, args, files), out_file=p)
    return res is not None and p.exists()


# ---------------------------------------------------------------- the gate (recomputed from the files on disk)
def ledger_sha(cid):
    """the sha256 the ledger recorded for this candidate's output when it was downloaded (last ok row)."""
    want = str(out_path(cid))
    rows = [c for c in ledger_load()["calls"] if c.get("output") == want and c.get("status") == "ok"]
    return rows[-1].get("output_sha256") if rows else None


def gate_one(cid):
    p = out_path(cid)
    if not p.exists():
        return {"id": cid, "missing": True}
    sha = sha_file(p)
    rec = ledger_sha(cid)
    GATE.mkdir(parents=True, exist_ok=True)
    gj, gs, kj = GATE / f"{cid}.gate.json", GATE / f"{cid}.sheet.png", GATE / f"{cid}.kf.json"
    for f in (gj, kj):
        if f.exists():
            f.unlink()                    # never read a previous run's numbers
    g = subprocess.run([PY, "-X", "utf8", str(BENCH / "openings_gate.py"), "--plan", str(PLAN), "--shot-dir", str(SHOT),
                        "--out", str(p), "--json", str(gj), "--sheet", str(gs)],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    k = subprocess.run([PY, "-X", "utf8", str(BENCH / "kf_check.py"), "--plan", str(PLAN), "--shot-dir", str(SHOT),
                        "--keyframe", str(p), "--aspect-tol", "0.1", "--json", str(kj)],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    rep = json.loads(gj.read_text(encoding="utf-8")) if gj.exists() else None
    kf = json.loads(kj.read_text(encoding="utf-8")) if kj.exists() else None
    row = {"id": cid, "label": ALL[cid]["label"], "endpoint": ALL[cid]["endpoint"], "seed": ALL[cid]["seed"],
           "file": str(p), "sha256": sha, "ledger_sha256": rec, "hash_ok": rec == sha,
           "gate_exit": g.returncode, "kf_exit": k.returncode}
    if rep:
        items = rep["items"]
        row.update({"verdict": rep["summary"]["verdict"], "judged": rep["summary"]["item_frames_judged"],
                    "failed": rep["summary"]["item_frames_failed"],
                    "kept_min": round(min(s["kept_min"] for s in items.values()), 3) if items else None,
                    "shift_max": round(max(s["shift_max"] for s in items.values()), 2) if items else None,
                    "per_item": {i: {"kind": s["kind"], "kept": s["kept_min"], "shift_deg": s["shift_max"],
                                     "fail": s["fails"] > 0} for i, s in items.items()},
                    "frame_new_lines": rep["summary"]["frame_new_lines"][0] if rep["summary"]["frame_new_lines"] else None})
        row["all_ge_060"] = bool(items) and all(s["kept_min"] >= 0.60 for s in items.values()) and row["verdict"] == "PASS"
    if kf:
        row["kf"] = {"verdict": kf["verdict"], "clay_in_out": kf["edges"]["clay_in_keyframe"],
                     "out_in_clay": kf["edges"]["keyframe_in_clay"], "best_shift_deg": kf["best_shift"]["deg"]}
    return row


def gate_only():
    from concurrent.futures import ThreadPoolExecutor
    ids = list(CANDS) + [c for c in CONTROLS if out_path(c).exists()]
    with ThreadPoolExecutor(max_workers=4) as ex:          # the gates are separate processes: 4 at a time
        done = dict(zip(ids, ex.map(gate_one, ids)))
    rows = [done[c] for c in CANDS]
    ctrl = [done[c] for c in ids if c in CONTROLS]
    table = {"made": now(), "shot": str(SHOT), "plan": str(PLAN), "rows": rows, "controls": ctrl,
             "gate": "C:/RnD/Projects/Habait/tools/bench/openings_gate.py (perspective mode, --out = the PNG)",
             "rule": "card 12: every judged opening kept >= 0.60 and the gate's own verdict PASS"}
    (OUT / "gate-table.json").write_text(json.dumps(table, indent=1, ensure_ascii=False), encoding="utf-8")
    hdr = f"{'id':4s} {'model':34s} {'seed':>4s} {'sha256':12s} {'hash':5s} {'judged':>6s} {'kept_min':>8s} {'shift_max':>9s} {'gate':6s} {'>=0.60':6s} {'kf clay->out':>12s}"
    print(f"openings_gate on the files on disk (shot {SHOT.name}: cp-living, bearing {VIEW_BEARING}, HFOV {VIEW_HFOV}, {W}x{H})")
    print(hdr)
    print("-" * len(hdr))

    def line(r):
        if r.get("missing"):
            return f"{r['id']:4s} MISSING {out_path(r['id'])}"
        model = r["endpoint"].split("/", 1)[1] if r["endpoint"].startswith("fal-ai/") else r["endpoint"]
        return (f"{r['id']:4s} {model[:34]:34s} {r['seed']:>4d} {r['sha256'][:12]:12s} {'ok' if r['hash_ok'] else 'DIFF':5s} "
                f"{r.get('judged', 0):>6d} {r.get('kept_min') if r.get('kept_min') is not None else '-':>8} "
                f"{r.get('shift_max') if r.get('shift_max') is not None else '-':>9} {r.get('verdict', '-'):6s} "
                f"{'yes' if r.get('all_ge_060') else 'no':6s} {(r.get('kf') or {}).get('clay_in_out', '-'):>12}")
    for r in rows:
        print(line(r))
    for r in ctrl:
        print(f"control (not in the A/B) {r['id']}: " + line(r)[5:])
    for r in rows:
        if r.get("per_item"):
            print(f"  {r['id']}: " + "  ".join(f"{i} {v['kept']:.3f}/{v['shift_deg']:.1f}deg{' FAIL' if v['fail'] else ''}"
                                             for i, v in r["per_item"].items()))
    missing = [r["id"] for r in rows if r.get("missing")]
    bad_hash = [r["id"] for r in rows if not r.get("missing") and not r["hash_ok"]]
    passing = [r["id"] for r in rows if r.get("all_ge_060")]
    print(f"rows {len(rows) - len(missing)}/6  hash mismatches {bad_hash or 'none'}  "
          f"candidates keeping >= 0.60 on every judged opening: {passing or 'none'}")
    if missing or bad_hash:
        return 2
    return 0 if passing else 1


# ---------------------------------------------------------------- the page
def thumb(src, name, width=760):
    VIEW.mkdir(parents=True, exist_ok=True)
    f = VIEW / name
    im = Image.open(src).convert("RGB")
    im.thumbnail((width, width))
    im.save(f, quality=88)
    return "../../_local/experiments/look-lock/view/" + name


# the eye notes (written by the agent after looking at every output; the gate does not see these things)
EYE = {
    "A1": "הכי פוטוריאליסטי. הגאומטריה של קיר הזכוכית, המנורה, הספה והמזנון נשמרה; מסגרות שחורות דקות, וילון פשתן, מרפסת וקו רקיע; רצפת אבן בלי פוגות. זה הלוק של הסיור.",
    "A2": "אותה איכות כמו A1, אבל **הוסיף דלת zero-line בקיר הימני** שאין ב-clay (השער לא שופט את הקיר הזה).",
    "B1": "עוקב אחרי המסה של העומק, אבל קיר הזכוכית מומצא מחדש: קצב מליונים אחר, המרפסת והעציץ נעלמו לעיר כללית, סנוור שמש, חיפוי עץ בקיר הימני. מרגיש כמו דירה אחרת; עבר את השער (0.658) כי השער בודק רק את שולי הקופסה.",
    "B2": "החלש: חלון ענק אחד במקום קיר הזכוכית, הספה זזה, מזנון אגוז כהה, בלי מרפסת.",
    "C1": "הלוק קרוב לסיור (קרם, אבן, בוקלה) והגאומטריה קרובה, אבל **הוסיף דלת עם משקוף** מימין לקיר הזכוכית (מפר את כלל zero-line) ומסגרות לבנות במקום שחורות; תאורה שטוחה, פחות פוטוריאליסטי מ-A.",
    "C2": "שומר את הגאומטריה הכי טוב מבין C; מסגרות לבנות, פלטה קרובה לסיור; קצת \"מחשב\" לעומת A.",
    "ctrl-C-nolora": "בלי ה-LoRA: **הפך את לוח הזכוכית השמאלי (facade-8) לדלת כפולה עם ידיות** ועדיין עבר את השער (0.856). ה-LoRA מחמם את הפלטה לכיוון הסיור; בלעדיו לבן קר יותר.",
    "ctrl-B-claycontrol": "FLUX Depth עם ה-clay כ-control שומר את המליונים טוב יותר (0.932) אבל ממציא קורה בתקרה ומזיז וילונות. כלומר רוב החולשה של B1/B2 באה מהעומק של Blender (הזכוכית שטוחה בו), לא מהמודל.",
    "הלקח לפרומפט": "המשפט \"every door is a zero-line flush door\" במבט שאין בו דלת גרם ל-A2, ל-C1 ולבקרה להמציא דלתות. להשמיט אותו כשבמבט אין דלת.",
}

REPORT_HE = [
    '<h2>החלפות מול הכרטיס (נרשמו)</h2><ol class="note">',
    '<li><b>המאמן:</b> הכרטיס אמר Flux.2 Klein (<code>fal-ai/flux-2-klein-9b-base-trainer</code>, $0.0043 לצעד). אבל המודל של C הוא '
    'Qwen-Image-Edit-2511, ו-LoRA של Klein לא נטען ב-Qwen; המאמן של Qwen-Image-Edit-2511 ב-fal מסומן deprecated, ומאמני ה-edit צריכים '
    'זוגות לפני/אחרי שאין להדמיות היזם. לכן <code>fal-ai/qwen-image-2512-trainer</code> (T2I, $0.0015 לצעד, 1000 צעדים = $1.50); '
    'LoRA של Qwen-Image חולק את שמות השכבות עם Qwen-Image-Edit.</li>',
    '<li><b>"עומק מ-Blender" ב-FLUX.1 Depth [pro]:</b> אף endpoint של FLUX depth ב-fal לא מקבל מפת עומק גולמית; כולם מריצים preprocessor '
    'משלהם על ה-control. שלחנו את עומק ה-Blender כתמונה. דרך זכוכית העומק של Blender הוא המרחק ללוח, כך שהמרפסת והמליונים לא קיימים '
    'בקלט של B והמודל ממציא אותם. בקרה: אותו מודל עם ה-clay כ-control.</li>',
    '<li><b>GPT בלי seed:</b> ה-endpoint לא מקבל seed; A1/A2 הן שתי דגימות עם אותו inputs_hash.</li>',
    '<li><b>עלויות:</b> fal לא מחזיר את החיוב בתשובה ו-API השימוש חסום למפתח הזה (403); ב-ledger המחיר לפי ה-pricing API החי '
    '(GPT 2.5 $1 ליחידה, הוזמן $1.20 כמו ב-memory §7; FLUX Depth pro $0.05/MP; Qwen-Edit-2511/lora $0.035/MP; המאמן $0.0015 לצעד).</li>',
    '<li><b>מבט פרספקטיבי ולא equirect:</b> FLUX Depth ו-Qwen מאומנים על פרספקטיבה. הכיוון נבחר כי רק בו ה-gate שופט פתחים אמיתיים '
    '(5 לוחות החזית); הדלת o-6 לא מצוירת ב-clay הזה.</li></ol>',
    '<h2>מגבלות השער</h2><ul class="note">',
    '<li><code>openings_gate</code> בודק את קווי המשקופים והראש של כל קופסת פתח ואת ההזזה שלהם. הוא לא בודק מליונים בתוך קיר הזכוכית, '
    'ריהוט או לוק. לכן העין של אלירן נשארת חלק מהקבלה (D-WQ-12).</li>',
    '<li>ה-clay ישן (אריחים עם פוגות, דלתות עם משקוף). חדר אחד, מבט אחד: אין כאן הוכחה לתפר 360 או לחדרים אחרים.</li>',
    '<li>D-WQ-18: הדמיות היזם שימשו לאימון בלבד, לא מוצגות כאן, לא בגיט (תחת <code>_local</code>); ה-zip הועלה לאחסון של fal לאימון בלבד. '
    'פלטי C הם ראיה פנימית עד הכרעת אלירן והסכמת היזם.</li></ul>',
]


def page():
    t = json.loads((OUT / "gate-table.json").read_text(encoding="utf-8"))
    led = ledger_load()
    man = json.loads((OUT / "train" / "manifest.json").read_text(encoding="utf-8")) if (OUT / "train" / "manifest.json").exists() else {"images": []}
    lj = json.loads((OUT / "train" / "lora.json").read_text(encoding="utf-8")) if (OUT / "train" / "lora.json").exists() else {}
    h = ['<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">',
         '<title>כרטיס 12: לוק נעול, A/B של שלושה מודלים על אותו clay (הסלון של 846)</title>',
         '<style>body{font-family:system-ui,Arial;background:#14161a;color:#e8e6e1;margin:24px;max-width:1700px}'
         'h1{font-size:22px}h2{font-size:18px;margin-top:28px}table{border-collapse:collapse;margin:10px 0}'
         'td,th{border:1px solid #444;padding:5px 9px;font-size:14px;text-align:center}th{background:#23262c}'
         '.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;direction:ltr}'
         'figure{margin:0}figure img{width:100%;display:block}figcaption{font-size:14px;margin:4px 0;direction:rtl}'
         '.ok{color:#7ddc7d}.bad{color:#ff7b7b}.note{color:#bbb;font-size:14px;line-height:1.6}small{color:#999}</style></head><body>',
         '<h1>כרטיס 12 (B2): "לוק נעול" — GPT Image 2.5 מול FLUX.1 Depth [pro] מול Qwen-Image-Edit-2511 + LoRA</h1>',
         '<p class="note">שלושת המודלים קיבלו את אותו מבט: חיתוך פרספקטיבי מתוך ה-clay של הסלון (cp-living, Cycles, 2026-11-01), '
         f'כיוון {VIEW_BEARING}°, HFOV {VIEW_HFOV}°, {W}×{H}. A ו-C קיבלו את ה-clay עצמו; B קיבל את העומק של אותו רנדר (ליניארי במטרים, קרוב = בהיר). '
         'הציון: <code>openings_gate.py</code> (מצב perspective) על כל פלט כפי שהוא שמור בדיסק, אחרי בדיקת sha256 מול ה-ledger. '
         'כלל הכרטיס: כל פתח שנשפט שומר ≥ 0.60 מקווי ה-clay וגם הפסק של השער עצמו PASS. '
         'ה-clay הזה ישן (אריחים עם פוגות, דלתות עם משקוף); הפתחים שנשפטים כאן הם 5 לוחות הזכוכית של החזית (facade), כי הדלת היחידה של החדר (o-6) לא מצוירת ב-clay הזה.</p>',
         '<h2>טבלה</h2><table><tr><th>מזהה</th><th>מודל</th><th>seed</th><th>hash</th><th>נשפטו</th><th>kept מינימום</th>'
         '<th>הזזה מקס׳ (°)</th><th>שער</th><th>≥ 0.60 בכל פתח</th><th>kf: קווי clay בפלט</th><th>עלות</th></tr>']
    cost = {}
    for c in led["calls"]:
        for cid in ALL:
            if c.get("output") == str(out_path(cid)):
                cost[cid] = cost.get(cid, 0) + float(c.get("cost", 0))
    for r in t["rows"] + t.get("controls", []):
        if r.get("missing"):
            h.append(f'<tr><td>{r["id"]}</td><td colspan="10">חסר</td></tr>')
            continue
        good = r.get("all_ge_060")
        h.append(f'<tr><td>{r["id"]}</td><td>{r["label"]}</td><td>{r["seed"]}</td><td><small>{r["sha256"][:12]}</small> '
                 f'{"✓" if r["hash_ok"] else "✗"}</td><td>{r.get("judged")}</td><td>{r.get("kept_min")}</td>'
                 f'<td>{r.get("shift_max")}</td><td>{r.get("verdict")}</td><td class="{"ok" if good else "bad"}">{"כן" if good else "לא"}</td>'
                 f'<td>{(r.get("kf") or {}).get("clay_in_out")}</td><td>${cost.get(r["id"], 0):.2f}</td></tr>')
    h.append('</table><p class="note">פירוט לכל לוח זכוכית (kept / הזזה במעלות) ב-<code>Habait/engine/_local/experiments/look-lock/gate-table.json</code>; '
             'גיליונות השער (clay משמאל, פלט מימין, ירוק = עבר) ב-<code>gate/&lt;id&gt;.sheet.png</code>.</p>')
    h.append('<h2>התמונות</h2><div class="grid">')
    h.append(f'<figure><img src="{thumb(SHOT / "frame_0001.png", "clay.jpg")}"><figcaption>הקלט: clay (A, C)</figcaption></figure>')
    h.append(f'<figure><img src="{thumb(OUT / "inputs" / "depth-control.png", "depth.jpg")}"><figcaption>הקלט: עומק מ-Blender (B)</figcaption></figure>')
    for r in t["rows"] + t.get("controls", []):
        if r.get("missing"):
            continue
        h.append(f'<figure><img src="{thumb(r["file"], r["id"] + ".jpg")}"><figcaption>{r["id"]} · {r["label"]} · seed {r["seed"]} · '
                 f'kept מינ׳ {r.get("kept_min")} · {r.get("verdict")}</figcaption></figure>')
    h.append('</div>')
    h.append('<h2>ה-LoRA</h2><p class="note">')
    if lj:
        h.append(f'מאמן: <code>{lj.get("endpoint")}</code>, {lj.get("steps")} צעדים, ${lj.get("cost")}; מילת הדק: <code>{TRIGGER}</code>; '
                 f'קובץ: <code>{lj.get("local_file")}</code>.<br>')
    h.append('תמונות האימון (שמות בלבד; הדמיות היזם לא מוצגות כאן ולא נכנסות לפריימים, D-WQ-18):</p><table><tr><th>קובץ</th><th>מקור</th><th>זכויות</th><th>כיתוב</th></tr>')
    for im in man.get("images", []):
        h.append(f'<tr><td>{im["file"]}</td><td><small>{im["source"]}</small></td><td>{im["rights"]}</td><td><small>{im["caption"]}</small></td></tr>')
    h.append('</table>')
    h.append('<h2>מה רואים בעין</h2><ul class="note">' + "".join(f'<li><b>{k}</b>: {re.sub(r"[*][*](.+?)[*][*]", r"<b>\1</b>", v)}</li>' for k, v in EYE.items()) + '</ul>')
    h.extend(REPORT_HE)
    h.append('<h2>השאלה לאלירן</h2><p class="note">איזה לוק? <b>A</b> GPT Image 2.5 (המצב היום) / <b>B</b> FLUX.1 Depth [pro] / '
             '<b>C</b> Qwen-Image-Edit-2511 + LoRA. ברירת מחדל אם אין תשובה: <b>A</b>, GPT 2.5 בלי LoRA נשאר המודל של הפרויקט.</p>')
    h.append(f'<p class="note"><small>נבנה {t["made"]} מ-gate-table.json; ledger: <code>{LEDGER}</code>, סה"כ ${ledger_total(led):.2f} מתוך ${CAP_USD:.0f}.</small></p></body></html>')
    (HERE / "compare.html").write_text("\n".join(h), encoding="utf-8")
    print(f"[page] {HERE / 'compare.html'}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--probe", action="store_true")
    ap.add_argument("--inputs", action="store_true")
    ap.add_argument("--gen", action="store_true")
    ap.add_argument("--only")
    ap.add_argument("--cap", type=float, default=CAP_USD)
    ap.add_argument("--gate-only", action="store_true")
    ap.add_argument("--page", action="store_true")
    a = ap.parse_args()
    if a.probe:
        sys.exit(0 if probe() else 1)
    if a.inputs:
        sys.exit(0 if build_inputs() else 1)
    if a.gen:
        if a.cap > CAP_USD:
            sys.exit(f"cap {a.cap} is above the card's ${CAP_USD:.0f}")
        if not (SHOT / "frame_0001.png").exists():
            sys.exit("run --inputs first")
        if not probe():
            sys.exit(3)
        ids = a.only.split(",") if a.only else list(CANDS)
        try:
            for cid in ids:
                gen_one(cid, a.cap)
        except Exhausted as e:
            print(f"fal balance exhausted, stopping: {e}")
            sys.exit(3)
        sys.exit(0)
    if a.gate_only:
        sys.exit(gate_only())
    if a.page:
        page()
        sys.exit(0)
    ap.print_help()
    sys.exit(2)


if __name__ == "__main__":
    main()
