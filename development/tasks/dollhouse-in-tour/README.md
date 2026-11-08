# Board — dollhouse-in-tour
<!-- created: 2026-11-03 · plan: development/plans/2026-11-03-dollhouse-in-tour.md · coordinator: main session rnd-fd · owner: Eliran Shopen -->

**Goal:** the 3D dollhouse inside the 360 tour (option 1), closed and in the repo by the morning; then a spike of option 3. No deploy.
**State:** `CLOSED` 2026-11-03 23:25 (was EXECUTING since 20:20 (Eliran: "הכל מאושר לך על זה", scope "הדולהאוס בתוך הסיור + סגירה", no deploy, $0).

## Key state
- 20:20 board filed; working folder `C:\RnD\.wt\dollhouse-in-tour` (one per task, root §8.7).
- 20:25 card 01: `.wt/dollhouse-in-tour` open (12 paths: tour viewer + build-tour + apartment-3d.js + build_zip.mjs + the live tour/platform outputs). The first open stopped on apartment-3d.js (held by rnd-23); the manifest was completed by hand + `wt.py add`, rnd-23 released the file.
- 20:30–21:10 cards 02–04: dollhouse `setHere` marker + `habait:you-are-here`; tour 3D button + layer + messages; build-tour carries `3d/dollhouse.html` (+ `--out/--apartments/--dollhouse`). Acceptance `logs/check-dit.cjs` **39/39** (desktop, iPhone 13, Pixel 7); platform regression (checks 03 40/40, 04 47/47, 05 22/22, 08 8/8, labels 11/11, smoke/minimap/apartment green) against the test build; the tour's own gate `paint-proof` **6/6** on the test build (`logs/paint-proof.txt`).
- 21:45 card 05 gate: FAIL (D1 medium: Esc inside the 3D frame did not close the layer, no focus trap; D2 low: build_zip.mjs working copy CRLF vs live LF) → `logs/gate-report.md`. Line endings checked against the frozen archive: live is consistent with the originals; only this working copy had been converted (a Python text-mode write).
- 21:50–22:05 fixes: the dollhouse posts `habait:escape` on Esc with nothing selected, the tour closes on it; the layer's siblings in `main#t-root` go inert while open (first attempt set inert on body's children = the layer's own ancestor, which would have frozen the 3D for real taps; caught by a probe, fixed; the acceptance check now proves a REAL tap reaches the frame); build_zip LF again. check-dit **48/48**, the reviewer's D1 repro passes, checks 03/04 + apartment.test green, paint-proof 6/6.
- 22:40 re-gate: **PASS, 0 defects** (75 real-input checks: mouse, touch, keyboard; all suites green) → `logs/regate-report.md`.
- 23:01 card 06 CLOSED: 12 files copied back by `scripts/wt.py close` (hash-checked, live == work tree): the 6 sources + the outputs built from them (platform 846 dist: 846.zip, apartment.json, media/dollhouse.html; tour dist/apt846: index.html + the new 3d/dollhouse.html) — the test build's outputs were proven identical to a live build (same inputs, rnd-23 not landed yet; `logs/diff-outputs.py`: after the close both live dists equal the tested build). **The acceptance check on the LIVE tour dist: 48/48** (`logs/check-dit.LIVE.txt`). Context files refreshed (3 held by rnd-23 left to it). Not deployed.
- 23:20 card 07 spike DONE (nothing shipped): the tour panorama on its depth mesh, rising into the dollhouse — t=0 matches the tour's frame; v1 smeared mid-move, **v2 clean** (fade 3–28 %, climb 85 %) on desktop + iPhone 13 → `logs/spike-07/REPORT.md` (+ frames, contact sheets). Productizing = a next board, Eliran's call.
- **State: CLOSED** 2026-11-03 23:25 (option 1 in the repo, not deployed; option 3 proven as a spike).

## Cards (sequential, main session; the gate is a fresh reviewer)
| # | Card | State |
|---|---|---|
| 01 | open the working folder (tour viewer + tour build + dollhouse viewer/template + the live outputs to rebuild) | DONE 20:25 |
| 02 | dollhouse: `setHere` marker + `habait:you-are-here` | DONE |
| 03 | tour: 3D button + overlay + messages; build-tour: carry `3d/dollhouse.html`, `--out`/`--apartments` | DONE |
| 04 | acceptance script (desktop, iPhone 13, Pixel 7, over HTTP) + the existing checks | DONE 21:10 — 39/39, regression green, paint-proof 6/6 |
| 05 | gate: fresh Sonnet reviewer, refute | DONE — gate FAIL (D1, D2) → fixed → **re-gate PASS** |
| 06 | close: hash check, copy back, rebuild the live tour dist (`build-tour.mjs apt846`), memory | DONE 23:01 — live 48/48 |
| 07 | option-3 spike: the rise-out-of-the-pano transition (prototype + frames + report, nothing shipped) | DONE 23:20 — v2 clean, REPORT.md |

## Rails
Root CLAUDE.md §0, §2, §8.7, §12: bounded memory reads, memory written at the end; no git; every run under `timeout`, one heavy run at a
time, port 8851 only, servers killed by PID; never open a `.env`; no paid call; no deploy (root §9).
