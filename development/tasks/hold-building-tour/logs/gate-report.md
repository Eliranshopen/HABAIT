# Gate report — card 04, board hold-building-tour
<!-- fresh reviewer (qa-reviewer brief), 2026-11-04; staged copy rebuilt with rebuild-run.py before every run -->

VERDICT: FAIL

Check (card 04): `80/80 PASS · 0 FAIL · base http://127.0.0.1:8853` (exit 0; 4 devices, shots in `logs/gate-shots/`).
The Check passes; the FAIL comes from one defect found by my own probes.

## Defects
| id | severity | steps | expected | actual | evidence |
|---|---|---|---|---|---|
| D1 | low-medium | Hold with sound on (default after the click-through). Press "הדמיית הבניין והסביבה", press ✕ within the 600 ms ambience fade (a buyer who opens by mistake: `click(); setTimeout(close, 200)`; also open+close in the same tick, or 50 ms apart) | Sound comes back as it was ("as they were on close", decision 3) | `closeBuilding()` sets volume 0.6 and calls `amb.play()`, but the `fadeAmbience(600)` rAF loop started by `openBuilding()` is still running: it drives the volume down again and calls `amb.pause()` at the end. Result: ambience paused, volume 0, while `__sound.on === true` and the icon shows 🔊. The hold stays silent with a lying icon until the buyer taps the speaker twice. Not seen at 150 ms in P3c (the click lag exceeded the fade), so the window is real but narrow (< ~600 ms after open). Fix idea: cancel the fade (token checked in the loop) before restoring, or start the fade only after the frame's `load`. | `gate-probes/probe2.txt` Q1 (FAIL), `probe1.txt` P2/P2b/P2c state lines (`ambPaused:true, vol:0, sound.on:true`) |

## What held (refute attempts that failed)
- P1 double-click: one frame; close: loop rate normal (no second loop). P2/P2b/P2c close before load, 50 ms, and from inside the `load` event: no frame left, button back, loop alive, no double loop (rAF rate 32-36/s vs 32 before).
- Q2 ✕ during the auto-orbit (orbit1): hold live, picker 846 card opens. Q3 open -> tower -> tap 846 -> room (terraceLiving) -> ✕ -> 846 -> continue -> #tourFrame scope=apartment: works; button hidden in the apartment tour, Esc opens nothing.
- Q4 Esc with focus inside the frame: overlay stays; Esc on the page closes. Q5 button hidden during the orbit clip; programmatic click during the clip and during the descent ease does nothing (`building.leaving`). Q6 reduced motion: opens opaque, closes, 0 errors. Q7 iPhone 13 portrait + landscape, Pixel 7 landscape: button 180x44 on top, in view; ✕ reachable by tap, nothing covered in the landscape screenshot (`gate-shots/q7_iphone13L_open.png`).
- Sound without the race (P3a/b/d): paused while open, back at 0.6 after close; user-muted stays muted. Diff review: CRLF consistent (all added lines CRLF in both files; index.html 140/140, app.js 547/547), no listener leak (listeners are registered once; the frame's `load` is `{once:true}` on a removed node), 0 page errors in every run.

## Observations (pre-existing / out of scope)
- O1 `fadeAmbience` itself never cancels a previous fade (same race exists between the 846 hand-off fade and a retried play); only the new caller exposes it.
- O2 Restore volume is the hard-coded 0.6, equal to `startSound()`; fine today.
- O3 The `qa_chain.cjs` staleness is in decisions.md #8 (known).
- Not tested: real GPU, real iOS Safari iframe focus, the deployed site (card 05).

Probes: `gate-probes/lib.cjs`, `probe1.cjs`, `probe2.cjs`, outputs `probe1.txt`, `probe2.txt`.
