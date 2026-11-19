# Milestone 1.4 · task 06 — The closing test: a second run pays nothing and returns the identical plan
<!-- board: 3dengine · milestone 1.4 (card 07 of the board) · created: 2026-11-18 · owner: Eliran Shopen -->

**Agent:** engine-builder · **Model:** opus · **Ruling tier:** T0
**Runs as:** the main session, in the `engine-builder` role (the project agents do not load in a session started at `C:\RnD`)
**Wave:** 3 · **Depends on:** tasks 04 and 05
**State:** `DONE`

## Files it creates or changes
- `tests/stages/m1.4.test.mjs` (new)
- `tests/stages/scripted-vision.mjs` (new, test only: a model that answers from a file, no network)
- `tests/stages/m1.3-pass.test.mjs` (the job's plan is compared with the pinned hash)
- `tests/stages/CLAUDE.md`

## Instructions
The plan's «מוכן כאשר» line on real processes, at $0. A temp engine home with no keys file, a planted FAKE key, and `fetch` replaced by a scripted model that answers the reading call with the 846 fixture reading and a made-up cost, and records every request (the pattern of 1.2's walked paid path). FIRST run: the command, paid (`--budget`, `--go`, the judge off): the real tool reads «from the model», traces, passes; the reading is kept with its cost. SECOND run: a real JOB of the same PDF on the same home: it reads from the store, costs $0, makes no request, and its `plan.general.json` is byte for byte the first run's. It is in the tier of tests that run a real pipeline tool (`npm run test:stages`). The card of the board named `tests/milestones/m1.4.test.mjs`; it is here because it runs the real tool (contract 1.2 §8).

## Acceptance criteria
1. First run: exit 0, `PASS`, one request to the scripted model, the cost of the scripted answer in the run's ledger and in the kept record; the store holds the reading and its record.
2. Second run (a job): `tracing` done with a manifest row at $0, the job's ledger empty, NO new request, and the plan's bytes equal the first run's.
3. The plan's `trace_date` is the day the reading was made, in both runs.
4. On the 1.3 home (the fixture reading of 2026-11-06, imported): the job's plan has that date and the pinned hash, on whatever day the test runs.
5. A kept reading whose reader changed (one byte of a copy of the tool, in a temp pipeline root, or a fake reader in a unit test) is not used: the job ends `BUDGET_CAP`.
6. No room name of the reading in any answer, job file, record or runner log.

**Check:** `cd C:/RnD/.wt/3dengine/Projects/3Dengine && timeout 540 npm run test:stages` → exit 0 (on a machine other sessions hold at 100 % it can pass the limit: run the tier in two chunks, each under `timeout 540`, and say so in the evidence).

## Result
2026-11-18: `tests/stages/m1.4.test.mjs` (3 tests) with `tests/stages/scripted-vision.mjs`: the first run paid against a scripted model (one request, the made-up cost in the run's ledger and in the kept record), the second run a real job of the same PDF ($0, no new request, the plan byte for byte the first run's), then `reading show`. Alone: 3 of 3 in 357 s at 97 % load (`../logs/1.4/dev-m14-1.txt`). `m1.2.test.mjs` and `m1.3-pass.test.mjs` compare the plan with the pinned hash and the day `2026-11-06`. Acceptance criterion 5 (a kept reading whose reader changed is not used) is proven by the unit tests of the store and of the stage, with one changed byte of a stand-in tool file; no real-tool run was spent on it.

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
