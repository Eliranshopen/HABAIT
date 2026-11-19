# Day/Night PoC — setup and run

**Type:** panorama-based (pre-rendered Cycles keyframes + WebGL cross-fade). Not real-time 3D. Research only: not deployed, not part of any project.

## View it
```bash
cd C:/RnD/Files_reverse_engeneering/poc/viewer
timeout 540 python -m http.server 8765 --bind 127.0.0.1    # then open http://127.0.0.1:8765/  (Ctrl+C to stop)
```
Drag (mouse/touch), wheel/pinch zoom, arrow keys; slider 06:00–22:00, ▶ plays a day in 8 s, the tick buttons animate to an hour; the tabs turn to preset views. URL params: `hour`, `yaw`, `pitch`, `fov`, `linear=1`, `ui=0`.

## Rebuild the keyframes ($0, local Blender, ≈ 27 min on this CPU)
```bash
cd C:/RnD/Files_reverse_engeneering/poc
python -I blender/build_keyframes.py --res 2048x1024 --samples 16 --tag final           # dry run: prints the plan
timeout 560 python -I blender/build_keyframes.py --res 2048x1024 --samples 16 --tag final --keys night --run   # one key per command
cp out/final/cp-living/<key>/pano.webp viewer/media/living-<key>.webp
```
Source scene (read-only): `.wt/kedma-d1/…/tours/kedma-d1/scene-full.blend`; renderer (read-only): `…/pipeline/render_pano.py`.

## QA
```bash
timeout 300 bash qa/run_qa.sh     # exit 0 = shots ok, no console errors, no overflow, blend proof pass
```

## Files
| Path | What |
|---|---|
| `blender/lighting_presets.json` | the 6 keyframes (hour, sun, sky, lamps, exposure) |
| `blender/relight.py` | applies one keyframe, saves a NEW .blend |
| `blender/build_keyframes.py` | relight → render_pano per key, manifest, idempotent |
| `blender/inspect_scene.py`, `calibrate_sky.py` | scene lighting listing; Nishita sun direction calibration |
| `viewer/` | `index.html`, `daynight.js` (shader, drag, slider), `scene.json`, `media/` |
| `qa/` | `run_qa.sh`, `shots.mjs` (Playwright), `analyse.py` (blend proof), `shots/` |
| `out/` | `preview/` and `final/` renders + manifests |
