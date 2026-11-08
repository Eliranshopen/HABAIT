"""enter.py - enter-846: the 360 walk from the end of descend-846 (1.5 m outside o-5) through o-5 into the living room,
ending on the tour's living panorama at its default yaw (lane C5, card 20, 2026-11-02). $0, no generative calls.

The idea (projection mapping, lane C): the two GPT-skinned interior panoramas of the tour (living, terraceLiving; the
balanced set) are equirect PROJECTORS placed at their cameras.json positions (px / 2.25 = plan cm, eye 1.6 m). Every
surface of the zero-line apartment scene (Habait/studio/.../renders/scene.blend, appended read-only) gets one emission
shader that samples both panos from the projector centres; the two are blended per pixel by
    w_i = vis_i * (max(0, cos(angle between the camera ray and the projector ray))^8 + 1e-3)
(vis_i = shadow-map visibility: an equirect depth map per projector, ray-cast in the build, compared per pixel with
|P - C_i|; the meshes keep their plan resolution). Outside the apartment, card 15's
baked site (renders/baked/baked.blend) is the scene: the glass stays transparent so the real 3D city is seen through it.
A hand-off "lock" (0 -> 1 over the last 30 % of the segment) fades the terrace projector out and the glass in, so the
last frame, rendered from the living projector's own centre, IS the living panorama (no jump into the tour).
o-5 is a glazed sliding door in the plan (facade-3 pane); it is rendered OPEN (the glass faces inside its span are cut),
as the GPT living panorama shows it.

Frames (plan-world metres, X = x_cm/100, Y = -y_cm/100, Z up, floor 16 at 0; equirect u = 0.5 + (bearing - yaw)/360,
clockwise = right; identical to ../equirect/render_segments.py, card 17):
  start  = descend-846's last pose (read at run time from ../equirect/path.json via render_segments.build_path)
  path   = centripetal Catmull-Rom (render_segments.catmull_rom) start -> o-5 centre (z 1.6) -> cp-living, arc length
           eased by smoothstep (the same easing as descend-846, which ends at rest)
  yaw    = 288.72 (descend's inward look) held while walking, then a clockwise turn to the tour's living default yaw
           (scenes.json heading + centreBearingDeg = 111.3) over tau 0.40..1.0, smoothstep
  lock   = smoothstep over tau 0.70..1.0 (opaque surfaces: the terrace projector fades out)
  lock_glass = smoothstep over the last 12 frames (85-96), the glass and the o-5 portal only     # M1 v2 fix 2026-11-03

M1 v2 fix 2026-11-03 (gate M1 v2 on habait-98's 96-frame 1024x512 draft; applied in memory by --render and --check, so the
built enter846(.packed).blend needs no rebuild; nothing is saved):
  1. "white boxes": the catalog furniture (FURN_<room>_<slot> empties of build_scene/general_furnish and their Kenney /
     Poly Haven child meshes) is hidden from render, and the two projector depth maps are re-cast without it, so the floor
     and the walls behind carry the panoramas' painted furniture (exact at the last pose = the living projector's centre).
     BK_* / STUDIO_* are NOT furniture here: they are card 15's baked site and the studio site (tower, podium, neighbours,
     ground; kf_check class 5) and stay.
  2. "floating rectangle with a city" at ~2.7 s: the glass stays transparent (the baked city behind it) through frame 84
     and joins the lock only on the last 12 frames, the same frames and smoothstep as card 34's 12-frame lock onto
     04-living, with the camera within 0.23 m of the living centre; frame 96 is still the living panorama itself.

Modes
  python enter.py --plan-only [--res 1024x512]      camera.json for the segment (Studio {"frames": [...]} form) + checks
  python enter.py --selftest                        checks only, exit 1 on a failure
  blender -b Habait/flyover/renders/baked/baked.blend --factory-startup -P enter.py -- --build [--pack]
                                                    -> enter/_local/enter846.blend (+ enter846.packed.blend for Kaggle)
  blender -b enter/_local/enter846.blend -P enter.py -- --render [--frames 1-96 | 1,38,96] [--res 1024x512]
          [--samples 16] [--device auto|CPU|OPTIX|CUDA] [--fmt PNG|JPEG] [--out <segments dir>] [--camera-json <file>]
  blender -b enter/_local/enter846.blend -P enter.py -- --check
                                                    hand-off view (perspective 512x256, 90 deg, last pose) + id/depth
                                                    passes + a clay variant, for kf_check
  python enter.py --check-prep --last <last equirect frame>
                                                    pano crop (REF) + last-frame crop (TEST) into check/handoff

Output (the card 17 location): ../equirect/_local/segments/enter-846/{camera.json, frames/frame_####.png,
render_log.json, check/}. Idempotent: an existing frame (>= 2 KB) is skipped unless --force; frames are written to a
temp name and renamed.
"""
import argparse
import json
import math
import os
import shutil
import sys
import time

try:
    import bpy  # noqa: F401
except ImportError:
    bpy = None

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
SEG = "enter-846"
DEF_PATH = os.path.join(HERE, "equirect", "path.json")
DEF_RS = os.path.join(HERE, "equirect", "render_segments.py")
DEF_OUT = os.path.join(HERE, "equirect", "_local", "segments")
DEF_SCENE_OUT = os.path.join(HERE, "enter", "_local", "enter846.blend")
DEF_APT_BLEND = os.path.join(REPO, "Habait", "studio", "_local", "projects", "apt846-rainbow-tlv", "renders", "scene.blend")
DEF_BAKED = os.path.join(HERE, "renders", "baked", "baked.blend")
TOUR = os.path.join(REPO, "Habait", "tour360", "apartments", "apt846")
DEF_PLAN = os.path.join(REPO, "Habait", "studio", "_local", "projects", "apt846-rainbow-tlv", "derived", "plan.json")
N_FRAMES = 96
FPS = 24
EYE_Z = 1.6
TURN = (0.40, 1.0)      # tau window of the yaw turn
LOCK = (0.70, 1.0)      # tau window of the hand-off lock
# M1 v2 fix 2026-11-03: the glass (and the o-5 portal) follow their own lock, over the last 12 frames only (85-96 = card 34's
# LOCK_FRAMES); before that the glass is transparent and shows the baked site, as on frames 1-66 of the first draft.
GLASS_LOCK_FRAMES = 12
GLASS_LOCK = (1.0 - GLASS_LOCK_FRAMES / float(N_FRAMES), 1.0)
FURN_PREFIX = "FURN_"   # M1 v2 fix 2026-11-03: build_scene's furniture group empties; their children are the catalog meshes
TURN_DIR = +1           # +1 = clockwise (through the dining/kitchen side), -1 = counter-clockwise
DENSIFY_M = 0.2         # only the glass that spans o-5 is split, so the slider's span can be cut out
DEPTH_RES = (1024, 512)  # projector depth maps (0.35 deg per texel)
DEPTH_BIAS = (0.04, 0.03)  # visible when |P - C| - depth < a + b * |P - C| (metres)
MIN_FRAME_BYTES = 2048
CHECK_RES = (512, 256)
CHECK_LENS = 18.0       # 36 mm sensor -> 90 deg horizontal
FALLBACK_SRGB = (0.80, 0.776, 0.73)
ANG_FLOOR = 1e-3        # w_i = vis_i * (max(0, cos)^8 + ANG_FLOOR): a projector that sees a point always contributes
HOLE_W = 1e-6           # weight of the visibility-free blend used where neither projector sees the point
# kf_check classes (Habait/studio/tools/render_shots.py ID_CLASSES, extended for this scene's names)
ID_CLASSES = (("BK_", 5), ("STUDIO_", 5), ("DOORFRAME", 1), ("DOOR", 3), ("LEAF", 3), ("PANE", 2), ("GLASS", 2),
              ("FACADE", 2), ("RAIL", 2), ("WALL", 1), ("FACING", 1), ("INFILL", 1), ("POST_", 1), ("FLOOR", 6),
              ("CEIL", 6), ("TERRAIN", 6))


def log(msg):
    print(f"[enter] {msg}", flush=True)


