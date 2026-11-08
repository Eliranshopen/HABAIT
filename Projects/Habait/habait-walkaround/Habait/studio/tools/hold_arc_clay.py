"""hold_arc_clay.py - clay frames of a CLOSE ARC around the Rainbow tower for the "living hold" (habait-ba, 2026-11-02 evening).

Eliran on the static 360 hold: "זה סטטי ולא דינאמי ולא ריאליסטי". The hold becomes a scrubbable video: the buyer drags left/right and
the camera orbits the facade on real (Kling-rendered) frames; idle = a slow drift. This script renders the CLAY for that arc with the
SAME scene, lens and light as Habait/flyover/orbit/orbit_clay.py (imported read-only, its main() stripped), so the arc's centre
frame is exactly the orbit video's end pose (node-b-tower: pos, yaw to END_LOOK_XY, pitch -2, HFOV 65.5).

Path: bearing b_end - half_arc .. b_end + half_arc around the tower axis at the end pose's radius and height, constant pitch -2,
yaw always toward END_LOOK_XY (so the tower stays framed as at the hold). Writes frames/frame_####.png and camera.json
(matrix_world per frame, same schema fields as the orbit) for the per-frame pill projection in flyover3d/app.js.

  blender -b --factory-startup -P Habait/studio/tools/hold_arc_clay.py -- --out <abs dir>/frames --camera-json <abs>/camera.json
          [--frames 181] [--half-arc 45] [--res 1280x720] [--samples 16] [--only 1,91,181]
"""
import json
import math
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
HABAIT = os.path.dirname(os.path.dirname(HERE))                      # .../habait-walkaround/Habait
ORBIT_PY = os.path.join(HABAIT, "flyover", "orbit", "orbit_clay.py")

# import orbit_clay.py as a module without running its main(): the file ends with a bare "main()" line (card 17 relies on it too)
src = open(ORBIT_PY, encoding="utf-8").read()
assert src.rstrip().endswith("main()"), "orbit_clay.py no longer ends with main()"
src = src.rstrip()[: -len("main()")]
ns = {"__name__": "orbit_clay", "__file__": ORBIT_PY}
argv_saved = sys.argv[:]
exec(compile(src, ORBIT_PY, "exec"), ns)
bpy = ns["bpy"]; Matrix = ns["Matrix"]; Vector = ns["Vector"]
log = ns["log"]; bearing = ns["bearing"]; direction = ns["direction"]; build_scene = ns["build_scene"]; configure = ns["configure"]
project = ns["project"]
SENSOR, HFOV, END_NODE, END_LOOK_XY, END_PITCH = ns["SENSOR"], ns["HFOV"], ns["END_NODE"], ns["END_LOOK_XY"], ns["END_PITCH"]


def parse_args():
    import argparse
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--glb", default=ns["DEF_GLB"]); p.add_argument("--nodes", default=ns["DEF_NODES"]); p.add_argument("--faces", default=ns["DEF_FACES"])
    p.add_argument("--hdri", default=ns["DEF_HDRI"]); p.add_argument("--scene-blend", default=ns["DEF_SCENE_BLEND"])
    p.add_argument("--out", required=True); p.add_argument("--camera-json", required=True)
    p.add_argument("--frames", type=int, default=181, help="odd: the middle frame is the hold pose")
    p.add_argument("--half-arc", type=float, default=45.0, help="degrees of bearing each side of the hold pose")
    p.add_argument("--fps", type=int, default=24); p.add_argument("--res", default="1280x720"); p.add_argument("--samples", type=int, default=16)
    p.add_argument("--only", default=""); p.add_argument("--every", type=int, default=0)
    p.add_argument("--no-far-ortho", dest="far_ortho", action="store_false"); p.add_argument("--no-raytracing", action="store_true")
    p.add_argument("--unit-light-shadows", action="store_true")
    a = p.parse_args(argv)
    for k in ("glb", "nodes", "faces", "hdri", "out", "camera_json", "scene_blend"):
        v = getattr(a, k)
        if v: setattr(a, k, os.path.abspath(v))
    return a


