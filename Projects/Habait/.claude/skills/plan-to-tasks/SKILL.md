---
name: plan-to-tasks
description: "Turn one APPROVED plan in C:\\RnD\\development\\plans\\ into a board under C:\\RnD\\development\\tasks\\<slug>\\. Pointer: the one contract is C:\\RnD\\.claude\\skills\\plan-to-tasks\\SKILL.md. Explicit only: /plan-to-tasks <plan-path>."
argument-hint: <path-to-plan-file>
user-invocable: true
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
model: opus
---

# /plan-to-tasks — pointer to the one root contract

Since 2026-11-04 there is ONE `plan-to-tasks` (plan `C:\RnD\development\plans\2026-11-04-workflow-cleanup.md`). This copy only routes there, so a Habait session started in `C:\RnD\Projects\Habait` can still run it.

1. Read `C:\RnD\.claude\skills\plan-to-tasks\SKILL.md` in full and follow it exactly, with `$ARGUMENTS` as the plan path.
2. Paths in it are relative to `C:\RnD` (`development/plans/`, `development/tasks/`, `scripts/board_state.py`, `memory/`).
3. In this session the 7 project agents in `C:\RnD\Projects\Habait\.claude\agents\` are loaded, so a product card can name them directly (Step 1).

The previous text of this copy is kept verbatim at `C:\RnD\.claude\skills\plan-to-tasks\references\habait-copy-2026-11-04.md`.
