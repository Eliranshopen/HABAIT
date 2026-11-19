# Avnei Hefetz Kedem · דגם יורד · buildings 1–2 · floor א׳ · apt 7 · 4 rooms, 94 m² (2026-11-17)

**State:**
- The interactive 3D walkaround is built and checked.
- Photoreal imagery is **stopped at the generation stage on Eliran's ruling**: he supplies the images.
- Nothing is deployed and nothing is committed (worktree `.wt/avnei-hefetz-kedem-4`, branch `avnei-hefetz-kedem-4`).

## The current walk: `walk3d-v2/` (2026-11-18), in the look of Eliran's pictures
```
node tools/serve.mjs out/avnei-hefetz-kedem/buildings-1-2/4-rooms/walk3d-v2 8931
```
- **The look:** taken from his 11 pictures (`C:\RnD\Projects\Avney_Hefets_Kedem_4\בניין 1 קומה א דירה 7`, read-only).
- **The furniture:** generated from crops of his pictures, one item at a time (fal: nano-banana-pro/edit, then Hunyuan 3D v3.1 pro; `tools/catalog/base.json`, ledger `tools/catalog/ledger-base.json`). Each item is placed on its sales-plan footprint by `tools/build_scene.py` and baked with the room.
- **The UI:** in the Habait tour's style.
- **Time of day:** morning, noon, sunset and night (`tools/daynight/`, the day-night-keyframes skill).
- **The catalog:** generated swap pieces (`tools/catalog/catalog.json`, ledger `tools/catalog/ledger.json`).
- **QA:** `qa/walk3d-v2/check/v2-check.json`.

## The design walk (2026-11-17 evening): the Rainbow features
`walk3d-design/` is the current walk. It adds the following, all instant, at $0, with nothing generated:
- Rings on the pieces: model, colour, accessories.
- A free-text design bar in Hebrew.
- Styles, floors, wall colour, kitchen fronts and worktop.
- Undo, before/after, reset, and a link that keeps the design.
- The plan, a view from above, and a tape measure.

```
cd C:\RnD\.wt\avnei-hefetz-kedem-4\Projects\Avney_Hefets_Kedem_4
node tools/serve.mjs out/avnei-hefetz-kedem/buildings-1-2/4-rooms/walk3d-design 8931
```

Then open http://127.0.0.1:8931/

QA: `qa/walk3d-design/design-check.json` (PASS, 1440 + 390) and `qa/walk3d-design/walk/walk-check.json`. The plan is `C:\RnD\development\plans\2026-11-17-avnei-hefetz-walk-design-layer.md`. `walk3d/` below is the first version, kept as it was.

## Open the walk (first version)
```
cd C:\RnD\.wt\avnei-hefetz-kedem-4\Projects\Avney_Hefets_Kedem_4\out\avnei-hefetz-kedem\buildings-1-2\4-rooms\walk3d
python -m http.server 8931 --bind 127.0.0.1
```
Then open http://127.0.0.1:8931/

The page loads three.js 0.170 from cdn.jsdelivr.net (pinned), so it needs internet. An offline copy would be an install, which is Eliran's call.

**Controls:**
- Desktop: arrow keys or WASD walk and turn; drag with the mouse to look around.
- Phone: drag one finger up to walk and sideways to turn. There are no on-screen arrows, per the 2026-11-11 ruling.
- Room strip: jumps to any room.
- Deep link: `?at=<room>&yaw=<deg>`.

## Deliverables
| # | What | Path |
|---|---|---|
| 1–4 | Sources, verification, selection, evidence | `docs/source-evidence.md` |
| 4–5 | Knowledge reuse, PDF-to-3D research, fal research | `docs/knowledge-reuse.md` |
| 6 | Editable Blender scene (collections ARCH / FURN / LIGHT / CAM) | `model/apartment.blend` |
| 7 | glTF with the daylight baked in (+Y up) | `model/gltf/walk3d.gltf` |
| — | The plan in cm, every element marked VERIFIED, DERIVED or ASSUMED | `model/plan.json` |
| 10 | **Interactive 3D walkaround** | `walk3d/` |
| 11 | QA: walk check (11 rooms at 1440, 3 at 390, walking and wall stop), plan overlay, top cut | `qa/` |
| — | Paid-call ledger | `ledger.json` |

## Not delivered, and why
- **360° panoramas.** Eliran: "a fully interactive 3D Walkaround, not a 360° panorama". One low-resolution check pano exists in `renders/pano/`.
- **Photoreal AI renders.** Eliran: «אני לא רוצה שתג'נרט … אני אספק לך תמונות». One test image was made before that message (`renders/ai/nb2/hero-living.png`, $0.12).
- **CG stills in `renders/still/`.**
  - `hero-living` and `living-dining` are current.
  - The other 8 were rendered BEFORE the room-light fix, so `mamad` and `bath` are black. They are superseded, not deleted.

## QA (`qa/walk3d/walk-check.json`)
- The page loads in Chrome.
- Walking 3.2 s from the door moved 4.0 m into the living room. Walking 20 s more stopped at the east-wall clearance, still on free floor.
- All 11 rooms are reachable on foot (`tools/walk_grid.py`).
- No page errors. The one console 404 is the browser's favicon request.
- Phone 390: no page overflow. The room strip scrolls sideways by design.
- Dimensions: 13/14 within 1 %, 14/14 within 2 % (`docs/source-evidence.md`).

### Known limits
- The look is a clean 3D model, not a photograph. Realism waits for Eliran's images.
- The bathtub basin is flat in the walk: the bake prep deletes hidden objects, including the boolean cutter.
- The view outside is a sky gradient. There is no site model, and the sun direction is assumed.
