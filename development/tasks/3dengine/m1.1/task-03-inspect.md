# Milestone 1.1 · task 03 — The first look: `engine/inspect.mjs`
<!-- board: 3dengine · milestone 1.1 (card 04 of the board) · created: 2026-11-17 · owner: Eliran Shopen -->

**Agent:** engine-builder · **Model:** opus · **Ruling tier:** T0
**Runs as:** a fresh worker (`general-purpose`, pinned to `opus`) with this card and the contract as its brief; the project agents do not load in a session started at `C:\RnD`.
**Wave:** 1 (beside tasks 02 and 04) · **Depends on:** task 01
**State:** `DONE`

## Files it creates or changes
- `engine/inspect.mjs` (new)
- `tests/unit/inspect.test.mjs` (new)
- nothing else: the wiring into the tools is task 05

## Instructions
Sections 1 and 2 of `Projects/3Dengine/contracts/CONTRACT-1.1.md`, as one module with no side effect at import. `summarize(pagesDoc, settings)` is pure. `inspectPdf(config, { path, sha256 }, deps)` reads the cache or runs the scanner through `deps.run` (the shape of `engine/lib/run.mjs`), so the unit tests use a fake scanner and never start Python. The answer never carries text of the PDF: a test plants a marker string in the scanner's page text and looks for it in everything the module returns, throws and logs.

## Acceptance criteria
1. A one-page document with 8,515 drawings gives `kind` sheet and one candidate `p1` (`source` page); a one-page document with nothing gives no candidate; a one-page document with one large image gives one candidate.
2. A four-page document with three large images gives `kind` booklet and three candidates `p<page>-x<xref>` in page order, each with its thumbnail path.
3. The cache is used only when `inspect.json` names this PDF, this scanner file and these settings; a planted `inspect.json` that names another hash, another scanner hash or other settings, or is not JSON, is scanned again.
4. Python missing or the scanner file missing → `TOOLCHAIN_MISSING`; the scanner fails or writes no usable `pages.json` → `NOT_A_PDF`; the timeout → `FILE_TOO_LARGE`. Each is an `EngineError` from `engine/inbox.mjs`.
5. No text of the PDF in any return value, error message or log line.
6. Line coverage of `engine/inspect.mjs` at least 80 %.

**Check:** `cd C:/RnD/.wt/3dengine/Projects/3Dengine && timeout 120 node --test --experimental-test-coverage tests/unit/inspect.test.mjs` → exit 0, `inspect.mjs` at 80 % lines or more.

## Result
2026-11-17, by a fresh opus worker from the contract; reviewed and wired by the main session. `engine/inspect.mjs`, 16 tests at hand-over, line coverage 100 %. Changed on review: a look that cannot be stored answers `TOOLCHAIN_MISSING`, the PDF's hash is taken again after the scan, temp folders of dead processes are swept, the time-out message names a very large file or a busy machine. `tests/unit/inspect.test.mjs` now holds 18 tests.

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
