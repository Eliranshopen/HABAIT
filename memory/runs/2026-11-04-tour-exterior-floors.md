## 2026-11-04 · main session (rnd-fd) · board tour-exterior-floors — no floor-finish buttons on the tour's building and surroundings scenes
- **Did:** Eliran saw בטון / פרקט / שיש on https://habait-flow.vercel.app/tour/ (the building-and-surroundings view). That is now fixed in `tour360/viewer/tour.js` `renderVideoBar`: `#t-floor-seg` is hidden on an exterior scene, and so is the whole bar when that scene has no room clip. The apartment scenes keep the buttons. Working folder `.wt/tour-exterior-floors`: 2 files closed by hash check. The tour `dist/apt846/index.html` was rebuilt from live sources, differing from live only by the fix. **NOT deployed.**
- **Evidence:** `development/tasks/tour-exterior-floors/`:
  - `prod-before.txt`: production before the fix, FAIL 14.
  - `run-after.txt`, `run-hop.txt`, `run-check-rise.txt`: the test build, PASS, PASS and 36/0.
  - `qa-report.md`: fresh Sonnet on live, PASS with 0 defects (`qa-run-routes.txt` 88/0).
- **Learned:** the tour's exterior/apartment split is `s.exterior`. The plan and 3D buttons already followed it, but the floor strip lived in the video bar, which never asked. Any new per-apartment control must check `s.exterior` too.
- **Owed / open:**
  - Deploy is Eliran's own go: restage with `stage_flow.py` into a new folder, then link + deploy habait-flow; after that, card 05 (deployed-site QA).
  - QA note N1: the video player's own floor strip (`#t-video-floors`) would still show during an exterior clip or the building intro. This build has no such clips; whether to hide it there is Eliran's call if one ships.
- **Second reader:** none (rnd-23 is not on tour360).

## 2026-11-04 · main session (rnd-fd) · SHIP — tour-exterior-floors to habait-flow production
- **Did:** on Eliran's "כן", staged `scratchpad/deploy-prod-5` from live (`stage_flow.py`). By hash it differs from deploy-prod-4 only in `tour/index.html`. Staged checks: site_check 14/14, floor probe PASS. It is linked to habait-flow, and the `.env.local` the link wrote was deleted unread. The auto-mode classifier blocked my `vercel deploy --prod` (root §8.2), so Eliran ran it himself from the Claude Code CLI terminal with `! … --cwd <dir>`.
- **Evidence:** production `/tour/index.html` carries the fix (curl grep). `development/tasks/tour-exterior-floors/prod-after.txt`: PASS on desktop + iPhone 13. `prod-site-check.txt`: 14/14.
- **Learned:** in the VS Code extension chat, a message that starts with `!` is sent as text; it does not run. Eliran runs a shell command in the Claude Code CLI terminal with `! <cmd>`. `vercel deploy --cwd <dir>` avoids `cd … &&`, which does not work in PowerShell 5.1. A peer's HOT regeneration can drop another session's lines, so re-check HOT after a peer's sync.
- **Owed / open:** none for this board.
- **Second reader:** none.

## 2026-11-04 · main session (rnd-fd) · tour dist refresh for the developer-name ruling (rnd-23's ask, Eliran Q4)
- **Did:** rebuilt the tour `dist/apt846` from live (`rebuild-run-developer.sh`, working folder `.wt/tour-dollhouse-developer`, 2 files closed). Its `3d/dollhouse.html` now equals rnd-23's rebuilt platform 846 dollhouse byte for byte: the developer is named ("ישראל קנדה"), with no "השם מוסתר" left. `index.html` is unchanged. **Not deployed:** rnd-23 stages habait-flow and hands Eliran the deploy.
- **Evidence:** `development/tasks/tour-exterior-floors/developer-check-rise.txt` (36/0); cmp live tour dollhouse = platform dollhouse.
- **Learned:** the tour's `3d/dollhouse.html` is a copy of the platform build, so any platform 846 rebuild needs a tour rebuild before the next stage.
- **Second reader:** rnd-23 (by message).
