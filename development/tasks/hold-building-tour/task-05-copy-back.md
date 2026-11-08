# Card 05 — Copy back on Eliran's word
<!-- board hold-building-tour · plan development/plans/2026-11-04-hold-building-tour.md -->

- **Agent:** main session
- **Model:** opus
- **Ruling tier:** T1
- **Depends on:** 04 PASS
- **State:** DONE — copied back 10:5x (Eliran: "כן תעלה לאוויר")
- **Memory:** standing (main session → `memory/runs/` at close; reviewers → `memory/agents/qa-reviewer.md`, `habait-deploy-qa` → its own file)

## Work
Show Eliran the result (screens desktop + phone from the test build). **One question: copy back to the live files?** Default if he says nothing: wait. On his word: `python scripts/wt.py close hold-building-tour --go` (refuses on drift). Then context files (`generate-cards.py --check` 0 missing). No deploy.

## Acceptance
- live sha256 of both files = working copies
- manifest records the close

## Files
live `Projects/Habait/research/fal-bench-2026-11-02/flyover3d/index.html`, `app.js`; `.wt/hold-building-tour/manifest.json`

## Standing rails (inherited verbatim from the board README)
1. **Bounded read-first:** `memory/HOT.md`, then the LAST ~150 lines of your own `memory/agents/<name>.md` (plus its archive-index block), then `memory/listings/<id>.md` only if the task names a listing. ⛔ Never read `memory/INDEX.md` whole — grep it.
2. **Write last, once:** ONE entry (`memory/_TEMPLATE.md`) into the layer that owns the fact, plus ONE ≤400-char pointer line under that layer's existing `memory/INDEX.md` header. ⛔ Never add a header.
3. **Second reader:** at write time, name which OTHER actor must know this; append ONE pointer line into each named actor's `memory/agents/<name>.md` — `→ see <entry> — why it binds you`. No affected actor = say "none".
4. **An action is not done until its memory is written.**
5. **Ruling tier** — every brief carries its own `T0` / `T1` / `T2` (below).
6. Root `CLAUDE.md` §2, §8.7, §12: no git; work only in `C:\RnD\.wt\hold-building-tour\files\`; `timeout` on every run, one heavy run at a time, foreground; local test port **8853** only; never open a `.env`; **no paid call ($0)**; **no deploy** (Eliran's own go, §9); `PYTHONIOENCODING=utf-8`.
7. ⛔ Do not edit `habait-walkaround/Habait/tour360/viewer/tour.js` or `dist/apt846/index.html`: they are in another session's open working folder `.wt/tour-exterior-floors`. A gap in the tour is reported to the main session, never patched here.

Full contract: `memory/README.md` and root `CLAUDE.md` §0.
