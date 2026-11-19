# QA report — Hatzav house, 3 rooms, 80 m² (Harei Zahav, Moshav Na'ama)
2026-11-17. Every result below comes from a file in this folder. Nothing is reported from memory.

## Verdict
**PASS, with the limits listed at the end.**
- The model matches the sales plan.
- The interactive 3D walkaround runs in a real browser at 1440 and at 390 with no errors.
- Walls and furniture stop the visitor.

## 1. The right house
- **Model Hatzav: 3 rooms, 80 m², garden.**
  - It is the only 3-room model in the sources (`docs/apartment-selection.md`).
  - Eliran confirmed it on 2026-11-17: «כן רוץ».
- **Floor area:** 80.02 m² modelled, against 80 printed (`qa/geometry-check.json`).

## 2. Geometry against the sales plan (`scripts/05_check_geometry.py` → `qa/geometry-check.json`)

| Check | Result | Bar |
|---|---|---|
| Printed dimensions met | 20 of 20, every one at 0 cm | ≤ 1 % |
| Sheet wall pixels further than 2 cm from the model's walls | 0.54 % | ≤ 1 % |
| Room areas | public 39.6 (39), safe room 9.04 (9), bedroom 12.10 without the wall band (12) | printed value in brackets |
| Items inside their room and out of the walls | 0 problems | 0 |
| Openings inside walls | 9 of 9 | all |

**Visual checks:**
- `qa/geometry-overlay.png`: model walls, openings and furniture drawn over the sheet.
- `qa/wall-diff.png`: model-only pixels in red, sheet-only pixels in blue.
- `qa/model-over-plan.png`: the Blender model seen from above, laid over the sheet at 1 px = 1 cm. This was the first layout, before the interior renders.

**No invented architecture:**
- Walls, windows and doors are exactly the sheet's.
- Every element is classed VERIFIED, DERIVED or ASSUMED in `geometry/geometry.json`.
- Every height is ASSUMED, because no section exists.
- The pergola is DERIVED from the developer's exterior render. It sits in its own collection, so it can be hidden.

## 3. Layout and look against the developer's interior renders
These rows were checked by eye on the views in `work/test/design-sheet.png` and `qa/walk-final/`.

| Render | In the model |
|---|---|
| Kitchen (1_CShading) | yes: tall dark-oak column with two ovens beside the sink run, light-oak wall units, white stone tops, island with 4 stools, white cylinder pendants |
| TV wall (0060000) | yes: TV on the partition, long low oak console, tall double bookcase in the corner, sofa facing it, wall sconce |
| Dining (0070000) | yes: oak table by the glazing, shelving wall, rattan egg pendants |
| Safe room as a child's room (0030000) | yes: upholstered bed, oak bookcase, desk, paper lantern |
| Bathroom (0020000_Post-3) | partly. The room is 180 × 190, so the render's double vanity does not fit. The model has the sheet's 90 cm vanity in oak, a black-framed mirror, black taps and beige stone |

**Known differences from the renders:**
- **The island is shorter:** 190 instead of about 220, to keep a 70 cm passage.
- **The shelving wall stops before the living window.** The window is the sheet's; the render covers it.
- **The models are simpler.** Chairs, stools and the rattan weave are modelled from boxes and lathes, not from the designer's catalogue.
- **There are no textiles with real weave.** Fabric is a normal-mapped linen texture.

## 4. The interactive 3D walkaround (`scripts/14_walk_check.mjs` → `qa/walk-final/walk-check.json`)
The check ran headless Chrome with WebGL, against a local server.

| Check | Desktop 1440×900 | Phone 390×844 |
|---|---|---|
| Page errors / failed requests | 0 / 0 | 0 / 0 |
| Load time | ~3 s | ~2.7 s |
| Every named place on free floor | 9 of 9 | 9 of 9 |
| 2 s walk forward (arrow key) | 2.60 m, ends on free floor | 2.62 m, ends on free floor |
| 8 s walk into a wall | stops on free floor | stops on free floor |
| Horizontal overflow | 0 | 0 |

- **Screenshots** of every place at both sizes are in `qa/walk-final/`.
- **The walkable area** is `qa/walk-grid-check.png`: 43.1 m² of free floor.
  - Body radius is 20 cm.
  - The kitchen, dining, living, hall, three rooms and the deck are all connected.
  - An earlier layout cut the kitchen off. It was caught here, and the island and the chair were moved.
- **Lighting is consistent.** The sun in the backdrop and the baked shadows come from one HDRI rotation (`scripts/13_walk_sky.py` prints the sun's azimuth).

## 5. What was dropped or not done, and why
- **360° panoramas.** Four of eight strips of a 4096×2048 living-room panorama were rendered, along with test panoramas. On 2026-11-17 Eliran asked for a walkaround instead of panoramas, so the panoramas were not finished and no panorama viewer was delivered. The Pannellum viewer was built and stays in `viewer/` (`09_build_viewer.py`); it has no finished panoramas to show.
- **The fal AI test** (one still, cap $1.50, approved by Eliran) was not run, because the deliverable became the walkaround. $0 was spent.
- **The independent plan audit sub-agent** stopped at Claude's usage limit before writing its report. It has no result.

## 6. Limits
- **Light is baked, not live.**
  - Moving furniture in the browser would leave its shadow behind. That is not possible today anyway.
  - The CPU bake used 2048 atlases at 32 samples plus a denoiser, so fine contact shadows are soft.
- **Glass and curtains are drawn live with a flat tint.** The walkaround shows no reflections.
- **The sun direction is ASSUMED.** The sheet has no north arrow; the sun stands at plan up-left (north-west by name), at 22.5°.
- **Every height is ASSUMED** (`docs/source-evidence.md`).
