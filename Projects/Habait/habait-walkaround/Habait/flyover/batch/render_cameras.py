"""render_cameras.py - render equirect frames from camera.json files on the site clay scene (card 22, lane C6b, 2026-11-02).

The per-unit descend paths of batch_units.py are not segments of path.json, so render_segments.py (card 17) cannot select
them by name. This script renders ANY camera.json of the Studio form ({"frames": [{frame, global_frame, pos,
yaw_deg_from_plus_y_cw, ...}]}) with exactly the scene, camera and render settings of render_segments.py: its helpers are
exec'd read-only (the trailing main() call dropped, as enter.py does), the scene is site.glb built by habait-ab's
orbit_clay.build_scene (build_glb_scene), the camera is the same level Cycles equirect (level_matrix(pos, yaw)), and
setup_cycles / render_still are the same functions. One Blender process renders several camera files (the scene is built
and its BVH kept once: use_persistent_data).

  blender -b --factory-startup -P render_cameras.py -- --render-segments <render_segments.py> --glb <site.glb> \
      --orbit-clay <orbit_clay.py> --hdri <hdr> [--nodes-json <nodes.json>] [--scene-blend <scene.blend> | ''] \
      --out <segments dir> --cam descend-836=<camera.json>[@1-120] [--cam ...] --res 2048x1024 --samples 128 \
      [--device auto] [--fmt PNG] [--force]
  python render_cameras.py --cam X=<camera.json>[@frames] --out <dir> --dry-run      # what would render; no Blender

Output: <out>/<seg>/frames/frame_####.png (frame = the camera row's 'frame', 1-based), <out>/<seg>/render_log.json (this
segment's frames) and <out>/render_log.json (the whole process, render_segments' keys: compute, devices, denoiser,
first_frame_s, steady_s_per_frame, import_s, total_s, frames). Idempotent: a frame >= 2 KB is skipped unless --force;
frames are written to a temp name and renamed. Lines start with [dev] / [frame] / [done] like render_segments.py, so the
Kaggle driver's live echo shows them.
"""
import argparse
import json
import os
import sys
import time
import types

try:
    import bpy  # noqa: F401
except ImportError:
    bpy = None

HERE = os.path.dirname(os.path.abspath(__file__))
FLY = os.path.dirname(HERE)
DEF_RS = os.path.join(FLY, "equirect", "render_segments.py")
MIN_FRAME_BYTES = 2048


def log(msg):
    print(f"[cameras] {msg}", flush=True)


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else (sys.argv[1:] if bpy is None else [])
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    p.add_argument("--render-segments", default=DEF_RS, help="card 17's script; exec'd read-only for its helpers")
    p.add_argument("--cam", action="append", default=[], help="SEG=CAMERA_JSON[@FRAMES], FRAMES like 1-120 or 1-10,15")
    p.add_argument("--out", required=True)
    p.add_argument("--glb", default="")
    p.add_argument("--orbit-clay", default=os.path.join(FLY, "orbit", "orbit_clay.py"))
    p.add_argument("--hdri", default="")
    p.add_argument("--nodes-json", default="")
    p.add_argument("--scene-blend", default=None, help="the 846 ceiling lights; '' = none (render_segments' meaning)")
    p.add_argument("--no-far-ortho", action="store_true")
    p.add_argument("--res", default="2048x1024")
    p.add_argument("--samples", type=int, default=128)
    p.add_argument("--device", default="auto")
    p.add_argument("--exposure", type=float, default=0.0)
    p.add_argument("--fmt", default="PNG", choices=["PNG", "JPEG"])
    p.add_argument("--force", action="store_true")
    p.add_argument("--dry-run", action="store_true")
    a = p.parse_args(argv)
    for k in ("render_segments", "out", "glb", "orbit_clay", "hdri", "nodes_json"):
        if getattr(a, k):
            setattr(a, k, os.path.abspath(getattr(a, k)))
    if a.scene_blend:
        a.scene_blend = os.path.abspath(a.scene_blend)
    return a


def load_render_segments(path):
    """card 17's render_segments.py, read-only: the trailing main() call is dropped, the helpers are reused"""
    lines = open(path, encoding="utf-8").read().rstrip().splitlines()
    if not lines or lines[-1].strip() != "main()":
        raise SystemExit(f"{path}: expected a trailing main() call; the layout changed")
    ns = {"__file__": os.path.abspath(path), "__name__": "render_segments_lib"}
    exec(compile("\n".join(lines[:-1]) + "\n", path, "exec"), ns)
    return ns


def parse_sel(spec, rows):
    have = sorted(rows)
    if not spec:
        return have
    out = []
    for part in spec.split(","):
        part = part.strip()
        if "-" in part:
            x, y = part.split("-")
            out += list(range(int(x), int(y) + 1))
        elif part:
            out.append(int(part))
    return [i for i in out if i in rows]


