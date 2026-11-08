"""render_segments.py - the equirect 360 flight of Rainbow / unit 846 in four fixed segments (lane C3a, card 17, 2026-11-02).

Segments (path.json, same folder): approach -> orbit -> hold-facade -> descend-846. The orbit part is NOT a second path:
it reuses the per-frame poses of habait-ab's orbit (Habait/flyover/orbit/camera.json) up to its end pose at node-b-tower.
The camera is a level Cycles equirect (pitch 0, roll 0): u 0.5 = the segment heading, horizon at v 0.5; the director's
framing goes into each frame's view_hint.

Runs two ways:
  * plain Python (no Blender): --dry-run / --plan-only / --selftest; the path math is pure Python.
  * headless Blender: renders. Scene = the open .blend (e.g. Habait/flyover/project_skin.blend), or, with --glb, site.glb
    built by habait-ab's own orbit_clay.build_scene (exec'd read-only from ../orbit/orbit_clay.py) so the look matches the
    orbit clay. Callable from the Kaggle route-A notebook like orbit_render.py: "-- --glb <site.glb> --out <dir> ...".

  python render_segments.py --path path.json --dry-run
  blender -b [scene.blend] --factory-startup -P render_segments.py -- --path path.json --dry-run
  blender -b --factory-startup -P render_segments.py -- --glb <abs site.glb> --path <abs path.json> \
          [--out <abs dir>] [--segments approach,orbit] [--frames 1-96 | approach:1-48] [--res 2048x1024] [--samples 32]
  blender -b --factory-startup -P render_segments.py -- --probe-orientation <abs png>    # one 512x256 test frame

Output: <out>/<segment>/frames/frame_####.png (segment-local, 1-based) + <out>/<segment>/camera.json (every frame of the
segment, rendered or not, in the Studio's {"frames": [...]} form) + <out>/render_log.json. Existing frames are skipped
(idempotent; --force re-renders); frames are written to a temp name and renamed, so a killed run never leaves a stub.
"""
import argparse
import json
import math
import os
import sys
import time
import types

try:
    import bpy  # noqa: F401
except ImportError:
    bpy = None

HERE = os.path.dirname(os.path.abspath(__file__))
SEGMENTS = ("approach", "orbit", "hold-facade", "descend-846")
DEF_PATH = os.path.join(HERE, "path.json")
DEF_OUT = os.path.join(HERE, "_local", "segments")
DEF_ORBIT_CLAY = os.path.join(os.path.dirname(HERE), "orbit", "orbit_clay.py")
MIN_FRAME_BYTES = 2048


def log(msg):
    print(f"[segments] {msg}", flush=True)


# ------------------------------------------------------------------------------------------------ args
def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else (sys.argv[1:] if bpy is None else [])
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    p.add_argument("--path", default=DEF_PATH)
    p.add_argument("--orbit-camera", default="", help="override path.json sources.orbit_camera (e.g. on Kaggle)")
    p.add_argument("--repo", default="", help="worktree/repo root for the path.json sources (default: 3 levels up)")
    p.add_argument("--out", default=DEF_OUT)
    p.add_argument("--segments", default=",".join(SEGMENTS))
    p.add_argument("--frames", default="", help="global '1-96,200' or segment-local 'approach:1-48'")
    p.add_argument("--dry-run", action="store_true", help="print the segment table and checks; write nothing")
    p.add_argument("--plan-only", action="store_true", help="write camera.json per segment; render nothing")
    p.add_argument("--selftest", action="store_true", help="path checks only, exit 1 on a failure")
    p.add_argument("--force", action="store_true", help="re-render existing frames")
    # scene / render (Blender only)
    p.add_argument("--glb", default="", help="build the scene from this site.glb with orbit_clay.build_scene")
    p.add_argument("--orbit-clay", default=DEF_ORBIT_CLAY)
    p.add_argument("--hdri", default="", help="default: orbit_clay's DEF_HDRI")
    p.add_argument("--nodes-json", default="", help="default: orbit_clay's DEF_NODES (far orthophoto placement)")
    p.add_argument("--scene-blend", default=None, help="unit ceiling lights; default orbit_clay's; '' = none")
    p.add_argument("--no-far-ortho", action="store_true")
    p.add_argument("--res", default="2048x1024")
    p.add_argument("--samples", type=int, default=32)
    p.add_argument("--device", default="auto", help="auto | OPTIX | CUDA | CPU")
    p.add_argument("--exposure", type=float, default=0.0)
    p.add_argument("--fmt", default="PNG", choices=["PNG", "JPEG"])
    p.add_argument("--probe-orientation", default="", help="render ONE 512x256 test frame and check the u convention")
    a = p.parse_args(argv)
    for k in ("path", "orbit_camera", "repo", "out", "glb", "orbit_clay", "hdri", "nodes_json", "probe_orientation"):
        if getattr(a, k):
            setattr(a, k, os.path.abspath(getattr(a, k)))
    return a