def main():
    a = parse_args()
    w, h = [int(v) for v in a.res.lower().split("x")]
    nodes_doc = json.load(open(a.nodes, encoding="utf-8"))
    node = next(n for n in nodes_doc["nodes"] if n["id"] == END_NODE)
    end_pos = Vector(tuple(float(v) for v in node["pos_world"]))
    end_yaw = bearing(END_LOOK_XY[0] - end_pos[0], END_LOOK_XY[1] - end_pos[1])
    lens = (SENSOR / 2.0) / math.tan(math.radians(HFOV / 2.0))
    vfov = 2 * math.degrees(math.atan(math.tan(math.radians(HFOV / 2.0)) * h / w))

    scene = bpy.context.scene
    (cx, cy), tower_pts = build_scene(a, nodes_doc)
    r = math.hypot(end_pos.x - cx, end_pos.y - cy)
    b_end = bearing(end_pos.x - cx, end_pos.y - cy)
    N = a.frames if a.frames % 2 == 1 else a.frames + 1
    mid = N // 2
    log(f"hold arc: tower axis ({cx:.2f},{cy:.2f}) r {r:.2f} z {end_pos.z:.2f}; bearing {b_end:.2f} +- {a.half_arc}; {N} frames; "
        f"lens {lens:.3f} (hfov {HFOV}, vfov {vfov:.2f}) {w}x{h}; centre frame {mid + 1} = node-b pose (yaw {end_yaw:.3f}, pitch {END_PITCH})")

    cam_d = bpy.data.cameras.new("ARC_cam"); cam_d.sensor_fit = "HORIZONTAL"; cam_d.sensor_width = SENSOR; cam_d.lens = lens
    cam_d.clip_start = 1.0; cam_d.clip_end = 6000.0
    cam = bpy.data.objects.new("ARC_cam", cam_d); scene.collection.objects.link(cam); scene.camera = cam
    configure(scene, a, w, h); scene.frame_start, scene.frame_end = 1, N

    frames = []
    for s in range(N):
        k = (s - mid) / float(mid)                                   # -1 .. +1
        b = math.radians(b_end + a.half_arc * k)
        pos = Vector((cx + r * math.sin(b), cy + r * math.cos(b), end_pos.z)) if s != mid else end_pos.copy()
        yaw = bearing(END_LOOK_XY[0] - pos.x, END_LOOK_XY[1] - pos.y)
        d = direction(yaw, END_PITCH)
        cam.location = pos; cam.rotation_mode = "QUATERNION"; cam.rotation_quaternion = d.to_track_quat("-Z", "Y")
        bpy.context.view_layer.update()
        M = cam.matrix_world.copy(); Minv = M.inverted()
        pr = [q for q in (project(Minv, lens, w, h, p) for p in tower_pts) if q]
        box = [round(min(q[0] for q in pr), 3), round(max(q[0] for q in pr), 3), round(min(q[1] for q in pr), 3), round(max(q[1] for q in pr), 3)] if pr else None
        frames.append({"frame": s + 1, "t_s": round(s / a.fps, 4), "phase": "hold" if s == mid else "arc", "bearing_deg": round(math.degrees(b) % 360, 4),
                       "pos": [round(v, 4) for v in pos], "look_dir": [round(v, 6) for v in d], "yaw_deg_from_plus_y_cw": round(yaw, 4), "pitch_deg": END_PITCH,
                       "lens_mm": round(lens, 4), "sensor_mm": SENSOR, "hfov_deg": HFOV, "vfov_deg": round(vfov, 4), "res": [w, h],
                       "matrix_world": [[round(v, 6) for v in row] for row in M], "tower_ndc_box": box})
    doc = {"schema": "habait-flyover/hold-arc-camera.v1", "frame_world": "plan-world metres (as orbit camera.json)",
           "camera_convention": "Blender camera: looks along local -Z, up local +Y; matrix_world = camera to world",
           "fps": a.fps, "n_frames": N, "centre_frame": mid + 1, "arc": {"centre_xy": [round(cx, 4), round(cy, 4)], "radius_m": round(r, 4), "z": round(end_pos.z, 4),
           "bearing_centre_deg": round(b_end, 4), "half_arc_deg": a.half_arc, "look_xy": list(END_LOOK_XY), "pitch_deg": END_PITCH},
           "end_pose_node": END_NODE, "frames": frames}
    os.makedirs(os.path.dirname(a.camera_json), exist_ok=True)
    json.dump(doc, open(a.camera_json, "w", encoding="utf-8"), indent=1)
    log(f"camera.json: {N} frames -> {a.camera_json}")

    todo = list(range(1, N + 1))
    if a.only: todo = [int(v) for v in a.only.split(",") if v.strip()]
    elif a.every: todo = sorted(set(list(range(1, N + 1, a.every)) + [mid + 1, N]))
    os.makedirs(a.out, exist_ok=True)
    times = []; t_all = time.time()
    for fno in todo:
        out = os.path.join(a.out, f"frame_{fno:04d}.png")
        if os.path.exists(out) and os.path.getsize(out) > 10000: continue
        cam.matrix_world = Matrix(frames[fno - 1]["matrix_world"]); bpy.context.view_layer.update(); scene.frame_set(fno)
        scene.render.filepath = out; t0 = time.time(); bpy.ops.render.render(write_still=True); times.append(time.time() - t0)
        log(f"frame {fno} {times[-1]:.1f}s")
    if times:
        log(f"TIMING {len(times)} frames in {time.time() - t_all:.1f}s; mean after first {(sum(times[1:]) / max(1, len(times) - 1)):.2f}s")


main()
