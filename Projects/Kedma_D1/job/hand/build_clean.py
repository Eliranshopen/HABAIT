"""kedma-d1 hand trace, step 4 ($0): the clean sheet and the tracer config.

The tracer (trace-plan.mjs) reads a clean CAD-like raster: white sheet, flat grey wall fill, thin black strokes; its thresholds
are in pixels, tuned at 2.25 px/cm (apartment 846). This script draws that sheet from the sales plan's own wall fill
(hand/wallmask.png, native 3.3506 px/cm) and from hand/geometry.json, and writes the config:
  hand/clean.png            white 255, walls 110, glazing and railings as double black lines
  hand/trace-config.json    cameras (room seeds), bars (zone boundaries + one bar across every door/window gap), house keys
  hand/cameras.stub.json    {"scenes": []}  (run-project places the cameras)
  hand/transform.json       native px -> clean px -> cm, so every later step maps back to the sheet
usage: python build_clean.py <job dir> [--front-door-gap gap-N] [--skip gap-A,gap-B]
"""
import json
import sys
from pathlib import Path

import cv2
import numpy as np

job = Path(sys.argv[1]).resolve()
hand = job / "hand"
args = sys.argv[2:]
opt = lambda k, d=None: args[args.index(k) + 1] if k in args else d
g = json.loads((hand / "geometry.json").read_text(encoding="utf-8"))

PPC = 2.25                                   # the clean sheet's scale, the tracer's tuned scale
S = float(g["px_per_cm_native"])
F = PPC / S                                  # native px -> clean px
M = 500                                      # free sheet around the plan (a leaked flood must exceed 35 % of the image)
X0, Y0 = 150, 380                            # native top-left of the plan's bounding box, railings included
OX, OY = round(M - X0 * F), round(M - Y0 * F)


def cl(p):                                   # native px -> clean px (float)
    return (p[0] * F + OX, p[1] * F + OY)


def cm(p):                                   # native px -> cm in the clean frame
    x, y = cl(p)
    return [round(x / PPC, 1), round(y / PPC, 1)]


mask = cv2.imread(str(hand / "wallmask.png"), cv2.IMREAD_GRAYSCALE)
for w in g["extra_walls"]:
    x0, y0, x1, y1 = w["rect"]
    mask[y0:y1, x0:x1] = 255
small = cv2.resize(mask, None, fx=F, fy=F, interpolation=cv2.INTER_AREA)
W = int(round((5232 - X0) * F)) + 2 * M
H = int(round((4616 - Y0) * F)) + 2 * M
wall = np.zeros((H, W), np.uint8)
h, w_ = small.shape
wall[OY:OY + h, OX:OX + w_][small[: H - OY, : W - OX] >= 128] = 1
sheet = np.full((H, W), 255, np.uint8)


def dbl(a, b):
    """two parallel 2 px black lines with a 3 px white gap, along an axis-aligned segment (native px ends)"""
    (ax, ay), (bx, by) = cl(a), cl(b)
    if abs(ax - bx) < abs(ay - by):          # vertical
        x = int(round(ax)); y0, y1 = sorted((int(round(ay)), int(round(by))))
        sheet[y0:y1 + 1, x - 3:x - 1] = 0; sheet[y0:y1 + 1, x + 2:x + 4] = 0
    else:
        y = int(round(ay)); x0, x1 = sorted((int(round(ax)), int(round(bx))))
        sheet[y - 3:y - 1, x0:x1 + 1] = 0; sheet[y + 2:y + 4, x0:x1 + 1] = 0


glazed = []
for win in g["windows"]:
    if win["kind"] != "sliding-door":
        continue                             # a window with a sill is an opening added after the trace; its gap gets a bar
    x0, y0, x1, y1 = win["rect"]
    if win["wall"] == "v":
        dbl(((x0 + x1) / 2, y0 - 6), ((x0 + x1) / 2, y1 + 6))
    else:
        dbl((x0 - 6, (y0 + y1) / 2), (x1 + 6, (y0 + y1) / 2))
    glazed.append(win["id"])
for r in g["railings"]:
    a, b = r["line"]
    ext = 12
    if a[0] == b[0]:
        dbl((a[0], min(a[1], b[1]) - ext), (a[0], max(a[1], b[1]) + 3))
    else:
        dbl((min(a[0], b[0]) - 3, a[1]), (max(a[0], b[0]) + ext, a[1]))
sheet[wall == 1] = 110                       # the fill last: every stroke ends exactly on a wall face
cv2.imwrite(str(hand / "clean.png"), sheet)

bars = []
for zb in g["zone_bars"]:
    pts = zb["points"]
    for i in range(len(pts) - 1):
        bars.append({"name": zb["name"] + (f" #{i + 1}" if len(pts) > 2 else ""), "a": cm(pts[i]), "b": cm(pts[i + 1])})
E = 8                                        # native px of overlap into the wall fill at both ends
gaps = [(d, "door") for d in g["doors"]] + [(w, "window") for w in g["windows"] if w["id"] not in glazed]
for it, what in gaps:
    x0, y0, x1, y1 = it["rect"]
    if it["wall"] == "v":
        a, b = ((x0 + x1) / 2, y0 - E), ((x0 + x1) / 2, y1 + E)
    else:
        ym = it.get("bar_at", (y0 + y1) / 2)
        a, b = (x0 - E, ym), (x1 + E, ym)
    bars.append({"name": f"{what} {it['id']}", "a": cm(a), "b": cm(b)})

