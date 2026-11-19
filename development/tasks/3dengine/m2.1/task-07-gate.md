# Milestone 2.1 · task 07 — The gate: each tier once, coverage
<!-- board: 3dengine · milestone 2.1 (card 08 of the board) · created: 2026-11-19 · owner: Eliran Shopen -->

**Agent:** main session · **Model:** opus · **Ruling tier:** T0
**Runs as:** the main session
**Wave:** 5 · **Depends on:** task 06
**State:** `PLANNED`

## Files it creates or changes
- `development/tasks/3dengine/logs/2.1/` (the outputs of every run, and `gate-summary.txt`)
- `package.json` (version `2.1.0`)

## Instructions
Run the gate of plan §7.2 in the working folder and keep every output. **Each tier ONCE** (Eliran, 2026-11-18; `run-tasks.md` step 3): the stage tier (as task 05 settled it), `npm test` with the coverage bar, the soak (the runner and the lock changed), the end-to-end test of 0.2, the readiness command. Write down the machine's load before every run; a run that fails on a wait or is cut by its limit is run again, and the summary says so. The summary also reports the build time of the milestone and what it cost (Eliran, 2026-11-17).

## Acceptance criteria
1. The stage tier: exit 0 (the closing tests of 1.2, 1.3, 1.4 and 2.1).
2. `npm test`: exit 0, line coverage of `engine/**` and `mcp/**` at least 80 %.
3. The soak: 0 violations. `npm run test:e2e`: all assertions pass. `node engine/cli.mjs doctor`: READY.
4. `gate-summary.txt` lists every run, also the ones that did not pass, with the reason.

**Check:** `cd C:/RnD/.wt/3dengine/Projects/3Dengine && timeout 300 npm test` → exit 0, coverage at least 80 %; the stage tier by its own command → exit 0.

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
