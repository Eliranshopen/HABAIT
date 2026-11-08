GATE: FAIL (1, low-medium; 3 low/info notes)

# transition-rise gate — qa-reviewer, fresh context, 2026-11-04

Test build rebuilt from the shipping files (gate-build-platform.txt, gate-build-tour.txt, both exit 0). All my runs: Git Bash, `timeout`, one at a time, port 8851, servers closed. The author's scripts were run as COPIES (`gate-*.cjs`, outputs `gate-*`), so the author's evidence was not overwritten.

## Defects
| # | Sev | What | Repro |
|---|---|---|---|
| D1 | low-medium | **Closing the layer during the dive does not cancel it: the tour navigates anyway.** The dollhouse's `onEnterRoom` is async and has no cancel; the tour posts nothing to the page on × / Esc, so ~1.6 s later `habait:enter-room {dove:true}` arrives, `go(room)` runs with the layer already closed. The buyer who backed out is moved to another room with no layer on top. Not stuck or inert (inert 0, layer hidden), but a surprise navigation. | `node gate-probe3.cjs desktop S4` (also iphone13): living -> 3D -> select kitchen -> "view in 360" -> after 0.5 s press Esc (or click ×); 8 s later `scene` = kitchen (expected living). Output `gate-probe3-desktop.txt`, `gate-probe3-iphone13.txt`. Fix direction: tour sends `{type:'habait:3d-hide'}` (or a seq) on close and the page drops a pending dive, or tour ignores `enter-room` while `!dh.open`. |