# ------------------------------------------------------------------------------------------------ args
def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    p.add_argument("--path", default=DEF_PATH)
    p.add_argument("--render-segments", default=DEF_RS, help="card 17's script; exec'd read-only for its path helpers")
    p.add_argument("--orbit-camera", default="")
    p.add_argument("--out", default=DEF_OUT)
    p.add_argument("--camera-json", default="", help="render from this camera.json (Kaggle); default <out>/<segment>/camera.json")
    p.add_argument("--segment", default=SEG, help="output folder name under --out (e.g. descend-846 with its own camera.json, "
                   "to render the descend tail on this scene and look)")
    p.add_argument("--plan-only", action="store_true")
    p.add_argument("--selftest", action="store_true")
    p.add_argument("--build", action="store_true")
    p.add_argument("--pack", action="store_true")
    p.add_argument("--scene-out", default=DEF_SCENE_OUT)
    p.add_argument("--apt-blend", default=DEF_APT_BLEND)
    p.add_argument("--render", action="store_true")
    p.add_argument("--check", action="store_true")
    p.add_argument("--check-prep", action="store_true")
    p.add_argument("--last", default="")
    p.add_argument("--frames", default="")
    p.add_argument("--res", default="1024x512")
    p.add_argument("--samples", type=int, default=16)
    p.add_argument("--device", default="auto")
    p.add_argument("--fmt", default="PNG", choices=["PNG", "JPEG"])
    p.add_argument("--force", action="store_true")
    a = p.parse_args(argv)
    for k in ("path", "render_segments", "orbit_camera", "out", "camera_json", "scene_out", "apt_blend", "last"):
        if getattr(a, k):
            setattr(a, k, os.path.abspath(getattr(a, k)))
    return a


# ------------------------------------------------------------------------------------------------ small math
def smoothstep(u):
    u = max(0.0, min(1.0, u))
    return u * u * (3 - 2 * u)


def glass_lock_at(tau):
    """M1 v2 fix 2026-11-03: the glass's share of the hand-off lock at segment time tau (0 through frame 84, 1 on frame 96)"""
    return smoothstep((tau - GLASS_LOCK[0]) / (GLASS_LOCK[1] - GLASS_LOCK[0]))


def glass_lock_of(row, n):
    """M1 v2 fix 2026-11-03: a camera.json row's glass lock. Rows written before the fix carry only 'lock' (enter-846):
    the schedule is recomputed from the frame number; rows with no lock at all (the descend-846 tail) keep the glass clear."""
    if "lock_glass" in row:
        return float(row["lock_glass"])
    if "lock" not in row:
        return 0.0
    return glass_lock_at(int(row["frame"]) / float(n))


def bearing(dx, dy):
    return math.degrees(math.atan2(dx, dy)) % 360.0


def wrap180(x):
    return (x + 180.0) % 360.0 - 180.0


def level_matrix(pos, yaw):
    """camera-to-world of a level camera heading at plan bearing yaw (mirror of render_segments.level_matrix)"""
    s, c = math.sin(math.radians(yaw)), math.cos(math.radians(yaw))
    return [[c, 0.0, -s, pos[0]], [-s, 0.0, -c, pos[1]], [0.0, 1.0, 0.0, pos[2]], [0.0, 0.0, 0.0, 1.0]]


def load_render_segments(path):
    """card 17's render_segments.py, read-only: its trailing main() call is dropped, its helpers are reused"""
    lines = open(path, encoding="utf-8").read().rstrip().splitlines()
    if not lines or lines[-1].strip() != "main()":
        raise SystemExit(f"{path}: expected a trailing main() call; the layout changed")
    ns = {"__file__": os.path.abspath(path), "__name__": "render_segments_lib"}
    exec(compile("\n".join(lines[:-1]) + "\n", path, "exec"), ns)
    return ns


# ------------------------------------------------------------------------------------------------ inputs
def projectors():
    """the two tour panoramas as projectors: plan cm = cameras.json px / pxPerCm; yaw = the pano centre bearing"""
    cams = json.load(open(os.path.join(TOUR, "cameras.json"), encoding="utf-8"))
    scenes = json.load(open(os.path.join(TOUR, "scenes.json"), encoding="utf-8"))
    ppc = cams["plan"]["pxPerCm"]
    eye = cams.get("eye_m", EYE_Z)
    out = {}
    for sid, key in (("living", "L"), ("terraceLiving", "T")):
        c = next(s for s in cams["scenes"] if s["id"] == sid)
        s = next(x for x in scenes["scenes"] if x["id"] == sid)
        x_cm, y_cm = c["at"][0] / ppc, c["at"][1] / ppc
        out[key] = {"scene": sid, "asset": c["asset"], "plan_cm": [round(x_cm, 2), round(y_cm, 2)],
                    "pos": [x_cm / 100.0, -y_cm / 100.0, eye], "yaw": float(s["centreBearingDeg"]),
                    "default_yaw": (float(s["centreBearingDeg"]) + float(s.get("heading", 0))) % 360.0,
                    "pano": os.path.join(TOUR, "panos", "balanced", c["asset"] + ".webp")}
    return out


def plan_doc():
    return json.load(open(DEF_PLAN, encoding="utf-8"))


# ------------------------------------------------------------------------------------------------ the path
def build_enter(a):
    rs = load_render_segments(a.render_segments)
    ns = argparse.Namespace(path=a.path, orbit_camera=a.orbit_camera, repo="")
    doc, srcs, orbit, segs = rs["build_path"](ns)
    last = segs["descend-846"][-1]
    prev = segs["descend-846"][-2]
    pj = projectors()
    E = list(last["pos"])
    yaw0 = last["yaw"] % 360.0
    o5 = doc["end"]["o5_centre_world"]
    O = [o5[0], o5[1], doc["end"]["eye_z"]]
    L = list(pj["L"]["pos"])
    yaw1 = pj["L"]["default_yaw"]
    dyaw = (yaw1 - yaw0) % 360.0 if TURN_DIR > 0 else -((yaw0 - yaw1) % 360.0)
    ev = rs["catmull_rom"]([E, O, L])
    M = 1200
    Ts = [k * 2.0 / M for k in range(M + 1)]
    xs = [ev(T) for T in Ts]
    cum = [0.0]
    for k in range(1, len(xs)):
        cum.append(cum[-1] + math.dist(xs[k][:3], xs[k - 1][:3]))
    Ltot = cum[-1]
    frames = []
    j = 0
    for i in range(1, N_FRAMES + 1):
        tau = i / N_FRAMES
        s = smoothstep(tau) * Ltot
        while j < len(cum) - 2 and cum[j + 1] < s:
            j += 1
        span = cum[j + 1] - cum[j]
        f = 0.0 if span <= 0 else (s - cum[j]) / span
        T = Ts[j] + (Ts[j + 1] - Ts[j]) * f
        pos = list(ev(T)[:3]) if i < N_FRAMES else list(L)
        yaw = (yaw0 + dyaw * smoothstep((tau - TURN[0]) / (TURN[1] - TURN[0]))) % 360.0
        lock = smoothstep((tau - LOCK[0]) / (LOCK[1] - LOCK[0]))
        frames.append({"pos": [float(v) for v in pos], "yaw": yaw, "hint_yaw": yaw, "hint_pitch": 0.0,
                       "src": f"enter spline T={T:.3f} tau={tau:.4f}", "frame": i, "global": last["global"] + i,
                       "lock": round(lock, 6),
                       "lock_glass": round(glass_lock_at(tau), 6)})   # M1 v2 fix 2026-11-03
    return {"rs": rs, "doc": doc, "last": last, "prev": prev, "E": E, "O": O, "L": L, "yaw0": yaw0, "yaw1": yaw1,
            "dyaw": dyaw, "frames": frames, "length_m": Ltot, "pj": pj}


def seg_point_dist(p, a, b):
    ax, ay = a
    bx, by = b
    dx, dy = bx - ax, by - ay
    t = max(0.0, min(1.0, ((p[0] - ax) * dx + (p[1] - ay) * dy) / max(1e-12, dx * dx + dy * dy)))
    return math.hypot(p[0] - (ax + t * dx), p[1] - (ay + t * dy))


def seg_intersect(p1, p2, q1, q2):
    """intersection parameter (t on p, u on q) of two 2D segments or None"""
    r = (p2[0] - p1[0], p2[1] - p1[1])
    s = (q2[0] - q1[0], q2[1] - q1[1])
    den = r[0] * s[1] - r[1] * s[0]
    if abs(den) < 1e-12:
        return None
    qp = (q1[0] - p1[0], q1[1] - p1[1])
    t = (qp[0] * s[1] - qp[1] * s[0]) / den
    u = (qp[0] * r[1] - qp[1] * r[0]) / den
    if 0 <= t <= 1 and 0 <= u <= 1:
        return t, u
    return None


def threshold_frame(P):
    """first frame on the living side of the o-5 line (plan-world), with the crossing point"""
    d = P["doc"]["end"]
    a, b = d["o5_a_world"], d["o5_b_world"]
    n = d["normal_out_xy"]

    def side(p):
        return (p[0] - a[0]) * n[0] + (p[1] - a[1]) * n[1]
    prev = P["E"]
    for fr in P["frames"]:
        if side(prev) > 0 >= side(fr["pos"]):
            hit = seg_intersect(prev[:2], fr["pos"][:2], a, b)
            return fr["frame"], hit, prev, fr["pos"]
        prev = fr["pos"]
    return None, None, None, None


