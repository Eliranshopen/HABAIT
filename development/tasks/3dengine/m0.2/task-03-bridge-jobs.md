# Milestone 0.2 · task 03 — The bridge: job endpoints and the job record
<!-- board: 3dengine · milestone 0.2 (card 02 of the board) · created: 2026-11-16 · owner: Eliran Shopen -->

**Agent:** platform-dev · **Model:** opus · **Ruling tier:** T0
**Runs as:** a fresh `general-purpose` spawn (opus) with a self-contained brief.
**Wave:** 1 · **Depends on:** task 01
**State:** `DONE`

## Files it creates or changes
- in `C:\HABAIT-Agent-UI\.wt\engine-mcp\bridge`: `config.json`, `src/engineJobs.mjs` (new), the two endpoints and the `job` record in `src/server.mjs`, `test/*.test.mjs` (new), a `test` script

## Instructions
Contract §6. The new logic lives in one new module with no side effects at import, so it is tested with `node --test` and no Pi.

## Acceptance criteria
1. `GET /jobs/<id>` and `GET /jobs` answer from job files; a bad id is refused; a missing job is 404.
2. A `tool_execution_end` of an engine tool that carries a job produces exactly one `job` record.
3. Tests pass with line coverage of at least 80 % on the new module.

## Result
Done 2026-11-16 by a fresh worker (opus), checked by the main session: 16 of 16 tests, line coverage 100 % of `src/engineJobs.mjs`. Verified from Pi's installed code: a tool's own result reaches the bridge at `result.structuredContent.structuredContent`. Not testable without a refactor: the routing inside `server.mjs` (it starts Pi and listens the moment it is loaded) — task 06 covers it end to end.

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
