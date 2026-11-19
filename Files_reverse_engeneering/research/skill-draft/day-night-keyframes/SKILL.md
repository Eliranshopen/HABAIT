---
name: day-night-keyframes
description: DRAFT — not installed. Render pixel-aligned Day/Night lighting keyframes of a 360 viewpoint from a pipeline .blend and show them with a clock slider that cross-fades the two nearest keyframes. Use when a tour needs "explore the light" / time-of-day / night views of a room.
disable-model-invocation: true
---
# Day/Night keyframes (draft, proven once on Kedma D/1 cp-living, 2026-11-17)

## Inputs
- `scene.blend` + `plan.json` of a built tour (pipeline `build_scene.py`), a `camera_points[].id`.
- `lighting_presets.json`: keyframes {name, label, hour, sun{az,el,energy,color,angle_deg}|null, sky{nishita|color}, interior, exposure}. Bearings are plan bearings (0 = plan up, clockwise). Take north from the sales plan.

## Steps
1. Dry run: `python -I build_keyframes.py --point <cp> --res 1024x512 --samples 16 --tag preview`.
2. Tune looks on previews (`--run`), ≤ 2 rounds; then final `--res 8192x4096 --samples 128 --tag final --run` one key per command under `timeout` (machine rule §12).
3. Gate: all `depth_sha16` equal in `out/<tag>/manifest.json`.
4. Write `scene.json` (keyframes → webp), copy the viewer (`daynight.js`, `index.html`).
5. QA: `timeout 300 bash qa/run_qa.sh` → exit 0, `qa-result.json` pass; look at 1440 and 390 shots yourself.

## Outputs
Panoramas per keyframe, manifest rows ($0, seconds, hashes), the viewer folder, QA shots + `qa-result.json`.

## Validation
Depth hashes equal · in-between frame = linear mix of its two keyframes (≤ 1.5/255) · no console errors · no overflow · desktop + phone shots.

## Known limits
CPU-only here; mid-fade double shadow; lamps scale every non-sun light together; AI relight is out of scope (Eliran's call, AI badge); not yet ported into `tour360` (Pannellum/PSV).
