#!/usr/bin/env python
"""maai.py — MyArchitectAI API client for Habait Studio (2026-11-01).
Spec: https://portal.myarchitectai.com/openapi.json (base https://api.myarchitectai.com/v1, header x-api-key).
The key is MYARCHITECTAI_API_KEY, read from the environment or the repo root .env by NAME; never printed.
Every paid call is a dry run unless --allow-spend (the studio stages gate spending the same way as fal_*.py).

  maai.py balance
  maai.py render  --image clay.png --out kf.png [--prompt "..."] [--scene interior|exterior]
  maai.py textures --image kf.png --mask mask.png --out out.png (--prompt "..." | --reference tex.png)
  maai.py atmosphere --image kf.png --out out.png --scene interior --lighting "<value>"
                     | --scene exterior [--time-of-day v] [--season v] [--weather v]
  maai.py style    --image clay.png --reference pano-crop.png --out out.png [--strength 0.7] [--prompt ...]
  maai.py edit     --image kf.png --prompt "..." --out out.png [--reference ref.png]
  maai.py animate  --image start.png --out clip.mp4 --prompt "camera ..." [--end end.png]
  maai.py upscale  --image kf.png --out big.png [--target 4k|8k]
  maai.py autoprompt --image clay.png
Images go inline as data URIs (the local files never need a public URL). The answer URL is downloaded to --out
(the server answers `output` as a list of URLs, or a string for auto-prompt); --fit WxH centre-crops and resizes
the download to the clay size, like fal_image.py."""
import argparse
import base64
import json
import mimetypes
import os
import sys
import time

BASE = "https://api.myarchitectai.com/v1"


def load_key():
    key = os.environ.get("MYARCHITECTAI_API_KEY")
    if key:
        return key.strip()
    here = os.path.dirname(os.path.abspath(__file__))
    for up in range(6):
        env_path = os.path.join(here, *([".."] * up), ".env")
        if os.path.exists(env_path):
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("MYARCHITECTAI_API_KEY="):
                        return line.split("=", 1)[1].strip().strip('"').strip("'")
    return None


def data_uri(path):
    mime = mimetypes.guess_type(path)[0] or "image/png"
    with open(path, "rb") as f:
        return f"data:{mime};base64,{base64.b64encode(f.read()).decode('ascii')}"


def call(key, endpoint, body, timeout=300):
    import requests
    r = requests.post(f"{BASE}{endpoint}", headers={"x-api-key": key, "Content-Type": "application/json"},
                      json=body, timeout=timeout)
    try:
        js = r.json()
    except ValueError:
        js = {"raw": r.text[:500]}
    if r.status_code != 200:
        print(f"maai: HTTP {r.status_code} {json.dumps(js)[:400]}", file=sys.stderr)
        return None
    return js


def first_url(js):
    out = js.get("output") if isinstance(js, dict) else None
    if isinstance(out, list) and out:
        return out[0]
    if isinstance(out, str) and out.startswith("http"):
        return out
    for k in ("image_url", "url", "video_url"):
        if isinstance(js.get(k), str):
            return js[k]
    return None


