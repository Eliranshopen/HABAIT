# Milestone 1.3 · task 04 — The reading as a stage of a job: `engine/stages/tracing.mjs`, real
<!-- board: 3dengine · milestone 1.3 (card 06 of the board) · created: 2026-11-18 · owner: Eliran Shopen -->

**Agent:** engine-builder · **Model:** opus · **Ruling tier:** T0
**Runs as:** the main session, in the `engine-builder` role (the project agents do not load in a session started at `C:\RnD`)
**Wave:** 2 · **Depends on:** tasks 02 and 03
**State:** `DONE`

## Files it creates or changes
- `engine/stages/tracing.mjs` (the `real` implementation beside the stub)
- `engine/readings.mjs` (new: where a saved reading of a PDF is looked for)
- `engine/config.mjs`, `engine.config.json` (`trace.readingsDir`)
- `tests/unit/tracing-stage.test.mjs`, `tests/unit/readings.test.mjs` (new)
- `engine/stages/CLAUDE.md`, `engine/CLAUDE.md`

## Instructions
Section 3 of `CONTRACT-1.3.md`. The stage runs the reading tool through `runTrace` on the job's OWN copy of the PDF, into a folder of this attempt (`stages/tracing/attempt-<n>/`), free: from the saved reading the engine holds for this PDF (`<readingsDir>/<pdf sha256>.json`), with the judge off. It never pays: with no saved reading the job ends `failed` / `BUDGET_CAP` and nothing is started. The mapping of outcomes to job states is ONE table in the module, and the unit tests walk every row of it with a fake `runTrace`. A cancel, a replaced runner or a lost heavy lock stops the tool (the stage asks `checkCancelled()` while the tool runs and aborts it). On PASS the outputs are the plan, the overlay, the report, the check file and the reading that was used.

## Acceptance criteria
1. `PASS` → the stage returns its outputs (paths relative to the job folder) and the runner writes the row; the next stage may start.
2. `FAIL` → `ReviewNeeded` with `TRACE_GATE_FAIL`, the report and the overlay named; no row; no later stage.
3. `NO_PLAN_FOUND` → `failed` / `NO_PLAN_FOUND`. No saved reading, `DRY`, `NEEDS_PAID_RUN`, `BUDGET_REACHED` → `failed` / `BUDGET_CAP`, and for the first of them the tool is never started.
4. `NOT_STARTED` → `failed` / `TOOLCHAIN_MISSING`. `TIMEOUT`, `STEP_FAILED`, `USAGE`, `RESULT_UNREADABLE` → `failed` / `STAGE_FAILED`, each with its own fixed sentence.
5. A cancel while the tool runs stops the tool and writes nothing more; the same for a runner that was replaced.
6. No reason message, log line or `review` record carries text of the PDF (a marker in every text field of a fake result).
7. Line coverage of the two new modules at least 80 %.

**Check:** `cd C:/RnD/.wt/3dengine/Projects/3Dengine && timeout 180 node --test --experimental-test-coverage tests/unit/tracing-stage.test.mjs tests/unit/readings.test.mjs` → exit 0.

## Result
2026-11-18: `engine/stages/tracing.mjs` (`real`, `realStage(deps)`, the ONE table `OUTCOMES`) and `engine/readings.mjs` (`savedReadingFor`). Unit tests: `tests/unit/tracing-stage.test.mjs`, 11 tests with a fake `runTrace`; line coverage of both modules 100 %.

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
