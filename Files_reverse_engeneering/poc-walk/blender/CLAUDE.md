# poc-walk/blender/ — the keyframe bakes
<!-- last-updated: 2026-11-17 -->

## What's here
`walk_keyframes.py`: per key, relight (`../../poc/blender/relight.py`) → bake every group (Hatzav `walk_bake.py`, read-only) → export atlases. Dry by default, `--run`, `--budget-s`, `--export-only` for exposure. Idempotent, with a manifest. `sync_media.py` copies atlases to the viewer and stops if the geometry differs.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md)
