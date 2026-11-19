---
name: feedback-stage-own-lines-only
description: "In shared files (memory/INDEX.md etc.) stage only your own lines, never the whole file with other sessions' uncommitted edits"
metadata:
  node_type: memory
  type: feedback
  originSessionId: bf387f38-6eee-4def-a2b7-39554f497b4b
  modified: 2026-11-06T07:57:57.820Z
---

When committing to a shared file like `memory/INDEX.md` on main, stage only the lines you added (`git add -p`, or apply a patch that holds only those lines to the index), never `git add <file>` when the file already has someone else's uncommitted edits.

**Why:** on 2026-11-06 fork F committed e740475 with `git add memory/INDEX.md` and swept in edits that other sessions had left uncommitted on main. The coordinator flagged it: "Don't stage whole shared files next time: stage only your own lines."

**How to apply:** before `git add` on a shared file, run `git diff <file>`. If it shows lines that aren't yours, stage only your hunk (a `git apply --cached` patch holding just your line). Related: [[rule-worktree-for-every-new-thing]].
