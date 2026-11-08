# QA on the live files - board hold-building-tour, card 06
VERDICT: PASS

## 1. Live = approved = manifest, no drift
- `wt.py status hold-building-tour`: "nothing open (closed 2026-11-04T10:51:29)".
- My sha256 (live = approved copy = manifest sha256_at_close): index.html 9296830202ac...da530be, app.js dfbe759f2c3b...7b7f9. Both equal in all three places.

## 2. Stage diff vs prod-6
- cmpstage: files 2147 vs 2147; differs only `hold/app.js` and `hold/index.html` (dot-files skipped by the tool). Nothing else.
- Staged hold files == live files after applying the stage_flow.py rewrite rules (byte-exact compare, own script): index.html True (14830), app.js True (46222).

## 3. The Check (http://127.0.0.1:8853, 4 devices)
- `80/80 PASS - 0 FAIL`, exit 0, first run (no tablet rerun needed; C3 tablet PASS). Output: `logs/qa-live-check.txt`, shots `logs/qa-live-shots/`.

## 4. Own probe (`logs/gate-probes/qalive-probe.cjs`, `qalive-probe.txt`)
- Overlay open, X at 200 ms: frame removed, button back, #amb not paused, volume 0.6, __sound {on:true}: PASS.
- Pill 846 -> continue: #tourFrame src has scope=apartment (room=terraceLiving): PASS. Zero page errors.

## Defects
none

## Observations
- Desktop only for the own probe; four devices covered by the Check. Software GL, no real GPU / touch / deployed site tested (out of scope).