def checks(P):
    res = []
    fr = P["frames"]
    d = P["doc"]["end"]
    a, b = d["o5_a_world"], d["o5_b_world"]
    # 1 seam with descend-846
    step0 = math.dist(P["E"], fr[0]["pos"])
    steps = [math.dist(fr[k]["pos"], fr[k + 1]["pos"]) for k in range(len(fr) - 1)]
    last_desc_step = math.dist(P["prev"]["pos"], P["E"])
    res.append(("seam descend-846 -> enter-846", step0 <= max(steps) and abs(wrap180(fr[0]["yaw"] - P["yaw0"])) < 0.5,
                f"first step {step0:.4f} m (descend's last step {last_desc_step:.4f} m, both at rest), yaw {P['yaw0']:.2f} -> {fr[0]['yaw']:.2f}"))
    # 2 speeds
    vmax = max(steps) * FPS
    yr = max(abs(wrap180(fr[k + 1]["yaw"] - fr[k]["yaw"])) for k in range(len(fr) - 1)) * FPS
    res.append(("speed", vmax <= 2.5 and yr <= 150, f"peak {vmax:.2f} m/s, peak yaw rate {yr:.0f} deg/s, length {P['length_m']:.2f} m in {len(fr) / FPS:.1f} s"))
    # 3 through o-5
    tf, hit, p0, p1 = threshold_frame(P)
    if tf is None or hit is None:
        res.append(("passes through o-5", False, "no crossing of the o-5 segment"))
    else:
        wid = math.dist(a, b)
        margin = min(hit[1], 1 - hit[1]) * wid
        z = p0[2] + (p1[2] - p0[2]) * hit[0]
        res.append(("passes through o-5 (living <-> terrace-living, not o-13)", margin >= 0.4 and 0.3 < z < 2.9 - 0.3,
                    f"crosses between frames {tf - 1} and {tf} at {hit[1]:.3f} of the {wid:.2f} m opening (jamb margin {margin:.2f} m), z {z:.2f} (head 2.90)"))
    # 4 walls and panes of the plan (2D)
    plan = plan_doc()
    pts = [P["E"]] + [f["pos"] for f in fr]
    wall_hits, pane_hits, min_wall = [], [], 9e9
    for w in plan["walls"]:
        poly = [(x / 100.0, -y / 100.0) for x, y in w["polygon_cm"]]
        for k in range(len(pts) - 1):
            for e in range(len(poly)):
                if seg_intersect(pts[k][:2], pts[k + 1][:2], poly[e], poly[(e + 1) % len(poly)]):
                    wall_hits.append((w["id"], k))
        for p in pts:
            for e in range(len(poly)):
                min_wall = min(min_wall, seg_point_dist(p[:2], poly[e], poly[(e + 1) % len(poly)]))
    for pn in plan["panes"]:
        poly = [(x / 100.0, -y / 100.0) for x, y in pn["polygon_cm"]]
        for k in range(len(pts) - 1):
            for e in range(len(poly)):
                h = seg_intersect(pts[k][:2], pts[k + 1][:2], poly[e], poly[(e + 1) % len(poly)])
                if h:
                    x = (pts[k][0] + (pts[k + 1][0] - pts[k][0]) * h[0], pts[k][1] + (pts[k + 1][1] - pts[k][1]) * h[0])
                    inside_o5 = seg_point_dist(x, a, b) < 0.3 and min(math.dist(x, a), math.dist(x, b)) > 0.3
                    if not inside_o5:
                        pane_hits.append((pn["id"], k))
    res.append(("no wall crossed (plan walls)", not wall_hits, f"hits {wall_hits[:4]}; min clearance to a wall polygon {min_wall:.2f} m"))
    res.append(("no glazing crossed outside o-5 (plan panes)", not pane_hits, f"hits {pane_hits[:4]} (crossings inside o-5's span are the open slider)"))
    # 5 end on cp-living, default yaw
    cp = next(c for c in plan["camera_points"] if c["id"] == "cp-living")
    cpw = [cp["x"] / 100.0, -cp["y"] / 100.0, cp["z"] / 100.0]
    err = math.dist(fr[-1]["pos"], cpw)
    res.append(("ends on cp-living", err < 0.02, f"last pos {[round(v, 3) for v in fr[-1]['pos']]} vs plan cp-living {cpw} ({err * 100:.1f} cm)"))
    dy = abs(wrap180(fr[-1]["yaw"] - P["yaw1"]))
    res.append(("last yaw = tour default yaw of living (+-2 deg)", dy <= 2.0,
                f"last yaw {fr[-1]['yaw']:.2f} vs scenes.json living heading 0 + centreBearingDeg {P['yaw1']:.2f} (diff {dy:.2f}); turn {P['dyaw']:+.1f} deg"))
    # 6 projectors vs plan camera points
    for key, cid in (("L", "cp-living"), ("T", "cp-terraceLiving")):
        c = next(x for x in plan["camera_points"] if x["id"] == cid)
        e = math.hypot(c["x"] - P["pj"][key]["plan_cm"][0], c["y"] - P["pj"][key]["plan_cm"][1])
        res.append((f"projector {cid} = cameras.json px/2.25", e < 1.0 and abs(wrap180(c["yaw_deg"] - P["pj"][key]["yaw"])) < 0.1,
                    f"{P['pj'][key]['plan_cm']} vs plan {[c['x'], c['y']]} ({e:.2f} cm), yaw {P['pj'][key]['yaw']}"))
    # 7 lock schedule
    res.append(("hand-off lock 0 outside, 1 on the last frame", fr[0]["lock"] == 0.0 and fr[-1]["lock"] == 1.0,
                f"lock frame 1 {fr[0]['lock']}, frame {int(LOCK[0] * N_FRAMES)} {fr[int(LOCK[0] * N_FRAMES) - 1]['lock']}, frame {N_FRAMES} {fr[-1]['lock']}"))
    # 7b M1 v2 fix 2026-11-03: the glass stays clear until the last GLASS_LOCK_FRAMES frames and is locked on the last one
    g0 = N_FRAMES - GLASS_LOCK_FRAMES
    res.append(("M1 v2: glass clear through frame %d, glass lock 1 on the last frame" % g0,
                all(f["lock_glass"] == 0.0 for f in fr[:g0]) and fr[-1]["lock_glass"] == 1.0 and fr[-1]["lock"] == 1.0,
                f"glass lock frame {g0} {fr[g0 - 1]['lock_glass']}, frame {g0 + 1} {fr[g0]['lock_glass']}, frame {g0 + 6} "
                f"{fr[g0 + 5]['lock_glass']}, frame {N_FRAMES} {fr[-1]['lock_glass']} (opaque lock at frame {g0}: {fr[g0 - 1]['lock']})"))
    # 8 my level matrix = card 17's
    lm = P["rs"]["level_matrix"]
    dev = max(abs(x - y) for yaw in (0, 111.3, 288.72) for r1, r2 in zip(lm([1, 2, 3], yaw), level_matrix([1, 2, 3], yaw)) for x, y in zip(r1, r2))
    res.append(("camera convention = render_segments.level_matrix", dev < 1e-12, f"max deviation {dev:.1e}"))
    return res, tf


def camera_json(P, w, h):
    rs = P["rs"]
    cdoc = rs["camera_doc"](P["doc"], SEG, P["frames"], w, h, None)
    for row, fr in zip(cdoc["frames"], P["frames"]):
        row["lock"] = fr["lock"]
        row["lock_glass"] = fr["lock_glass"]    # M1 v2 fix 2026-11-03
    tf, hit, _, _ = threshold_frame(P)
    cdoc["shot"] = "equirect-enter-846"
    cdoc["enter"] = {
        "card": 20, "from_segment": "descend-846", "from_global_frame": P["last"]["global"],
        "start_pos": [round(v, 4) for v in P["E"]], "o5_centre": [round(v, 4) for v in P["O"]], "end_pos": [round(v, 4) for v in P["L"]],
        "threshold_frame": tf, "length_m": round(P["length_m"], 3),
        "yaw_start": round(P["yaw0"], 3), "yaw_end": round(P["yaw1"], 3), "yaw_turn_deg": round(P["dyaw"], 3), "turn_tau": list(TURN),
        "lock_tau": list(LOCK),
        "lock": "per-frame 'lock' (0..1): 0 = both projectors blended by angle and visibility, glass transparent (the baked site seen "
                "through it); 1 = living projector only, glass carries the living pano. Set on the ENTER_proj node group's 'lock' value "
                "before each frame (enter.py --render does this).",
        "lock_glass_tau": list(GLASS_LOCK),     # M1 v2 fix 2026-11-03
        "lock_glass": "per-frame 'lock_glass' (0..1, M1 v2 fix 2026-11-03): the glass and the o-5 portal only; 0 = transparent "
                      "(the baked site), 1 = the living pano; the last 12 frames only (card 34's lock window). Rows without it "
                      "(written before the fix) get the same schedule from the frame number at --render.",
        "furniture": "M1 v2 fix 2026-11-03: the FURN_* catalog furniture is hidden at --render/--check and the depth maps are "
                     "re-cast without it (the panoramas paint the furniture onto the floor and walls)",
        "projectors": {k: {kk: (vv if kk != "pano" else os.path.relpath(vv, REPO).replace("\\", "/")) for kk, vv in v.items()} for k, v in P["pj"].items()},
        "handoff": "the last frame's pose = the living projector's centre and its yaw = the tour's default yaw: the tour's living scene "
                   "(Habait/tour360 scenes.json 'living') opens with the same equirect mapping",
        "scene": os.path.relpath(DEF_SCENE_OUT, REPO).replace("\\", "/")}
    return cdoc


