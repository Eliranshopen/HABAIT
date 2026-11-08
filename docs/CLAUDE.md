# docs/ — the department's reference documents
<!-- last-updated: 2026-11-04 -->

## What's here
The documents that agents and skills cite by path: the inherited rulings, the agent roster, the skill register, the file of installs only Eliran runs, and (in `governance/`) the live registers. Product documents (`Projects/Habait/`, `video/`) live with their product, not here.

## Key files
| File | Purpose | Kept by |
|---|---|---|
| `INHERITED-DECISIONS.md` | the one log of rulings inherited from the previous CTO on 2026-11-03 — every row is Eliran's to keep, change or strike; prompts cite the codes (D8, D11, D14, D-VID-1…4, R-ORG, D-AUD…) | Eliran; edited together with every prompt that cites the changed code |
| `agent-team-org-chart.md` | the roster: one row per sub-agent from its frontmatter (track, status, model, tools, charter) + counts | **generated** from `.claude/agents/*.md` — regenerate, don't hand-edit the table |
| `skill-taxonomy.md` | the skill register: group, invocation mode, lines, trigger sentence; §3 what the harness-ops skills need; §4 precedence; §5 pins | **generated** from `.claude/skills/*/SKILL.md` |
| `OWNER-PASTE.md` | the MCP servers, hooks and plugin updates only Eliran installs — agents write the command here and stop | agents append; Eliran executes |
| `context-map.generated.md` | every `CLAUDE.md` on disk, one row each (folder, kind, purpose) — the full list behind the root Context map (root §8.6) | **generated** by `.claude/skills/sync-context/generate-cards.py --apply` |

## Subfolders
| Folder | Card | Purpose |
|---|---|---|
| `governance/` | [`governance/CLAUDE.md`](governance/CLAUDE.md) | the registers: `SECRETS-LEDGER`, `OWED` and `SHIP-LEDGER` (since 2026-11-04) live; `WORKTREES` frozen until re-pointed to the product git worktrees |

## Conventions / gotchas
- A document cited by an agent that is **not** here was not transferred from the previous harness (`harness-upgrade-plan.md`, `skill-taxonomy.md` §-numbers of the old one, `CARD-LOG`, `CONTEXT-FILE-STANDARD.md`): the agent says so and continues with root `CLAUDE.md`.
- Generated files carry a generated marker in their first three lines; edit their generator inputs (the frontmatter), then regenerate.

## Root layout table (root §1)
(Moved from root `CLAUDE.md` on 2026-11-04, wording unchanged.)

| Path | What | State 2026-11-03 |
|---|---|---|
| `CLAUDE.md` | this card — the contract every session and sub-agent inherits | live |
| `.claude/agents/` | 10 sub-agent definitions + context file, template, memory preamble | live (10 live; 18 archived) |
| `.claude/skills/` | 34 skills + context file | live (22 auto-trigger · 12 explicit `/name`; 22 archived) |
| `scripts/` | `wt.py` (working folders, §8.7) · `mem_entry.py` (memory entries, §0.2) — driven by `/close-task` | live since 2026-11-03 |
| `archive/` | out-of-scope agents and skills, moved not deleted (plan `2026-11-03-harness-focus`); restore = move back | live since 2026-11-03 |
| `docs/` | `INHERITED-DECISIONS.md` · `agent-team-org-chart.md` (roster) · `skill-taxonomy.md` (register) · `OWNER-PASTE.md` (installs only Eliran runs) · `governance/` (the registers) | scaffolded |
| `memory/` | the collective memory (§0) | scaffolded, first entries written |
| `development/` | `plans/` (every plan file — the only place a plan lives, §8.8) · `tasks/` (boards: one card per agent task) | first board filed 2026-11-03 |
| `Projects/` | the product projects, each in its own folder with its own context file | `Habait/` — the live Habait project since the 2026-11-03 cut-over (30.4 GB, verified twice); `C:\Habait-archive-2026-11-03` is the frozen old copy |
| `Habait/MVP/` | where the 12 `habait-*` agents expect the product | **not created** — the real product is `Projects/Habait/habait-walkaround/` once copied; re-pointing the agents is `OWED-009` |
| `video/` | the Video Division (`/video-division`) | not created yet |
| `listings/<id>/` | per-listing workspaces of the visualizer pipeline (§4) | not created yet (track dormant) |
| `3D/`, `360walkaround/` | the walkthrough labs | not created yet (tracks dormant) |
| `.wt/` | the working folders — one per project change or update Eliran opens (never for harness work, not per fix), a new feature = a git worktree of `C:\RnD` (one repo since 2026-11-04) on its own branch; older folders are plain copies with a hash manifest (§8.7) | live since 2026-11-03 |
| `.vscode/` | VS Code settings for this folder: hides `.git`, keeps `.wt/` out of search; git integration on since 2026-11-04 (§8.7) | live since 2026-11-03 |
| `.claude/hooks/` | the guard hooks (3 + SessionStart) | authored 2026-11-04, not installed (`docs/OWNER-PASTE.md` §b) |
| `screenshots/` | two loose screenshots from before 2026-11-03 (`1.png`, a habait-flow capture; `Platform UI.jpg`) | kept; keep-or-delete is Eliran's open call |

## Links
Parent: [../CLAUDE.md](../CLAUDE.md) · Memory: `memory/project/`
