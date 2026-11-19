# poc-walk/viewer/ — the walk with the light slider
<!-- last-updated: 2026-11-17 -->

## What's here
A copy of the Hatzav walk (`walk.js`, `index.html`, `vendor/`, `walk-grid.*`) plus the Day/Night part: `mixMat` (shader mix of two atlases), `daynight.json` (keys, sky and live light), and a slider panel (top on desktop, bottom on phones). Serve over HTTP. `?hour=` and `?ui=0` are for QA; QA reads `window.__walk.setHour`.

## Subfolders
| Folder | Purpose |
|---|---|
| `model/` | glTF + first-key atlases (+ _1k), from sync_media (git-ignored) |
| `media/` | per-key atlases (git-ignored) |

## Links
Parent: [../CLAUDE.md](../CLAUDE.md)
