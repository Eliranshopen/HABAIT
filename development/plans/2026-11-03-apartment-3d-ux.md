# Plan: the apartment's 3D view (dollhouse tab), from CAD toy to premium
<!-- filed: 2026-11-03 · session rnd-23 · state: OPEN, awaiting Eliran's approval; nothing executed -->

**State:** filed only. No work tree exists yet and no product file has changed. Execution starts only on Eliran's approval, at Step 0.

**Eliran decides:** (1) approve this plan; (2) the go for `npm ci` inside the work tree (Step 0); (3) disclosure wording on the 3D tab once Phase 2 shows the baked look.


## Context
Eliran's goal for this session (2026-11-03): maximise the UI/UX of the apartment's 3D view. Research first, then build in a work tree and copy back only once it is proven good. The research is in `C:\RnD\Projects\Habait\research\apartment-3d-ux-2026-11-03\README.md`, with screenshots of the live site in `current/`.

Today the תלת-ממד tab of `habait-platform.vercel.app/apartment.html?project=rainbow&unit=846` has these problems:
- It is a flat-colour model on dark navy, next to a bright photoreal 360 tour.
- It has no room names or areas, nothing is tappable, and it doesn't lead into the 360.
- On phones it sits below the fold, under the sticky WhatsApp bar.
- The terrace glass draws as stripes.
- A developer "fixture" badge shows to buyers.

The tab is an iframe of `_local/dist/rainbow/846/media/dollhouse.html`. It is built by `Habait/platform/tools/build_zip.mjs`, which inlines three, `js/apartment-3d.js`, the Draco decoder and the GLB from `360walkaround/pipeline/export_dollhouse.py`. `tools/deploy-vercel/stage_platform.py` deploys that dist exactly as built.

## Research verdict: the look
**Light rendered by Cycles and baked into the model, in the tour's palette. No projection of the AI panoramas.**
- Against projection:
  - `Habait/flyover/equirect/_local/segments/enter-846/check/three_frames.jpg`: a few metres from the pano centre, the projected AI pano smears the sofa, rug and floor.
  - `Habait/flyover/REPORT-C5-he.md`: GPT furniture smeared on the floor; registration 0.58/0.53.
  - The dollhouse is seen from far above every pano centre, so the failure is structural.
- For the bake: the Cycles clay of the same scene (`360walkaround/tours/apt846-furnished/renders/cp-living/pano.webp`) already reads as a warm, clean architectural render.
- The AI imagery stays in the 360, where its viewpoint is correct.

## Step -1: file the plan (done 2026-11-03)
This file, plus its row in `CLAUDE.md` here.

