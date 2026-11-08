"""Stage video (card 35): the demo's recipe as an engine stage, for any project.

Per segment of <project>/video/segments.json (or the default derived from project.json, video/spec.py), in order:
  done (stamp current)           -> SKIP, $0
  an existing real clip (adopt)  -> ADOPT: copy / cut it into video/<seg>/real.mp4, $0
  no clay video yet              -> NEED: "need: clay <seg>" (the clay stage / Kaggle renders it; never Blender here)
  same (clay, refs, prompt) seen -> ADOPT from the Kling cache, $0
  otherwise                      -> CALL: one Kling 4.0 v2v edit (video/kling_v2v.py), PAID: refused (exit 3) without
                                    HABAIT_ALLOW_SPEND=1 + HABAIT_CAP_USD, or when ledger paid + estimate > cap; the
                                    ledger row is written before the call (with the request id as soon as fal has it)
                                    and closed after it with the cost.
Then for every produced segment: camera.json mapped onto the REAL frames (video/camera_map.py), the rest frame of a hold
track measured against the previous segment's last frame (video/rest_anchor.py, $0 gate, advisory), first/last JPEG,
frames/ + frames_lo/ JPEGs for hold tracks, segment.json. A last step collects video/manifest.json (habait-engine/video.v1)
and validates it (video/manifest.py; blocking).
"""
from __future__ import annotations

import json
import math
import os
import shutil
import subprocess
import sys
from pathlib import Path

from .common import ENGINE, PY, Result, Step, decide, invalidate_stamp, jdump, jload, now, rel
from .paid import spend_refusal

if str(ENGINE) not in sys.path:
    sys.path.insert(0, str(ENGINE))
from video import camera_map, kling_v2v, media, rest_anchor  # noqa: E402
from video import manifest as vman  # noqa: E402
from video import spec as vspec  # noqa: E402

CODE = [ENGINE / "stages" / "video.py", ENGINE / "video" / "camera_map.py", ENGINE / "video" / "rest_anchor.py"]
KF_CHECK = Path("C:/RnD/Projects/Habait/tools/bench/kf_check.py")
LO_WIDTH = 640


# ----------------------------------------------------------------------------------------------------- resolution
class Seg:
    """One segment of the spec with its paths resolved."""

    def __init__(self, raw: dict, base: Path, spec: dict, vdir: Path):
        self.raw, self.base, self.spec = raw, base, spec
        self.id, self.role, self.unit = raw["id"], raw["role"], raw.get("unit")
        self.dir = vdir / self.id
        clay = raw.get("clay") or {}
        self.clay_video = vspec.resolve(base, clay.get("video"))
        self.clay_camera = vspec.resolve(base, clay.get("camera"))
        self.camera_frames = tuple(clay["camera_frames"]) if clay.get("camera_frames") else None
        self.refs = []                                    # [(Path | None, note, from_segment | None, which)]
        for r in raw.get("refs") or []:
            if r.get("from_segment"):
                which = r.get("frame", "last")
                self.refs.append((vdir / r["from_segment"] / f"{which}.jpg", r.get("note") or "", r["from_segment"],
                                  which))
            else:
                self.refs.append((vspec.resolve(base, r["file"]), r.get("note") or "", None, None))
        self.adopt = None
        if raw.get("adopt"):
            a = dict(raw["adopt"])
            a["video"] = vspec.resolve(base, a.get("video"))
            if a.get("cut"):
                a["cut"] = {**a["cut"], "from": vspec.resolve(base, a["cut"]["from"])}
            if a.get("parent"):
                a["parent"] = {**a["parent"], "video": vspec.resolve(base, a["parent"].get("video"))}
            a["record"] = vspec.resolve(base, a.get("record"))
            self.adopt = a
        cam = raw.get("camera") or {"from": "clay"}
        self.camera = {**cam, "file": vspec.resolve(base, cam.get("file"))} if cam.get("from") == "file" else cam
        self.loop = bool(raw.get("loop"))
        self.hold = self.role.startswith("hold-")
        self.frames = bool(raw.get("frames")) or self.hold
        self.rest = raw.get("rest") or None
        self.resolution = raw.get("resolution") or spec.get("resolution") or "720p"
        self.duration = raw.get("duration")

    def adopt_source(self) -> Path | None:
        if not self.adopt:
            return None
        return self.adopt["cut"]["from"] if self.adopt.get("cut") else self.adopt["video"]

    def ref_paths(self):
        return [r[0] for r in self.refs]

    def ref_notes(self):
        return [r[1] for r in self.refs]

    def prompt(self, ctx) -> str:
        if self.raw.get("prompt"):
            return self.raw["prompt"]
        look = kling_v2v.look_from_project(ctx.project, self.spec.get("look"))
        dur = self.duration or (media.probe(self.clay_video)["duration_s"] if self.clay_video and
                                self.clay_video.exists() else 0)
        return kling_v2v.build_prompt(self.role, look, round(dur, 1), self.ref_notes())


