"""run.py - card 11 (B3): can a <= $0.30 panorama replace GPT Image 2.5 ($1.20-$2.40 a call) on the apt846 living room?

Candidates on ONE clay equirect (cp-living, 2048x1024):
  seedream-clay          Seedream 5 Pro edit, image 1 = the clay as rendered (the model's join at u 0)
  seedream-rolled        the same, image 1 = the clay rolled so the join parks on a blank wall (the roll gen-pano.mjs
                         gave GPT: u_edge 0.0769), the answer rolled back into the camera frame ($0 trick)
  <name>+seam            close-seam.mjs's algorithm (roll the model's own join to the centre, repaint a 12 deg band with
                         the rolled clay as image 2, paste ONLY the band back with a 24 px feather, roll back), with
                         Seedream ($0.15) as the painter instead of GPT Image 2.5 ($2.40, hard-wired in close-seam.mjs)
  gpt25-raw / gpt25-final  the existing GPT Image 2.5 baseline (read only, never regenerated): the pick before and
                         after its GPT close-seam pass (+ the $0 doorfix)
Metrics (all $0): seam_diff = the seam step at the model's own join (close-seam.mjs's measure, ported: 8 px strips,
rows 25-85 %, greyscale) with its neighbour baseline; lr_diff (the fal-bench C metric: mean |8 px right - 8 px left|
of the join, RGB); clay edges kept per class (kf_check.py's own edge_mask/agree, imported read only), the classes
from a ray cast of the plan (plan.json walls / panes / doors) through the clay's own depth pass: there is no id pass
for interior panoramas and rendering one is a Blender job (habait-98).

  run.py --probe                        fal storage-token probe (no spend)
  run.py --gen  [--cap 5] [--only a,b]  Seedream generations (skips existing outputs; stops at 403 Exhausted balance)
  run.py --close a[,b] [--cap 5]        the Seedream close-seam port on generated candidates
  run.py --close2 a[,b] [--cap 5]       close v2: the clay pasted into a 20 deg band, Seedream paints the grey
  run.py --measure-only                 the table + metrics.json + the compare views, no network; exit 0 when measured
FAL_KEY is read by name from C:/RnD/Projects/Habait/habait-walkaround/.env and never printed.
"""
import argparse
import base64
import hashlib
import json
import os
import sys
import time
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]                                   # the worktree (or main tree) root
MAIN = Path("C:/RnD/Projects/Habait/habait-walkaround")              # untracked inputs live only in the main tree (read only)
LOCAL = ROOT / "Habait" / "engine" / "_local"            # a junction to the main tree's _local in the worktree
OUT = LOCAL / "experiments" / "panos-cheap"
GEN = OUT / "gen"
VIEW = OUT / "view"
LEDGER = LOCAL / "ledger-B3.json"
BENCH = Path("C:/RnD/Projects/Habait/tools/bench")

CLAY = MAIN / "360walkaround/tours/apt846-furnished/renders/cp-living/pano.webp"
DEPTH = MAIN / "360walkaround/tours/apt846-furnished/renders/cp-living/depth.png"
PLAN = MAIN / "360walkaround/tours/apt846-furnished/plan.json"
APT = MAIN / "Habait/tour360/apartments/apt846"
GPT_RAW = APT / "_local/generated/04-living__gpt25x__s7__050b25fd7799.png"
GPT_FINAL = APT / "panos/balanced/04-living.webp"
STYLE_SRC = [APT / "panos/balanced/02-kitchen.webp", APT / "panos/balanced/03-dining.webp",
             APT / "panos/balanced/04-living.webp"]
GPT_U = 0.0769                       # skin-prompts.json 04-living roll.u_edge: where GPT's own join sits
ENDPOINT = "bytedance/seedream/v5/pro/edit"
MODEL = "Seedream 5 Pro edit"
USD = 0.15                           # booked per call (fal-bench ledger-C: $0.15 at 2048x1024)
W, H = 2048, 1024
BAND_DEG, FEATHER = 12, 24

