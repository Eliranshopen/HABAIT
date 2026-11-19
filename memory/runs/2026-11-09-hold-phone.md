## 2026-11-09 · sub-agent (coordinator's delegation) · the hold's stop on a phone
- **Did:** Eliran: the phone stop after the fly-around «לא נראה טוב, צריך לתקן». Portrait phones only; desktop and landscape unchanged.
  - **Framing:** `holdarc.js` frames the hold frame from its own `tower_ndc_box` (camera.json, frame 91): the tower across the width left of a 72 px right-edge column, never a floor under 33 px on screen. When the floor rule wins, only the tower's left flank (no pills) runs off-screen: 20 % at 375, 17 % at 390, 6 % at 430.
  - **Air:** blurred and darkened above and below, with feathered edges. The framing eases in from the film's cover framing (`settle`) and lifts above an open card (`lift`). One `geom()` drives drawing and pill/glow projection.
  - **Pills:** 19 px with 44 px hit areas, on their floors. The chosen floor glows for any unit.
  - **Chrome:** the drag hint is a short toast in the lower air (leaves on first touch or after 5 s). The right column (Eliran's round 6) is one glass look on the sky. The legal line is one line with «פרטים», 44 px tall.
  - **Card:** a compact glass sheet with ONE button, «כניסה לדירה» for 846 → the journey. It is the same `#unitContinue`, so the iOS audio unlock is unchanged; the label comes from the opt-in `continueLabel` in `picker.js`. «לסיור 360°» and «עמוד הדירה» are small links.
  - $0. Branch `hold-phone` (`41301bd`, `36246fe`), merged into main as **`f725d26`, `10d4af4`**. **NOT deployed.**
- **Evidence:** `Projects/Habait/habait-walkaround/qa-evidence/platform/hold-phone-2026-11-09/`. On a fresh stage of main `10d4af4`:
  - `predeploy-stage-hp2.json`: PASS 34/34. The first stage failed on the one-line legal control at 41 px; fixed to 44 px in `36246fe`.
  - `hold-phone.json`: new `test/hold-phone.check.mjs`, PASS at 375/390/430/1440.
  - `hold-chrome.json`: PASS at 360/390/430/390-landscape/1440.
  - `rainbow-flow.json`: PASS.
  - `before-after-*.jpg`: the before/after sheet (jpgs on disk only).

  Plan: `development/plans/2026-11-09-hold-phone.md`.
- **Learned:**
  - At the hold one floor (3.2 m) is 6.36 % of the frame height. Below 33 px on screen, 19 px pills one floor apart fail the gate's 44 px hit-area rule.
  - A jog of alternate floors can't fix it with the bays ~74 px apart.
  - A one-line clickable legal line drops to 41 px, which predeploy flags.
  - `kill $!` in Git Bash leaves `python -m http.server` running: kill by the listening port (`netstat -ano` → `taskkill //F //PID`).
  - A stopped check leaves playwright Chrome holding the stage files (WinError 32): kill `chrome.exe` with `remote-debugging-pipe` + `playwright` in its command line.
- **Owed / open:**
  - a real-iPhone look (`ctx.filter` blur needs Safari 18; older Safari shows the darkened air without blur);
  - a deploy is Eliran's go (one deploy at a time; read the SHIP-LEDGER first);
  - worktree `.wt/hold-phone` removal is Eliran's act;
  - `/sync-context` for the generated context tables.
- **Second reader:** `habait-deploy-qa`. A deploy of this main changes /hold/ on portrait phones (framing, pills, card label «כניסה לדירה»). `test/hold-phone.check.mjs` is the new phone gate for the hold; run it with hold-chrome and rainbow-flow.