# ------------------------------------------------------------------------------------------------ small vector math
def sub(a, b):
    return [x - y for x, y in zip(a, b)]


def add(a, b):
    return [x + y for x, y in zip(a, b)]


def mul(a, s):
    return [x * s for x in a]


def norm(a):
    return math.sqrt(sum(x * x for x in a))


def smoothstep(u):
    u = max(0.0, min(1.0, u))
    return u * u * (3 - 2 * u)


def bearing(dx, dy):
    """plan bearing in degrees, clockwise from +Y"""
    return math.degrees(math.atan2(dx, dy)) % 360.0


def wrap180(x):
    return (x + 180.0) % 360.0 - 180.0


def yaw_pitch(pos, look):
    d = sub(look, pos)
    return bearing(d[0], d[1]), math.degrees(math.atan2(d[2], math.hypot(d[0], d[1])))


def level_matrix(pos, yaw):
    """camera-to-world of a level camera (looks along local -Z, up local +Y) heading at plan bearing yaw"""
    s, c = math.sin(math.radians(yaw)), math.cos(math.radians(yaw))
    # columns: right (c, -s, 0), up (0, 0, 1), -forward (-s, -c, 0), pos
    return [[c, 0.0, -s, pos[0]], [-s, 0.0, -c, pos[1]], [0.0, 1.0, 0.0, pos[2]], [0.0, 0.0, 0.0, 1.0]]


# ------------------------------------------------------------------------------------------------ the path
def resolve_sources(doc, a):
    repo = a.repo or os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
    src = dict(doc.get("sources", {}))
    out = {}
    for k, v in src.items():
        if k == "orbit_camera":
            out[k] = a.orbit_camera or os.path.normpath(os.path.join(os.path.dirname(a.path), v))
        else:
            out[k] = os.path.normpath(os.path.join(repo, v))
    return out


def frame(pos, yaw, hint_yaw, hint_pitch, src=None):
    return {"pos": [float(v) for v in pos], "yaw": yaw % 360.0, "hint_yaw": hint_yaw % 360.0, "hint_pitch": hint_pitch, "src": src}


def seg_approach(spec, orbit, n):
    ring = orbit["ring"]
    cx, cy = ring["centre_xy"]
    north = 304.4
    f0 = spec["from"]
    b0 = (f0["bearing_true_deg"] + north) % 360.0
    r0, z0 = f0["radius_m"], f0["z"]
    p1 = orbit["frames"][0]["pos"]
    b1 = bearing(p1[0] - cx, p1[1] - cy)
    r1, z1 = math.hypot(p1[0] - cx, p1[1] - cy), p1[2]
    turn = (b1 - b0) % 360.0 if spec.get("direction", "clockwise") == "clockwise" else -((b0 - b1) % 360.0)
    aim = orbit["aim"]["point"]
    out = []
    for i in range(n):
        k = smoothstep(i / n)
        b = math.radians(b0 + turn * k)
        r = r0 + (r1 - r0) * k
        pos = [cx + r * math.sin(b), cy + r * math.cos(b), z0 + (z1 - z0) * k]
        yaw, pitch = yaw_pitch(pos, aim)
        out.append(frame(pos, yaw, yaw, pitch, f"polar spiral u={i / n:.4f}"))
    return out


def orbit_take(orbit):
    end_first = int(orbit["end_pose"]["frames"][0])
    return [f for f in orbit["frames"] if f["frame"] <= end_first]


def seg_orbit(orbit):
    return [frame(f["pos"], f["yaw_deg_from_plus_y_cw"], f["yaw_deg_from_plus_y_cw"], f["pitch_deg"],
                  f"orbit/camera.json frame {f['frame']} ({f['phase']})") for f in orbit_take(orbit)]


def orbit_end(orbit):
    e = orbit["end_pose"]
    return list(e["pos"]), float(e["yaw_deg_from_plus_y_cw"]), float(e["pitch_deg"])


def seg_hold(spec, orbit, n):
    pos0, yaw, pitch = orbit_end(orbit)
    s, c = math.sin(math.radians(yaw)), math.cos(math.radians(yaw))
    right = [c, -s, 0.0]
    out = []
    for i in range(1, n + 1):
        w = (1 - math.cos(2 * math.pi * i / n)) / 2.0
        pos = add(add(pos0, mul(right, spec["drift_right_m"] * w)), [0.0, 0.0, spec["drift_up_m"] * w])
        out.append(frame(pos, yaw, yaw, pitch, f"loop u={i / n:.4f}"))
    return out


