"""kedma-d1: the prompt of one view of a room redo (hand/room_paint.py), built from the things that view really contains.

Why (2026-11-17, the kitchen pilot): one long materials list for the whole apartment made the image model PAINT what the list named -
a pantry shelf unit and a bathroom vanity appeared in the living room, a second hob on a plain worktop, an armchair in the middle of
the floor. A view's prompt may name only what stands in that view; what is absent is said to be absent.

usage: python redo_prompt.py <out.txt> --room "an apartment kitchen" [--first] [--camera level|up|down|tilted]
                             --has key,key,... [--not "a hob, an oven or a window"] [--note "free text"]

The keys are the clauses of THE LOOK below: "B, quiet luxury", chosen by Eliran on 2026-11-17 from a look test of two variants of one
kitchen view (jobs/kedma-d1/review/look/): rift-cut oak, veined ivory quartzite, matte black details, a white marble-look floor as the
sales plan itself draws. Furniture colours follow the look (his ruling: no pink). The house look of the first kitchen (sand-grey
fronts, stainless tops, beige stone) is kept in git history of this file's first version only as a record: he called it cheap.
"""
import argparse
import io

LOOK = {
    # always present
    "walls": "walls in warm off-white mineral plaster with a very fine texture",
    "ceiling": "a flat white ceiling with small recessed spotlights instead of any large ceiling lamp",
    "floor": ("large-format honed white marble-look porcelain floor tiles with soft grey veining and fine joints exactly on the render's "
              "joint lines"),
    # kitchen
    "base": ("the kitchen base cabinets in rift-cut natural oak veneer, flat handleless fronts with slim dark shadow gaps instead of the "
             "render's framed fronts and black handles"),
    "uppers": "the row of upper cabinets in the same rift-cut oak veneer, flat handleless fronts, with a warm LED line under them",
    "worktop": ("the worktops and the wall between the worktop and the upper cabinets in honed Taj Mahal quartzite, warm ivory with soft "
                "golden-grey veining, instead of the black tops"),
    "island": "the kitchen island clad in the same honed ivory quartzite on its top and its visible sides",
    "stools": "the two bar stools at the island with slim matte black steel legs and natural oak seats",
    "hob": "a flush black glass hob where the render shows the hob, and a built-in black glass oven below it where the render shows the oven",
    "sink": "an under-mounted sink with a slim matte black tap where the render shows the sink",
    "tall": "the tall cabinet that stands on the floor as a full-height column in the same rift-cut oak veneer, flat handleless doors",
    "fridge": "the tall steel block as a built-in brushed stainless-steel two-door fridge with two slim vertical handles",
    "pantry": "the open shelving as fitted pantry shelving in natural oak with glass storage jars, ceramics and woven baskets on its shelves",
    # openings
    "window_view": ("each window with a slim matte black frame and, outside it, a bright sky over soft out-of-focus hills"),
    "window_plain": ("each window with a slim matte black frame and, outside it, a bright sky and soft out-of-focus greenery"),
    "slider": ("the wide balcony opening with a slim matte black sliding-door frame and floor-to-ceiling linen sheer curtains drawn to its "
               "sides; beyond it the terrace and, past its glass railing, a bright sky over soft out-of-focus hills"),
    "door": "each interior door as a flush full-height door in natural oak veneer with a slim matte black lever handle",
    "entrance": "the apartment's entrance door as a flush door in dark bronze with a slim matte black lever handle",
    "passage": ("every open passage in a wall stays an OPEN passage: through it the next space is seen, with the same walls and the same floor; "
                "it is never closed with a door, a wardrobe, a cabinet or a wall"),
    # living and dining
    "sofa": "the sofa in ivory boucle with linen cushions in warm taupe and caramel",
    "coffee": "the two round low tables in front of the sofa, one in natural oak and one in honed travertine, with two books and a small ceramic bowl",
    "round_table": "the round low table in honed travertine with a small vase of flowers",
    "armchair": "the armchair upholstered in warm taupe boucle on a low oak base",
    "pouf": "the round pouf in ivory boucle",
    "tv": "the television as a thin flat black screen above a long low console in rift-cut oak",
    "plant": "each plant as a leafy green plant in a matte ceramic pot where the render shows a plant",
    "rug": "a hand-woven ivory wool rug with a subtle geometric pattern where the render shows the rug",
    "dining": ("the dining table in solid natural oak and its chairs upholstered in ivory boucle on slim oak legs, exactly where the render "
               "shows the table and each chair"),
    # bedrooms
    "bed": "each bed with an upholstered headboard in warm linen, crisp white bedding and a caramel wool throw folded at its foot",
    "wardrobe": "the built-in wardrobe as full-height flush doors in rift-cut oak veneer, no handles",
    "desk": "the desk in natural oak with a slim desk lamp, and its chair upholstered in ivory boucle",
    # wet rooms
    "vanity": ("the vanity as a wall-hung cabinet in rift-cut oak with an ivory quartzite top, a white basin and a matte black tap, and a softly "
               "backlit frameless mirror exactly where the render shows the mirror"),
    "wc": "the toilet as a white wall-hung toilet with a matte black flush plate",
    "shower": "the shower with a frameless clear glass screen, a matte black rain shower head and a matte black mixer",
    "bathtub": "the bathtub as a white built-in tub with a matte black tap",
    "washer": "the two white boxes with a dark square door as a white washing machine and a white tumble dryer",
    "wet_walls": "the walls of this wet room clad to the ceiling in large honed ivory stone-look tiles with fine joints",
    # terrace
    "deck": "the terrace floor as warm timber-look deck boards running in one direction",
    "railing": "a frameless clear glass railing with a slim matte black top rail along the terrace's open edges",
    "lounger": "the two low white slatted sun loungers, each with an ivory cushion, exactly on the render's two lounger shapes",
    "outdoor_table": "the outdoor dining table in weathered teak with six woven outdoor chairs, exactly where the render shows the table and each chair",
    "palm": "the tall palm in a large matte ceramic pot in the corner where the render shows it, and the other plants in matte ceramic pots",
    "facade": "the building's wall in warm wood-look cladding boards",
    "sky": "above the terrace an open bright sky with a few soft clouds; beyond the railing soft out-of-focus hills",
}
CAM = {
    "level": "taken with a level camera",
    "up": "taken with the camera looking straight UP, so the middle of the picture is the ceiling directly above the camera",
    "down": "taken with the camera looking straight DOWN, so the middle of the picture is the floor directly under the camera",
    "tilted": "taken with a camera tilted down toward the floor (vertical edges lean, as they do in the image)",
}

