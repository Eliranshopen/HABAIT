# Milestone 0.2 · task 06 — Put it together and run the whole flow with a scripted agent
<!-- board: 3dengine · milestone 0.2 (card 02 of the board) · created: 2026-11-16 · owner: Eliran Shopen -->

**Agent:** main session · **Model:** opus · **Ruling tier:** T0
**Runs as:** the main session.
**Wave:** 2 · **Depends on:** tasks 02–05
**State:** `DONE`

## Files it creates or changes
- evidence: `development/tasks/3dengine/logs/0.2/`

## Instructions
Run the installer for real; `pi mcp list` must show the server and its eight tools (no model involved). Start the bridge and the app from their isolated copies; drive one job through the UI with the model replaced by a script that makes the same tool calls: upload, progress, approval, result link.

## Acceptance criteria
1. Pi lists eight tools named `mcp__habait_engine__*`.
2. In the browser: the job card moves through its steps, the quote appears, the guard's approval card appears, and the result button opens the 846 tour from the local link — with the badge «שחזור הדגמה».
3. Screens at 1440 and at 390: no horizontal scroll, both sides checked.

## Result
Done 2026-11-16: `tests/e2e/m0.2.e2e.mjs`, written by a fresh worker and run again by the main session (`E2E PASS: 51/51`, `../logs/0.2/gate-e2e.txt`, `../logs/0.2/e2e/`). The wrapper's installer on a temp Pi folder; `pi mcp list` = connected with 8 tools; the bridge and Pi 1.5.2 in RPC mode; a scripted fake model; the app in headless Chrome. Job A at 1440 runs through the guard's approval to the tour link (200, the page of apartment 846); job B at 390 is blocked at the guard card and never approved. No overflow in 7 states, no console error, every process stopped. After the merges the real installer ran, and `pi mcp list` on the real Pi folder prints `habait-engine: connected, 8 tools (direct, global)` (`live-install-global.txt`, `live-pi-mcp-list.txt`).

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
