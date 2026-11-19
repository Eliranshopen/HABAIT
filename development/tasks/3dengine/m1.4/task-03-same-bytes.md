# Milestone 1.4 · task 03 — The same reading gives the same plan: the date and the id
<!-- board: 3dengine · milestone 1.4 (card 07 of the board) · created: 2026-11-18 · owner: Eliran Shopen -->

**Agent:** engine-builder · **Model:** opus · **Ruling tier:** T0
**Runs as:** the main session, in the `engine-builder` role (the project agents do not load in a session started at `C:\RnD`)
**Wave:** 1 (beside task 02) · **Depends on:** task 01
**State:** `DONE`

## Files it creates or changes
- `pipeline/Habait/tour360/tools/auto-trace.mjs` (ONE line: the date can be given)
- `pipeline/PORT-CHANGES.md` (the change and the new blob id)
- `engine/trace.mjs` (the option `traceDate`; the date of a saved reading)
- `engine/jobs.mjs` or `engine/readings.mjs` (the id of a drawing)
- `tests/unit/trace.test.mjs` (new cases)
- `tests/fixtures/make-expected-trace.mjs`, `tests/fixtures/apt846/expected-trace.json` (the plan's own hash joins the pinned files)

## Instructions
Two things made the bytes of `plan.general.json` differ between two runs of one reading: the reading tool wrote the DAY into it (`plan_meta.trace_date`), and it wrote the id it was given, which for a job was the job's id (and that carries the engine version). (a) The tool takes the date as a flag; when none is given it writes the day as before. This is the second listed change of the brought-in tool: one line, written in `pipeline/PORT-CHANGES.md` with the new blob id. (b) The wrapper hands the tool the date the READING was made (from the kept record, or from the reading's own `_meta.at`); a fresh reading is made today and gets today. (c) The id handed to the tool is the id of the DRAWING (the PDF's hash and the candidate), the same for every job of that drawing whatever the engine version or the mode. Then the plan's own hash for the 846 fixture is pinned.

## Acceptance criteria
1. The tool with the flag writes that date; without it, the day (the closing test of 0.1 passes with the new blob id in the list).
2. A date that is not `YYYY-MM-DD` is refused before anything starts; a value handed to the tool can never be read as a flag.
3. The id of a drawing does not change with the engine version or the mode, and passes the id rule of contract 1.2 (no leading hyphen).
4. `expected-trace.json` is written by its generator from a real run and now holds the sha256 of `plan.general.json` too; the measured numbers of 1.2 are unchanged.
5. The closing tests of 1.2 and 1.3 still pass (`npm run test:stages`).

**Check:** `cd C:/RnD/.wt/3dengine/Projects/3Dengine && timeout 170 node --test tests/unit/trace.test.mjs tests/milestones/m0.1.test.mjs` → exit 0.

## Result
2026-11-18: ONE more line of the brought-in tool (`--trace-date`; `pipeline/PORT-CHANGES.md` now lists two changes of `auto-trace.mjs`, blob `c55bfe16…`; against the source 4 lines in, 2 out; the closing test of 0.1 passes). `engine/trace.mjs`: the option `traceDate` (`isDate`, `isInstant`), and the day of a reading file's own `_meta.at` when the caller gives none. `engine/jobs.mjs`: `drawingId(pdfSha256, apartment)`. `tests/fixtures/apt846/expected-trace.json` written again by its generator from a real run (458 s at 100 % load; `../logs/1.4/dev-fixture-run.txt`): every number and the three measurement hashes unchanged, the plan's hash added; the plan carries `2026-11-06` and the drawing's id.

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
