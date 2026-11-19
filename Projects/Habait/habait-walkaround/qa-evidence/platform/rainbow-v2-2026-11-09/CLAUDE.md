# qa-evidence/platform/rainbow-v2-2026-11-09/ — context file
<!-- last-updated: 2026-11-09 -->

## Purpose
The evidence of the Rainbow v2 test page (`/v2/`, plan `development/plans/2026-11-09-rainbow-v2.md`): the reference teardown sheets, our captures at 1440 and 390 on the stage built from main `a6a32ec`, the gates, and the stage-vs-baseline comparison.

## What's here
| File | What |
|---|---|
| `sidebyside-reference-vs-ours.jpg` | one row per stage: reference frame · ours 1440 · ours 390 |
| `sheet1440.jpg`, `sheet390.jpg` | every stage, at rest and mid-transition (19 scroll stops each) |
| `interact.jpg` | the live 3D dialog (1440, 390) and a filmstrip jump to room 5 |
| `reduced-motion-1440.jpg`, `reduced-motion-390.jpg` | the static page (prefers-reduced-motion): hero, floor, cutaway, rooms, CTA |
| `capture-log.txt` | per-stop overflow check (scrollWidth = clientWidth, no control cut), resolved routes, dialog, strip |
| `responsive-gate-v2.json` | `responsive-gate.mjs` on `/v2/` of the stage: PASS 1440 + 390 |
| `predeploy-stage-v2.json` | the stage's predeploy: PASS 32/32 page×size |
| `stage-compare.txt` | stage after the merge vs a baseline stage of main before it: +32 files, all under `v2/`, 0 changed, 0 removed |
| `ref-4fps-*.jpg` | the reference recording at 4 fps, cropped to the laptop screen, time-stamped (the teardown) |

## Gotchas
- The reference frames show a third party's site: teardown evidence only, never product media.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md) · Rule: root `CLAUDE.md` §8.6
