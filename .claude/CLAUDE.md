# .claude/ — the Claude Code configuration tree
<!-- last-updated: 2026-11-04 -->

## What's here
Everything Claude Code reads to run this department: the sub-agent definitions, the skills, and the local settings. No product code lives here. The root `CLAUDE.md` (one level up) is the contract; this folder is the machinery that executes it.

## Key files
| File | Purpose |
|---|---|
| `settings.json` | project Claude Code settings (2026-11-03): `"plansDirectory": "development/plans"`, so plan mode writes every plan into `development/plans/` (root §8.8); `permissions.deny` blocks reading `.env` / `.env.*` (the `Bash(git:*)` deny was removed 2026-11-04 on Eliran's go). Read at session start |
| `settings.local.json` | per-checkout Claude Code settings. Today: one skill override (`anthropic-skills:skill-creator` → name-only). Hooks are added here once Eliran installs them (`docs/OWNER-PASTE.md` §b); no agent edits this file |

## Subfolders
| Folder | Card | Purpose |
|---|---|---|
| `agents/` | [`agents/CLAUDE.md`](agents/CLAUDE.md) | 10 sub-agent definitions, all live (18 archived to `../archive/agents/` 2026-11-03), the nine-key header standard, the lints |
| `skills/` | [`skills/CLAUDE.md`](skills/CLAUDE.md) | 36 skills, each its own `SKILL.md`; 15 explicit-only, 21 auto-trigger (`imagegen-frontend-mobile`, `mobile-responsive`, `responsive-design` installed 2026-11-04) (22 archived to `../archive/skills/` 2026-11-03, `frontend-design` 2026-11-04 — the plugin copy wins) |
| `hooks/` | [`hooks/CLAUDE.md`](hooks/CLAUDE.md) | the guard hooks `subagent-context.ps1`, `test-guard.ps1`, `agent-model-guard.ps1` — authored 2026-11-04, **not installed** until Eliran pastes `docs/OWNER-PASTE.md` §b (OWED-003) |

## Conventions / gotchas
- The agent registry and the skill list are read at **session start**; a fix to a definition shows up in the next session.
- `skills/improve-codebase-architecture`, `codebase-design` and `domain-modeling` were installed 2026-11-03 from `mattpocock/skills` as real-folder copies (`--copy`, no junction); OWED-004 resolved.
- Local git on `main` (Eliran, 2026-11-04). Edit these files in place: harness files never get a working folder; `.wt\` is for project changes only (root §8.7). A session reads the registry of `C:\RnD` at its start.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md)
