# Milestone 1.4 — a saved reading: the task cards
<!-- created: 2026-11-18 · board: development/tasks/3dengine (card 07) · plan: development/plans/2026-11-16-pdf-to-360-engine-mcp.md §7.1 row 1.4 · owner: Eliran Shopen -->

**What this is:** plan-to-tasks for one milestone (Eliran, 2026-11-16: «שימוש בסקיל של PLAN TO TASKS עבור כל milestone»). The milestone card of the board is broken here into task cards: an agent for each, the waves, the gate, and a QA card by a fresh reviewer at the end.
**The milestone closes when:** a second run on the same PDF books $0 and returns the identical `plan.general.json` (plan §7.1 row 1.4) — and the gate of plan §7.2: unit tests, test coverage of at least 80 %, a sync-context pass.
**State:** `CLOSED`

## Key state
- **CLOSED 2026-11-19.** All nine tasks are DONE: a fresh reviewer's PASS in the third round (the first two failed, each on one defect of the engine's file lock, both fixed) (`../logs/1.4/qa-live-r3.md`, on `2f249804`). What the review saw outside the binding lines is written in the contract (§9 what is not in 1.4, §10) or carried on the board. The milestone cost $0. The gate ran on a machine that other sessions held at 100 % for hours and that slept once in the middle of a run: `../logs/1.4/gate-summary.txt` lists every run, the cut ones too.
- **Filed 2026-11-18**, right after milestone 1.3 closed (`main` `5136302`).
- **What 1.4 is, in one line:** the engine keeps the reading it paid for, so the same PDF is read by the vision model once, and the same reading always gives the same plan, byte for byte.
- **Eliran's decision (2026-11-18, the session's question dialog): a kept reading stays valid across engine versions; it stops being valid when the reading tool or the model changes.** The plan's row says «לפי sha256 של ה-PDF וגרסת המנוע»; with the version in the key every close of a milestone would throw every kept reading away (a new paid reading per PDF at each of the 21 closes left, and a job cannot pay by itself before milestone 4.2). He chose the recommended option. So the key is the PDF, and a kept reading records the READER that made it: the reading tool's file and the file that names the model.
- **Decision (main session): one module, `engine/readings.mjs`.** The board's card expected `engine/cache/`; the store of 1.3 already lives in that module and stays there. One kept reading per PDF: a job reads one drawing (contract 1.3); the key of a booklet's drawings is the milestone's that reads booklets.
- **Decision (main session): only a reading whose paid run PASSED is kept.** A reading that failed its own check stays in that run's folder for a person; kept, it would only send every job of that PDF to `review` until someone paid again.
- **Decision (main session): the same plan needs two changes.** The reading tool wrote the day into the plan and the id it was handed, which for a job carried the engine version. The tool now takes the date (ONE more listed line of the brought-in tool, `pipeline/PORT-CHANGES.md`), the engine hands it the date the reading was made, and the id is the DRAWING's.
- **What a second run still pays:** nothing for the reading. The judge (three vision calls, a report and not a gate) is not kept: a paid run with the judge on pays for it again, and says so before it starts.
- **Owed from 1.3** (the board's «Carried items»), answered here: the day's date in the plan (task 03); O-3, the settings' numbers through `Number()` (task 02).
- **$0.** The «paid» first run of the closing test is the real tool against a scripted model on a temp home: no network, no key. No real reading is paid for in this milestone.
- **Each tier of tests runs once** in the gate, and the live home after the merge gets the readiness command only (Eliran, 2026-11-18; `../run-tasks.md` step 3).
- **The contract of this milestone:** `Projects/3Dengine/contracts/CONTRACT-1.4.md`. Only the main session changes it.
- **Engine only** (Eliran, 2026-11-17). No MCP tool changes its name or its input.

## Cards
| # | File | Card | Agent · model · tier | Wave | State |
|---|---|---|---|---|---|
| 01 | `task-01-contract.md` | The contract of the saved reading | main session · opus · T0 | 0 | DONE |
| 02 | `task-02-readings-store.md` | The readings store: a kept reading, its record, the reader that made it | engine-builder · opus · T0 | 1 | DONE |
| 03 | `task-03-same-bytes.md` | The same reading gives the same plan: the date and the id | engine-builder · opus · T0 | 1 | DONE |
| 04 | `task-04-command.md` | The command: a second run reads from the store; a paid reading that passed is kept | engine-builder · opus · T0 | 2 | DONE |
| 05 | `task-05-stage.md` | The stage reads from the store | engine-builder · opus · T0 | 2 | DONE |
| 06 | `task-06-closing-test.md` | The closing test: a second run pays nothing and returns the identical plan | engine-builder · opus · T0 | 3 | DONE |
| 07 | `task-07-gate.md` | The gate: each tier once, coverage | main session · opus · T0 | 4 | DONE |
| 08 | `task-08-close.md` | Commit and merge into the local main | main session · opus · T0 | 5 | DONE |
| 09 | `task-09-qa-live.md` | QA on the live main: a saved reading | qa-reviewer · sonnet · T0 | 6 | DONE |

## Waves
Wave 0: task 01 (the contract). Wave 1: tasks 02 and 03 (the store; the date and the id): they meet in the wrapper's options only, so the main session writes both and no worker is spawned (`agent-model-guard.ps1` is not installed, so this line is the only bound). Wave 2: tasks 04 and 05 (the command; the stage), both on the store. Wave 3: task 06 (the closing test). Wave 4: task 07 (the gate). Wave 5: task 08 (commit, merge). Wave 6: task 09 (QA by a fresh reviewer). Then the sync-context pass, and card 07 of the board is `DONE`.

## Gates
- Task 07: both tiers of tests ONCE each, the 80 % coverage bar, the end-to-end test of 0.2, the readiness command.
- Task 09 (final QA): a fresh Sonnet reviewer, prompted to refute the binding lines of contract 1.4, on the live `main`. The milestone is closed only when it passes. It never pays, and it never prints an environment value.

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