def end_pose(doc):
    e = doc["end"]
    n = e["normal_out_xy"]
    c = e["o5_centre_world"]
    pos = [c[0] + e["offset_m"] * n[0], c[1] + e["offset_m"] * n[1], e["eye_z"]]
    return pos, bearing(-n[0], -n[1]), 0.0


def catmull_rom(P, alpha=0.5):
    """centripetal Catmull-Rom through points P (lists; the first 3 coords set the knot spacing); returns f(T), T in [0, n-1]"""
    ext = [add(mul(P[0], 2), mul(P[1], -1))] + P + [add(mul(P[-1], 2), mul(P[-2], -1))]

    def ev(T):
        i = min(int(T), len(P) - 2)
        u = T - i
        p0, p1, p2, p3 = ext[i], ext[i + 1], ext[i + 2], ext[i + 3]
        t0 = 0.0
        t1 = t0 + max(norm(sub(p1[:3], p0[:3])), 1e-6) ** alpha
        t2 = t1 + max(norm(sub(p2[:3], p1[:3])), 1e-6) ** alpha
        t3 = t2 + max(norm(sub(p3[:3], p2[:3])), 1e-6) ** alpha
        t = t1 + (t2 - t1) * u

        def lerp(pa, pb, ta, tb):
            return add(mul(pa, (tb - t) / (tb - ta)), mul(pb, (t - ta) / (tb - ta)))
        a1, a2, a3 = lerp(p0, p1, t0, t1), lerp(p1, p2, t1, t2), lerp(p2, p3, t2, t3)
        b1, b2 = lerp(a1, a2, t0, t2), lerp(a2, a3, t1, t3)
        return lerp(b1, b2, t1, t2)
    return ev


def seg_descend(spec, doc, orbit, n):
    pts = []
    prev_yaw = None
    for an in spec["anchors"]:
        if an.get("from") == "orbit:end":
            pos, yaw, hp = orbit_end(orbit)
        elif an.get("from") == "end":
            pos, yaw, hp = end_pose(doc)
        else:
            pos = an["pos"]
            yaw, hp = yaw_pitch(pos, an["look"]) if "look" in an else (an["yaw_deg"], an.get("hint_pitch_deg", 0.0))
        if prev_yaw is not None:
            yaw = prev_yaw + wrap180(yaw - prev_yaw)
        prev_yaw = yaw
        pts.append([float(pos[0]), float(pos[1]), float(pos[2]), yaw, hp])
    ev = catmull_rom(pts)
    M = 400 * (len(pts) - 1)
    Ts = [k * (len(pts) - 1) / M for k in range(M + 1)]
    xs = [ev(T) for T in Ts]
    cum = [0.0]
    for k in range(1, len(xs)):
        cum.append(cum[-1] + norm(sub(xs[k][:3], xs[k - 1][:3])))
    L = cum[-1]
    out = []
    j = 0
    for i in range(1, n + 1):
        s = smoothstep(i / n) * L
        while j < len(cum) - 2 and cum[j + 1] < s:
            j += 1
        span = cum[j + 1] - cum[j]
        f = 0.0 if span <= 0 else (s - cum[j]) / span
        T = Ts[j] + (Ts[j + 1] - Ts[j]) * f
        x = ev(T) if i < n else pts[-1]
        out.append(frame(x[:3], x[3], x[3], x[4], f"spline T={T:.3f}"))
    return out, L


def build_path(a):
    doc = json.load(open(a.path, encoding="utf-8"))
    names = [s["name"] for s in doc["segments"]]
    if tuple(names) != SEGMENTS:
        raise SystemExit(f"path.json segments must be {SEGMENTS} in this order, got {names}")
    srcs = resolve_sources(doc, a)
    orbit = json.load(open(srcs["orbit_camera"], encoding="utf-8"))
    segs = {}
    lengths = {}
    for spec in doc["segments"]:
        nm = spec["name"]
        if nm == "approach":
            segs[nm] = seg_approach(spec, orbit, int(spec["frames"]))
        elif nm == "orbit":
            segs[nm] = seg_orbit(orbit)
        elif nm == "hold-facade":
            segs[nm] = seg_hold(spec, orbit, int(spec["frames"]))
        else:
            segs[nm], lengths[nm] = seg_descend(spec, doc, orbit, int(spec["frames"]))
    g = 1
    for nm in SEGMENTS:
        for i, fr in enumerate(segs[nm]):
            fr["frame"], fr["global"] = i + 1, g
            g += 1
    return doc, srcs, orbit, segs