def download(url, out, fit=None):
    import requests
    for attempt in range(4):
        try:
            r = requests.get(url, timeout=300)
            r.raise_for_status()
            break
        except Exception as e:  # noqa: BLE001
            print(f"download attempt {attempt + 1} failed: {e}", file=sys.stderr)
            if attempt == 3:
                return False
            time.sleep(5 * (attempt + 1))
    with open(out + ".url", "w", encoding="utf-8") as f:
        f.write(url)
    if not fit:
        with open(out, "wb") as f:
            f.write(r.content)
        return True
    import cv2
    import numpy as np
    with open(out + ".raw" + os.path.splitext(out)[1], "wb") as f:
        f.write(r.content)
    W, H = [int(v) for v in fit.lower().split("x")]
    im = cv2.imdecode(np.frombuffer(r.content, np.uint8), cv2.IMREAD_COLOR)
    h, w = im.shape[:2]
    if w / h > W / H:
        cw = round(h * W / H)
        im = im[:, (w - cw) // 2:(w - cw) // 2 + cw]
    else:
        ch = round(w * H / W)
        im = im[(h - ch) // 2:(h - ch) // 2 + ch]
    im = cv2.resize(im, (W, H), interpolation=cv2.INTER_AREA)
    cv2.imencode(os.path.splitext(out)[1] or ".png", im)[1].tofile(out)
    print(f"fit {w}x{h} -> {W}x{H}")
    return True


def main():
    ap = argparse.ArgumentParser(prog="maai.py")
    ap.add_argument("cmd", choices=["balance", "render", "textures", "atmosphere", "style", "edit", "animate", "upscale", "autoprompt"])
    ap.add_argument("--image")
    ap.add_argument("--mask")
    ap.add_argument("--reference")
    ap.add_argument("--end")
    ap.add_argument("--prompt")
    ap.add_argument("--negative")
    ap.add_argument("--scene", default="interior", choices=["interior", "exterior"])
    ap.add_argument("--lighting")
    ap.add_argument("--time-of-day")
    ap.add_argument("--season")
    ap.add_argument("--weather")
    ap.add_argument("--strength", type=float)
    ap.add_argument("--target", default="4k", choices=["4k", "8k"])
    ap.add_argument("--format", default="png", choices=["png", "jpg", "webp"])
    ap.add_argument("--fit", help="WxH: centre-crop + resize the download to the clay size")
    ap.add_argument("--out")
    ap.add_argument("--allow-spend", action="store_true")
    a = ap.parse_args()
    key = load_key()
    if not key:
        print("maai: MYARCHITECTAI_API_KEY missing (environment or the repo root .env)", file=sys.stderr)
        return 2
    if a.cmd == "balance":
        js = call(key, "/balance", {})
        print(json.dumps(js))
        return 0 if js else 1
    body, endpoint = {}, None
    if a.cmd == "render":
        endpoint = f"/render/{a.scene}"
        body = {"image": data_uri(a.image), "outputFormat": a.format}
        if a.prompt:
            body["prompt"] = a.prompt
    elif a.cmd == "textures":
        endpoint = "/change-textures"
        body = {"image": data_uri(a.image), "mask": data_uri(a.mask), "outputFormat": a.format}
        if a.reference:
            body["referenceImage"] = data_uri(a.reference)
        elif a.prompt:
            body["prompt"] = a.prompt
    elif a.cmd == "atmosphere":
        endpoint = "/set-atmosphere"
        body = {"image": data_uri(a.image), "sceneType": a.scene, "outputFormat": a.format}
        if a.scene == "interior":
            body["lighting"] = a.lighting
        else:
            for k, v in (("timeOfDay", a.time_of_day), ("season", a.season), ("weather", a.weather)):
                if v:
                    body[k] = v
    elif a.cmd == "style":
        endpoint = "/style-transfer"
        body = {"image": data_uri(a.image), "referenceImage": data_uri(a.reference), "outputFormat": a.format}
        if a.prompt:
            body["prompt"] = a.prompt
        if a.negative:
            body["negativePrompt"] = a.negative
        if a.strength is not None:
            body["styleTransferStrength"] = a.strength
    elif a.cmd == "edit":
        endpoint = "/edit-by-prompt"
        body = {"image": data_uri(a.image), "prompt": a.prompt}
        if a.reference:
            body["referenceImage"] = data_uri(a.reference)
    elif a.cmd == "animate":
        endpoint = "/animate"
        body = {"startFrameUrl": data_uri(a.image), "prompt": a.prompt}
        if a.end:
            body["endFrameUrl"] = data_uri(a.end)
    elif a.cmd == "upscale":
        endpoint = "/upscale"
        body = {"image": data_uri(a.image), "targetResolution": a.target, "outputFormat": a.format if not (a.target == "8k" and a.format == "png") else "jpg"}
    elif a.cmd == "autoprompt":
        endpoint = "/auto-prompt"
        body = {"image": data_uri(a.image)}
    if not a.allow_spend:
        shown = {k: (v[:40] + "…" if isinstance(v, str) and v.startswith("data:") else v) for k, v in body.items()}
        print(json.dumps({"dry_run": True, "endpoint": endpoint, "body": shown}, indent=2))
        return 3
    t0 = time.time()
    js = call(key, endpoint, body, timeout=900 if a.cmd == "animate" else 300)
    if js is None:
        return 1
    if a.cmd == "autoprompt":
        print(js.get("output") if isinstance(js.get("output"), str) else json.dumps(js)[:2000])
        return 0
    url = first_url(js)
    if not url:
        print(json.dumps(js)[:2000], file=sys.stderr)
        return 1
    if not download(url, a.out, a.fit):
        return 4
    print(f"saved {a.out} ({time.time() - t0:.0f}s) from {endpoint}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
