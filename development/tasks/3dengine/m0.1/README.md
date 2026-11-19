# Milestone 0.1 — the engine home: the task cards
<!-- created: 2026-11-16 · board: development/tasks/3dengine (card 01) · plan: development/plans/2026-11-16-pdf-to-360-engine-mcp.md §7.1 row 0.1 · owner: Eliran Shopen -->

**What this is:** plan-to-tasks for one milestone (Eliran, 2026-11-16: «שימוש בסקיל של PLAN TO TASKS עבור כל milestone»). The milestone card of the board is broken here into task cards: an agent for each, the waves that may run side by side, the gate, and a QA card by a fresh reviewer at the end.
**The milestone closes when:** `run-project.mjs --parity` passes 41/41; `fetch.mjs --verify-only` confirms 57/57; the readiness command reports ready on everything except the keys (plan §7.1 row 0.1) — and the gate of plan §7.2: unit tests, test coverage of at least 80 %, a sync-context pass.
**State:** `CLOSED`

## Key state
- **CLOSED 2026-11-16.** All eight tasks are DONE; the fresh reviewer's verdict is PASS with no defects (`../logs/0.1/qa-live.md`); the sync-context pass ran after it. Local `main` = `5844920`.
- **Finding (task 03):** `fetch.mjs --verify-only` can verify the 45 models that come from the Kenney pack only when the pack zip sits in `catalog/.cache/`. The pack's download URL is dead today (it returns an 18 KB web page), the 2026-11-04 backup has no `.cache/`, and the one copy found on this machine is in `C:\HABAIT-Archive\Habait-archive-2026-11-03\…\catalog\.cache\` (5,130,729 bytes, sha256 equal to the manifest's lock). It was copied into the engine home. Without that file the tool prints `12/57 rows OK` and still exits 0.
- **Finding (task 02):** the first install pulled `onnxruntime` 1.32.0 (a dependency of `pymupdf` 2.0) where the proven environment has 1.31.1, so the lock now pins all 20 packages of the install, at the proven versions.

## Cards
| # | File | Card | Agent · model · tier | Wave | State |
|---|---|---|---|---|---|
| 01 | `task-01-port.md` | Bring the pipeline code from git, as it is | engine-builder · opus · T0 | 1 | DONE |
| 02 | `task-02-runtime.md` | The runtime, from locks | engine-builder · opus · T0 | 1 | DONE |
| 03 | `task-03-assets.md` | The render assets | engine-builder · opus · T0 | 1 | DONE |
| 04 | `task-04-settings-readiness-code.md` | The settings file, the readiness command, the set-up scripts and their tests | engine-builder · opus · T0 | 1 | DONE |
| 05 | `task-05-context-files.md` | Context files for the new folders | main session · opus · T0 | 2 | DONE |
| 06 | `task-06-gate.md` | The gate: closing test, unit tests, coverage | main session · opus · T0 | 3 | DONE |
| 07 | `task-07-close.md` | Commit, merge into the local main, set up the live home | main session · opus · T0 | 4 | DONE |
| 08 | `task-08-qa-live.md` | QA on the live main | qa-reviewer · sonnet · T0 | 5 | DONE |

## Waves
Wave 1: tasks 01 → then 02, 03 and 04 side by side (three workers at most). Wave 2: task 05. Wave 3: task 06 (the gate). Wave 4: task 07 (commit, merge, the live home). Wave 5: task 08 (QA by a fresh reviewer). Then the sync-context pass, and card 01 of the board is `DONE`.

## Gates
- Task 06: the closing test and the whole suite with the 80 % coverage bar, in the working folder.
- Task 08 (final QA): a fresh Sonnet reviewer, prompted to refute, on the live `main` after the merge. The milestone is closed only when it passes.

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
