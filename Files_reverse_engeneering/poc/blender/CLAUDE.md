# poc/blender/ — keyframe pipeline
<!-- last-updated: 2026-11-17 -->

## What's here
`lighting_presets.json` (6 keys), `relight.py` (one key → a NEW .blend), `build_keyframes.py` (dry by default, `--run`, manifest, idempotent, kills Blender at `--timeout`), `inspect_scene.py`, `calibrate_sky.py`. Gotcha: Nishita `sun_rotation` = plan bearing; sun lamp rot = (90−el, 0, 180−az).

## Links
Parent: [../CLAUDE.md](../CLAUDE.md)
