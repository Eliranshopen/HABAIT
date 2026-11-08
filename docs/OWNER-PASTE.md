# OWNER-PASTE — the installs only Eliran runs
<!-- created: 2026-11-03 · owner: Eliran Shopen -->

Agents and skills never install MCP servers, hooks or plugins and never set a git identity: those are per-machine or per-account acts. An agent that needs one writes the exact command **here**, under the right section, and stops. Eliran pastes it (the `!` prefix runs a command inside a session) and ticks the row.

## §a MCP servers (per-machine `~/.claude.json`, never the repo)
| Server | Needed by | Command | State |
|---|---|---|---|
| 21st.dev | the seven `21st-*` skills | _(write when the keep decision is made — OWED-006)_ | not registered |
| refero | `refero-design` | _(optional; the skill works without it)_ | not registered |
| HeyGen (official remote MCP, OAuth, no key in `.env`) | `/video-division` avatar/dubbing lane (D-VID-4) | _(write when the Video Division is opened)_ | not registered |
| fal.ai MCP | `/video-division`, `habait-brand-media` | _(same)_ | not registered |

## §b Hooks (`.claude/hooks/`, then `.claude/settings.local.json`)
| Hook | Event | Rule (once installed) | State |
|---|---|---|---|
| HOT at session start (inline `python -c`, no script file) | SessionStart | puts `memory/HOT.md` into every session's context, so read-first no longer depends on the agent remembering (plan `development/plans/2026-11-03-harness-focus.md` phase 3) | DRAFTED 2026-11-03 — UNINSTALLED, Eliran pastes the block below |
| `.claude/hooks/subagent-context.ps1` | SubagentStart | root §0.2 rule 1: the bounded read-first slice at spawn — `memory/HOT.md` + the last ~150 lines of `memory/agents/<name>.md` and its archive-index block, held under the 10,000-char hook cap | AUTHORED 2026-11-04 (OWED-003) — UNINSTALLED |
| `.claude/hooks/test-guard.ps1` | PreToolUse (`Bash`) | root §12: a test/build/server/browser/render command runs as `timeout N <cmd>`, tool timeout above N, foreground only; otherwise exit 2 | AUTHORED 2026-11-04 (OWED-003) — UNINSTALLED |
| `.claude/hooks/agent-model-guard.ps1` | PreToolUse (`Agent\|Task`) | root §10.4: a spawn whose model resolves to `inherit` is denied; root §10.2 / D-AUD-36: the sixth `Agent` launch inside sixty seconds from one session is denied | AUTHORED 2026-11-04 (OWED-003) — UNINSTALLED |

Rules, tests and gotchas per hook: [`.claude/hooks/CLAUDE.md`](../.claude/hooks/CLAUDE.md).

**Where it goes:** this is the whole of `C:\RnD\.claude\settings.local.json` after the paste — replace that file's content with the block (it held only `skillOverrides` on 2026-11-04; keep any key added since). Not `settings.json`: `check-context.mjs` Check 8 reads the hooks from `settings.local.json`. Takes effect at the next session start.
```json
{
  "skillOverrides": {
    "anthropic-skills:skill-creator": "name-only"
  },
  "hooks": {
    "SessionStart": [
      { "hooks": [ { "type": "command", "command": "python -c \"import sys; sys.stdout.reconfigure(encoding='utf-8'); print(open(r'C:/RnD/memory/HOT.md', encoding='utf-8').read())\"" } ] }
    ],
    "SubagentStart": [
      { "hooks": [ { "type": "command", "command": "powershell -NoProfile -ExecutionPolicy Bypass -File C:/RnD/.claude/hooks/subagent-context.ps1", "timeout": 15 } ] }
    ],
    "PreToolUse": [
      { "matcher": "Bash", "hooks": [ { "type": "command", "command": "powershell -NoProfile -ExecutionPolicy Bypass -File C:/RnD/.claude/hooks/test-guard.ps1", "timeout": 15 } ] },
      { "matcher": "Agent|Task", "hooks": [ { "type": "command", "command": "powershell -NoProfile -ExecutionPolicy Bypass -File C:/RnD/.claude/hooks/agent-model-guard.ps1", "timeout": 15 } ] }
    ]
  }
}
```
⚠ The SessionStart line is the 2026-11-03 draft, kept as written. Claude Code caps a hook's plain stdout at 10,000 chars and replaces anything longer with a file path and a 2,000-char preview; `memory/HOT.md` is 10.6 KB on 2026-11-04, so either `HOT.md` is brought under ~9,500 chars or this line is changed to cut it (owed to the main session).

## §c Plugin updates (user scope)
| Plugin | Note | State |
|---|---|---|
| `hyperframes:*` | the division's copies under `video/.claude/skills/` win until the user-scope plugin is current | n/a until `video/` exists |

## §d Git identity and repos (root `CLAUDE.md` §11)
**Local git on `main` since 2026-11-04** (Eliran). No identity or remote is set up yet; this section waits for Eliran to choose them.
