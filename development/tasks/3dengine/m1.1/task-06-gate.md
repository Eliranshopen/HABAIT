# Milestone 1.1 · task 06 — The gate: closing test, the whole suite, coverage, end to end
<!-- board: 3dengine · milestone 1.1 (card 04 of the board) · created: 2026-11-17 · owner: Eliran Shopen -->

**Agent:** main session · **Model:** opus · **Ruling tier:** T0
**Runs as:** the main session.
**Wave:** 3 · **Depends on:** task 05
**State:** `DONE`

## Files it creates or changes
- evidence: `development/tasks/3dengine/logs/1.1/gate-*.txt`

## Instructions
Run the closing test, the whole suite with the coverage bar, the end-to-end test and a short soak; save the outputs. The whole suite runs several times one after another: a gate that fails once in ten is not a gate (0.3, round 8).

## Acceptance criteria
1. The six parts of the closing test of 1.1 pass.
2. Every earlier milestone's tests pass; line coverage at least 80 % on `engine/**` and `mcp/**`.
3. The end-to-end test passes its 51 assertions.
4. A short soak ends with no violation; no process and no temp home of the runs is left.

**Check:** `cd C:/RnD/.wt/3dengine/Projects/3Dengine && timeout 300 node --test tests/milestones/m1.1.test.mjs && timeout 300 npm test && timeout 560 npm run test:e2e` → all exit 0; coverage at least 80 %.

## Result
2026-11-17 (`../logs/1.1/gate-summary.txt`): the closing test 9 of 9; the whole suite 330 tests, line coverage 99.70 %, 3 runs of 3; end to end 51/51; a short soak (14 kills, 8 takeovers) with no violation. Found on the way: while another session's job held every core and most of the memory, a first look took 31 s and 46 s, over the scanner's 30 s limit (contract §9; carried to card 08 of the board), and an older runner test that counted waits against the real clock failed once (it now moves its own clock).

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
