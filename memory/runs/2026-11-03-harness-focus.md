## 2026-11-03 · main session · harness focus, phase 1
- **Did:** 18 agents + 22 skills archived (moved), settings deny rules for git and `.env`, registers and context files updated; plan `development/plans/2026-11-03-harness-focus.md`.
- **Evidence:** the plan; `archive/CLAUDE.md`; `.claude/settings.json`; `docs/agent-team-org-chart.md`; `docs/skill-taxonomy.md`.
- **Learned:** Claude Code loads only `.claude/`; moving a definition out is a reversible way to shrink session context.
- **Owed / open:** phases 2–3 of the plan (main session).
- **Second reader:** `codebase-cartographer`.

## 2026-11-03 · main session · harness focus, phase 3
- **Did:** scripts/wt.py (open, add, status, close; refuses drift and paths held by another open folder) and scripts/mem_entry.py (entry + INDEX line + second-reader pointer; refuses missing evidence and secret-shaped text) written; /close-task skill drives both; SessionStart HOT hook drafted in docs/OWNER-PASTE.md for Eliran to install.
- **Evidence:** `scripts/wt.py` · `scripts/mem_entry.py` · `.claude/skills/close-task/SKILL.md` · `docs/OWNER-PASTE.md`
- **Learned:** Both scripts were hand-run first (.wt/harness-focus) then tested on a scratch root: dry run, open, refused reopen, held-elsewhere, add, drift refusal, close, bad evidence, secret refusal; a cp1255 console needs stdout reconfigured to UTF-8.
- **Owed / open:** OWED-018 frontmatter pass; OWED-009 paths of habait-deploy-qa and habait-ux-judge; Eliran pastes the HOT hook (OWED-003). Main session / Eliran.
- **Second reader:** `codebase-cartographer`
