# Milestone 2.1 — the render as an engine stage: the task cards
<!-- created: 2026-11-19 · board: development/tasks/3dengine (card 08) · plan: development/plans/2026-11-16-pdf-to-360-engine-mcp.md §7.1 row 2.1 · owner: Eliran Shopen -->

**What this is:** plan-to-tasks for one milestone (Eliran, 2026-11-16: «שימוש בסקיל של PLAN TO TASKS עבור כל milestone»). The milestone card of the board is broken here into task cards: an agent for each, the waves, the gate, and a QA card by a fresh reviewer at the end.
**The milestone closes when:** `pano.webp`, `depth.png` and `pano.render.json` for the living room; a kill in the middle of rendering two rooms and then a resume does not render again the room that finished; a second run on the same input skips everything; a repeated render of one room gives the same picture (plan §7.1 row 2.1) — and the gate of plan §7.2: unit tests, test coverage of at least 80 %, a sync-context pass.
**State:** `EXECUTING`

## Key state
- **RESUME HERE (2026-11-19, about 11:45; the work was STOPPED here on Eliran's word: he goes on from another computer).** **The work in progress is IN the project's own folder: on Eliran's word (2026-11-19, «תעדכן את הפרויקט הזה בתיקייה שלו») the branch was merged into the local `main` although the milestone is not gated; `npm test` passed whole just before (458 of 458, lines 99.56 %: `../logs/2.1/dev-npm-test-2.txt`). The engine version is still `1.4.0`; the live home's jobs stay `stub`.** Tasks 01 (the proof) and 02 (the contract) are DONE. Tasks 03 and 04 are WRITTEN and unit-tested with fake tools (`tests/unit/build.test.mjs` 13 of 13, `tests/unit/render.test.mjs` 10 of 10, the new case in `runner.test.mjs`). Task 06, the closing test `tests/stages/m2.1.test.mjs`, is written. Its FIRST run on real Blender (`../logs/2.1/dev-m21-1.txt`, 471 s) showed both real stages working through a kill and a resume up to `awaiting_approval`; its three failures were a mistake of the TEST (it waited for the runner to end while the job waits for the approval, where a live runner is right), fixed. The second run was stopped in the middle (`dev-m21-2.txt`): it is NOT a result. **NEXT, in order:** (1) `cd Projects/3Dengine && timeout 1500 node --test tests/stages/m2.1.test.mjs` (in the background: it runs real Blender for about 8 minutes) until its four parts pass; fix what it shows. (2) `timeout 300 npm test` whole. (3) Task 05, the carried items (`task-05-carried.md`: the lock's release after `fn`; the stage tier's time; the fixed waits; two measurements). (4) The version `2.1.0` in `package.json`, then task 07 the gate, 08 the merge, 09 a fresh reviewer, the close with the whole sync-context pass. Tasks 03 and 04 become DONE when the closing test passes. Read first: `Projects/3Dengine/contracts/CONTRACT-2.1.md` (every decision; §13 for Eliran's audit) and `../logs/2.1/proof-facts.md`. **On ANOTHER computer** read `memory/project/2026-11-19-engine-handoff-other-computer.md` before anything: what a clone of the GitHub mirror does not hold (the test PDFs, the render assets, the Python environment, Blender, the keys file) and how each is brought.
- **What the proof settled (2026-11-19):** the unchanged chain renders one room in the engine home (the living room is `cp-livingRoom` in a plan the reading tool makes); a job's files CAN live in the job behind three junctions; the build's files, the crop and the vectors are the same bytes every time; the colour and depth pictures were the same bytes in two renders, `pano.render.json` and the scene never are; the tool's own skip does not survive a rebuild of the scene; one room at full quality is about seven minutes of this machine's processor, so tests render at 1024x512 (the smallest the chain takes) with few samples; the tools need no key.
- **Filed 2026-11-19**, right after milestone 1.4 closed (`main` `5c40ee13`). The existing chain was read first, by a read-only mapping of the code (no tool was run); the facts below are from that reading and are CHECKED by task 01 before the contract rests on them.
- **What 2.1 is, in one line:** `building` and `rendering` become real stages of a job: the engine starts the existing build and render tools itself, one Blender at a time, keeps a record per room, and never renders a room it already holds.
- **One room = one render point.** The build always makes the whole apartment's scene; only the render is limited (`--render-points cp-living`). The closing test renders two points; the whole apartment is rendered once, by the engine, at 3.1 (Eliran, 2026-11-17).
- **To settle in the contract, on the proof (main session):**
  1. *Where a job's files live.* The tools write at fixed places inside the pipeline tree (`apartments/<id>`, `tours/<id>`, `out/<id>`), not in a job folder, and the first two are not ignored by git. A test home uses the real pipeline too. Two ways with no change of a brought-in file: directory junctions from those three names into the job's folder, or files in the tree that the stage copies. The proof tries the junctions.
  2. *«The same picture».* The pipeline's own notes say the colour picture is NOT the same bytes in two identical renders (file sizes 130,090 / 130,093 / 130,109), while the depth's packed pixels are. The engine's rule is that a stage's outputs are the same bytes in every attempt, or the paid stages after it repeat. So: a room the job holds is never rendered again, and «the same picture» is the depth's pixels bit for bit and the colour within a measured tolerance. The proof measures it here.
  3. *The Blender lock.* The tools' machine-wide lock is a FILE made by an exclusive create, with no staleness and no wait limit: a hard-killed holder leaves it for ever. The engine holds that file itself around every Blender run (the tool it starts gets a lock path of the job's own), waits for another holder, never takes it, and removes only its own lock left by a dead runner. The engine's folder lock is never used on that path: a folder renamed onto a FILE replaces it.
  4. *The crop of the drawing.* The build needs `crop.png`, which the reading tool writes and the reading stage does not list among its outputs: it becomes an output of `tracing` if the proof shows it is the same bytes every time (a line of contract 1.3 changes).
  5. *Free.* The tools read a keys file at their start when `FAL_KEY` is not set: the engine hands them a fixed word and an env root with no keys file, as it does for the reading.
- **The closing test is in the stage tier** (`tests/stages/m2.1.test.mjs`), not in `tests/milestones/` as the board's card expected: it runs real Blender for minutes (contract 1.2 §8).
- **Owed from earlier milestones** (the board's «Carried items»), in task 05 unless said: an unknown room `type` (1.3 O-1: task 03); a release that fails after `fn` ran (1.4 round 3, O-3); the stage tier's time (1.4 round 2, O-3); the fixed waits of older tests at 100 % load (1.1 O-2/O-3, 1.4 round 1 O-6); a job lock held longer than a tool waits (1.1 O-1); the first look on a saturated machine (1.1). The coverage of a brought-in file under the coverage tool (1.2) stays on the board.
- **Other sessions render on this machine.** The Blender lock is shared with them: this milestone's tests wait for it. A wait is time, not a failure.
- **$0.** No model is called: the reading comes from the kept fixture reading.
- **Each tier of tests runs once** in the gate (Eliran, 2026-11-18; `../run-tasks.md` step 3).
- **The contract of this milestone:** `Projects/3Dengine/contracts/CONTRACT-2.1.md` (task 02). Only the main session changes it.
- **Engine only** (Eliran, 2026-11-17). No MCP tool changes its name or its input.

## Cards
| # | File | Card | Agent · model · tier | Wave | State |
|---|---|---|---|---|---|
| 01 | `task-01-proof-one-room.md` | The proof: the existing chain renders one room in the engine home | engine-builder · opus · T0 | 0 | DONE |
| 02 | `task-02-contract.md` | The contract of the render stage | main session · opus · T0 | 1 | DONE |
| 03 | `task-03-building-stage.md` | The build as a real stage: the job's workspace, the wrapper, the stage | engine-builder · opus · T0 | 2 | PLANNED |
| 04 | `task-04-render-stage.md` | The render as a real stage: the Blender lock, a row per room, resume from the next room | engine-builder · opus · T0 | 3 | PLANNED |
| 05 | `task-05-carried.md` | What the board carried to this card: the lock's release, and the gate on a machine the engine itself holds | engine-builder · opus · T0 | 2 | PLANNED |
| 06 | `task-06-closing-test.md` | The closing test: two rooms, a kill, a resume, a second run, the same picture | engine-builder · opus · T0 | 4 | PLANNED |
| 07 | `task-07-gate.md` | The gate: each tier once, coverage | main session · opus · T0 | 5 | PLANNED |
| 08 | `task-08-close.md` | Commit and merge into the local main | main session · opus · T0 | 6 | PLANNED |
| 09 | `task-09-qa-live.md` | QA on the live main: the render as an engine stage | qa-reviewer · sonnet · T0 | 7 | PLANNED |

## Waves
Wave 0: task 01 (the proof, by hand, one Blender). Wave 1: task 02 (the contract). Wave 2: tasks 03 and 05 (the build stage; the carried items): they touch different files, and the main session writes both, so no worker is spawned (`agent-model-guard.ps1` is not installed, so this line is the only bound). Wave 3: task 04 (the render stage, on the workspace of task 03). Wave 4: task 06 (the closing test). Wave 5: task 07 (the gate). Wave 6: task 08 (commit and merge). Wave 7: task 09 (the fresh reviewer).

## Gates
- Task 07: every tier of tests ONCE each, the 80 % coverage bar, the soak, the end-to-end test of 0.2, the readiness command.
- Task 09 (final QA): a fresh Sonnet reviewer, prompted to refute the binding lines of contract 2.1, on the live `main`. The milestone is closed only when it passes. It never pays, never prints an environment value, and never touches a Blender or a lock that is not its own.

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