def load_segments(ctx):
    spec, base, spec_file = vspec.load(ctx.root, ctx.project)
    want = getattr(ctx.args, "unit", None)
    keep = None
    if want:
        keep = {u["id"] for u in ctx.units()}
    segs = [Seg(s, base, spec, ctx.p("video")) for s in spec["segments"]
            if keep is None or s.get("unit") in (None, *keep)]
    return spec, spec_file, segs


# ------------------------------------------------------------------------------------------------------- planning
def plan_segment(ctx, st):
    """('adopt' | 'cache' | 'call' | 'need', why, extra) without side effects."""
    seg: Seg = st.seg
    if seg.adopt:
        src = seg.adopt_source()
        if not src or not src.exists():
            return "need", f"need: the adopt source {rel(src) if src else '?'} is missing", {}
        how = (f"cut frames {seg.adopt['cut']['first']}..{seg.adopt['cut']['last']} of {rel(src)}"
               if seg.adopt.get("cut") else f"copy {rel(src)}")
        paid = seg.adopt.get("cost_usd")
        return "adopt", (f"existing real clip: {how}" + (f" (Kling call of {seg.adopt.get('by')}, ${paid:.2f}, "
                                                         "already paid)" if paid else "") + "; $0"), {}
    if not seg.clay_video or not seg.clay_video.exists():
        return "need", (f"need: clay {seg.id} ({rel(seg.clay_video) if seg.clay_video else 'no clay.video in the spec'})"
                        "; the clay stage / Kaggle renders it, this stage never runs Blender"), {}
    if not seg.clay_camera or not seg.clay_camera.exists():
        return "need", f"need: clay camera {seg.id} ({rel(seg.clay_camera) if seg.clay_camera else '?'})", {}
    for p, _, from_seg, which in seg.refs:
        if from_seg and not p.exists():
            return "need", f"need: segment {from_seg} first (its {which} frame is a reference image)", {}
        if not from_seg and (not p or not p.exists()):
            return "need", f"need: reference image {rel(p) if p else '?'}", {}
    pr = media.probe(seg.clay_video)
    probs = kling_v2v.check_clay(pr)
    if probs:
        return "need", f"need: clay {seg.id} breaks Kling's limits: " + "; ".join(probs), {}
    prompt = seg.prompt(ctx)
    key = kling_v2v.cache_key(seg.clay_video, seg.ref_paths(), prompt, seg.resolution, seg.duration)
    hit = kling_v2v.Cache(ctx.p("video", "_cache")).get(key)
    if hit:
        return "cache", f"Kling cache hit {key[:16]} -> {rel(hit['path'])} ($0)", {"key": key, "hit": hit,
                                                                                   "prompt": prompt}
    est = kling_v2v.estimate_usd(seg.duration or pr["duration_s"], None, seg.resolution)
    return "call", f"Kling 4.0 v2v, {pr['duration_s']:.2f} s clay @ {seg.resolution}, estimate ${est:.2f}", {
        "key": key, "prompt": prompt, "est": est, "clay_probe": pr}


def preview(ctx, st):
    mode, why = decide(st, ctx.force)
    if mode == "skip":
        return "skip", f"done earlier: {why}; $0"
    kind, why, extra = plan_segment(ctx, st)
    if kind == "call":
        st.est_usd = extra["est"]
        r = spend_refusal(ctx, st.est_usd)
        return "call", why + (f"; a real run is {r}" if r else "; spend allowed under the cap")
    return ("adopt" if kind == "cache" else kind), why


# ------------------------------------------------------------------------------------------------------ execution
def _ledger_row(ctx, st):
    for e in reversed(ctx.ledger.data["entries"]):
        if e["stage"] == "video" and e["unit"] == st.unit and e["status"] == "started":
            return e
    return None


