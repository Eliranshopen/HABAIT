---
name: day-night-keyframes
description: "Render pixel-aligned Day/Night lighting keyframes from a pipeline .blend (360 viewpoint panoramas, or baked atlases of a free 3D walk) and show them with a clock slider that cross-fades the two nearest keyframes. Use when a tour or walk needs time-of-day, sunset or night."
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

# /day-night-keyframes — "explore the light" for a 360 viewpoint (mode A) or a free 3D walk (mode B)

Installed 2026-11-17 on Eliran's word. **Proven once** (Kedma D/1 `cp-living`, 6 keyframes, QA PASS 1440/390,
evidence `C:\RnD\Files_reverse_engeneering\`) — not yet run on a second room or ported into `tour360`.
Mechanism: the same one measured in a reference reel (`Files_reverse_engeneering/research/01-video-forensics.md` §5):
picture(h) = (1−t)·K_i + t·K_{i+1} between the two keyframes that bracket the clock. Our keyframes are Cycles renders
of the SAME scene with only the light changed, so geometry never drifts (unlike an AI relight).

## Inputs
- A built scene `scene.blend` + its `plan.json` with `camera_points[]` (pipeline `build_scene.py`). Never written.
- The pipeline renderer `render_pano.py` (used read-only; default path in `scripts/build_keyframes.py`).
- A job folder you own (never inside this skill, never inside a live project).
- North: the plan's north arrow → sun bearings. If unknown, say so; the PoC assumed plan-up = north.

## Steps
1. **Job folder + presets:** copy `assets/lighting_presets.example.json` to `<job>/lighting_presets.json`; set sun
   azimuth/elevation per keyframe from the room's real openings and north (bearing from the camera to each exterior
   opening: `plan.json` `openings[].centre_cm`). Rules: `references/lighting-rules.md`.
2. **Inspect** (optional): `blender -b --factory-startup <scene.blend> -P scripts/inspect_scene.py -- <job>/scene-inspect.json`.
3. **Dry run** (prints the plan, writes nothing):
   `python -I scripts/build_keyframes.py --blend <scene.blend> --plan <plan.json> --presets <job>/lighting_presets.json --out-root <job>/out --point <cp> --res 1024x512 --samples 16 --tag preview`
4. **Preview** the same with `--run`, ONE key per command (`--keys noon`), each under `timeout 560` (root §12;
   the driver kills Blender at `--timeout 520`). ≤ 2 tuning rounds, then stop and list the remaining look gaps.
   Before a batch: `Get-Process blender` — other sessions may be rendering; one heavy run at a time.
5. **Final**: `--res 2048x1024 --samples 16 --tag final` on this CPU (≈ 3–7 min per key), or 8192/128+ on a GPU box.
6. **Gate**: every `render` row of `<job>/out/final/manifest.json` has the SAME `depth_sha16`. Re-run → every key SKIP.
7. **Viewer**: copy `assets/viewer/{index.html,daynight.js}` to `<job>/viewer/`, the finals to `viewer/media/`, write
   `viewer/scene.json` from `assets/viewer/scene.example.json` (keyframes {name,label,hour,src}, views {label,yaw,pitch}).
8. **QA**: `timeout 300 bash scripts/qa/run_qa.sh <job>/viewer <job>/qa-shots` → exit 0 and `qa-result.json` pass;
   then LOOK at `desk_*.png` and `phone_*.png` yourself (a pass is not a look).

## Mode B: free 3D walk (walkaround). Proven once: Hatzav house, 4 keys, QA PASS, 2026-11-17
Same idea for a walk in the model: the light is baked into texture atlases **once per keyframe on the SAME prepared
model** (same UVs, same glTF; `walk.bin` hash equal across keys). The shader mixes the two atlas sets that bracket the
clock, in linear light. The live parts (sky, lawn, plants) follow the same weight. Evidence: `Files_reverse_engeneering/poc-walk/`.
1. **Input:** a walk job's `prep.blend` + `prep.json` (stage `prep` of `scripts/walk/walk_bake.py`, copied from the
   Hatzav recipe), plus its `walk-grid.json|png` and `model/sky.jpg`. Never written.
2. **Presets:** copy `assets/walk_presets.example.json` to the job. A scene lit only by an HDRI gets a sun from `relight.py`.
   Exposure is applied at export, so `--export-only` retunes it without a re-bake.
3. **Bake** (dry first, then `--run`, every call under `timeout 540` with `--budget-s 400`; it stops cleanly, so re-run to continue):
   `python -I scripts/walk/walk_keyframes.py --prep <prep.blend> --presets <job>/walk_presets.json --out <job>/out [--samples 16]`
   On this CPU each key takes about 10 min (6 groups at 2048, 16 samples, about 100 s each).
4. **Viewer:** copy `assets/walk-viewer/{index.html,walk.js}` plus the job's `vendor/`, `walk-grid.*` and `model/sky.jpg`
   to `<job>/viewer/`. Write `daynight.json` from `assets/walk-viewer/daynight.example.json`. Then run
   `python -I scripts/walk/sync_media.py <job>/out <job>/viewer <presets>`, which stops if the geometry differs between keys.
   **Replace the Hatzav texts** in `index.html` (title, badge) and in `walk.js` (hint, `NAMES`).
5. **QA:** `timeout 520 bash scripts/walk/qa/run_qa.sh <viewer> <shots> [port]`, using Windows paths (`pwd -W`). It checks
   1440 and 390 with no errors and no overflow. The walk must still move on free floor. At three places, the midpoint
   hour must equal the linear-light 50/50 mix (≤ 1.5/255). Then LOOK at the `raw-*` shots.
   The script waits until the local server answers (on a busy machine it starts slowly).
6. **Night look:** with many ceiling spots a night is flat. Use the key's `lights` rules (`[{match, factor}]`: spots ×0.12,
   pendants and table lamps ×1.5–2.5) plus a warm `lamp_color` (≈ 1, 0.56, 0.30). In `daynight.json`, darken `curtain` and set `glow` warm.

## Outputs
`<job>/out/<tag>/<cp>/<key>/pano.webp|png|depth.png|pano.render.json`, `<job>/out/<tag>/variants/<key>.blend`,
`<job>/out/<tag>/manifest.json` (relight + render rows: inputs, hashes, seconds, `cost_usd` 0), `<job>/viewer/`,
`<job>/qa-shots/` + `qa-result.json`.

## Validation (all required)
Depth hashes equal · midpoint frame = 50/50 mix of its keyframes (≤ 1.5/255, weight 0.5 ± 0.05) · keyframes differ
· no console errors · no horizontal overflow (both edges) · desktop 1440×900 + phone 390×844 shots looked at.

## Rails
- $0 by design. An AI relight (fal edit) is NOT part of this skill: it drifts objects (seen in the reference) and
  breaks plan fidelity; only on Eliran's word, with the AI badge and a pixel-diff gate.
- Light only: `relight.py` changes world, sun, lamp energy, emission strength, exposure. Never geometry, materials,
  cameras or seed. Every picture carries the «הדמיה» badge.
- Adopting the feature in a product tour, the number of keyframes, the house vs developer look and the view outside
  are Eliran's calls.

## Known limits
CPU-only on this machine · the mid-fade double sun patch (same as the reference; fix: more keyframes or a lamps-only
pass) · `interior` scales every non-sun light together · one equirect per keyframe (no tiles) — phones need ≤ 4096 ·
the scene kit has no cove/pendant fixtures yet, so nights look flat.
Walk: the bake is DIFFUSE only (no reflections, the same as the walk itself). Without the step-6 lamp rules a night is flat and grey. Atlases: 4 keys × 6 × 2048 on desktop, and phones load 1024.
