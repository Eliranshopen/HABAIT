"""run_fal.py - one fal.ai call for the model benchmark (any endpoint, any args).

  python -I run_fal.py --endpoint <id> --args '<json>' --out <file> --price <usd> [--note ...] [--timeout 1800]

In the JSON args, a string "@file:C:/path/x.png" is uploaded to fal storage and replaced by its URL
(also inside lists and nested dicts). The first media URL of the result (images[0].url, image.url,
video.url, videos[0].url) is downloaded to --out; the raw result goes to <out>.json. An existing --out
is skipped (reruns are free). Every call appends a row to ledger.json beside this script.
FAL_KEY is read from C:/RnD/Projects/Habait/habait-walkaround/.env when it is not in the environment.
"""
import argparse
import json
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
LEDGER = os.environ.get("BENCH_LEDGER") or os.path.join(HERE, "ledger.json")


def load_key():
    if os.environ.get("FAL_KEY"):
        return
    env = "C:/RnD/Projects/Habait/habait-walkaround/.env"
    with open(env, encoding="utf-8") as f:
        for line in f:
            if line.startswith("FAL_KEY="):
                os.environ["FAL_KEY"] = line.split("=", 1)[1].strip().strip('"')
                return
    sys.exit("FAL_KEY missing")


def ledger_add(row):
    rows = []
    if os.path.exists(LEDGER):
        rows = json.load(open(LEDGER, encoding="utf-8"))
    rows.append(row)
    json.dump(rows, open(LEDGER, "w", encoding="utf-8"), indent=1, ensure_ascii=False)


def resolve(x, upload):
    if isinstance(x, str) and x.startswith("@file:"):
        return upload(x[6:])
    if isinstance(x, list):
        return [resolve(v, upload) for v in x]
    if isinstance(x, dict):
        return {k: resolve(v, upload) for k, v in x.items()}
    return x


def first_url(result):
    for k in ("images", "videos"):
        v = result.get(k)
        if isinstance(v, list) and v and isinstance(v[0], dict) and v[0].get("url"):
            return v[0]["url"]
    for k in ("image", "video"):
        v = result.get(k)
        if isinstance(v, dict) and v.get("url"):
            return v["url"]
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--endpoint", required=True)
    ap.add_argument("--args", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--price", type=float, required=True, help="estimated USD, logged to the ledger")
    ap.add_argument("--note", default="")
    ap.add_argument("--timeout", type=int, default=1800)
    a = ap.parse_args()
    if os.path.exists(a.out):
        print(f"skip (exists): {a.out}")
        return 0
    load_key()
    import fal_client
    import requests

    cache = {}

    def upload(p):
        if p not in cache:
            cache[p] = fal_client.upload_file(p)
        return cache[p]

    args = resolve(json.loads(a.args), upload)
    t0 = time.time()
    logs = []

    def on_q(update):
        if isinstance(update, fal_client.InProgress) and update.logs:
            for l in update.logs[len(logs):]:
                logs.append(l)
                print("  log:", (l.get("message") or "")[:160], flush=True)

    try:
        handler = fal_client.submit(a.endpoint, arguments=args)
        req_id = handler.request_id
        print(f"{a.endpoint}: request {req_id}", flush=True)
        result = None
        while time.time() - t0 < a.timeout:
            st = fal_client.status(a.endpoint, req_id, with_logs=True)
            on_q(st)
            if isinstance(st, fal_client.Completed):
                result = fal_client.result(a.endpoint, req_id)
                break
            time.sleep(4)
        if result is None:
            raise TimeoutError(f"no result after {a.timeout}s")
    except Exception as e:  # noqa: BLE001
        ledger_add({"at": time.strftime("%Y-%m-%dT%H:%M:%S"), "endpoint": a.endpoint, "usd": a.price, "note": a.note,
                    "out": a.out, "error": str(e)[:500], "secs": round(time.time() - t0)})
        print(f"FAILED {a.endpoint}: {str(e)[:800]}", file=sys.stderr)
        return 1
    secs = round(time.time() - t0)
    json.dump({"endpoint": a.endpoint, "args": args, "result": result, "secs": secs},
              open(a.out + ".json", "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    url = first_url(result)
    if not url:
        print(f"no media url in result: {json.dumps(result)[:600]}", file=sys.stderr)
        ledger_add({"at": time.strftime("%Y-%m-%dT%H:%M:%S"), "endpoint": a.endpoint, "usd": a.price, "note": a.note,
                    "out": a.out, "error": "no media url", "secs": secs})
        return 1
    for attempt in range(4):
        try:
            r = requests.get(url, timeout=600)
            r.raise_for_status()
            with open(a.out, "wb") as f:
                f.write(r.content)
            break
        except Exception as e:  # noqa: BLE001
            print(f"download attempt {attempt + 1} failed: {e}", file=sys.stderr, flush=True)
            time.sleep(5)
    ledger_add({"at": time.strftime("%Y-%m-%dT%H:%M:%S"), "endpoint": a.endpoint, "usd": a.price, "note": a.note,
                "out": a.out, "secs": secs})
    print(f"OK {a.endpoint} -> {a.out} ({secs}s, est ${a.price})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
