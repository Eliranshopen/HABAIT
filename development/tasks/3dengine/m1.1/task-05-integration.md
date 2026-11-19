# Milestone 1.1 · task 05 — Put it together: the tools, the runner, the golden input, the earlier tests
<!-- board: 3dengine · milestone 1.1 (card 04 of the board) · created: 2026-11-17 · owner: Eliran Shopen -->

**Agent:** engine-builder · **Model:** opus · **Ruling tier:** T0
**Runs as:** the main session, in the `engine-builder` role.
**Wave:** 2 · **Depends on:** tasks 02, 03, 04
**State:** `DONE`

## Files it creates or changes
- `mcp/stub-engine.mjs` — `inspect_plan` real; `start_simulation`: the candidate choice, the intake; the `inspect` dependency
- `engine/runner.mjs` — the stored input is checked at every start
- `engine/config.mjs`, `engine.config.json` — the `inspect` block; `package.json` — version 1.1.0
- `contracts/tools/inspect_plan.output.schema.json`, `contracts/tools/start_simulation.input.schema.json`, `contracts/job.schema.json`, `mcp/tools.mjs` (descriptions)
- `tests/fixtures/apt846/source.pdf` (the golden input), `tests/fixtures/sample.pdf` (a page with a drawing), `tests/fixtures/empty-page.pdf`, `tests/fixtures/make-sample.mjs`
- `tests/milestones/m1.1.test.mjs` (the closing test, six parts)
- `tests/milestones/m0.2.test.mjs`, `tests/milestones/m0.3.test.mjs`, `tests/soak/lib.mjs`, `tests/e2e/fake-model.mjs`, the unit tests of the stub engine and the runner: the lines of contract §8
- the context files of `engine/`, `engine/stages/`, `mcp/`, `contracts/`, `tests/…`, and the engine home's own

## Instructions
Wire the three pieces of wave 1 into the engine as `Projects/3Dengine/contracts/CONTRACT-1.1.md` says, bring the golden 846 PDF into the fixtures (its hash pinned in a test), write the closing test, and change in the earlier tests only the lines the contract lists, each with its reason beside it.

## Acceptance criteria
1. `inspect_plan` on the 846 PDF answers what part 1 of the closing test expects, through the real server process.
2. `start_simulation` creates the job only for a PDF with a candidate, copies it through the intake, and a runner checks the stored copy at every start.
3. Every earlier test passes; each changed line is one the contract names.
4. The schemas of the tools validate every answer (the closing tests check each result against its output schema).

**Check:** `cd C:/RnD/.wt/3dengine/Projects/3Dengine && timeout 300 node --test tests/milestones/m1.1.test.mjs` → exit 0, six parts.

## Result
2026-11-17. `inspect_plan` is real (`mode: "real"`), `start_simulation` takes a candidate id and copies through the intake, the runner checks the stored copy at every start and before every stage attempt; the `inspect` settings block; engine version 1.1.0; the schemas and the tool descriptions. Fixtures: the golden 846 PDF, `sample.pdf` with a drawing (300 segments), `empty-page.pdf`; `.gitattributes` keeps them as bytes (a checkout had turned `sample.pdf` into CRLF in the live home). The closing test has nine tests (parts 1 to 6, 5b, 5c, the stdout check). Earlier tests changed only where contract §8 says.

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
