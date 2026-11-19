# Milestone 1.2 · task 04 — The proof from the saved reading: the closing test, part 1 ($0)
<!-- board: 3dengine · milestone 1.2 (card 05 of the board) · created: 2026-11-17 · owner: Eliran Shopen -->

**Agent:** engine-builder · **Model:** opus · **Ruling tier:** T0
**Runs as:** the main session, in the `engine-builder` role (the project agents do not load in a session started at `C:\RnD`; the module is small, so no worker is spawned for it)
**Wave:** 2 · **Depends on:** tasks 02 and 03
**State:** `DONE`

## Files it creates or changes
- `tests/stages/m1.2.test.mjs` (new: the closing test)
- `tests/stages/CLAUDE.md` (new)
- `package.json` (the script `test:stages`)
- `tests/CLAUDE.md` (the new tier)

## Instructions
The closing test starts the REAL tool through the engine's own command, as a real process: `node engine/cli.mjs trace tests/fixtures/apt846/source.pdf --out <temp> --id apt846 --vlm-file tests/fixtures/apt846/saved-reading.json --no-judge`. It asserts the plan's «מוכן כאשר» line from the files the run wrote, and that the run is the measured one again: same inputs, same outputs. It lives in `tests/stages/`, the tier of tests that run a real pipeline tool (71 s on a quiet machine, about 8 minutes when other sessions render), and runs with `npm run test:stages`; `npm test` stays the fast suite.

## Acceptance criteria
1. Exit 0, outcome PASS, and the tool's own check file says PASS with 0 failed checks.
2. Room count 10 of 10; every printed-dimension check passes within 1 %; the largest is at most 0.83 % (the plan's number; measured 0.82 %).
3. `trace-check.json`, `report.json` and `rooms.json` of the run have the sha256 of the expected table.
4. Nothing was paid: the summary says $0 and the run's folder holds no ledger row.
5. The command's own output holds none of the room names of the reading (text of the PDF is data), and nothing is written outside `--out`.
6. The test FAILS when Python or the tool is missing; it never skips.

**Check:** `cd C:/RnD/.wt/3dengine/Projects/3Dengine && timeout 540 npm run test:stages` → exit 0 (on a machine that other sessions hold at 100 % it can pass the limit: run it again when the machine is free, and say so in the evidence).

## Result
2026-11-17, by the main session: `tests/stages/m1.2.test.mjs`, part 1, and the script `test:stages`. First run in the working folder: 1 of 1 in 164 s on a machine at 100 % load (`../logs/1.2/dev-stages-1.txt`): exit 0, PASS, 10 of 10 rooms, 18 printed dimensions within 1 % (0.82 % at most), the three measurement files byte for byte those of the measured run, $0, no ledger file, the two planted key values never reached the tool. The fast suite beside it: 390 of 390, line coverage 99.74 %, 290 s (`../logs/1.2/dev-npm-test-1.txt`).

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