## Step 0: the work tree (no git), `C:\RnD\.wt\apartment-3d\`
- **The layout mirrors the repo** (`habait-walkaround\` relative paths). No `files\`, no `Projects\Habait\` prefix. `README.md` (one paragraph: what this is) + `manifest.json`.
- **A runnable copy:**
  - `Habait\platform\` (code, css, js, tools, test, `fixtures\rainbow` without `orbit_real.mp4`, `_local\dist\rainbow\846\`)
  - `Habait\tour360\apartments\apt846\{plan.general.json,cameras.json,scenes.json,dollhouse\}`
  - `360walkaround\pipeline\export_dollhouse.py`
- `serve.mjs` serves its own folder → `PORT=8851 node .wt\apartment-3d\Habait\platform\serve.mjs`.
- **Manifest:** `sha256_at_open` for every copied file.
- **`CHANGES.md`** (Eliran's view of "what's on the branch", since there's no git diff): every changed or new file with a readable before/after diff. It is regenerated after each step from the manifest hashes.
- **Live preview while working:** `http://127.0.0.1:8851/apartment.html?project=rainbow&unit=846`, served from the work-tree copy.
- **Close:** copy back only the files changed in the work tree, and each only if its live hash is still `sha256_at_open`. Otherwise stop and reconcile. Nothing is copied back before Eliran says "good".
- **Nothing from this session is in a work tree yet.** The research was written directly to `Projects\Habait\research\apartment-3d-ux-2026-11-03\` and stays there (done; memory points at it). Memory rows were written live, as the rule allows. From Step 0 on, every file this work changes or creates, including new research notes and the `after\` screenshots, lives in `.wt\apartment-3d\` until copy-back.
- **Eliran's go needed:** `npm ci` inside the work tree's `Habait\platform` (three 0.170.0 from the lockfile; no copy of it is on disk; installs are his act).
- **Same step:**
  - Update root `CLAUDE.md` §8.7 and `.wt\CLAUDE.md` to this layout.
  - Register a row in `Projects\Habait\SESSIONS.md` (rnd-23 row already there).
  - Before any Blender run, notify the Blender owner (SESSIONS rule 4).

## Phase 1: make it useful and coherent (no Blender, $0)
Files: `Habait/platform/js/apartment-3d.js`, `tools/build_zip.mjs` (the `dollhouseHtml()` template + data), `js/apartment.js`, `apartment.html`, `css/apartment.css`.

1. **Room data in the dollhouse.** `build_zip.mjs` inlines a `<script type="application/json" id="rooms">` block, the same way it inlines `#floors`. Per room it carries `{room_id, he, en, area_m2, outdoor, scene, x_cm, y_cm}`, built from:
   - `plan.general.json` `rooms[].name_he` / `area_m2`
   - `camera_points` (room_id → scene, `cp-<scene>`)
   - the pano points `buildMinimapData` already makes (`js/minimap.js:98-111`)
   - Placement uses the existing formula `model x = x_cm/100 - shift.x, z = y_cm/100 - shift.z` (`apartment-3d.js:97-102`). No scale correction is needed (minimap.test proves the 2.25 frame).
2. **Labels.** A DOM overlay above the canvas: an upright pill per room, Hebrew name + area. The number sits in `<bdi>` with the "מ״ר" unit. Positions are projected each frame from the room floor's centroid. Labels hide when they are behind the camera or overlap one another (priority by area). In the Top preset all labels show; at the 3/4 view, the main rooms show.
3. **Tap a room.**
   - A `Raycaster` on the `floor_<room_id>` nodes, plus a tap on a label.
   - The camera eases to that room, reusing the `setPreset` animation path and `ease`. The room's floor gets a soft highlight (a cloned material with an emissive tint).
   - A bottom sheet opens inside the dollhouse: name, area, and a "צפו ב-360°" button.
   - The button posts `{type:'habait:enter-room', scene}` to the parent.
4. **Hand-off to the 360 and back** (`apartment.js`):
   - On `habait:enter-room`: `showTab('tour')`.
     - If the tour is not loaded yet, set `room=<scene>` in `apartmentTourUrl()` (`:124-133`).
     - If it is loaded, post `habait:goto {scene}` to `tourOrigin` (the same call as `:414`), and confirm with the next `habait:view`.
   - A page-level chip "חזרה לתלת-ממד" above the tour frame calls `showTab('3d')`. The dollhouse keeps its state.
   - Fix the deep link: `?tab=` wins over a stale hash, and an unknown hash falls back to `?tab`. Opening a tab scrolls its panel into view on phones.
5. **The look pass** (`mountDollhouse`):
   - A transparent canvas over a light, warm CSS gradient that matches the tour; drop `#0b1220`.
   - `NeutralToneMapping`; `RoomEnvironment` through PMREM at low intensity; a gentler hemisphere light.
   - Caps change to a warm grey poché with a thin darker edge, replacing near-black `web_cap`.
   - Glass: `depthWrite=false`, a renderOrder after opaques, no shadow receive, which removes the stripes.
   - The framing factor in `computePresets` changes so the model fills about 80% of the frame.
   - DPR capped at 1.5 on phones. Render on demand: stop the loop when idle and auto-rotate is off.
   - A fade-in from the gradient, with no loading text (Eliran's no-loading-screen rule).
6. **Phone layout.**
   - `.apt-frame-3d` height clears the fixed `.apt-mobilebar` (`css/apartment.css:47, 91-95`).
   - `#v` gets `touch-action: pan-y`: a vertical swipe scrolls the page, a horizontal drag orbits, pinch zooms.
   - The preset bar and the bottom sheet stay in the thumb zone.
7. **Page fixes.**
   - The `#aptFixture` badge shows only on localhost or with `?dev=1`, the same rule as `index.html:34,71`.
   - The 2-line caption over the canvas becomes a small "הדמיה · להמחשה" pill. Tapping it expands the full `m.legal.short` text. The wording stays exactly as it is today; changes are Eliran's.
8. **Strings.** The dollhouse's he/en strings go in the `PRESET_LABELS`-style table in `apartment-3d.js`. Page strings go under `apt.3d.*` in `APT_STR` (`apartment.js:14-95`). No new analytics event, or `test/smoke.mjs:75` (EVENTS === 14) is updated in the same change.
9. **Rebuild** the dist in the work tree: `HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps node tools/build_zip.mjs fixtures/rainbow 846 --out _local/dist/rainbow/846`. This also re-points the stale `manifest.glb.source` that breaks `minimap.test.mjs:77`.

## Phase 2: rendered light (Blender, local CPU, $0)
File: `360walkaround/pipeline/export_dollhouse.py`, new flag `--bake-light`. Plus the viewer and `build_zip.mjs`.
1. Before the bake, override the scene materials in memory to the tour palette. Use `material-board.json` `habait-tel-aviv-luxury-v1`: warm white plaster, cream zero-line leaves and jambs (fixes the `wood_oak` doors), sand-grey kitchen fronts, cream/ivory fabrics. The `.blend` is never saved.
2. The bake fits after the cut and merge, before the originals are deleted (ED:541 → before ED:549). Steps:
   - lightmap-pack UVs on the joined output nodes (one shared atlas, 2048, 1024 for phones);
   - a selected-to-active **light-only** Cycles bake (Diffuse direct+indirect, no colour) from the full-height originals, with ceilings, `L_ceil_*`, `L_sun` and the HDRI;
   - OIDN denoise;
   - caps and glass are not baked.
   - Light-only keeps the floor-finish switch working (colour at runtime) and one shared atlas for all three finishes.
3. Export changes:
   - `export_texcoords=True` (ED:623), texcoord quantization 12 (ED:621), `"UV"` added to the `dissolve_limit` delimit (ED:573).
   - The atlas is written as `light.webp` next to the GLB. Report fields: atlas size, samples, bake time, scene sha256.
   - `--selftest` is extended.
4. `build_zip.mjs` inlines `light.webp` as base64. The viewer sets `material.lightMap` on `uv` (channel 0, `flipY=false`, sRGB→linear as baked) for every non-glass, non-cap material and lowers the runtime lights to avoid double lighting. If the atlas is missing, the Phase 1 look stays.
5. Budget: `dollhouse.html` grows by ≤ 600 KB. A poster frame (a still of the baked model at the 3D preset) is shown first.
6. Run one bake locally. Kaggle cancels jobs that open a `.blend`, so it stays local. Measure the CPU time; it is estimated, not measured.

## Not in this plan
Projection of the AI panos (ruled out above), pre-rendered spinner, Gaussian splats, path tracing. Deploying to habait-platform is a separate explicit go (standing rail §9).

## Verification
- **Unit:**
  - `node test/smoke.mjs`
  - `export_dollhouse.py --selftest`
  - `node test/minimap.test.mjs` (computePresets + frames)
  - new node checks: the rooms block has 11 entries with Hebrew names and areas that match `plan.general.json`; every scene id exists in `scenes.json`.
- **Browser, in the work tree on :8851** (headless Chrome, the `cap3d.cjs` recipe, iPhone 13 + Pixel 7 + desktop 1440):
  - `apartment.test.mjs` and `minimap.test.mjs` pass, extended with: 11 labels visible in Top; tapping the living-room floor opens the sheet; "צפו ב-360°" switches to the tour tab with `scene=living` confirmed by `habait:view`; "חזרה לתלת-ממד" returns with the same view.
  - The model's bounding box covers ≥ 70% of the frame width.
  - At 390 px the 3D frame is fully above the mobile bar.
  - 0 page errors, 0 foreign requests from the ZIP's `3d/dollhouse.html` on `file://`.
- **Visual:** before/after screenshots at the same angles next to `current/*.png`, written to the research folder `after/`. Eliran checks on his phone at the work-tree URL.
- **Phase 2:** an A/B of Phase 1 vs baked at the same 3 presets; `dollhouse.html` size delta; open time under CPU×4 compared with today's 3.7 s.
- **Close:** hash check → copy back → memory (`C:\RnD\memory\runs\`, `Projects\Habait\memory.md`, SESSIONS row). Deploy only on Eliran's own go.
