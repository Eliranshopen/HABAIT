# Milestone 1.3 · task 05 — The closing test: a failed reading never reaches the build
<!-- board: 3dengine · milestone 1.3 (card 06 of the board) · created: 2026-11-18 · owner: Eliran Shopen -->

**Agent:** engine-builder · **Model:** opus · **Ruling tier:** T0
**Runs as:** the main session, in the `engine-builder` role (the project agents do not load in a session started at `C:\RnD`)
**Wave:** 3 · **Depends on:** task 04
**State:** `DONE`

## Files it creates or changes
- `tests/stages/m1.3.test.mjs` (new)
- `tests/fixtures/apt846/changed-dimension-reading.json` (new: the saved reading with ONE printed dimension changed by hand) and its note in the folder's context file
- `tests/stages/CLAUDE.md`

## Instructions
The plan's «מוכן כאשר» line, on real processes: the real MCP server, a real runner, the real reading tool and Python, on a temp engine home whose settings say `mode: real`, with saved readings put in its readings folder. It is in the tier of tests that run a real pipeline tool (`npm run test:stages`). The temp home gives the tool one self-correction round, so the failing reading is not traced three times.

## Acceptance criteria
1. The 846 PDF with the saved reading in which one printed dimension was changed by hand: the job ends `review` / `TRACE_GATE_FAIL`; `report.json` and `overlay.png` are in the job folder where the job says; the manifest has no row at all; the job was never in `building` or `rendering` (Blender is not started); nothing was billed.
2. A PDF with no drawing: `start_simulation` answers `NO_PLAN_FOUND` and creates no job (milestone 1.1), on the same home.
3. The 846 PDF with the true saved reading: `tracing` ends with a row whose outputs are the plan (10 rooms), the overlay, the report, the check file and the reading; the job then stops at `building` with `STAGE_FAILED` (no real build yet), and nothing was billed.
4. A PDF that has a drawing and no saved reading: the job ends `failed` / `BUDGET_CAP`, the tool was never started, nothing was billed.
5. No answer of a tool and no job file holds a room name of the reading.

**Check:** `cd C:/RnD/.wt/3dengine/Projects/3Dengine && timeout 540 npm run test:stages` → exit 0 (on a machine other sessions hold at 100 % it can pass the limit: run it again when the machine is freer, and say so in the evidence).

## Result
2026-11-18: `tests/stages/m1.3.test.mjs` (parts 1, 2, 3 and 5) and `tests/stages/m1.3-pass.test.mjs` (parts 4 and 5), both on `tests/stages/real-home.mjs`; the fixture `tests/fixtures/apt846/changed-dimension-reading.json`, pinned in `tests/unit/intake-wiring.test.mjs`. Alone: the failing side 5 of 5 in 315 s, the passing side 2 of 2 in 128 s (`../logs/1.3/dev-m13-fail-1.txt`, `dev-m13-pass-1.txt`). The card named one test file; they are two, so that the two real readings run side by side.

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