# ------------------------------------------------------------------------------------------------ camera.json (Studio form)
def camera_doc(doc, nm, frames, w, h, orbit_src):
    fps = doc["fps"]
    rows = []
    for fr in frames:
        pos, yaw = fr["pos"], fr["yaw"]
        d = [math.sin(math.radians(yaw)), math.cos(math.radians(yaw)), 0.0]
        du = wrap180(fr["hint_yaw"] - yaw)
        rows.append({
            "frame": fr["frame"], "global_frame": fr["global"], "t_s": round((fr["global"] - 1) / fps, 4), "segment": nm,
            "pos": [round(v, 4) for v in pos], "look": [round(p + 10.0 * q, 4) for p, q in zip(pos, d)],
            "look_dir": [round(v, 6) for v in d], "yaw_deg_from_plus_y_cw": round(yaw, 4), "pitch_deg": 0.0, "roll_deg": 0.0,
            "rotation_euler_deg": [90.0, 0.0, round(-yaw % 360.0, 4)],
            "projection": "equirect", "hfov_deg": 360.0, "vfov_deg": 180.0, "res": [w, h],
            "matrix_world": [[round(v, 6) for v in row] for row in level_matrix(pos, yaw)],
            "pos_glb": [round(pos[0], 4), round(pos[2], 4), round(-pos[1], 4)],
            "view_hint": {"yaw_deg_from_plus_y_cw": round(fr["hint_yaw"], 4), "pitch_deg": round(fr["hint_pitch"], 4), "hfov_deg": 65.5,
                          "u": round(0.5 + du / 360.0, 5), "v": round(0.5 - fr["hint_pitch"] / 180.0, 5)},
            "source": fr["src"]})
    return {
        "shot": f"equirect-{nm}", "schema": "habait-flyover/equirect-camera.v1", "segment": nm,
        "frame_world": "X = x_cm/100, Y = -y_cm/100, Z up, unit floor at 0 (plan-world metres; ground -51.2; north at plan bearing 304.4)",
        "camera_convention": "Blender camera, local -Z = look_dir, local +Y = up, level (pitch 0, roll 0); matrix_world = camera to world",
        "projection": "Cycles equirectangular 360x180: u 0.5 = look_dir (yaw_deg_from_plus_y_cw), u grows clockwise seen from above "
                      "(= camera right), horizon at v 0.5. view_hint = the director's framing (u, v on this equirect).",
        "files": {"rgb": "frames/frame_####.png (segment-local, 1-based = 'frame')"},
        "fps": fps, "global_range": [frames[0]["global"], frames[-1]["global"]] if frames else None,
        "orbit_source": orbit_src, "frames": rows}


# ------------------------------------------------------------------------------------------------ checks
def point_in_poly(x, y, poly):
    inside = False
    for i in range(len(poly)):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % len(poly)]
        if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
            inside = not inside
    return inside


