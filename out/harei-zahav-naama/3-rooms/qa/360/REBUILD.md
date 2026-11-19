# Hatzav 360 tour — rebuild and stage
<!-- 2026-11-18 · the tour360 sub-agent -->

All commands: Git Bash, $0, no network. `T` = `C:/RnD/.wt/harei-zahav-naama/Projects/Habait/habait-walkaround/Habait/tour360`,
`JOB` = `C:/RnD/.wt/harei-zahav-naama/out/harei-zahav-naama/3-rooms`. `sharp` and `playwright-core` come from the 3Dengine
appdeps folder (the worktree has no `Habait/MVP/app`), so every command runs with `HABAIT_APP_DIR` set.

```bash
export T=C:/RnD/.wt/harei-zahav-naama/Projects/Habait/habait-walkaround/Habait/tour360
export JOB=C:/RnD/.wt/harei-zahav-naama/out/harei-zahav-naama/3-rooms
export HABAIT_APP_DIR=C:/RnD/Projects/3Dengine/appdeps
cd "$T"
```

## Which panoramas — ONE line
`apartments/hatzav/source.json` → `"panoSource": "blender"` or `"real"`.
- `blender` = `JOB/work/pano360/<room>.png` (2048×1024 Blender renders).
- `real` = `JOB/work/pano360/real/<room>.jpg` (4096×2048, seam closed). The `.png` files beside them (raw model answers, open seam) are never read.
`prep.mjs --source real|blender` overrides the line for one run. prep takes every room whose picture exists **now**; a missing room is
listed as "not rendered yet" and simply left out (the doors to it are dropped). For `real`, every room also needs its Blender
render (the Original switch shows it).

## (0) Blender set (source.json now says "real": the shipped build is the realistic set)
```bash
timeout 540 node apartments/hatzav/prep.mjs --source blender
timeout 540 node tools/build-tour.mjs hatzav --catalog
timeout 300 node tools/smoke.mjs hatzav --catalog
```

## (a) Switch to the realistic panoramas and rebuild
```bash
# either set "panoSource": "real" in apartments/hatzav/source.json, or pass --source real:
timeout 540 node apartments/hatzav/prep.mjs --source real
timeout 540 node tools/build-tour.mjs hatzav --catalog --full --ungated-ok
timeout 300 node tools/smoke.mjs hatzav --catalog --full
# the eye check of the rings on the realistic pictures, and the browser proof:
cd "$JOB" && timeout 120 node scripts/31_tour360_marker_overlay.mjs "$T/apartments/hatzav" qa/360/real
timeout 300 node scripts/30_tour360_shots.mjs "$T/dist/hatzav" qa/360/real
```
- `--full` carries the 4096×2048 set to desktops that can hold it (phones keep the 2048 set).
- `--ungated-ok` is required for `real`: the realistic set is an AI pass over the renders, and RAINBOW's per-picture fidelity gate
  (`tools/fidelity-gate.mjs`: a paid depth call + a plan trace) was **not** run on it. build-tour refuses the set without the flag.
  Shipping it ungated is **Eliran's call** (root §6) — ask before the deploy.
- The rings and doors are computed from the cameras, so they stay right only if the AI pass kept every piece where the render had it.
  Look at `qa/360/real/overlay-<room>.jpg` before shipping.

## (b) Stage a deployable folder (the main session deploys; nothing here deploys)
```bash
timeout 120 node tools/stage-tour.mjs hatzav C:/Users/elira/AppData/Local/Temp/habait-stage/habait-tour-hatzav
#   view-only link (no /api function, no swap, no typed change):  ... --no-api
```
The staged folder holds `index.html`, the media, `api/edit.mjs` + `api/_handler.mjs` + `api/chat-transport.mjs` + `api/catalog.json`
(the swap catalog the function binds photos to) and `vercel.json` (noindex, `maxDuration: 300`). The function answers 503 until
the Vercel project carries the key NAMES `FAL_KEY`, `OPENROUTER_API_KEY`, `TOUR_EDIT_CODE` (README §"Add an apartment", step 7);
until then the page is the read-only tour (no rings). A swap or a typed change is a paid call at click time, under the handler's caps.
stage-tour refuses a target inside `C:\RnD`; the folder name is the Vercel project name.
