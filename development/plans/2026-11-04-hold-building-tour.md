# Plan — "הדמיית הבניין והסביבה" button on the hold (one URL)
<!-- 2026-11-04 · main session · status: DRAFT, waiting for Eliran's approval -->

## Ask (Eliran, 2026-11-04)
> "מה שיש פה habait-flow.vercel.app/tour/ יכול להשתלב כחלק מתצפית על הבניין כולו. אפשר לאחד את שניהם לURL אחד אבל אחרי הסרטון פה בעמוד של העצירה מול הבניין לבחירת דירה … שיהיה כפתור של הדמיה של הבניין והאזור ואז יהיה התוכן מפה habait-flow.vercel.app/tour/"

Rulings (AskUserQuestion, same chat):
1. **End of the outside tour → continue into the apartment** (the tour's existing chain: tap the apartment → descent → terrace → rooms), plus a ✕ that returns to the hold.
2. **`/tour/` stays as it is** (direct links and tests keep working; no button on the site leads to it).

## Facts on disk (verified 2026-11-04)
- The hold = `Projects/Habait/research/fal-bench-2026-11-02/flyover3d/` (`index.html`, `app.js`), served at `/hold/`. Buttons today: `#reset` "חזרה למעוף", `#toApt` "טוס לדירה 846", `#enterBtn`, apartment picker pills.
- The hold already opens the tour **in an iframe over itself** (`app.js` `flyToApartment`, `#tourFrame`, `tourUrl()` forces `scope=apartment&from=flight&ui=min`) — the URL stays `/hold/`. Same pattern is reused.
- The tour (`habait-walkaround/Habait/tour360/viewer/tour.js`): without `scope=apartment` it is the **project scope** — exterior nodes `aerial → orbit1…5 → tower (hold) → approach45 → approach25 → facade → terraceOut`, then the rooms. `from=hold` gives the quiet chrome (`ui-min`, `ui-enter`). In a room, "חזרה לבניין" goes to the tour's own hold node (not the page) when there is no `return`.

## Steps
1. **Button on the hold** (`index.html` + `app.js`): "הדמיית הבניין והסביבה" next to the hold's buttons, visible once the hold is reached (after the clip). House tokens, Hebrew first, ≥ 44 px, keyboard + screen-reader label.
2. **Overlay**: on tap, the hold fades its ambience and opens `#buildingFrame` = `/tour/?from=hold&ui=min` (project scope, starts at `aerial`, relative URL so it works locally and on Vercel; local default `http://127.0.0.1:8848/`). Hold rendering pauses while the overlay is open (one heavy WebGL at a time on phones).
3. **Close ✕** owned by the hold page (above the iframe, top corner, Esc too): removes the frame, resumes the hold and its ambience. Focus returns to the button.
4. **Into the apartment** = the tour's own chain inside the frame (no change to `tour.js` unless the check shows a gap; any fix found goes into this task's working folder).
5. **Stage + local check**: `stage_flow.py <new folder>` → `qa/qa_chain.cjs` + a new check `check-building.cjs` (button visible at the hold, frame opens on `aerial`, auto-orbit advances, tap → apartment rooms reached, ✕ returns to a live hold, Esc, 390 px + desktop, zero page errors / 4xx).

## Execution rails
- Project change → working folder `C:\RnD\.wt\hold-building-tour` (`scripts/wt.py open … --go`), one folder for every fix in this task; copy back on Eliran's word.
- Before opening: `Projects/Habait/SESSIONS.md` — the flyover3d / tour360 paths are not edited while another session holds them.
- $0: no paid calls.
- Board ends with QA (root §8.9): live-result QA after copy-back; deployed-site QA (`habait-deploy-qa`, all aliases of habait-flow) **BLOCKED until Eliran's own deploy go**.

## Out of scope
New exterior renders; changing `/tour/` itself; habait.ai / app.habait.ai (other projects).
