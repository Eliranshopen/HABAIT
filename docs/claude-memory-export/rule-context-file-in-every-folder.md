---
name: rule-context-file-in-every-folder
description: "Eliran's standing rule (2026-11-03): every folder in C:\\RnD, harness and all projects, present and future, carries a CLAUDE.md; only vendor/build output is exempt. Also: say 'context file', not 'card'."
metadata:
  type: feedback
---

On 2026-11-03 Eliran ruled: "create md for each file we have and will be in the future" — a `CLAUDE.md` in every folder of `C:\RnD`, the harness and every project (all 899 folders at the time), exempting only vendor and build output (`node_modules`, `.git`, `__pycache__`, venvs, the Blender bundle, `dist`, `build`, `.next`, `.cache`). Recorded as root `CLAUDE.md` §8.6.

**Why:** they want every folder self-describing for any session that lands in it, and the rule to apply to folders created later, not just today's.

**How to apply:** when creating a folder, write its `CLAUDE.md` in the same change. `python .claude/skills/sync-context/generate-cards.py --check` lists folders without one; `--apply` writes facts-only files (never overwrites hand-written ones) and `docs/context-map.generated.md`. Fill the Purpose line from the folder's contents, never invent. Eliran did not know the word "card" for these files — call them context files or md files. See [[rnd-harness-takeover-2026-11-03]].