def parse_cams(specs):
    cams = []
    for s in specs:
        seg, _, rest = s.partition("=")
        path, _, frames = rest.rpartition("@") if "@" in rest else (rest, "", "")
        if not seg or not path:
            raise SystemExit(f"bad --cam {s!r}: want SEG=CAMERA_JSON[@FRAMES]")
        doc = json.load(open(os.path.abspath(path), encoding="utf-8"))
        rows = {int(r["frame"]): r for r in doc["frames"]}
        cams.append({"seg": seg, "path": os.path.abspath(path), "rows": rows, "sel": parse_sel(frames, rows)})
    if not cams:
        raise SystemExit("no --cam given")
    return cams


def frame_path(out, seg, i, ext):
    return os.path.join(out, seg, "frames", f"frame_{i:04d}{ext}")


def exists(p):
    return os.path.exists(p) and os.path.getsize(p) >= MIN_FRAME_BYTES


def main():
    a = parse_args()
    cams = parse_cams(a.cam)
    ext = ".png" if a.fmt == "PNG" else ".jpg"
    w, h = [int(v) for v in a.res.lower().split("x")]
    todo_all = 0
    for c in cams:
        c["todo"] = [i for i in c["sel"] if a.force or not exists(frame_path(a.out, c["seg"], i, ext))]
        todo_all += len(c["todo"])
        log(f"{c['seg']}: {len(c['rows'])} rows, {len(c['sel'])} selected, {len(c['todo'])} to render -> {os.path.join(a.out, c['seg'], 'frames')}")
    if a.dry_run or bpy is None:
        if bpy is None and not a.dry_run:
            raise SystemExit("rendering runs inside Blender (or use --dry-run)")
        return
    rs = load_render_segments(a.render_segments)
    t_all = time.time()
    log_d = {"args": {k: v for k, v in vars(a).items()}, "res": [w, h], "samples": a.samples, "card": 22}
    if todo_all == 0:
        log("nothing to render (every selected frame exists)")
        log_d.update({"frames": [], "total_s": 0.0})
        os.makedirs(a.out, exist_ok=True)
        json.dump(log_d, open(os.path.join(a.out, "render_log.json"), "w", encoding="utf-8"), indent=1, default=str)
        print("[done]", json.dumps({"frames": 0}), flush=True)
        return
    if not a.glb:
        raise SystemExit("--glb site.glb is required (the scene of render_segments --glb)")
    ba = types.SimpleNamespace(glb=a.glb, orbit_clay=a.orbit_clay, hdri=a.hdri, nodes_json=a.nodes_json,
                               scene_blend=a.scene_blend, no_far_ortho=a.no_far_ortho)
    rs["build_glb_scene"](ba, log_d)
    scene = bpy.context.scene
    rs["setup_cycles"](scene, types.SimpleNamespace(device=a.device, fmt=a.fmt, samples=a.samples, exposure=a.exposure), w, h, log_d)
    cam, where = rs["blender_camera"](scene)
    log_d["camera"] = where
    from mathutils import Matrix
    times = []
    for c in cams:
        os.makedirs(os.path.join(a.out, c["seg"], "frames"), exist_ok=True)
        seg_times = []
        for i in c["todo"]:
            dst = frame_path(a.out, c["seg"], i, ext)
            if exists(dst) and not a.force:
                continue
            row = c["rows"][i]
            cam.matrix_world = Matrix(rs["level_matrix"](row["pos"], row["yaw_deg_from_plus_y_cw"]))
            bpy.context.view_layer.update()
            scene.frame_set(int(row.get("global_frame", i)))
            tmp = dst[: -len(ext)] + "_tmp" + ext
            scene.render.filepath = tmp
            t0 = time.time()
            rs["render_still"](scene, log_d)
            os.replace(tmp, dst)
            dt = time.time() - t0
            rec = {"segment": c["seg"], "frame": i, "global": row.get("global_frame"), "s": round(dt, 2)}
            times.append(rec)
            seg_times.append(rec)
            print(f"[frame] {c['seg']} {i} (global {row.get('global_frame')}) {dt:.2f}s", flush=True)
        seg_log = {k: log_d.get(k) for k in ("compute", "devices", "denoiser", "import_s", "res", "samples", "scene", "camera")}
        seg_log.update({"camera_json": c["path"], "frames": seg_times})
        if seg_times:
            st = [x["s"] for x in seg_times[1:]] or [seg_times[0]["s"]]
            seg_log["steady_s_per_frame"] = round(sum(st) / len(st), 2)
        json.dump(seg_log, open(os.path.join(a.out, c["seg"], "render_log.json"), "w", encoding="utf-8"), indent=1, default=str)
    log_d["frames"] = times
    if times:
        steady = [x["s"] for x in times[1:]] or [times[0]["s"]]
        log_d["first_frame_s"] = times[0]["s"]
        log_d["steady_s_per_frame"] = round(sum(steady) / len(steady), 2)
    log_d["total_s"] = round(time.time() - t_all, 1)
    json.dump(log_d, open(os.path.join(a.out, "render_log.json"), "w", encoding="utf-8"), indent=1, default=str)
    print("[done]", json.dumps({k: log_d.get(k) for k in ("compute", "denoiser", "steady_s_per_frame", "total_s")}), flush=True)


main()