PROMPT_GEN = (
    "Image 1 is a plain computer render of the living room of a real apartment: a 360-degree equirectangular panorama "
    "(2:1) whose left and right edges meet behind the camera and must join seamlessly. Keep image 1 exactly as framed, "
    "change only the grey materials: every wall, ceiling line, column, glass wall, glass slider, door, kitchen unit and "
    "piece of furniture stays at exactly the same pixel position, size and perspective; nothing is added, removed or "
    "moved, and the projection stays the same equirectangular projection. Images 2 to 4 are crops of this apartment's "
    "finished tour: take ONLY their materials, colours and light from them, never their layout. The finishes: large "
    "pale limestone floor slabs, matte; warm off-white plaster walls and ceiling, the TV wall in pale textured "
    "limestone plaster; the grey sofa block becomes a cream boucle sofa on its own footprint; the low table becomes a "
    "travertine coffee table on its own footprint; the armchair becomes a cream boucle armchair; the media unit becomes "
    "a floating sand-grey matte lacquer unit; the kitchen is a bulthaup-style handleless run in matte sand-grey lacquer "
    "with a thin brushed stainless worktop, its cabinetry continuing to the end of its wall, the fridge integrated "
    "behind a flush tall column; every door is a zero-line flush door in cream, frameless, no architrave; no skirting; "
    "slim black frames on the glass, sheer linen curtains; outside the glass a sunlit terrace and a hazy Tel Aviv "
    "skyline. Soft natural daylight, photoreal, a very high-end finish. No people, no text, no logos, no watermark.")

PROMPT_SEAM = (
    "Image 1 is a 360-degree equirectangular photograph (2:1) of the living room of a real apartment, rotated so that "
    "the picture's original left and right edges now meet along a vertical line at the centre of the image. Repaint "
    "ONLY a narrow vertical band about 70 pixels wide around that centre line so that the floor, the walls, the ceiling "
    "and every object cross it continuously from the left side to the right side with no visible join: the same "
    "materials, the same light, the same furniture continued through the band. Image 2 is the plain computer render of "
    "the same room at the same rotation: inside the band it shows the true walls, openings, floor and furniture "
    "placeholders; follow its geometry and add no object the render does not show. Keep everything outside the band "
    "exactly as it is, same framing, same size. No text, no people, no watermark.")

BAND2_DEG, FEATHER2 = 20, 40
PROMPT_SEAM2 = (
    "Image 1 is a 360-degree equirectangular photograph (2:1) of a finished living room, rotated so that its original "
    "left and right edges meet at the centre of the image; a vertical strip at the centre is still the plain grey "
    "computer render. Keep image 1 exactly as framed, change only the grey strip: paint it with exactly the finishes, "
    "colours and light of the photograph on both sides of it, so that the floor slabs, the walls, the ceiling, the "
    "doors and the furniture continue across it with no visible join, no visible strip and no change of brightness. "
    "Every door is a zero-line flush door in cream, frameless, no architrave. Image 2 is the same plain computer render "
    "of the whole room at the same rotation, for the geometry only. Everything outside the strip stays exactly as it "
    "is. No text, no people, no watermark.")


# ---------------------------------------------------------------- small helpers
def sha_bytes(b):
    return hashlib.sha256(b).hexdigest()


def sha_file(p):
    return sha_bytes(Path(p).read_bytes())


def load_rgb(p, size=(W, H)):
    im = Image.open(p).convert("RGB")
    if im.size != size:
        im = im.resize(size, Image.LANCZOS)
    return np.asarray(im)


def save_png(a, p):
    Path(p).parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(a).save(p)


def roll_to(a, u_join, target_x):
    """roll a picture horizontally (wrapping) so the column at u_join lands at target_x."""
    xs = int(round(u_join * a.shape[1])) % a.shape[1]
    return np.roll(a, target_x - xs, axis=1)


def load_key():
    if os.environ.get("FAL_KEY"):
        return os.environ["FAL_KEY"]
    for line in (MAIN / ".env").read_text(encoding="utf-8").splitlines():
        if line.startswith("FAL_KEY="):
            os.environ["FAL_KEY"] = line.split("=", 1)[1].strip().strip('"')
            return os.environ["FAL_KEY"]
    sys.exit("FAL_KEY missing in .env")


# ---------------------------------------------------------------- the ledger and the cap
def ledger_load():
    if LEDGER.exists():
        return json.loads(LEDGER.read_text(encoding="utf-8"))
    return {"card": "11", "cap_usd": 5, "calls": []}


def ledger_save(d):
    LEDGER.parent.mkdir(parents=True, exist_ok=True)
    LEDGER.write_text(json.dumps(d, indent=1, ensure_ascii=False), encoding="utf-8")


def ledger_total(d):
    return round(sum(float(c.get("cost", c.get("cost_usd", 0))) for c in d["calls"]), 4)


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


