# Milestone 1.3 · task 03 — The wrapper, tightened for a job: no log reading, the rounds, an ASCII output path
<!-- board: 3dengine · milestone 1.3 (card 06 of the board) · created: 2026-11-18 · owner: Eliran Shopen -->

**Agent:** engine-builder · **Model:** opus · **Ruling tier:** T0
**Runs as:** the main session, in the `engine-builder` role (the project agents do not load in a session started at `C:\RnD`)
**Wave:** 1 (beside task 02) · **Depends on:** task 01
**State:** `DONE`

## Files it creates or changes
- `engine/trace.mjs`
- `engine/config.mjs`, `engine.config.json` (`trace.rounds`)
- `tests/unit/trace.test.mjs`, `tests/unit/cli-trace.test.mjs` (changed and new cases)
- `contracts/CONTRACT-1.2.md` (a pointer to what 1.3 changed)

## Instructions
Section 2 of `CONTRACT-1.3.md`: three changes of the module that milestone 1.2 wrote, each owed to that milestone's review. (a) O-6: `NEEDS_PAID_RUN` is decided by the tool's exit code alone. A free run gives the tool a fixed word in place of a key, so the tool reaches its own budget check and refuses there with exit 4 (budget 0), before any request; the engine no longer reads the tool's log for a sentence. (b) The number of self-correction rounds is a setting, `trace.rounds`, passed as `--rounds`. (c) O-1: an output folder whose path has letters outside ASCII is refused before anything starts (the tool cannot write there), with a sentence that says so.

## Acceptance criteria
1. On a free run the tool's environment holds no key of the settings' list with a real value: the fal name holds the fixed word, the OpenRouter name is absent; the budget is 0 and the env root is the run's own folder.
2. A free run that meets a vision call ends `NEEDS_PAID_RUN` by exit code 4; exit 1 is `STEP_FAILED` whatever the log holds (a test plants the old sentence in the log).
3. `--rounds` carries the setting; the setting has bounds and a default equal to the tool's own (3).
4. An output path with a Hebrew letter is a `TraceUsageError` and nothing is created; a PDF or a saved reading in such a folder still works.
5. The closing test of 1.2 (`npm run test:stages`) still passes; line coverage of `engine/trace.mjs` stays at least 80 %.

**Check:** `cd C:/RnD/.wt/3dengine/Projects/3Dengine && timeout 180 node --test --experimental-test-coverage tests/unit/trace.test.mjs tests/unit/cli-trace.test.mjs` → exit 0.

## Result
2026-11-18: `engine/trace.mjs`: a free run gives the tool the fixed word `free-run-no-key` under the fal key's name; `NEEDS_PAID_RUN` is exit 4 on a free run and nothing else (the log is not read); `--rounds` carries `trace.rounds` (1 to 9, default 3); an output path outside printable ASCII is a `TraceUsageError` with `what: 'OUT_PATH'`. `tests/unit/trace.test.mjs` changed and extended; `cli-trace.test.mjs` needed no change. `contracts/CONTRACT-1.2.md` points at the change. Line coverage of `engine/trace.mjs`: 100 %.

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
