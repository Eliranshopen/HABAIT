---
name: close-task
description: "Close one task as root CLAUDE.md §0.2 asks: close its working folder if it has one (scripts/wt.py), write its memory entry, INDEX line and second-reader pointer (scripts/mem_entry.py), refresh HOT when every actor must know. Explicit only."
user-invocable: true
disable-model-invocation: true
argument-hint: "[<wt-name>]"
allowed-tools: Read, Edit, Bash, Grep
model: sonnet
---

# /close-task — a task is done when its files are back and its memory is written

Run by the main session at the end of every task (root §0.2 rule 3–4). Both scripts are dry-run by default; read the dry run, then re-run with `--go`.

## 1 · Working folder (only if the task opened one, root §8.7)
```bash
python scripts/wt.py status <wt-name>
python scripts/wt.py close <wt-name>          # dry run: lists changed / unchanged / DRIFT
python scripts/wt.py close <wt-name> --go
```
DRIFT or exit 1 → stop: a live file changed since open; reconcile by hand with Eliran. Never remove the folder (D11).

## 2 · Memory entry
Pick the layer that owns the fact: `project` (a decision of Eliran's, a proven fact), `runs` (a board or round closed), `agents` (a sub-agent's own lesson — the agent writes it), `listings`.
```bash
python scripts/mem_entry.py --layer project --file YYYY-MM-DD-<slug>.md \
  --title "<what>" --did "<one or two lines>" --evidence <path> [--evidence <path>] \
  --learned "<fact that outlives the task>" --owed "<what is open, who>" \
  --reader <agent>|none --index "<≤ 300-char pointer>"
```
then the same with `--go`. Every `--evidence` path must exist. Quote Eliran's words verbatim when the entry records his ruling. Names of secrets only.

## 3 · HOT and registers
- If every actor must know it next session → edit the matching line of `memory/HOT.md` (≤ 60 lines; replace, don't append).
- A debt opened or closed → its row in `docs/governance/OWED.md` and the current-state line.
- A plan's phase done → its row in `development/plans/CLAUDE.md`.

## Done when
`wt.py status` shows nothing open for this task, the entry and its INDEX line exist, and the reply to Eliran says what was done, what was verified and what is owed.
