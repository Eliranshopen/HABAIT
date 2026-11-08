REGATE: PASS

Board dollhouse-in-tour, qa-reviewer, fresh context, 2026-11-03. Working-folder files = run copies (cmp identical, all six); platform and tour rebuilt from them (`regate-build-platform.txt` 27 files 4.87 MB exit 0; `regate-build-tour.txt` exit 0). No defects. Port 8851 free after; no live drift.

| # | Check | Result | Evidence / repro |
|---|---|---|---|
| 1 | Line endings vs live and the frozen archive | PASS. `build_zip.mjs` work 0 CRLF / 855 lines = live LF (0 CRLF / 835) = archive LF. The other five are CRLF in work, live and archive alike (every line: apartment-3d.js 846, build-tour.mjs 360, template.html 193, tour.css 1056, tour.js 1419). D2 closed | python byte count `\r\n` vs `\n` per file, three trees |
| 2a | D1 real input, desktop 1440x900 (mouse), iPhone 13 and Pixel 7 (touchscreen taps, CDP touch drag, real keyboard): real tap on the 3D button opens; focus on x | PASS x3 | `regate-probe1.txt` (75 ok, 0 FAIL), `regate-probe1.cjs` |
| 2b | Real drag on the canvas moves focus into the frame; Esc with nothing selected closes the layer in ONE press; focus returns to the 3D button; nothing left inert | PASS x3 | `regate-probe1.txt` |
| 2c | Room label tap selects the kitchen; 1st Esc closes the sheet only (layer stays), 2nd Esc closes the layer (the sheet-first rule holds, no double close) | PASS x3 | `regate-probe1.txt` |
| 2d | Label tap then real tap on "צפו ב-360°": tour scene becomes kitchen, layer hidden, no sibling inert | PASS x3 | `regate-probe1.txt` |
| 2e | Tour behind is dead while open: inert on the 15 siblings of the layer inside `main#t-root`, never on `#t-3d` or `#t-root` (so D1-first-attempt bug is gone); point where the 3D button was hits the layer; real taps on all 5-7 tool positions change nothing; Tab x8 never leaves the layer; arrow keys do not move the tour yaw; a 3D drag leaves the tour yaw unchanged | PASS x3 | `regate-probe1.txt` |
| 2f | After close everything is live: tour drag changes yaw (-19 to -30 deg), 3D button re-opens with a real tap, x by real tap closes, Esc with focus on x closes, 15x open/Esc churn leaves 0 inert, 0 page or console errors | PASS x3 | `regate-probe1.txt` |
| 3 | 3D interactive in the layer with real input: mouse drag desktop az 36.97 to 9.37 polar 50.6 to 46.7; touch drag iPhone az 36.7 to -15.6, Pixel az 36.8 to -2.1; preset button real tap 3d to top changes `__dollhouse.preset` | PASS | `regate-probe1.txt`. Note (probe, not a defect): a touch that STARTS on a room label button or the preset bar does not orbit (same as top-level; `regate-probe2c.txt` shows target BUTTON.dh-label vs CANVAS); touch-action pan-y does not block the horizontal orbit (`regate-probe3.txt`) |
| 4a | `check-dit.cjs` | PASS 48/0 (desktop, iPhone 13, Pixel 7) | `regate-check-dit.txt` |
| 4b | `reg-check-03/04/05/08` | PASS 40/47/22/8, FAIL 0, exit 0 | `regate-reg-check-*.txt` |
| 4c | `run-paint-proof.cjs` (HABAIT_APP_DIR set) | PASS 6/6, no stray chrome | `regate-paint-proof.txt` |
| 4d | platform `test/apartment.test.mjs` from the run platform | PASS exit 0, all green | `regate-apartment.test.txt` |
| 4e | `wt.py status dollhouse-in-tour` | 0 DRIFT (5 changed, 5 unchanged, 1 missing-copy = new 3d/dollhouse.html) | `regate-wt-status.txt` |

## Notes (no action required)
- The first run of my probe showed 4 FAILs per phone; all were probe errors (a drag that started on a label, stale label coordinates after the view changed to Top), fixed in `regate-probe1.cjs`; the product behaved correctly on re-run.
- `habait:escape` is posted with target origin `*` (same as the existing `habait:enter-room`); the tour accepts it only from its own frame (`e.source` check). The same page, embedded in the platform apartment page, posts `habait:escape` to a parent that ignores it (apartment.test green).
- Not covered: real GPU, real touch hardware, iOS Safari iframe focus, the deployed site (swiftshader Chrome + Playwright/CDP emulation only). `live-check.mjs` not run (paid).
