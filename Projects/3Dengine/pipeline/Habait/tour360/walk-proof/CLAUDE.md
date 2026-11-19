# walk-proof/ — context file
<!-- last-updated: 2026-11-12 -->

## Purpose
A PROOF, not a shipped feature (Eliran 2026-11-12: «אני לא רוצה לוותר על אופציית התנועה בדירה כאילו מישהו הולך בה … אפשר לשפר את הדמיית הדירה ע"י שימוש בבלנדר»): continuous walking through apt846 on pictures rendered in Blender. Each walk point has a Cycles 360 picture and its exact depth map; the page draws each picture as a 3D shell and moves the camera through space between them, so a step can stop anywhere on the way. $0.

## Key files
| File | Purpose |
|---|---|
| `index.html` | the page: canvas, the «הדמיה · Simulation» badge, the hint, the on-screen word, the compare button |
| `walk.js` | raw WebGL2, no library: shells from picture + depth, two shells blended between 38 % and 62 % of a route (`?xf0=&xf1=`), routes as polylines (walk.json's third field), a route chosen by where it leads 2.6 m ahead, the view turning with the route while ↑ is held, keys (↑ ↓ walk, ← → turn), click / tap on the floor, floor rings hidden behind walls, compare with the shipped tour picture at the two shared viewpoints. `window.__walk` = state and test hooks |
| `build-walk.py` | `--tour <360walkaround/tours/apt846-walk-proof> --apt <apartments/apt846> --out <folder>`: copies pictures (desktop 2560, phone 2048), depth maps (1024x512, nearest), the compare pictures, writes `walk.json`. The graph is `GRAPH` in this file |
| `build-tour-walk.py` | the walk on the TOUR'S OWN pictures (2026-11-12, round 2): `--apt --dist --furnished --footprints --out [--map]`; each viewpoint = the shipped picture + the depth Cycles rendered from the same spot (`apt846-furnished/renders/cp-<id>/depth.png`, not `apartments/apt846/depth/` — old spots); routes along the tour's door links found on the plan (walls, panes, `walk_footprints.py` furniture, openings carved), written as polylines in `walk.json` |
| `walk-check.mjs` | `<url> --out <dir>`: the page at 1440 and 390 — loads, walks the whole rail with the keys (desktop) and by taps on the floor (phone), stops mid-way, compare on/off, no page error, no horizontal scroll |

## Conventions / gotchas
- The pictures come from `360walkaround/tours/apt846-walk-proof/` (media, git-ignored), made by `360walkaround/pipeline/walk_look.py` (look pass) + `render_pano.py`.
- A picture's centre faces the plan's up (yaw 0); right = clockwise. World metres: X = plan x, Z = plan y, Y up.
- Depth PNG = rgb24 big-endian centimetres; never resample it with anything but nearest neighbour.
- No walking arrow buttons on a phone (Eliran 2026-11-11): a phone walks by a tap on the floor.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md) · Record: `memory/project/2026-11-12-blender-walk-proof.md` · Plan: `development/plans/2026-11-12-blender-walk-proof.md`