# seal bars: the tracer leaves the stroke pixel next to a wall face out of the barrier (its 1 px wall halo), so a drawn double line
# alone leaks by one pixel at each end (run 2); a bar along every double line, ending inside the fill, closes it
for win in g["windows"]:
    if win["id"] in glazed:
        x0, y0, x1, y1 = win["rect"]
        a, b = (((x0 + x1) / 2, y0 - E), ((x0 + x1) / 2, y1 + E)) if win["wall"] == "v" else ((x0 - E, (y0 + y1) / 2), (x1 + E, (y0 + y1) / 2))
        bars.append({"name": f"seal {win['id']}", "a": cm(a), "b": cm(b)})
for r in g["railings"]:
    a, b = r["line"]
    if a[0] == b[0]:
        a, b = (a[0], min(a[1], b[1]) - 14), (a[0], max(a[1], b[1]) + 2)
    else:
        a, b = (min(a[0], b[0]) - 2, a[1]), (max(a[0], b[0]) + 14, a[1])
    bars.append({"name": f"seal {r['id']}", "a": cm(a), "b": cm(b)})

TYPE = {"master_bedroom": "bedroom", "mamad": "safe_room", "wc": "toilet", "dining": "hall", "laundry": "service_balcony"}
cams = []
for r in g["rooms"]:
    c = {"id": r["id"], "room_id": "r-" + r["id"], "name_he": r["he"], "name_en": r["en"], "type": TYPE.get(r["type"], r["type"]),
         "at_cm": cm(r["seed"])}
    if r.get("outdoor"):
        c["is_outdoor"] = True
    cams.append(c)

fixtures = []
for f in g.get("fixtures", []):
    x0, y0, x1, y1 = f["rect"]
    x0, y0, x1, y1 = x0 + 8, y0 + 8, x1 - 8, y1 - 8     # 2.4 cm inside the drawn outline: a box flush with a wall face has corners outside the traced room loop
    along_x = (x1 - x0) >= (y1 - y0)
    row = {"id": f["id"], "room": f["room"], "kind": f["kind"], "centre_cm": cm(((x0 + x1) / 2, (y0 + y1) / 2)),
           "length_cm": round((x1 - x0 if along_x else y1 - y0) / S, 1), "depth_cm": round((y1 - y0 if along_x else x1 - x0) / S, 1),
           "angle_deg": 0 if along_x else 90, "height_cm": f["height_cm"]}
    for k in ("note", "words_en", "tall_type"):
        if f.get(k):
            row[k] = f[k]
    fixtures.append(row)

P = lambda name: str(hand / name).replace("\\", "/")
cfg = {
    "note": "kedma-d1 (Kedma, Etz Efraim, building D apartment 1): the hand trace config; cm in the clean-sheet frame (clean px / 2.25); built by hand/build_clean.py from hand/geometry.json",
    "apartment_id": "kedma-d1",
    "source_file": "jobs/kedma-d1/hand/clean.png: the wall fill of the sales-plan sheet 'bldg-d-apt-1.pdf' (sha256 d90f50bf...) redrawn clean at 2.25 px/cm",
    "trace_date": "2026-11-16",
    "scale_basis": g["scale_basis"] + f"; native {S} px/cm, clean sheet 2.25 px/cm",
    "rights_state": "partner-supplied",
    "rights_note": "the developer's sales plan (Pesel Yazamot), handed to Eliran; nothing is published without his word",
    "ceiling_height_cm": 290, "eye_cm": 160, "floor_height_cm": 320,
    "floor_height_note": "floor 1 (the sheet says 'קומה א') at about 3.2 m floor to floor: an assumption, the sheet carries no section",
    "roofed_outdoor": True,
    "roofed_note": "assumption: the balcony sits under the balcony above (the sheet marks only a corner notch as 'the line of the balcony above')",
    "assumptions": g["assumptions"],
    "open_radius_px": 5, "simplify_cm": 3, "door_dilate_px": 5, "cut_px": 8, "near_wall_px": 16, "dimension_min_cm": 100,
    "opening_min_cm": 55, "door_gap_cm": [55, 140],
    "double_count_min": 24,
    "double_note": "24, not 32: the last two pixels of a drawn double line at a wall face count 24 and 28 in the 11x11 box; at 32 they stay single, are cut near the wall and leave a 1 px leak (run 1: living, balcony and laundry leaked)",
    "front_door_gap": opt("--front-door-gap", "gap-0"),
    "skip_auto_bars": [s for s in (opt("--skip", "") or "").split(",") if s],
    "export_plan": P("plan.general.json"), "walls_extracted": P("walls-extracted.json"), "walls_recompute": True,
    "cameras_json": P("cameras.stub.json"), "dump_barrier_png": P("barrier.png"),
    "bars": bars, "cameras": cams, "fixtures": fixtures,
}
(hand / "trace-config.json").write_text(json.dumps(cfg, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
(hand / "cameras.stub.json").write_text('{"scenes": []}\n', encoding="utf-8")
(hand / "transform.json").write_text(json.dumps({"native_px_per_cm": S, "clean_px_per_cm": PPC, "F": F, "offset_px": [OX, OY],
                                                 "clean_size": [W, H], "note": "clean = native * F + offset; cm = clean / 2.25"}, indent=1) + "\n", encoding="utf-8")
print(f"clean {W}x{H}, wall px {int(wall.sum())}, F {F:.5f}, offset {OX},{OY}; bars {len(bars)}, cameras {len(cams)}, glazed {glazed}")
print("pixel(5,5) =", int(sheet[5, 5]))
