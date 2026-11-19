# Milestone 0.2 — a stub engine connected to the agent: the task cards
<!-- created: 2026-11-16 · board: development/tasks/3dengine (card 02) · plan: development/plans/2026-11-16-pdf-to-360-engine-mcp.md §7.1 row 0.2 · owner: Eliran Shopen -->

**What this is:** plan-to-tasks for one milestone (Eliran, 2026-11-16: «שימוש בסקיל של PLAN TO TASKS עבור כל milestone»). The milestone card of the board is broken here into task cards: an agent for each, the waves that may run side by side, the gate, and a QA card by a fresh reviewer at the end.
**The milestone closes when:** a PDF is uploaded in the agent's UI and the user sees progress, an approval card, and a result card that opens the apartment-846 tour (plan §7.1 row 0.2) — and the gate of plan §7.2: unit tests, test coverage of at least 80 %, a sync-context pass.
**State:** `CLOSED`

## Key state
- **CLOSED 2026-11-16.** All ten tasks are DONE: the gate passed in the three repos, the end-to-end test passed (51 assertions), one real conversation through Pi's model passed on Eliran's approval, the fresh reviewer's verdict is PASS with no defects, and the sync-context pass ran. Local mains: `C:/RnD` `902bdfe`, `C:/HABAIT-Agent-UI` `309802f`, `C:/pi-main/habait` `89751a0`.
- **The contract of this milestone:** `Projects/3Dengine/contracts/CONTRACT-0.2.md` (MCP tools, the job file, the bridge records, the cards). Every worker reads it; only the main session changes it.
- **Three repos, three isolated copies on a branch `engine-mcp`, never pushed:** the engine in `C:\RnD\.wt\3dengine` (branch `3dengine`); the agent UI in `C:\HABAIT-Agent-UI\.wt\engine-mcp`; the Pi wrapper in `C:\pi-main\habait\.wt\engine-mcp`. `.wt/` is ignored through each repo's local `info/exclude`. The main copies of the two agent repos stay untouched until task 09.
- **The card's question (T1):** Eliran was told on 2026-11-16 that the default is a branch in each outside repo and no push, and answered «תמשיך מאיפה שעצרנו».
- **Facts from the two read-only maps (2026-11-16):** Pi 1.5.2 reads MCP servers from `mcp.json` in its agent folder (none there today) and needs `exposure: direct`; the guard sees MCP tool calls but returns early for non-bash tools; the bridge runs Pi in RPC mode, streams NDJSON per chat run, forwards guard questions as approval cards, and its `pi.cwd` points at a folder that left the disk; the app already has `progress`, approval and version cards, has no tests, and accepts only `https://*.vercel.app` result links.
- **Honesty (root §6):** every stub answer carries `mode: stub` and every card built from it shows «שחזור הדגמה».

## Cards
| # | File | Card | Agent · model · tier | Wave | State |
|---|---|---|---|---|---|
| 01 | `task-01-contract.md` | One written contract for every boundary | main session · opus · T0 | 0 | DONE |
| 02 | `task-02-engine-mcp-stub.md` | The MCP server, the stub engine, the job files and the local link | engine-builder · opus · T0 | 1 | DONE |
| 03 | `task-03-bridge-jobs.md` | The bridge: job endpoints and the job record | platform-dev · opus · T0 | 1 | DONE |
| 04 | `task-04-app-job-card.md` | The app: the job card (progress, quote, result) | platform-dev · opus · T0 | 1 | DONE |
| 05 | `task-05-pi-registration-guard.md` | Pi: registration by the installer and the guard rule | engine-builder · opus · T0 | 1 | DONE |
| 06 | `task-06-integration.md` | Put it together and run the whole flow with a scripted agent | main session · opus · T0 | 2 | DONE |
| 07 | `task-07-gate.md` | The gate: closing test, every suite, coverage | main session · opus · T0 | 3 | DONE |
| 08 | `task-08-live-conversation.md` | One real conversation through Pi's model | main session · opus · T1 | 3 | DONE |
| 09 | `task-09-close.md` | Commit and merge, three repos, all local | main session · opus · T0 | 4 | DONE |
| 10 | `task-10-qa-live.md` | QA on the merged state | qa-reviewer · sonnet · T0 | 5 | DONE |

## Waves
Wave 0: task 01 (done). Wave 1: tasks 02, 03, 04 and 05 side by side — four workers, each in its own folder, all against the contract. Wave 2: task 06 (integration). Wave 3: tasks 07 (the gate) and 08 (one real conversation). Wave 4: task 09 (commit and merge, three repos). Wave 5: task 10 (QA by a fresh reviewer). Then the sync-context pass, and card 02 of the board is `DONE`.

## Gates
- Task 07: the closing test and every suite with the 80 % coverage bar; the cards at 1440 and 390.
- Task 08: T1 — a real conversation spends a few cents of model tokens through Pi's own provider login: Eliran's word first.
- Task 10 (final QA): a fresh Sonnet reviewer, prompted to refute, on the merged state. The milestone is closed only when it passes.

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