def _kf_check(ctx, seg):
    k = seg.raw.get("kf_check")
    if not k:
        return None
    cmd = [PY, "-X", "utf8", "-I", KF_CHECK, "--plan", vspec.resolve(seg.base, k["plan"]), "--shot-dir",
           vspec.resolve(seg.base, k["shot_dir"]), "--keyframe", vspec.resolve(seg.base, k["keyframe"]),
           "--frame", str(k.get("frame", 1)), "--json", seg.dir / "qa" / "kf_check.json"]
    (seg.dir / "qa").mkdir(parents=True, exist_ok=True)
    r = subprocess.run([str(c) for c in cmd], capture_output=True, text=True, encoding="utf-8", errors="replace")
    return r.returncode


def _register_cache(ctx, seg, real_path, prompt, how, record, resolution=None, duration=None):
    """An adopted or produced clip is registered under the key of the inputs that made it, but only when every input
    file is older than the clip (a reference re-made after the call would make the key lie)."""
    clay = seg.clay_video
    refs = seg.ref_paths()
    files = [clay, *refs]
    if not prompt or not all(f and Path(f).exists() for f in files):
        return None
    src = Path(real_path)
    if any(Path(f).stat().st_mtime > src.stat().st_mtime + 1 for f in files):
        return "inputs newer than the clip: not cached"
    key = kling_v2v.cache_key(clay, refs, prompt, resolution or seg.resolution, duration or seg.duration)
    kling_v2v.Cache(ctx.p("video", "_cache")).put(key, src, how, record)
    return key


def _yaw_step(clay_cam, f, per_real):
    fr = clay_cam["frames"]
    i = max(1, min(len(fr) - 1, int(round(f))))
    a = camera_map.frame_entry(camera_map.normalise(fr[i - 1]), 1, 1, 24)["yaw_deg_from_plus_y_cw"]
    b = camera_map.frame_entry(camera_map.normalise(fr[i]), 1, 1, 24)["yaw_deg_from_plus_y_cw"]
    return abs(((b - a + 540) % 360) - 180) * per_real


