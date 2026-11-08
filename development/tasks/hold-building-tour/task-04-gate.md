# Card 04 — Gate: fresh reviewer, refute
<!-- board hold-building-tour · plan development/plans/2026-11-04-hold-building-tour.md -->

- **Agent:** fresh Sonnet sub-agent with the `qa-reviewer` brief (project agent `Projects/Habait/.claude/agents/qa-reviewer.md`, live, harness-ops; not spawnable by name from a C:\RnD session, so its definition is pasted into a general-purpose spawn)
- **Model:** sonnet
- **Ruling tier:** T0
- **Depends on:** 03
- **State:** DONE — FAIL D1 → fixed → re-gate PASS
- **Memory:** standing (main session → `memory/runs/` at close; reviewers → `memory/agents/qa-reviewer.md`, `habait-deploy-qa` → its own file)

## Work
Never an author. Re-run the Check on a freshly rebuilt `hb-run`, then try to break it: rapid open/close, ✕ during the auto-orbit, Esc while focus is inside the iframe, open → walk into a room → ✕, mobile rotate, reduced motion, the button during the descent clip. Writes only `logs/gate-report.md`.

## Acceptance
- verdict PASS or FAIL with one row per defect; a FAIL reopens card 02 in the SAME working folder

## Files
`development/tasks/hold-building-tour/logs/gate-report.md`

## Gate
**Check:** `timeout 540 node development/tasks/hold-building-tour/logs/check-building.cjs http://127.0.0.1:8853` → all PASS, exit 0
**Reviewer scope:** the new button / overlay / close behaviour and that the existing hold → apartment chain did not regress — nothing else.

## Standing rails (inherited verbatim from the board README)
1. **Bounded read-first:** `memory/HOT.md`, then the LAST ~150 lines of your own `memory/agents/<name>.md` (plus its archive-index block), then `memory/listings/<id>.md` only if the task names a listing. ⛔ Never read `memory/INDEX.md` whole — grep it.
2. **Write last, once:** ONE entry (`memory/_TEMPLATE.md`) into the layer that owns the fact, plus ONE ≤400-char pointer line under that layer's existing `memory/INDEX.md` header. ⛔ Never add a header.
3. **Second reader:** at write time, name which OTHER actor must know this; append ONE pointer line into each named actor's `memory/agents/<name>.md` — `→ see <entry> — why it binds you`. No affected actor = say "none".
4. **An action is not done until its memory is written.**
5. **Ruling tier** — every brief carries its own `T0` / `T1` / `T2` (below).
6. Root `CLAUDE.md` §2, §8.7, §12: no git; work only in `C:\RnD\.wt\hold-building-tour\files\`; `timeout` on every run, one heavy run at a time, foreground; local test port **8853** only; never open a `.env`; **no paid call ($0)**; **no deploy** (Eliran's own go, §9); `PYTHONIOENCODING=utf-8`.
7. ⛔ Do not edit `habait-walkaround/Habait/tour360/viewer/tour.js` or `dist/apt846/index.html`: they are in another session's open working folder `.wt/tour-exterior-floors`. A gap in the tour is reported to the main session, never patched here.

Full contract: `memory/README.md` and root `CLAUDE.md` §0.