ap = argparse.ArgumentParser()
ap.add_argument("out"); ap.add_argument("--room", required=True); ap.add_argument("--first", action="store_true")
ap.add_argument("--camera", default="level", choices=sorted(CAM)); ap.add_argument("--has", default="")
ap.add_argument("--not", dest="absent", default=""); ap.add_argument("--note", default="")
ap.add_argument("--outdoor", action="store_true")       # a terrace: no interior walls, ceiling or floor clauses
a = ap.parse_args()
keys = ([] if a.outdoor else ["walls", "ceiling", "floor"]) + [k for k in a.has.split(",") if k]
bad = [k for k in keys if k not in LOOK]
if bad:
    raise SystemExit("unknown look keys: " + ", ".join(bad))
if a.first:
    head = (f"This image is a plain, untextured computer render of {a.room}, {CAM[a.camera]}. Turn it into a photorealistic interior photograph of "
            "exactly the same place, at the level of a luxury interior-design magazine.")
    tail = "Change only the surfaces, the light and a few small styling objects: "
else:
    head = (f"This image shows {a.room}, {CAM[a.camera]}. Part of it is already a finished photograph; the rest is still a plain, untextured computer "
            "render (flat pale walls and floor, plain wooden, black or grey boxes). Finish the picture: turn every rendered part into the same "
            "photograph, so the whole image reads as ONE photograph. The already finished part stays exactly as it is.")
    tail = "Paint the rendered parts in exactly the same materials, colours and light as the finished part: "
lock = (" Keep the geometry pixel for pixel: every wall, wall corner, ceiling line, opening, door, window, cabinet, worktop, appliance, shelf and piece "
        "of furniture stays exactly where it is, exactly the same size and shape; do not add, remove, move, resize, straighten or re-frame anything; "
        "the camera position, the framing and the field of view are identical to the input image: do not zoom. The picture contains only what the "
        "image shows: no door, window, cabinet, shelf, mirror, basin, appliance, lamp or furniture is added anywhere, and a plain wall stays a plain wall.")
absent = f" In this picture there is NO {a.absent}." if a.absent else ""
note = (" " + a.note.strip()) if a.note.strip() else ""
body = "; ".join(LOOK[k] for k in dict.fromkeys(keys)) + "; warm golden late-morning sunlight with soft realistic shadows and deep natural contrast."
end = " Sharp, detailed, natural architectural photography with fine material texture. No skirting boards. No text, no people, no borders."
io.open(a.out, "w", encoding="utf-8", newline="").write(head + lock + absent + note + " " + tail + body + end + "\n")
print("wrote", a.out, "| keys:", ",".join(dict.fromkeys(keys)))
