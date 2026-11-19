# Milestone 1.1 · task 04 — The intake: `engine/stages/intake.mjs`
<!-- board: 3dengine · milestone 1.1 (card 04 of the board) · created: 2026-11-17 · owner: Eliran Shopen -->

**Agent:** engine-builder · **Model:** opus · **Ruling tier:** T0
**Runs as:** a fresh worker (`general-purpose`, pinned to `opus`) with this card and the contract as its brief.
**Wave:** 1 (beside tasks 02 and 03) · **Depends on:** task 01
**State:** `DONE`

## Files it creates or changes
- `engine/stages/intake.mjs` (new)
- `tests/unit/intake.test.mjs` (new)
- nothing else: the wiring into `start_simulation` and the runner is task 05

## Instructions
Sections 3 and 4 of `Projects/3Dengine/contracts/CONTRACT-1.1.md`. `intakePdf(jobsDir, id, source, sha256)` makes the verified, read-only copy `jobs/<id>/input/source.pdf` and is safe to repeat; `verifyInput(jobsDir, job)` says whether the stored copy is still the PDF the job was started with. Real files in a temp folder (no fake file system): the point of the module is what the disk does.

## Acceptance criteria
1. The copy has the source's bytes and hash and is read-only: an overwrite and an append are refused by the operating system.
2. A second call with the same PDF copies nothing and leaves the file as it is; a copy that lost its read-only mark gets it back.
3. A source that changes between the hash and the copy (the test swaps it through an injected hook) is never put in place: no `input/source.pdf`, no temp file left, `NOT_A_PDF`.
4. An `input/source.pdf` that is already there with another hash is not overwritten: `NOT_A_PDF`, the job named, the foreign file byte for byte as it was.
5. `verifyInput`: ok for an intact copy; `missing` for none; `changed` after the bytes are changed by hand.
6. A folder that holds the read-only copy can still be removed by the tests' clean-up.
7. Line coverage of `engine/stages/intake.mjs` at least 80 %.

**Check:** `cd C:/RnD/.wt/3dengine/Projects/3Dengine && timeout 120 node --test --experimental-test-coverage tests/unit/intake.test.mjs` → exit 0, `intake.mjs` at 80 % lines or more.

## Result
2026-11-17, by a fresh opus worker from the contract; reviewed and wired by the main session. `engine/stages/intake.mjs`, 11 tests, line coverage 98 %. Changed on review: the shared `pidAlive` instead of a second copy of it; an upload that is gone at copy time answers `NOT_A_PDF`.

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
