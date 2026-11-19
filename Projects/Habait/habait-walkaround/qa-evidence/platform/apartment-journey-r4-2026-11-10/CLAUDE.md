# qa-evidence/platform/apartment-journey-r4-2026-11-10/ — context file
<!-- last-updated: 2026-11-10 -->

## Purpose
The evidence of round 4 of plan `development/plans/2026-11-09-rainbow-v2.md` (§9): one automatic flight from «כניסה לדירה» into the 360 tour. All checks ran on a fresh stage of main `a8f0ddd`.

## What's here
| File | What |
|---|---|
| `sequence-375.jpg`, `-390.jpg`, `-430.jpg`, `-1440.jpg` | the flight, timed from the tap: start · floors · «16» · isolated floor · glide · living-room landing · the tour · «דלג לסיור» |
| `apartment-journey.json` | `test/apartment-journey.check.mjs`: PASS at 375/390/430/1440 (tap → tour ≈ 9.0–9.1 s; skip ≈ 1.5–1.6 s; reduced motion: tour in ≈ 1.0 s, no journey) |
| `hold-phone.json`, `hold-chrome.json`, `rainbow-flow.json` | the hold checks and the full route: PASS |
| `predeploy-stage-r4.json` | predeploy on the stage: PASS 34/34 |

The JPGs are gitignored (on disk only); the JSON and this file are committed.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md) · Rule: root `CLAUDE.md` §8.6