def fal_call(name, args, files, raw_png, cap, note):
    """one ledgered Seedream call. files: {placeholder: path}; the placeholders in args["image_urls"] become uploaded
    URLs. Books USD before the call (reserve) and settles after; refuses past the cap; raises Exhausted on a 403."""
    import fal_client
    import requests
    if raw_png.exists():
        print(f"[{name}] skip (exists): {raw_png}")
        return True
    led = ledger_load()
    spent = ledger_total(led)
    if spent + USD > cap + 1e-9:
        print(f"[{name}] REFUSED: ${spent:.2f} spent + ${USD:.2f} would pass the cap ${cap:.2f}")
        return False
    load_key()
    inputs_sha = sha_bytes(json.dumps({"endpoint": ENDPOINT, "args": args,
                                       "files": {k: sha_file(v) for k, v in files.items()}}, sort_keys=True).encode())
    led["calls"].append({"model": MODEL, "endpoint": ENDPOINT, "inputs_sha256": inputs_sha, "cost_usd": USD,
                         "cost": USD, "ts": time.strftime("%Y-%m-%dT%H:%M:%S"), "output": str(raw_png),
                         "status": "reserved", "note": note})
    ledger_save(led)
    idx = len(led["calls"]) - 1

    def settle(cost, **kw):
        d = ledger_load()
        d["calls"][idx].update({"cost_usd": cost, "cost": cost, **kw})
        ledger_save(d)

    t0 = time.time()
    stage = "upload"
    try:
        urls = {k: fal_client.upload_file(str(v)) for k, v in files.items()}
        real = json.loads(json.dumps(args))
        real["image_urls"] = [urls.get(u, u) for u in real["image_urls"]]
        stage = "submit"
        h = fal_client.submit(ENDPOINT, arguments=real)
        stage = "run"
        print(f"[{name}] {ENDPOINT}: request {h.request_id}", flush=True)
        res = None
        while time.time() - t0 < 900:
            st = fal_client.status(ENDPOINT, h.request_id)
            if isinstance(st, fal_client.Completed):
                res = fal_client.result(ENDPOINT, h.request_id)
                break
            time.sleep(4)
        if res is None:
            raise TimeoutError("no result after 900 s")
    except Exception as e:  # noqa: BLE001
        msg = str(e)[:400]
        if "xhausted" in msg:
            settle(0.0, status="http-403-exhausted", error=msg)
            raise Exhausted(msg)
        # nothing is billed before the request runs; once it ran, book the worst case
        settle(0.0 if stage in ("upload", "submit") else USD, status=f"error-{stage}", error=msg)
        print(f"[{name}] FAILED at {stage}: {msg}", file=sys.stderr)
        return False
    secs = round(time.time() - t0)
    url = (res.get("images") or [{}])[0].get("url")
    if not url:
        settle(USD, status="billed-no-image", secs=secs)
        return False
    data = None
    for _ in range(4):
        try:
            if url.startswith("data:"):
                data = base64.b64decode(url.split(",", 1)[1])
            else:
                rr = requests.get(url, timeout=300)
                rr.raise_for_status()
                data = rr.content
            break
        except Exception:  # noqa: BLE001
            time.sleep(5)
    if data is None:
        settle(USD, status="billed-download-failed", secs=secs, url=url)
        return False
    raw_png.parent.mkdir(parents=True, exist_ok=True)
    raw_png.write_bytes(data)
    (raw_png.parent / (raw_png.name.replace(".png", "") + ".call.json")).write_text(json.dumps(
        {"endpoint": ENDPOINT, "args": args, "files": {k: str(v) for k, v in files.items()}, "secs": secs,
         "result_meta": {k: v for k, v in res.items() if k != "images"}}, indent=1, ensure_ascii=False),
        encoding="utf-8")
    settle(USD, status="ok", secs=secs)
    print(f"[{name}] OK in {secs}s, booked ${USD:.2f}; ledger ${ledger_total(ledger_load()):.2f}")
    return True


# ---------------------------------------------------------------- inputs
def style_crops():
    """crops of the existing GPT tour panoramas (the tour look), never a material board."""
    outs = []
    boxes = [(STYLE_SRC[0], 0.30, 0.70), (STYLE_SRC[1], 0.30, 0.70), (STYLE_SRC[2], 0.25, 0.65)]
    for i, (p, u0, u1) in enumerate(boxes):
        f = OUT / "inputs" / f"style-{i + 1}-{p.stem}.png"
        if not f.exists():
            a = load_rgb(p)
            save_png(np.ascontiguousarray(a[int(H * 0.22):int(H * 0.78), int(W * u0):int(W * u1)]), f)
        outs.append(f)
    return outs


def clay_inputs():
    clay = load_rgb(CLAY)
    f0 = OUT / "inputs" / "clay.png"
    if not f0.exists():
        save_png(clay, f0)
    f1 = OUT / "inputs" / "clay-rolled.png"
    if not f1.exists():
        save_png(roll_to(clay, GPT_U, 0), f1)          # camera column u_edge becomes image column 0
    return f0, f1


# ---------------------------------------------------------------- generation and the close
CANDS = {"seedream-clay": {"input": "clay", "u_join": 0.0},
         "seedream-rolled": {"input": "rolled", "u_join": GPT_U}}


