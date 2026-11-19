# Avnei Hefetz · Kedem — Building 10, floor 1, apartment 3 (5 rooms, 108 m²) — interactive 3D walkthrough

Built 2026-11-17, 14:33–17:30. **Paid spend: $0** (no fal.ai, no OpenRouter, no image generation — Eliran 2026-11-17: images will be supplied by him, never generated).

## Open it
```
cd C:\RnD\Projects\3Dengine
node engine/cli.mjs serve --root C:/RnD/.wt/avnei-hefetz-kedem-5/out/avnei-hefetz-kedem/building-10/5-rooms/walk --port 8896
```
then **http://127.0.0.1:8896/** in Chrome or Edge (a local server is required: browsers block WebGL textures from `file://`).

Controls — desktop: ↑/W walk, ↓/S back, ←/→ turn, A/D side step, drag to look, click the floor to walk there. Phone: drag to look, tap the floor to walk there (no on-screen walking arrows, Eliran's 2026-11-11 rule). Both: the room strip glides to a room; the small plan shows where you stand and where you look (tap it to go there). Walls, glass, fixtures and furniture block the way; you slide along walls; the balcony is reached through the open sash of the slider.

## What is in this folder
| Path | What |
|---|---|
| `walk/` | **the walkthrough** (three.js r170, vendored, offline): `index.html`, `walk.js` (controls, light, collision, plan), `build.js` (the apartment built from `geometry.json`), `tex/` (26 web textures), `sky/` (CC0 sky), `models/` (CC0 plants, vases, pendant) |
| `scene/apartment-walk.glb` | the walkthrough's own 3D model as glTF binary (37 MB), opens in Blender, three.js, Windows 3D Viewer |
| `scene/apartment.blend` | the editable Blender scene (Cycles, collections Architecture / Fixtures / Furniture / Exterior / Lights / Cameras), built by `scripts/05_build_scene.py` at 15:23. The later material fixes (neutral fabrics, painted walls) were not rebuilt into it: another session held the machine's Blender lock all afternoon. Rebuild: `python scripts/blender_run.py -- -b --factory-startup --python scripts/05_build_scene.py -- <this folder>` |
| `geometry/geometry.json` | **the model of record**: walls, 18 openings, 12 spaces, 19 fixtures, 30 furniture pieces, each VERIFIED / DERIVED / ASSUMED |
| `geometry/cameras.json` | the room stops (eye level 1.60 m) |
| `input/` | read-only copies of the sales-plan sheet and the brochure (sha256 in `docs/file-inventory.md`) |
| `docs/` | `file-inventory.md`, `apartment-selection.md` (source verification + element classes), `knowledge-reuse-and-tools.md` (earlier projects reused, PDF-to-3D tool choice), `qa-report.md` |
| `qa/` | `geometry-overlay.jpg` (the model drawn on the sheet), `model-only.jpg`, `geometry-check.json`, `walk/` (screenshots of every room at 1440×900 and 390×844, `check.json`) |
| `work/` | wall mask, gridded zooms of the sheet, scale fit, test renders |
| `scripts/` | every step, in order, `01`…`11` (each $0) |
| `ledger/` | `costs.json` (per tool), `timeline.json` |
| `viewer/` | the earlier 360°-panorama viewer: superseded at 16:30 by Eliran's ask for a walkthrough, not used |

## Fidelity in one line
The walls are the sheet's own wall fill (pixel agreement IoU 0.945); the scale is fitted to the 18 printed room dimensions (17 within max(2 %, 5 cm); the WC depth 79 printed vs 84.5 drawn); the outline is 107.2 m² against the printed 108 m². Heights, north and the view are assumptions (no section, no north arrow in the documents).
