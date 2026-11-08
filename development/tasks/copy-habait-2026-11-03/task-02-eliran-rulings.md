# Task 02 — Eliran's five rulings
**Agent:** main session (AskUserQuestion) → Eliran · **Ruling tier:** T1 · **Burst:** 1 · **Depends on:** 01 (so the numbers in the questions are measured, not estimated)

## What to do
Ask the five questions of the plan §5 in ONE AskUserQuestion call, defaults first and marked "(Recommended)", with task 01's measured sizes in the question text. Record the answers in this file under "Rulings" and in the board README's Key state. A ruling that changes a tier moves lines between the two blocks of `exclude.txt`.

## Rulings (fill in)
| # | Question | Eliran's answer | Date |
|---|---|---|---|
| Q1 | tier 2: copy all / exclude renders / exclude all rebuildable | Copy all of tier 2 (Blender included) | 2026-11-03 |
| Q2 | `.env`: copy as-is / re-create by hand | Copy the file as-is; names to the ledger | 2026-11-03 |
| Q3 | portable Blender: copy / re-extract later | Copy (folded into Q1) | 2026-11-03 |
| Q4 | cut-over: snapshot + re-sync / wait for idle | Snapshot now, re-sync at cut-over | 2026-11-03 |
| Q5 | project `.claude/` + Hebrew cards: keep as the project's layer / merge into `C:\RnD\.claude` | Keep as the project's own layer; OWED-009 for the harness agents | 2026-11-03 |

## Acceptance
- Five answers recorded with a date; `exclude.txt` updated to match Q1 and Q3; task 03 unblocked.
- If Eliran answers "wait for idle" on Q4, task 03 carries a precondition line: no `habait-*` session in `ListAgents` and no server on the ports listed in `SESSIONS.md`.

## Standing rails (inherited verbatim from the board README — root `CLAUDE.md` §0)
1. **Bounded read-first:** `memory/HOT.md`, then the LAST ~150 lines of your own `memory/agents/<name>.md` (plus its archive-index block). ⛔ Never read `memory/INDEX.md` whole — grep it.
2. **Write last, once:** ONE entry (`memory/_TEMPLATE.md`) into the layer that owns the fact, plus ONE ≤ 400-char pointer line under that layer's existing `memory/INDEX.md` header. ⛔ Never add a header.
3. **Second reader:** name which OTHER actor must know this; append ONE pointer line into their `memory/agents/<name>.md`, or say "none".
4. **An action is not done until its memory is written.**
5. ⛔ **The source `C:\Habait` is read-only to every task on this board.** Nothing is edited, moved or deleted there. Every write goes to `C:\RnD\Projects\Habait` or to this board folder.
6. ⚠ **Machine resource rules** (root `CLAUDE.md` §12): every heavy command under `timeout N`, one at a time, foreground; robocopy runs from PowerShell or `cmd //c`, never bare in Git Bash (it rewrites `/E`-style flags into paths).
