# Milestone 1.4 · task 04 — The command: a second run reads from the store; a paid reading that passed is kept
<!-- board: 3dengine · milestone 1.4 (card 07 of the board) · created: 2026-11-18 · owner: Eliran Shopen -->

**Agent:** engine-builder · **Model:** opus · **Ruling tier:** T0
**Runs as:** the main session, in the `engine-builder` role (the project agents do not load in a session started at `C:\RnD`)
**Wave:** 2 (beside task 05) · **Depends on:** tasks 02 and 03
**State:** `DONE`

## Files it creates or changes
- `engine/cli.mjs` (`trace` and the new `reading`)
- `engine/trace.mjs` (only if a result must name the reading it used)
- `tests/unit/cli-trace.test.mjs`, `tests/unit/cli.test.mjs` (new cases)

## Instructions
Section «the command» of `CONTRACT-1.4.md`. `trace <pdf>` with no `--vlm-file` first asks the store: a kept reading of this PDF by today's reader is used, free, and the answer says so (the date it was read, never its text). A PAID run that made a fresh reading and PASSED keeps that reading, with what it cost. `--fresh` pays for a new reading although one is kept. `reading show <pdf>` says whether a reading is kept and whether it is still the reader's; `reading import <pdf> <file>` puts a reading a hand has into the store (dry-run without `--go`, root §5).

## Acceptance criteria
1. A free run with a kept reading starts the tool with that reading and a budget of 0; with none it is the `DRY` answer of 1.2, unchanged.
2. A paid run with a kept reading does not pay for a reading again unless `--fresh`; the judge's calls on a paid run are still paid, and the `DRY` answer says so.
3. A paid reading is kept only when its run passed; a failed one stays in the run's own folder. Nothing is kept on a free run.
4. `reading import` without `--go` writes nothing; with it, the reading is found by the next run. Neither command prints a room name or any other text of a reading.
5. Usage mistakes exit 2 as before; a stale kept reading is named as such, with what to do.

**Check:** `cd C:/RnD/.wt/3dengine/Projects/3Dengine && timeout 170 node --test --experimental-test-coverage tests/unit/cli-trace.test.mjs tests/unit/cli.test.mjs` → exit 0.

## Result
2026-11-18: `engine/cli.mjs`: `trace` asks the store first (a kept reading is used and no reading call is made; `--fresh` pays for a new one; a paid run that made a fresh reading and passed keeps it with the day the command decided; a reading that could not be kept is said loudly and exits 1), and the new command `reading show` / `reading import [--go]`. `formatTrace` says where the reading came from. Unit tests: `tests/unit/cli-trace.test.mjs` (9 tests) and `tests/unit/cli-reading.test.mjs` (2 tests, on the real store). The card named `cli.test.mjs`; the reading command has its own file.

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
