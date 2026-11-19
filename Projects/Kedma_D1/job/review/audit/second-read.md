# Second read: sales plan vs 3D model, kedma-d1

Reader: independent second reader. Inputs: the 15 `room-*.jpg` pictures, `audit.json`, `plan-sheet-full.jpg`. Offsets were measured on the pictures: both panels of a picture share one scale (about 2.5 to 3.6 px per cm depending on the room). "Offset" means model position minus sheet position. Nothing was edited. Doors, windows and openings were matched against the sheet in every room: all of them exist in the model at the right wall position (see the notes at the end).

## Table of differences

| room | item | on the sheet | in the model | difference | severity | confidence |
|---|---|---|---|---|---|---|
| r-balcony | big palm | Large palm in the TOP-LEFT corner of the deck (next to the dashed "קו מרפסת מעל" box) | `plant` 73x76 at the TOP-RIGHT corner (`ffp-balcony-plant-1`) | Palm is in the opposite corner, about 3 m from where the sheet shows it. No plant at all in the top-left corner | HIGH | sure |
| r-balcony | plant cluster bottom-left | 3 separate plants: large-leaf plant, a second broad plant, a small white-patterned plant (about 80 x 70 cm cluster) | 1 `plant` box at the bottom-left, about 35-40 cm east of the cluster centre | Count 3 vs 1, position about 35 cm off | MEDIUM | sure |
| r-living | coffee tables | TWO tables: a round wood table (about 65 cm across) and a rounded-triangle marble side table, overlapping at the corner | ONE `coffee_table` rectangle 120x60 | Two tables built as one, round shapes built as a rectangle | MEDIUM | sure |
| r-family | coffee table | ROUND marble table about 70 cm across with flowers | `coffee_table` rectangle 120x60 | Round built as a rectangle, and about 50 cm too long | MEDIUM | sure |
| r-living | armchair | Rounded pink armchair, about 70 wide x 82 deep, with a gap of about 20 cm from the sliding-door wall and a clear gap to the round table | `armchair` 82x99 box that touches the sliding-door wall and touches or overlaps the coffee-table box | Box is about 25-30 cm too wide and sits about 15-17 cm too far toward the wall; it collides with the coffee table | MEDIUM | likely |
| r-living | pouf | Round pouf with a throw, about 70-90 cm across, centre about 12 cm north of the model's | `pouf` square about 53 cm | Round built as a square, and clearly smaller than the sheet's | MEDIUM | unsure (the renderer may draw `pouf` round) |
| r-kitchen | kitchen_shelves | Back worktop run is plain marble with only the sink; no shelves, wall units or similar are drawn | `kitchen_shelves` strip about 25 cm deep along the whole back run (about 300 cm), overlapping the rear part of the five counter cabinets | Piece present in the model that the sheet does not draw | MEDIUM | likely |
| r-laundry | outdoor condenser | Rectangle labelled "מעבה" (AC condenser), about 100 x 34 cm, bottom-left of the room | nothing, room is empty | Missing object | MEDIUM | sure |
| r-laundry | water heater | Circle labelled "דוד" (boiler), about 44 cm across, bottom-right | nothing | Missing round object | MEDIUM | sure |
| r-bed1 | bed | SINGLE bed about 90 x 185, head at the north wall | `bed_double` 84x183 | Single bed carried under the double-bed class. Size is right, class name is wrong, so the look depends on the mesh | MEDIUM | unsure |
| r-bed2 | bed | SINGLE bed about 90 x 185 | `bed_double` 82x184 | Same as r-bed1 | MEDIUM | unsure |
| r-mamad | bed | SINGLE bed about 89 x 185 against the east wall | `bed_double` 85x180 | Same as r-bed1 | MEDIUM | unsure |
| r-kitchen | tall unit with an X (between worktop and the grey block) | Wood-grain box with a diagonal cross, about 58 x 55 cm | `kitchen_tall` | An X in a box usually marks a shaft or duct, not a cabinet. May be a wrong kind of object | LOW | unsure |
| r-kitchen | grey block at the right end of the back run | Brushed-steel rectangle about 88 x 55 cm | `kitchen_tall` | Looks like a fridge or steel appliance; built as a generic tall unit (class may not be a fridge) | LOW | unsure |
| r-kitchen | grey bar south of the island | Thick mid-grey bar about 240 cm long, lighter than the walls, along the kitchen's south edge | Not a separate piece (the model has a wall there) | Cannot tell if it is a half-height partition or a full wall. The model has a full wall in that place | LOW | unsure |
| r-pantry | square with a circle | White square with a circle in the north-east corner, on the end of the shelf | nothing | Unidentified fixture (pipe duct, drain or vent) not modelled | LOW | unsure |
| r-pantry | shelves | Two wood-front units, north and east walls, positions match within a few cm | `bookcase` x2, 220 high | Positions and sizes match; class is `bookcase` for what look like closed pantry cabinets | LOW | likely |
| r-living | rug | Rug about 250 x 195 cm, edge about 15 cm east of the armchair | Outline 240x170, about 20 cm smaller on the long side, 25 cm narrower on the short side | Size and position drift (outline only is accepted, the size is not exact) | LOW | likely |
| r-dining | doormat | None drawn at the entrance | `bath_mat` 80x50 added in front of the entrance door | Extra piece, rule-added, class is `bath_mat` | LOW | sure |
| r-dining | guest sink alcove | Sink about 48 x 80 cm, north end at the wall | `bathroom_sink` 62x43, about 15 cm shorter along the long side and shifted about 15 cm south | Small size and position drift; mirror strip is rule-added and not drawn on the sheet | LOW | likely |
| r-wc | square with a circle | White square with a circle in the south-east corner | nothing | Unidentified fixture (duct or drain) not modelled | LOW | unsure |
| r-shower | bath mat | None drawn | `bath_mat` 80x50 in the middle of the floor, in front of the sink | Extra rule-added piece | LOW | sure |
| r-bath | square with a circle | White square with a circle at the top-left of the washer alcove | nothing | Unidentified fixture not modelled | LOW | unsure |
| r-bath | dryer | Second front-loader, drawn the same as the washer | `washing_machine` (both) | Dryer carried as a washing machine (cosmetic) | LOW | likely |
| r-bath | door width | Door gap about 70 cm tick to tick (250 px at 3.6 px/cm) | `door` 83 | About 10-13 cm wider than the sheet. The other doors are 5-8 cm wider than the sheet (bed1/bed2 79-80 vs about 72) | LOW | unsure |
| r-bed1 | desk chair | White chair seen on the WEST edge of the desk, visible about 17 cm beyond it | `dining_chair` 45x45, rule-added, about 20 cm further west than the sheet's | Chair offset about 20 cm (right side of the desk, sheet side is correct) | LOW | likely |
| r-bed2 | desk chair | Same as r-bed1 | Same | Offset about 20 cm west | LOW | likely |
| r-mamad | desk chair | Chair on the EAST edge of the desk | `dining_chair`, about 20 cm further east | Offset about 20 cm | LOW | likely |
| r-bed1, r-bed2, r-mamad | desks | Small wood desk with a monitor, keyboard, plant | `dining_table` 121x54 / 122x53 / 121x52 | Desk built as a dining table (cosmetic) | LOW | likely |
| r-balcony | palm size | Palm about 130 cm across | `plant` 73x76 | Smaller than the sheet's | LOW | likely |
| r-balcony | kitchen window in the balcony wall | Window frame (triple line) in the east wall, between the kitchen and the balcony, y about 260-625 | No opening shown on this wall in the balcony panel; the window is listed only on the kitchen side (`w-kitchen`) | May be missing as seen from the balcony side | LOW | unsure |
| r-balcony | railing | Thin double line along the west side of the deck | nothing | Railing / parapet not drawn | LOW | unsure |
| r-corridor | living opening | Open stretch about 158 cm wide | `opening` 144 (outline gap about 158) | About 11 cm drift at the west edge | LOW | unsure |
| r-laundry | slatted block | Block of 5 horizontal slats, about 178 x 45 cm, right under the window | nothing | Unidentified (louvre, grille, rack or platform) | LOW | unsure |

