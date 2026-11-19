# qa-evidence/platform/hold-ghost-2026-11-10/ — context file
<!-- last-updated: 2026-11-10 -->

## Purpose
The evidence of the 2026-11-10 fix: Eliran saw a ghost tower at the /hold/ stop on iPhone Safari (plan `development/plans/2026-11-09-hold-phone.md` §5). Reproduced and verified in Playwright WebKit 26.0 (playwright-core 1.56.1, build 2215), iPhone 13 (390) and iPhone SE (375) emulation.

## What's here
| File | What |
|---|---|
| `webkit-before-390-375.jpg` | BEFORE (main `a8f0ddd`): 390 rest · drag · drag further · 375 rest · drag. The air is a sharp, larger copy of the tower, and mid-drag it shows as a translucent second tower. |
| `webkit-before-drag-vs-after-390-375.jpg` | the before drag at 390, then AFTER: 390 rest · drag · drag further · 375 rest · drag further. One sharp tower; the air is a gradient. |
| `webkit-before-log.txt`, `webkit-after-log.txt` | WebKit facts: `'filter' in ctx` = false (no CanvasRenderingContext2D.filter), the framing, page errors 0 |
| `hold-phone.json` …, `predeploy-stage-ghost.json` | the Chromium gates on a fresh stage of main `ee80a5a` |

The JPGs are gitignored (on disk only); the text files are committed.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md) · Rule: root `CLAUDE.md` §8.6
