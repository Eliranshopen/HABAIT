"""Step 12 - the walkaround's free floor, from geometry.json: where a visitor may stand (1 cell = 5 cm).

Free = inside a room, a door opening or the deck, and at least BODY cm from any wall, drawn furniture piece or
closed door leaf. Rugs, TVs on walls and the wall band's shelf above knee height do not block. The sliding door is
open (its two panels stack), so the deck is reachable. Writes walkaround/walk-grid.png + walk-grid.json
(frame: u,v in cm = three.js x*100, z*100) with the rooms' outlines, the start point and the named viewpoints.
Usage: python 12_walk_grid.py <job root>
"""
import json
import sys
from pathlib import Path

import cv2
import numpy as np

root = Path(sys.argv[1])
geo = json.loads((root / "geometry" / "geometry.json").read_text(encoding="utf-8"))
CELL, BODY = 5, 20
U0, V0, U1, V1 = -60, -60, 1600, 1300
w, h = (U1 - U0) // CELL, (V1 - V0) // CELL


def px(u, v):
    return int(round((u - U0) / CELL)), int(round((v - V0) / CELL))


free = np.zeros((h, w), np.uint8)
for r in geo["rooms"]:
    cv2.fillPoly(free, [np.array([px(u, v) for u, v in r["poly"]], np.int32)], 255)
for o in geo["openings"]:
    if o["kind"] in ("door", "sliding_door"):
        x0, y0, x1, y1 = o["box"]
        cv2.rectangle(free, px(x0, y0), px(x1, y1), 255, -1)
deck = [e for e in geo["outside"] if e["id"] == "deck"][0]["box"]
cv2.rectangle(free, px(deck[0], deck[1]), px(deck[2] - 2, deck[3] - 2), 255, -1)
# the garden (Eliran 2026-11-18: «שים לב שיש גם יציאה לגינה»): the sales plan's lawn east of the house (its dashed lot line runs to
# u 1550 beside the bedroom) and around the deck, plus a strip south of the house; reached through the sliding door and the deck
GARDEN = [(830, 0, 1550, 1250), (50, 1050, 830, 1250)]
for g0, g1, g2, g3 in GARDEN:
    cv2.rectangle(free, px(g0, g1), px(g2, g3), 255, -1)
# entrance landing outside the front door, so the walk can start at the door
pav = [e for e in geo["outside"] if e["id"] == "entrance-step"][0]["box"]
cv2.rectangle(free, px(pav[0] - 10, pav[1] + 10), px(pav[2], pav[3] - 70), 255, -1)

block = np.zeros((h, w), np.uint8)
for wl in geo["walls"]:
    x0, y0, x1, y1 = wl["box"]
    cv2.rectangle(block, px(x0, y0), px(x1, y1), 255, -1)
for o in geo["openings"]:  # door openings are holes in the walls
    if o["kind"] in ("door", "sliding_door"):
        x0, y0, x1, y1 = o["box"]
        cv2.rectangle(block, px(x0, y0), px(x1, y1), 0, -1)
SKIP = {"rug", "tv", "wall_unit"}  # stools are pushed under the island; they still block
for it in geo["items"]:
    if it["kind"] in SKIP:
        continue
    x0, y0, x1, y1 = it["box"]
    if "rot_deg" in it:
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        rect = ((((cx - U0) / CELL), ((cy - V0) / CELL)), ((x1 - x0) / CELL, (y1 - y0) / CELL), it["rot_deg"])
        cv2.fillPoly(block, [cv2.boxPoints(rect).astype(np.int32)], 255)
    else:
        cv2.rectangle(block, px(x0, y0), px(x1, y1), 255, -1)
# the band's lower part (a shallow panel, 2 cm) is a wall face
k = 2 * (BODY // CELL) + 1
grown = cv2.dilate(block, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
ok = ((free > 0) & (grown == 0)).astype(np.uint8) * 255
# keep only the part connected to the living room
n, lab = cv2.connectedComponents(ok)
start_u, start_v = 150, 590
sx, sy = px(start_u, start_v)
main = lab[sy, sx]
assert main != 0, "start point is not free"
ok = (lab == main).astype(np.uint8) * 255
out = root / "walkaround"
out.mkdir(exist_ok=True)
cv2.imencode(".png", ok)[1].tofile(str(out / "walk-grid.png"))
views = {  # named places: u, v, facing yaw (deg, 0 = +u toward the deck, positive toward +v)
    # 2026-11-18, the sheet's layout: corner sofa N + E, TV on the south wall, table north-south, L kitchen
    "living": (560, 930, -40), "kitchen": (172, 890, 150), "dining": (300, 630, 90), "entrance": (150, 590, 20),
    "hall": (270, 400, -90), "bedroom": (450, 312, -30), "saferoom": (160, 255, -10), "bath": (150, 420, 110), "deck": (980, 760, 180), "garden": (1350, 700, 180),
}
for nm, (u, v, _) in views.items():
    x, y = px(u, v)
    if not (0 <= x < w and 0 <= y < h and ok[y, x]):
        print("WARNING view not free:", nm)
names = {"public": "סלון · מטבח · פינת אוכל", "hall": "מבואה", "saferoom": 'ממ"ד', "bedroom": "חדר שינה", "bath": "חדר רחצה"}
rooms = [{"id": r["id"], "he": names.get(r["id"], r["id"]), "loop": r["poly"]} for r in geo["rooms"]]
rooms.append({"id": "deck", "he": "דק", "loop": [[deck[0], deck[1]], [deck[2], deck[1]], [deck[2], deck[3]], [deck[0], deck[3]]]})
rooms.append({"id": "garden", "he": "גינה", "loop": [[830, 0], [1550, 0], [1550, 1250], [50, 1250], [50, 1050], [830, 1050]]})
json.dump({"x0": U0, "y0": V0, "cell": CELL, "w": w, "h": h, "body_cm": BODY,
           "start": {"x": start_u, "y": start_v, "yaw_deg": 20}, "views": views, "rooms": rooms},
          open(out / "walk-grid.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("grid", w, h, "free cells", int((ok > 0).sum()), "=", round((ok > 0).sum() * CELL * CELL / 1e4, 1), "m2")
vis = cv2.cvtColor(ok, cv2.COLOR_GRAY2BGR)
vis[block > 0] = (60, 60, 200)
cv2.imencode(".png", cv2.resize(vis, None, fx=2, fy=2, interpolation=cv2.INTER_NEAREST))[1].tofile(str(root / "qa" / "walk-grid-check.png"))
