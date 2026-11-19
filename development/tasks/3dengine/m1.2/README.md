# Milestone 1.2 — reading the 846 plan inside the engine: the task cards
<!-- created: 2026-11-17 · board: development/tasks/3dengine (card 05) · plan: development/plans/2026-11-16-pdf-to-360-engine-mcp.md §7.1 row 1.2 · owner: Eliran Shopen -->

**What this is:** plan-to-tasks for one milestone (Eliran, 2026-11-16: «שימוש בסקיל של PLAN TO TASKS עבור כל milestone»). The milestone card of the board is broken here into task cards: an agent for each, the waves, the gate, and a QA card by a fresh reviewer at the end.
**The milestone closes when:** the existing reading tool (`auto-trace.mjs`), unchanged, run inside the engine home on the 846 PDF, exits 0 with 10 of 10 rooms and every printed dimension within 1 % (the plan's measured number: 0.83 % at most): first from a saved reading ($0), then from one fresh reading (about $0.09, inside a cap Eliran gives) (plan §7.1 row 1.2) — and the gate of plan §7.2: unit tests, test coverage of at least 80 %, a sync-context pass.
**State:** `CLOSED`

## Key state
- **CLOSED 2026-11-18.** All eight tasks are DONE: one QA round by a fresh reviewer, on `6d006c1`: PASS with no defect (the closing commit adds a test pin and documents, no engine code) (`../logs/1.2/qa-live.md`, on `c9caca6`). Every observation of the review is written in the contract (§9 what is not in 1.2, §10 the review) or carried on the board. The spend of the milestone: $0.0404, one fresh reading, inside the cap of $0.50 that Eliran gave (`../logs/1.2/fresh/spend.txt`).
- **2026-11-18, the build and the gate.** Tasks 01 to 07 are DONE; the code is on the local `main` `6d006c1`. Eliran gave the cap ($0.50); ONE fresh reading passed for $0.0404 (10 of 10 rooms, 82 checks, 0.82 % at most). The first attempt had been refused (HTTP 401, nothing billed): the reading tool sent its call to OpenRouter without the key's header. ONE line of the brought-in tool was changed and listed (`Projects/3Dengine/pipeline/PORT-CHANGES.md`); part 3 of the closing test proves it without paying. The gate: the closing test 3 of 3; `npm test` 390 of 390, line coverage 99.74 %, 3 runs of 3 in the working folder and 1 of 1 in the live home; end to end 51 of 51 (`../logs/1.2/gate-summary.txt`).
- **2026-11-17, the $0 half is built and passes; the paid half waits for Eliran's cap.** Tasks 01 to 04 are DONE, on the branch `3dengine` as commit `8437270` (not merged into `main` before the gate). The closing test's first part, the real tool through the engine's own command on the real 846 PDF: exit 0, 10 of 10 rooms, 18 printed dimensions within 1 % (0.82 % at most), the measurement files byte for byte those of the measured run, $0 (164 s at 100 % machine load). The fast suite: 390 of 390, line coverage 99.74 %. Task 05: the dry run is kept (`../logs/1.2/fresh/dry-run.txt`); the paid run starts only with Eliran's cap. Resume: his answer → the paid run through `node engine/cli.mjs trace … --budget <cap> --go` → part 2 of the closing test → the gate (task 06).
- **Found while the wrapper was written:** an id that starts with a hyphen would have been read by the tool as one of its flags (`--budget` as an id took the cap away). Closed in `decide()`; the rule is written for every later wrapper of a pipeline tool in `Projects/3Dengine/engine/CLAUDE.md`.
- **Filed 2026-11-17**, right after milestone 1.1 closed (`main` `c975763`).
- **Measured before the cards were written (2026-11-17, by hand, $0; root §3):** the tool ran in the working folder's engine home on `tests/fixtures/apt846/source.pdf` with the saved reading of 2026-11-06 and `--no-judge`: exit 0, PASS, 82 of 82 checks, 10 rooms, 18 fixtures, 18 printed-dimension checks with 0.82 % at most, $0. Its `trace-check.json`, `report.json`, `rooms.json`, `overlay.png` and `crop.png` are byte for byte the files of the run that was measured on 2026-11-07 (`.wt/portal-stage/Projects/Habait/habait-walkaround/Habait/tour360/out/ptrace846/trace/plan-1/`); `plan.general.json` differs only in the apartment id and `plan_meta`. The same PDF: sha256 `0c74ab30…0f0a`. It took 492 s, against 71 s in the measured run: other sessions' renders held the machine at 100 %.
- **Kind «קיים»:** the reading tool is not changed. What is written is the engine's own way to start it and the proof.
- **Decision (main session): the engine's wrapper, not a throwaway proof script.** The board's card named `engine/proofs/trace-846.mjs`. The module `engine/trace.mjs` is what milestone 1.3 needs to run the same tool as a job stage, so the proof and the stage start the tool in one way and that way is proven once (Eliran, 2026-11-17: never prove the same code twice).
- **Decision (main session): a second tier of tests.** A real reading takes 71 s on a quiet machine and about 8 minutes when other sessions render. `npm test` stays the fast suite with the coverage bar; a closing test that runs a real pipeline tool lives in `tests/stages/` and runs with `npm run test:stages`. From this card on the gate runs both. (This is the first part of what card 08 owes: a gate that holds on a saturated machine.)
- **The paid half waits for Eliran's cap** (task 05, about $0.09). Everything else is $0. The keys are present by name (the board's Key state, 2026-11-17); the line of the board's card that said the key was missing is corrected there.
- **The contract of this milestone:** `Projects/3Dengine/contracts/CONTRACT-1.2.md`. Only the main session changes it.
- **Engine only** (Eliran, 2026-11-17). The bridge, the app and the Pi wrapper are not touched; no MCP tool changes in this milestone.

