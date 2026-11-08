# Task 03 — rooms, labels and tap-a-room inside the dollhouse
**Agent:** `platform-dev` (status live, track habait) · **Model:** opus · **Ruling tier:** T0 · **Burst:** 2 · **Depends on:** 01, 02b
**Memory file:** `memory/agents/platform-dev.md` (standing agent)
All paths are inside `C:\RnD\.wt\apartment-3d\` (mirror of the repo).

## What to do
1. **`Habait/platform/tools/build_zip.mjs`:** in `dollhouseHtml()` (`:313-430`), inline `<script type="application/json" id="rooms">`, the same way `#floors` is inlined (`:375`). Per room: `{room_id, he, en, area_m2, outdoor, scene, x_cm, y_cm}`.
   - `he` and `area_m2` from `Habait/tour360/apartments/apt846/plan.general.json` `rooms[].name_he` / `area_m2`.
   - `scene` from that file's `camera_points` (`cp-<scene>` → `room_id`).
   - `x_cm` / `y_cm` = the pano point from `buildMinimapData` (`js/minimap.js:98-111`).
   - 11 rooms for apt846 (table in the research README / plan).
2. **`Habait/platform/js/apartment-3d.js`:**
   - `prepareDollhouse` also records each `floor_<room_id>` node's bounds/centroid.
   - `mountDollhouse` takes `rooms`.
   - Placement: `model x = x_cm/100 - shift.x, z = y_cm/100 - shift.z` (`:97-102`). No scale correction (2.25 frame).
3. **Labels:** a DOM overlay over the canvas (same container, `pointer-events` only on the pills).
   - One upright pill per room: Hebrew name plus `<bdi>area</bdi> מ״ר`.
   - Projected each frame from the floor centroid; hidden when behind the camera.
   - Collision culling by screen rect, larger area wins.
   - Top preset: all labels. 3D preset: rooms ≥ 5 m² plus the terraces.
   - `lang=en` uses `en`.
4. **Tap:**
   - A `Raycaster` on the `floor_*` meshes, plus a tap on a pill. A drag over 6 px is not a tap.
   - The camera eases to the room: target = centroid, distance fitted to the room bounds; reuse the `anim`/`ease` path of `setPreset`.
   - Highlight = a cloned floor material with a soft emissive tint, restored on the next selection.
5. **Bottom sheet** (inside the dollhouse, RTL, thumb zone): name, area, "צפו ב-360°", close ×.
   - The button posts `{type:'habait:enter-room', scene, room_id}` to `parent` (same origin).
   - Escape or × closes it. A tap on empty space deselects.
6. **Strings:** in a `STR` table next to `PRESET_LABELS` (`:32-35`), he and en.
7. **Test hooks:**
   - `window.__dollhouse` adds `rooms`, `selected` and `labelsVisible`;
   - `window.__dollhouseSelect(room_id)` performs a selection without a pointer.

## Files
- modifies: `Habait/platform/js/apartment-3d.js`, `Habait/platform/tools/build_zip.mjs`
- reads: `Habait/tour360/apartments/apt846/{plan.general.json,cameras.json,scenes.json}`, `Habait/platform/js/minimap.js`

## Acceptance
- A rebuilt `media/dollhouse.html` contains `#rooms` with 11 entries. Every `scene` exists in `scenes.json`, and every area equals `plan.general.json` within 0.01 m².
- Headless (iPhone 13, Pixel 7, desktop 1440), Top preset:
  - 11 pills visible;
  - `__dollhouseSelect('r-living')` → `selected === 'r-living'`, the sheet is visible, the camera target is within 0.3 m of the living centroid;
  - clicking "צפו ב-360°" posts `habait:enter-room` with `scene: 'living'` (captured by a test parent page).
- `node test/minimap.test.mjs`'s existing asserts still pass (presets, floors, timings).
- `CHANGES.md` regenerated.

## Standing rails (inherited verbatim from the board README — root `CLAUDE.md` §0)
1. **Bounded read-first:** `memory/HOT.md`, then the LAST ~150 lines of your own `memory/agents/<name>.md` (plus its archive-index block). ⛔ Never read `memory/INDEX.md` whole — grep it.
2. **Write last, once:** ONE entry (`memory/_TEMPLATE.md`) into the layer that owns the fact, plus ONE ≤ 400-char pointer line under that layer's existing `memory/INDEX.md` header. ⛔ Never add a header.
3. **Second reader:** name which OTHER actor must know this; append ONE pointer line into their `memory/agents/<name>.md`, or say "none".
4. **An action is not done until its memory is written.**
5. ⛔ **The live repo `C:\RnD\Projects\Habait\habait-walkaround\` is read-only to every card until card 10.** Every write goes into `C:\RnD\.wt\apartment-3d\` (same relative paths as the repo) or into this board folder. Memory rows are the only live writes (root §8.7).
6. ⛔ **No git anywhere** (Eliran, 2026-11-03). `CHANGES.md` in the work tree is the diff.
7. ⚠ **Machine resource rules** (root `CLAUDE.md` §12): every test, build, server, browser or render runs as `timeout N <cmd>`, one heavy run at a time, foreground; kill what you start by PID. The work-tree server is `PORT=8851`. Never use :8850 (another session's port).
8. ⛔ **Blender only by its owner** (`Projects\Habait\SESSIONS.md` rule 4); no paid call on this board ($0 plan). Deploying is a separate explicit go from Eliran (root §9).
