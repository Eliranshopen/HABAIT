"""kedma-d1: the camera set of a tour that is redone one room at a time (2026-11-17).

A room that has been redone (true-geometry redo) is shown from the camera its new render was taken from; a room that still shows its
2026-11-16 picture keeps the camera THAT picture was taken from - its arrows and its fidelity gate are computed from it. Mixing them the
other way round (new cameras under old pictures) points every arrow of the old pictures wrong: the living camera moved 187 cm.

Sources (never altered):
  new  = <job>/cameras-1117/{cameras.json, camera_points.json}   - today's rule set, saved here on the first run from the apartment
  old  = <job>/before-island/{cameras.json, apartment.plan.general.json}
Writes <apt>/cameras.json and the camera_points of <apt>/plan.general.json. Idempotent.

usage: python mixed_cameras.py <apt folder> <job folder> --redone kitchen[,living,...]
"""
import argparse
import io
import json
import os

ap = argparse.ArgumentParser()
ap.add_argument("apt"); ap.add_argument("job"); ap.add_argument("--redone", default="")
a = ap.parse_args()
redone = [s for s in a.redone.split(",") if s]


def load(p):
    return json.load(io.open(p, encoding="utf-8"))


def save(p, d):
    # the files' own form: one-space indent, CRLF (as the runner writes them)
    io.open(p, "w", encoding="utf-8", newline="").write(json.dumps(d, ensure_ascii=False, indent=1).replace("\n", "\r\n") + "\r\n")


keep = os.path.join(a.job, "cameras-1117")
os.makedirs(keep, exist_ok=True)
cam_now = load(os.path.join(a.apt, "cameras.json"))
plan = load(os.path.join(a.apt, "plan.general.json"))
kc, kp = os.path.join(keep, "cameras.json"), os.path.join(keep, "camera_points.json")
if not os.path.exists(kc):          # first run: the apartment still holds today's rule set
    save(kc, cam_now)
    save(kp, plan["camera_points"])
new_cam, new_pts = load(kc), {c["id"]: c for c in load(kp)}
old_cam = load(os.path.join(a.job, "before-island", "cameras.json"))
old_pts = {c["id"]: c for c in load(os.path.join(a.job, "before-island", "apartment.plan.general.json"))["camera_points"]}

ids = [s["id"] for s in new_cam["scenes"]]
bad = [r for r in redone if r not in ids]
if bad:
    raise SystemExit("unknown scene ids: " + ", ".join(bad))
old_by = {s["id"]: s for s in old_cam["scenes"]}
out = dict(new_cam)
out["scenes"] = [s if s["id"] in redone else old_by[s["id"]] for s in new_cam["scenes"]]
out["note"] = (new_cam.get("note", "") + " | mixed set 2026-11-17 (hand/mixed_cameras.py): redone rooms = "
               + (",".join(redone) or "none") + " on today's cameras, every other room on the camera of its 2026-11-16 picture").strip()
if " | mixed set" in new_cam.get("note", ""):
    out["note"] = new_cam["note"].split(" | mixed set")[0] + out["note"][len(new_cam.get("note", "")):]
save(os.path.join(a.apt, "cameras.json"), out)

pts = []
for c in plan["camera_points"]:
    sid = c["id"].replace("cp-", "", 1)
    pts.append(new_pts[c["id"]] if sid in redone else old_pts[c["id"]])
plan["camera_points"] = pts
save(os.path.join(a.apt, "plan.general.json"), plan)
for c in pts:
    print(c["id"].ljust(12), "new" if c["id"].replace("cp-", "", 1) in redone else "old", c["x"], c["y"], c["yaw_deg"])