def checks(doc, srcs, orbit, segs):
    res = []

    def ok(name, cond, detail):
        res.append((name, bool(cond), detail))
    allf = [fr for nm in SEGMENTS for fr in segs[nm]]
    # 1. seams: the jump between segments vs the steps either side
    for k in range(len(SEGMENTS) - 1):
        A, B = segs[SEGMENTS[k]], segs[SEGMENTS[k + 1]]
        jump = norm(sub(B[0]["pos"], A[-1]["pos"]))
        near = [norm(sub(A[-i]["pos"], A[-i - 1]["pos"])) for i in (1, 2)] + [norm(sub(B[i + 1]["pos"], B[i]["pos"])) for i in (0, 1)]
        dyaw = abs(wrap180(B[0]["yaw"] - A[-1]["yaw"]))
        ok(f"seam {SEGMENTS[k]}->{SEGMENTS[k + 1]}", jump <= max(3 * max(near), 0.05) and dyaw < 3.0,
           f"jump {jump:.3f} m (steps around {max(near):.3f} m), yaw jump {dyaw:.2f} deg")
    # 2. the orbit is the orbit: reused poses identical
    take = orbit_take(orbit)
    dmax = max(norm(sub(fr["pos"], t["pos"])) for fr, t in zip(segs["orbit"], take))
    ok("orbit = orbit/camera.json", len(take) == len(segs["orbit"]) and dmax < 1e-6,
       f"{len(take)} poses, frames 1..{take[-1]['frame']}, max deviation {dmax:.2e} m")
    # 3. hold loop closes on node-b
    e_pos = orbit["end_pose"]["pos"]
    ok("hold-facade loop closes at node-b", norm(sub(segs["hold-facade"][-1]["pos"], e_pos)) < 1e-6,
       f"last frame = node-b-tower {e_pos}")
    # 4. exterior nodes on the path
    if os.path.exists(srcs.get("nodes", "")):
        nd = {s["id"]: s for s in json.load(open(srcs["nodes"], encoding="utf-8"))["shots"]}
        for nid in ("node-a-aerial", "node-b-tower", "node-e-approach45", "node-f-approach25", "node-c-facade", "node-d-terrace"):
            if nid not in nd:
                continue
            k = min(range(len(allf)), key=lambda j: norm(sub(allf[j]["pos"], nd[nid]["pos"])))
            dist = norm(sub(allf[k]["pos"], nd[nid]["pos"]))
            step = max(norm(sub(allf[j + 1]["pos"], allf[j]["pos"])) for j in (max(0, k - 1), min(k, len(allf) - 2)))
            ok(f"node {nid} on the path", dist < max(1.5, 0.6 * step),
               f"nearest global frame {allf[k]['global']} ({dist:.2f} m; local step {step:.2f} m)")
    # 5. the end: 1.5 m outside o-5, floor 16, inside the 846 box and on the terrace, looking in
    end = segs["descend-846"][-1]
    e = doc["end"]
    c = e["o5_centre_world"]
    n = e["normal_out_xy"]
    off = (end["pos"][0] - c[0]) * n[0] + (end["pos"][1] - c[1]) * n[1]
    lat = abs(-(end["pos"][0] - c[0]) * n[1] + (end["pos"][1] - c[1]) * n[0])
    ok("end 1.5 m outside o-5", abs(off - 1.5) < 0.01 and lat < 0.01, f"offset {off:.3f} m on the normal, lateral {lat:.3f} m, z {end['pos'][2]}")
    # o-5 itself, from plan.json
    if os.path.exists(srcs.get("plan", "")):
        plan = json.load(open(srcs["plan"], encoding="utf-8"))
        o5 = next((o for o in plan["openings"] if o["id"] == "o-5"), None)
        if o5:
            pc = [o5["centre_cm"][0] / 100, -o5["centre_cm"][1] / 100]
            ok("o-5 matches plan.json", norm(sub(pc, c)) < 0.01 and set(o5["rooms"]) == {"r-living", "r-terrace-living"},
               f"plan o-5 centre {pc}, rooms {o5['rooms']}")
        terr = next((r for r in plan["rooms"] if r["id"] == "r-terrace-living"), None)
        if terr:
            poly = [(x / 100, -y / 100) for x, y in terr["loop"]]
            ok("end on terrace r-terrace-living", point_in_poly(end["pos"][0], end["pos"][1], poly), f"end xy {[round(v, 3) for v in end['pos'][:2]]}")
            # where the flight crosses into the terrace: above the railing, under the slab above
            fr_d = segs["descend-846"]
            cross = None
            for f0, f1 in zip(fr_d, fr_d[1:]):
                if not point_in_poly(f0["pos"][0], f0["pos"][1], poly) and point_in_poly(f1["pos"][0], f1["pos"][1], poly):
                    cross = f1
            if cross:
                z = cross["pos"][2]
                ok("terrace entry clears railing and slab", e["railing_h_m"] + 0.25 < z < e["ceiling_z"] - 0.25,
                   f"enters the terrace at frame {cross['frame']} z {z:.2f} (railing {e['railing_h_m']}, ceiling {e['ceiling_z']})")
    if os.path.exists(srcs.get("units", "")):
        u = next((x for x in json.load(open(srcs["units"], encoding="utf-8"))["units"] if x["id"] == "apt846"), None)
        if u:
            x0, y0, z0, x1, y1, z1 = u["box_world"]
            p = end["pos"]
            ok("end inside 846 box_world (floor 16)", x0 <= p[0] <= x1 and y0 <= p[1] <= y1 and z0 <= p[2] <= z1 and u["floor"] == 16,
               f"box {u['box_world']}, floor {u['floor']}")
    inward = bearing(-n[0], -n[1])
    ok("end looks in through o-5", abs(wrap180(end["yaw"] - inward)) < 0.5, f"yaw {end['yaw']:.2f} vs inward {inward:.2f}")
    return res


def speeds(frames, fps):
    st = [norm(sub(b["pos"], a["pos"])) * fps for a, b in zip(frames, frames[1:])]
    ln = sum(st) / fps
    return ln, max(st) if st else 0.0


# ------------------------------------------------------------------------------------------------ frame selection
def parse_frames(spec, segs, wanted):
    total = sum(len(segs[n]) for n in SEGMENTS)
    if not spec:
        return {n: list(range(1, len(segs[n]) + 1)) for n in wanted}
    glob_sel, loc = set(), {}
    for part in spec.split(","):
        part = part.strip()
        if not part:
            continue
        if ":" in part:
            nm, rng = part.split(":", 1)
            x, y = (rng.split("-") + [rng])[:2] if "-" in rng else (rng, rng)
            loc.setdefault(nm, set()).update(range(int(x), int(y) + 1))
        else:
            x, y = part.split("-") if "-" in part else (part, part)
            glob_sel.update(range(int(x), min(int(y), total) + 1))
    out = {}
    for n in wanted:
        sel = [fr["frame"] for fr in segs[n] if fr["global"] in glob_sel or fr["frame"] in loc.get(n, ())]
        if sel:
            out[n] = sel
    return out


