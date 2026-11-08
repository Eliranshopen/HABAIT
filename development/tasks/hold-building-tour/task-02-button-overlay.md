# Card 02 — The button, the overlay and the way back
<!-- board hold-building-tour · plan development/plans/2026-11-04-hold-building-tour.md -->

- **Agent:** main session (platform-dev role)
- **Model:** opus
- **Ruling tier:** T0
- **Depends on:** 01
- **State:** DONE
- **Memory:** standing (main session → `memory/runs/` at close; reviewers → `memory/agents/qa-reviewer.md`, `habait-deploy-qa` → its own file)

## Work
In the working copies only:
- **Button** `#buildingBtn` "הדמיית הבניין והסביבה" (Eliran's words) in the hold's button group, shown once the hold is reached (after the orbit clip / skip), hidden during the descent clip and while inside. House look (same class as the hold's buttons), ≥ 44 px, `aria-label`, keyboard reachable.
- **Overlay** `#buildingFrame`: iframe of the tour in PROJECT scope — `buildingUrl()` from `?tour=` (path only, scope/from/room/floor/video stripped) or the local default `http://127.0.0.1:8848/`, plus `from=hold&ui=min`, no `return` and no `scope=apartment`, so the exterior chain and then the rooms are in it. Relative on Vercel (`/tour/`). Fade in like `#tourFrame`; the hold's render loop and ambience pause while it is open (one WebGL at a time on phones).
- **✕ close** `#buildingClose` owned by the hold page, above the frame (top inline-end corner, safe-area aware), plus Esc on the page; removes the frame, resumes the render loop and the ambience if it was playing, returns focus to `#buildingBtn`. The iframe's own "חזרה לבניין" stays inside the tour (goes to the tour's hold node) — no `return` param, so it never navigates the page.
- Decisions taken here are logged in `logs/decisions.md` (T0).

## Acceptance
- tap → frame opens on the tour's `aerial` scene, the auto-orbit advances
- ✕ and Esc return to a live hold (render loop running, pills visible, ambience as before)
- re-open works (no leaked frame, no double listeners)
- the existing `#toApt` / pill → descent → apartment chain is unchanged

## Files
`.wt/hold-building-tour/files/Projects/Habait/research/fal-bench-2026-11-02/flyover3d/index.html`, `.../app.js`

## Standing rails (inherited verbatim from the board README)
1. **Bounded read-first:** `memory/HOT.md`, then the LAST ~150 lines of your own `memory/agents/<name>.md` (plus its archive-index block), then `memory/listings/<id>.md` only if the task names a listing. ⛔ Never read `memory/INDEX.md` whole — grep it.
2. **Write last, once:** ONE entry (`memory/_TEMPLATE.md`) into the layer that owns the fact, plus ONE ≤400-char pointer line under that layer's existing `memory/INDEX.md` header. ⛔ Never add a header.
3. **Second reader:** at write time, name which OTHER actor must know this; append ONE pointer line into each named actor's `memory/agents/<name>.md` — `→ see <entry> — why it binds you`. No affected actor = say "none".
4. **An action is not done until its memory is written.**
5. **Ruling tier** — every brief carries its own `T0` / `T1` / `T2` (below).
6. Root `CLAUDE.md` §2, §8.7, §12: no git; work only in `C:\RnD\.wt\hold-building-tour\files\`; `timeout` on every run, one heavy run at a time, foreground; local test port **8853** only; never open a `.env`; **no paid call ($0)**; **no deploy** (Eliran's own go, §9); `PYTHONIOENCODING=utf-8`.
7. ⛔ Do not edit `habait-walkaround/Habait/tour360/viewer/tour.js` or `dist/apt846/index.html`: they are in another session's open working folder `.wt/tour-exterior-floors`. A gap in the tour is reported to the main session, never patched here.

Full contract: `memory/README.md` and root `CLAUDE.md` §0.
