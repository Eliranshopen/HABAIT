# Board — copy-habait-2026-11-03
<!-- created: 2026-11-03 · plan: development/plans/2026-11-03-copy-habait-to-projects.md · coordinator: main session · owner: Eliran Shopen -->

**Source:** `development/plans/2026-11-03-copy-habait-to-projects.md` (read it first; this README is the execution order, the plan is the why).
**Goal:** `C:\Habait` → `C:\RnD\Projects\Habait`, clean (tier 0 excluded), verified, re-pointed, with the source untouched until Eliran cuts over.
**State:** `CLOSED` — all nine cards done 2026-11-03; cut-over complete; run entry `memory/runs/2026-11-03-copy-habait-cutover.md`. Board not in git — `C:\RnD` has no repo (`OWED-008`).

## Key state (update before every burst)
- Source anchors at research time (2026-11-03 ~12:20): repo HEAD `506f63d`, 146 dirty entries, 33 GB total, 699 GB free on C:.
- Rulings Q1–Q5 (2026-11-03, Eliran, one AskUserQuestion): Q1 copy all of tier 2 · Q2 copy `.env` as-is · Q3 copy Blender · Q4 snapshot now + re-sync at cut-over · Q5 keep the project's own `.claude` layer.
- Resume point: none — board closed. Follow-ups live in `docs/governance/OWED.md` (OWED-009).

## The cards (execution order)
| Burst | # | Card | Agent | status / track | model | tier | State |
|---|---|---|---|---|---|---|---|
| 1 | [01](task-01-inventory-and-manifest.md) | inventory, exclusion manifest, snapshot anchors, `pip freeze` | `workspace-steward` | live / harness-ops | sonnet | T0 | DONE (main session, 2026-11-03 — the research pass produced every number; `inventory.md`, `exclude.txt`, `logs/pip-freeze.txt`) |
| 1 | [02](task-02-eliran-rulings.md) | the five rulings Q1–Q5 | main session → Eliran | — | — | T1 | DONE (2026-11-03; five defaults accepted) |
| 2 | [03](task-03-copy.md) | dry run, then the robocopy pass per top-level entry | `habait-asset-wrangler` | live / habait | sonnet | T0 | DONE (main session, 12:19 — 29,552 files / 30.401 GB / 0 failed; `logs/copy-summary.md`) |
| 3 | [04](task-04-verify.md) | the five independent checks — **the gate** | `workspace-steward` (fresh context) | live / harness-ops | sonnet | T0 | **PASS** (fresh verifier, 12:40 — 5/5; 72 differing paths all live-session screenshots/flow.js after 12:19; `logs/verify-report.md`) |
| 3 | [05](task-05-secrets-ledger.md) | ledger rows for `FAL_KEY`, `MYARCHITECTAI_API_KEY` | `secrets-steward` | live / harness-ops | sonnet | T0 | DONE (main session, 12:22 — two rows + §3 in `docs/governance/SECRETS-LEDGER.md`) |
| 4 | [06](task-06-repoint-paths.md) | path rewrite in the copy + `REPOINTED.md` | `codebase-cartographer` | live / harness-ops | sonnet | T0 | DONE (main session, 12:58 — 158 files / 1,114 replacements, 0 left; `Projects/Habait/REPOINTED.md`) |
| 4 | [07](task-07-toolchain.md) | venv re-created, Blender/Node smokes from the new root | `habait-asset-wrangler` | live / habait | sonnet | T0 | DONE (main session, 13:05 — venv re-created, imports OK, Blender probe OK, npm ci ×2 OK, engine tests 13/15 = same as source; `logs/toolchain-report.md`) |
| 5 | [08](task-08-harness-cards-and-memory.md) | `Projects/` cards, root Context map, memory, OWED | `codebase-cartographer` + main session | live / harness-ops | sonnet | T1 (Q5) | DONE (main session, 12:55 — `Projects/CLAUDE.md`, 15 cards in the root map, `memory/project/2026-11-03-habait-project-location.md`, OWED-008/009) |
| 6 | [09](task-09-cutover-resync.md) | re-sync pass, re-verify, hand Eliran the archive command | `habait-asset-wrangler` → Eliran | live / habait | sonnet | T1 | DONE — re-sync (268 files; /XO lesson), re-pointing re-applied, verify 2 PASS 5/5, 18 orphan http.servers + idle session f6 ended on Eliran's go, **`C:\Habait` → `C:\Habait-archive-2026-11-03`** |

Burst rule: ≤ 5 workers in parallel (root §10.2); this board never needs more than 2 at once. Every card is one agent, one domain, resumable: it states what it already wrote before it continues.

## Gate
Task 04 is the board's gate. `Check:` lines are in the card; the reviewer is a fresh Sonnet `workspace-steward` that never ran task 03. No card after 04 starts until 04 reports PASS on all five checks. **Gate PASS 2026-11-03 12:40** (`logs/verify-report.md`); `exclude.txt` had a TAB defect (found by the verifier, fixed from `logs/exclude-fixed.txt`).

## Archive command (task 09 acceptance)
Run 2026-11-03 ≈13:00 by the main session on Eliran's explicit "run this" (after 18 orphan `http.server` processes and the idle session `habait-f6` were ended on his "close it for me"):
```
powershell -NoProfile -Command "Rename-Item -LiteralPath 'C:\Habait' -NewName 'Habait-archive-2026-11-03'"
```
Result: `RENAMED` — `Test-Path C:\Habait` False, `Test-Path C:\Habait-archive-2026-11-03` True. A rename, not a delete.

## Standing rails (inherited verbatim from the board README — root `CLAUDE.md` §0)
1. **Bounded read-first:** `memory/HOT.md`, then the LAST ~150 lines of your own `memory/agents/<name>.md` (plus its archive-index block). ⛔ Never read `memory/INDEX.md` whole — grep it.
2. **Write last, once:** ONE entry (`memory/_TEMPLATE.md`) into the layer that owns the fact, plus ONE ≤ 400-char pointer line under that layer's existing `memory/INDEX.md` header. ⛔ Never add a header.
3. **Second reader:** name which OTHER actor must know this; append ONE pointer line into their `memory/agents/<name>.md`, or say "none".
4. **An action is not done until its memory is written.**
5. ⛔ **The source `C:\Habait` is read-only to every task on this board.** Nothing is edited, moved or deleted there. Every write goes to `C:\RnD\Projects\Habait` or to this board folder.
6. ⚠ **Machine resource rules** (root `CLAUDE.md` §12): every heavy command under `timeout N`, one at a time, foreground; robocopy runs from PowerShell or `cmd //c`, never bare in Git Bash (it rewrites `/E`-style flags into paths).

## Records
- Logs: `development/tasks/copy-habait-2026-11-03/logs/` (robocopy logs, verification output, `pip-freeze.txt`); the re-point report is `Projects/Habait/REPOINTED.md`.
- Memory: one `memory/runs/` entry at close by the main session; each agent appends to its own `memory/agents/<name>.md`.
- Debts: `docs/governance/OWED.md` (`OWED-008` the untracked board; more as found).
