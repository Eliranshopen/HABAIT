# Hatzav house (דגם חצב) — 3 rooms, 80 m² — Harei Zahav, Moshav Na'ama

An interactive 3D walkaround of the house, built from the developer's sales plan. The walls, windows and doors are exactly the plan's. The layout and look come from the developer's interior renders.

## Open the walkaround
1. Double-click `viewer\serve-walk.cmd`. It starts a local server and opens `http://127.0.0.1:8894/walkaround/`. Python must be on the PATH.

   Or, from this folder, run `python -m http.server 8894 --bind 127.0.0.1` and open `http://127.0.0.1:8894/walkaround/`.

   A browser cannot load the model from `file://`, so a local server is required.
2. Controls:
   - **Computer:** ↑ / W walks, ↓ / S walks back, ← → (A / D) turns. Drag the mouse to look around. Click the floor to walk there.
   - **Phone:** drag a finger up to walk and sideways to turn. Tap the floor to walk there.
   - **Both:** the room buttons at the bottom jump to a room.

## What is where
| Path | What |
|---|---|
| `walkaround/` | **the walkaround**: `index.html`, `walk.js`, `walk-grid.*` (where you can stand), `model/` (the baked model as glTF plus its texture atlases, and `sky.jpg`), `vendor/` (three.js 0.170, MIT, offline) |
| `scene/hatzav.blend` | **the editable Blender scene** (Blender 4.5). Collections: `01_Architecture` (walls, openings, floors, roof, deck), `01b_Derived_Pergola` (in the developer's render only; can be hidden), `02_Furniture`, `03_Decor`, `04_Lighting`, `05_Cameras`, `06_Site`. Textures are packed in |
| `scene/hatzav.glb` | the house as one GLB (architecture, furniture, decor; 50 MB) |
| `geometry/geometry.json` | the geometry of record. Every element is classed VERIFIED / DERIVED / ASSUMED |
| `docs/file-inventory.md` | every source file, with its hash |
| `docs/apartment-selection.md` | why this model |
| `docs/source-evidence.md` | scale, the printed dimensions against the model, conflicts, what is assumed, and where the interior renders depart from the sheet |
| `docs/knowledge-reuse.md` | what was reused from RAINBOW (apt846) and Kedma (Pesel_yazamot) |
| `docs/pdf-to-3d-research.md` | the extraction tools compared and the pipeline that was run |
| `docs/fal-model-research.md` | the fal.ai models compared (research only; no paid call) |
| `qa/QA-REPORT.md` | **the QA report**: geometry, layout, the browser walk, limits |
| `qa/walk-final/` | screenshots of every room at 1440 and at 390, plus `walk-check.json` |
| `cost-ledger.json` | time and cost |
| `scripts/` | every step, in order (01 to 14, plus `blender/`) |
| `input/` | ASCII-named copies of the sources (the originals in `Projects/Harey_zahav_Naama/` were never touched) |
| `work/` | intermediate files (tests, strips, bake folders) |

## Rebuild from the start ($0, about 25 min on this machine's CPU)
```
python scripts/04_geometry.py .            # geometry of record
python scripts/05_check_geometry.py .      # gate against the sheet (exit 0 = pass)
python scripts/run_blender.py -- -b --factory-startup -P scripts/blender/build_scene.py -- .
python scripts/run_blender.py -- -b scene/hatzav.blend --factory-startup -P scripts/blender/walk_bake.py -- --stage prep --dir work/walk2 --groups 6 --size 2048
python scripts/run_blender.py -- -b work/walk2/prep.blend --factory-startup -P scripts/blender/walk_bake.py -- --stage bake --dir work/walk2 --group K --samples 32   # K = 0..5
python scripts/run_blender.py -- -b work/walk2/prep.blend --factory-startup -P scripts/blender/walk_bake.py -- --stage export --dir work/walk2 --exposure -0.6 --look "AgX - Medium High Contrast"
copy work\walk2\gl\* walkaround\model\
python scripts/12_walk_grid.py .  &&  python scripts/13_walk_sky.py .
node scripts/14_walk_check.mjs http://127.0.0.1:8894 qa/walk-final
```
`run_blender.py` takes the machine-wide Blender lock (`C:/RnD/.wt/_blender.lock`), so only one Blender runs at a time.

## Disclosure
The page carries the badge «הדמיה · Visualization» and the line «הדמיה ממודל תלת־ממדי לפי תכנית המכר · ריהוט וחומרים להמחשה». No AI image model touched any picture; everything is rendered from the Blender model.
