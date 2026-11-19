# Card 06 — milestone 1.3 · The trace gate
<!-- board: 3dengine · plan: development/plans/2026-11-16-pdf-to-360-engine-mcp.md §7.1 row 1.3 · created: 2026-11-16 · owner: Eliran Shopen -->

**Agent:** engine-builder · **Model:** opus · **Ruling tier:** T0
**Runs as:** the main session, in the `engine-builder` role (the project agents do not load in a session started at `C:\RnD`; definition: `Projects/Habait/.claude/agents/engine-builder.md` in the working folder).
**Stage:** 1 · פענוח ה-PDF · **Kind:** לכתוב (new code) · **Closes in build phase:** E3 · **Cost:** $0
**Depends on:** card 05 (milestone 1.2) is closed.
**State:** `DONE` — closed 2026-11-18 on `ef2d2dc`: the closing tests 10 of 10 on real jobs (a reading changed by hand ends in `review` with `TRACE_GATE_FAIL` and the build never starts; a PDF with no drawing is `NO_PLAN_FOUND`; no saved reading is `BUDGET_CAP` with the tool never started; the true reading passes and stops at the build), 410 tests, line coverage 99.75 %, end to end 51/51, one QA round by a fresh reviewer: PASS, with no defect, sync-context run. $0. Task cards and findings: `m1.3/README.md`; contract: `Projects/3Dengine/contracts/CONTRACT-1.3.md` §8, §9; evidence: `logs/1.3/`.

## The milestone (plan §7.1, word for word)
- **אבן דרך:** שער הפענוח
- **מה עושים:** מיפוי קודי היציאה (0 / 5 / 3 / 4 / 1) למצבי עבודה ולקודי סיבה; שרטוט שנכשל לא ממשיך לבנייה ועובר ל-`review` עם `report.json` ו-`overlay.png`
- **מוכן כאשר:** PDF בלי שרטוט → `NO_PLAN_FOUND`; קריאה שמורה עם מידה ששונתה ביד → `TRACE_GATE_FAIL`; בשני המקרים Blender לא מופעל
- **נשען על:** קודי היציאה של `auto-trace.mjs`; ‏`stepTrace` ב-`run-project.mjs`

## Files it creates or changes
In the working folder `C:\RnD\.wt\3dengine\`, under `Projects/3Dengine/` (expected; a change of this list is logged in the card when the work starts):
- `engine/stages/trace.mjs` — the exit codes of `auto-trace.mjs` turned into job states and reason codes (`NO_PLAN_FOUND`, `TRACE_GATE_FAIL`, `BUDGET_CAP`)
- `tests/unit/trace.*.test.mjs`, `tests/milestones/m1.3.test.mjs`

**Changed when the work started (2026-11-18, main session; reasons in `m1.3/README.md`):** the stage is the `real` implementation in the stage's own module, `engine/stages/tracing.mjs` (the module of that name is what the runner walks since 0.3), with `engine/readings.mjs` for the saved reading; the runner gains the path to `review`; the closing test is `tests/stages/m1.3.test.mjs`, run with `npm run test:stages` (it runs the real tool).

## Instructions
Write the engine's own code (`engine/`, `mcp/`, `contracts/`) with unit tests. Wrap the ported pipeline tools, never fork them. CLI entry points follow the script contract (root §5): dry-run by default, `--go` only inside the estimate, idempotent, non-zero exit with a reason code.

## Acceptance criteria (the gate, plan §7.2)
1. **The closing test passes:** the «מוכן כאשר» line above, written as the runnable test `tests/milestones/m1.3.test.mjs`.
2. **Unit tests** exist for every function this card adds or changes.
3. **Every earlier card still passes:** `npm test` runs the whole suite.
4. **Test coverage is at least 80 %** of the lines of the engine's own code that this card adds or changes; the run fails under the bar. The summary is saved in `development/tasks/3dengine/logs/1.3/`.
5. **Closed properly:** commit on the branch `3dengine`, merge into the local `main`, a sync-context pass, the memory entry, the milestone log row in plan §7.2, the progress line on the plan page, and this card's State set to `DONE`.

**Check:** `cd C:/RnD/.wt/3dengine/Projects/3Dengine && timeout 540 npm run test:stages && timeout 300 npm test` → both commands exit 0, and `npm test` reports line coverage of at least 80 %.

## Standing rails
1. **Bounded read-first:** `memory/HOT.md`, then the LAST ~150 lines of your own `memory/agents/<name>.md` (plus its archive-index block), then `memory/listings/<id>.md` only if the task names a listing. ⛔ Never read `memory/INDEX.md` whole — grep it.
2. **Write last, once:** ONE entry (`memory/_TEMPLATE.md`) into the layer that owns the fact, plus ONE ≤400-char pointer line under that layer's existing `memory/INDEX.md` header. ⛔ Never add a header.
3. **Second reader:** at write time, name which OTHER actor must know this; append ONE pointer line into each named actor's `memory/agents/<name>.md` — `→ see <entry> — why it binds you`. No affected actor = say "none".
4. **An action is not done until its memory is written.**
5. **Ruling tier** — every brief carries its own `T0` / `T1` / `T2`.
6. Root `CLAUDE.md` §2, §8.7, §12: work only in the board's working folder; `timeout` on every run, one heavy run at a time, foreground; never open a `.env`; the plan's budget or $0; no deploy without Eliran's own go for that deploy (§9).
7. **The gate (Eliran, 2026-11-16):** no card starts before the previous card is closed. A card closes only after its closing test, its unit tests, every earlier card's tests, test coverage of at least 80 %, and a sync-context pass (plan §7.2).
8. **Git:** stage only your own paths; ⛔ never `git add -A` (the deletion of `Projects/Habait` in the main tree is unstaged and must stay so); never push.
9. **Secrets by NAME only:** never print a value, never name a `.env` path in a command; check a key's presence as a yes/no.
10. **Paid calls:** ledger row BEFORE the call, dry-run first, inside the cap, and only after Eliran answered the card's question.

Full contract: `memory/README.md` and root `CLAUDE.md` §0.
