# poc/ — the Day/Night proof of concept
<!-- last-updated: 2026-11-17 -->

## What's here
Panorama-based: 6 Cycles lighting keyframes of one viewpoint (same .blend, camera, seed) blended by a clock slider in a WebGL viewer. Setup and commands: `README.md`. Reads the Kedma scene and `render_pano.py` read-only; writes only here. $0.

## Subfolders
| Folder | Purpose |
|---|---|
| `blender/` | presets, relight, driver, calibration |
| `viewer/` | the web page |
| `qa/` | browser QA + blend proof |
| `out/` | render outputs + manifests (git-ignored) |

## Links
Parent: [../CLAUDE.md](../CLAUDE.md)
