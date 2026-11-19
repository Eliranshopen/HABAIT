"""Kling 4.0 video-to-video edit on fal: ONE call turns a flat clay video into a photoreal one with the same camera path.

  @Video1   = the clay (Blender, the traced geometry; 16:9 flat)
  @Image1.. = reference images (the developer's renders, the node's GPT skin, the previous segment's last frame)
  prompt    = a template per segment role, filled from the project (building, place, surroundings, light): no
              project-specific string lives in this file

Kling limits (fal schema `kling/v4/video-to-video/edit`, research/fal-bench-2026-11-02/inputs/schema_kling_v4_*.json):
  source video 3.0-30.05 s, 23.9-60.05 fps, width AND height >= 700 px and <= 4553 px, aspect 0.40-2.50, <= 300 MB;
  source + reference videos <= 30 s; output duration 3-30 s (default = the source's length); resolution 720p | 1080p
  (fal's default is 1080p: always pass it). Output: N+1 frames for an N-frame clay at 24 fps (408->409, 168->169,
  240->241). No padding: a 1280x720 clay goes in as is. 720p follows the clay path more faithfully than 1080p (the 1080p
  arc drifted, ORB tx -24..+68 px; memory.md section 7).
Price (measured on fal's invoices of 2026-11-02/03): $0.094 per second of (input + output) at 720p (arc 7 s $1.32,
  ring 10 s $1.88, full flight 17 s $3.20), $0.1403/s at 1080p (arc 7 s $1.97).

Cache: key = sha256(endpoint, sha256(clay), [sha256(ref)...], sha256(prompt), resolution, duration). An output with the
same key (an earlier call, or an adopted clip registered with its original inputs) is reused at $0.

Money: this module never decides to spend. The only paid entry point is the engine's video stage
(Habait/engine/stages/video.py), which refuses without HABAIT_ALLOW_SPEND=1 + HABAIT_CAP_USD and writes the ledger row
before and after the call. The CLI below only estimates and prints the cache key.

  python kling_v2v.py --clay clay.mp4 --ref a.jpg --ref b.jpg --prompt-file p.txt [--resolution 720p] [--duration 7]
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import math
import os
import sys
import time
import urllib.request
from pathlib import Path

ENDPOINT = "kling/v4/video-to-video/edit"
LIMITS = {"min_s": 3.0, "max_s": 30.05, "min_fps": 23.9, "max_fps": 60.05, "min_side_px": 700, "max_side_px": 4553,
          "min_aspect": 0.40, "max_aspect": 2.50, "max_bytes": 300 * 1024 * 1024, "resolutions": ["720p", "1080p"]}
USD_PER_S = {"720p": 0.094, "1080p": 0.1403}
ENV_FILE = Path(__file__).resolve().parents[3] / ".env"      # habait-walkaround/.env (read by name, never printed)


# ------------------------------------------------------------------------------------------------ checks, price
def check_clay(pr: dict) -> list[str]:
    """Problems that would make fal reject the clay (pr = media.probe())."""
    p = []
    d, fps, w, h = pr["duration_s"], pr["fps"], pr["width"], pr["height"]
    if not (LIMITS["min_s"] <= d <= LIMITS["max_s"]):
        p.append(f"duration {d:.2f} s outside {LIMITS['min_s']}-{LIMITS['max_s']} s")
    if not (LIMITS["min_fps"] <= fps <= LIMITS["max_fps"]):
        p.append(f"fps {fps} outside {LIMITS['min_fps']}-{LIMITS['max_fps']}")
    if min(w, h) < LIMITS["min_side_px"] or max(w, h) > LIMITS["max_side_px"]:
        p.append(f"size {w}x{h}: each side must be {LIMITS['min_side_px']}-{LIMITS['max_side_px']} px")
    if h and not (LIMITS["min_aspect"] <= w / h <= LIMITS["max_aspect"]):
        p.append(f"aspect {w / h:.2f} outside {LIMITS['min_aspect']}-{LIMITS['max_aspect']}")
    if pr.get("bytes", 0) > LIMITS["max_bytes"]:
        p.append(f"{pr['bytes']} bytes > 300 MB")
    return p


def estimate_usd(clay_s: float, out_s: float | None = None, resolution: str = "720p") -> float:
    """fal's price for one call: per second of input + output (output = the clay's length + one frame)."""
    out_s = clay_s + 1 / 24 if out_s is None else out_s
    return math.ceil(USD_PER_S[resolution] * (clay_s + out_s) * 100) / 100


# ---------------------------------------------------------------------------------------------------------- cache
def sha256_file(p) -> str:
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def sha16(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]


def cache_key(clay, refs, prompt: str, resolution: str = "720p", duration=None, endpoint: str = ENDPOINT) -> str:
    body = {"endpoint": endpoint, "clay": sha256_file(clay), "refs": [sha256_file(r) for r in refs],
            "prompt": hashlib.sha256(prompt.encode("utf-8")).hexdigest(), "resolution": resolution,
            "duration": duration}
    return hashlib.sha256(json.dumps(body, sort_keys=True).encode()).hexdigest()


class Cache:
    """<dir>/index.json: key -> {real, record, how, at}. `real` is relative to the index's folder."""

    def __init__(self, folder):
        self.dir = Path(folder)
        self.path = self.dir / "index.json"
        self.data = json.loads(self.path.read_text(encoding="utf-8")) if self.path.exists() else {
            "schema": "habait-engine/kling-cache.v1", "entries": {}}

    def get(self, key):
        e = self.data["entries"].get(key)
        if not e:
            return None
        p = (self.dir / e["real"]).resolve()
        return {**e, "path": p} if p.exists() else None

    def put(self, key, real_path, how, record=None):
        self.dir.mkdir(parents=True, exist_ok=True)
        rel = os.path.relpath(Path(real_path).resolve(), self.dir.resolve()).replace("\\", "/")
        self.data["entries"][key] = {"real": rel, "how": how, "record": record,
                                     "at": dt.datetime.now().astimezone().isoformat(timespec="seconds")}
        tmp = self.path.with_name("index.json.tmp")
        tmp.write_text(json.dumps(self.data, ensure_ascii=False, indent=1), encoding="utf-8")
        os.replace(tmp, self.path)


