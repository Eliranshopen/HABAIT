# Board — transition-rise
<!-- created: 2026-11-04 · plan: development/plans/2026-11-04-transition-rise.md · coordinator: main session rnd-fd · owner: Eliran Shopen -->

**Goal:** option 3 in the product: the 3D button rises out of the tour's 360 view into the dollhouse; "צפו ב-360°" dives back into
the room. No deploy. **State:** `CLOSED` 2026-11-04 ~08:20 (Eliran: "להפוך את אפשרות 3 למוצר"); in the repo, NOT deployed (deploy = Eliran's own go).

## Key state
- 00:20 working folder `.wt/transition-rise` (apartment-3d.js, build_zip.mjs, tour.js, + template.html/tour.css added, + the live outputs). The test build `run/` = the LIVE platform as of rnd-23's 23:15 copy-back + my files (baseline rebuild = live dist except the build date).
- Built: the viewer drives the move itself (`rise`/`dive`, depth mesh via dynamic import, fade 3–28 %, climb 85 %, fps guard, reduced motion); the dollhouse page carries depthmesh.js and the messages (`habait:scenes`, `habait:rise`, `habait:rise-ready/done`, dive before `habait:enter-room`); the tour preloads the dollhouse (#defer), reveals the layer on the move's first frame, closes it on the new panorama after a dive; the 3D frame is now full-screen with a floating × (the frame must equal the tour's).
- Found + fixed on the way: the first frame sat ~1° low = the dollhouse's band view offset → it now grows with the move (t0 |diff| desktop 0.1, iPhone 1.2); a rise still loading + a quick "view in 360" raced (the tour never moved) → a sequence guard + a 5 s hand-off timeout.
- Checks on the test build: `logs/check-rise.cjs` **36/36** (rise motion, t0 = the tour's frame, dive + switch, kitchen frame, race, reduced motion; desktop/iPhone 13/Pixel 7); `reg-check-dit` 48/48 (one wait updated: the layer now closes after the new panorama loads, by design); platform checks 03 40/40, 05 22/22, 08 8/8, labels 11/11, smoke/minimap/apartment green; paint-proof 6/6. **check-04 fails on iPhone — pre-existing on live since rnd-23's redesign (the same build without my files fails identically, `logs/reg-check-04.baseline.out`); reported to rnd-23.**
- Gate (fresh Sonnet, `logs/gate-report.md`): **FAIL D1** — Esc/× during the dive still moved the tour to the room the buyer backed out of; N1 phones ~2 px sideways (under threshold), N2 same-room dive closed on the old yaw, N3 wardrobe has no depth map (falls back), N4 rnd-23 rebuilt three 846 outputs on live. It also showed check-04 failed because of the run tree's stale apartment.css, not a pre-existing live defect (rnd-23 fixed live 07:14 anyway).
- Fixed: the tour posts `habait:3d-hide` on close and ignores `enter-room` while closed; the dollhouse drops a dive whose `hideGen` changed; a same-room dive leaves the tour on the room's opening view (N2). Test build rebuilt (`logs/rebuild-run.sh`, + live apartment.css): probe3 22/22 desktop + iPhone, `fix-probe-n2.txt` ok, check-rise 36/0, reg dit 48/0, 04 47/0, 03 40/0, 05 22/0, 08 8/0.
- Re-gate (fresh Sonnet, `logs/regate-report.md`): **PASS**, 0 defects (pixel7 probe3 22/22, own race probes R1–R7). Observation, pre-existing: two different rooms within ~150 ms end in the first.
- Close: outputs placed from `run/` (= live sources + shipping files, `diff -rq`), the three 846 rows re-snapshotted (rnd-23's 07:14 rebuild, `logs/close-place.py`, recorded in the manifest), `wt.py close --go` 11 files; live = working folder byte-exact, CRLF kept; check-rise on the LIVE tour dist 36/0 (`logs/live-check-rise.txt`). Context files refreshed (0 missing / 0 stale).

## Cards
| # | Card | State |
|---|---|---|
| 01 | open the working folder + a test build on the live baseline | DONE 00:30 |
| 02 | viewer: rise / dive driven by the viewer, fps + reduced-motion guards | DONE |
| 03 | dollhouse page + tour: messages, preload, reveal on the first frame, dive hand-off; full-screen frame | DONE |
| 04 | acceptance `check-rise.cjs` + regression | DONE — 36/36, regression green (check-04: pre-existing, reported) |
| 05 | gate: fresh reviewer, refute | DONE — FAIL D1 → fixed → re-gate PASS |
| 06 | close: hash check, copy back, outputs from live, memory | DONE ~08:20 — live QA check-rise 36/0 |

## Rails
Root CLAUDE.md §0, §2, §8.7, §12; no git; `timeout` on every run, one heavy run at a time, port 8851 only; never open a `.env`; no paid call; no deploy.