def parse_sel(spec, n):
    if not spec:
        return list(range(1, n + 1))
    out = []
    for part in spec.split(","):
        part = part.strip()
        if "-" in part:
            x, y = part.split("-")
            out += list(range(int(x), int(y) + 1))
        elif part:
            out.append(int(part))
    return [i for i in out if 1 <= i <= n]


# ------------------------------------------------------------------------------------------------ Blender: build
def ob_class(name):
    nm = name.upper()
    for needle, v in ID_CLASSES:
        if needle in nm:
            return v
    return 4


def densify(ob, L):
    import bmesh
    sc = max(abs(v) for v in ob.matrix_world.to_scale()) or 1.0
    Ll = L / sc
    me = ob.data
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    for _ in range(12):
        long = [e for e in bm.edges if e.calc_length() > Ll]
        if not long or len(bm.verts) > 250000:
            break
        bmesh.ops.subdivide_edges(bm, edges=long, cuts=1, use_grid_fill=False)
        bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 3])
    bm.to_mesh(me)
    bm.free()
    return len(me.vertices)


def delete_faces(ob, pred):
    import bmesh
    mw = ob.matrix_world
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    kill = [f for f in bm.faces if pred(mw @ f.calc_center_median())]
    n = len(kill)
    if n:
        bmesh.ops.delete(bm, geom=kill, context="FACES")
    bm.to_mesh(ob.data)
    bm.free()
    return n


