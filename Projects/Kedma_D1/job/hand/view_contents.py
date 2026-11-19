"""kedma-d1 ($0): what one straight-line view of a viewpoint really contains, read from the 3D model - the keys of its prompt.

Why (2026-11-17): a prompt that names a thing the view does not contain makes the image model paint it (an armchair in the middle of
the floor, a second hob). Which pieces a view shows is a fact of the model: every built piece and every opening is projected into the
view and tested against the render's own depth, so a piece hidden behind a wall is not named.

usage: python view_contents.py <apartment dir> <tour dir> <camera id> --yaw Y --pitch P --hfov H [--min 3]
prints one JSON line: {"keys": [...look keys for hand/redo_prompt.py...], "seen": {key: [piece ids]}, "outdoor": bool, "room": "..."}
"""
import argparse
import io
import json
import math
import os

import cv2
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument("apt"); ap.add_argument("tour"); ap.add_argument("cam")
ap.add_argument("--yaw", type=float, required=True); ap.add_argument("--pitch", type=float, default=0.0); ap.add_argument("--hfov", type=float, default=100.0)
ap.add_argument("--min", type=int, default=3)
a = ap.parse_args()
plan = json.load(io.open(os.path.join(a.apt, "plan.general.json"), encoding="utf-8"))
res = json.load(io.open(os.path.join(a.tour, "_furnish", "placements.json"), encoding="utf-8"))["resolved"]
pt = json.load(io.open(os.path.join(a.tour, "renders", a.cam, "pano.render.json"), encoding="utf-8"))["point"]
cx, cy, cz = (float(v) for v in pt["plan_cm"]); cyaw = float(pt["yaw_deg"])
d = cv2.imread(os.path.join(a.tour, "renders", a.cam, "depth.png"), cv2.IMREAD_COLOR)
RNG = ((d[..., 2].astype(np.int64) << 16) | (d[..., 1].astype(np.int64) << 8) | d[..., 0].astype(np.int64)).astype(np.float64)
DH, DW = RNG.shape
y, p = math.radians(a.yaw), math.radians(a.pitch)
F = np.array([math.cos(p) * math.sin(y), math.sin(p), math.cos(p) * math.cos(y)])
Rv = np.array([math.cos(y), 0.0, -math.sin(y)])
U = np.array([-math.sin(p) * math.sin(y), math.cos(p), -math.sin(p) * math.cos(y)])
T = math.tan(math.radians(a.hfov) / 2) * 0.97            # a thing must be inside the frame, not on its very edge


def seen(points, through=False):
    """is the thing shown: how many of its plan points (x, y, z cm) are inside the frame and not hidden by something nearer in the
    render - against a count that doubles for a thing farther than 4.5 m (a sliver of a far wardrobe through two doorways is not named)"""
    n, near, box = 0, 1e9, [1e9, 1e9, -1e9, -1e9]
    for x, yy, z in points:
        dx, dy, dz = x - cx, yy - cy, z - cz
        dist = math.sqrt(dx * dx + dy * dy + dz * dz)
        if dist < 1:
            continue
        psi = math.radians(math.degrees(math.atan2(dx, -dy)) - cyaw)
        lat = math.asin(dz / dist)
        v = np.array([math.cos(lat) * math.sin(psi), math.sin(lat), math.cos(lat) * math.cos(psi)])
        al = float(v @ F)
        if al <= 0.05 or abs(float(v @ Rv) / al) > T or abs(float(v @ U) / al) > T:
            continue
        u = int(((psi / (2 * math.pi) + 0.5) % 1.0) * DW) % DW
        w = min(DH - 1, max(0, int((0.5 - lat / math.pi) * DH)))
        r = RNG[w, u]
        tol = max(14.0, 0.035 * dist)
        if (r >= dist - tol) if through else (abs(r - dist) <= tol):
            n += 1
            near = min(near, dist)
            vx, vy = float(v @ Rv) / al, float(v @ U) / al
            box = [min(box[0], vx), min(box[1], vy), max(box[2], vx), max(box[3], vy)]
    # 2026-11-17: a thing must also take a real part of the picture - at least 0.6 % of the frame. A bedroom wardrobe seen as a sliver
    # through the corridor mouth and a doorway was named in the prompt, and the image model closed the whole corridor mouth with
    # wardrobe doors (the passage to the rooms, gone again).
    share = max(0.0, box[2] - box[0]) * max(0.0, box[3] - box[1]) / (4 * T * T) if n else 0.0
    return n >= (a.min if near < 450.0 else 2 * a.min) and (through or share >= 0.0015)


def box_points(poly, z0, z1):
    pts = np.array(poly, float)
    c = pts.mean(0)
    xy = [tuple(q) for q in pts] + [tuple((pts[i] + pts[(i + 1) % len(pts)]) / 2) for i in range(len(pts))] + [tuple(c)]
    return [(x, yy, z0 + f * (z1 - z0)) for x, yy in xy for f in (0.08, 0.5, 0.95)]