def finish(ctx, st, real: Path, source: dict, cost_now: float):
    """camera.json, rest frame (+ gate), JPEGs, segment.json for a real.mp4 that is in place."""
    seg: Seg = st.seg
    out = seg.dir
    pr = media.probe(real)
    n_video, fps, size = pr["n_frames"], pr["fps"] or float(ctx_fps(seg)), [pr["width"], pr["height"]]
    clay_n = media.probe(seg.clay_video)["n_frames"] if seg.clay_video and seg.clay_video.exists() else None
    n = n_video
    notes = []
    if seg.loop and clay_n and n_video == clay_n + 1:
        n = clay_n
        notes.append(f"loop: the video's frame {n_video} (= frame 1, Kling's extra frame) is not a hold frame")
    # ---- camera
    anchors, gate, trust, clay_cam = [], None, None, None
    parent = None
    if seg.adopt and seg.adopt.get("parent"):
        pa = seg.adopt["parent"]
        parent = {"n_real": int(pa["n_real"]), "first": int(pa["first"]), "video": rel(pa["video"]) if pa.get("video") else None}
    if seg.camera.get("from") == "file":
        cf = jload(seg.camera["file"])
        fr = cf["frames"]
        if len(fr) < n:
            raise RuntimeError(f"{seg.id}: camera file has {len(fr)} frames < {n} real frames")
        frames = []
        for k, f in enumerate(fr[:n], 1):
            nn = camera_map.normalise(f)
            e = camera_map.frame_entry(nn, k, f.get("clay_frame") or f.get("frame") or k, fps)
            e["clay_frame"] = None
            frames.append(e)
        cam = {"schema": camera_map.SCHEMA, "frame_world": cf.get("frame_world") or camera_map.WORLD,
               "camera_convention": camera_map.CONVENTION, "fps": fps, "n_frames": n, "loop": seg.loop,
               "mapping": {"model": "file", "file": rel(seg.camera["file"]), "why": seg.camera.get("why")},
               "note": cf.get("note"), "frames": frames}
        trust = f"file ({rel(seg.camera['file'])}): {seg.camera.get('why') or 'measured elsewhere'}"
        expected_rest = cf.get("centre_frame")
        c0 = c1 = None
    else:
        clay_cam = jload(seg.clay_camera)
        c0, c1 = seg.camera_frames or (1, len(clay_cam["frames"]))
        cam = camera_map.real_camera(clay_cam, n, fps, (c0, c1), parent=parent, loop=seg.loop, res=size)
        trust = f"clay time map ({cam['mapping']['model']}): a model, not a measurement"
        expected_rest = None
        if seg.rest and seg.rest.get("clay_frame") is not None:
            P = parent["n_real"] if parent else n
            kp = camera_map.inverse_map(float(seg.rest["clay_frame"]), P, c0, c1)
            expected_rest = kp - (parent["first"] - 1 if parent else 0)
    # ---- rest frame
    rest_frame = None
    if seg.rest:
        rest_frame = int(round(expected_rest)) if expected_rest else None
        anchor_to = seg.rest.get("anchor_to")
        prev = ctx.p("video", anchor_to, "real.mp4") if anchor_to else None
        if prev is not None and prev.exists():
            ref = rest_anchor.last_frame(prev)
            frames_g = media.decode_gray(real, size=(rest_anchor.WORK_W, 720), max_frames=n)
            found = rest_anchor.find_rest(ref, frames_g, loop=seg.loop)
            dpf = (_yaw_step(clay_cam, seg.rest["clay_frame"], (c1 - c0) / max(1, n - 1))
                   if clay_cam is not None and seg.rest.get("clay_frame") is not None else None)
            gate = rest_anchor.gate(found, expected_rest, deg_per_frame=dpf)
            gate.update(reference=f"last frame of {rel(prev)}", track=rel(real), best_frame=found["best_frame"],
                        dx_px=found["dx_px"])
            jdump({**gate, "scores": found["scores"]}, out / "qa" / "rest_anchor.gate.json")
            if found["confident"]:
                rest_frame = max(1, min(n, int(round(found["rest_real"]))))
                if clay_cam is not None and not seg.loop and gate.get("offset_frames") is not None \
                        and abs(gate["offset_frames"]) > gate["tol_frames"]:
                    first = parent["first"] - 1 if parent else 0
                    anchors = [(found["rest_real"] + first, float(seg.rest["clay_frame"]),
                                f"measured: ORB vs the last frame of {anchor_to}, {found['inliers']} inliers")]
                    cam = camera_map.real_camera(clay_cam, n, fps, (c0, c1), anchors=anchors, parent=parent,
                                                 loop=seg.loop, res=size)
                    trust = ("piecewise-linear through the MEASURED rest frame (ORB vs the previous segment's last "
                             "frame); the other frames are interpolated, not measured")
        elif anchor_to:
            notes.append(f"rest not measured: segment {anchor_to} has no real.mp4 yet")
    jdump(cam, out / "camera.json")
    # ---- JPEGs
    media.extract_frame(real, 0, out / "first.jpg")
    media.extract_frame(real, n - 1, out / "last.jpg")
    if seg.frames:
        media.extract_jpgs(real, out / "jpg", n)
        media.extract_jpgs(real, out / "jpg_lo", n, width=LO_WIDTH, quality=4)
    else:
        for d in ("jpg", "jpg_lo"):
            if (out / d).exists():
                shutil.rmtree(out / d)
    # ---- the manifest entry
    entry = {"id": seg.id, "role": seg.role, "kind": "flat-video", "unit": seg.unit,
             "src": f"{seg.id}/real.mp4", "poster": f"{seg.id}/first.jpg", "last": f"{seg.id}/last.jpg",
             "fps": fps, "n_frames": n, "video_frames": n_video, "size": size, "duration_s": pr["duration_s"],
             "camera": f"{seg.id}/camera.json",
             "frames": f"{seg.id}/jpg/" if seg.frames else None, "frames_lo": f"{seg.id}/jpg_lo/" if seg.frames else None,
             "pattern": "frame_%04d.jpg", "loop": seg.loop, "rest_frame": rest_frame,
             "preview": bool(seg.raw.get("preview")), "default": bool(seg.raw.get("default")),
             "camera_trust": trust, "end_pose": camera_map.end_pose(cam), "source": source,
             "gates": {"rest_anchor": gate} if gate else {}, "notes": notes + ([seg.raw["note"]] if seg.raw.get("note") else [])}
    if seg.raw.get("pills_near") is not None:
        entry["pills_near"] = seg.raw["pills_near"]
    if seg.role.startswith("enter-") and seg.unit:
        u = next((x for x in ctx.project.get("units") or [] if x.get("id") == seg.unit), None)
        pj = ctx.file(((u or {}).get("files") or {}).get("plan_json")) if u else None
        if pj and pj.exists():
            h = camera_map.nearest_camera_point(jload(pj), cam["frames"][-1]["pos"])
            if h:
                h["end_yaw_deg_from_plus_y_cw"] = cam["frames"][-1]["yaw_deg_from_plus_y_cw"]
                h["note"] = ("the tour scene the clip lands in; camera_point_yaw_deg is the tour's default yaw for it "
                             "(open the tour at the clip's end yaw to avoid a turn)")
                entry["handoff"] = h
    jdump(entry, out / "segment.json")
    return entry, gate


