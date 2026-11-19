# Milestone 0.3 · task 02 — One runner, the manifest, the ledger, resume
<!-- board: 3dengine · milestone 0.3 (card 03 of the board) · created: 2026-11-16 · owner: Eliran Shopen -->

**Agent:** engine-builder · **Model:** opus · **Ruling tier:** T0
**Runs as:** a fresh `general-purpose` spawn (opus) with a self-contained brief.
**Wave:** 1 · **Depends on:** task 01
**State:** `DONE` — 2026-11-17, after eight rounds; the engine's code is commit `cc5f410`, the round the eighth reviewer passed.

## Files it creates or changes
- `engine/runner.mjs`, `engine/stages/*.mjs`, `engine/manifest.mjs`, `engine/ledger.mjs`, `engine/heavy-lock.mjs`; changes in `engine/jobs.mjs`, `engine/cli.mjs`, `engine/config.mjs`, `mcp/stub-engine.mjs`; `mcp/stub-runner.mjs` removed
- `contracts/manifest.schema.json`, `contracts/ledger.schema.json`, `contracts/job.schema.json` (fields added)
- `engine.config.json` (the `runner` block, `stub.callUsd`)
- `tests/unit/*.test.mjs`, `tests/milestones/m0.3.test.mjs`

## Instructions
Contract §1–§7. Node ESM, built-ins only. Every write of a job's three files is atomic; a paid call is reserved in the ledger before it is sent and its answer cached before it is settled.

## Acceptance criteria
1. The closing test passes all seven parts with real detached runner processes that are really killed.
2. Every test of 0.1 and 0.2 still passes; `npm run test:e2e` still passes 51 assertions.
3. `npm test` passes with line coverage of at least 80 % on `engine/**` and `mcp/**`.

## Result
Round 1 done 2026-11-16 by a fresh worker (opus): one runner, the manifest, the ledger, resume; closing test 7 of 7, 188 tests, line coverage 100 % of `engine/**` and `mcp/**`; three defects found by its own kill tests and fixed (a dead runner's `job.lock`, the Windows rename under a reader, the heavy lock released too early). **REOPENED the same day:** the fresh reviewer's verdict was FAIL (task 05). Round 2 = contract §10: a cached answer is never sent again, `spent_usd` derived from the ledger, the cap is not a dead end, lock files are never empty, alive = live pid and fresh heartbeat, five more parts in the closing test, a kill soak. **Round 2 fixes written 2026-11-16 by the main session** (`engine/lib/atomic.mjs`, `heavy-lock.mjs`, `control.mjs`, `runner.mjs`, `ledger.mjs`, `stages/stub.mjs`, `mcp/stub-engine.mjs`, the two schemas; 13 new unit tests, 198 tests in the suite, line coverage 99.6 %); the new closing-test parts and the soak are in the hands of a sonnet worker.

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