def finished(name):
    """the candidate in the camera frame (rolled back), from its raw answer."""
    out = GEN / f"{name}.png"
    if out.exists():
        return out
    raw = GEN / f"{name}.raw.png"
    if not raw.exists():
        return None
    a = load_rgb(raw)
    if CANDS[name]["input"] == "rolled":
        a = roll_to(a, 0.0, int(round(GPT_U * W)))      # the answer's column 0 back to camera column u_edge
    save_png(a, out)
    return out


def do_gen(names, cap):
    fclay, frolled = clay_inputs()
    refs = style_crops()
    for n in names:
        if finished(n):
            print(f"[{n}] skip (exists)")
            continue
        img1 = fclay if CANDS[n]["input"] == "clay" else frolled
        files = {"@img1": img1, **{f"@ref{i + 2}": r for i, r in enumerate(refs)}}
        args = {"prompt": PROMPT_GEN, "image_urls": list(files.keys()), "image_size": {"width": W, "height": H},
                "num_images": 1, "output_format": "png", "enable_safety_checker": True}
        if fal_call(n, args, files, GEN / f"{n}.raw.png", cap, f"card 11 gen {n}"):
            finished(n)


def do_close(name, cap):
    src = GEN / f"{name}.png"
    if not src.exists():
        print(f"[{name}+seam] {name} not generated yet")
        return
    out = GEN / f"{name}+seam.png"
    if out.exists():
        print(f"[{name}+seam] skip (exists)")
        return
    u = CANDS[name]["u_join"]
    rolled = roll_to(load_rgb(src), u, W // 2)
    cg = roll_to(load_rgb(CLAY), u, W // 2)
    f1, f2 = OUT / "inputs" / f"{name}.seam-in.png", OUT / "inputs" / f"clay.seam-in-{name}.png"
    if not f1.exists():
        save_png(rolled, f1)
    if not f2.exists():
        save_png(cg, f2)
    raw = GEN / f"{name}+seam.raw.png"
    args = {"prompt": PROMPT_SEAM, "image_urls": ["@img1", "@img2"], "image_size": {"width": W, "height": H},
            "num_images": 1, "output_format": "png", "enable_safety_checker": True}
    if not fal_call(f"{name}+seam", args, {"@img1": f1, "@img2": f2}, raw, cap, f"card 11 close-seam port on {name}"):
        return
    ans = load_rgb(raw)
    band = int(round(BAND_DEG / 360 * W))
    b0 = W // 2 - band // 2
    b1 = b0 + band
    x = np.arange(W, dtype=np.float64)
    w = np.where(x < b0, (x - (b0 - FEATHER)) / FEATHER, np.where(x >= b1, ((b1 + FEATHER) - x) / FEATHER, 1.0))
    w = np.clip(w, 0, 1)[None, :, None]
    merged = (rolled * (1 - w) + ans * w).round().clip(0, 255).astype(np.uint8)
    save_png(roll_to(merged, 0.5, int(round(u * W)) % W), out)        # the centre column back to the join
    print(f"[{name}+seam] written {out}")


def band_weights(band_deg, feather):
    band = int(round(band_deg / 360 * W))
    b0 = W // 2 - band // 2
    b1 = b0 + band
    x = np.arange(W, dtype=np.float64)
    w = np.where(x < b0, (x - (b0 - feather)) / feather, np.where(x >= b1, ((b1 + feather) - x) / feather, 1.0))
    return np.clip(w, 0, 1)[None, :, None], b0, b1


def do_close2(name, cap):
    """v2 of the close, built for a model that copies image 1 faithfully (Seedream keeps the join it is shown):
    image 1 = the rolled candidate with the CLAY pasted into a 20 deg band over the join (hard edge), so the only
    grey left in the picture is the band; the prompt is the generation's own 'change only the grey' instruction.
    The answer's band is pasted back with a 40 px feather (nothing outside band+feather changes), then rolled back."""
    src = GEN / f"{name}.png"
    out = GEN / f"{name}+seam2.png"
    if not src.exists():
        print(f"[{name}+seam2] {name} not generated yet")
        return
    if out.exists():
        print(f"[{name}+seam2] skip (exists)")
        return
    u = CANDS[name]["u_join"]
    rolled = roll_to(load_rgb(src), u, W // 2)
    cg = roll_to(load_rgb(CLAY), u, W // 2)
    _, b0, b1 = band_weights(BAND2_DEG, 1)
    holed = rolled.copy()
    holed[:, b0:b1] = cg[:, b0:b1]
    f1, f2 = OUT / "inputs" / f"{name}.seam2-in.png", OUT / "inputs" / f"clay.seam-in-{name}.png"
    if not f1.exists():
        save_png(holed, f1)
    if not f2.exists():
        save_png(cg, f2)
    raw = GEN / f"{name}+seam2.raw.png"
    args = {"prompt": PROMPT_SEAM2, "image_urls": ["@img1", "@img2"], "image_size": {"width": W, "height": H},
            "num_images": 1, "output_format": "png", "enable_safety_checker": True}
    if not fal_call(f"{name}+seam2", args, {"@img1": f1, "@img2": f2}, raw, cap,
                    f"card 11 close-seam v2 (clay strip in the band) on {name}"):
        return
    ans = load_rgb(raw)
    w, _, _ = band_weights(BAND2_DEG, FEATHER2)
    merged = (rolled * (1 - w) + ans * w).round().clip(0, 255).astype(np.uint8)
    save_png(roll_to(merged, 0.5, int(round(u * W)) % W), out)
    print(f"[{name}+seam2] written {out}")


# ---------------------------------------------------------------- the class map (plan ray cast through the depth pass)
CLASS_NAMES = {1: "walls", 2: "glazing", 3: "doors", 4: "furniture", 6: "floors_ceilings"}


def class_map():
    f = OUT / "classmap.png"
    if f.exists():
        return np.asarray(Image.open(f))
    import shapely
    from shapely.geometry import LineString, Polygon
    plan = json.loads(PLAN.read_text(encoding="utf-8"))
    cam = next(c for c in plan["camera_points"] if c["id"] == "cp-living")
    d = np.asarray(Image.open(DEPTH).convert("RGB")).astype(np.int64)
    depth_cm = ((d[..., 0] << 16) | (d[..., 1] << 8) | d[..., 2]).astype(np.float64)   # value/100 = m, so value = cm
    hh, ww = depth_cm.shape
    u = (np.arange(ww) + 0.5) / ww
    lat = np.deg2rad(90 - (np.arange(hh) + 0.5) / hh * 180)
    bearing = np.deg2rad(cam["yaw_deg"] + (u - 0.5) * 360)                 # bearing: 0 = up (-y), clockwise
    cl = np.cos(lat)[:, None]
    dx, dy = np.sin(bearing)[None, :] * cl, -np.cos(bearing)[None, :] * cl
    dz = np.sin(lat)[:, None] * np.ones((1, ww))
    px, py, pz = cam["x"] + dx * depth_cm, cam["y"] + dy * depth_cm, cam["z"] + dz * depth_cm
    pts = shapely.points(px.ravel(), py.ravel())

    def near(geoms, tol):
        return (shapely.distance(pts, shapely.union_all(geoms)) <= tol).reshape(hh, ww)

    walls = near([Polygon(w["polygon_cm"]).buffer(0) for w in plan["walls"]], 4)
    panes = near([Polygon(p["polygon_cm"]).buffer(0) for p in plan["panes"] if len(p["polygon_cm"]) >= 3], 6)
    doors = near([LineString([o["a_cm"], o["b_cm"]]) for o in plan["openings"]
                  if o["kind"] in ("door", "entrance_door")], 12)
    cls = np.full((hh, ww), 4, np.uint8)
    cls[walls & (pz < 290)] = 1
    cls[panes & (pz < 290)] = 2
    cls[doors & (pz < 216)] = 3
    cls[(pz < 2.5) | (pz > 287.5)] = 6
    cls[depth_cm <= 0] = 0
    save_png(cls, f)
    return cls


# ---------------------------------------------------------------- the metrics
def seam_step(a, u):
    """close-seam.mjs's measure, ported: |mean of the 8 px strip at the join - the 8 px strip left of it|, rows
    25-85 % every 2nd row; the same step at neighbour columns (64..W-64 every 97, every 8th row) is the baseline."""
    g = cv2.cvtColor(a, cv2.COLOR_RGB2GRAY).astype(np.float64)
    hh, ww = g.shape
    r0, r1, S = int(hh * 0.25), int(hh * 0.85), 8
    xj = int(round(u * ww)) % ww

    def strip(r, c0):
        return g[r, np.arange(c0, c0 + S) % ww].mean()
    wrap = np.mean([abs(strip(r, xj) - strip(r, xj - S)) for r in range(r0, r1, 2)])
    base = np.mean([abs(strip(r, c - S) - strip(r, c)) for r in range(r0, r1, 8) for c in range(64, ww - 64, 97)])
    return round(float(wrap), 2), round(float(base), 2)


def lr_diff(a, u):
    """fal-bench C's L/R diff, at the join: mean |8 columns right of the join - 8 columns left of it| (RGB)."""
    ww = a.shape[1]
    xj = int(round(u * ww)) % ww
    r = a[:, np.arange(xj, xj + 8) % ww].astype(np.float32)
    l_ = a[:, np.arange(xj - 8, xj) % ww].astype(np.float32)
    return round(float(np.abs(r - l_).mean()), 1)


def edges_by_class(clay, out, cls):
    sys.path.insert(0, str(BENCH))
    import kf_check as kc                        # read only: kf_check's own edge_mask / agree
    import openings_gate as og
    tol = int(max(3, min(24, round(og.TOL_DEG / (360.0 / W)))))
    kern = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * tol + 1,) * 2)
    ec = kc.edge_mask(cv2.cvtColor(clay, cv2.COLOR_RGB2BGR))
    ek = kc.edge_mask(cv2.cvtColor(out, cv2.COLOR_RGB2BGR))
    res = {"all": kc.agree(ec, ek, kern)[0]}
    for v, nme in CLASS_NAMES.items():
        reg = cls == v
        if reg.mean() < 0.005:
            continue
        res[nme] = kc.agree(ec, ek, kern, reg)[0]
    return res, tol


def candidates():
    rows = [("clay", CLAY, 0.0, 0.0, "the source (Blender, wrap-padded)"),
            ("gpt25-raw", GPT_RAW, GPT_U, 2.40, "GPT Image 2.5 pick before its close-seam (apt846 ledger seq 23)"),
            ("gpt25-final", GPT_FINAL, GPT_U, 4.80, "GPT Image 2.5 + GPT close-seam ($2.40) + doorfix ($0) = the tour")]
    for n, c in CANDS.items():
        rows.append((n, GEN / f"{n}.png", c["u_join"], USD, f"Seedream 5 Pro, image 1 = {c['input']} clay"))
        rows.append((n + "+seam", GEN / f"{n}+seam.png", c["u_join"], 2 * USD,
                     f"{n} + close-seam port with Seedream as the painter"))
        rows.append((n + "+seam2", GEN / f"{n}+seam2.png", c["u_join"], 2 * USD,
                     f"{n} + close-seam v2 (clay strip in a 20 deg band, Seedream paints the grey)"))
    return rows


def measure():
    clay = load_rgb(CLAY)
    cls = class_map()
    share = {CLASS_NAMES.get(int(v), str(int(v))): round(float((cls == v).mean()), 3) for v in np.unique(cls)}
    res, tol = {}, None
    for name, p, u, usd, what in candidates():
        if not Path(p).exists():
            res[name] = {"missing": True, "what": what}
            continue
        a = load_rgb(p)
        st, base = seam_step(a, u)
        e, tol = edges_by_class(clay, a, cls)
        res[name] = {"what": what, "path": str(p), "u_join": u, "seam_step": st, "seam_neighbours": base,
                     "lr_diff": lr_diff(a, u), "lr_diff_x0": lr_diff(a, 0.0), "edges": e, "usd": usd}
    gf = res.get("gpt25-final", {})
    for name, r in res.items():
        if r.get("missing") or not name.startswith("seedream"):
            continue
        r["pass_seam"] = bool(r["seam_step"] <= gf["seam_step"] and r["lr_diff"] <= gf["lr_diff"])
        r["pass_edges"] = bool((r["edges"].get("walls") or 0) >= 0.95 and (r["edges"].get("glazing") or 0) >= 0.95)
        r["pass_cost"] = bool(r["usd"] <= 0.30)
        r["pass_all"] = r["pass_seam"] and r["pass_edges"] and r["pass_cost"]
    doc = {"at": time.strftime("%Y-%m-%dT%H:%M:%S"), "class_share": share, "tol_px": tol, "candidates": res,
           "ledger_usd": ledger_total(ledger_load())}
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "metrics.json").write_text(json.dumps(doc, indent=1, ensure_ascii=False), encoding="utf-8")
    views(res, cls)
    print(f"class share of frame (plan ray cast through the clay depth): {share}; edge tol {tol} px")
    print(f"{'candidate':22} {'usd':>5} {'seam_diff':>9} {'(nbrs)':>6} {'lr_diff':>7} {'edges_walls':>11} "
          f"{'edges_glazing':>13} {'doors':>5} {'all':>5}  verdict (seam/edges/cost)")
    measured = 0
    for name, r in res.items():
        if r.get("missing"):
            print(f"{name:22} (not generated)")
            continue
        measured += 1
        e = r["edges"]
        v = "-"
        if "pass_all" in r:
            v = ("PASS " if r["pass_all"] else "FAIL ") + "/".join(
                "ok" if r[k] else "x" for k in ("pass_seam", "pass_edges", "pass_cost"))
        print(f"{name:22} {r['usd']:5.2f} {r['seam_step']:9.2f} {r['seam_neighbours']:6.2f} {r['lr_diff']:7.1f} "
              f"{e.get('walls') or 0:11.3f} {e.get('glazing') or 0:13.3f} {e.get('doors') or 0:5.3f} "
              f"{e.get('all') or 0:5.3f}  {v}")
    print(f"ledger {LEDGER.name}: ${doc['ledger_usd']:.2f} of $5.00")
    page(doc)
    return measured


LABEL_HE = {"clay": "clay (המקור, Blender)", "gpt25-raw": "GPT 2.5 לפני close-seam",
            "gpt25-final": "GPT 2.5 בסיור (אחרי close-seam)", "seedream-clay": "Seedream 5 Pro (clay כפי שהוא)",
            "seedream-clay+seam": "Seedream + close-seam port (v1)",
            "seedream-clay+seam2": "Seedream + close-seam v2 (רצועת clay)",
            "seedream-rolled": "Seedream (clay מגולגל כמו ל-GPT)",
            "seedream-rolled+seam": "Seedream מגולגל + close-seam port (v1)",
            "seedream-rolled+seam2": "Seedream מגולגל + close-seam v2"}
PAGE_ORDER = ["clay", "gpt25-final", "seedream-clay", "seedream-clay+seam2", "seedream-clay+seam", "gpt25-raw",
              "seedream-rolled", "seedream-rolled+seam2", "seedream-rolled+seam"]


def page(doc):
    """compare.html beside this script; the images are the _local views (a junction in the worktree)."""
    rel = "../../_local/experiments/panos-cheap/view/"
    c = doc["candidates"]
    rows = []
    for n in PAGE_ORDER:
        r = c.get(n, {})
        if r.get("missing") or not r:
            continue
        e = r["edges"]
        v = ""
        if "pass_all" in r:
            v = ("עובר" if r["pass_all"] else "נכשל") + " (" + ", ".join(
                f"{k}: {'כן' if r[p] else 'לא'}" for k, p in (("תפר", "pass_seam"), ("קצוות", "pass_edges"),
                                                             ("מחיר", "pass_cost"))) + ")"
        rows.append(f"<tr><td>{LABEL_HE.get(n, n)}</td><td>${r['usd']:.2f}</td><td>{r['seam_step']:.2f} "
                    f"<small>({r['seam_neighbours']:.1f})</small></td><td>{r['lr_diff']:.1f}</td>"
                    f"<td>{(e.get('walls') or 0):.3f}</td><td>{(e.get('glazing') or 0):.3f}</td>"
                    f"<td>{(e.get('doors') or 0):.3f}</td><td>{v}</td></tr>")
    figs = []
    for n in ["clay", "gpt25-final", "seedream-clay", "seedream-clay+seam2", "seedream-rolled+seam2"]:
        if c.get(n, {}).get("missing") or n not in c:
            continue
        figs.append(f"<figure><figcaption>{LABEL_HE.get(n, n)}</figcaption><img src='{rel}{n}.jpg' loading='lazy'>"
                    f"</figure>")
    seams = []
    for n in ["clay", "gpt25-raw", "gpt25-final", "seedream-clay", "seedream-clay+seam", "seedream-clay+seam2",
              "seedream-rolled", "seedream-rolled+seam", "seedream-rolled+seam2"]:
        if c.get(n, {}).get("missing") or n not in c:
            continue
        seams.append(f"<figure class='s'><figcaption>{LABEL_HE.get(n, n)}<br><b>{c[n]['seam_step']:.2f}</b></figcaption>"
                     f"<img src='{rel}{n}.seam.jpg' loading='lazy'></figure>")
    html = f"""<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<title>כרטיס 11: פנורמות זולות (Seedream) מול GPT 2.5, הסלון של 846</title>
<style>body{{font-family:system-ui,Arial;background:#14161a;color:#e8e6e1;margin:24px;max-width:1700px}}
h1{{font-size:22px}}h2{{font-size:18px;margin-top:28px}}table{{border-collapse:collapse;margin:10px 0}}
td,th{{border:1px solid #444;padding:5px 9px;font-size:14px;text-align:center}}th{{background:#23262c}}
figure{{margin:10px 0}}figure img{{width:100%;max-width:1600px;display:block}}figcaption{{margin:4px 0;font-size:14px}}
.row{{display:flex;flex-wrap:wrap;gap:10px;direction:ltr}}.s{{width:180px}}.s img{{width:180px}}
small{{color:#999}}.note{{color:#bbb;font-size:14px;line-height:1.6}}</style></head><body>
<h1>כרטיס 11 (B3): האם Seedream 5 Pro ב-$0.30 לפנורמה יכול להחליף את GPT Image 2.5 בסלון של 846?</h1>
<p class="note">אותו clay equirect (cp-living, 2048×1024). seam_diff = קפיצת התפר במקום שבו המודל עצמו חיבר את הקצוות
(המדד של close-seam.mjs; בסוגריים: אותה קפיצה בעמודות שכנות רגילות). lr_diff = המדד של הבנצ'מרק (8 פיקסלים מכל צד של התפר).
קצוות = חלק מקווי ה-clay שנמצאים בפלט, לפי מחלקה (קירות/זיגוג/דלתות), כשהמחלקות מוטלות מתכנית הדירה דרך מפת העומק של ה-clay
(אין id pass לפנורמות פנים). הסף בכרטיס: תפר ≤ GPT, קירות וזיגוג ≥ 0.95, מחיר ≤ $0.30. Skybox: לא נבדק (אין מפתח ב-.env).
נוצר {doc['at']}; ledger-B3: ${doc['ledger_usd']:.2f} מתוך $5.</p>
<h2>המספרים</h2><table><tr><th>מועמד</th><th>מחיר לפנורמה</th><th>seam_diff</th><th>lr_diff</th><th>קירות</th>
<th>זיגוג</th><th>דלתות</th><th>מול הסף</th></tr>{''.join(rows)}</table>
<p class="note">GPT בסיור: $2.40 ליצירה ב-3840×1920 + $2.40 ל-close-seam = $4.80 (לפי ledger הסיור); ב-2048×1024 הקריאה עולה $1.20.</p>
<h2>התפר: 40° סביב המקום שבו המודל חיבר את הקצוות (הסימון האדום = קו החיבור)</h2><div class="row">{''.join(seams)}</div>
<h2>הפנורמות המלאות</h2>{''.join(figs)}
<p class="note">מפת המחלקות (כחול = קירות, טורקיז = זיגוג, כתום = דלתות, אפור = ריהוט, לבן = רצפה/תקרה):</p>
<figure><img src="{rel}classmap.jpg" style="max-width:800px"></figure>
</body></html>"""
    (HERE / "compare.html").write_text(html, encoding="utf-8")


def views(res, cls):
    """jpg views for compare.html: the whole panorama, and a 40 deg window centred on each candidate's own join."""
    VIEW.mkdir(parents=True, exist_ok=True)
    for name, r in res.items():
        if r.get("missing"):
            continue
        a = load_rgb(r["path"])
        Image.fromarray(a).resize((1600, 800), Image.LANCZOS).save(VIEW / f"{name}.jpg", quality=86)
        c = roll_to(a, r["u_join"], W // 2)
        half = int(W * 20 / 360)
        c = np.ascontiguousarray(c[int(H * 0.15):int(H * 0.95), W // 2 - half:W // 2 + half])
        tick = c.copy()
        tick[:12, half - 1:half + 1] = (255, 0, 0)
        tick[-12:, half - 1:half + 1] = (255, 0, 0)
        Image.fromarray(tick).resize((tick.shape[1] * 2, tick.shape[0] * 2), Image.LANCZOS).save(
            VIEW / f"{name}.seam.jpg", quality=88)
    pal = np.array([[0, 0, 0], [70, 130, 255], [0, 230, 230], [255, 120, 0], [150, 150, 150], [0, 0, 0],
                    [255, 255, 255]], np.uint8)
    Image.fromarray(pal[cls]).resize((1600, 800), Image.NEAREST).save(VIEW / "classmap.jpg", quality=86)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--probe", action="store_true")
    ap.add_argument("--gen", action="store_true")
    ap.add_argument("--only", default="")
    ap.add_argument("--close", default="")
    ap.add_argument("--close2", default="")
    ap.add_argument("--cap", type=float, default=5.0)
    ap.add_argument("--measure-only", action="store_true")
    a = ap.parse_args()
    if a.cap > 5.0:
        sys.exit("card 11 cap is $5.00")
    try:
        if a.probe:
            sys.exit(0 if probe() else 1)
        if a.gen or a.close or a.close2:
            if not probe():
                sys.exit(1)
            OUT.mkdir(parents=True, exist_ok=True)
            if a.gen:
                do_gen([n for n in (a.only.split(",") if a.only else CANDS) if n], a.cap)
            for n in [x for x in a.close.split(",") if x]:
                do_close(n, a.cap)
            for n in [x for x in a.close2.split(",") if x]:
                do_close2(n, a.cap)
            return
    except Exhausted as e:
        print(f"STOP: fal 403 Exhausted balance ({str(e)[:120]})")
        sys.exit(3)
    sys.exit(0 if measure() > 0 else 2)


if __name__ == "__main__":
    main()
