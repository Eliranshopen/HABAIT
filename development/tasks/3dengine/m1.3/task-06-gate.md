# Milestone 1.3 · task 06 — The gate: the closing test, the whole suite, coverage
<!-- board: 3dengine · milestone 1.3 (card 06 of the board) · created: 2026-11-18 · owner: Eliran Shopen -->

**Agent:** main session · **Model:** opus · **Ruling tier:** T0
**Runs as:** the main session
**Wave:** 4 · **Depends on:** task 05
**State:** `DONE`

## Files it creates or changes
- `development/tasks/3dengine/logs/1.3/` (the outputs of every run, and `gate-summary.txt`)
- `package.json` (version `1.3.0`)

## Instructions
Run the gate of plan §7.2 in the working folder and keep every output: both tiers (`npm run test:stages`, and `npm test` three times in a row with the coverage bar), the end-to-end test of 0.2 once (the runner and the tool handlers changed), a short soak (the runner changed), the readiness command. Write down the machine's load before every run; a run that fails on a wait or is cut by its limit is listed with the line that failed, not hidden.

## Acceptance criteria
1. `npm run test:stages`: exit 0 (the closing tests of 1.2 and 1.3).
2. `npm test`: exit 0 three times in a row, line coverage of `engine/**` and `mcp/**` at least 80 %.
3. `npm run test:e2e`: 51 of 51. `npm run test:soak -- --kills 14 --freezes 8`: no violation.
4. `node engine/cli.mjs doctor`: READY.
5. `gate-summary.txt` lists every run, also the ones that did not pass, with the reason.

**Check:** `cd C:/RnD/.wt/3dengine/Projects/3Dengine && timeout 540 npm run test:stages && timeout 300 npm test` → both exit 0, coverage at least 80 %.

## Result
2026-11-18, in the working folder, on a machine other sessions held at up to 100 % load: the closing tests 10 of 10 (425 s); `npm test` 410 of 410 with line coverage 99.75 %, five full runs (168 to 263 s), the last three in a row; two tries were cut by the 300 s limit in between, and the files that showed failed lines pass alone; end to end 51 of 51; the soak reported one violation that was a race of its OWN check, not of the engine (the mark was on the disk 3 ms before the send), the check was corrected, then 0 violations in two runs (16 and 41 kills); the readiness command READY; the engine version is `1.3.0`. `../logs/1.3/gate-summary.txt` lists every run, also the ones that did not pass.

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