def frame_path(out, nm, i, ext):
    return os.path.join(out, nm, "frames", f"frame_{i:04d}{ext}")


def exists(path):
    return os.path.exists(path) and os.path.getsize(path) >= MIN_FRAME_BYTES


# ------------------------------------------------------------------------------------------------ Blender side
def blender_camera(scene):
    cd = bpy.data.cameras.new("EQ_cam")
    cd.type = "PANO"
    try:
        cd.panorama_type = "EQUIRECTANGULAR"
        where = "camera.panorama_type"
    except (AttributeError, TypeError):
        cd.cycles.panorama_type = "EQUIRECTANGULAR"
        where = "camera.cycles.panorama_type"
    for k, v in (("latitude_min", -math.pi / 2), ("latitude_max", math.pi / 2), ("longitude_min", -math.pi), ("longitude_max", math.pi)):
        try:
            setattr(cd, k, v)
        except AttributeError:
            pass
    cd.clip_start = 0.1
    cd.clip_end = 120000.0
    cam = bpy.data.objects.new("EQ_cam", cd)
    scene.collection.objects.link(cam)
    scene.camera = cam
    return cam, where


def setup_cycles(scene, a, w, h, log_d):
    scene.render.engine = "CYCLES"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    used = None
    order = ["OPTIX", "CUDA"] if a.device == "auto" else ([] if a.device == "CPU" else [a.device])
    for kind in order:
        try:
            prefs.compute_device_type = kind
            prefs.get_devices()
        except Exception as e:  # noqa: BLE001
            print("[dev] no", kind, e, flush=True)
            continue
        devs = [d for d in prefs.devices if d.type == kind]
        for d in prefs.devices:
            d.use = d.type == kind
        if devs:
            used = kind
            log_d["devices"] = [d.name for d in devs]
            break
    scene.cycles.device = "GPU" if used else "CPU"
    log_d["compute"] = used or "CPU"
    print("[dev]", log_d["compute"], log_d.get("devices"), flush=True)
    r = scene.render
    r.resolution_x, r.resolution_y, r.resolution_percentage = w, h, 100
    r.image_settings.file_format = a.fmt
    r.image_settings.color_mode = "RGB"
    if a.fmt == "JPEG":
        r.image_settings.quality = 95
    r.film_transparent = False
    r.use_persistent_data = True
    r.fps = 24
    c = scene.cycles
    c.samples = a.samples
    c.use_adaptive_sampling = True
    c.adaptive_threshold = 0.02
    c.use_denoising = True
    c.denoiser, c.denoising_use_gpu = "OPENIMAGEDENOISE", bool(used)
    log_d["denoiser"] = [c.denoiser, c.denoising_use_gpu]
    c.max_bounces = 6
    c.transparent_max_bounces = 8
    c.caustics_reflective = c.caustics_refractive = False
    scene.view_settings.view_transform = "AgX"
    try:
        scene.view_settings.look = "AgX - Punchy"  # as orbit_clay.configure
    except Exception:  # noqa: BLE001
        pass
    scene.view_settings.exposure = a.exposure


def render_still(scene, log_d):
    try:
        bpy.ops.render.render(write_still=True)
    except RuntimeError as e:
        if "denois" not in str(e).lower() or not scene.cycles.denoising_use_gpu:
            raise
        scene.cycles.denoising_use_gpu = False
        log_d["denoiser"] = [scene.cycles.denoiser, False]
        print("[denoise] fallback to OIDN on CPU", flush=True)
        bpy.ops.render.render(write_still=True)


def load_orbit_clay(path):
    """habait-ab's orbit_clay.py, read-only: its trailing main() call is dropped, its builders are reused"""
    lines = open(path, encoding="utf-8").read().rstrip().splitlines()
    if not lines or lines[-1].strip() != "main()":
        raise SystemExit(f"{path}: expected a trailing main() call; the builder layout changed, ask habait-ab")
    ns = {"__file__": os.path.abspath(path), "__name__": "orbit_clay_lib"}
    exec(compile("\n".join(lines[:-1]) + "\n", path, "exec"), ns)
    return ns


def build_glb_scene(a, log_d):
    if not os.path.exists(a.orbit_clay):
        raise SystemExit(f"--glb needs habait-ab's builder {a.orbit_clay} (pass --orbit-clay)")
    ns = load_orbit_clay(a.orbit_clay)
    hdri = a.hdri or ns["DEF_HDRI"]
    if not os.path.exists(hdri):
        raise SystemExit(f"HDRI missing: {hdri} (Kaggle: download qwantani_noon_puresky_4k.hdr from Poly Haven, pass --hdri)")
    nodes_path = a.nodes_json or ns["DEF_NODES"]
    nodes_doc = json.load(open(nodes_path, encoding="utf-8")) if os.path.exists(nodes_path) else {}
    sb = ns["DEF_SCENE_BLEND"] if a.scene_blend is None else a.scene_blend
    ba = types.SimpleNamespace(glb=a.glb, far_ortho=not a.no_far_ortho, hdri=hdri, scene_blend=sb, unit_light_shadows=False)
    t0 = time.time()
    ns["build_scene"](ba, nodes_doc)
    log_d["import_s"] = round(time.time() - t0, 2)
    log_d["scene"] = {"builder": a.orbit_clay, "glb": a.glb, "hdri": hdri, "far_ortho": ba.far_ortho, "scene_blend": sb}


