# Card 03 — Acceptance check + regression
<!-- board hold-building-tour · plan development/plans/2026-11-04-hold-building-tour.md -->

- **Agent:** main session (platform-dev role)
- **Model:** opus
- **Ruling tier:** T0
- **Depends on:** 02
- **State:** DONE — 80/80 (logs/check-all.txt)
- **Memory:** standing (main session → `memory/runs/` at close; reviewers → `memory/agents/qa-reviewer.md`, `habait-deploy-qa` → its own file)

## Work
Write `logs/check-building.cjs` (playwright-core via `HABAIT_APP_DIR`), desktop 1440×900 + iPhone 13 + Pixel 7, against :8853:
button visible after skip; frame src has no `scope=apartment`; tour scene = `aerial`, then advances; at the tour hold node a tap on the apartment descends into the rooms inside the frame; ✕ → frame gone, hold canvas repaints (pixel diff over 2 s), focus on the button; Esc same; open/close ×3; zero page errors, zero 4xx in both documents; Hebrew label renders RTL.
Regression: `qa/qa_chain.cjs` (compare to `logs/baseline-chain.txt`), `qa/qa_orbit_inline.cjs` mobile + skip.

## Acceptance
- `check-building` all PASS on the three devices, output in `logs/check-building.txt`
- qa_chain equal to baseline (0 errs, 0 bad, 9 pills)

## Files
`development/tasks/hold-building-tour/logs/check-building.cjs`, `logs/*.txt`

## Standing rails (inherited verbatim from the board README)
1. **Bounded read-first:** `memory/HOT.md`, then the LAST ~150 lines of your own `memory/agents/<name>.md` (plus its archive-index block), then `memory/listings/<id>.md` only if the task names a listing. ⛔ Never read `memory/INDEX.md` whole — grep it.
2. **Write last, once:** ONE entry (`memory/_TEMPLATE.md`) into the layer that owns the fact, plus ONE ≤400-char pointer line under that layer's existing `memory/INDEX.md` header. ⛔ Never add a header.
3. **Second reader:** at write time, name which OTHER actor must know this; append ONE pointer line into each named actor's `memory/agents/<name>.md` — `→ see <entry> — why it binds you`. No affected actor = say "none".
4. **An action is not done until its memory is written.**
5. **Ruling tier** — every brief carries its own `T0` / `T1` / `T2` (below).
6. Root `CLAUDE.md` §2, §8.7, §12: no git; work only in `C:\RnD\.wt\hold-building-tour\files\`; `timeout` on every run, one heavy run at a time, foreground; local test port **8853** only; never open a `.env`; **no paid call ($0)**; **no deploy** (Eliran's own go, §9); `PYTHONIOENCODING=utf-8`.
7. ⛔ Do not edit `habait-walkaround/Habait/tour360/viewer/tour.js` or `dist/apt846/index.html`: they are in another session's open working folder `.wt/tour-exterior-floors`. A gap in the tour is reported to the main session, never patched here.

Full contract: `memory/README.md` and root `CLAUDE.md` §0.