def ctx_fps(seg):
    return seg.spec.get("fps") or 24


def execute(ctx, st):
    seg: Seg = st.seg
    kind, why, extra = plan_segment(ctx, st)
    if kind == "need":
        print(f"        {why}")
        return Result("blocked", 2, stamp=False, note=why)
    out = seg.dir
    real = out / "real.mp4"
    if kind == "call":
        r = spend_refusal(ctx, extra["est"])
        if r:
            print(f"        {r}")
            return Result("refused", 3, stamp=False, note=r)
        if _kf_check(ctx, seg) not in (None, 0):
            msg = "kf_check FAILED on the reference keyframe: nothing was called ($0)"
            print(f"        {msg}")
            return Result("failed", 1, stamp=False, note=msg)
    invalidate_stamp(st)
    out.mkdir(parents=True, exist_ok=True)
    if kind == "adopt":
        a = seg.adopt
        src = seg.adopt_source()
        if a.get("cut"):
            media.cut(src, real, int(a["cut"]["first"]), int(a["cut"]["last"]), fps=ctx_fps(seg))
        else:
            shutil.copy2(src, real)
        rec = json.loads(a["record"].read_text(encoding="utf-8")) if a.get("record") and a["record"].exists() else {}
        args = rec.get("args") or {}
        prompt = args.get("prompt") or seg.raw.get("prompt") or ""
        src_info = {"clay": rel(seg.clay_video) if seg.clay_video else None,
                    "clay_sha256_16": kling_v2v.sha256_file(seg.clay_video)[:16] if seg.clay_video and seg.clay_video.exists() else None,
                    "refs": [rel(p) for p in seg.ref_paths() if p],
                    "prompt_sha256_16": kling_v2v.sha16(prompt) if prompt else None,
                    "endpoint": rec.get("endpoint") or kling_v2v.ENDPOINT, "provider": "fal",
                    "resolution": args.get("resolution"), "duration": args.get("duration"),
                    "cost_usd": float(a.get("cost_usd") or 0), "cost_usd_this_run": 0.0,
                    "adopted_from": rel(src) + (f" frames {a['cut']['first']}..{a['cut']['last']}" if a.get("cut") else ""),
                    "parent": ({"video": rel(a["parent"]["video"]), "frames": [a["parent"]["first"], a["parent"].get("last")]}
                               if a.get("parent") else None),
                    "record": rel(a["record"]) if a.get("record") else None, "by": a.get("by"),
                    "ledger": a.get("ledger"), "note": a.get("note")}
        jdump({"adopted_at": now(), "adopted_from": src_info["adopted_from"], "original_record": rec,
               "sha256": kling_v2v.sha256_file(real)}, out / "real.json")
        how = "adopted-parent" if a.get("cut") or a.get("parent") else "adopted"
        cache_src = a["parent"]["video"] if a.get("parent") and a["parent"].get("video") else real
        # only a clip whose original call record carries its prompt can be keyed by (clay, refs, prompt): without the
        # record the stage cannot prove which inputs made it, so it is not offered to later calls
        src_info["cache"] = (_register_cache(ctx, seg, cache_src, args["prompt"], how, src_info["record"],
                                             args.get("resolution"), args.get("duration"))
                             if args.get("prompt") else "no call record with a prompt: not cached")
        cost = 0.0
    elif kind == "cache":
        shutil.copy2(extra["hit"]["path"], real)
        src_info = {"clay": rel(seg.clay_video), "clay_sha256_16": kling_v2v.sha256_file(seg.clay_video)[:16],
                    "refs": [rel(p) for p in seg.ref_paths()], "prompt_sha256_16": kling_v2v.sha16(extra["prompt"]),
                    "endpoint": kling_v2v.ENDPOINT, "provider": "fal", "resolution": seg.resolution, "cost_usd": 0.0,
                    "cost_usd_this_run": 0.0, "adopted_from": f"cache {extra['key'][:16]} ({rel(extra['hit']['path'])})"}
        cost = 0.0
    else:                                                     # call: the only paid branch
        row = _ledger_row(ctx, st)
        submitted = {}

        def on_submit(rid):
            submitted["rid"] = rid
            if row is not None:
                row["request_id"] = rid
                row["note"] = f"submitted to fal at {now()}: request {rid} (estimate ${extra['est']:.2f})"
                ctx.ledger.save()
            print(f"        submitted: fal request {rid}")
        try:
            rec = kling_v2v.run(seg.clay_video, seg.ref_paths(), extra["prompt"], out, seg.resolution, seg.duration,
                                on_submit=on_submit)
        except Exception as ex:  # noqa: BLE001 - the money of a submitted job is booked conservatively
            booked = extra["est"] if submitted else 0.0
            msg = (f"{type(ex).__name__}: {ex}; " + (f"request {submitted['rid']} was submitted: the estimate "
                                                      f"${booked:.2f} is booked until fal's invoice says otherwise"
                                                      if submitted else "nothing was submitted ($0)"))
            print(f"        {msg}")
            return Result("failed", 1, stamp=False, note=msg, cost_usd=booked)
        cost = extra["est"]
        src_info = {"clay": rel(seg.clay_video), "clay_sha256_16": kling_v2v.sha256_file(seg.clay_video)[:16],
                    "refs": [rel(p) for p in seg.ref_paths()], "prompt_sha256_16": kling_v2v.sha16(extra["prompt"]),
                    "endpoint": kling_v2v.ENDPOINT, "provider": "fal", "resolution": seg.resolution, "cost_usd": cost,
                    "cost_usd_this_run": cost, "request_id": rec["request_id"], "record": rel(out / "real.json")}
        src_info["cache"] = _register_cache(ctx, seg, real, extra["prompt"], "called", rel(out / "real.json"))
        (out / "prompt.txt").write_text(extra["prompt"], encoding="utf-8")
    entry, gate = finish(ctx, st, real, src_info, cost)
    note = (f"{kind}: {entry['n_frames']} frames {entry['size'][0]}x{entry['size'][1]}, rest {entry['rest_frame']}"
            + (f", rest_anchor {gate['status']} (measured {gate.get('measured_rest')}, mapped {gate.get('expected_rest')})"
               if gate else ""))
    return Result("ok", 0, gate=gate, note=note, cost_usd=cost)


