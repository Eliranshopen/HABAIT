"""batch_units.py - every unit of the tower: descend-<unit> (+ enter-846) rendered on the free Kaggle farm, deduplicated,
queued and resumable (card 22, lane C6b, 2026-11-02). $0.

Dedup: units are grouped by (type, facade azimuth, plan footprint); one descend path per group (path.json
"descend_template"), offset in height per floor (dz = (floor - 16) * 3.2 = box_world z0). The base is descend-846 itself:
the template at (type L, floor 16) reproduces its 120 poses (checked on every run). Every descend starts at the hold pose
(node-b-tower) and ends 1.5 m outside the unit's living opening at eye height, looking in:
  * traced (type L, apt846's own footprint: 826/836/846/856/866): the real o-5 of 846's plan, + dz;
  * stacked-approx (K/M/PH, units-stacked.json: footprints and openings unknown until their plans are traced): the facade
    is the floor-plate edge hit first by a ray from the box centre along that edge's outward normal, the opening is the
    foot point, the anchors of descend-846 are re-placed in that end frame (rotation about z + translation).
enter-<type> exists only for 846 (it needs the apartment's panoramas; card 20's packed scene).

Queue (T0, card 22 brief): descend-846 -> enter-846 (1024x512, 16 spp, card 20's scene) -> tail-846 (descend-846 frames
97-120 on the same enter scene, so the descend->enter seam can match) -> descend-836, descend-856 (type L, other floors)
-> the rest (L, K, M, PH; nearest floor first). --limit N = N jobs in ONE Kaggle GPU session. A frame on disk at the job's
resolution (PNG IHDR) and >= 2 KB is done; a job is re-sent with only its missing frames (a failed or cut session resumes
from what landed). The progress file is rewritten after every pull.

  python batch_units.py --units <units.json> --dry-run                 dedup + paths + checks + the queue; writes nothing
  python batch_units.py --units <units.json> --plan-only               + camera.json per descend-<unit>
  python batch_units.py --units <units.json> --run --limit 5           one Kaggle session with the next 5 jobs
  python batch_units.py --units <units.json> --run --limit 5 --stage   build the kernel + datasets, no network
  python batch_units.py --units <units.json> --rescan                  progress file from what is on disk
  python batch_units.py --selftest                                     dedup / template / queue / resume with a fake runner

Outputs: Habait/flyover/equirect/_local/segments/descend-<unit>/{camera.json, frames/frame_####.png},
enter-846/frames/, descend-846/tail-enter-scene/frames/; progress Habait/flyover/batch/_local/batch-progress.json.
Exit: 0 ok; 1 a path check failed or the Kaggle session did not complete; 2 bad usage.
"""
import argparse
import binascii
import copy
import datetime as dt
import json
import math
import os
import shutil
import sys
import tarfile
import tempfile
import time
import types
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))
FLY = os.path.dirname(HERE)
REPO = os.path.dirname(os.path.dirname(FLY))
PATH_JSON = os.path.join(FLY, "equirect", "path.json")
RS_PATH = os.path.join(FLY, "equirect", "render_segments.py")
RENDER_CAMERAS = os.path.join(HERE, "render_cameras.py")
ENTER_PY = os.path.join(FLY, "enter.py")
ENTER_BLEND = os.path.join(FLY, "enter", "_local", "enter846.packed.blend")
SCENE_BLEND = os.path.join(REPO, "Habait", "studio", "_local", "projects", "apt846-rainbow-tlv", "renders", "scene.blend")
RAINBOW = os.path.join(REPO, "Habait", "engine", "_local", "rainbow")
DEF_UNITS = os.path.join(RAINBOW, "units.json")
SEG_OUT = os.path.join(FLY, "equirect", "_local", "segments")
LOCAL = os.path.join(HERE, "_local")
PROGRESS = os.path.join(LOCAL, "batch-progress.json")
KAGGLE_DIR = os.path.join(FLY, "kaggle")
MIN_FRAME_BYTES = 2048
CARD18_SPF_2K = 4.15        # card 18: approach 1-48 @2048x1024 128 spp, OptiX on 2x T4
BASE_NEEDED = ["site.glb", "nodes.json", "orbit_clay.py", "qwantani_noon_puresky_4k.hdr", "orthophoto-far.png",
               "orthophoto-far.png.json"]
TYPE_ORDER = {"L": 0, "K": 1, "M": 2, "PH": 3}


def say(msg):
    print(f"[batch] {msg}", flush=True)


def now():
    return dt.datetime.now().isoformat(timespec="seconds")


def rel(p):
    return os.path.relpath(p, REPO).replace("\\", "/")


# ------------------------------------------------------------------------------------------------ helpers (card 17, read-only)
def load_rs(path=RS_PATH):
    lines = open(path, encoding="utf-8").read().rstrip().splitlines()
    if not lines or lines[-1].strip() != "main()":
        raise SystemExit(f"{path}: expected a trailing main() call; the layout changed")
    ns = {"__file__": os.path.abspath(path), "__name__": "render_segments_lib"}
    exec(compile("\n".join(lines[:-1]) + "\n", path, "exec"), ns)
    return ns


def bearing(dx, dy):
    return math.degrees(math.atan2(dx, dy)) % 360.0


def wrap180(x):
    return (x + 180.0) % 360.0 - 180.0


def label(uid):
    return uid[3:] if uid.startswith("apt") else uid


# ------------------------------------------------------------------------------------------------ floor plate + facades
def plate_world(geom):
    """building.plate_en (site ENU m) -> plan-world m (the same inversion as Habait/engine/stack_units.plate_from_geometry)"""
    fr, pe = geom.get("frame") or {}, (geom.get("building") or {}).get("plate_en")
    if not pe:
        return None
    t = math.radians(fr["north_deg"])
    c, s = math.cos(t), math.sin(t)
    ox, oy = fr["origin_plan_cm"][0] / 100.0, -fr["origin_plan_cm"][1] / 100.0
    P = [(c * e + s * n + ox, -s * e + c * n + oy) for e, n in pe]
    if P[0] == P[-1]:
        P = P[:-1]
    return P


def signed_area(P):
    return 0.5 * sum(P[i][0] * P[(i + 1) % len(P)][1] - P[(i + 1) % len(P)][0] * P[i][1] for i in range(len(P)))


def edges(P):
    sgn = 1.0 if signed_area(P) > 0 else -1.0
    out = []
    for i in range(len(P)):
        a, b = P[i], P[(i + 1) % len(P)]
        dx, dy = b[0] - a[0], b[1] - a[1]
        L = math.hypot(dx, dy)
        n = (sgn * dy / L, -sgn * dx / L)            # outward for a CCW polygon: the right-hand normal
        out.append({"i": i, "a": a, "b": b, "len": L, "n": n})
    return out


def inside(P, x, y):
    ins = False
    for i in range(len(P)):
        x1, y1 = P[i]
        x2, y2 = P[(i + 1) % len(P)]
        if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
            ins = not ins
    return ins


