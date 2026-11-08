"""fal_image.py — one image-edit call on fal.ai (a clay frame -> a styled keyframe).

  python -I tools/fal_image.py --image first.png --out key.png --prompt "..." [--endpoint fal-ai/nano-banana-2/edit] --allow-spend

Default endpoint fal-ai/nano-banana-2/edit (≈ $0.08 per image, the editor the tour's handler already uses).
Dry run (exit 3) without --allow-spend. FAL_KEY from the environment by name.
"""
import argparse
import json
import os
import sys


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--endpoint", default="fal-ai/nano-banana-2/edit")
    ap.add_argument("--image", required=True)
    ap.add_argument("--reference", action="append", default=[], help="extra reference image(s)")
    ap.add_argument("--prompt", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--aspect-ratio", default=None, help="e.g. 16:9 (the editor otherwise picks its own size)")
    ap.add_argument("--resolution", default=None, help="0.5K | 1K | 2K | 4K")
    ap.add_argument("--fit", default=None, help="WxH: centre-crop to that aspect and resize, so the keyframe is EXACTLY the clay size")
    ap.add_argument("--extra", default=None, help='JSON merged into the request, for endpoints with their own fields '
                    '(e.g. openai/gpt-image-2.5/sunburst/edit: {"image_size":{"width":1920,"height":1080},"quality":"high"})')
    ap.add_argument("--allow-spend", action="store_true")
    a = ap.parse_args()
    if not a.allow_spend:
        print(json.dumps({"dry_run": True, "endpoint": a.endpoint, "image": a.image, "prompt": a.prompt[:200]}, indent=2))
        return 3
    if not os.environ.get("FAL_KEY"):
        print("FAL_KEY missing", file=sys.stderr)
        return 2
    import fal_client
    import requests
    urls = [fal_client.upload_file(a.image)] + [fal_client.upload_file(r) for r in a.reference]
    args = {"prompt": a.prompt, "image_urls": urls, "num_images": 1, "output_format": "png"}
    if a.aspect_ratio:
        args["aspect_ratio"] = a.aspect_ratio
    if a.resolution:
        args["resolution"] = a.resolution
    if a.extra:
        args.update(json.loads(a.extra))
    result = fal_client.subscribe(a.endpoint, arguments=args, with_logs=False)
    images = result.get("images") or []
    if not images:
        print(json.dumps(result)[:2000], file=sys.stderr)
        return 1
    with open(a.out + ".url", "w", encoding="utf-8") as f:
        f.write(images[0]["url"])
    import time
    for attempt in range(4):
        try:
            r = requests.get(images[0]["url"], timeout=300)
            r.raise_for_status()
            break
        except Exception as e:  # noqa: BLE001
            print(f"download attempt {attempt + 1} failed: {e}", file=sys.stderr, flush=True)
            if attempt == 3:
                return 4
            time.sleep(5 * (attempt + 1))
    raw = a.out + ".raw.png" if a.fit else a.out
    with open(raw, "wb") as f:
        f.write(r.content)
    if a.fit:
        import cv2
        import numpy as np
        W, H = [int(v) for v in a.fit.lower().split("x")]
        im = cv2.imdecode(np.frombuffer(r.content, np.uint8), cv2.IMREAD_COLOR)
        h, w = im.shape[:2]
        if w / h > W / H:
            cw = round(h * W / H)
            im = im[:, (w - cw) // 2:(w - cw) // 2 + cw]
        else:
            ch = round(w * H / W)
            im = im[(h - ch) // 2:(h - ch) // 2 + ch]
        im = cv2.resize(im, (W, H), interpolation=cv2.INTER_AREA)
        cv2.imencode(".png", im)[1].tofile(a.out)
        print(f"fit {w}x{h} -> {W}x{H}")
    print(f"saved {a.out} ({len(r.content)} bytes raw)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
