# Board — tour-exterior-floors
<!-- created: 2026-11-04 · coordinator: main session rnd-fd · owner: Eliran Shopen · plan: development/plans/2026-11-04-tour-exterior-floors.md -->

**Goal (Eliran, 2026-11-04, on https://habait-flow.vercel.app/tour/):** "זה תצוגה של הבניין והסביבה אז לא צריך את כפתורי הבטון, פרקט ושיש
ששייכים רק להדמייה של הדירה". The building and surroundings scenes (the exterior nodes) do not show the floor-finish buttons; the apartment
scenes keep them. **State:** `CLOSED` 2026-11-04 (live QA PASS); **DEPLOYED** 2026-11-04 on Eliran's go (he ran `vercel deploy --prod` from `scratchpad/deploy-prod-5`), deployed-site QA PASS.

## Key state
- Proven on production before the fix: `prod-before.txt` (probe-floors.cjs) — FAIL 14: the buttons show on every exterior scene, desktop + iPhone 13.
- Fix: `tour360/viewer/tour.js` `renderVideoBar` hides `#t-floor-seg` on an exterior scene (and the whole bar when that scene has no room video).
- Working folder `.wt/tour-exterior-floors` (tour.js + `dist/apt846/index.html`), test build `run/` (`rebuild-run.sh`: live tour360 sources + the fix; the built index differs from live only by the fix).
- Test build: `run-after.txt` PASS (exterior hidden, apartment shown, desktop + iPhone 13), `run-hop.txt` PASS (in-page hop exterior → apartment → exterior), transition-rise `check-rise` 36/0 (`run-check-rise.txt`).
- Closed 2 files (`wt.py close --go`); live = working folder byte-exact, CRLF kept.

## Cards
| # | Card | State |
|---|---|---|
| 01 | prove it on production | DONE — FAIL 14 |
| 02 | fix in a working folder + test build | DONE |
| 03 | close (hash check, copy back, tour dist from live sources) | DONE |
| 04 | QA on the live result — fresh reviewer, refute (`qa-report.md`) | DONE — PASS, 0 defects (routes 88/0; note N1: the video player's own floor strip on an exterior clip — no exterior clips in this build; Eliran's call if one ships) |
| 05 | QA on the deployed site | DONE — `prod-after.txt` PASS (exterior hidden, apartment shown, desktop + iPhone 13), `prod-site-check.txt` 14/14 |

## Rails
Root CLAUDE.md §0, §2, §8.7, §8.9, §12; no git; `timeout` on every run, port 8851 only; never open a `.env`; no paid call; deploy only on Eliran's own go.
