# Milestone 1.2 · task 02 — The engine's way to start the reading tool: `engine/trace.mjs` and the CLI command
<!-- board: 3dengine · milestone 1.2 (card 05 of the board) · created: 2026-11-17 · owner: Eliran Shopen -->

**Agent:** engine-builder · **Model:** opus · **Ruling tier:** T0
**Runs as:** the main session, in the `engine-builder` role (the project agents do not load in a session started at `C:\RnD`; the module is small, so no worker is spawned for it)
**Wave:** 1 (beside task 03) · **Depends on:** task 01
**State:** `DONE`

## Files it creates or changes
- `engine/trace.mjs` (new)
- `engine/cli.mjs` (the command `trace`)
- `engine/config.mjs` and `engine.config.json` (the `trace` settings block)
- `tests/unit/trace.test.mjs` (new)
- `tests/unit/cli.test.mjs`, `tests/unit/config.test.mjs` (new cases)

## Instructions
Sections 1 to 4 of `CONTRACT-1.2.md`, as one module with no side effect at import. The tool is started through an injected `spawn`, so the unit tests use a fake tool and never start Python. Three rules sit at ONE place each, so no caller can forget them (the lesson of 1.1, where each QA round found one more case of a family that had been closed case by case): (a) a run that can cost money never starts without a go and a cap; (b) a result is read only from a folder this run created, and only when it names this run's input and id; (c) nothing the module returns, throws, prints or logs carries text taken from the PDF: the tool's own output goes to a log file in the output folder. A run that is stopped (the time limit, a cancel signal) leaves no process of its tree behind.

## Acceptance criteria
1. For the same inputs the arguments are those of contract section 1, and the environment holds the engine's pointers (`pipelineEnv`).
2. A paid configuration without a go, without a cap, with a cap that is not a number above 0, or with a cap above `trace.maxBudgetUsd` does not start the tool (a test counts the spawns: 0).
3. An output folder that exists and is not empty is refused before anything starts; a result whose `index.json` is missing, is not JSON, or names another input or id is the outcome `RESULT_UNREADABLE`, never a crash and never a PASS.
4. The tool's exit codes are passed through and named: 0 PASS, 5 FAIL, 3 no plan drawing, 4 budget reached, 1 a step failed, 2 usage; a time-out and a tool that cannot be started are outcomes of their own.
5. A marker sentence planted in the room names, the labels and the `could_not_read` lines of a fake result appears in nothing the module returns, throws, prints or logs.
6. After a time-out or a cancel, the tool's process and its children are gone (a test with real processes: a tool that starts a child and sleeps).
7. Line coverage of `engine/trace.mjs` at least 80 %, and the whole suite still passes its bar.

**Check:** `cd C:/RnD/.wt/3dengine/Projects/3Dengine && timeout 180 node --test --experimental-test-coverage tests/unit/trace.test.mjs tests/unit/cli.test.mjs tests/unit/config.test.mjs` → exit 0, `trace.mjs` at 80 % lines or more.

## Result
2026-11-17, by the main session: `engine/trace.mjs` (302 lines), the command `trace`, the settings block `trace`. `tests/unit/trace.test.mjs` 18 tests and `tests/unit/cli-trace.test.mjs` 5 tests (the command's cases are a file of their own, not new cases in `cli.test.mjs`); line coverage of `trace.mjs` 100 %. **Found by the module's own unit test while it was written:** an id was allowed to start with a hyphen. The tool finds its flags by their text anywhere in the command, so the id `--no-judge` would have switched the judge off and the id `--budget` would have taken the cap away. An id now starts with a letter or a digit (contract §1).

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