def dist_to_boundary(P, x, y):
    best = 1e18
    for e in edges(P):
        ax, ay = e["a"]
        bx, by = e["b"]
        vx, vy = bx - ax, by - ay
        t = max(0.0, min(1.0, ((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy)))
        best = min(best, math.hypot(x - ax - t * vx, y - ay - t * vy))
    return best


def ray_hits(P, c, d):
    """distances along the ray c + s d (s > 0) where it crosses the polygon boundary"""
    hits = []
    for e in edges(P):
        ax, ay = e["a"]
        bx, by = e["b"]
        ex, ey = bx - ax, by - ay
        den = d[0] * ey - d[1] * ex
        if abs(den) < 1e-12:
            continue
        s = ((ax - c[0]) * ey - (ay - c[1]) * ex) / den
        t = ((ax - c[0]) * d[1] - (ay - c[1]) * d[0]) / den
        if s > 1e-9 and -1e-9 <= t <= 1 + 1e-9:
            hits.append((s, e["i"]))
    return sorted(hits)


def facade_from_centre(P, c):
    """the plate edge hit first by a ray from c along that edge's own outward normal (shortest such hit)"""
    best = None
    for e in edges(P):
        n = e["n"]
        hits = ray_hits(P, c, n)
        if not hits or hits[0][1] != e["i"]:
            continue
        s = hits[0][0]
        if best is None or s < best["s"]:
            best = {"edge": e["i"], "n": n, "s": s, "foot": (c[0] + s * n[0], c[1] + s * n[1]), "edge_len": e["len"]}
    return best


# ------------------------------------------------------------------------------------------------ context
def load_ctx(units_path, path_json=PATH_JSON, rs=None):
    rs = rs or load_rs()
    a = types.SimpleNamespace(path=os.path.abspath(path_json), orbit_camera="", repo="")
    doc, srcs, orbit, segs = rs["build_path"](a)
    tmpl = doc.get("descend_template")
    if not tmpl:
        raise SystemExit(f"{path_json}: no descend_template (card 22 adds it)")
    units_doc = json.load(open(units_path, encoding="utf-8"))
    units = units_doc["units"]
    geom_p = os.path.join(os.path.dirname(os.path.abspath(units_path)), "units-geometry.json")
    if not os.path.exists(geom_p):
        geom_p = os.path.join(RAINBOW, "units-geometry.json")
    plate = plate_world(json.load(open(geom_p, encoding="utf-8")))
    if not plate:
        raise SystemExit(f"{geom_p}: no building.plate_en")
    north = float(doc.get("north_plan_bearing_deg", 304.4))
    base = next(u for u in units if u["id"] == tmpl["base_unit"])
    return {"rs": rs, "doc": doc, "srcs": srcs, "orbit": orbit, "segs": segs, "tmpl": tmpl, "units": units,
            "units_path": os.path.abspath(units_path), "plate": plate, "plate_src": geom_p, "north": north, "base": base}


def footprint(u):
    b = u["box_world"]
    return tuple(round(round(v / 0.05) * 0.05, 2) for v in (b[0], b[1], b[3], b[4]))


def unit_facade(ctx, u):
    """(rule, n_out (plan xy), end xy at the base floor, facade true bearing, detail)"""
    tm, e = ctx["tmpl"], ctx["doc"]["end"]
    base = ctx["base"]
    if u["type"] == base["type"] and footprint(u) == footprint(base):
        n = e["normal_out_xy"]
        c = e["o5_centre_world"]
        end = (c[0] + e["offset_m"] * n[0], c[1] + e["offset_m"] * n[1])
        return {"rule": "traced", "n": tuple(n), "end_xy": end, "opening": tuple(c), "edge": None,
                "true_deg": round((bearing(n[0], n[1]) - ctx["north"]) % 360.0, 2),
                "detail": f"o-5 of {base['id']} (plan.json), 1.5 m out on the living terrace"}
    b = u["box_world"]
    cen = ((b[0] + b[3]) / 2.0, (b[1] + b[4]) / 2.0)
    f = facade_from_centre(ctx["plate"], cen)
    if not f:
        raise SystemExit(f"unit {u['id']}: no plate edge in front of its box centre {cen}")
    n = f["n"]
    off = float(tm.get("offset_m", 1.5))
    end = (f["foot"][0] + off * n[0], f["foot"][1] + off * n[1])
    return {"rule": "stacked-approx", "n": n, "end_xy": end, "opening": f["foot"], "edge": f["edge"],
            "true_deg": round((bearing(n[0], n[1]) - ctx["north"]) % 360.0, 2),
            "detail": f"plate edge {f['edge']} ({f['edge_len']:.1f} m) {f['s']:.2f} m from the box centre"}


def group_units(ctx):
    groups = {}
    for u in ctx["units"]:
        fc = unit_facade(ctx, u)
        key = (u["type"], round(fc["true_deg"] * 2) / 2.0, footprint(u))
        g = groups.setdefault(key, {"key": key, "type": u["type"], "facade": fc, "units": []})
        g["units"].append(u)
    out = sorted(groups.values(), key=lambda g: (TYPE_ORDER.get(g["type"], 9), g["key"][1], g["key"][2]))
    for g in out:
        g["units"].sort(key=lambda u: (abs(u["floor"] - ctx["tmpl"]["base_floor"]), u["floor"]))
        g["id"] = f"{g['type']}@{g['key'][1]:g}"
    ids = [g["id"] for g in out]
    for g in out:  # same type and azimuth but another footprint: keep the ids apart
        if ids.count(g["id"]) > 1:
            g["id"] += f"#{out.index(g)}"
    return out


# ------------------------------------------------------------------------------------------------ the template
def group_spec(ctx, g, dz):
    """descend-846's anchors re-placed in the group's end frame, + dz (the start, node-b-tower, is never moved)"""
    doc, tm = ctx["doc"], ctx["tmpl"]
    base_spec = next(s for s in doc["segments"] if s["name"] == tm["base_segment"])
    e = doc["end"]
    n0 = e["normal_out_xy"]
    c0 = e["o5_centre_world"]
    E0 = (c0[0] + e["offset_m"] * n0[0], c0[1] + e["offset_m"] * n0[1])
    fc = g["facade"]
    nT, ET = fc["n"], fc["end_xy"]
    th = math.atan2(nT[1], nT[0]) - math.atan2(n0[1], n0[0])
    cs, sn = math.cos(th), math.sin(th)

    def T(p):
        dx, dy = p[0] - E0[0], p[1] - E0[1]
        return [ET[0] + cs * dx - sn * dy, ET[1] + sn * dx + cs * dy, p[2] + dz]
    anchors = []
    for an in base_spec["anchors"]:
        if an.get("from") == "orbit:end":
            anchors.append(dict(an))
        elif an.get("from") == "end":
            anchors.append({"id": an["id"], "pos": [ET[0], ET[1], float(e["eye_z"]) + dz],
                            "yaw_deg": bearing(-nT[0], -nT[1]), "hint_pitch_deg": 0.0})
        else:
            anchors.append({"id": an["id"], "pos": T(an["pos"]), "look": T(an["look"])})
    spec = dict(base_spec)
    spec["anchors"] = anchors
    spec["frames"] = int(tm.get("frames", base_spec["frames"]))
    return spec, th


def unit_frames(ctx, g, u):
    rs = ctx["rs"]
    dz = (u["floor"] - ctx["tmpl"]["base_floor"]) * ctx["tmpl"]["floor_to_floor_m"]
    spec, th = group_spec(ctx, g, dz)
    frames, length = rs["seg_descend"](spec, ctx["doc"], ctx["orbit"], spec["frames"])
    g0 = ctx["segs"][ctx["tmpl"]["base_segment"]][0]["global"]
    for i, fr in enumerate(frames):
        fr["frame"], fr["global"] = i + 1, g0 + i
    return frames, length, dz, spec


# ------------------------------------------------------------------------------------------------ checks
def check_unit(ctx, g, u, frames, dz):
    res = []

    def ok(name, cond, detail):
        res.append((name, bool(cond), detail))
    P = ctx["plate"]
    tm = ctx["tmpl"]
    fc = g["facade"]
    b = u["box_world"]
    ok("dz = box_world z0", abs(dz - b[2]) < 0.01, f"dz {dz:.2f} (floor {u['floor']}), box z0 {b[2]}")
    end = frames[-1]
    eye = float(ctx["doc"]["end"]["eye_z"]) + dz
    inward = bearing(-fc["n"][0], -fc["n"][1])
    ok("end at eye height, looking in", abs(end["pos"][2] - eye) < 1e-6 and abs(wrap180(end["yaw"] - inward)) < 0.5,
       f"z {end['pos'][2]:.2f} (eye {eye:.2f}), yaw {end['yaw'] % 360:.2f} vs inward {inward:.2f}")
    near = max(b[0] - end["pos"][0], end["pos"][0] - b[3], b[1] - end["pos"][1], end["pos"][1] - b[4], 0.0)
    ok("end at the unit (plan box + 2 m, its floor)", near <= 2.0 and b[2] <= end["pos"][2] <= b[5],
       f"{near:.2f} m outside the plan box; z {end['pos'][2]:.2f} in [{b[2]}, {b[5]}]")
    # the start: one step from node-b-tower, as descend-846
    nb = ctx["orbit"]["end_pose"]["pos"]
    j = math.dist(frames[0]["pos"], nb)
    st = max(math.dist(frames[k]["pos"], frames[k + 1]["pos"]) for k in range(3))
    ok("starts at node-b-tower (hold pose)", j <= max(3 * st, 0.05), f"first step {j:.3f} m (next steps {st:.3f} m)")
    # clearance from the tower: inside the plate only on the traced terrace at the very end
    ins = [k for k, f in enumerate(frames) if inside(P, f["pos"][0], f["pos"][1]) and f["pos"][2] < 79.8]
    if fc["rule"] == "traced":
        depth = max((dist_to_boundary(P, frames[k]["pos"][0], frames[k]["pos"][1]) for k in ins), default=0.0)
        first = ins[0] + 1 if ins else None
        tail_ok = not ins or (ins == list(range(ins[0], len(frames))) and ins[0] >= int(0.85 * len(frames)))
        ok("inside the plate only on the terrace, at the end", tail_ok and depth <= 2.0,
           f"{len(ins)} frames inside from frame {first}, at most {depth:.2f} m in from the plate edge")
        if ins:
            zr = frames[ins[0]]["pos"][2] - dz
            e = ctx["doc"]["end"]
            ok("terrace entry clears railing and slab", e["railing_h_m"] + 0.25 < zr < e["ceiling_z"] - 0.25,
               f"enters at frame {ins[0] + 1}, {zr:.2f} m above the floor (railing {e['railing_h_m']}, ceiling {e['ceiling_z']})")
    else:
        dmin = min(dist_to_boundary(P, f["pos"][0], f["pos"][1]) for f in frames)
        ok("never inside the tower plate", not ins and dmin >= float(tm.get("offset_m", 1.5)) - 0.15,
           f"{len(ins)} frames inside; closest approach {dmin:.2f} m from the plate edge")
    ok("above ground", min(f["pos"][2] for f in frames) > -51.2 + 2.0, f"lowest z {min(f['pos'][2] for f in frames):.2f}")
    return res


def check_base_identity(ctx, groups):
    """the template at (base type, base floor) == path.json's descend-846 (render_segments.build_path)"""
    base = ctx["base"]
    g = next(g for g in groups if any(u["id"] == base["id"] for u in g["units"]))
    frames, _, _, _ = unit_frames(ctx, g, base)
    ref = ctx["segs"][ctx["tmpl"]["base_segment"]]
    dp = max(math.dist(a["pos"], b["pos"]) for a, b in zip(frames, ref))
    dy = max(abs(wrap180(a["yaw"] - b["yaw"])) for a, b in zip(frames, ref))
    dg = max(abs(a["global"] - b["global"]) for a, b in zip(frames, ref))
    return (f"template({g['id']}, floor {base['floor']}) = {ctx['tmpl']['base_segment']}",
            len(frames) == len(ref) and dp < 1e-6 and dy < 1e-6 and dg == 0,
            f"{len(frames)} vs {len(ref)} poses, max deviation {dp:.1e} m / {dy:.1e} deg, globals {ref[0]['global']}-{ref[-1]['global']}")


def check_dedup(ctx, groups):
    res = []
    n_units = sum(len(g["units"]) for g in groups)
    ff = ctx["tmpl"]["floor_to_floor_m"]
    for g in groups:
        types_ = {u["type"] for u in g["units"]}
        fps = {footprint(u) for u in g["units"]}
        az = {round(unit_facade(ctx, u)["true_deg"] * 2) / 2.0 for u in g["units"]}
        zs = [u["box_world"][2] for u in g["units"]]
        z_ok = all(abs(z / ff - round(z / ff)) < 0.01 for z in zs)
        res.append((f"group {g['id']} is one path", len(types_) == 1 and len(fps) == 1 and len(az) == 1 and z_ok,
                    f"types {sorted(types_)}, azimuths {sorted(az)}, footprints {len(fps)}, floors "
                    f"{[u['floor'] for u in g['units']]} (z0 on the {ff} m pitch: {z_ok})"))
    # never merged across azimuths: two groups of one type differ in azimuth or footprint, by key
    keys = [g["key"] for g in groups]
    res.append(("no two groups share a key", len(set(keys)) == len(keys), f"{len(keys)} keys"))
    res.append(("every unit in exactly one group", n_units == len(ctx["units"]) and
                len({u["id"] for g in groups for u in g["units"]}) == len(ctx["units"]), f"{n_units} of {len(ctx['units'])}"))
    return res


# ------------------------------------------------------------------------------------------------ jobs + disk state
def png_size(path):
    try:
        with open(path, "rb") as f:
            head = f.read(24)
        if head[:8] != b"\x89PNG\r\n\x1a\n":
            return None
        return int.from_bytes(head[16:20], "big"), int.from_bytes(head[20:24], "big")
    except OSError:
        return None


def frames_status(fdir, frames, res):
    w, h = [int(v) for v in res.split("x")]
    have, wrong = [], []
    for i in frames:
        p = os.path.join(fdir, f"frame_{i:04d}.png")
        if os.path.exists(p) and os.path.getsize(p) >= MIN_FRAME_BYTES:
            if png_size(p) == (w, h):
                have.append(i)
            else:
                wrong.append(i)
    return have, wrong


def ranges(nums):
    nums = sorted(set(nums))
    out = []
    for k in nums:
        if out and k == out[-1][1] + 1:
            out[-1][1] = k
        else:
            out.append([k, k])
    return ",".join(f"{a}-{b}" if a != b else f"{a}" for a, b in out)


def build_jobs(ctx, groups, a, root, apply_only=True):
    """the queue, in order; every job carries its disk state (--only filters it unless apply_only is False)"""
    base = ctx["base"]
    bl = label(base["id"])
    units = {u["id"]: (g, u) for g in groups for u in g["units"]}
    n_desc = int(ctx["tmpl"]["frames"])
    jobs = []

    def desc(uid):
        g, u = units[uid]
        lb = label(uid)
        return {"id": f"descend-{lb}", "kind": "descend", "unit": uid, "label": lb, "floor": u["floor"], "type": u["type"],
                "group": g["id"], "scene": "site.glb clay (orbit_clay.build_scene) + 846 ceiling lights (scene.blend)",
                "script": "render_cameras.py", "res": a.res, "samples": a.samples, "frames": list(range(1, n_desc + 1)),
                "camera_json": os.path.join(root, f"descend-{lb}", "camera.json"),
                "frames_dir": os.path.join(root, f"descend-{lb}", "frames")}
    jobs.append(desc(base["id"]))
    enter_cam = os.path.join(SEG_OUT, f"enter-{bl}", "camera.json")
    n_enter = len(json.load(open(enter_cam, encoding="utf-8"))["frames"]) if os.path.exists(enter_cam) else 96
    jobs.append({"id": f"enter-{bl}", "kind": "enter", "unit": base["id"], "label": bl, "floor": base["floor"], "type": base["type"],
                 "group": None, "scene": "enter846.packed.blend (card 20)", "script": "enter.py", "res": a.enter_res,
                 "samples": a.enter_samples, "frames": list(range(1, n_enter + 1)), "camera_json": enter_cam,
                 "frames_dir": os.path.join(root, f"enter-{bl}", "frames")})
    jobs.append({"id": f"tail-{bl}", "kind": "tail", "unit": base["id"], "label": bl, "floor": base["floor"], "type": base["type"],
                 "group": None, "scene": "enter846.packed.blend (card 20)", "script": "enter.py", "res": a.enter_res,
                 "samples": a.enter_samples, "frames": list(range(n_desc - 23, n_desc + 1)),
                 "camera_json": os.path.join(root, f"descend-{bl}", "camera.json"),
                 "frames_dir": os.path.join(root, f"descend-{bl}", "tail-enter-scene", "frames")})
    bg = units[base["id"]][0]
    same = [u for u in bg["units"] if u["id"] != base["id"]]          # nearest floor first (group order)
    nxt = [u["id"] for u in same[:2]]
    for uid in nxt:
        jobs.append(desc(uid))
    rest = [u["id"] for g in groups for u in g["units"] if u["id"] != base["id"] and u["id"] not in nxt]
    for uid in rest:
        jobs.append(desc(uid))
    if a.only and apply_only:
        want = {x.strip() for x in a.only.split(",") if x.strip()}
        jobs = [j for j in jobs if j["label"] in want or j["unit"] in want or j["id"] in want]
    for j in jobs:
        have, wrong = frames_status(j["frames_dir"], j["frames"], j["res"])
        j["have"], j["wrong_res"] = have, wrong
        j["missing"] = [i for i in j["frames"] if i not in set(have)]
        j["done"] = not j["missing"]
    return jobs


# ------------------------------------------------------------------------------------------------ camera.json per unit
def write_cameras(ctx, groups, root, res):
    rs = ctx["rs"]
    w, h = [int(v) for v in res.split("x")]
    out = {}
    for g in groups:
        for u in g["units"]:
            frames, length, dz, spec = unit_frames(ctx, g, u)
            lb = label(u["id"])
            seg = f"descend-{lb}"
            cdoc = rs["camera_doc"](ctx["doc"], seg, frames, w, h, None)
            cdoc["shot"] = f"equirect-{seg}"
            cdoc["unit"] = {"id": u["id"], "floor": u["floor"], "type": u["type"], "group": g["id"], "dz_m": round(dz, 3),
                            "end_rule": g["facade"]["rule"], "facade_true_deg": g["facade"]["true_deg"],
                            "facade": g["facade"]["detail"], "length_m": round(length, 2)}
            cdoc["template"] = {"card": 22, "path": rel(PATH_JSON) + "#descend_template", "base": ctx["tmpl"]["base_segment"],
                                "anchors": [{k: ([round(v, 4) for v in x] if isinstance(x, list) else x) for k, x in an.items()}
                                            for an in spec["anchors"]]}
            d = os.path.join(root, seg)
            os.makedirs(d, exist_ok=True)
            json.dump(cdoc, open(os.path.join(d, "camera.json"), "w", encoding="utf-8"), indent=1)
            out[u["id"]] = os.path.join(d, "camera.json")
    return out


def mini_camera(src, dst, keep_lock=False):
    """the rows a renderer needs (frame, global_frame, pos, yaw, lock): small enough to embed in the kernel"""
    doc = json.load(open(src, encoding="utf-8"))
    rows = []
    for r in doc["frames"]:
        row = {"frame": r["frame"], "global_frame": r["global_frame"], "pos": r["pos"], "yaw_deg_from_plus_y_cw": r["yaw_deg_from_plus_y_cw"]}
        if keep_lock and "lock" in r:
            row["lock"] = r["lock"]
        rows.append(row)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    json.dump({"source": rel(src), "frames": rows}, open(dst, "w", encoding="utf-8"))
    return dst


# ------------------------------------------------------------------------------------------------ one Kaggle session = one spec
def session_spec(jobs, a, cams_dir):
    procs, scripts, files, dest, meta = [], {}, {}, {}, {}
    desc = [j for j in jobs if j["kind"] == "descend"]
    est = 0.0
    if desc:
        scripts["render_cameras.py"] = RENDER_CAMERAS
        scripts["render_segments.py"] = RS_PATH
        lights = "" if getattr(a, "no_scene_dataset", False) else "{IN:scene.blend}"
        args = ["--render-segments", "{SCRIPT:render_segments.py}", "--glb", "{IN:site.glb}", "--orbit-clay", "{CLAY}",
                "--hdri", "{IN:qwantani_noon_puresky_4k.hdr}", "--nodes-json", "{IN:nodes.json}", "--scene-blend", lights,
                "--out", "{OUT}", "--res", a.res, "--samples", str(a.samples), "--device", "auto", "--fmt", "PNG"]
        nfr = 0
        for j in desc:
            fn = f"cam_{j['id']}.json"
            files[fn] = mini_camera(j["camera_json"], os.path.join(cams_dir, fn))
            args += ["--cam", f"{j['id']}={{FILE:{fn}}}@{ranges(j['missing'])}"]
            dest[j["id"]] = j["frames_dir"]
            meta[j["id"]] = {"frames": j["missing"], "res": j["res"]}
            nfr += len(j["missing"])
        procs.append({"name": "site-clay", "script": "render_cameras.py", "blend": "", "args": args,
                      "timeout_s": int(min(10 * 3600, max(1800, nfr * 20))),
                      "jobs": [{"id": j["id"], "seg_dir": j["id"]} for j in desc]})
        est += nfr * a.spf_2k * (a.res_px / (2048 * 1024))
    for j in jobs:
        if j["kind"] not in ("enter", "tail"):
            continue
        scripts["enter.py"] = ENTER_PY
        fn = f"cam_{j['id']}.json"
        files[fn] = mini_camera(j["camera_json"], os.path.join(cams_dir, fn), keep_lock=True)
        seg_dir = f"enter-{j['label']}" if j["kind"] == "enter" else f"descend-{j['label']}"
        procs.append({"name": j["id"], "script": "enter.py", "blend": "{IN:enter846.packed.blend}",
                      "args": ["--render", "--camera-json", f"{{FILE:{fn}}}", "--out", "{OUT}", "--segment", seg_dir,
                               "--res", j["res"], "--samples", str(j["samples"]), "--device", "auto", "--fmt", "PNG",
                               "--frames", ranges(j["missing"])],
                      "timeout_s": int(max(1800, len(j["missing"]) * 30)), "jobs": [{"id": j["id"], "seg_dir": seg_dir}]})
        dest[j["id"]] = j["frames_dir"]
        meta[j["id"]] = {"frames": j["missing"], "res": j["res"]}
        est += len(j["missing"]) * 2.0
    extra = {"slug": "habait-batch-scenes", "files": {"enter846.packed.blend": ENTER_BLEND, "scene.blend": SCENE_BLEND}}
    if getattr(a, "no_scene_dataset", False):
        if any(j["kind"] in ("enter", "tail") for j in jobs):
            raise SystemExit("--no-scene-dataset: enter/tail need enter846.packed.blend from that dataset; pass --only descend-...")
        extra = {}
    return {"kernel_slug": a.kernel_slug, "scripts": scripts, "files": files, "base_needed": BASE_NEEDED if desc else [],
            "extra_dataset": extra, "procs": procs, "dest": dest, "jobs_meta": meta, "wait_s": a.wait, "slot_wait_s": a.slot_wait,
            "est_render_s": round(est), "note": f"card 22 batch: {', '.join(j['id'] for j in jobs)}"}


# ------------------------------------------------------------------------------------------------ runners
def load_push_pull():
    sys.dont_write_bytecode = True   # no __pycache__ inside kaggle/
    if KAGGLE_DIR not in sys.path:
        sys.path.insert(0, KAGGLE_DIR)
    import push_pull  # noqa: E402
    return push_pull


class KaggleRunner:
    name = "kaggle"

    def run(self, spec, stage_only=False):
        return load_push_pull().run_batch(spec, dry_run=stage_only)


def fake_png(w, h, rgb=(128, 128, 128), pad=MIN_FRAME_BYTES + 64):
    def chunk(t, d):
        return len(d).to_bytes(4, "big") + t + d + binascii.crc32(t + d).to_bytes(4, "big")
    raw = b"".join(b"\x00" + bytes(rgb) * w for _ in range(h))
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", w.to_bytes(4, "big") + h.to_bytes(4, "big") + bytes([8, 2, 0, 0, 0]))
            + chunk(b"tEXt", b"Comment\x00" + b"fake runner frame " * (pad // 18 + 1)) + chunk(b"IDAT", zlib.compress(raw))
            + chunk(b"IEND", b""))


class FakeRunner:
    """local stand-in for the Kaggle session (selftest / --runner fake): writes the tars a kernel would leave and unpacks
    them with push_pull.unpack_batch (the real unpack + move-aside code). No network, no Blender."""
    name = "fake"

    def __init__(self, run_root, fail_after=None):
        self.run_root = run_root
        self.fail_after = fail_after   # stop a job after this many frames (a cut session)
        self.calls = 0

    def run(self, spec, stage_only=False):
        if stage_only:
            return {"state": "dry-run"}
        self.calls += 1
        run_dir = os.path.join(self.run_root, f"fake_{self.calls}")
        os.makedirs(run_dir, exist_ok=True)
        procs, n_all = [], 0
        for p in spec["procs"]:
            jobs = {}
            for j in p["jobs"]:
                m = spec["jobs_meta"][j["id"]]
                w, h = [int(v) for v in m["res"].split("x")]
                frs = m["frames"][: self.fail_after] if self.fail_after is not None else m["frames"]
                stage = os.path.join(run_dir, "stage", j["id"])
                os.makedirs(stage, exist_ok=True)
                with tarfile.open(os.path.join(run_dir, f"frames_{j['id']}.tar"), "w") as tf:
                    for i in frs:
                        fp = os.path.join(stage, f"frame_{i:04d}.png")
                        open(fp, "wb").write(fake_png(w, h))
                        tf.add(fp, arcname=os.path.basename(fp))
                jobs[j["id"]] = {"frames_out": len(frs)}
                n_all += len(frs)
            procs.append({"name": p["name"], "rc": 0, "compute": "FAKE", "steady_s_per_frame": 0.0, "n_frames": sum(v["frames_out"] for v in jobs.values()),
                          "jobs": jobs, "wall_s": 0.0})
        json.dump({"card": 22, "procs": procs, "wall_s": 0.0, "gpus": ["fake"]}, open(os.path.join(run_dir, "summary_eq.json"), "w"))
        summ, got = load_push_pull().unpack_batch(run_dir, spec)
        return {"ts": now(), "mode": "fake", "state": "complete", "procs": summ.get("procs"), "jobs": got, "kernel_wall_s": 0.0,
                "quota_h_used": 0.0, "push_to_complete_s": 0, "run_dir": run_dir}


# ------------------------------------------------------------------------------------------------ progress
def projection(jobs, spf_2k, res_px):
    left = [j for j in jobs if j["kind"] == "descend" and not j["done"]]
    fr_left = sum(len(j["missing"]) for j in left)
    all_desc = [j for j in jobs if j["kind"] == "descend"]
    fr_all = sum(len(j["frames"]) for j in all_desc)
    k = res_px / (2048 * 1024)
    boot_s = 240  # per session: GPU boot + Blender download/extract + scene import (card 18: ~25 s in-kernel + boot)
    return {"sec_per_frame_2k_used": spf_2k,
            "descend_frames_total": fr_all, "descend_frames_left": fr_left,
            "draft_hours_whole_tower": round(fr_all * spf_2k * k / 3600, 2),
            "draft_hours_left": round(fr_left * spf_2k * k / 3600, 2),
            "final_4096x2048_hours_whole_tower": round(fr_all * spf_2k * 4 / 3600, 2),
            "assumes": "s/frame scales with pixel count at the same 128 spp; + ~4 min per Kaggle session (boot, Blender, import)",
            "per_session_overhead_s": boot_s}


def write_progress(path, ctx, groups, jobs, a, sessions, runner_name):
    spf = a.spf_2k
    units = []
    jby = {j["id"]: j for j in jobs}
    for g in groups:
        for u in g["units"]:
            lb = label(u["id"])
            j = jby.get(f"descend-{lb}")
            if j is None:
                continue
            rec = {"id": u["id"], "label": lb, "floor": u["floor"], "type": u["type"], "group": g["id"],
                   "segment": f"descend-{lb}", "frames_total": len(j["frames"]), "frames_on_disk": len(j["have"]),
                   "wrong_res_on_disk": len(j["wrong_res"]), "res": j["res"], "samples": j["samples"], "done": j["done"],
                   "frames_dir": rel(j["frames_dir"]), "camera_json": rel(j["camera_json"])}
            if u["id"] == ctx["base"]["id"]:
                for k in ("enter", "tail"):
                    x = jby.get(f"{k}-{lb}")
                    if x:
                        rec[f"{k}_done"] = x["done"]
                        rec[f"{k}_frames_on_disk"] = len(x["have"])
            units.append(rec)
    prev = json.load(open(path, encoding="utf-8")) if os.path.exists(path) else {}
    hist = (prev.get("sessions") or []) + sessions
    lit = {}   # which scene lit each job's frames: the last completed session that carried it
    for s_ in hist:
        if s_.get("state") == "complete":
            for jid in s_.get("jobs_sent") or {}:
                lit[jid] = s_.get("scene_blend")
    for u in units:
        u["scene_blend"] = lit.get(u["segment"])
    q = sum((s.get("quota_h_used") or 0.0) for s in hist if s.get("mode") == "kaggle-batch")
    doc = {"schema": "habait-flyover/batch-progress.v1", "card": 22, "updated": now(), "runner": runner_name,
           "units_file": rel(ctx["units_path"]), "n_units": len(ctx["units"]), "n_paths": len(groups),
           "dedup": [{"group": g["id"], "type": g["type"], "facade_true_deg": g["facade"]["true_deg"], "end_rule": g["facade"]["rule"],
                      "units": [u["id"] for u in g["units"]], "floors": [u["floor"] for u in g["units"]]} for g in groups],
           "units": units,
           "jobs": [{k: (rel(v) if k in ("camera_json", "frames_dir") else v) for k, v in j.items()
                     if k not in ("have", "missing", "wrong_res", "frames")} | {"frames": ranges(j["frames"]), "on_disk": len(j["have"]),
                                                                                "missing": ranges(j["missing"])} for j in jobs],
           "sessions": hist, "quota_h_used_total": round(q, 3),
           "projection": projection(jobs, spf, a.res_px)}
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    json.dump(doc, open(tmp, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    os.replace(tmp, path)
    return doc


def measured_spf(progress_path):
    """the latest measured 2K descend s/frame (this card's sessions), else card 18's approach number"""
    if os.path.exists(progress_path):
        for s in reversed(json.load(open(progress_path, encoding="utf-8")).get("sessions") or []):
            for p in s.get("procs") or []:
                if p.get("name") == "site-clay" and p.get("steady_s_per_frame") and p.get("res") in ([2048, 1024], "2048x1024"):
                    return float(p["steady_s_per_frame"]), "measured (card 22)"
    return CARD18_SPF_2K, "card 18 approach @2048x1024 128 spp"


# ------------------------------------------------------------------------------------------------ main flow
def plan(a):
    ctx = load_ctx(a.units)
    groups = group_units(ctx)
    n_units, n_paths = len(ctx["units"]), len(groups)
    print(f"[batch] units {rel(ctx['units_path'])}: {n_units} units -> {n_paths} unique descend paths "
          f"(dedup by type x facade azimuth x footprint; height offset {ctx['tmpl']['floor_to_floor_m']} m per floor)", flush=True)
    print(f"{'group':<10}{'rule':<16}{'facade':>8}  {'end xy (floor 16)':<20}{'units (floor)':<44}{'len m':>7}", flush=True)
    results = []
    for g in groups:
        fc = g["facade"]
        lens = []
        for u in g["units"]:
            frames, length, dz, _ = unit_frames(ctx, g, u)
            lens.append(length)
            for name, good, detail in check_unit(ctx, g, u, frames, dz):
                results.append((f"unit {label(u['id'])}: {name}", good, detail))
        us = ", ".join(f"{label(u['id'])} ({u['floor']})" for u in g["units"])
        print(f"{g['id']:<10}{fc['rule']:<16}{fc['true_deg']:>7.1f}d  {str([round(v, 2) for v in fc['end_xy']]):<20}{us:<44}"
              f"{min(lens):>7.1f}", flush=True)
        print(f"{'':<10}facade: {fc['detail']}", flush=True)
    results.insert(0, check_base_identity(ctx, groups))
    results[1:1] = check_dedup(ctx, groups)
    return ctx, groups, results


def print_checks(results, verbose):
    nfail = sum(1 for _, g, _ in results if not g)
    per_unit = {}
    for name, good, detail in results:
        if name.startswith("unit "):
            u = name[5:].split(":", 1)[0]
            per_unit.setdefault(u, [0, 0])
            per_unit[u][0] += 1
            per_unit[u][1] += 0 if good else 1
        if verbose or not good or not name.startswith("unit "):
            print(f"  [{'PASS' if good else 'FAIL'}] {name}: {detail}", flush=True)
    if per_unit and not verbose:
        print("  [" + ("PASS" if not any(v[1] for v in per_unit.values()) else "FAIL") + "] per-unit path checks (--verbose for "
              "each): " + ", ".join(f"{u} {v[0] - v[1]}/{v[0]}" for u, v in per_unit.items()), flush=True)
    print(f"checks: {len(results) - nfail}/{len(results)} pass", flush=True)
    return nfail


def print_queue(jobs, limit, spf):
    print(f"{'#':>3} {'job':<15}{'kind':<9}{'unit':<7}{'floor':>5} {'group':<10}{'res':<11}{'spp':>4}{'frames':>9}{'on disk':>9}"
          f"{'todo':>6}  next", flush=True)
    picked = 0
    for k, j in enumerate(jobs, 1):
        nxt = ""
        if not j["done"]:
            picked += 1
            nxt = "<- session" if limit and picked <= limit else ""
        wr = f" (+{len(j['wrong_res'])} other res)" if j["wrong_res"] else ""
        print(f"{k:>3} {j['id']:<15}{j['kind']:<9}{j['label']:<7}{j['floor']:>5} {str(j['group'] or '-'):<10}{j['res']:<11}"
              f"{j['samples']:>4}{len(j['frames']):>9}{len(j['have']):>9}{len(j['missing']):>6}  {'done' if j['done'] else nxt}{wr}",
              flush=True)


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0], formatter_class=argparse.RawDescriptionHelpFormatter, epilog=__doc__)
    p.add_argument("--units", default=DEF_UNITS)
    p.add_argument("--dry-run", action="store_true", help="dedup, paths, checks, queue; writes nothing")
    p.add_argument("--plan-only", action="store_true", help="write camera.json per descend-<unit>; render nothing")
    p.add_argument("--run", action="store_true", help="one Kaggle session with the next --limit jobs")
    p.add_argument("--stage", action="store_true", help="with --run: build the kernel + dataset folders only, no network")
    p.add_argument("--rescan", action="store_true", help="rewrite the progress file from the frames on disk")
    p.add_argument("--selftest", action="store_true")
    p.add_argument("--limit", type=int, default=5, help="jobs per Kaggle session")
    p.add_argument("--only", default="", help="comma list of unit labels / job ids")
    p.add_argument("--res", default="2048x1024")
    p.add_argument("--samples", type=int, default=128)
    p.add_argument("--enter-res", default="1024x512")
    p.add_argument("--enter-samples", type=int, default=16)
    p.add_argument("--runner", default="kaggle", choices=["kaggle", "fake"])
    p.add_argument("--root", default=SEG_OUT, help="segments dir (frames + camera.json)")
    p.add_argument("--progress", default=PROGRESS)
    p.add_argument("--work", default=LOCAL, help="session specs, embedded cameras, fake runs (default batch/_local)")
    p.add_argument("--kernel-slug", default="habait-batch-render")
    p.add_argument("--wait", type=int, default=3 * 3600, help="max seconds to poll the kernel")
    p.add_argument("--slot-wait", type=int, default=2400, help="max seconds to wait for a free Kaggle GPU slot")
    p.add_argument("--verbose", action="store_true", help="print every per-unit check")
    p.add_argument("--no-scene-dataset", action="store_true",
                   help="descend only, without the habait-batch-scenes dataset: --scene-blend '' (card 18's scene, no 846 "
                        "ceiling lights). Kaggle cancelled every run that mounted that dataset (2026-11-02 18:15-18:26)")
    a = p.parse_args(argv)
    if a.selftest:
        return selftest()
    a.root, a.progress, a.work = os.path.abspath(a.root), os.path.abspath(a.progress), os.path.abspath(a.work)
    w, h = [int(v) for v in a.res.split("x")]
    a.res_px = w * h
    a.spf_2k, spf_src = measured_spf(a.progress)
    ctx, groups, results = plan(a)
    nfail = print_checks(results, a.verbose)
    jobs = build_jobs(ctx, groups, a, a.root)
    print(f"[batch] queue: {len(jobs)} jobs ({sum(1 for j in jobs if j['done'])} done); --limit {a.limit} per Kaggle session; "
          f"s/frame for estimates {a.spf_2k} ({spf_src})", flush=True)
    print_queue(jobs, a.limit, a.spf_2k)
    pr = projection(build_jobs(ctx, groups, a, a.root, apply_only=False), a.spf_2k, a.res_px)
    print(f"[batch] projection: whole tower {pr['descend_frames_total']} descend frames = {pr['draft_hours_whole_tower']} GPU h at "
          f"{a.res} (left {pr['draft_hours_left']} h); final 4096x2048 = {pr['final_4096x2048_hours_whole_tower']} h; "
          f"+ ~4 min per session", flush=True)
    if nfail:
        say("path checks failed: nothing written, nothing sent")
        return 1
    if a.dry_run:
        todo = [j for j in jobs if not j["done"] and (j["kind"] == "descend" or not a.no_scene_dataset)][: a.limit]
        say(f"dry-run: the next session would carry {len(todo)} jobs: {', '.join(j['id'] for j in todo) or '(none)'}; "
            f"writes nothing")
        return 0
    if a.plan_only or a.run:
        cams = write_cameras(ctx, groups, a.root, a.res)
        say(f"camera.json written for {len(cams)} descend segments under {rel(a.root)}")
        jobs = build_jobs(ctx, groups, a, a.root)
    if a.rescan or a.plan_only:
        write_progress(a.progress, ctx, groups, build_jobs(ctx, groups, a, a.root, apply_only=False), a, [], a.runner)
        say(f"progress -> {rel(a.progress)}")
        return 0
    if not a.run:
        return 0
    todo = [j for j in jobs if not j["done"] and (j["kind"] == "descend" or not a.no_scene_dataset)][: a.limit]
    if not todo:
        write_progress(a.progress, ctx, groups, build_jobs(ctx, groups, a, a.root, apply_only=False), a, [], a.runner)
        say(f"nothing to render: every queued job is on disk ({len(jobs)} jobs); progress -> {rel(a.progress)}")
        return 0
    for j in todo:
        if not os.path.exists(j["camera_json"]):
            raise SystemExit(f"{j['id']}: camera.json missing: {j['camera_json']}")
    spec = session_spec(todo, a, os.path.join(a.work, "kaggle-cams"))
    say(f"session: {len(todo)} jobs ({', '.join(j['id'] + ' ' + str(len(j['missing'])) + ' fr' for j in todo)}), "
        f"estimated render {spec['est_render_s'] / 60:.0f} min + ~4 min boot")
    os.makedirs(a.work, exist_ok=True)
    json.dump(spec, open(os.path.join(a.work, "last-session-spec.json"), "w", encoding="utf-8"), indent=1)
    runner = FakeRunner(os.path.join(a.work, "fake-runs")) if a.runner == "fake" else KaggleRunner()
    t0 = time.time()
    rec = runner.run(spec, stage_only=a.stage)
    if a.stage:
        say(f"staged only: {json.dumps({k: rec.get(k) for k in ('kernel', 'kernel_dir', 'datasets', 'base_dataset')})}")
        return 0
    rec = dict(rec)
    rec["mode"] = rec.get("mode") or ("kaggle-batch" if a.runner == "kaggle" else "fake")
    rec["jobs_sent"] = {j["id"]: ranges(j["missing"]) for j in todo}
    rec["scene_blend"] = "" if a.no_scene_dataset else "scene.blend (846 ceiling lights)"
    rec["local_wall_s"] = round(time.time() - t0)
    jobs = build_jobs(ctx, groups, a, a.root, apply_only=False)
    doc = write_progress(a.progress, ctx, groups, jobs, a, [rec], runner.name)
    done = [u["label"] for u in doc["units"] if u["done"]]
    say(f"session {rec.get('state')}: units done {len(done)}/{len(doc['units'])} ({', '.join(done)}); "
        f"quota used this session {rec.get('quota_h_used')} h (kernel wall); progress -> {rel(a.progress)}")
    return 0 if rec.get("state") == "complete" else 1


# ------------------------------------------------------------------------------------------------ selftest (fake runner)
def selftest():
    res = []

    def ok(name, cond, detail=""):
        res.append((name, bool(cond), detail))
        print(f"  [{'PASS' if cond else 'FAIL'}] {name}{': ' + detail if detail else ''}", flush=True)
    rs = load_rs()
    ctx = load_ctx(DEF_UNITS, rs=rs)
    groups = group_units(ctx)
    ok("real units: 12 -> 4 paths", len(ctx["units"]) == 12 and len(groups) == 4,
       f"{len(ctx['units'])} -> {len(groups)}: " + "; ".join(f"{g['id']} {[label(u['id']) for u in g['units']]}" for g in groups))
    name, good, detail = check_base_identity(ctx, groups)
    ok(name, good, detail)
    # the reviewer's case: same type, other azimuth (a box against the west face) must NOT merge; same type other floor must
    tmp = tempfile.mkdtemp(prefix="batch22-")
    try:
        units = copy.deepcopy(ctx["units"])
        hero = next(u for u in units if u["id"] == "apt846")
        west = copy.deepcopy(hero)
        west.update({"id": "999", "floor": 16, "box_world": [-26.0, -14.0, 0.0, -14.0, -2.0, 2.9]})
        units.append(west)
        up = copy.deepcopy(hero)
        up.update({"id": "896", "floor": 21, "box_world": hero["box_world"][:2] + [16.0] + hero["box_world"][3:5] + [18.9]})
        units.append(up)
        up_p = os.path.join(tmp, "units.json")
        json.dump({"units": units}, open(up_p, "w"))
        shutil.copy(os.path.join(RAINBOW, "units-geometry.json"), os.path.join(tmp, "units-geometry.json"))
        c2 = load_ctx(up_p, rs=rs)
        g2 = group_units(c2)
        gid = {u["id"]: g["id"] for g in g2 for u in g["units"]}
        ok("same type L, west face: own group", gid["999"] != gid["apt846"], f"999 -> {gid['999']}, 846 -> {gid['apt846']}")
        ok("same type L, floor 21: joins 846's group", gid["896"] == gid["apt846"], f"896 -> {gid['896']}")
        ok("dedup checks on the synthetic set", all(g for _, g, _ in check_dedup(c2, g2)))
        # every real unit's path passes its checks
        bad = [(label(u["id"]), n) for g in groups for u in g["units"]
               for n, gd, _ in check_unit(ctx, g, u, *[unit_frames(ctx, g, u)[k] for k in (0, 2)]) if not gd]
        ok("every real unit's path passes", not bad, str(bad[:4]))
        # queue order + fake runs in a temp segments dir
        root = os.path.join(tmp, "segments")
        os.makedirs(os.path.join(root, "enter-846"), exist_ok=True)
        shutil.copy(os.path.join(SEG_OUT, "enter-846", "camera.json"), os.path.join(root, "enter-846", "camera.json"))
        prog = os.path.join(tmp, "progress.json")
        work = os.path.join(tmp, "work")
        base_args = ["--units", DEF_UNITS, "--root", root, "--progress", prog, "--runner", "fake", "--res", "64x32",
                     "--enter-res", "32x16", "--work", work]
        a = argparse.Namespace(res="64x32", samples=128, enter_res="32x16", enter_samples=16, only="")
        write_cameras(ctx, groups, root, "64x32")
        jobs = build_jobs(ctx, groups, a, root)
        order = [j["id"] for j in jobs]
        ok("queue order", order[:5] == ["descend-846", "enter-846", "tail-846", "descend-836", "descend-856"], str(order))
        # a stale 16x8 enter frame (other resolution) counts as missing and is moved aside on pull
        os.makedirs(os.path.join(root, "enter-846", "frames"), exist_ok=True)
        open(os.path.join(root, "enter-846", "frames", "frame_0001.png"), "wb").write(fake_png(16, 8))
        rc1 = main(base_args + ["--run", "--limit", "5"])
        d1 = json.load(open(prog, encoding="utf-8"))
        done1 = sorted(u["label"] for u in d1["units"] if u["done"])
        ok("run 1 (--limit 5): 846, 836, 856 done + enter/tail", rc1 == 0 and done1 == ["836", "846", "856"]
           and d1["units"][0].get("enter_done") and d1["units"][0].get("tail_done"), f"rc {rc1}, done {done1}")
        ok("other-resolution frame moved aside", os.path.exists(os.path.join(root, "enter-846", "frames-16x8", "frame_0001.png")))
        n_files = sum(len(fs) for _, _, fs in os.walk(root))
        rc2 = main(base_args + ["--run", "--limit", "5", "--only", "846,836,856"])
        n_files2 = sum(len(fs) for _, _, fs in os.walk(root))
        ok("run 2 on the same units renders nothing new", rc2 == 0 and n_files2 == n_files, f"rc {rc2}, files {n_files} -> {n_files2}")
        # resume: 5 frames of 836 lost -> the next session sends exactly those 5
        for i in (3, 4, 5, 60, 120):
            os.remove(os.path.join(root, "descend-836", "frames", f"frame_{i:04d}.png"))
        rc3 = main(base_args + ["--run", "--limit", "1", "--only", "836"])
        spec = json.load(open(os.path.join(work, "last-session-spec.json"), encoding="utf-8"))
        sent = spec["jobs_meta"].get("descend-836", {}).get("frames")
        ok("resume sends only the missing frames", rc3 == 0 and sent == [3, 4, 5, 60, 120], f"sent {sent}")
        # a cut session: only 10 frames land; progress shows the job partial, the next run finishes it
        runner = FakeRunner(os.path.join(tmp, "cut"), fail_after=10)
        a2 = argparse.Namespace(**vars(a), kernel_slug="x", wait=1, slot_wait=1, spf_2k=4.15, res_px=64 * 32)
        jobs = build_jobs(ctx, groups, a2, root)
        j826 = [j for j in jobs if j["id"] == "descend-826"]
        runner.run(session_spec(j826, a2, os.path.join(tmp, "cams")))
        j826 = [j for j in build_jobs(ctx, groups, a2, root) if j["id"] == "descend-826"][0]
        ok("cut session leaves a partial job", len(j826["have"]) == 10 and not j826["done"], f"{len(j826['have'])}/120")
        rc4 = main(base_args + ["--run", "--limit", "1", "--only", "826"])
        d4 = json.load(open(prog, encoding="utf-8"))
        ok("the next session completes it", rc4 == 0 and next(u for u in d4["units"] if u["label"] == "826")["done"])
        ok("progress lists every unit even with --only", len(d4["units"]) == 12 and
           sorted(u["label"] for u in d4["units"] if u["done"]) == ["826", "836", "846", "856"],
           f"{len(d4['units'])} units, done {sorted(u['label'] for u in d4['units'] if u['done'])}")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    nfail = sum(1 for _, g, _ in res if not g)
    print(f"selftest: {len(res) - nfail}/{len(res)} pass", flush=True)
    return 1 if nfail else 0


if __name__ == "__main__":
    sys.exit(main())
