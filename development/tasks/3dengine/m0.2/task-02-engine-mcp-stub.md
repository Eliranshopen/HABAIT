# Milestone 0.2 · task 02 — The MCP server, the stub engine, the job files and the local link
<!-- board: 3dengine · milestone 0.2 (card 02 of the board) · created: 2026-11-16 · owner: Eliran Shopen -->

**Agent:** engine-builder · **Model:** opus · **Ruling tier:** T0
**Runs as:** a fresh `general-purpose` spawn (opus) with a self-contained brief.
**Wave:** 1 · **Depends on:** task 01
**State:** `DONE`

## Files it creates or changes
- `mcp/server.mjs`, `mcp/tools.mjs`, `mcp/stub-engine.mjs`, `mcp/stub-runner.mjs`
- `engine/jobs.mjs`, `engine/inbox.mjs`, `engine/serve.mjs`, additions to `engine/cli.mjs` and `engine/config.mjs`
- `contracts/job.schema.json` and the tool schemas
- `engine.config.json` (the `inbox`, `stub` and `serve` blocks)
- `tests/unit/*.test.mjs`, `tests/milestones/m0.2.test.mjs`, `tests/fixtures/sample.pdf`

## Instructions
Contract §1–§5. Node ESM, built-ins only, no SDK. The server speaks JSON-RPC on stdio and nothing else on stdout. The runner and the static server are detached processes; every test that starts one stops it.

## Acceptance criteria
1. The closing test drives the real server process: `initialize`, eight tools listed with their schemas, a job walked from `queued` through an approval to `done`, `get_result`, and the local link answering 200.
2. The same PDF returns the same job; every reason code of the stub is reached by a test; every tool answers in under 2 seconds.
3. `npm test` passes with line coverage of at least 80 % on `engine/**` and `mcp/**`; milestone 0.1's tests still pass.

## Result
Done 2026-11-16 by a fresh worker (opus), checked by the main session (`../logs/0.2/gate-closing-test-engine.txt`, `gate-npm-test.txt`): the closing test of the engine half 8 of 8 against the real server process; 144 tests in the whole suite; line coverage 99.84 % of `engine/**` and `mcp/**`; no process left running; the readiness command still READY EXCEPT KEYS. Decisions taken on the way are in contract §9 (among them: `engine_status` answers from a background check because the check takes about 5 s).

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