## Cards
| # | File | Card | Agent · model · tier | Wave | State |
|---|---|---|---|---|---|
| 01 | `task-01-contract.md` | The contract of the reading proof | main session · opus · T0 | 0 | DONE |
| 02 | `task-02-trace-wrapper.md` | The engine's way to start the reading tool: `engine/trace.mjs` and the CLI command | engine-builder · opus · T0 | 1 | DONE |
| 03 | `task-03-fixtures.md` | The saved reading and the expected table, as fixtures | engine-builder · opus · T0 | 1 | DONE |
| 04 | `task-04-proof-saved.md` | The proof from the saved reading: the closing test, part 1 ($0) | engine-builder · opus · T0 | 2 | DONE |
| 05 | `task-05-fresh-reading.md` | One fresh reading (paid, inside Eliran's cap): the closing test, part 2 | main session · opus · T1 | 3 | DONE |
| 06 | `task-06-gate.md` | The gate: the closing test, the whole suite, coverage | main session · opus · T0 | 4 | DONE |
| 07 | `task-07-close.md` | Commit and merge into the local main | main session · opus · T0 | 5 | DONE |
| 08 | `task-08-qa-live.md` | QA on the live main: the reading of 846 inside the engine | qa-reviewer · sonnet · T0 | 6 | DONE |

## Waves
Wave 0: task 01 (the contract). Wave 1: tasks 02 and 03 touch different files and may run side by side; both are small, so the main session writes both and no worker is spawned (`agent-model-guard.ps1` is not installed, so this line is the only bound). Wave 2: task 04 (the closing test from the saved reading). Wave 3: task 05 (the fresh reading), only after Eliran's answer. Wave 4: task 06 (the gate). Wave 5: task 07 (commit, merge). Wave 6: task 08 (QA by a fresh reviewer). Then the sync-context pass, and card 05 of the board is `DONE`.

## Gates
- Task 06: the closing test (both parts), the whole fast suite with the 80 % coverage bar, the end-to-end test of 0.2, the readiness command.
- Task 08 (final QA): a fresh Sonnet reviewer, prompted to refute the binding lines of contract 1.2, on the live `main`. The milestone is closed only when it passes. It never pays: no `--go`.

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