# --------------------------------------------------------------------------------------------------- the manifest
def manifest_execute(ctx, st):
    invalidate_stamp(st)
    entries, missing = [], []
    for seg in st.segs:
        f = seg.dir / "segment.json"
        if f.exists():
            entries.append(jload(f))
        else:
            missing.append({"id": seg.id, "role": seg.role})
    from .export import platform_project
    pdir, _ = platform_project(ctx)
    holds = [e for e in entries if e["role"].startswith("hold-")]
    default = next((e["id"] for e in holds if e.get("default")), None) or next(
        (e["id"] for e in holds if not e.get("preview")), None)
    man = vman.build(ctx.pid, entries, missing, {
        "platform_project": pdir.name if pdir else None, "generated_at": now(),
        "generated_by": "Habait/engine/stages/video.py (card 35)", "spec": rel(st.spec_file) if st.spec_file else "derived",
        "hold_default": default,
        "note": ("paths are relative to this folder; camera.json = one entry per REAL frame; preview=true tracks are "
                 "shown only behind a flag; hold_default = the hold track the flow plays")})
    path = ctx.p("video", "manifest.json")
    jdump(man, path)
    probs = vman.validate(man, path.parent)
    g = {"gate": "video_manifest", "pass": not probs and not missing, "blocking": bool(probs), "score": len(entries),
         "problems": probs, "missing": missing, "file": str(path)}
    jdump(g, ctx.p("video", "qa", "manifest.gate.json"))
    roles = [e["role"] for e in entries]
    note = f"{len(entries)} segment(s) {roles}" + (f"; missing {[m['id'] for m in missing]}" if missing else "") \
        + (f"; {len(probs)} problem(s): {probs[:3]}" if probs else "; valid")
    if probs:
        return Result("failed", 1, gate=g, note=note)
    return Result("ok", 0, gate=g, note=note)


