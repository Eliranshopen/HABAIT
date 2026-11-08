#!/usr/bin/env python
"""fal_audio.py — a music / sound track from a text prompt on fal.ai (Habait Studio, 2026-11-01, Eliran: "מוזיקת רקע").
  fal_audio.py --endpoint fal-ai/stable-audio-25/text-to-audio --prompt "..." --seconds 30 --out track.mp3 [--allow-spend]
  fal_audio.py --endpoint fal-ai/minimax-music/v2.6 --prompt "..." --out track.mp3 --allow-spend
Dry run without --allow-spend. FAL_KEY from the environment (never printed). Writes <out> and <out>.url; ffmpeg converts to the
requested extension when the answer is another format."""
import argparse
import json
import os
import subprocess
import sys


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--endpoint", default="fal-ai/stable-audio-25/text-to-audio")
    ap.add_argument("--prompt", required=True)
    ap.add_argument("--seconds", type=int, default=30)
    ap.add_argument("--out", required=True)
    ap.add_argument("--extra", default=None, help="JSON merged into the request")
    ap.add_argument("--allow-spend", action="store_true")
    a = ap.parse_args()
    if not a.allow_spend:
        print(json.dumps({"dry_run": True, "endpoint": a.endpoint, "prompt": a.prompt[:160], "seconds": a.seconds}, indent=2))
        return 3
    if not os.environ.get("FAL_KEY"):
        print("FAL_KEY missing", file=sys.stderr)
        return 2
    import fal_client
    import requests
    if "stable-audio" in a.endpoint:
        args = {"prompt": a.prompt, "seconds_total": a.seconds}
    elif "minimax" in a.endpoint:
        args = {"prompt": a.prompt}
    else:
        args = {"prompt": a.prompt}
    if a.extra:
        args.update(json.loads(a.extra))
    result = fal_client.subscribe(a.endpoint, arguments=args, with_logs=False)
    url = None
    for k in ("audio_file", "audio"):
        v = result.get(k)
        if isinstance(v, dict) and v.get("url"):
            url = v["url"]
            break
        if isinstance(v, str) and v.startswith("http"):
            url = v
            break
    if not url:
        print(json.dumps(result)[:1500], file=sys.stderr)
        return 1
    with open(a.out + ".url", "w", encoding="utf-8") as f:
        f.write(url)
    r = requests.get(url, timeout=300)
    r.raise_for_status()
    raw = a.out + ".raw"
    with open(raw, "wb") as f:
        f.write(r.content)
    ffmpeg = os.environ.get("FFMPEG", "ffmpeg")
    p = subprocess.run([ffmpeg, "-nostdin", "-y", "-loglevel", "error", "-i", raw, a.out], capture_output=True, text=True)
    if p.returncode != 0:
        os.replace(raw, a.out)
    else:
        os.remove(raw)
    print(f"saved {a.out} from {a.endpoint} ({len(r.content)} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
