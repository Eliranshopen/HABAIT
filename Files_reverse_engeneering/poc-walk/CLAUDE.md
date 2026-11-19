# poc-walk/ — Day/Night in a free 3D walk (Hatzav house)
<!-- last-updated: 2026-11-17 -->

## What's here
The Hatzav walk (read from `.wt/harei-zahav-naama`, never written there) with its light baked once per lighting keyframe (4 keys, same UV atlases, same glTF) and a clock slider that cross-fades the two atlas sets around the hour, in the shader. QA PASS 1440/390, blend proof ≤ 0.43/255 mean. $0, about 40 min of CPU bakes. Packaged as mode B of `.claude/skills/day-night-keyframes`. Round 2 (same evening, Eliran: «למה אתה לא מתקן»): ceiling spots off at sunset and at 12% at night, warm lamps, darker curtain, warm shades, so the night reads as night. Morning and noon exposure were evened out.

## Subfolders
| Folder | Purpose |
|---|---|
| `blender/` | driver `walk_keyframes.py`, `walk_presets.json`, `sync_media.py` |
| `viewer/` | the walk page + `daynight.json` (model/ and media/ are git-ignored outputs) |
| `qa/` | browser shots + linear-light blend proof |
| `out/` | bakes, EXRs, manifest (git-ignored) |

## Links
Parent: [../CLAUDE.md](../CLAUDE.md)
