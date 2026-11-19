# Milestone 1.2 · task 06 — The gate: the closing test, the whole suite, coverage
<!-- board: 3dengine · milestone 1.2 (card 05 of the board) · created: 2026-11-17 · owner: Eliran Shopen -->

**Agent:** main session · **Model:** opus · **Ruling tier:** T0
**Runs as:** the main session
**Wave:** 4 · **Depends on:** tasks 04 and 05
**State:** `DONE`

## Files it creates or changes
- `development/tasks/3dengine/logs/1.2/` (the outputs of every run, and `gate-summary.txt`)
- `package.json` (version `1.2.0`: the number of the last closed milestone)

## Instructions
Run the gate of plan §7.2 in the working folder and keep every output: the closing test (`npm run test:stages`), the whole fast suite with the coverage bar three times in a row (`npm test`), the end-to-end test of 0.2 once (the command-line entry changed), the readiness command. No soak: this milestone does not touch the runner, the manifest or the ledger of a job. Write down the machine's load before every run; a run that fails on a wait or is cut by its limit under load is listed with the line that failed, not hidden.

## Acceptance criteria
1. `npm run test:stages`: exit 0.
2. `npm test`: exit 0 three times in a row, line coverage of `engine/**` and `mcp/**` at least 80 %.
3. `npm run test:e2e`: 51 of 51.
4. `node engine/cli.mjs doctor`: READY.
5. `gate-summary.txt` lists every run, also the ones that did not pass, with the reason.

**Check:** `cd C:/RnD/.wt/3dengine/Projects/3Dengine && timeout 540 npm run test:stages && timeout 300 npm test` → both exit 0, coverage at least 80 %.

## Result
2026-11-18, in the working folder, on a machine other sessions held at 32 to 100 % load: the closing test 3 of 3 (220 s); `npm test` 390 of 390 with line coverage 99.74 %, 3 runs of 3 (198 to 207 s); end to end 51 of 51; the readiness command READY; the engine version is `1.2.0`. `../logs/1.2/gate-summary.txt` lists every run. **Not measured:** the line coverage of the changed tool file with the real reading in it. With the coverage tool on, a real reading did not end inside 540 s (two tries, both cut, no process left); measured for part 3 alone it is 64.22 %, and the changed line itself is run and asserted. The 80 % bar is the fast suite's, on the engine's own code.

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
