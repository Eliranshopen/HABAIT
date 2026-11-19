# qa-evidence/platform/rainbow-v2-r2-2026-11-09/ — context file
<!-- last-updated: 2026-11-09 -->

## Purpose
The evidence of round 2 of plan `development/plans/2026-11-09-rainbow-v2.md` (§8): v2 became the apartment journey `/apartment-journey/`, reached only from `/hold/` for 846.

## What's here
| File | What |
|---|---|
| `rainbow-flow.json`, `flow-1440.jpg`, `flow-390.jpg` | `test/rainbow-flow.check.mjs` on the fresh stage of main `91ed932`, PASS at 1440 + 390 |
| `predeploy-stage-r2b.json` | predeploy on that stage, PASS 34/34; `/apartment-journey/?from=hold&unit=846` passes at 1440 and 390 |
| `hold-chrome.json` | `test/hold-chrome.check.mjs` on that stage, PASS (360, 390, 430, 390-landscape, 1440) |
| `journey-walk-1440.jpg`, `journey-walk-390.jpg`, `journey-capture-log.txt` | the journey at 15 scroll points (floor reveal, fly-in, walk land/turn/push, cutaway, CTA). Captured on the pre-merge overlay of the same code, before the `/v2/` stub change; no overflow, no errors |
| `walk-frames-land-mid-leave.jpg` | each room's first, middle and last walk frame |
| `hold-floor-glow.jpg` | the hold with 846's card open and its floor glowing (1440, 390) |

The JPGs are gitignored (on disk only); the text files are committed.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md) · Rule: root `CLAUDE.md` §8.6
