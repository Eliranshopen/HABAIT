"""kedma-d1: camera points the rule places too close to a fixture, moved by hand (2026-11-17).

The runner's rule (the deepest point clear of the drawn fixtures) put the shower-room camera 19 cm from the vanity and 20 cm from the
shower screen: the room is 125 cm deep and the rule's point sat in the gap between the two. A point on the door's axis is 39 cm from the
vanity's front and from the north wall, and more than 60 cm from the screen and the toilet (jobs/kedma-d1/review/flat/sheet-room-r-shower.jpg).

Run AFTER the runner's `cameras` step (it rewrites every point by rule). Idempotent.
usage: python fix_cameras_1117.py <apartment dir>
"""
import json
import math
import os
import sys

PX = 2.25
# scene id -> (x cm, y cm, the bearing the panorama's centre faces, why)
MOVE = {"shower": (447.0, 1291.0, 115.0, "by hand 2026-11-17: on the door's axis, 39 cm from the vanity's front and from the north wall (the rule's point stood 19 cm from the vanity)")}

apt = sys.argv[1]
cams_p, plan_p = os.path.join(apt, "cameras.json"), os.path.join(apt, "plan.general.json")
cams, plan = json.load(open(cams_p, encoding="utf-8")), json.load(open(plan_p, encoding="utf-8"))
log = []
for sid, (x, y, yaw, why) in MOVE.items():
    sc = next(s for s in cams["scenes"] if s["id"] == sid)
    r = math.radians(yaw)
    at = [round(x * PX), round(y * PX)]
    look = [round((x + math.sin(r) * 300.0) * PX), round((y - math.cos(r) * 300.0) * PX)]
    if sc["at"] != at or sc["lookAt"] != look:
        sc["at"], sc["lookAt"] = at, look
        sc.setdefault("_rule", {})["note"] = why
        log.append(f"cameras.json {sid}: at {at}")
    cp = next(c for c in plan["camera_points"] if c["id"] == "cp-" + sid)
    if (cp["x"], cp["y"], cp["yaw_deg"]) != (x, y, yaw):
        cp["x"], cp["y"], cp["yaw_deg"], cp["note"] = x, y, yaw, why
        log.append(f"plan camera cp-{sid}: {x},{y} yaw {yaw}")
json.dump(cams, open(cams_p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
json.dump(plan, open(plan_p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("; ".join(log) if log else "already applied")
