# Milestone 1.4 · task 05 — The stage reads from the store
<!-- board: 3dengine · milestone 1.4 (card 07 of the board) · created: 2026-11-18 · owner: Eliran Shopen -->

**Agent:** engine-builder · **Model:** opus · **Ruling tier:** T0
**Runs as:** the main session, in the `engine-builder` role (the project agents do not load in a session started at `C:\RnD`)
**Wave:** 2 (beside task 04) · **Depends on:** tasks 02 and 03
**State:** `DONE`

## Files it creates or changes
- `engine/stages/tracing.mjs`
- `tests/unit/tracing-stage.test.mjs` (changed and new cases)
- `tests/stages/real-home.mjs` (the test home keeps its readings through the engine)

## Instructions
Section «the stage» of `CONTRACT-1.4.md`. The stage of 1.3 asks the store of task 02: `found` → the free run, with the date of the reading and the id of the drawing; `none` and `stale` → `failed` / `BUDGET_CAP`, each with its own fixed sentence, nothing started; `bad` → `STAGE_FAILED`. The outcome table of 1.3 is unchanged. The test home of the stage tier puts its readings in the store with the engine's own function.

## Acceptance criteria
1. With a kept reading of today's reader the stage runs free and passes `traceDate` and the drawing's id; a test reads both from the fake `runTrace`.
2. A kept reading of another reader ends the job `BUDGET_CAP` with a sentence that says the reader changed; no attempt folder is made.
3. The stage still never pays, and nothing it says is text of a reading (the marker test of 1.3 still passes).
4. The closing tests of 1.3 pass on the new store (`tests/stages/m1.3*.test.mjs`).

**Check:** `cd C:/RnD/.wt/3dengine/Projects/3Dengine && timeout 170 node --test --experimental-test-coverage tests/unit/tracing-stage.test.mjs` → exit 0.

## Result
2026-11-18: `engine/stages/tracing.mjs` asks `findReading`: `found` → the free run with `traceDate` = the record's plan day and `id` = the drawing's; `none` and `stale` → `BUDGET_CAP`, each with its own sentence; `bad` → `STAGE_FAILED`. `tests/stages/real-home.mjs` keeps a test home's readings through `keepReading` and can hand the server an environment. `tests/unit/tracing-stage.test.mjs`: 10 tests.

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
