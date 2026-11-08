"""camera.json for the REAL frames of a v2v clip, from the clay's camera.json.

Frame correspondence (measured 2026-11-03 on Rainbow, card 35): Kling 4.0 v2v returns N+1 frames for an N-frame clay
(orbit 408->409, arc 168->169, ring 240->241) and 409->409 on the full flight. The default model is the endpoint-matched
linear time map: real frame 1 <-> the clay video's first camera frame, real frame R <-> its last, linear in between
(the same map habait-ba's live holdpull uses: real 409 <-> clay 420, real 265 <-> clay 272). Identity and this map
differ by at most one frame; neither image metric tried (edge F-score, gradient NCC) could tell them apart.

The time map is a MODEL, not a measurement: Kling can follow the clay's motion but not its timing. On Rainbow's arc the
hold pose (clay 91) appears at real frame ~65 (ORB against the orbit's last frame, rest_anchor.py). So a track can carry
measured anchors (real frame, clay frame) and the map becomes piecewise linear through them; camera.json records which
anchors are measured and which are assumed.

Frames: plan-world metres (X = x_cm/100, Y = -y_cm/100, Z up, the unit's floor at z 0), Blender camera convention
(looks along local -Z, up = local +Y, no roll; matrix_world = camera -> world), as Habait/flyover/orbit/camera.json.
"""
from __future__ import annotations

import math

SCHEMA = "habait-engine/video-camera.v1"
CONVENTION = ("Blender camera: looks along local -Z, up = local +Y, no roll; matrix_world = camera to world; "
              "yaw = plan bearing of the view direction, clockwise from +Y")
WORLD = ("plan-world metres: X = x_cm/100, Y = -y_cm/100, Z up, the unit's floor at z 0 "
         "(as Habait/flyover/orbit/camera.json)")


# ------------------------------------------------------------------------------------------------- frame mapping
def lin_map(k: float, n_real: int, c0: float, c1: float) -> float:
    """Real frame k (1-based) -> clay camera frame (1-based, float); endpoint-matched linear."""
    if n_real <= 1:
        return float(c0)
    return c0 + (k - 1) * (c1 - c0) / (n_real - 1)


def anchored_map(k: float, n_real: int, c0: float, c1: float, anchors=()) -> float:
    """Piecewise linear through (1, c0), the anchors [(real, clay), ...] and (n_real, c1), clamped to the clay range.
    With no anchors it equals lin_map."""
    pts = sorted({(1.0, float(c0)), (float(n_real), float(c1)), *((float(a[0]), float(a[1])) for a in anchors)})
    lo, hi = min(c0, c1), max(c0, c1)
    if k <= pts[0][0]:
        return float(pts[0][1])
    for (r0, v0), (r1, v1) in zip(pts, pts[1:]):
        if k <= r1:
            v = v1 if r1 == r0 else v0 + (k - r0) * (v1 - v0) / (r1 - r0)
            return min(hi, max(lo, v))
    return float(pts[-1][1])


def inverse_map(clay: float, n_real: int, c0: float, c1: float, anchors=()) -> int:
    """The real frame (1-based) whose mapped clay frame is nearest to `clay`."""
    return min(range(1, n_real + 1), key=lambda k: abs(anchored_map(k, n_real, c0, c1, anchors) - clay))


# ---------------------------------------------------------------------------------------------- camera geometry
def _norm(v):
    n = math.sqrt(sum(x * x for x in v)) or 1.0
    return [x / n for x in v]


def _cross(a, b):
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]


def matrix_world(pos, look_dir):
    """4x4 (row-major lists) camera->world for a Blender camera at pos looking along look_dir, no roll."""
    d = _norm(look_dir)
    right = _cross(d, [0.0, 0.0, 1.0])
    if math.sqrt(sum(x * x for x in right)) < 1e-9:     # straight up / down: any right vector
        right = [1.0, 0.0, 0.0]
    right = _norm(right)
    up = _cross(right, d)
    back = [-x for x in d]

    def r(x):
        return round(x, 6)
    return [[r(right[0]), r(up[0]), r(back[0]), r(pos[0])],
            [r(right[1]), r(up[1]), r(back[1]), r(pos[1])],
            [r(right[2]), r(up[2]), r(back[2]), r(pos[2])],
            [0.0, 0.0, 0.0, 1.0]]


def normalise(f: dict) -> dict:
    """One clay camera frame (orbit format with look_dir / matrix_world, or the Studio's pos + look point) ->
    {pos, look_dir, lens_mm, sensor_mm, res}."""
    pos = [float(x) for x in f["pos"]]
    if f.get("look_dir"):
        d = _norm([float(x) for x in f["look_dir"]])
    elif f.get("look"):
        d = _norm([float(b) - float(a) for a, b in zip(pos, f["look"])])
    elif f.get("matrix_world"):
        m = f["matrix_world"]
        d = _norm([-m[0][2], -m[1][2], -m[2][2]])
    else:
        raise ValueError(f"camera frame {f.get('frame')} has no look_dir / look / matrix_world")
    return {"pos": pos, "look_dir": d, "lens_mm": float(f.get("lens_mm") or 0) or None,
            "sensor_mm": float(f.get("sensor_mm") or 36.0), "res": list(f.get("res") or [])}


