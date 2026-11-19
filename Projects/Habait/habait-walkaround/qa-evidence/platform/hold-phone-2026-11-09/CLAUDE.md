# qa-evidence/platform/hold-phone-2026-11-09/ — context file
<!-- last-updated: 2026-11-09 -->

## Purpose
The evidence of plan `development/plans/2026-11-09-hold-phone.md`: the hold's stop on a phone, reframed and tidied. All checks ran on a fresh stage of main `10d4af4`.

## What's here
| File | What |
|---|---|
| `before-after-phones.jpg` | at 375, 390 and 430: before stop · after stop · before 846 card · after 846 card |
| `before-after-390.jpg` | the same, 390 only |
| `before-after-1440.jpg` | desktop before (top) and after (bottom): unchanged |
| `coordinator-before-sheet.png` | the coordinator's capture of the test link (the ask) |
| `hold-phone.json` | `test/hold-phone.check.mjs`: PASS at 375/390/430/1440 (framing, floor 33 px, pills 44 px hit areas, one-line legal, toast, «כניסה לדירה» → journey, glow, no price) |
| `hold-chrome.json` | `test/hold-chrome.check.mjs`: PASS at 360/390/430/390-landscape/1440 |
| `rainbow-flow.json` | `test/rainbow-flow.check.mjs`: PASS (the full route, `/v2/` → `/`) |
| `predeploy-stage-hp2.json` | predeploy on the stage: PASS 34/34 |

The JPGs and PNG are gitignored (on disk only); the JSON and this file are committed.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md) · Rule: root `CLAUDE.md` §8.6