# --------------------------------------------------------------------------------------------------------- steps
def steps(ctx):
    try:
        spec, spec_file, segs = load_segments(ctx)
    except (OSError, ValueError, KeyError) as e:
        st = Step("video", None, ctx.p("video"))
        st.na = f"video spec unreadable: {e}"
        return [st]
    out = []
    for seg in segs:
        st = Step("video", seg.id, seg.dir)
        st.seg = seg
        inputs = {"segment": seg.raw, "spec_look": spec.get("look"), "spec_resolution": spec.get("resolution")}
        for i, c in enumerate(CODE):
            inputs[f"code{i}"] = c
        if seg.adopt_source():
            inputs["adopt_video"] = seg.adopt_source()
        if seg.adopt and seg.adopt.get("record"):
            inputs["adopt_record"] = seg.adopt["record"]
        if seg.clay_video:
            inputs["clay_video"] = seg.clay_video
        if seg.clay_camera:
            inputs["clay_camera"] = seg.clay_camera
        if seg.camera.get("file"):
            inputs["camera_file"] = seg.camera["file"]
        for i, p in enumerate(seg.ref_paths()):
            inputs[f"ref{i}"] = p
        if seg.rest and seg.rest.get("anchor_to"):
            inputs["anchor_video"] = ctx.p("video", seg.rest["anchor_to"], "real.mp4")
        st.inputs = inputs
        st.outputs = [seg.dir / x for x in ("real.mp4", "camera.json", "first.jpg", "last.jpg", "segment.json")] + (
            [seg.dir / "jpg", seg.dir / "jpg_lo"] if seg.frames else [])
        src = seg.adopt_source()
        if seg.adopt:
            st.cmds = ([["ffmpeg", "cut", src, f"frames {seg.adopt['cut']['first']}..{seg.adopt['cut']['last']}", "->",
                         seg.dir / "real.mp4"]] if seg.adopt.get("cut") else [["copy", src, "->", seg.dir / "real.mp4"]])
        else:
            st.cmds = [["kling_v2v.run", kling_v2v.ENDPOINT, "@Video1=" + (rel(seg.clay_video) if seg.clay_video else "?"),
                        *[f"@Image{i}=" + (rel(p) if p else "?") for i, p in enumerate(seg.ref_paths(), 1)],
                        seg.resolution]]
        cam_line = (f"camera from {rel(seg.camera['file'])} ({seg.camera.get('why') or 'already on the real frames'})"
                    if seg.camera.get("from") == "file" else
                    f"camera: clay {rel(seg.clay_camera) if seg.clay_camera else '?'} frames "
                    f"{list(seg.camera_frames) if seg.camera_frames else 'all'} -> the real frames by time"
                    + (f" (cut of a {seg.adopt['parent']['n_real']}-frame clip from frame {seg.adopt['parent']['first']})"
                       if seg.adopt and seg.adopt.get("parent") else ""))
        st.cmds.append(["map", cam_line])
        st.cmds.append(["ffmpeg", "first.jpg, last.jpg" + (", jpg/ + jpg_lo/ (every frame)" if seg.frames else "")])
        st.gate = ("rest_anchor: ORB vs the last frame of " + seg.rest["anchor_to"] + " (advisory)"
                   if seg.rest and seg.rest.get("anchor_to") else "probe + camera n_frames == real frames")
        st.notes = []
        if seg.raw.get("preview"):
            st.notes.append("PREVIEW track: " + (seg.raw.get("note") or "shown only behind a flag"))
        if seg.adopt and seg.adopt.get("note"):
            st.notes.append(seg.adopt["note"])
        st.est_usd = 0.0
        st.preview, st.execute = preview, execute
        out.append(st)
    m = Step("video", "manifest", ctx.p("video"))
    m.segs, m.spec_file = segs, spec_file
    m.inputs = {f"seg:{s.id}": s.dir / "segment.json" for s in segs}
    m.inputs["code"] = ENGINE / "video" / "manifest.py"
    m.outputs = [ctx.p("video", "manifest.json")]
    m.cmds = [["collect", f"{len(segs)} segment.json", "->", ctx.p("video", "manifest.json")]]
    m.gate = "video/manifest.py validate (schema, roles, files, camera n_frames == n_frames, JPEG counts): blocking"
    m.notes = [f"spec {rel(spec_file) if spec_file else 'derived from project.json (no video/segments.json)'}"]
    m.execute = manifest_execute
    out.append(m)
    return out