def fovs(lens_mm, sensor_mm, res):
    """(hfov, vfov) in degrees; Blender sensor fit AUTO on a landscape frame = the sensor width is horizontal."""
    h = 2 * math.degrees(math.atan(sensor_mm / 2 / lens_mm))
    w, hh = (res or [16, 9])[:2]
    v = 2 * math.degrees(math.atan(math.tan(math.radians(h / 2)) * hh / w))
    return round(h, 4), round(v, 4)


def frame_entry(n: dict, frame: int, clay_frame: float, fps: float) -> dict:
    d = n["look_dir"]
    yaw = (math.degrees(math.atan2(d[0], d[1])) + 360) % 360
    pitch = math.degrees(math.asin(max(-1.0, min(1.0, d[2]))))
    h, v = fovs(n["lens_mm"], n["sensor_mm"], n["res"])
    return {"frame": frame, "clay_frame": round(clay_frame, 3), "t_s": round((frame - 1) / fps, 4),
            "pos": [round(x, 4) for x in n["pos"]], "look_dir": [round(x, 6) for x in d],
            "yaw_deg_from_plus_y_cw": round(yaw, 4), "pitch_deg": round(pitch, 4), "lens_mm": round(n["lens_mm"], 4),
            "sensor_mm": n["sensor_mm"], "hfov_deg": h, "vfov_deg": v, "res": n["res"],
            "matrix_world": matrix_world(n["pos"], d)}


def sample(frames: list, f: float) -> dict:
    """The clay camera at fractional frame f (1-based = list index + 1): pos and lens lerped, look_dir lerped and
    renormalised."""
    n = len(frames)
    f = min(max(f, 1.0), float(n))
    i0 = int(math.floor(f)) - 1
    i1 = min(i0 + 1, n - 1)
    t = f - 1 - i0
    a = normalise(frames[i0])
    if t <= 1e-9 or i0 == i1:
        return a
    b = normalise(frames[i1])

    def lerp(x, y):
        return [p + (q - p) * t for p, q in zip(x, y)]
    la, lb = a["lens_mm"], b["lens_mm"]
    lens = la + (lb - la) * t if (la and lb) else (la or lb)
    return {"pos": lerp(a["pos"], b["pos"]), "look_dir": _norm(lerp(a["look_dir"], b["look_dir"])),
            "lens_mm": lens, "sensor_mm": a["sensor_mm"], "res": a["res"]}


def real_camera(clay_cam: dict, n_real: int, fps: float, clay_frames=None, anchors=(), parent=None, loop=False,
                res=None, note=None) -> dict:
    """camera.json for n_real real frames.

    clay_frames = (c0, c1): the clay camera frames the clay VIDEO covers (1-based; default: all of them).
    parent = {"n_real": P, "first": a}: the real clip is frames a..a+n_real-1 of a longer real clip of P frames
             (descent-846 = frames 96..201 of the 409-frame full flight); the time map runs on the parent.
    anchors = [(real, clay, how)]: measured correspondences (real numbered in the PARENT when there is one).
    loop: period n_real (the clay's frame N+1 == frame 1): real k <-> clay c0 + (k-1)*(c1-c0+1)/n_real.
    """
    frames = clay_cam["frames"]
    c0, c1 = clay_frames or (1, len(frames))
    P = (parent or {}).get("n_real", n_real)
    first = (parent or {}).get("first", 1)
    anc = [(float(a[0]), float(a[1])) for a in anchors]
    out = []
    for k in range(1, n_real + 1):
        kp = first + k - 1
        if loop:
            span = c1 - c0 + 1
            cf = c0 + ((kp - 1) * span / P) % span
        else:
            cf = anchored_map(kp, P, c0, c1, anc)
        e = frame_entry(sample(frames, cf), k, cf, fps)
        if res:
            e["res"] = list(res)
        out.append(e)
    model = "loop-linear" if loop else ("piecewise-linear" if anc else "linear-endpoints")
    return {"schema": SCHEMA, "frame_world": clay_cam.get("frame_world") or WORLD,
            "camera_convention": CONVENTION, "fps": fps, "n_frames": n_real, "loop": bool(loop),
            "mapping": {"model": model, "clay_frames": [c0, c1], "parent": parent or None,
                        "anchors": [{"real": a[0], "clay": a[1], "how": (a[2] if len(a) > 2 else "measured")}
                                    for a in anchors],
                        "assumed": ("real k <-> clay by time with period n_real" if loop else
                                    "real first <-> clay first and real last <-> clay last, linear between anchors")},
            "note": note, "frames": out}


def end_pose(cam: dict, which: int = -1) -> dict:
    f = cam["frames"][which]
    return {k: f[k] for k in ("frame", "pos", "look_dir", "yaw_deg_from_plus_y_cw", "pitch_deg", "hfov_deg")}


def nearest_camera_point(plan: dict, pos_m) -> dict | None:
    """The plan.json camera point nearest to a plan-world position (plan cm: x = X*100, y = -Y*100)."""
    x, y = pos_m[0] * 100.0, -pos_m[1] * 100.0
    best = None
    for c in plan.get("camera_points") or []:
        d = math.hypot(c["x"] - x, c["y"] - y)
        if best is None or d < best[0]:
            best = (d, c)
    if not best:
        return None
    d, c = best
    return {"camera_point": c["id"], "room_id": c.get("room_id"), "distance_cm": round(d, 1),
            "camera_point_yaw_deg": c.get("yaw_deg")}
