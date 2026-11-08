# Task 08 — the viewer wears the baked light
**Agent:** `platform-dev` (status live, track habait) · **Model:** opus · **Ruling tier:** T0 · **Burst:** 7 · **Depends on:** 07
**Memory file:** `memory/agents/platform-dev.md` (standing agent)
All paths are inside `C:\RnD\.wt\apartment-3d\`.

## What to do
1. **`Habait/platform/tools/build_zip.mjs`:** if `light.webp` sits next to the picked GLB, inline it as base64 in `<script type="application/octet-stream" id="lightmap">`, the same way as `#glb`. If it is missing, change nothing (the Phase 1 look stays).
2. **`Habait/platform/js/apartment-3d.js`:**
   - `prepareDollhouse` accepts `lightmap` (ArrayBuffer) → `createImageBitmap` → a `THREE.Texture` with `flipY=false`, `channel = 0` (the exported UV), sRGB colour space as baked.
   - For every material except `glass` and `web_cap`: set `material.lightMap` and `lightMapIntensity` (tuned).
   - Lower the hemisphere/sun/environment so the light is not doubled; keep the ground contact shadow.
   - The floor-finish switch (`setFloor`) still works: the colour factor stays live.
3. **Poster frame:** after the first baked frame, store a still (`canvas.toDataURL('image/webp')`) at build time if feasible (a headless pass in `build_zip.mjs` is optional); otherwise the fade-in from task 05 stays. No loading text either way.
4. Phone tier: below 1.5 DPR or `deviceMemory ≤ 4`, use the 1024 px atlas if it was inlined.

## Files
- modifies: `Habait/platform/js/apartment-3d.js`, `Habait/platform/tools/build_zip.mjs`

## Acceptance
- `dollhouse.html` grows by ≤ 600 KB over Phase 1 (measured).
- Headless screenshots of the 3 presets × 3 floors in `after/phase2/`; the floor switch still changes the floor colour (pixel probe).
- With the atlas removed, the build falls back cleanly (same page as Phase 1, no error).
- Open time under CPU×4 (the `minimap.test.mjs:310-336` method) is measured and recorded, next to today's 3.7 s.

## Standing rails (inherited verbatim from the board README — root `CLAUDE.md` §0)
1. **Bounded read-first:** `memory/HOT.md`, then the LAST ~150 lines of your own `memory/agents/<name>.md` (plus its archive-index block). ⛔ Never read `memory/INDEX.md` whole — grep it.
2. **Write last, once:** ONE entry (`memory/_TEMPLATE.md`) into the layer that owns the fact, plus ONE ≤ 400-char pointer line under that layer's existing `memory/INDEX.md` header. ⛔ Never add a header.
3. **Second reader:** name which OTHER actor must know this; append ONE pointer line into their `memory/agents/<name>.md`, or say "none".
4. **An action is not done until its memory is written.**
5. ⛔ **The live repo `C:\RnD\Projects\Habait\habait-walkaround\` is read-only to every card until card 10.** Every write goes into `C:\RnD\.wt\apartment-3d\` (same relative paths as the repo) or into this board folder. Memory rows are the only live writes (root §8.7).
6. ⛔ **No git anywhere** (Eliran, 2026-11-03). `CHANGES.md` in the work tree is the diff.
7. ⚠ **Machine resource rules** (root `CLAUDE.md` §12): every test, build, server, browser or render runs as `timeout N <cmd>`, one heavy run at a time, foreground; kill what you start by PID. The work-tree server is `PORT=8851`. Never use :8850 (another session's port).
8. ⛔ **Blender only by its owner** (`Projects\Habait\SESSIONS.md` rule 4); no paid call on this board ($0 plan). Deploying is a separate explicit go from Eliran (root §9).
