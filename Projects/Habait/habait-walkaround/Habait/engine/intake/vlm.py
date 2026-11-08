"""VLM step: semantics + printed dimensions from the plan images, via a pluggable backend.

Backends (``--vlm``):
  claude           (default) the Claude Code subscription CLI:
                   ``claude -p --model <m> --allowedTools Read --output-format text < prompt.txt``
                   No API key, no per-call charge: it runs on the user's subscription.
  file:<path>      reuse a saved reply (.txt with JSON inside, or .json) - for reruns and tests
  none             stub: empty reading (the tracer still runs; rooms stay unnamed)

Any backend must return a dict shaped like vlm_prompt.md's JSON. ``parse_reply`` tolerates prose
around the JSON and ```json fences.
"""
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import time

HERE = os.path.dirname(os.path.abspath(__file__))
PROMPT_TEMPLATE = os.path.join(HERE, "vlm_prompt.md")

ROOM_TYPES = ["living", "kitchen", "dining", "bedroom", "master_bedroom", "safe_room", "bathroom", "toilet", "hall",
              "corridor", "balcony", "service_balcony", "storage", "wardrobe", "shaft", "passage", "other"]


def build_prompt(crop_png: str, sheet_png: str, tiles: list | None = None) -> str:
    with open(PROMPT_TEMPLATE, encoding="utf-8") as f:
        t = f.read()
    tl = chr(10).join(f"  Image {i + 3} ({x['name']}): {os.path.abspath(x['file'])}" for i, x in enumerate(tiles or [])) or "  (none)"
    return t.replace("{CROP_PNG}", os.path.abspath(crop_png)).replace("{SHEET_PNG}", os.path.abspath(sheet_png)).replace("{TILES}", tl)


def parse_reply(text: str) -> dict:
    """Extract the first balanced JSON object from a reply."""
    t = text.strip()
    t = re.sub(r"^```(?:json)?\s*", "", t)
    t = re.sub(r"\s*```$", "", t)
    start = t.find("{")
    if start < 0:
        raise ValueError("no JSON object in reply")
    depth, in_str, esc = 0, False, False
    for i in range(start, len(t)):
        c = t[i]
        if in_str:
            if esc:
                esc = False
            elif c == "\\":
                esc = True
            elif c == '"':
                in_str = False
            continue
        if c == '"':
            in_str = True
        elif c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return json.loads(t[start:i + 1])
    raise ValueError("unbalanced JSON in reply")


def normalize(v: dict) -> dict:
    """Coerce the reading into the expected shape (ints for dims, known types, lists)."""
    v = dict(v or {})
    v.setdefault("unit", {})
    rooms = []
    for r in v.get("rooms") or []:
        r = dict(r)
        d = r.get("printed_dims_cm")
        if isinstance(d, list) and len(d) == 2 and all(isinstance(x, (int, float)) for x in d):
            r["printed_dims_cm"] = [int(round(d[0])), int(round(d[1]))]
        else:
            r["printed_dims_cm"] = None
        r["extra_printed_cm"] = [int(round(x)) for x in (r.get("extra_printed_cm") or []) if isinstance(x, (int, float))]
        if r.get("type") not in ROOM_TYPES:
            r["type_raw"], r["type"] = r.get("type"), "other"
        lc = r.get("label_center_frac")
        if not (isinstance(lc, list) and len(lc) == 2 and all(isinstance(x, (int, float)) for x in lc)):
            r["label_center_frac"] = None
        r["is_outdoor"] = bool(r.get("is_outdoor"))
        rooms.append(r)
    v["rooms"] = rooms
    v["printed_dimensions_cm"] = sorted({int(round(x)) for x in (v.get("printed_dimensions_cm") or []) if isinstance(x, (int, float))})
    return v


def run_claude_cli(prompt: str, out_dir: str, model: str = "opus", timeout_s: int = 1500) -> str:
    exe = shutil.which("claude") or shutil.which("claude.cmd")
    if not exe:
        raise RuntimeError("claude CLI not on PATH")
    prompt_path = os.path.join(out_dir, "prompt.txt")
    with open(prompt_path, "w", encoding="utf-8") as f:
        f.write(prompt)
    cmd = [exe, "-p", "--model", model, "--allowedTools", "Read", "--output-format", "text", "--no-session-persistence"]
    env = dict(os.environ)
    env["PYTHONIOENCODING"] = "utf-8"
    t0 = time.time()
    with open(prompt_path, "rb") as fin:
        proc = subprocess.run(cmd, stdin=fin, capture_output=True, cwd=out_dir, timeout=timeout_s, env=env, shell=False)
    reply = proc.stdout.decode("utf-8", errors="replace")
    with open(os.path.join(out_dir, "reply.txt"), "w", encoding="utf-8") as f:
        f.write(reply)
    with open(os.path.join(out_dir, "call.json"), "w", encoding="utf-8") as f:
        json.dump({"cmd": cmd, "returncode": proc.returncode, "seconds": round(time.time() - t0, 1),
                   "stderr": proc.stderr.decode("utf-8", errors="replace")[-2000:]}, f, ensure_ascii=False, indent=1)
    if proc.returncode != 0 and not reply.strip():
        raise RuntimeError(f"claude -p failed rc={proc.returncode}: {proc.stderr.decode('utf-8', 'replace')[-500:]}")
    return reply


def run_vlm(crop_png: str, sheet_png: str, out_dir: str, backend: str = "claude", model: str = "opus", tiles: list | None = None) -> dict:
    os.makedirs(out_dir, exist_ok=True)
    prompt = build_prompt(crop_png, sheet_png, tiles)
    with open(os.path.join(out_dir, "prompt.md"), "w", encoding="utf-8") as f:
        f.write(prompt)
    meta = {"backend": backend, "model": model if backend == "claude" else None}
    if backend == "none":
        v = {"unit": {}, "rooms": [], "printed_dimensions_cm": [], "confidence": 0.0, "stub": True}
    elif backend.startswith("file:"):
        src = backend[5:]
        with open(src, encoding="utf-8") as f:
            txt = f.read()
        v = parse_reply(txt)
        meta["source"] = os.path.abspath(src)
    elif backend == "claude":
        reply = run_claude_cli(prompt, out_dir, model=model)
        v = parse_reply(reply)
    else:
        raise ValueError(f"unknown VLM backend {backend!r}")
    v = normalize(v)
    v["_meta"] = meta
    with open(os.path.join(out_dir, "vlm.json"), "w", encoding="utf-8") as f:
        json.dump(v, f, ensure_ascii=False, indent=1)
    return v


if __name__ == "__main__":
    import sys

    crop, sheet, out = sys.argv[1], sys.argv[2], sys.argv[3]
    backend = sys.argv[4] if len(sys.argv) > 4 else "claude"
    model = sys.argv[5] if len(sys.argv) > 5 else "opus"
    tiles = None
    if len(sys.argv) > 6:
        with open(sys.argv[6], encoding="utf-8") as f:
            tiles = json.load(f)
    r = run_vlm(crop, sheet, out, backend, model, tiles)
    print(json.dumps({"rooms": len(r["rooms"]), "dims": r["printed_dimensions_cm"], "confidence": r.get("confidence")}, ensure_ascii=False))
