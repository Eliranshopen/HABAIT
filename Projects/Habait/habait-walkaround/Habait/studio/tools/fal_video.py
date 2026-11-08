"""fal_video.py — one render-to-real call on fal.ai (clay clip + keyframe -> photoreal clip).

  python -I tools/fal_video.py --video clay.mp4 --image first.png --prompt "..." --num-frames 121 --out out.mp4 --allow-spend
  python -I tools/fal_video.py --schema            # prints the endpoint's input schema (free) — check argument names here

Without --allow-spend the script prints the request it WOULD send and exits 3 (a dry run). FAL_KEY comes from the
environment by name. Default endpoint: fal-ai/ltx-2.3-quality/render-to-real (3DREAL IC-LoRA, 2026-06-26).
"""
import argparse
import json
import os
import sys

ENDPOINT = "fal-ai/ltx-2.3-quality/render-to-real"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--endpoint", default=ENDPOINT)
    ap.add_argument("--video")
    ap.add_argument("--image")
    ap.add_argument("--prompt", default="3DREAL. Make it a detailed photorealistic scene.")
    ap.add_argument("--num-frames", type=int, default=121)
    ap.add_argument("--resolution", default="720p")
    ap.add_argument("--fps", type=int, default=24)
    ap.add_argument("--intensity", default="strong-v2")
    ap.add_argument("--detail-refine", action="store_true")
    ap.add_argument("--seed", type=int, default=None)
    ap.add_argument("--extra", action="append", default=[], help="key=value (JSON value) added to the arguments")
    ap.add_argument("--out", default=None)
    ap.add_argument("--allow-spend", action="store_true")
    ap.add_argument("--schema", action="store_true")
    a = ap.parse_args()

    if a.schema:
        import requests
        url = f"https://fal.ai/api/openapi/queue/openapi.json?endpoint_id={a.endpoint}"
        r = requests.get(url, timeout=60)
        r.raise_for_status()
        spec = r.json()
        schemas = spec.get("components", {}).get("schemas", {})
        for name, sch in schemas.items():
            if "Input" in name:
                print(json.dumps({name: sch}, indent=2)[:6000])
        return 0

    if not a.video or not a.image or not a.out:
        print("need --video, --image, --out", file=sys.stderr)
        return 2
    # argument names verified against the endpoint's OpenAPI schema on 2026-11-01 (--schema)
    arguments = {
        "prompt": a.prompt,
        "num_frames": a.num_frames,
        "frames_per_second": a.fps,
        "resolution": a.resolution,
        "intensity": a.intensity,
        "enable_detail_refine": bool(a.detail_refine),
        "generate_audio": False,
        "enable_prompt_expansion": False,
    }
    if a.seed is not None:
        arguments["seed"] = a.seed
    for kv in a.extra:
        k, _, v = kv.partition("=")
        try:
            arguments[k] = json.loads(v)
        except Exception:
            arguments[k] = v
    if not a.allow_spend:
        print(json.dumps({"dry_run": True, "endpoint": a.endpoint, "video": a.video, "image": a.image, "arguments": arguments}, indent=2))
        return 3
    if not os.environ.get("FAL_KEY"):
        print("FAL_KEY missing", file=sys.stderr)
        return 2

    import fal_client
    import requests
    print(f"uploading {os.path.basename(a.video)} and {os.path.basename(a.image)}", flush=True)
    arguments["video_url"] = fal_client.upload_file(a.video)
    arguments["image_url"] = fal_client.upload_file(a.image)

    def on_update(update):
        if isinstance(update, fal_client.InProgress):
            for lg in update.logs or []:
                print(f"  fal: {lg.get('message', '')}", flush=True)

    print(f"calling {a.endpoint} ({a.num_frames} frames, refine={a.detail_refine})", flush=True)
    result = fal_client.subscribe(a.endpoint, arguments=arguments, with_logs=True, on_queue_update=on_update)
    video = result.get("video") or {}
    url = video.get("url")
    if not url:
        print(json.dumps(result)[:2000], file=sys.stderr)
        return 1
    # the call is paid once it returns: keep the result URL BEFORE downloading, and retry the download, so a network
    # error never costs a second call (13:37 lost one to an SSL error)
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    with open(a.out + ".url", "w", encoding="utf-8") as f:
        f.write(url)
    import time
    for attempt in range(4):
        try:
            r = requests.get(url, timeout=600)
            r.raise_for_status()
            break
        except Exception as e:  # noqa: BLE001
            print(f"download attempt {attempt + 1} failed: {e}", file=sys.stderr, flush=True)
            if attempt == 3:
                print(f"result URL kept in {a.out}.url", file=sys.stderr)
                return 4
            time.sleep(5 * (attempt + 1))
    with open(a.out, "wb") as f:
        f.write(r.content)
    meta = {"endpoint": a.endpoint, "arguments": {k: v for k, v in arguments.items() if not k.endswith("_url")}, "result": {k: v for k, v in result.items() if k != "video"}, "video_bytes": len(r.content)}
    with open(a.out + ".json", "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)
    print(f"saved {a.out} ({len(r.content)} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
