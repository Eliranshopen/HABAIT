# Task 05 — the real-time look pass (no bake yet)
**Agent:** `platform-dev` (status live, track habait) · **Model:** opus · **Ruling tier:** T0 · **Burst:** 4 · **Depends on:** 04
**Memory file:** `memory/agents/platform-dev.md` (standing agent)
All paths are inside `C:\RnD\.wt\apartment-3d\`.

## What to do (`Habait/platform/js/apartment-3d.js` `mountDollhouse`, plus the template CSS in `build_zip.mjs`)
1. **Backdrop:** `WebGLRenderer({alpha:true})`, `scene.background = null`, and behind the canvas a light warm radial gradient matching the tour (cream to warm grey; pick the values from `benchmark_tour360_living.png`). Drop `#0b1220`.
2. **Tone and light:**
   - `renderer.toneMapping = THREE.NeutralToneMapping` (exists in r170);
   - `scene.environment` = PMREM of `new RoomEnvironment()` at a low `environmentIntensity`;
   - hemisphere light gentler; the sun's shadow stays, softer (`shadow.radius`, PCFSoft).
3. **Caps:** override `web_cap` at load to a warm grey poché (linear ≈ 0.35) plus a thin darker edge (an `EdgesGeometry` on the cap faces only, or a darker rim by vertex height). Not near-black.
4. **Glass:** for materials named `glass`: `depthWrite=false`, `transparent`, `renderOrder` after opaques, `receiveShadow=false` on those meshes. The stripes on the terrace rail must be gone.
5. **Framing:** change the fit factors in `computePresets` (`:49-69`) so the model's projected bounds cover ≈ 80 % of the frame's limiting dimension in the 3D and Top presets. Update the node asserts in `test/minimap.test.mjs:116-124` only if a polar/azimuth contract changes (it should not).
6. **Performance:**
   - `setPixelRatio(Math.min(devicePixelRatio, isPhone ? 1.5 : 2))`;
   - render on demand: render while animating, damping, auto-rotating or on a label/selection change, otherwise stop the loop. `stats.frames` keeps counting real renders.
7. **Entry:** the canvas fades in from the gradient (opacity 0 → 1, 400 ms) after the first frame. No loading text, no spinner.

## Files
- modifies: `Habait/platform/js/apartment-3d.js`, `Habait/platform/tools/build_zip.mjs` (template CSS)

## Acceptance
- Headless screenshots at the 3 presets (desktop + iPhone 13) are saved to `.wt\apartment-3d\after\phase1\`, named like `research\...\current\*.png`.
- In the 3D preset, the model's screen bounding box covers ≥ 70 % of the frame width.
- A pixel probe over the terrace rail shows no alternating dark/light stripes (≤ 2 transitions across a 40 px horizontal scan).
- After 3 s idle with auto-rotate off, `stats.frames` stops increasing.
- No page error; `minimap.test.mjs` timings are no worse than today (prepare/first frame).

## Standing rails (inherited verbatim from the board README — root `CLAUDE.md` §0)
1. **Bounded read-first:** `memory/HOT.md`, then the LAST ~150 lines of your own `memory/agents/<name>.md` (plus its archive-index block). ⛔ Never read `memory/INDEX.md` whole — grep it.
2. **Write last, once:** ONE entry (`memory/_TEMPLATE.md`) into the layer that owns the fact, plus ONE ≤ 400-char pointer line under that layer's existing `memory/INDEX.md` header. ⛔ Never add a header.
3. **Second reader:** name which OTHER actor must know this; append ONE pointer line into their `memory/agents/<name>.md`, or say "none".
4. **An action is not done until its memory is written.**
5. ⛔ **The live repo `C:\RnD\Projects\Habait\habait-walkaround\` is read-only to every card until card 10.** Every write goes into `C:\RnD\.wt\apartment-3d\` (same relative paths as the repo) or into this board folder. Memory rows are the only live writes (root §8.7).
6. ⛔ **No git anywhere** (Eliran, 2026-11-03). `CHANGES.md` in the work tree is the diff.
7. ⚠ **Machine resource rules** (root `CLAUDE.md` §12): every test, build, server, browser or render runs as `timeout N <cmd>`, one heavy run at a time, foreground; kill what you start by PID. The work-tree server is `PORT=8851`. Never use :8850 (another session's port).
8. ⛔ **Blender only by its owner** (`Projects\Habait\SESSIONS.md` rule 4); no paid call on this board ($0 plan). Deploying is a separate explicit go from Eliran (root §9).
