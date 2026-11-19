# Milestone 1.3 — the trace gate: the task cards
<!-- created: 2026-11-18 · board: development/tasks/3dengine (card 06) · plan: development/plans/2026-11-16-pdf-to-360-engine-mcp.md §7.1 row 1.3 · owner: Eliran Shopen -->

**What this is:** plan-to-tasks for one milestone (Eliran, 2026-11-16: «שימוש בסקיל של PLAN TO TASKS עבור כל milestone»). The milestone card of the board is broken here into task cards: an agent for each, the waves, the gate, and a QA card by a fresh reviewer at the end.
**The milestone closes when:** a PDF with no drawing answers `NO_PLAN_FOUND`; a saved reading with a dimension changed by hand ends the job with `TRACE_GATE_FAIL`; in both cases Blender is not started (plan §7.1 row 1.3) — and the gate of plan §7.2: unit tests, test coverage of at least 80 %, a sync-context pass.
**State:** `CLOSED`

## Key state
- **CLOSED 2026-11-18.** All eight tasks are DONE: one QA round by a fresh reviewer: PASS, with no defect (`../logs/1.3/qa-live.md`, on `ef2d2dc`). What the review saw outside the binding lines is written in the contract (§8 what is not in 1.3, §9) or carried on the board. The milestone cost $0. Two things the gate itself found, both in tests and neither in the engine: a unit test that said the settings file names no mode, and a race in the soak's own check (`../logs/1.3/gate-summary.txt`). Eliran's decision during the gate: each tier of tests runs ONCE (`../run-tasks.md` step 3).
- **Filed 2026-11-18**, right after milestone 1.2 closed (`main` `5912cac`).
- **What 1.3 is, in one line:** the reading of the drawing becomes the first REAL stage of a job, and a reading that fails its own check hands the job to a person (`review`) instead of going on to the build.
- **Decision (main session): a real job is a job of mode `real`, and the settings say which mode a new job gets.** `stub` stays the default, so the real home, the agent and every older test behave as before. In mode `real` every stage must be real: after 1.3 such a job reads the drawing and then stops at `building` with `STAGE_FAILED` (no real build yet). Each later milestone moves that line. A real job never returns the replay of 846.
- **Decision (main session): a job never pays for a reading in this milestone.** The stage is free: it uses the saved reading the engine holds for the PDF, and with none it ends `failed` / `BUDGET_CAP` before anything starts. Why: the card is tier T0 (no money), and the rules for money inside a job (the approval, the caps) are milestones 4.2 and 4.3, reviewed at tier T2. A reading is paid for by the operator's command (`engine trace … --budget --go`, milestone 1.2); keeping what it paid for is milestone 1.4.
- **Owed from 1.2's review** (the board's «Carried items»), answered here: O-1 an output path outside ASCII (task 03), O-6 `NEEDS_PAID_RUN` read from the tool's log (task 03), O-5 and O-2 what a stage may trust of a result and of `exit` (task 04: the stage decides by `outcome`, in a folder only it and the tool write).
- **Found before the cards were written:** the tool writes the day's date into the plan it traces (`plan_meta.trace_date`), so the same reading traced on another day gives other bytes. A stage's outputs should be the same bytes at every attempt (contract 0.3 §11.3). It costs nothing while no paid stage follows; milestone 1.4, whose line is «a second run returns the identical `plan.general.json`», owns it.
- **$0.** Every reading in the tests is free (a saved reading, or a fake tool).
- **The contract of this milestone:** `Projects/3Dengine/contracts/CONTRACT-1.3.md`. Only the main session changes it.
- **Engine only** (Eliran, 2026-11-17). No MCP tool changes its name or its input; a job file gains one field (`review`).

## Cards
| # | File | Card | Agent · model · tier | Wave | State |
|---|---|---|---|---|---|
| 01 | `task-01-contract.md` | The contract of the trace gate | main session · opus · T0 | 0 | DONE |
| 02 | `task-02-review-and-mode.md` | A stage can hand a job to a person (`review`); the mode of a new job comes from the settings | engine-builder · opus · T0 | 1 | DONE |
| 03 | `task-03-trace-tighten.md` | The wrapper, tightened for a job: no log reading, the rounds, an ASCII output path | engine-builder · opus · T0 | 1 | DONE |
| 04 | `task-04-tracing-stage.md` | The reading as a stage of a job: `engine/stages/tracing.mjs`, real | engine-builder · opus · T0 | 2 | DONE |
| 05 | `task-05-closing-test.md` | The closing test: a failed reading never reaches the build | engine-builder · opus · T0 | 3 | DONE |
| 06 | `task-06-gate.md` | The gate: the closing test, the whole suite, coverage | main session · opus · T0 | 4 | DONE |
| 07 | `task-07-close.md` | Commit and merge into the local main | main session · opus · T0 | 5 | DONE |
| 08 | `task-08-qa-live.md` | QA on the live main: the trace gate | qa-reviewer · sonnet · T0 | 6 | DONE |

## Waves
Wave 0: task 01 (the contract). Wave 1: tasks 02 and 03 (the runner and the job file; the wrapper): they meet only in the settings loader, so the main session writes both and no worker is spawned (`agent-model-guard.ps1` is not installed, so this line is the only bound). Wave 2: task 04 (the stage). Wave 3: task 05 (the closing test). Wave 4: task 06 (the gate). Wave 5: task 07 (commit, merge). Wave 6: task 08 (QA by a fresh reviewer). Then the sync-context pass, and card 06 of the board is `DONE`.

## Gates
- Task 06: both tiers of tests, the 80 % coverage bar, the end-to-end test of 0.2, a short soak, the readiness command.
- Task 08 (final QA): a fresh Sonnet reviewer, prompted to refute the binding lines of contract 1.3, on the live `main`. The milestone is closed only when it passes. It never pays.

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
