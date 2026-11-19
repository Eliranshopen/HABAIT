"""Step 25 ($0) - the standpoints of the photo skin (Eliran 2026-11-18: «אני רוצה את התוצאה הטובה ביותר והריאליסטית ביותר»; his pick in the
dialog: the photo skin, cap $8, no stop to look). Every room gets views from opposite corners looking across it (four in the big
rooms), at eye level, slightly down; each view names his picture of that room as the look reference for step 26.
Writes work/realism/views.json: [{name, room, ref, x, y, yaw (walk me.yaw), pitch (walk me.pitch, + looks down)}].
The recipe is the Hatzav job's photo skin (21_walk_frames + 22_realism + project_photos.py), adapted to this walk's frame.
Usage: python 25_skin_views.py <job root>"""
import json, math, os, sys

R = sys.argv[1]
G = json.load(open(os.path.join(R, "geometry", "geometry.json"), encoding="utf-8"))
REF = {"living": "01", "kitchen": "02", "entrance": "04", "lobby": "04", "corridor": "04", "parents": "05", "parentsbath": "06",
       "mamad": "07", "bath": "08", "bedA": "09", "bedB": "10", "wc": "11", "balcony": "12"}
BIG = {"living", "parents"}
V = []


def look(x0, y0, x1, y1):   # walk yaw: 0 looks north (+y), positive turns left (toward -x)
    return math.atan2(-(x1 - x0), (y1 - y0))


for r in G["rooms"]:
    a = max(r["rects"], key=lambda q: (q[2] - q[0]) * (q[3] - q[1]))
    w, d = a[2] - a[0], a[3] - a[1]
    if w * d < 1.0:
        continue
    ins = min(0.45, w / 4, d / 4)
    corners = [(a[0] + ins, a[1] + ins), (a[2] - ins, a[3] - ins), (a[2] - ins, a[1] + ins), (a[0] + ins, a[3] - ins)]
    n = 4 if r["id"] in BIG else (2 if w * d > 2.5 else 1)
    for k in range(n):
        x, y = corners[k]
        tx, ty = (a[0] + a[2]) / 2 * 2 - x, (a[1] + a[3]) / 2 * 2 - y   # the opposite corner
        V.append({"name": f"{r['id']}_{k}", "room": r["id"], "ref": REF.get(r["id"], "01"), "x": round(x, 3), "y": round(y, 3),
                  "yaw": round(look(x, y, tx, ty), 4), "pitch": 0.12})
# the balcony: from both ends looking along it
d = G["balcony"]["deck"]; xs = [p[0] for p in d]; ys = [p[1] for p in d]; cy = (min(ys) + max(ys)) / 2
for k, (x, tx) in enumerate([(min(xs) + 0.5, max(xs)), (max(xs) - 0.5, min(xs))]):
    V.append({"name": f"balcony_{k}", "room": "balcony", "ref": "12", "x": round(x, 3), "y": round(cy, 3), "yaw": round(look(x, cy, tx, cy), 4), "pitch": 0.12})
os.makedirs(os.path.join(R, "work", "realism"), exist_ok=True)
json.dump(V, open(os.path.join(R, "work", "realism", "views.json"), "w"), indent=1)
print(len(V), "views:", ", ".join(v["name"] for v in V))