def depth_image(name, pos, yaw, bvh, path):
    """equirect distance map from a projector centre: texel (col, row-from-bottom) -> the same u, v the shader samples"""
    import numpy as np
    from mathutils import Vector
    W, H = DEPTH_RES
    C = Vector(pos)
    buf = np.zeros((H, W, 4), np.float32)
    buf[..., 3] = 1.0
    hits = 0
    for r in range(H):
        el = ((r + 0.5) / H - 0.5) * math.pi
        ce, se = math.cos(el), math.sin(el)
        for c in range(W):
            b = math.radians(yaw) + ((c + 0.5) / W - 0.5) * 2 * math.pi
            loc, _n, _i, dist = bvh.ray_cast(C, Vector((ce * math.sin(b), ce * math.cos(b), se)), 1.0e4)
            if loc is None:
                buf[r, c, :3] = 1.0e4
            else:
                buf[r, c, :3] = dist
                hits += 1
    img = bpy.data.images.new(name, W, H, alpha=False, float_buffer=True)
    img.colorspace_settings.name = "Non-Color"
    img.pixels.foreach_set(buf.ravel())
    img.update()
    img.pack()                      # a packed float buffer is stored as OpenEXR in the .blend (Image.save() wrote 8-bit PNG)
    probe = [(H // 2, 0), (H // 3, W // 2), (H // 4, W // 4)]
    back = np.zeros(W * H * 4, np.float32)
    img.pixels.foreach_get(back)
    back = back.reshape(H, W, 4)
    err = max(abs(float(back[r, c, 0]) - float(buf[r, c, 0])) for r, c in probe)
    if err > 1e-3:
        raise SystemExit(f"depth map {name}: read-back error {err} (not a float image?)")
    return img, hits / float(W * H)


def proj_group(pj):
    """ENTER_proj: emission colour of the two projectors, blended by angle and visibility, with the hand-off lock"""
    ng = bpy.data.node_groups.new("ENTER_proj", "ShaderNodeTree")
    ng.interface.new_socket(name="Color", in_out="OUTPUT", socket_type="NodeSocketColor")
    ng.interface.new_socket(name="Lock", in_out="OUTPUT", socket_type="NodeSocketFloat")
    N, Lk = ng.nodes, ng.links
    geo = N.new("ShaderNodeNewGeometry")
    lock = N.new("ShaderNodeValue")
    lock.name = lock.label = "lock"
    lock.outputs[0].default_value = 0.0

    def math_(op, x, y=None, c=None):
        n = N.new("ShaderNodeMath")
        n.operation = op
        for k, v in enumerate((x, y, c)):
            if v is None:
                continue
            if isinstance(v, (int, float)):
                n.inputs[k].default_value = float(v)
            else:
                Lk.new(v, n.inputs[k])
        return n.outputs[0]

    def vmath(op, x, y=None, scale=None):
        n = N.new("ShaderNodeVectorMath")
        n.operation = op
        Lk.new(x, n.inputs[0])
        if y is not None:
            if isinstance(y, (tuple, list)):
                n.inputs[1].default_value = y
            else:
                Lk.new(y, n.inputs[1])
        if scale is not None:
            if isinstance(scale, (int, float)):
                n.inputs[3].default_value = float(scale)
            else:
                Lk.new(scale, n.inputs[3])
        return n

    terms = {}
    for key in ("L", "T"):
        p = pj[key]
        d = vmath("SUBTRACT", geo.outputs["Position"], tuple(p["pos"])).outputs[0]
        nrm = vmath("NORMALIZE", d).outputs[0]
        sep = N.new("ShaderNodeSeparateXYZ")
        Lk.new(nrm, sep.inputs[0])
        bear = math_("ARCTAN2", sep.outputs[0], sep.outputs[1])               # atan2(dx, dy): bearing clockwise from +Y
        u = math_("MULTIPLY_ADD", bear, 1.0 / (2 * math.pi), 0.5 - p["yaw"] / 360.0)
        elev = math_("ARCSINE", sep.outputs[2])
        v = math_("MULTIPLY_ADD", elev, 1.0 / math.pi, 0.5)
        uv = N.new("ShaderNodeCombineXYZ")
        Lk.new(u, uv.inputs[0])
        Lk.new(v, uv.inputs[1])
        tex = N.new("ShaderNodeTexImage")
        tex.image = bpy.data.images.load(p["pano"], check_existing=True)
        tex.image.colorspace_settings.name = "sRGB"
        tex.extension = "REPEAT"
        tex.interpolation = "Linear"
        Lk.new(uv.outputs[0], tex.inputs["Vector"])
        cosang = math_("MULTIPLY", vmath("DOT_PRODUCT", nrm, geo.outputs["Incoming"]).outputs["Value"], -1.0)
        ang = math_("ADD", math_("POWER", math_("MAXIMUM", cosang, 0.0), 8.0), ANG_FLOOR)   # a visible projector always counts
        dtex = N.new("ShaderNodeTexImage")              # shadow map: visible when |P - C| <= depth + bias
        dtex.image = bpy.data.images["depth_" + key]
        dtex.extension = "REPEAT"
        dtex.interpolation = "Closest"
        Lk.new(uv.outputs[0], dtex.inputs["Vector"])
        sepd = N.new("ShaderNodeSeparateColor")
        Lk.new(dtex.outputs["Color"], sepd.inputs[0])
        dist = vmath("LENGTH", d).outputs["Value"]
        bias = math_("MULTIPLY_ADD", dist, DEPTH_BIAS[1], DEPTH_BIAS[0])
        vis = math_("LESS_THAN", math_("SUBTRACT", dist, sepd.outputs[0]), bias)
        w = math_("MULTIPLY", vis, ang)
        if key == "L":
            w = math_("MULTIPLY_ADD", lock.outputs[0], 1e-3, w)                  # w_L = vis*ang + 1e-3*lock
        else:
            w = math_("MULTIPLY", w, math_("SUBTRACT", 1.0, lock.outputs[0]))    # w_T = vis*ang*(1-lock)
        terms[key] = (tex.outputs["Color"], w, ang)
    # hole fill (no projector sees the point): the two projectors blended by angle alone, ignoring visibility
    hl = vmath("SCALE", terms["L"][0], scale=terms["L"][2]).outputs[0]
    ht = vmath("SCALE", terms["T"][0], scale=terms["T"][2]).outputs[0]
    hole = vmath("SCALE", vmath("ADD", hl, ht).outputs[0], scale=math_("DIVIDE", HOLE_W, math_("ADD", terms["L"][2], terms["T"][2]))).outputs[0]
    fb = N.new("ShaderNodeRGB")
    fb.outputs[0].default_value = tuple(c ** 2.2 for c in FALLBACK_SRGB) + (1.0,)
    wf = 1e-9
    sl = vmath("SCALE", terms["L"][0], scale=terms["L"][1]).outputs[0]
    st = vmath("SCALE", terms["T"][0], scale=terms["T"][1]).outputs[0]
    sf = vmath("SCALE", fb.outputs[0], scale=wf).outputs[0]
    acc = vmath("ADD", vmath("ADD", vmath("ADD", sl, st).outputs[0], sf).outputs[0], hole).outputs[0]
    wsum = math_("ADD", math_("ADD", math_("ADD", terms["L"][1], terms["T"][1]), wf), HOLE_W)
    col = vmath("SCALE", acc, scale=math_("DIVIDE", 1.0, wsum)).outputs[0]
    out = N.new("NodeGroupOutput")
    Lk.new(col, out.inputs["Color"])
    Lk.new(lock.outputs[0], out.inputs["Lock"])
    return ng


def make_materials(ng):
    m = bpy.data.materials.new("ENTER_proj")
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    g = nt.nodes.new("ShaderNodeGroup")
    g.node_tree = ng
    em = nt.nodes.new("ShaderNodeEmission")
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(g.outputs["Color"], em.inputs["Color"])
    nt.links.new(em.outputs[0], out.inputs["Surface"])
    gm = bpy.data.materials.new("ENTER_glass")
    gm.use_nodes = True
    nt = gm.node_tree
    nt.nodes.clear()
    g = nt.nodes.new("ShaderNodeGroup")
    g.node_tree = ng
    em = nt.nodes.new("ShaderNodeEmission")
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    mix = nt.nodes.new("ShaderNodeMixShader")
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(g.outputs["Color"], em.inputs["Color"])
    nt.links.new(g.outputs["Lock"], mix.inputs[0])
    nt.links.new(tr.outputs[0], mix.inputs[1])
    nt.links.new(em.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs["Surface"])
    try:
        gm.blend_method = "BLEND"
    except Exception:  # noqa: BLE001
        pass
    clay = bpy.data.materials.new("ENTER_clay")       # the check's clay: emission shaded by the geometric normal
    clay.use_nodes = True
    clay.use_fake_user = True                        # unused until --check; keep it in the saved .blend
    nt = clay.node_tree
    nt.nodes.clear()
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    dot = nt.nodes.new("ShaderNodeVectorMath")
    dot.operation = "DOT_PRODUCT"
    dot.inputs[1].default_value = (0.35, 0.55, 0.76)
    nt.links.new(geo.outputs["Normal"], dot.inputs[0])
    ab = nt.nodes.new("ShaderNodeMath")
    ab.operation = "ABSOLUTE"
    nt.links.new(dot.outputs["Value"], ab.inputs[0])
    mp = nt.nodes.new("ShaderNodeMapRange")
    mp.inputs["To Min"].default_value = 0.12
    mp.inputs["To Max"].default_value = 0.75
    nt.links.new(ab.outputs[0], mp.inputs["Value"])
    em = nt.nodes.new("ShaderNodeEmission")
    nt.links.new(mp.outputs[0], em.inputs["Color"])
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(em.outputs[0], out.inputs["Surface"])
    return m, gm, clay


def set_material(ob, mat):
    me = ob.data
    me.materials.clear()
    me.materials.append(mat)
    if len(me.polygons):
        me.polygons.foreach_set("material_index", [0] * len(me.polygons))


def eq_camera(scene):
    cd = bpy.data.cameras.new("EQ_cam")
    cd.type = "PANO"
    try:
        cd.panorama_type = "EQUIRECTANGULAR"
    except (AttributeError, TypeError):
        cd.cycles.panorama_type = "EQUIRECTANGULAR"
    for k, v in (("latitude_min", -math.pi / 2), ("latitude_max", math.pi / 2), ("longitude_min", -math.pi), ("longitude_max", math.pi)):
        try:
            setattr(cd, k, v)
        except AttributeError:
            pass
    cd.clip_start = 0.05
    cd.clip_end = 120000.0
    cam = bpy.data.objects.new("EQ_cam", cd)
    scene.collection.objects.link(cam)
    scene.camera = cam
    return cam


def build(a):
    import numpy as np
    from mathutils import Vector
    from mathutils.bvhtree import BVHTree
    t0 = time.time()
    rep = {"card": 20, "inputs": {}, "removed": {}, "densify": {}, "vis": {}, "o5_cut_faces": 0}
    if os.path.normcase(os.path.abspath(bpy.data.filepath or "")) != os.path.normcase(DEF_BAKED):
        log(f"opening {DEF_BAKED}")
        bpy.ops.wm.open_mainfile(filepath=DEF_BAKED)
    rep["inputs"]["site"] = DEF_BAKED
    rep["inputs"]["apartment"] = a.apt_blend
    scene = bpy.context.scene
    P = build_enter(a)
    pj = P["pj"]
    box = P["doc"]["end"]["box_world_846"]
    m = 0.15

    def in_box(c):
        return box[0] - m <= c.x <= box[3] + m and box[1] - m <= c.y <= box[4] + m and -0.05 <= c.z <= 2.95
    for nm in ("BK_apt", "BK_tower_hidden"):
        ob = bpy.data.objects.get(nm)
        if ob:
            bpy.data.objects.remove(ob, do_unlink=True)
            rep["removed"][nm] = "object"
    for ob in [o for o in bpy.data.objects if o.type == "MESH" and (o.name == "BK_tower" or o.name.startswith("BK_detail_"))]:
        rep["removed"][ob.name] = delete_faces(ob, in_box)
    log(f"site: removed {rep['removed']}  ({time.time() - t0:.1f}s)")

    # the apartment, appended read-only
    with bpy.data.libraries.load(a.apt_blend, link=False) as (src, dst):
        dst.objects = list(src.objects)
    col = bpy.data.collections.new("APT846")
    scene.collection.children.link(col)
    apt = []
    for ob in dst.objects:
        if ob is None:
            continue
        if ob.type in ("LIGHT", "CAMERA") or ob.name.startswith("TERRAIN"):
            bpy.data.objects.remove(ob, do_unlink=True)
            continue
        col.objects.link(ob)
        if ob.type == "MESH":
            apt.append(ob)
    bpy.context.view_layer.update()
    for ob in apt:
        if ob.data.users > 1:
            ob.data = ob.data.copy()
    # o-5 = the open slider: split the glass that spans it, then cut the glass inside its span
    d5 = P["doc"]["end"]
    A, B = Vector((*d5["o5_a_world"], 0)), Vector((*d5["o5_b_world"], 0))
    AB = B - A
    lo = (min(A.x, B.x) - 0.3, min(A.y, B.y) - 0.3)
    hi = (max(A.x, B.x) + 0.3, max(A.y, B.y) + 0.3)
    nv = 0
    for ob in apt:
        if "GLASS" not in ob.name.upper():
            continue
        bb = [ob.matrix_world @ Vector(c) for c in ob.bound_box]
        if max(v.x for v in bb) < lo[0] or min(v.x for v in bb) > hi[0] or max(v.y for v in bb) < lo[1] or min(v.y for v in bb) > hi[1]:
            continue
        nv += densify(ob, DENSIFY_M)
        rep["densify"][ob.name] = len(ob.data.vertices)
    log(f"apartment: {len(apt)} meshes; glass at o-5 split to {DENSIFY_M} m: {rep['densify']} ({time.time() - t0:.1f}s)")

    def in_o5(c):
        q = Vector((c.x, c.y, 0))
        t = (q - A).dot(AB) / AB.length_squared
        lat = (q - (A + AB * t)).length
        return 0.02 < t < 0.98 and lat < 0.3 and c.z < 2.95
    portals = []
    for ob in list(apt):
        if "GLASS" not in ob.name.upper():
            continue
        cp = ob.copy()
        cp.data = ob.data.copy()
        n_in = delete_faces(ob, in_o5)
        if not n_in:
            bpy.data.meshes.remove(cp.data)
            continue
        cp.name = "PORTAL_o-5_" + ob.name
        col.objects.link(cp)
        delete_faces(cp, lambda c: not in_o5(c))
        portals.append(cp)
        apt.append(cp)
        rep["o5_cut_faces"] += n_in
    rep["o5_portals"] = [o.name for o in portals]
    log(f"o-5 glass faces cut: {rep['o5_cut_faces']} -> portal objects {rep['o5_portals']} (transparent until the hand-off lock)")

    # visibility from both projectors (glass does not occlude: the panos see through it)
    verts, polys = [], []
    for ob in apt:
        if "GLASS" in ob.name.upper():
            continue
        mw = ob.matrix_world
        base = len(verts)
        verts += [mw @ v.co for v in ob.data.vertices]
        polys += [[base + i for i in p.vertices] for p in ob.data.polygons]
    bvh = BVHTree.FromPolygons(verts, polys, epsilon=0.0)
    for key in ("L", "T"):
        _img, share = depth_image("depth_" + key, pj[key]["pos"], pj[key]["yaw"], bvh, None)
        rep["vis"][key] = {"depth_map": "packed float image depth_" + key, "res": list(DEPTH_RES), "hit_share": round(share, 3), "bias_m": list(DEPTH_BIAS)}
    log(f"depth maps: {rep['vis']} ({time.time() - t0:.1f}s)")

    # materials, classes
    ng = proj_group(pj)
    mproj, mglass, mclay = make_materials(ng)
    for ob in apt:
        set_material(ob, mglass if "GLASS" in ob.name.upper() else mproj)
    for ob in bpy.data.objects:
        if ob.type == "MESH":
            ob.pass_index = ob_class(ob.name)
    rep["classes"] = {str(k): sum(1 for o in bpy.data.objects if o.type == "MESH" and o.pass_index == k) for k in range(1, 7)}

    # path vs the composed geometry (glass included, o-5 cut): any hit between consecutive poses?
    verts2, polys2 = [], []
    for ob in apt:
        if ob.name.startswith("PORTAL_"):
            continue
        mw = ob.matrix_world
        base = len(verts2)
        verts2 += [mw @ v.co for v in ob.data.vertices]
        polys2 += [[base + i for i in p.vertices] for p in ob.data.polygons]
    bvh2 = BVHTree.FromPolygons(verts2, polys2, epsilon=0.0)
    pts = [P["E"]] + [f["pos"] for f in P["frames"]]
    hits, clear = [], 9e9
    for k in range(len(pts) - 1):
        p0, p1 = Vector(pts[k]), Vector(pts[k + 1])
        dv = p1 - p0
        if dv.length > 1e-6:
            h = bvh2.ray_cast(p0, dv.normalized(), dv.length)
            if h[0] is not None:
                hits.append({"step": k, "face": h[2]})
        nb = bvh2.find_nearest(p1)
        if nb[0] is not None:
            clear = min(clear, nb[3])
    rep["path_vs_geometry"] = {"hits": hits, "min_clearance_m": round(clear, 3)}
    log(f"path vs geometry: {len(hits)} hits, min clearance {clear:.2f} m")

    # camera + render defaults (emission only, Standard view: the pano's sRGB comes back unchanged)
    for ob in [o for o in bpy.data.objects if o.type == "CAMERA"]:
        bpy.data.objects.remove(ob, do_unlink=True)
    eq_camera(scene)
    scene.render.engine = "CYCLES"
    c = scene.cycles
    c.samples = 16
    c.use_adaptive_sampling = False
    c.use_denoising = False
    c.max_bounces = 0
    c.transparent_max_bounces = 16
    c.caustics_reflective = c.caustics_refractive = False
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0.0
    scene.render.use_persistent_data = True
    rep["emission_sampling_off"] = no_mesh_lights(scene)
    os.makedirs(os.path.dirname(a.scene_out), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=a.scene_out, compress=False)
    rep["scene_out"] = a.scene_out
    if a.pack:
        bpy.ops.file.pack_all()
        packed = a.scene_out.replace(".blend", ".packed.blend")
        bpy.ops.wm.save_as_mainfile(filepath=packed, compress=True, copy=True)
        rep["packed"] = {"path": packed, "bytes": os.path.getsize(packed)}
    rep["seconds"] = round(time.time() - t0, 1)
    json.dump(rep, open(os.path.join(os.path.dirname(a.scene_out), "build_report.json"), "w", encoding="utf-8"), indent=1, default=str)
    log(f"saved {a.scene_out} ({rep['seconds']} s)")


# ------------------------------------------------------------------------------------------------ Blender: render
def setup_device(scene, a, log_d):
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


def no_mesh_lights(scene):
    """every surface here is emission-only and max_bounces is 0: no surface is a light. Cycles' default ('AUTO') would
    turn the ~2M emissive apartment triangles into mesh lights and evaluate each one's textured strength before frame 1."""
    n = 0
    for m in bpy.data.materials:
        try:
            if m.cycles.emission_sampling != "NONE":
                m.cycles.emission_sampling = "NONE"
                n += 1
        except AttributeError:
            pass
    try:
        scene.cycles.use_light_tree = False
    except AttributeError:
        pass
    return n


def set_lock(x, glass=None):
    ng = bpy.data.node_groups["ENTER_proj"]
    ng.nodes["lock"].outputs[0].default_value = float(x)
    gl = ng.nodes.get("lock_glass")            # M1 v2 fix 2026-11-03: the glass's own lock (default: the same value)
    if gl is not None:
        gl.outputs[0].default_value = float(x if glass is None else glass)


# ------------------------------------------------------------------------------------------------ M1 v2 fix 2026-11-03
def m1v2_furniture():
    """the catalog furniture: every FURN_<room>_<slot> empty build_scene makes (append_model / import_glb, one per
    general_furnish placement) and all its children (the Kenney / Poly Haven meshes, e.g. 'loungeDesignSofa(Clone)').
    BK_* / STUDIO_* are the baked and studio SITE (tower, podium, neighbours, ground; kf_check class 5): never touched."""
    roots = [o for o in bpy.data.objects if o.name.startswith(FURN_PREFIX)]
    objs = {}
    for r in roots:
        objs[r.name] = r
        for c in r.children_recursive:
            objs[c.name] = c
    return roots, list(objs.values())


def m1v2_projectors(cdoc):
    """projector centre + yaw exactly as the build baked them into ENTER_proj: the camera.json 'enter' block written by
    the same --build run (the descend tail's camera.json has none: fall back to enter-846's, then to cameras.json)"""
    docs = [cdoc]
    try:
        docs.append(json.load(open(os.path.join(DEF_OUT, SEG, "camera.json"), encoding="utf-8")))
    except (OSError, ValueError):
        pass
    for d in docs:
        pj = ((d or {}).get("enter") or {}).get("projectors") or {}
        if "L" in pj and "T" in pj:
            return {k: (list(pj[k]["pos"]), float(pj[k]["yaw"])) for k in ("L", "T")}, "camera.json enter block"
    try:
        pj = projectors()
        return {k: (list(pj[k]["pos"]), float(pj[k]["yaw"])) for k in ("L", "T")}, "cameras.json"
    except (OSError, ValueError, KeyError, StopIteration):
        return None, "none"


def m1v2_depth_buf(pos, yaw, bvh, W, H):
    """the build's depth_image() loop, distances only: row 0 = bottom (elevation -90), the shader's u, v"""
    import numpy as np
    from mathutils import Vector
    C = Vector(pos)
    d = np.full((H, W), 1.0e4, np.float32)
    for r in range(H):
        el = ((r + 0.5) / H - 0.5) * math.pi
        ce, se = math.cos(el), math.sin(el)
        for c in range(W):
            b = math.radians(yaw) + ((c + 0.5) / W - 0.5) * 2 * math.pi
            loc, _n, _i, dist = bvh.ray_cast(C, Vector((ce * math.sin(b), ce * math.cos(b), se)), 1.0e4)
            if loc is not None:
                d[r, c] = dist
    return d


def m1v2_redepth(cdoc, skip):
    """re-cast depth_L / depth_T with the build's occluder set (APT846 meshes, glass excluded) minus the furniture, and
    write them into the packed float images in memory. Guard: removing occluders can only push depths back, so the new
    map must be >= the built one almost everywhere; otherwise (projector mismatch) the built map is kept and logged."""
    import numpy as np
    from mathutils.bvhtree import BVHTree
    col = bpy.data.collections.get("APT846")
    if col is None:
        return {"skipped": "no APT846 collection"}
    pj, src = m1v2_projectors(cdoc)
    if pj is None:
        return {"skipped": "no projector centres found"}
    verts, polys = [], []
    for ob in col.all_objects:
        if ob.type != "MESH" or ob.name in skip or "GLASS" in ob.name.upper():
            continue
        mw = ob.matrix_world
        base = len(verts)
        verts += [mw @ v.co for v in ob.data.vertices]
        polys += [[base + i for i in p.vertices] for p in ob.data.polygons]
    bvh = BVHTree.FromPolygons(verts, polys, epsilon=0.0)
    out = {"projectors_from": src, "occluder_polys": len(polys)}
    for key in ("L", "T"):
        img = bpy.data.images.get("depth_" + key)
        if img is None:
            out[key] = "no image depth_" + key
            continue
        W, H, ch = int(img.size[0]), int(img.size[1]), int(img.channels)
        flat = np.empty(W * H * ch, np.float32)
        img.pixels.foreach_get(flat)
        old = flat.reshape(H, W, ch)[..., 0].copy()
        new = m1v2_depth_buf(pj[key][0], pj[key][1], bvh, W, H)
        tol = 1e-3 + 2e-3 * np.abs(new)
        unchanged = float(np.mean(np.abs(new - old) <= tol))
        not_nearer = float(np.mean(new >= old - tol))
        info = {"res": [W, H], "unchanged": round(unchanged, 4), "deeper_now": round(1.0 - unchanged, 4),
                "not_nearer": round(not_nearer, 4)}
        if not_nearer < 0.995:
            info["kept_built_map"] = "the re-cast map is nearer than the built one on %.1f %% of texels" % (100 * (1 - not_nearer))
            log(f"[m1v2] WARNING depth_{key}: {info['kept_built_map']}; the built map is kept (holes behind the hidden furniture)")
        else:
            buf = np.ones((H, W, ch), np.float32)
            buf[..., :min(3, ch)] = new[..., None]
            img.pixels.foreach_set(buf.ravel())
            img.update()
            back = np.empty(W * H * ch, np.float32)
            img.pixels.foreach_get(back)
            info["readback_max_err"] = float(np.max(np.abs(back.reshape(H, W, ch)[..., 0] - new)))
        out[key] = info
    return out


def m1v2_prepare(cdoc):
    """M1 v2 fix 2026-11-03, in memory only (nothing is saved): (2) the glass gets its own lock node, (1) the furniture is
    hidden from render and the depth maps are re-cast without it. Idempotent; safe on a scene built before or after."""
    t0 = time.time()
    rep = {"fix": "M1 v2 2026-11-03"}
    ng = bpy.data.node_groups["ENTER_proj"]
    gl = ng.nodes.get("lock_glass")
    if gl is None:
        gl = ng.nodes.new("ShaderNodeValue")
        gl.name = gl.label = "lock_glass"
        gl.outputs[0].default_value = 0.0
        outs = [n for n in ng.nodes if n.type == "GROUP_OUTPUT"]
        for o in outs:
            ng.links.new(gl.outputs[0], o.inputs["Lock"])      # replaces lock -> Lock: ENTER_glass's mix factor
        rep["glass_lock_node"] = f"added, linked to {len(outs)} group output(s)"
    else:
        rep["glass_lock_node"] = "present"
    roots, furn = m1v2_furniture()
    newly = [o for o in furn if not o.hide_render]
    for o in newly:
        o.hide_render = True
    meshes = [o for o in furn if o.type == "MESH"]
    rep["furniture"] = {"groups": len(roots), "objects": len(furn), "meshes": len(meshes), "newly_hidden": len(newly),
                        "groups_by_room": {}}
    for r in roots:
        room = r.name[len(FURN_PREFIX):].split("_")[0]
        rep["furniture"]["groups_by_room"][room] = rep["furniture"]["groups_by_room"].get(room, 0) + 1
    if meshes:
        rep["depth"] = m1v2_redepth(cdoc, {o.name for o in furn})
    rep["seconds"] = round(time.time() - t0, 1)
    log(f"[m1v2] {json.dumps(rep)}")
    return rep


def render_frames(a):
    from mathutils import Matrix
    seg_dir = os.path.join(a.out, a.segment)
    cj = a.camera_json or os.path.join(seg_dir, "camera.json")
    cdoc = json.load(open(cj, encoding="utf-8"))
    rows = {r["frame"]: r for r in cdoc["frames"]}
    w, h = [int(v) for v in a.res.lower().split("x")]
    sel = parse_sel(a.frames, len(rows))
    ext = ".png" if a.fmt == "PNG" else ".jpg"
    scene = bpy.context.scene
    log_d = {"args": vars(a), "res": [w, h], "samples": a.samples, "scene": bpy.data.filepath}
    setup_device(scene, a, log_d)
    r = scene.render
    r.resolution_x, r.resolution_y, r.resolution_percentage = w, h, 100
    r.image_settings.file_format = a.fmt
    r.image_settings.color_mode = "RGB"
    if a.fmt == "JPEG":
        r.image_settings.quality = 95
    scene.cycles.samples = a.samples
    scene.use_nodes = False
    log_d["emission_sampling_off"] = no_mesh_lights(scene)
    def on_disk(i):
        p = os.path.join(seg_dir, "frames", f"frame_{i:04d}{ext}")
        return os.path.exists(p) and os.path.getsize(p) >= MIN_FRAME_BYTES
    if any(a.force or not on_disk(i) for i in sel):
        log_d["m1v2"] = m1v2_prepare(cdoc)     # M1 v2 fix 2026-11-03 (skipped when every selected frame is on disk)
    cam = scene.camera
    os.makedirs(os.path.join(seg_dir, "frames"), exist_ok=True)
    times = []
    t_all = time.time()
    for i in sel:
        dst = os.path.join(seg_dir, "frames", f"frame_{i:04d}{ext}")
        if os.path.exists(dst) and os.path.getsize(dst) >= MIN_FRAME_BYTES and not a.force:
            continue
        row = rows[i]
        cam.matrix_world = Matrix(level_matrix(row["pos"], row["yaw_deg_from_plus_y_cw"]))
        glk = glass_lock_of(row, len(rows))     # M1 v2 fix 2026-11-03: 0 through frame 84, 1 on frame 96
        set_lock(row.get("lock", 0.0), glk)
        bpy.context.view_layer.update()
        scene.frame_set(row["global_frame"])
        tmp = dst[: -len(ext)] + "_tmp" + ext
        r.filepath = tmp
        t0 = time.time()
        bpy.ops.render.render(write_still=True)
        os.replace(tmp, dst)
        dt = time.time() - t0
        times.append({"frame": i, "global": row["global_frame"], "lock": row.get("lock"), "lock_glass": round(glk, 6), "s": round(dt, 2)})
        print(f"[frame] {a.segment} {i} (global {row['global_frame']}) lock {row.get('lock')} glass {glk:.4f} {dt:.2f}s", flush=True)
    set_lock(0.0)
    log_d["frames"] = times
    if times:
        steady = [x["s"] for x in times[1:]] or [times[0]["s"]]
        log_d["first_frame_s"] = times[0]["s"]
        log_d["steady_s_per_frame"] = round(sum(steady) / len(steady), 2)
    log_d["total_s"] = round(time.time() - t_all, 1)
    json.dump(log_d, open(os.path.join(seg_dir, "render_log.json"), "w", encoding="utf-8"), indent=1, default=str)
    print("[done]", json.dumps({k: log_d.get(k) for k in ("compute", "steady_s_per_frame", "total_s")}), flush=True)


def check_render(a):
    """the hand-off view: a perspective camera at the last pose (the living projector), lock 1; RGB + id + depth; then clay"""
    from mathutils import Matrix
    seg_dir = os.path.join(a.out, SEG)
    cdoc = json.load(open(a.camera_json or os.path.join(seg_dir, "camera.json"), encoding="utf-8"))
    last = cdoc["frames"][-1]
    pos, yaw = last["pos"], last["yaw_deg_from_plus_y_cw"]
    hd = os.path.join(seg_dir, "check", "handoff")
    rg = os.path.join(seg_dir, "check", "registration")
    for d in (hd, rg):
        os.makedirs(d, exist_ok=True)
    scene = bpy.context.scene
    log_d = {}
    setup_device(scene, a, log_d)
    cd = bpy.data.cameras.new("CHK_cam")
    cd.type = "PERSP"
    cd.lens = CHECK_LENS
    cd.sensor_width = 36.0
    cd.sensor_fit = "AUTO"
    cd.clip_start = 0.05
    cd.clip_end = 120000.0
    cam = bpy.data.objects.new("CHK_cam", cd)
    scene.collection.objects.link(cam)
    cam.matrix_world = Matrix(level_matrix(pos, yaw))
    scene.camera = cam
    r = scene.render
    r.resolution_x, r.resolution_y, r.resolution_percentage = CHECK_RES[0], CHECK_RES[1], 100
    r.image_settings.file_format = "PNG"
    r.image_settings.color_mode = "RGB"
    r.image_settings.color_depth = "8"
    scene.cycles.samples = a.samples
    no_mesh_lights(scene)
    log_d["m1v2"] = m1v2_prepare(cdoc)          # M1 v2 fix 2026-11-03: check the scene --render renders
    set_lock(1.0)                               # glass lock follows (1.0): the hand-off view, as before
    # passes -> compositor file outputs (id_0001.png = pass_index, depth_0001.exr metres), as Habait/studio/tools/render_shots.py
    vl = bpy.context.view_layer
    vl.use_pass_z = True
    vl.use_pass_object_index = True
    scene.use_nodes = True
    tree = scene.node_tree
    for n in list(tree.nodes):
        tree.nodes.remove(n)
    rl = tree.nodes.new("CompositorNodeRLayers")
    comp = tree.nodes.new("CompositorNodeComposite")
    tree.links.new(rl.outputs["Image"], comp.inputs["Image"])
    fd = tree.nodes.new("CompositorNodeOutputFile")
    fd.base_path = hd
    fd.format.file_format = "OPEN_EXR"
    fd.format.color_depth = "32"
    fd.format.color_mode = "RGB"
    fd.file_slots[0].path = "depth_"
    tree.links.new(rl.outputs["Depth"], fd.inputs[0])
    div = tree.nodes.new("CompositorNodeMath")
    div.operation = "DIVIDE"
    div.inputs[1].default_value = 65535.0
    tree.links.new(rl.outputs["IndexOB"], div.inputs[0])
    fi = tree.nodes.new("CompositorNodeOutputFile")
    fi.base_path = hd
    fi.format.file_format = "PNG"
    fi.format.color_depth = "16"
    fi.format.color_mode = "BW"
    fi.file_slots[0].path = "id_"
    tree.links.new(div.outputs[0], fi.inputs[0])
    scene.frame_set(1)
    t0 = time.time()
    r.filepath = os.path.join(hd, "test_persp.png")
    bpy.ops.render.render(write_still=True)
    t1 = time.time() - t0
    # clay variant (apartment only; the site keeps its baked skins, glass stays transparent)
    scene.use_nodes = False
    set_lock(0.0)
    clay = bpy.data.materials["ENTER_clay"]
    col = bpy.data.collections["APT846"]
    for ob in col.all_objects:
        if ob.type == "MESH" and "GLASS" not in ob.name.upper():
            ob.data.materials[0] = clay
    r.filepath = os.path.join(rg, "frame_0001.png")
    t0 = time.time()
    bpy.ops.render.render(write_still=True)
    t2 = time.time() - t0
    look = [pos[0] + 10 * math.sin(math.radians(yaw)), pos[1] + 10 * math.cos(math.radians(yaw)), pos[2]]
    cam_doc = {"shot": "enter-846-handoff", "note": "perspective hand-off view at the last pose of enter-846 (= the living projector); "
               "kf_check shot-dir", "frames": [{"frame": 1, "pos": pos, "look": look, "lens_mm": CHECK_LENS, "sensor_mm": 36.0,
                                                 "res": list(CHECK_RES), "yaw_deg_from_plus_y_cw": yaw}]}
    for d in (hd, rg):
        json.dump(cam_doc, open(os.path.join(d, "camera.json"), "w", encoding="utf-8"), indent=1)
    for fn in ("id_0001.png", "depth_0001.exr"):
        if os.path.exists(os.path.join(hd, fn)):
            shutil.copyfile(os.path.join(hd, fn), os.path.join(rg, fn))
    print(f"[check] handoff {t1:.2f}s, clay {t2:.2f}s -> {hd}, {rg}", flush=True)
    # nothing saved: the .blend on disk keeps lock 0 and the projection materials


# ------------------------------------------------------------------------------------------------ check prep (venv python)
def persp_from_equi(img, centre_bearing, cam_yaw, w, h, lens=CHECK_LENS, sensor=36.0):
    import numpy as np
    import cv2
    H, W = img.shape[:2]
    f = lens / sensor * w
    jj, ii = np.meshgrid(np.arange(w) + 0.5, np.arange(h) + 0.5)
    x = (jj - w / 2) / f
    y = (h / 2 - ii) / f
    s, c = math.sin(math.radians(cam_yaw)), math.cos(math.radians(cam_yaw))
    dx = s + x * c
    dy = c - x * s
    dz = y
    b = np.degrees(np.arctan2(dx, dy))
    el = np.degrees(np.arctan2(dz, np.hypot(dx, dy)))
    u = (0.5 + ((b - centre_bearing + 180) % 360 - 180) / 360.0) * W - 0.5
    v = (0.5 - el / 180.0) * H - 0.5
    return cv2.remap(img, u.astype(np.float32), v.astype(np.float32), cv2.INTER_LINEAR, borderMode=cv2.BORDER_WRAP)


def check_prep(a):
    import cv2
    import numpy as np
    seg_dir = os.path.join(a.out, SEG)
    cdoc = json.load(open(os.path.join(seg_dir, "camera.json"), encoding="utf-8"))
    last = cdoc["frames"][-1]
    yaw = last["yaw_deg_from_plus_y_cw"]
    pj = projectors()
    hd = os.path.join(seg_dir, "check", "handoff")
    rg = os.path.join(seg_dir, "check", "registration")
    for d in (hd, rg):
        os.makedirs(d, exist_ok=True)
    pano = cv2.imdecode(np.fromfile(pj["L"]["pano"], np.uint8), cv2.IMREAD_COLOR)
    ref = persp_from_equi(pano, pj["L"]["yaw"], yaw, *CHECK_RES)
    cv2.imwrite(os.path.join(hd, "frame_0001.png"), ref)
    cv2.imwrite(os.path.join(rg, "kf_pano.png"), ref)
    out = {"ref": os.path.join(hd, "frame_0001.png"), "pano": pj["L"]["pano"], "yaw": yaw}
    if a.last:
        eq = cv2.imread(a.last, cv2.IMREAD_COLOR)
        cv2.imwrite(os.path.join(hd, "test_last.png"), persp_from_equi(eq, yaw, yaw, *CHECK_RES))
        out["test_last"] = os.path.join(hd, "test_last.png")
        out["last_equirect"] = a.last
        out["last_equirect_res"] = [eq.shape[1], eq.shape[0]]
    # the three frames for Eliran (T1): first (outside, one step after descend-846), threshold (o-5), last (hand-off), + the pano
    tf = cdoc.get("enter", {}).get("threshold_frame")
    picks = [(1, "1: outside (descend-846 end + 1)"), (tf, f"{tf}: threshold o-5"), (len(cdoc["frames"]), f"{len(cdoc['frames'])}: last = hand-off")]
    tiles = []
    for i, label in picks:
        p = os.path.join(seg_dir, "frames", f"frame_{i:04d}.png") if i else ""
        if p and os.path.exists(p):
            im = cv2.imread(p, cv2.IMREAD_COLOR)
            im = cv2.resize(im, (1024, 512), interpolation=cv2.INTER_LINEAR)
            cv2.putText(im, label, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2, cv2.LINE_AA)
            tiles.append(im)
    if tiles:
        pr = cv2.resize(pano, (1024, 512), interpolation=cv2.INTER_AREA)
        cv2.putText(pr, "tour pano 04-living (balanced), the hand-off target", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2, cv2.LINE_AA)
        tiles.append(pr)
        sheet = os.path.join(seg_dir, "check", "three_frames.jpg")
        cv2.imwrite(sheet, np.vstack(tiles), [cv2.IMWRITE_JPEG_QUALITY, 88])
        out["sheet"] = sheet
    json.dump(out, open(os.path.join(hd, "prep.json"), "w", encoding="utf-8"), indent=1)
    print(f"[check-prep] {json.dumps(out)}", flush=True)


# ------------------------------------------------------------------------------------------------ main
def main():
    a = parse_args()
    if a.check_prep:
        check_prep(a)
        return
    if bpy is not None and a.render:
        render_frames(a)
        return
    if bpy is not None and a.check:
        check_render(a)
        return
    P = build_enter(a)
    w, h = [int(v) for v in a.res.lower().split("x")]
    res, tf = checks(P)
    fr = P["frames"]
    print(f"[enter] {SEG}: {len(fr)} frames ({len(fr) / FPS:.1f} s @ {FPS} fps), global {fr[0]['global']}-{fr[-1]['global']} "
          f"(after descend-846 ends at global {P['last']['global']}); length {P['length_m']:.2f} m; threshold frame {tf}", flush=True)
    print(f"[enter] start {[round(v, 3) for v in P['E']]} yaw {P['yaw0']:.2f} -> o-5 {[round(v, 3) for v in P['O']]} -> "
          f"cp-living {[round(v, 3) for v in P['L']]} yaw {P['yaw1']:.2f}", flush=True)
    for name, good, detail in res:
        print(f"  [{'PASS' if good else 'FAIL'}] {name}: {detail}", flush=True)
    nfail = sum(1 for _, g, _ in res if not g)
    print(f"checks: {len(res) - nfail}/{len(res)} pass", flush=True)
    if a.selftest:
        sys.exit(1 if nfail else 0)
    if nfail and not a.build:
        raise SystemExit("path checks failed")
    if a.plan_only or a.build:
        seg_dir = os.path.join(a.out, SEG)
        os.makedirs(os.path.join(seg_dir, "frames"), exist_ok=True)
        json.dump(camera_json(P, w, h), open(os.path.join(seg_dir, "camera.json"), "w", encoding="utf-8"), indent=1)
        log(f"{seg_dir}/camera.json: {len(fr)} frames at {w}x{h}")
    if a.build:
        if bpy is None:
            raise SystemExit("--build runs inside Blender")
        build(a)


main()