def probe_orientation(a):
    """ONE 512x256 frame of a toy scene: four emissive cubes around a level equirect camera; checks u = 0.5 + dyaw/360"""
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    scene = bpy.context.scene
    world = bpy.data.worlds.new("probe")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.0
    scene.world = world
    yaw = 30.0
    marks = {"red": (0.0, (1, 0, 0)), "green": (90.0, (0, 1, 0)), "blue": (180.0, (0, 0, 1)), "yellow": (-90.0, (1, 1, 0))}
    for name, (dy, col) in marks.items():
        b = math.radians(yaw + dy)
        bpy.ops.mesh.primitive_cube_add(size=2.0, location=(10 * math.sin(b), 10 * math.cos(b), 0.0))
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        nt = m.node_tree
        em = nt.nodes.new("ShaderNodeEmission")
        em.inputs["Color"].default_value = (*col, 1.0)
        nt.links.new(em.outputs["Emission"], nt.nodes["Material Output"].inputs["Surface"])
        bpy.context.object.data.materials.append(m)
    cam, where = blender_camera(scene)
    from mathutils import Matrix
    cam.matrix_world = Matrix(level_matrix([0.0, 0.0, 0.0], yaw))
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 4
    scene.cycles.use_denoising = False
    scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = 512, 256, 100
    scene.view_settings.view_transform = "Standard"
    scene.render.image_settings.file_format = "PNG"
    os.makedirs(os.path.dirname(a.probe_orientation), exist_ok=True)
    scene.render.filepath = a.probe_orientation
    t0 = time.time()
    bpy.ops.render.render(write_still=True)
    dt = time.time() - t0
    img = bpy.data.images.load(a.probe_orientation)
    W, H = img.size
    px = img.pixels[:]
    acc = {k: [0.0, 0.0, 0] for k in marks}  # circular mean of u
    for y in range(H):
        for x in range(W):
            i = 4 * (y * W + x)
            r, g, bb = px[i], px[i + 1], px[i + 2]
            k = None
            if r > 0.5 and g > 0.5 and bb < 0.3:
                k = "yellow"
            elif r > 0.5 and g < 0.3 and bb < 0.3:
                k = "red"
            elif g > 0.5 and r < 0.3 and bb < 0.3:
                k = "green"
            elif bb > 0.5 and r < 0.3 and g < 0.3:
                k = "blue"
            if k:
                th = 2 * math.pi * (x + 0.5) / W
                acc[k][0] += math.cos(th)
                acc[k][1] += math.sin(th)
                acc[k][2] += 1
    ok_all = True
    for k, (dy, _) in marks.items():
        c, s, n = acc[k]
        u = (math.atan2(s, c) / (2 * math.pi)) % 1.0 if n else float("nan")
        want = (0.5 + dy / 360.0) % 1.0
        err = abs(((u - want + 0.5) % 1.0) - 0.5) if n else 1.0
        good = n > 20 and err < 0.02
        ok_all &= good
        print(f"[probe] {k:6s} bearing yaw{dy:+.0f}: u {u:.3f} want {want:.3f} ({n} px) {'OK' if good else 'FAIL'}", flush=True)
    print(f"[probe] equirect via {where}; {W}x{H} in {dt:.1f}s; orientation {'PASS' if ok_all else 'FAIL'}", flush=True)
    return ok_all


