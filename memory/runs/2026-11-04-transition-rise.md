## 2026-11-04 · main session (rnd-fd) · board transition-rise — option 3 in the product: rise out of the 360, dive back into a room
- **Did:** in the 360 tour (apt846) the 3D button now lifts the picture the buyer looks at: the room's panorama on its depth mesh, fading 3–28 % while the camera climbs (85 %) to the dollhouse preset. "צפו ב-360°" dives the camera down into that room's opening view and the tour switches under it on the same frame. Reduced motion or < 15 fps gets the plain switch. Viewer API: `rise`, `dive`, `transitionPreview` in `platform/js/apartment-3d.js`. Messages in the `build_zip.mjs` template: `habait:scenes`, `rise`, `rise-ready`, `rise-done`, `3d-hide`, and `enter-room {dove}`. Tour (`tour360/viewer/tour.js`, `template.html`, `tour.css`): the dollhouse preloads `#defer` 2.5 s after load and is revealed on the first frame; the frame is full-screen with a floating ×. Copied back 08:1x and outputs rebuilt from live. **NOT deployed.** $0.
- **Evidence:**
  - Board: `development/tasks/transition-rise/README.md`.
  - Gate: `logs/gate-report.md` (FAIL D1) → `logs/regate-report.md` (PASS).
  - Acceptance and fix checks: `logs/check-rise.cjs` (36/0, test build) and `logs/live-check-rise.txt` (36/0 on the LIVE tour dist); `logs/fix-probe3-*.txt`, `fix-probe-n2.txt`.
  - Regression: `logs/fix-reg-check-{dit,04,03,05,08}.out`, all PASS.
  - Close: `logs/close-place.py`; `.wt/transition-rise/manifest.json` (closed, 11 files, 3 rows re-snapshotted with reason).
- **Learned:**
  - (1) A layer that a buyer can close mid-move needs a cancel path both ways. The tour posts `habait:3d-hide` and ignores `enter-room` while closed. The page drops a dive whose generation changed. Otherwise an async hand-off fires after the buyer has left (gate D1).
  - (2) The band-centred dollhouse view offset makes the rise's first frame ~1° low unless the offset grows with the move.
  - (3) A test tree goes stale when a peer fixes live mid-board. check-04 "failing" was the run tree's old `apartment.css`, not live. Diff the run tree against live (`diff -rq`, excluding `_local`, `dist` and `node_modules`) before blaming live.
  - (4) A peer's rebuild of shared outputs shows as DRIFT in `wt.py status`. Re-snapshot those rows with a recorded reason, only when our rebuild is from live and carries their change.
- **Owed / open:**
  - Deploy is Eliran's own go. rnd-23's platform-ui-ux prod snapshot (staged ~07:2x) does NOT include transition-rise.
  - Not covered: real GPU and touch, iOS Safari, the deployed site.
  - N1: phones sit ~2 px sideways at t0 (under the threshold).
  - N3: wardrobe has no depth map, so it gets no move.
  - Two rooms tapped within ~150 ms end in the first (pre-existing).
  - `.wt/transition-rise` removal is Eliran's act.
- **Second reader:** rnd-23 (platform-ui-ux, by message); `habait-deploy-qa` at the next deploy (pointer in `memory/agents/platform-dev.md`).

## 2026-11-04 · main session (rnd-fd) · SHIP — transition-rise + landing fallback + cine clips to habait-flow production
- **Did:** on Eliran's own go (he sent the four deploy commands in chat, after "כן" to shipping transition-rise), staged `scratchpad/deploy-prod-4` from live with `Projects/Habait/tools/deploy-vercel/stage_flow.py` (rnd-23's step 1c: cine clips 352 files / 56.3 MB; 366.9 MB total), linked to project habait-flow (scope eliran-5390), deleted the `.env.local` the link wrote without reading it, deployed `--prod`: dpl_HprzbAudnPdUCLididJWbhB9Cm8X, aliased https://habait-flow.vercel.app. One deploy carries transition-rise + rnd-23's landing.js arm-B fallback + the cine clips (it replaces dpl_9RL6FWDq…, platform-ui-ux).
- **Evidence:** `development/tasks/transition-rise/logs/staged4-site-check.txt` (14/14 local), `staged4-check-rise.txt` (36/0), `prod-site-check.txt` (14/14 on the prod alias), `prod-check-rise.txt` (36/0 against `/tour/` on prod, `check-rise-prod.cjs`); stage diff vs the previous deploy = 7 files + 352 cine files (`scratchpad/cmpstage.py`).
- **Learned:** stage from live only after every board touching the site has closed, and diff the new stage against the last deployed stage by hash. A shell wrapper (`cd X && python -m http.server &`) makes `$!` the subshell; start the server with `--directory` and kill it by its own PID, then check netstat. A deny rule blocks any command text naming an env file, so exclude dot-files by pattern instead.
- **Owed / open:** rnd-23's card 22 (deployed-site QA) re-runs on this deploy. Real iOS Safari and touch remain untested. FAL/MYARCHITECTAI rotation (OWED-013) is still Eliran's.
- **Second reader:** rnd-23 (by message).

## 2026-11-04 · main session (rnd-fd) · correction to the SHIP entry above
- **Did:** that entry's Owed line says the FAL/MYARCHITECTAI rotation (OWED-013) "is still Eliran's". That is wrong: Eliran ruled 2026-11-04 to keep the existing keys with no rotation (OWED-013 closed; `memory/project/2026-11-04-keys-kept.md`). He repeated it to rnd-fd: "לא צריך להחליף מפתחות … תשתמש במה שיש".
- **Second reader:** none.
