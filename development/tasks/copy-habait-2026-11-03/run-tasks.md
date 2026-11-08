# How to run this board
<!-- created: 2026-11-03 -->

1. Read `README.md` here and the plan. Update **Key state** before each burst.
2. **Burst 1:** spawn `workspace-steward` with task 01 (sonnet). When it returns, run task 02 yourself: one AskUserQuestion with the five questions, defaults first; record the answers in the task file and `exclude.txt`.
3. **Burst 2:** spawn `habait-asset-wrangler` with task 03. Show Eliran the dry-run total before the real pass if it is off by > 20 %.
4. **Burst 3:** spawn a FRESH `workspace-steward` with task 04 (prompt it to refute, not confirm) and `secrets-steward` with task 05 in parallel. The gate is 04: five PASS or back to 03.
5. **Burst 4:** `codebase-cartographer` with task 06 and `habait-asset-wrangler` with task 07 in parallel (different write targets).
6. **Burst 5:** task 08 — cartographer for the cards, you for memory and OWED.
7. **Burst 6:** only on Eliran's word: task 09.

## Post-task checklist (every card)
- The agent's memory entry exists (`memory/agents/<name>.md`) and its INDEX line is appended.
- The card's State cell in README is updated with the time and the evidence path.
- Nothing under `C:\Habait` changed: `git -C C:/Habait/habait-walkaround status --porcelain | wc -l` is the same number as task 01 recorded (until cut-over).
- Every heavy command ran under `timeout`, one at a time.
