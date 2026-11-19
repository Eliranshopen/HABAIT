# Milestone 1.1 · task 02 — A job's files are read only when they are this job's (carried from 0.3)
<!-- board: 3dengine · milestone 1.1 (card 04 of the board) · created: 2026-11-17 · owner: Eliran Shopen -->

**Agent:** engine-builder · **Model:** opus · **Ruling tier:** T0
**Runs as:** the main session, in the `engine-builder` role (it wrote the same check for the ledger in 0.3).
**Wave:** 1 · **Depends on:** task 01
**State:** `DONE`

## Files it creates or changes
- `engine/jobs.mjs` — `JobUnreadable`, `checkJob`, `readJob` / `writeJob` / `updateJob`
- `engine/manifest.mjs` — `ManifestUnreadable`, `checkManifest`, `readManifest` / `writeManifest`
- `engine/runner.mjs`, `engine/control.mjs`, `engine/cli.mjs`, `mcp/stub-engine.mjs` — what each caller does with an unreadable file
- `tests/unit/jobs.test.mjs`, `tests/unit/manifest.test.mjs`, `tests/unit/runner.test.mjs`, `tests/unit/cli.test.mjs`, `tests/unit/stub-engine.test.mjs`

## Instructions
Section 5 of `Projects/3Dengine/contracts/CONTRACT-1.1.md`. The eighth reviewer of 0.3 showed it twice of two tries (`../logs/0.3/qa-live-r8.md`, O-4): a hand-edited `manifest.json` or `job.json` that names another job, or none, made a runner write into that other job's file or create `jobs/undefined/`. Give both files the check the ledger has (`checkLedger` in `engine/ledger.mjs`): read only when the file names this job; write only under the id that was asked for. A runner that meets such a file stops, gives `runner.pid` back and writes nothing; the tools answer `JOB_NOT_FOUND` naming the job; `list_jobs` leaves the folder out; the CLI prints the reason and exits 1.

## Acceptance criteria
1. `readJob` and `readManifest` throw a named error for a file that names another job, no job, another schema, or (manifest) a row with an unknown stage or an output path that leaves the job folder.
2. `writeJob`, `updateJob` and `writeManifest` never write under an id other than the one asked for.
3. A runner on such a file returns without a write; the unit tests look at every file of the temp jobs folder before and after, byte for byte.
4. No code path builds a folder name from an id read out of a file: a test greps for it and a test runs it (`jobs/undefined` absent).
5. Line coverage of the changed files stays at or above 80 %.

**Check:** `cd C:/RnD/.wt/3dengine/Projects/3Dengine && timeout 200 node --test tests/unit/jobs.test.mjs tests/unit/manifest.test.mjs tests/unit/runner.test.mjs tests/unit/cli.test.mjs tests/unit/stub-engine.test.mjs` → exit 0.

## Result
2026-11-17, by the main session. `checkJob` / `JobUnreadable` and `checkManifest` / `ManifestUnreadable` (with `insideJob` for output paths); `writeJob`, `updateJob` and `writeManifest` write only under the id asked for; the runner returns `unreadable` (nothing written, `runner.pid` given back, exit code 1); the tools answer `JOB_NOT_FOUND`; the CLI prints the reason. Tests: `tests/unit/file-identity.test.mjs`, 14 tests; one older runner test expected `stuck` for a state outside the contract and now expects `unreadable`. Added before the QA round: a job file records `engine_version` and its id must be the id of its own input (so the hash in `job.json` cannot be rewritten together with the stored copy).

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
