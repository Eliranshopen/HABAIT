# Milestone 1.2 · task 03 — The saved reading and the expected table, as fixtures
<!-- board: 3dengine · milestone 1.2 (card 05 of the board) · created: 2026-11-17 · owner: Eliran Shopen -->

**Agent:** engine-builder · **Model:** opus · **Ruling tier:** T0
**Runs as:** the main session, in the `engine-builder` role (the project agents do not load in a session started at `C:\RnD`; the module is small, so no worker is spawned for it)
**Wave:** 1 (beside task 02) · **Depends on:** task 01
**State:** `DONE`

## Files it creates or changes
- `tests/fixtures/apt846/saved-reading.json` (new: the saved reading of 2026-11-06, copied byte for byte)
- `tests/fixtures/apt846/expected-trace.json` (new: the numbers the proof must reproduce)
- `tests/fixtures/make-expected-trace.mjs` (new: writes the expected table from a run folder)
- `tests/fixtures/CLAUDE.md` (rows)
- `tests/unit/intake-wiring.test.mjs` (the fixtures' hashes)

## Instructions
The saved reading is the file `.wt/portal-stage/Projects/Habait/habait-walkaround/Habait/tour360/out/ptrace846/trace/plan-1/vlm.json` (one vision call of 2026-11-06, model `google/gemini-3.7-flash`), the one behind the measured line «10/10 חדרים עד 1%». Copy it byte for byte and pin its sha256, so the proof does not depend on a working folder of another board. The expected table is written by a script from the folder of the hand run of 2026-11-17 (never typed by hand): the status, the number of checks, the room count, every printed-dimension check (room id, expected, got, percent), and the sha256 of `trace-check.json`, `report.json` and `rooms.json`.

## Acceptance criteria
1. `saved-reading.json` has the sha256 of the source file, and a unit test pins it.
2. The expected table says: PASS, 82 checks, 0 failed, room count 10 of 10, 18 printed-dimension checks, the largest 0.82 %.
3. Running the script again on the same run folder writes the same bytes.

**Check:** `cd C:/RnD/.wt/3dengine/Projects/3Dengine && timeout 120 node --test tests/unit/intake-wiring.test.mjs` → exit 0.

## Result
2026-11-17, by the main session: `tests/fixtures/apt846/saved-reading.json` (4,783 bytes, sha256 `55787164…05a51537`, the source file byte for byte), `expected-trace.json` written by `tests/fixtures/make-expected-trace.mjs` from the hand run (PASS, 82 checks, 0 failed, 10 of 10, 18 printed dimensions, 0.82 % at most); a second run of the script gives the same bytes; `tests/unit/intake-wiring.test.mjs` pins both.

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
