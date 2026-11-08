# archive/ — out-of-scope agents and skills
<!-- last-updated: 2026-11-03 -->

## What's here
Agents and skills moved out of `.claude/` on 2026-11-03 so Claude Code stops loading them; nothing was deleted (D11). Why and the full list: `development/plans/2026-11-03-harness-focus.md` (scope = habait-walkaround + Video, Eliran 2026-11-03).

| Folder | Holds |
|---|---|
| `agents/` | 18 agent definitions: chat-MVP `habait-*`, visualizer, agency, walkthrough/render engineers, `walkaround-porter`, `workspace-steward` |
| `skills/` | 23 skill folders: groups A, B, E, `analyze-plan`, `worktree-ops`, `run-eval`, `test-bounded`, `write-swift`, `animate-expo`, `grill-me`; `frontend-design` (2026-11-04, OWED-007: the installed plugin copy wins) |

## Conventions / gotchas
- **Restore = move the file or folder back** into `.claude/agents/` or `.claude/skills/`, then update `docs/agent-team-org-chart.md` / `docs/skill-taxonomy.md`. Takes effect next session.
- Text here is history: paths and rulings inside may be stale (`Habait/MVP/app`, git steps). Never run a script from here without re-checking it.
- Removal from disk is Eliran's act only.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md) · Plan: [../development/plans/2026-11-03-harness-focus.md](../development/plans/2026-11-03-harness-focus.md)
