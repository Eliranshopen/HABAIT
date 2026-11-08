"""<project>/video/manifest.json (schema habait-engine/video.v1): what the platform's cinematic player (card 36) reads.

One entry per segment (written by the stage as <project>/video/<seg>/segment.json, collected here in spec order):
  id, role (approach | orbit | hold-ring | hold-arc | descend-<unit> | enter-<unit>), kind "flat-video", unit,
  src / poster / last / camera (paths relative to the manifest's folder), fps, n_frames, size [w, h], duration_s,
  frames / frames_lo (JPEG per frame, frame_%04d.jpg, 1-based; required for hold-*), loop, rest_frame (1-based or null),
  source {clay, clay_sha256_16, refs, prompt_sha256_16, endpoint, cost_usd, adopted_from | request_id, ...}.
Additive fields (v1, card 35): preview (true = shown only behind a flag), default (the hold track the flow plays),
camera_trust, end_pose, handoff (enter-<unit>: the tour camera point it lands on), gates.
camera.json per segment: one entry per REAL frame (matrix_world camera->world, lens/sensor, hfov/vfov), schema
habait-engine/video-camera.v1 (camera_map.py).

  python manifest.py <manifest.json>      exit 0 valid, 1 invalid (problems printed)
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

SCHEMA = "habait-engine/video.v1"
ROLE_RE = re.compile(r"^(approach|orbit|hold-ring|hold-arc|descend-[A-Za-z0-9_.]+|enter-[A-Za-z0-9_.]+)$")
REQUIRED = ["id", "role", "kind", "src", "poster", "last", "camera", "fps", "n_frames", "size", "duration_s", "loop",
            "rest_frame", "source"]


def build(project_id: str, entries: list[dict], missing: list[dict], extra: dict | None = None) -> dict:
    return {"schema": SCHEMA, "project": project_id, **(extra or {}), "segments": entries, "missing": missing}


def _count_jpgs(folder: Path) -> int:
    return len(list(folder.glob("frame_*.jpg"))) if folder.is_dir() else 0


def validate(man: dict, base: Path, deep: bool = True) -> list[str]:
    """Problems ([] = valid). base = the manifest's folder. deep: open every camera.json and count the JPEGs."""
    p = []
    if man.get("schema") != SCHEMA:
        p.append(f"schema {man.get('schema')!r} != {SCHEMA}")
    segs = man.get("segments")
    if not isinstance(segs, list) or not segs:
        return p + ["no segments"]
    ids = [s.get("id") for s in segs]
    if len(set(ids)) != len(ids):
        p.append(f"duplicate segment ids: {ids}")
    defaults = [s["id"] for s in segs if s.get("default") and str(s.get("role", "")).startswith("hold-")]
    if len(defaults) > 1:
        p.append(f"more than one default hold track: {defaults}")
    for s in segs:
        sid = s.get("id", "?")
        for k in REQUIRED:
            if k not in s:
                p.append(f"{sid}: missing {k}")
        role = str(s.get("role", ""))
        if not ROLE_RE.match(role):
            p.append(f"{sid}: role {role!r} not in approach|orbit|hold-ring|hold-arc|descend-<unit>|enter-<unit>")
        if s.get("kind") != "flat-video":
            p.append(f"{sid}: kind {s.get('kind')!r} != flat-video")
        n = s.get("n_frames")
        if not isinstance(n, int) or n <= 0:
            p.append(f"{sid}: n_frames {n!r}")
            continue
        if not (isinstance(s.get("fps"), (int, float)) and s["fps"] > 0):
            p.append(f"{sid}: fps {s.get('fps')!r}")
        if not (isinstance(s.get("size"), list) and len(s["size"]) == 2):
            p.append(f"{sid}: size {s.get('size')!r}")
        rf = s.get("rest_frame")
        if rf is not None and not (isinstance(rf, int) and 1 <= rf <= n):
            p.append(f"{sid}: rest_frame {rf!r} outside 1..{n}")
        if role.startswith("hold-") and rf is None:
            p.append(f"{sid}: a hold track needs a rest_frame")
        src = s.get("source") or {}
        if not src.get("endpoint"):
            p.append(f"{sid}: source.endpoint missing")
        if not (src.get("adopted_from") or src.get("request_id")):
            p.append(f"{sid}: source has neither adopted_from nor request_id")
        if not isinstance(src.get("cost_usd"), (int, float)):
            p.append(f"{sid}: source.cost_usd missing")
        for k in ("src", "poster", "last", "camera"):
            if s.get(k) and not (base / s[k]).is_file():
                p.append(f"{sid}: {k} {s[k]} not found")
        if role.startswith("hold-"):
            for k in ("frames", "frames_lo"):
                if not s.get(k):
                    p.append(f"{sid}: a hold track needs {k}")
        if not deep:
            continue
        for k in ("frames", "frames_lo"):
            if s.get(k):
                c = _count_jpgs(base / s[k])
                if c != n:
                    p.append(f"{sid}: {k} has {c} JPEGs, n_frames {n}")
        cp = base / s["camera"] if s.get("camera") else None
        if cp and cp.is_file():
            try:
                cam = json.loads(cp.read_text(encoding="utf-8"))
            except ValueError as e:
                p.append(f"{sid}: camera.json unreadable: {e}")
                continue
            fr = cam.get("frames") or []
            if cam.get("n_frames") != n or len(fr) != n:
                p.append(f"{sid}: camera has n_frames {cam.get('n_frames')} / {len(fr)} entries, segment {n}")
            for f in fr[:: max(1, len(fr) // 8)] + fr[-1:]:
                m = f.get("matrix_world")
                if not (isinstance(m, list) and len(m) == 4 and all(len(r) == 4 for r in m)):
                    p.append(f"{sid}: camera frame {f.get('frame')} has no 4x4 matrix_world")
                    break
                if not (f.get("lens_mm") and f.get("sensor_mm") and f.get("hfov_deg")):
                    p.append(f"{sid}: camera frame {f.get('frame')} has no lens/sensor/hfov")
                    break
    return p


def main(argv=None):
    a = argv if argv is not None else sys.argv[1:]
    if len(a) != 1:
        print(__doc__)
        return 2
    path = Path(a[0])
    man = json.loads(path.read_text(encoding="utf-8"))
    probs = validate(man, path.parent)
    roles = [s.get("role") for s in man.get("segments") or []]
    print(f"manifest {path}: {len(roles)} segment(s) {roles}; " + ("VALID" if not probs else f"{len(probs)} problem(s)"))
    for x in probs:
        print("  - " + x)
    return 0 if not probs else 1


if __name__ == "__main__":
    sys.exit(main())