# -------------------------------------------------------------------------------------------------------- prompts
# One template per role kind. {duration_s} {building} {place} {surroundings} {light} {life} {refs} come from the
# project (spec "look" + project.json); {motion} from the role. Nothing here names a project.
MOTION = {
    "approach": "a continuous drone flight from high above the area toward {building_short}",
    "orbit": "a full clockwise orbit around {building_short}, then a smooth descent that stops in front of it at mid "
             "height, facing it",
    "hold-arc": "the camera glides sideways in a gentle arc around the front of {building_short}, at mid height, "
                "always facing it",
    "hold-ring": "the camera glides sideways in a complete 360-degree circle around {building_short}, always at the "
                 "same height and distance, always facing it, ending exactly where it started",
    "descend": "the camera descends along the facade of {building_short} to the terrace of one apartment and stops in "
               "front of its glass slider",
    "enter": "the camera moves from the terrace through the open glass slider into the apartment's living room and "
             "stops inside",
}
TEMPLATE = ("@Video1 is a plain grey 3D clay render of ONE continuous drone shot, {duration_s} seconds: {motion} "
            "({building}) {place}. Re-render the SAME footage as photoreal video: keep every frame's camera motion, "
            "perspective, horizon, building proportions and geometry exactly as in @Video1; only replace the clay "
            "materials with real ones. {refs}{life}{light} Smooth, continuous, no cuts, no text, no watermark, "
            "no camera shake.")


def role_kind(role: str) -> str:
    return role.split("-")[0] if role.startswith(("descend-", "enter-")) else role


def build_prompt(role: str, look: dict, duration_s: float, ref_notes: list[str]) -> str:
    kind = role_kind(role)
    if kind not in MOTION:
        raise ValueError(f"no prompt template for role {role!r}")
    building = look.get("building") or "a residential tower"
    short = look.get("building_short") or "the tower"
    refs = "".join(f"@Image{i} is {n.rstrip('.')}. " for i, n in enumerate(ref_notes, 1) if n)
    life = (look.get("life") or "") + (" " if look.get("life") else "")
    interior = kind in ("enter",) and look.get("interior")
    return TEMPLATE.format(duration_s=f"{duration_s:g}", motion=MOTION[kind].format(building_short=short),
                           building=building + ("; inside: " + look["interior"] if interior else ""),
                           place=look.get("place") or "", refs=refs, life=life,
                           light=look.get("light") or "Bright clear morning daylight, neutral white light.").replace(
        "  ", " ").replace(" .", ".")