## Notes (not gating)
| # | Sev | Note |
|---|---|---|
| N1 | low | Phones: the first/last frame sits ~2 CSS px (5-6 device px) sideways from the tour's: pixel7 living band diff 17.8 (best shift -5 px -> 2.0), iphone13 bathMain 3.7 (shift -6 -> 0.26); same on the dive's last frame vs arrival (pixel7 bedroomMain->living 17.8). Systematic, under the author's 22 threshold, desktop 0.0-0.1. `gate-probe1-*.txt`, `gate-probe2-*.txt`, `gate-frames/p1-pixel7-living-cmp.png`. |
| N2 | low | Diving into the room you are already in (S7): the dive ends on that room's opening heading, but the tour does not move (`m.scene === state.scene` -> `closeDh()` at once), so the layer closes on the tour's old view: yaw 70 before and after (measured). A cut of up to 180 deg at the end of the dive. `gate-probe3.cjs desktop S7`. The visual jump itself is inferred from yaw plus the code path, not screenshotted. |
| N3 | info | `wardrobe` has no depth map in the tour data (10 of 11 interior scenes have one): the 3D button opens with no move (`spec` null, `rise-ready` at once, layer revealed, 3D preset). Graceful, by design; dive into the wardrobe is a plain switch. `gate-probe1b.cjs`. |
| N4 | info (process) | Live moved under the test build: live `platform/css/apartment.css` (and the dist's apartment.css/apartment.json/846.zip/dollhouse.html) changed at 07:14 (another board). `wt.py status transition-rise`: DRIFT on the three live OUTPUT rows (846.zip, apartment.json, media/dollhouse.html). The five shipping source files and the other outputs: no drift. Card 06 must re-snapshot those outputs from the live files before the close step (they are rebuilt from live anyway). |

## Checks
| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Rebuild from shipping files (platform 846 + tour apt846) | PASS exit 0; run copies were byte-identical to `files\` | gate-build-*.txt |
| 2a | check-rise (copy) | PASS 36/0, desktop + iPhone 13 + Pixel 7 | gate-check-rise.out, gate-frames/ |
| 2b | reg-check-dit | PASS 48/0 | gate-check-dit.out |
| 2c | reg-check-03 / 05 / 08 | PASS 40/0, 22/0, 8/0. Note: the author's reg-check-03 points at `.wt/apartment-3d/files` (a closed folder), not the run build; I re-ran it against the run build: 40/0 | gate-check-03/05/08.out |
| 2d | labels-embedded probe | PASS Pixel 7 + iPhone 13 Top 11/11 | gate-probe-labels.out |
| 2e | platform smoke / minimap.test / apartment.test (HABAIT_APP_DIR set) | PASS all three exit 0 "all green" | gate-smoke.txt, gate-minimap.test.txt, gate-apartment.test.txt |
| 2f | paint-proof | PASS 6/6 (needs `HABAIT_APP_DIR` for sharp; without it the tool throws) | gate-paint-proof.out |
| 2g | **Author's claim: check-04 fails identically without the shipping files, pre-existing** | **Half true, cause misattributed.** check-04 on the run build fails 3/2 (iPhone: 3D frame 230..691 vs bar 595; then `.go` click timeout), reproduced (gate-check-04.out). But: (i) the CURRENT live platform copy WITHOUT the shipping files passes **47/0** (gate-check-04-baseline-pure.out); (ii) the run build + only the live `css/apartment.css` (changed 07:14, "sticky bars' real heights" fix) passes **47/0** (gate-check-04-run-with-live-css.out). So the failure came from the stale 23:09 css in the test build, fixed on live since; the shipping files do not break check-04. The "reported to rnd-23" item is moot. | gate-check-04*.out |
| 3a | Rise first frame vs tour frame, all 11 interior scenes, desktop | PASS 10 of 11 at |diff| 0.0-0.1 (threshold 22); wardrobe: no move (N3). Plus a turned view (yaw +95, pitch 12, hfov -15) on living/bedroomMain/bathMain/terraceLiving: 0.0-0.1 | gate-probe1-desktop.txt, gate-probe1-desktop-turned.txt |
| 3b | Same on phones: living/kitchen/bedroomMain/bathMain | PASS all under 22 (iPhone 1.1-3.7, Pixel 0.3-3.5, Pixel living 17.8 = N1) | gate-probe1-iphone13.txt, -pixel7.txt |
| 3c | Dive's final frame vs the tour's arrival frame (hold the hand-off 4 s to capture the real dive frame) | PASS desktop living->kitchen/bedroomMain/bathMain 0.0-0.1; iPhone living->kitchen 9.0, ->bathMain 3.7; Pixel bedroomMain->living 17.8, ->bedroom2 8.5 (N1) | gate-probe2-*.txt |
| 3d | Rapid sequences (desktop; S1,S2,S4 also iPhone): × during rise + reopen; open -> view in 360 mid-rise; double-click go; two different rooms in 300 ms; Esc during the rise + reopen 0.5 s later; 6x open/close spam | PASS: never stuck, never inert (inert 0 after every close), layer visible after reopen (opacity ''), no page errors, tour usable. Exception: Esc/× during the DIVE = D1 | gate-probe3-desktop.txt, gate-probe3-iphone13.txt |
| 3e | Reduced motion | PASS: rise skipped ('reduced-motion'), 3D preset, layer visible; dive skipped, tour still switches to the kitchen and the layer closes | gate-probe4.txt |
| 3f | Slow device, real fps measure (no override) | PASS: move skipped as 'slow-device' at 1.7 fps, 3D preset, layer revealed | gate-probe4.txt |
| 3g | Memory: 10 open/close cycles, then 5 dive cycles | PASS: scene children 5, geometries 78, textures 4, programs 14 equal at cycle 10 to after the first rise; after the dives +1 child/+1 geometry/+1 texture (the held room mesh, dropped by the next rise); JS heap 20-25 MB flat | gate-probe4.txt |
| 3h | Apartment page 3D tab (run `serve.mjs` :8851, desktop + iPhone 13) | PASS: no transition state, `__dollhouseSpecFor` null, "view in 360" posts `enter-room` with `dove:false` at once, no rise/scenes messages, 0 errors | gate-probe5.txt |
| 4 | Line endings of the five shipping files vs live | PASS all CRLF in both (apartment-3d.js 990/990 vs 846/846, build_zip.mjs 885/885 vs 855/855, tour.js, template.html, tour.css) | shell counts of `\r$` = line count |
| 4b | `wt.py status` | five shipping sources: no drift; three live output rows DRIFT (N4) | wt.py output |

## Not covered
Real GPU and real touch devices (SwiftShader runs 2-9 fps; the "bad" fps path was only checked by the real measure at 1.7 fps and by an override elsewhere); iOS Safari; the deployed site; `test/transition.test.mjs` and other platform tests that read `360walkaround/` data (cannot run inside the run copy: depth.png missing there; not in the requested list). `tour360/tools/live-check.mjs` not run (paid).
