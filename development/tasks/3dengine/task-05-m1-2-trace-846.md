# Card 05 — milestone 1.2 · Reading the 846 plan inside the engine
<!-- board: 3dengine · plan: development/plans/2026-11-16-pdf-to-360-engine-mcp.md §7.1 row 1.2 · created: 2026-11-16 · owner: Eliran Shopen -->

**Agent:** engine-builder · **Model:** opus · **Ruling tier:** T1
**Runs as:** the main session, in the `engine-builder` role (the project agents do not load in a session started at `C:\RnD`; definition: `Projects/Habait/.claude/agents/engine-builder.md` in the working folder).
**Stage:** 1 · פענוח ה-PDF · **Kind:** קיים (prove existing code) · **Closes in build phase:** E0 (שמורה), E2 (טרייה) · **Cost:** $0, ואז כ-$0.09
**Depends on:** card 04 (milestone 1.1) is closed.
**State:** `DONE` — closed 2026-11-18 on `c9caca6`: the closing test 3 of 3 (the saved reading at $0, one fresh reading for $0.0404 inside Eliran's cap of $0.50, the paid path walked without paying), 390 tests, line coverage 99.74 %, end to end 51/51, one QA round by a fresh reviewer, on `6d006c1`: PASS with no defect (the closing commit adds a test pin and documents, no engine code), sync-context run. Task cards and findings: `m1.2/README.md`; contract: `Projects/3Dengine/contracts/CONTRACT-1.2.md` §9, §10; evidence: `logs/1.2/`.

## The milestone (plan §7.1, word for word)
- **אבן דרך:** פענוח 846 במנוע
- **מה עושים:** `auto-trace.mjs` רץ בבית המנוע: קודם מקריאה שמורה (`--vlm-file`), אחר כך קריאה טרייה אחת
- **מוכן כאשר:** exit 0; ‏10/10 חדרים עד 1%, מידות מודפסות עד 0.83%
- **נשען על:** `auto-trace.mjs`, ‏`auto_*.py`, ‏`trace_check.py`, ‏`printed_dimensions.py`; קריאה שמורה: `.wt\portal-stage\…\out\ptrace846\trace\plan-1\vlm.json` (ועוד 8 ב-`.wt\project-runner`)

## Files it creates or changes
In the working folder `C:\RnD\.wt\3dengine\`, under `Projects/3Dengine/` (expected; a change of this list is logged in the card when the work starts):
- `engine/proofs/trace-846.mjs` — the repeatable proof run
- `fixtures/apt846/` — the PDF and the expected table
- `tests/milestones/m1.2.test.mjs`

**Changed when the work started (2026-11-17, main session; reasons in `m1.2/README.md`):** the proof run is the engine's own module and command, `engine/trace.mjs` and `node engine/cli.mjs trace` (milestone 1.3 runs the same tool as a job stage through it); the fixtures are `tests/fixtures/apt846/saved-reading.json` and `expected-trace.json` beside the PDF that 1.1 put there; the closing test is `tests/stages/m1.2.test.mjs`, run with `npm run test:stages` (a real reading takes 71 s on a quiet machine and minutes on a busy one, so it is not part of `npm test`).

## Instructions
Run the EXISTING tool, unchanged, inside the engine home on apartment 846. Record the measured number and compare it with the number in the plan row. Leave behind a repeatable proof script and a test that asserts the result from the evidence the run wrote. Change a ported file only if the proof fails: every such change is listed in `pipeline/PORT-CHANGES.md` and enters the coverage scope.

## Acceptance criteria (the gate, plan §7.2)
1. **The closing test passes:** the «מוכן כאשר» line above, written as the runnable test `tests/milestones/m1.2.test.mjs`.
2. **Unit tests** exist for every function this card adds or changes.
3. **Every earlier card still passes:** `npm test` runs the whole suite.
4. **Test coverage is at least 80 %** of the lines of the engine's own code that this card adds or changes; the run fails under the bar. The summary is saved in `development/tasks/3dengine/logs/1.2/`.
5. **Closed properly:** commit on the branch `3dengine`, merge into the local `main`, a sync-context pass, the memory entry, the milestone log row in plan §7.2, the progress line on the plan page, and this card's State set to `DONE`.
6. **Eliran answered the question below** before the part it guards started.

**Check:** `cd C:/RnD/.wt/3dengine/Projects/3Dengine && timeout 540 npm run test:stages && timeout 300 npm test` → both commands exit 0, and `npm test` reports line coverage of at least 80 %.

## Question for Eliran (T1)
The fresh half spends about $0.09 (the tool's own budget is $1). The key `OPENROUTER_API_KEY` is present by name since 2026-11-17 (the board's Key state; this line said it was missing). The question is the cap: `m1.2/task-05-fresh-reading.md`. Default: close the $0 half from a saved reading, then STOP and report. No skipping (plan §7.2).

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
