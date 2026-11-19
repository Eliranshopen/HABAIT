# 08 — Reusable workflows (Phase 8)

Status words: **PROVEN-ONCE** = run end-to-end here with evidence on disk (one room) · **DOCUMENTED** = known practice, not run here · nothing below is "production-ready".

## W1 Day/Night keyframes for a viewpoint — PROVEN-ONCE
- **Purpose:** N pixel-aligned lighting variants of one equirect viewpoint.
- **Inputs:** a built `scene.blend` + `plan.json` with `camera_points`; `poc/blender/lighting_presets.json` (hour, sun az/el/energy/colour, sky, interior scale, exposure).
- **Dependencies:** Blender 4.5.10; `render_pano.py` from the pipeline (read-only).
- **Steps:** `python -I poc/blender/build_keyframes.py --point <cp> --res WxH --samples S` (dry) → same with `--run`. Per key: `relight.py` writes `out/<tag>/variants/<key>.blend` (source never written), `render_pano.py` renders `out/<tag>/<cp>/<key>/pano.webp|png|depth.png`.
- **Outputs:** panoramas + `out/<tag>/manifest.json` (relight and render rows with hashes, seconds, $0).
- **Validation:** every row's `depth_sha16` identical; pictures differ; a re-run prints SKIP for every key.
- **Limits:** CPU here ≈ 3–7 min per 2048 keyframe at 16 spp; sun values hand-set; plan-up assumed north; no fixtures beyond ceiling discs.

## W2 Day/Night viewer — PROVEN-ONCE
- **Purpose:** show a node's keyframes with a clock slider, a 2-keyframe linear (or linear-light) cross-fade.
- **Inputs:** `scene.json` (hours, nodes, keyframes {hour, src}, views, hotspots) + webp files.
- **Dependencies:** none (WebGL1, one JS file). Serve over HTTP (`fetch`).
- **Validation:** W5.
- **Limits:** one equirect texture per keyframe (no tiles); 2 textures bound at a time; GPU memory grows with keyframes × resolution.

## W3 Photoreal interior lighting rules (Blender) — DOCUMENTED, partly proven
- AgX + a look; sun lamp rotation = (90−el, 0, 180−az) for plan bearings (verified against `build_scene.py`); Nishita `sun_rotation` = the same bearing (calibrated, `poc/out/sky-calibration.json`).
- Day: lamps OFF, exposure up 1.5–2.5 EV for a one-opening room; Night: lamps ON, exposure ≈ −0.5…−1, dark exterior or a night plate.
- Same seed, same samples, same resolution across keyframes; `use_animated_seed` off.

## W4 Panorama production at scale — DOCUMENTED
- Draft 2048/16 spp to tune looks (≈ 2–4 min CPU), then final 8192/128–256 spp on the GPU box; 4096 versions for phones; WebP q90.
- One heavy Blender process at a time; check `Get-Process blender` for other sessions' renders before a batch.

## W5 Browser QA of a panorama feature — PROVEN-ONCE
- `timeout 300 bash poc/qa/run_qa.sh`: local HTTP server (killed by PID), Playwright-core from `Projects/3Dengine/appdeps` + system Chrome with SwiftShader, screenshots 1440×900 and 390×844, console errors, overflow on both edges, then `analyse.py` (the in-between frame equals the 50/50 mix of its keyframes within 1.5/255, keyframes differ, nothing blank).
- `--screenshot` CLI of headless Chrome was too slow (1–4 min per shot); use Playwright.

## W6 Video forensics of a reference — PROVEN-ONCE
- ffprobe → crop band detection → keyframes → `research/tools/motion_model.py` (homography inliers: rotation-only = panorama) → least-squares mix fit of in-between frames against candidate keyframes (cross-fade vs relight) → phase correlation on edges (alignment) → detail crops (AI drift).
- Label everything OBSERVED / MEASURED / INFERRED / VERIFIED / UNKNOWN.

## Asset optimisation — DOCUMENTED
WebP q90 of these flat draft walls is ≈ 50 KB per 2048 panorama; textured 8K will be 1–3 MB each → lazy-load keyframes of other nodes, preload only the current node's set.

## Skill packaging
Installed 2026-11-17 on Eliran's word: `.claude/skills/day-night-keyframes/` (explicit-only, `/day-night-keyframes`); the draft stays in `skill-draft/` as history.
