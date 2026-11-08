"""The segment list of a project's video stage: <project>/video/segments.json (habait-engine/video-segments.v1).

Paths in the file are relative to the file's folder (like project.json) or absolute. When the file does not exist the
stage derives a default from project.json: orbit + hold-arc for the building, descend-<unit> + enter-<unit> per unit,
each expecting its clay at <project>/clay/video/<seg>/{clay.mp4,camera.json} (rendered by the clay stage / Kaggle,
never by this stage), refs = the project's reference renders (exterior) or the previous segment's last frame.

Segment fields:
  id, role, unit                      role: approach | orbit | hold-ring | hold-arc | descend-<unit> | enter-<unit>
  clay {video, camera, camera_frames: [c0, c1]}   the clay video and the clay camera frames it covers (1-based)
  refs [{file, note} | {from_segment, frame: "last"|"first", note}]
  prompt (optional literal; else the role template filled from `look` + project.json)
  resolution, duration (optional; Kling defaults to the clay's length)
  frames (bool: JPEG per frame; always true for hold-*), loop (bool)
  rest {clay_frame, anchor_to: <segment id>}   the clay frame of the rest pose; anchor_to = measure it in the real
                                               video against that segment's last frame (rest_anchor.py)
  camera {from: "clay"} | {from: "file", file, why}   "file" = a camera already mapped to the real frames
  adopt {video | cut {from, first, last}, parent {n_real, first}, record, cost_usd, by, ledger, note}
        an existing real clip, copied (or cut) at $0; parent = the clip is a cut of a longer real clip
  preview (bool), default (bool, hold tracks), note, kf_check {plan, shot_dir, keyframe, frame}
"""
from __future__ import annotations

import json
from pathlib import Path

SCHEMA = "habait-engine/video-segments.v1"


def resolve(base: Path, p):
    if not p:
        return None
    q = Path(p)
    return (q if q.is_absolute() else base / q).resolve()


def default_spec(project: dict, root: Path) -> dict:
    refs = [{"file": r["file"], "note": r.get("note") or r.get("kind")}
            for r in ((project.get("style") or {}).get("reference_renders") or [])
            if r.get("kind") in ("aerial", "exterior")][:3]
    clay = lambda sid: {"video": f"../clay/video/{sid}/clay.mp4", "camera": f"../clay/video/{sid}/camera.json"}  # noqa: E731
    segs = [{"id": "orbit", "role": "orbit", "unit": None, "clay": clay("orbit"), "refs": refs, "frames": False,
             "rest": None},
            {"id": "hold-arc", "role": "hold-arc", "unit": None, "clay": clay("hold-arc"),
             "refs": [{"from_segment": "orbit", "frame": "last", "note": "the real look of the middle frame"}] + refs[:1],
             "frames": True, "default": True, "rest": {"anchor_to": "orbit"}}]
    for u in project.get("units") or []:
        n = str(u.get("number") or u["id"])
        segs.append({"id": f"descend-{n}", "role": f"descend-{n}", "unit": u["id"], "clay": clay(f"descend-{n}"),
                     "refs": [{"from_segment": "orbit", "frame": "last", "note": "the real look of the first frame"}],
                     "frames": False, "rest": None})
        segs.append({"id": f"enter-{n}", "role": f"enter-{n}", "unit": u["id"], "clay": clay(f"enter-{n}"),
                     "refs": [{"from_segment": f"descend-{n}", "frame": "last",
                               "note": "the real look of the first frame"}],
                     "frames": False, "rest": None})
    return {"schema": SCHEMA, "project": project.get("id"), "derived": True, "resolution": "720p", "fps": 24,
            "look": {}, "segments": segs}


def load(root: Path, project: dict) -> tuple[dict, Path, Path | None]:
    """(spec, base folder for its relative paths, the spec file or None when derived)."""
    f = Path(root) / "video" / "segments.json"
    if f.exists():
        spec = json.loads(f.read_text(encoding="utf-8"))
        if spec.get("schema") != SCHEMA:
            raise ValueError(f"{f}: schema {spec.get('schema')!r} != {SCHEMA}")
        return spec, f.parent, f
    return default_spec(project, root), Path(root) / "video", None