room = next(c["room_id"] for c in plan["camera_points"] if c["id"] == a.cam)
# the open space the camera stands in: the rooms joined to its room by open passages or by the terrace's glass door. A piece in a room
# behind a DOOR is not named, however much of it shows through the doorway (2026-11-17: a bedroom wardrobe seen through the corridor
# mouth and a doorway was named, and the image model closed the corridor mouth with wardrobe doors): the render shows it, that is enough.
group, grew = {room}, True
while grew:
    grew = False
    for o in plan["openings"]:
        if o["kind"] in ("opening", "sliding_door"):
            rs = [r for r in (o.get("rooms") or []) if r and r != "outside"]
            if any(r in group for r in rs) and not all(r in group for r in rs):
                group |= set(rs); grew = True
rtype = next(r["type"] for r in plan["rooms"] if r["id"] == room)
fix = {f["id"]: f for f in plan["fixtures"]}
CLASS_KEY = {"kitchen_sink": "sink", "stove": "hob", "sofa": "sofa", "armchair": "armchair", "tv_unit": "tv", "tv": "tv", "plant": "plant", "rug": "rug",
             "bed_double": "bed", "bed_single": "bed", "toilet": "wc", "bathroom_sink": "vanity", "mirror": "vanity", "bathtub": "bathtub",
             "bookcase": "pantry", "kitchen_upper": "uppers", "nightstand": None, "table_lamp": None, "hood": None, "bath_mat": None}
KIND_KEY = {"kitchen_tall": "tall", "fridge": "fridge", "closet": "wardrobe", "kitchen_uppers": "uppers", "kitchen_shelves": None, "shower": "shower",
            "washing_machine": "washer", "sun_lounger": "lounger", "bar_stool": "stools", "pouf": "pouf", "ac_condenser": None, "water_heater": None}
found = {}


def note(key, pid):
    if key:
        found.setdefault(key, []).append(pid)


for q in res["placements"]:
    if q["room_id"] not in group:
        continue
    z0 = float(q["z_cm"]) if q.get("z_cm") is not None else 0.0
    z1 = z0 + float(q.get("height_cm") or 60.0)
    if not seen(box_points(q["footprint_cm"], z0, z1)):
        continue
    cls, src = q["class"], q["source"].split(":")[-1]
    base = fix.get(src, {})
    if cls == "kitchen_cabinet":
        note("island" if base.get("kind") == "island" else "base", q["id"]); note(None if base.get("kind") == "island" else "worktop", q["id"])
    elif cls in ("dining_table", "dining_chair"):
        owner = fix.get(q.get("parent") or src, base)
        rid = owner.get("room_id", q["room_id"])
        chairs = owner.get("chairs_per_side")
        note("outdoor_table" if rid == "r-balcony" else "desk" if (chairs and sum(chairs) == 1) else "dining", q["id"])
    else:
        note(CLASS_KEY.get(cls, None) if cls in CLASS_KEY else None, q["id"])
for q in res["procedural"]:
    if q["room_id"] not in group:
        continue
    polys = [pp for part in q["parts"] for pp in part["poly_cm"]]
    zs = [z for part in q["parts"] for z in part["z_cm"]]
    pts = np.array(polys)
    (ax, ay), (bx, by) = pts.min(0), pts.max(0)
    if not seen(box_points([[ax, ay], [bx, ay], [bx, by], [ax, by]], min(zs), max(zs))):
        continue
    if q["kind"] == "round_table":
        note("coffee" if q["room_id"] == "r-living" else "round_table", q["id"])
    else:
        note(KIND_KEY.get(q["kind"]), q["id"])
FRONT = {"w-kitchen", "w-master", "o-11"}                 # openings in the terrace-side (west) front: the developer's open view
for o in plan["openings"]:
    (ax, ay), (bx, by) = o["a_cm"], o["b_cm"]
    z0, z1 = float(o.get("sill_cm") or 0.0), float(o.get("head_cm") or 210.0)
    pts = [(ax + t * (bx - ax), ay + t * (by - ay), z0 + f * (z1 - z0)) for t in (0.15, 0.5, 0.85) for f in (0.2, 0.5, 0.8)]
    if not seen(pts, through=True):
        continue
    k = o["kind"]
    if k == "opening":                                    # an open passage between two spaces: said in words, so it is never closed
        note("passage", o["id"])
        continue
    note("entrance" if k == "entrance_door" else "slider" if k == "sliding_door" else "door" if k == "door"
         else ("window_view" if o["id"] in FRONT else "window_plain"), o["id"])
outdoor = rtype in ("balcony", "service_balcony")
if outdoor:
    for k in ("deck", "railing", "sky", "facade"):
        found.setdefault(k, [])
    if any(pid.startswith("t-p") for pid in found.get("plant", [])):
        found["palm"] = found.pop("plant")
if rtype in ("bathroom", "toilet"):
    found.setdefault("wet_walls", [])
print(json.dumps({"keys": list(found), "seen": found, "outdoor": outdoor, "room": room, "type": rtype}, ensure_ascii=False))
