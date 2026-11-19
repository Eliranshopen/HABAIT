# Milestone 1.1 — intake and a first look at the PDF: the task cards
<!-- created: 2026-11-17 · board: development/tasks/3dengine (card 04) · plan: development/plans/2026-11-16-pdf-to-360-engine-mcp.md §7.1 row 1.1 · owner: Eliran Shopen -->

**What this is:** plan-to-tasks for one milestone (Eliran, 2026-11-16: «שימוש בסקיל של PLAN TO TASKS עבור כל milestone»). The milestone card of the board is broken here into task cards: an agent for each, the waves that may run side by side, the gate, and a QA card by a fresh reviewer at the end.
**The milestone closes when:** the 846 PDF is identified as one sheet with one drawing; the same PDF twice gives the same `job_id`; a file outside the allowed folders is refused (plan §7.1 row 1.1) — and the gate of plan §7.2: unit tests, test coverage of at least 80 %, a sync-context pass.
**State:** `CLOSED`

## Key state
- **CLOSED 2026-11-17.** All eight tasks are DONE. The fifth fresh reviewer's verdict is PASS, with no defect (`../logs/1.1/qa-live-r5.md`, on `b7790fd`). The four rounds before it FAILED on 2, 3, 2 and 1 defects, each round fewer and narrower. Every defect is answered in the code; every observation is answered in the code, written in the contract (§9 what is not in 1.1, §10 what each round found) or carried on the board. The code that was gated and reviewed is `b7790fd`; `7a1a32c` after it holds documents only (the contract's fifth round, the engine's context files).
- **What the fifth round saw that is not this milestone's:** the job lock busy for over 2 s under load (O-1) and the suite's waits at 100 % load (O-2, O-3) are owed by card 08, the render stage; the size limit that is asked once (O-7) and the alternate data stream (O-6) are limits written in contract §9. All of them are in the board's «Carried items».
- **Round 5 (`b7790fd`):** the fourth fresh reviewer had FAILED round 4 on `aaec50c` (`../logs/1.1/qa-live-r4.md`, about 650 attempts): both defects of round 3 held, the new write rule held in 88 scenarios, and ONE low defect was found: an upload that became a folder between its hash and the intake's copy answered `TOOLCHAIN_MISSING` and blamed the job folder (4 of 2,500 raced starts). Round 5, by the main session: the intake reads the upload in one step and writes the job's copy in another, so a failed read is always the upload's (`NOT_A_PDF`). Verdict of the fifth reviewer: PASS (53 direct calls and 8,566 raced calls on the upload's states, the earlier defects again, 12 flows of healthy jobs; seven observations).
- **The gate on `b7790fd`, run while other sessions rendered with Blender on this machine (processor load 100 % throughout):** 367 tests, line coverage 99.72 %; the whole suite 3 runs of 3 in the worktree (215 to 230 s each) and 1 of 2 in the live home (the first failed on a wait of the 0.3 closing test's own set-up); the closing test 13 of 13; end to end 51/51 on the second run (the first failed its clean-up assertion); a short soak (30 kills, 8 takeovers) with no violation; the readiness command prints `READY`. Before those, five whole-suite runs failed on answer times and waits under that load, none on an assertion about the engine. Evidence and the runs that did not pass: `../logs/1.1/r5-gate-summary.txt`.
- **Round 4 (`aaec50c`):** the third fresh reviewer had FAILED round 3 on `aa53708` (`../logs/1.1/qa-live-r3.md`) on two low defects: an upload held by another program left both tools as a JSON-RPC error; the CLI's `job <id>` wrote the cost copy into `job.json` of a job whose manifest was not its own. Round 4: every read of the upload answers `NOT_A_PDF`; `job.json` is never written when `manifest.json` is not the job's (a check in `writeJob`); a file error of the engine's own folders that reaches a tool's answer is `TOOLCHAIN_MISSING`. Verdict of the fourth reviewer: FAIL.
- **The gate of round 4, on `aaec50c`:** 367 tests, line coverage 99.72 %; the whole suite 3 runs of 3 in the worktree and 1 of 1 in the live home; the closing test 13 of 13 (part 10 holds the upload with a real file lock); end to end 51/51; a short soak (22 kills, 8 takeovers) with no violation; the readiness command prints `READY`. Evidence: `../logs/1.1/r4-gate-summary.txt`.
- **Round 3 (`aa53708`):** the second fresh reviewer had FAILED round 2 on `0589956` (`../logs/1.1/qa-live-r2.md`, about 700 attempts) on three narrow defects: a stored first look with a planted page candidate was reused; the CLI's `resume` started a runner on a job whose manifest was not its own; a file where the job folder belongs left `start_simulation` as a raw file error. Round 3 closed each family by a rule (a stored look is rebuilt from its own `pages.json`; every starter of a runner reads both job files; every file error of a job folder has an answer). Verdict of the third reviewer: FAIL.
- **The gate of round 3, on `aa53708`:** 361 tests, line coverage 99.72 %; the whole suite 3 runs of 3 in the worktree and 1 of 1 in the live home; the closing test 12 of 12; end to end 51/51; a short soak (14 kills, 8 takeovers) with no violation; the readiness command prints `READY`. Evidence: `../logs/1.1/r3-gate-summary.txt`.
- **Round 2 (`0589956`):** the first fresh reviewer had FAILED the milestone on `ac717c5` (`../logs/1.1/qa-live.md`, about 1,200 attempts): D1, a first look made while the upload was rewritten in place with the same bytes was kept and later served for the intact file; D2, a look that could not be stored left as a raw file error; and ten observations. The fix was written by a fresh opus worker from the report, and read and extended by the main session. Verdict of the second reviewer: FAIL.
- **The gate of round 2, on `0589956`:** 347 tests, line coverage 99.66 %; the whole suite 3 runs of 3 in the worktree and 1 of 1 in the live home; the closing test 11 of 11; end to end 51/51; a short soak (17 kills, 8 takeovers) with no violation; the readiness command prints `READY`. Evidence: `../logs/1.1/r2-gate-summary.txt`. The first whole-suite run of the fix failed 4 tests of 347, none on the engine's behaviour (`../logs/1.1/r2-first-run.txt`; contract §8 items 12 and 13, §10).
- **Round 1 (`ac717c5`):** tasks 01 to 07 DONE (commits `4d5924f`, `ac717c5`); verdict FAIL.
- **The gate of round 1, on `ac717c5`:** 330 tests, line coverage 99.70 %; the whole suite 3 runs of 3 in the worktree and 1 of 1 in the live home; the closing test 9 of 9; end to end 51/51; a short soak with no violation. Evidence: `../logs/1.1/` (`gate-summary.txt` lists the runs).
- **Two holes were closed before the reviewer started** (the lesson of 0.3, where each of eight rounds found one more): a live runner that waited did not look at the stored copy again, and the hash in `job.json` could be rewritten together with the copy. Contract §4 and §10.
- **What the build found that is not this milestone's:** a first look on a saturated machine can pass the scanner's 30 s limit (owed by card 08, the render stage); the Pi wrapper's text still says every answer carries `mode: stub` (owed by card 13, the first that returns to the agent side). Both are in the board's «Carried items».
- **Filed 2026-11-17**, right after milestone 0.3 closed (`main` `954e0d6`).
- **The contract of this milestone:** `Projects/3Dengine/contracts/CONTRACT-1.1.md`. Only the main session changes it.
- **Engine only** (Eliran, 2026-11-17). The bridge, the app and the Pi wrapper are not touched. The one line of the wrapper that this milestone makes untrue (every answer says `mode: stub`) is written in the contract §9 for the milestone that returns to the agent side.
- **Measured before the cards were written:** the pipeline's scanner on the 846 PDF: 1 page, 8,515 vector paths, no large image, 2.2 s; on an empty page: no drawing. A read-only file on this machine: an overwrite is refused, the folder can still be removed.
- **The first task is carried from 0.3** (the board's «Carried items», O-4): `job.json` and `manifest.json` are read only when they are this job's.
- **Why three tasks run side by side:** tasks 02, 03 and 04 touch different files (the job and manifest readers; a new `inspect.mjs`; a new `stages/intake.mjs`). Task 05 puts them together, so no two workers edit one file.

## Cards
| # | File | Card | Agent · model · tier | Wave | State |
|---|---|---|---|---|---|
| 01 | `task-01-contract.md` | The contract of the intake and the first look | main session · opus · T0 | 0 | DONE |
| 02 | `task-02-file-identity.md` | A job's files are read only when they are this job's (carried from 0.3) | engine-builder · opus · T0 | 1 | DONE |
| 03 | `task-03-inspect.md` | The first look: `engine/inspect.mjs` | engine-builder · opus · T0 | 1 | DONE |
| 04 | `task-04-intake.md` | The intake: `engine/stages/intake.mjs` | engine-builder · opus · T0 | 1 | DONE |
| 05 | `task-05-integration.md` | Put it together: the tools, the runner, the golden input, the earlier tests | engine-builder · opus · T0 | 2 | DONE |
| 06 | `task-06-gate.md` | The gate: closing test, the whole suite, coverage, end to end | main session · opus · T0 | 3 | DONE |
| 07 | `task-07-close.md` | Commit and merge into the local main | main session · opus · T0 | 4 | DONE |
| 08 | `task-08-qa-live.md` | QA on the live main: the intake and the first look | qa-reviewer · sonnet · T0 | 5 | DONE |

## Waves
Wave 0: task 01 (the contract, done). Wave 1: tasks 02, 03 and 04 side by side (the main session on 02, two fresh opus workers on 03 and 04; three is under the five-worker bound, and `agent-model-guard.ps1` is not installed, so this line is the only bound). Wave 2: task 05 (the main session puts the pieces together). Wave 3: task 06 (the gate). Wave 4: task 07 (commit, merge). Wave 5: task 08 (QA by a fresh reviewer). Then the sync-context pass, and card 04 of the board is `DONE`.

## Gates
- Task 06: the closing test (six parts), the whole suite with the 80 % coverage bar, the end-to-end test of 0.2, a short soak.
- Task 08 (final QA): a fresh Sonnet reviewer, prompted to refute the binding lines of contract 1.1, on the live `main`. The milestone is closed only when it passes. Its scope is this milestone's lines: what it sees outside them is written as an observation for the milestone it belongs to.

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
