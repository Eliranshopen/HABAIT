# Milestone 0.3 · task 03 — The gate: closing test, the whole suite, coverage, end to end
<!-- board: 3dengine · milestone 0.3 (card 03 of the board) · created: 2026-11-16 · owner: Eliran Shopen -->

**Agent:** main session · **Model:** opus · **Ruling tier:** T0
**Runs as:** the main session.
**Wave:** 2 · **Depends on:** task 02
**State:** `DONE`

## Files it creates or changes
- evidence: `development/tasks/3dengine/logs/0.3/gate-*.txt`

## Instructions
Run the closing test, the whole suite and the end-to-end test; save the outputs.

## Acceptance criteria
1. The seven parts of the kill test pass.
2. Line coverage at least 80 % on `engine/**` and `mcp/**`.
3. The end-to-end test passes 51 assertions.

**Check:** `cd C:/RnD/.wt/3dengine/Projects/3Dengine && timeout 540 node --test tests/milestones/m0.3.test.mjs && timeout 300 npm test && timeout 560 npm run test:e2e` → all three exit 0; coverage at least 80 %.

## Result
Round 1 PASS 2026-11-16 (`../logs/0.3/gate-closing-test-run1.txt`, `run2`, `gate-npm-test.txt`, `gate-e2e.txt`): the kill test 7 of 7 twice, 188 tests, line coverage 100 %, the end-to-end test 51 assertions. Runs again after round 2.

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
