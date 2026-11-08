# .claude/agents/ — sub-agent definitions
<!-- last-updated: 2026-11-04 -->

## What's here
One Markdown prompt-definition per sub-agent — **10 definitions** (`ls *.md` = 13, minus this context file, `_MEMORY_PREAMBLE.md` and `_TEMPLATE.md`; 18 more archived 2026-11-03). The narrative roster (charters, tool scopes, models, boundaries) is [`docs/agent-team-org-chart.md`](../../docs/agent-team-org-chart.md); this card lists the files and the rules.

Per root `CLAUDE.md` §10.2 the agent tree is one level deep: no definition here spawns a sub-agent, and none holds the `Agent` tool today (`orchestrator` is archived). Every definition that launches heavy processes carries the ⚠ Machine resource rules line (root §12).

## The files by track
| Track | Status | Files |
|---|---|---|
| `habait` — the product | live (6) | `habait-deploy-qa` · `habait-ux-judge` · `habait-brand-media` · `video-producer` · `video-editor` · `video-qa` — `habait-deploy-qa` and `habait-ux-judge` point at `Projects/Habait/habait-walkaround` and the `habait-flow` production (OWED-009, 2026-11-04); product build work goes to the 7 project agents in `Projects/Habait/.claude/agents/` |
| `harness-ops` — the harness itself | live (3) | `codebase-cartographer` · `secrets-steward` · `compliance-warden` |
| `research` | live (1) | `capability-scout` |
| archived 2026-11-03 | 18, moved to `../../archive/agents/` (plan `2026-11-03-harness-focus`) | the chat-MVP `habait-*` five, `walkaround-porter`, `workspace-steward`, the 8 visualizer, `scraper`, `walkthrough-engineer`, `render-pipeline-engineer`; restore = move back |
| meta | — | `_TEMPLATE.md` (how to author a definition) · `_MEMORY_PREAMBLE.md` (the memory block every definition carries) · this context file |

A dormant definition is still a real, spawnable agent; `/plan-to-tasks` may assign one when the plan needs that capability and says so out loud.

## The header standard — nine frontmatter keys, in this order
`name` · `description` (double-quoted, one paragraph, ends with a "Use for…" routing hint) · `model` (`sonnet` or `opus`, never `inherit`) · `tools` · `color` · `status` (`live` · `dormant` · `archived`) · `owner-track` (`habait` · `visualizer` · `agency` · `harness-ops` · `research`) · `charter` (one quoted line) · `boundary` (one quoted line, naming who takes the refused job). Labels never move files; a sixth track means editing the roster first.

## Lints — run after touching any definition
```
ls .claude/agents/*.md | wc -l                                          # N (13 on 2026-11-04)
grep -l "bounded read-first" .claude/agents/*.md | wc -l                # must equal N
grep -L "bounded read-first" .claude/agents/*.md                        # must print nothing
grep -l "^status:" .claude/agents/*.md | wc -l                          # must equal the definition count (10)
grep -c "^model: *inherit" .claude/agents/*.md | grep -v ":0$"          # must print nothing
grep -n "^description:" .claude/agents/*.md | grep -v 'description: "'  # must print nothing
grep -l "^tools:.*\bAgent\b" .claude/agents/*.md                        # must print nothing (orchestrator archived)
```
Frontmatter is strict YAML: an unquoted `description` containing `: ` fails to load and ` #` truncates it silently. The registry is read at session start — a fix shows up in the next session.

## Conventions / gotchas
- Every definition opens with the memory pointer block from `_MEMORY_PREAMBLE.md` (≤ 12 lines). It is duplicated by choice, not included: a wording change is edited in every file in the same change.
- `model:` in the file is that agent's default; a board may pin a different model at the spawn.
- Sub-agents return free text; the handoff is the artifact on disk plus its `manifest.json` row (root §10.3).
- Memory reads are bounded (root §0): `memory/HOT.md`, the tail of the agent's own file, the listing file only when named. Never `memory/INDEX.md` whole.
- `habait-agent-smith` (archived 2026-11-03) used to own this folder; the main session holds that duty now.
- The root §12 machine-rules text and this lint block each live in one place; `_TEMPLATE.md` and the definitions carry a one-line pointer, never a copy.

## Links
Parent: [../../CLAUDE.md](../../CLAUDE.md) · Roster: [../../docs/agent-team-org-chart.md](../../docs/agent-team-org-chart.md) · Memory: `memory/agents/`
