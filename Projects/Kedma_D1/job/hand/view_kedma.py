"""kedma-d1 ($0): how each room is first seen — the angle and the direction of the first look.

Eliran 2026-11-16: the tour "looks like a fish eye"; it should look as a person sees the apartment from inside. Two causes, both
data: (1) the template opens every room 85 deg tall (about 117 deg across on a wide desktop); (2) the automatic cameras stand at
the deepest clear point of a room, and the first look (heading 0 = the render's own yaw) faces a near wall in some rooms.
This writes apartment.json view.vfovDeg = 62 and, in scenes.json, the heading (degrees from the panorama's own centre) that
faces what the room is for. Re-run after any rerun of the runner's scenes step. Idempotent."""
import json, sys
from pathlib import Path
apt = Path(sys.argv[1])
HEAD = {  # scene id -> heading, read off each finished panorama (jobs/kedma-d1/review/*.jpg)
    "kitchen": 18,    # 2026-11-17 (the redone kitchen, camera yaw 270): the hob under the window, the corner and the sink run with its shelves (-5 left a third of the screen to a blank wall; the island is below the first look's frame at any heading)
    "pantry": 104,    # the pantry shelves, not the bare wall beside the opening
    "living": -165,   # 2026-11-17 (the redone living room, camera yaw 50): the sofa, the armchair and the balcony opening (140 was for the old camera, yaw 75)
    "dining": -140,   # from the entrance into the home: the living room and the balcony glass
    "shower": -22,    # the window, the toilet and the end of the vanity (2026-11-17: after the flat fix, 25 faced the mirror's blank face from half a metre)
    "bath": 5,        # the laundry recess with its window (2026-11-17: 115 faced the flush plate and the mirror's blank face; 60 faced the flush plate: checked in the browser)
}
a = json.loads((apt / "apartment.json").read_text(encoding="utf-8"))
# 2026-11-17 (Eliran, two messages): (1) a look tilted down reads as a security camera - «מבט בגובה העיניים», for every viewpoint of the
# apartment; (2) every room opened too zoomed IN - «אני רוצה שזה יתחיל מיותר ZOOMOUT», with a picture of the view he wants (about 118 deg
# across on his wide window). So the narrow first look (62, then 50) was the wrong cure for "fish eye": the first look goes back to the
# template's wide one (no vfovDeg = 85 deg tall, capped at 118 across) and the tilt is limited instead.
# 2026-11-17 (Eliran, third message: «כשאני זז ימינה שמאלה יש מריחה … הריהוט לא יתעוות במציאות»): the wide ordinary view stretches whatever is
# near the screen's edge. "pannini": 1 draws the picture in the wide architectural projection (tour.js PAN_D): nothing stretches at the
# edge, verticals stay vertical at any tilt.
a["view"] = {"tiltDeg": 10, "pannini": 1, "note": "pannini 1 = the wide architectural projection (no stretch at the edges, verticals stay vertical); the look stays within 10 deg of eye level (tour.js tiltBounds); the first look is the template's wide one (85 deg tall, at most 118 across) - Eliran 2026-11-17: eye level, zoomed out"}
(apt / "apartment.json").write_text(json.dumps(a, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
s = json.loads((apt / "scenes.json").read_text(encoding="utf-8")); ch = []
for sc in s["scenes"]:
    if sc["id"] in HEAD and sc.get("heading") != HEAD[sc["id"]]:
        ch.append((sc["id"], sc.get("heading"), HEAD[sc["id"]])); sc["heading"] = HEAD[sc["id"]]
(apt / "scenes.json").write_text(json.dumps(s, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
print("view", {k: v for k, v in a["view"].items() if k != "note"}, "; headings changed:", ch)
