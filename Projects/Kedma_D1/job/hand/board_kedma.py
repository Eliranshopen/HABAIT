"""kedma-d1 ($0): the house material board, as this apartment's own copy, without what is true only of Rainbow apartment 846.

run-project's apartment step copies the house board (Tel Aviv luxury v1, written for floor 16 of a tower) into
apartments/kedma-d1/material-board.json. Kedma building D apartment 1 is on the FIRST floor of a low-rise building: the board's
view ("floor 16 of a high-rise ... city haze") would paint a skyline that does not exist (first living-room picture, 2026-11-16).
This rewrites only those lines in the apartment's copy, adds Eliran's standing rule of 2026-11-10 (no skirting boards) and the
single entrance door, and names the balcony as the sheet draws it. The look itself (materials, kitchen, doors) is unchanged.
Run it again after any rerun of the apartment step. Idempotent."""
import json, sys
from pathlib import Path
p = Path(sys.argv[1]); mb = json.loads(p.read_text(encoding="utf-8"))
mb["windows"] = ("Through every window and glass door: the first floor of a low-rise residential building - a bright, slightly overexposed sky and soft, "
                 "out-of-focus, unrecognisable greenery (tree canopies) close by; no high-rise, no city skyline, no sea, no landmark, no specific building, no street detail.")
mb["outdoor_line"] = ("THIS IS AN OUTDOOR SPACE: a covered balcony on the first floor of a low-rise building, open air beyond its railing, the balcony above as its "
                      "ceiling, the apartment's outer wall on the other side with its sliding glass door and its kitchen window; keep the railing, the sky and the soft "
                      "green view exactly where the render shows them; no interior walls, no sofa, no TV, no kitchen on the balcony: only balcony furniture (an outdoor "
                      "dining table with chairs, two loungers, planters with greenery) on a warm light-oak wooden deck of long narrow planks.")
mb["surfaces"]["glazing"] = "slim black-framed windows, each with its sill at the height Image 1 shows, and one slim black-framed sliding glass door to the balcony; the balcony railing exactly as Image 1 shows it"
mb["surfaces"]["terrace"] = "a warm light-oak wooden deck of long narrow planks, planters with greenery, an outdoor dining table with chairs and two loungers"
mb["light"] = "soft bright morning daylight from the windows and the balcony's glass door, realistic shadows and reflections"
mb["dressing"]["balcony"] = "an outdoor dining table with six chairs, two loungers, planters with greenery"
mb["anchor_lines"]["next"] = mb["anchor_lines"]["next"].replace("daylight and city haze", "daylight and the soft green view")
add = (" No skirting boards and no baseboards anywhere: every wall meets the floor in one clean line. The apartment's entrance door is ONE single-leaf door, "
       "never a double door. No city skyline and no towers in any view.")
if "No skirting boards" not in mb["avoid"]:
    mb["avoid"] += add
# the only storage room of this apartment is the PANTRY (the sheet draws shelves on two of its walls); the house board's storage room is
# Rainbow's walk-in wardrobe (closed fronts, a bench, a runner), which dressed the pantry as a sitting niche (first picture, 2026-11-16)
mb["surfaces"]["wardrobe"] = ("a kitchen pantry: floor-to-ceiling open pantry shelving in matte sand-grey lacquer along two walls, the shelves neatly filled with "
                              "glass jars, woven baskets, boxes and bottles; the remaining walls plain warm white")
mb["dressing"]["storage"] = "tidy pantry shelves with jars, baskets and boxes; no bench, no seat, no artwork, no rug, no wardrobe"
mb["apartment"] = "kedma-d1"
mb["note"] = "the house board (Tel Aviv luxury v1) with the view, the balcony, the glazing and three avoid lines rewritten for Kedma building D apartment 1 by jobs/kedma-d1/hand/board_kedma.py, 2026-11-16"
p.write_text(json.dumps(mb, ensure_ascii=False, indent=1) + "\n", encoding="utf-8"); print("board patched:", p.name)