Counts: HIGH 1, MEDIUM 11, LOW 22 (one count per table row).

## Rooms with no difference found

- r-master: bed (double, 162x184), wardrobe, TV unit and TV, the shower door with its alcove, the corridor door and the window all match within a few cm.
- r-wc: toilet, door and size match. Only the unidentified square-with-circle (LOW, unsure).
- r-corridor: no furniture on the sheet or in the model; the five doors and the living opening match positions. Only the opening-edge LOW above.
- r-dining and r-family: the dining table, the six chairs (three on each long side), the entrance door (94 cm, leaf swinging into the room), the family sofa, TV unit, plant and window match; only the rows above.

## Things I could not read on the sheet

- White box with a left-pointing zig-zag arrow, in the wall south of the pantry (next to the entrance door). Not modelled. Could be a note, a drain or a mailbox.
- The white square with a circle inside, which appears in the pantry, the WC, the bath washer alcove and the shower area. Same symbol each time, I take it to be a pipe duct or a drain.
- The X in a box in the kitchen back run (shaft or tall cabinet).
- The grey block at the right end of the kitchen back run (fridge or steel unit).
- The mid-grey bar along the kitchen's south edge (half wall or full wall).
- The 5-slat block and the louvre strips at the bottom of the laundry room.
- Door swing directions were visible on the sheet but the model panels do not show swing, so I could not compare them.
- Whether `pouf`, `armchair` and `plant` are drawn round by the renderer.
- The dashed "קו מרפסת מעל" box on the balcony is a note about the balcony above; I treated it as not an object.

## Openings checked (all matched)

Kitchen: window 138 on the west wall, opening 81 to the pantry, opening 166 to the living room. Pantry: opening 81. Living: sliding door 266, opening 423 to the dining area, opening 144 to the corridor. Dining: entrance door 94, opening 102 to the family room, WC door 72. Family: window 118. Master: door 73 to the shower room, door 79 to the corridor, window 138. Shower: window 59. Bed1, bed2, mamad: doors 79, 80, 71 and windows 118, 118, 98. Bath: door 83, window 177 to the laundry. Balcony: sliding door 266. All sit at the wall positions the sheet shows (within about 10 cm), apart from the LOW notes above.