def look_from_project(project: dict, spec_look: dict | None = None) -> dict:
    """The prompt's words: the spec's `look` block wins; otherwise derived from project.json fields."""
    p, b = project.get("project") or {}, project.get("building") or {}
    floors = b.get("floors_total")
    city = p.get("city_en") or p.get("city_he") or ""
    derived = {
        "building": (f"a {floors}-floor residential tower" if floors else "a residential building")
                    + (f", {p['name']}" if p.get("name") else ""),
        "building_short": f"the {p['name']} tower" if p.get("name") else "the tower",
        "place": f"in {city}" if city else "",
        "light": "Bright clear morning daylight, neutral white light, blue sky, no sunset or golden-hour tones.",
    }
    return {**derived, **{k: v for k, v in (spec_look or {}).items() if v}}


# -------------------------------------------------------------------------------------------------------- backend
def load_fal_key():
    """FAL_KEY from the environment, else from habait-walkaround/.env by name. Never printed."""
    if os.environ.get("FAL_KEY"):
        return True
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
            if line.strip().startswith("FAL_KEY="):
                os.environ["FAL_KEY"] = line.split("=", 1)[1].strip().strip('"').strip("'")
                return True
    return False


class FalBackend:
    """The real fal client (fal_client 1.0.3). Tests replace it with a fake that has the same four methods."""
    name = "fal"

    def __init__(self):
        if not load_fal_key():
            raise RuntimeError("FAL_KEY missing (habait-walkaround/.env)")
        import fal_client  # noqa: PLC0415 - only when a call really happens
        self.fal = fal_client

    def upload(self, path) -> str:
        return self.fal.upload_file(str(path))

    def submit(self, endpoint, args) -> str:
        return self.fal.submit(endpoint, arguments=args).request_id

    def wait(self, endpoint, request_id) -> dict:
        return self.fal.result(endpoint, request_id)          # fal_client 1.0.3: polls the queue until COMPLETED

    def download(self, url, dst):
        tmp = Path(dst).with_suffix(".part")
        with urllib.request.urlopen(url, timeout=600) as r, open(tmp, "wb") as f:
            while True:
                b = r.read(1 << 20)
                if not b:
                    break
                f.write(b)
        os.replace(tmp, dst)


BACKEND_FACTORY = FalBackend          # the test swaps this for a fake


def run(clay, refs, prompt, out_dir, resolution="720p", duration=None, on_submit=None, backend=None) -> dict:
    """ONE paid call. Writes out_dir/real.mp4 + out_dir/real.json; returns the record. The caller (the stage) owns the
    money guard and the ledger; on_submit(request_id) is called as soon as fal accepted the job."""
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    be = backend or BACKEND_FACTORY()
    t0 = time.time()
    args = {"prompt": prompt, "resolution": resolution}
    if duration:
        args["duration"] = duration
    args["video_url"] = be.upload(clay)
    args["image_urls"] = [be.upload(r) for r in refs]
    rid = be.submit(ENDPOINT, args)
    if on_submit:
        on_submit(rid)
    res = be.wait(ENDPOINT, rid)
    url = (res.get("video") or {}).get("url")
    if not url:
        raise RuntimeError(f"fal request {rid}: no video in the result ({list(res)})")
    be.download(url, out / "real.mp4")
    rec = {"endpoint": ENDPOINT, "backend": getattr(be, "name", type(be).__name__), "request_id": rid,
           "args": args, "clay": str(clay), "refs": [str(r) for r in refs], "result": res,
           "secs": round(time.time() - t0, 1)}
    (out / "real.json").write_text(json.dumps(rec, ensure_ascii=False, indent=1), encoding="utf-8")
    return rec


def main(argv=None):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from video import media
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--clay", required=True)
    ap.add_argument("--ref", action="append", default=[])
    ap.add_argument("--prompt-file", required=True)
    ap.add_argument("--resolution", default="720p", choices=LIMITS["resolutions"])
    ap.add_argument("--duration", type=float)
    a = ap.parse_args(argv)
    pr = media.probe(a.clay)
    prompt = Path(a.prompt_file).read_text(encoding="utf-8").strip()
    print(json.dumps({"clay": pr, "problems": check_clay(pr),
                      "estimate_usd": estimate_usd(pr["duration_s"], None, a.resolution),
                      "cache_key": cache_key(a.clay, a.ref, prompt, a.resolution, a.duration),
                      "note": "estimate only: the paid call runs through cli.py run <project> --stage video"},
                     ensure_ascii=False, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
