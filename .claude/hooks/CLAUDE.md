# .claude/hooks/ — the harness guard hooks (authored, not installed)
<!-- last-updated: 2026-11-04 -->

## What's here
The three guard hooks the harness cites, re-authored 2026-11-04 (OWED-003, plan `development/plans/2026-11-04-owed-cleanup.md`). **Status: UNINSTALLED.** A script in this folder does nothing until Eliran pastes the settings block in `docs/OWNER-PASTE.md` §b into `C:\RnD\.claude\settings.local.json` (no agent edits that file). Every rule below applies only once installed; until then the root `CLAUDE.md` lines are the only bind.

| File | Event · matcher | Rule (once installed) | Blocks how |
|---|---|---|---|
| `subagent-context.ps1` | SubagentStart · every agent type | root §0.2 rule 1: puts the bounded read-first slice into the sub-agent's context at spawn — `memory/HOT.md`, then the last ~150 lines of `memory/agents/<agent_type>.md` plus its archive-index block (`orchestrator` → `orchestrator-lessons.md`; a missing file → the first-run instruction). Never `INDEX.md`, never a whole layer | cannot block; JSON `hookSpecificOutput.additionalContext` on stdout |
| `test-guard.ps1` | PreToolUse · `Bash` | root §12: a test, build/typecheck, server, browser or render command must run as `timeout N <cmd>`, with the Bash tool timeout above N, in the foreground (no `run_in_background`, no trailing `&`) | exit 2, reason on stderr |
| `agent-model-guard.ps1` | PreToolUse · `Agent\|Task` | root §10.4: a spawn whose model resolves to `inherit` is denied (tool `model` → definition `model:` → `CLAUDE_CODE_SUBAGENT_MODEL` → inherit; `fork` exempt). Root §10.2 / D-AUD-36: the sixth `Agent` launch inside sixty seconds from one session is denied | exit 2, reason on stderr |
| SessionStart (inline `python -c`, no file here) | SessionStart | prints `memory/HOT.md` into every main session (drafted 2026-11-03) | cannot block |
| `CLAUDE.md` | — | this context file | — |

## Conventions / gotchas
- **Windows PowerShell 5.1, UTF-8 with BOM** (`EF BB BF`) for every `.ps1` here; bodies are ASCII. Check: `head -c3 <file> | od -An -tx1` → `ef bb bf`.
- **Fail open.** Any internal error (unparseable stdin, missing file, exception) → exit 0 with no output: a broken hook must never block all work.
- **Input** is Claude Code's hook JSON on stdin (`tool_name`, `tool_input`, `session_id`, `cwd`; SubagentStart adds `agent_type`, `agent_id`). Docs: code.claude.com/docs/en/hooks.
- **Hook output cap**: Claude Code caps `additionalContext` at 10,000 chars. `subagent-context.ps1` holds the slice under 9,000 — the agent slice first (≤ 4,000), `HOT.md` the rest, cut at a line boundary with the line range to read named. `HOT.md` is 10.6 KB on 2026-11-04, so today it is always cut.
- `test-guard.ps1` reads only the command, never quoted text or heredoc bodies (`grep "npm run build"` passes); it looks inside `bash -c` / `sh -c` with the outer `timeout` carried in. It does not see the `PowerShell` tool, and "one heavy run at a time" is covered only as "foreground only" — no cross-session lock.
- `agent-model-guard.ps1` keeps launch stamps in `%TEMP%\rnd-hooks\agent-spawns-<session_id>.txt` (outside the repo). Built-ins with no definition on disk other than `general-purpose` / `Plan` (e.g. `Explore`, plugin agents) pass: their model is not knowable here.
- `.claude/skills/sync-context/metrics.mjs` [8] times `test-guard.ps1` with `{"tool_name":"Bash","tool_input":{"command":"echo metrics-probe"}}` on stdin: exit 0, ~470 ms on 2026-11-04. Its [9] exit-124 count reads no log; this folder writes none.
- Install, remove or change = Eliran's paste (`docs/OWNER-PASTE.md` §b); then `check-context.mjs` Check 8 sees the names in `settings.local.json`.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md) · Root: [../../CLAUDE.md](../../CLAUDE.md) §0.2, §10, §12 · Install: [`docs/OWNER-PASTE.md`](../../docs/OWNER-PASTE.md) §b · Debt: `docs/governance/OWED.md` OWED-003