# ------------------------------------------------------------------------------------------------ main
def main():
    a = parse_args()
    if a.probe_orientation:
        if bpy is None:
            raise SystemExit("--probe-orientation runs inside Blender")
        sys.exit(0 if probe_orientation(a) else 1)
    doc, srcs, orbit, segs = build_path(a)
    w, h = [int(v) for v in a.res.lower().split("x")]
    if w != 2 * h:
        log(f"WARNING: equirect wants 2:1, got {w}x{h}")
    wanted = [n for n in a.segments.split(",") if n]
    bad = [n for n in wanted if n not in SEGMENTS]
    if bad:
        raise SystemExit(f"unknown segments {bad}; fixed names: {SEGMENTS}")
    sel = parse_frames(a.frames, segs, wanted)
    ext = ".png" if a.fmt == "PNG" else ".jpg"
    fps = doc["fps"]

    # the table
    total = sum(len(segs[n]) for n in SEGMENTS)
    log(f"path {a.path}; orbit poses from {srcs['orbit_camera']}; out {a.out}")
    print(f"{'segment':<13}{'global':>11}{'frames':>8}{'sec':>7}{'exist':>7}{'todo':>6}{'len m':>9}{'max m/s':>9}  start -> end", flush=True)
    for n in SEGMENTS:
        fr = segs[n]
        have = sum(1 for f in fr if exists(frame_path(a.out, n, f["frame"], ext)))
        todo = sum(1 for i in sel.get(n, []) if a.force or not exists(frame_path(a.out, n, i, ext)))
        ln, vmax = speeds(fr, fps)
        s0, s1 = [round(v, 1) for v in fr[0]["pos"]], [round(v, 2) for v in fr[-1]["pos"]]
        print(f"{n:<13}{fr[0]['global']:>5}-{fr[-1]['global']:<5}{len(fr):>8}{len(fr) / fps:>7.2f}{have:>7}{todo:>6}{ln:>9.1f}{vmax:>9.1f}  {s0} -> {s1}",
              flush=True)
    print(f"{'total':<13}{'':>11}{total:>8}{total / fps:>7.2f}   @ {fps} fps, {w}x{h} equirect", flush=True)
    res = checks(doc, srcs, orbit, segs)
    for name, good, detail in res:
        print(f"  [{'PASS' if good else 'FAIL'}] {name}: {detail}", flush=True)
    nfail = sum(1 for _, g, _ in res if not g)
    print(f"checks: {len(res) - nfail}/{len(res)} pass", flush=True)
    if a.selftest:
        sys.exit(1 if nfail else 0)
    if bpy is not None and a.dry_run:
        scene = bpy.context.scene
        cam, where = blender_camera(scene)
        log(f"Blender {bpy.app.version_string}: equirect camera OK via {where} (not rendered); open file: {bpy.data.filepath or '(none)'}")
        bpy.data.objects.remove(cam, do_unlink=True)
    if a.dry_run:
        return
    if nfail:
        raise SystemExit("path checks failed; fix path.json before writing camera.json")

    # camera.json per segment (every frame of the segment)
    for n in wanted:
        os.makedirs(os.path.join(a.out, n, "frames"), exist_ok=True)
        cdoc = camera_doc(doc, n, segs[n], w, h, srcs["orbit_camera"] if n == "orbit" else None)
        json.dump(cdoc, open(os.path.join(a.out, n, "camera.json"), "w", encoding="utf-8"), indent=1)
        log(f"{n}/camera.json: {len(segs[n])} frames")
    if a.plan_only:
        return
    if bpy is None:
        raise SystemExit("rendering runs inside Blender (or use --dry-run / --plan-only)")

    t_all = time.time()
    log_d = {"args": {k: v for k, v in vars(a).items()}, "res": [w, h], "samples": a.samples}
    if a.glb:
        build_glb_scene(a, log_d)
    elif not bpy.data.filepath:
        raise SystemExit("no scene: open a .blend (blender -b scene.blend ...) or pass --glb site.glb")
    scene = bpy.context.scene
    setup_cycles(scene, a, w, h, log_d)
    cam, where = blender_camera(scene)
    log_d["camera"] = where
    from mathutils import Matrix
    times = []
    for n in wanted:
        byf = {f["frame"]: f for f in segs[n]}
        for i in sel.get(n, []):
            dst = frame_path(a.out, n, i, ext)
            if exists(dst) and not a.force:
                continue
            fr = byf[i]
            cam.matrix_world = Matrix(level_matrix(fr["pos"], fr["yaw"]))
            bpy.context.view_layer.update()
            scene.frame_set(fr["global"])
            tmp = dst[: -len(ext)] + "_tmp" + ext
            scene.render.filepath = tmp
            t0 = time.time()
            render_still(scene, log_d)
            os.replace(tmp, dst)
            dt = time.time() - t0
            times.append({"segment": n, "frame": i, "global": fr["global"], "s": round(dt, 2)})
            print(f"[frame] {n} {i} (global {fr['global']}) {dt:.2f}s", flush=True)
    log_d["frames"] = times
    if times:
        steady = [x["s"] for x in times[1:]] or [times[0]["s"]]
        log_d["first_frame_s"] = times[0]["s"]
        log_d["steady_s_per_frame"] = round(sum(steady) / len(steady), 2)
    log_d["exposure"] = a.exposure
    log_d["total_s"] = round(time.time() - t_all, 1)
    os.makedirs(a.out, exist_ok=True)
    json.dump(log_d, open(os.path.join(a.out, "render_log.json"), "w", encoding="utf-8"), indent=1, default=str)
    print("[done]", json.dumps({k: log_d.get(k) for k in ("compute", "denoiser", "steady_s_per_frame", "total_s")}), flush=True)


main()
