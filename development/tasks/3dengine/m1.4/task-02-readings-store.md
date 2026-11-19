# Milestone 1.4 · task 02 — The readings store: a kept reading, its record, the reader that made it
<!-- board: 3dengine · milestone 1.4 (card 07 of the board) · created: 2026-11-18 · owner: Eliran Shopen -->

**Agent:** engine-builder · **Model:** opus · **Ruling tier:** T0
**Runs as:** the main session, in the `engine-builder` role (the project agents do not load in a session started at `C:\RnD`)
**Wave:** 1 (beside task 03) · **Depends on:** task 01
**State:** `DONE`

## Files it creates or changes
- `engine/readings.mjs` (the store: keep, find, the reader's identity)
- `engine/config.mjs` (a number of the settings file is a JSON number: O-3 of 1.3's review)
- `tests/unit/readings.test.mjs` (new)
- `tests/unit/config.test.mjs`, `tests/unit/tracing-stage.test.mjs` (changed cases)

## Instructions
The store of contract 1.4. One kept reading per PDF, in a folder named by the PDF's sha256: the reading as the tool wrote it, byte for byte, and a record beside it (the PDF's hash, the hash of the reading file, the reader that made it, when it was read, where it came from: a paid run or an import, what it cost, the engine version). `findReading` answers `found`, `none`, `bad` (the two files do not add up, or are not this PDF's) or `stale` (made by another reader). The reader is two files of the pipeline: the reading tool and the file that names the model; their hashes are taken from the disk at every question. `keepReading` writes both files atomically and never destroys a reading that was paid for: the one it replaces is moved aside. Nothing of a reading's text is returned or logged. And the settings loader stops taking `true`, `[4]` or `"0x3"` for a number.

## Acceptance criteria
1. `findReading` returns a file only when the record names this PDF, the reading file has the hash the record states, and the reader is today's; each other case has its own status and a unit test.
2. A change of one byte of the reading tool, or of the file that names the model, makes every kept reading `stale`; a change of the engine version does not.
3. `keepReading` twice with the same reading writes nothing new; with another reading the old pair is moved into the folder's `superseded/` and is still there.
4. A record or a reading planted by hand that does not add up is `bad`, never `found` (the record is checked against the file, not believed).
5. A number in the settings file must be a JSON number; the environment overrides still take digits as text. The 1.3 store layout (one file per PDF) is no longer read.
6. Line coverage of `engine/readings.mjs` is at least 80 %.

**Check:** `cd C:/RnD/.wt/3dengine/Projects/3Dengine && timeout 170 node --test --experimental-test-coverage tests/unit/readings.test.mjs tests/unit/config.test.mjs` → exit 0.

## Result
2026-11-18: `engine/readings.mjs` rewritten as the store: `findReading` (`found` / `none` / `stale` / `bad`), `keepReading` (the reading first, the record last, under a lock; a replaced pair moves to `superseded/<n>/`), `readerOf` (the sha256 of the reading tool and of `server/handler.mjs`, which names the model), `readingCost`, `supersededCount`. `engine/config.mjs`: a number of the settings file is a JSON number, an environment override takes plain digits (`envInt`). Unit tests: `tests/unit/readings.test.mjs` (11 tests, 27 ways a pair does not add up) and a new case in `config.test.mjs` (15 numeric fields). Line coverage of `engine/readings.mjs`: 100 %.

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
