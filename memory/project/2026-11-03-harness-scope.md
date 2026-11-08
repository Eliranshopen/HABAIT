## 2026-11-03 · main session · Eliran's ruling: harness scope = habait-walkaround + Video
- **Did:** Eliran chose the scope the harness serves from now on: the `habait-walkaround` product (Blender plan → 360 tour) and the Video Division. Out of scope: the chat+canvas MVP (`Habait/MVP/app`), the visualizer track (D1) and the agency track (D2). Ruling given in chat, answering the main session's harness review ("habait-walkaround + וידאו").
- **Evidence:** this session's chat; the diagnosis behind it: `docs/agent-team-org-chart.md` (12 `habait-*` agents on a nonexistent path), `docs/governance/OWED.md` OWED-009, OWED-014.
- **Learned:** the out-of-scope agents and skills are to be archived (moved out of `.claude/`, never deleted, D11); the exact move list is not yet ruled and needs its own plan in `development/plans/` and Eliran's go.
- **Owed / open:** a plan for the archive move + re-pointing the team to `Projects/Habait/.claude/agents/` (resolves OWED-009); D1/D2 rows in `docs/INHERITED-DECISIONS.md` updated when the move happens. Main session.
- **Second reader:** none yet — the agents learn it from the plan that moves them.

## 2026-11-03 · main session · harness focus executed (phase 1) on Eliran's delegation
- **Did:** Eliran handed the calls over ("אני רוצה שתחשוב ותקבל את ההחלטה הטובה ביותר עבור הHARNESS"). Decisions H1–H7 in the plan; phase 1 done: 18 agents and 22 skills moved to `archive/` (not deleted); `.claude/settings.json` denies `Bash(git:*)`, `Read(**/.env)`, `Read(**/.env.*)`; department memory binds every session (H5, OWED-014); answer Eliran in the language he writes in (H6, OWED-015); roster, register, INHERITED-DECISIONS (D1, D2, D-AUD-29/30, B-15), root and `.claude` context files updated; `archive/` context files written.
- **Evidence:** `development/plans/2026-11-03-harness-focus.md`; `ls .claude/agents` = 10 definitions, `ls -d .claude/skills/*/` = 32; `archive/agents` 18, `archive/skills` 22; `.claude/settings.json`.
- **Learned:** product build work belongs to the 7 project agents in `Projects/Habait/.claude/agents/`; the harness keeps ops, QA, video and deploy agents only. The deny rules take effect next session.
- **Owed / open:** phase 2 — `Projects/Habait/CLAUDE.md` memory protocol (H5) and language line (H6) through `.wt\harness-focus`; phase 3 — `/close-task` + `wt.py` scripts, OWED-018 frontmatter pass, SessionStart HOT hook draft. `generate-cards.py --apply` left for the next `/sync-context` (7 missing are other sessions' new folders). Main session.
- **Second reader:** `codebase-cartographer` — the context map and roster changed shape; pointer added to its file.

## 2026-11-03 · main session · harness focus phase 2 (project files, `.wt\harness-focus`)
- **Did:** re-pointed the Habait memory protocol to the department memory: `Projects/Habait/CLAUDE.md` (start = HOT + SESSIONS, `memory.md` grep-only, writes go to `C:\RnD\memory\project\`, language line), a frozen banner atop `memory.md`, and the pasted memory contract in `docs/_memory_preamble.txt` + the 7 project agents. OWED-014 and OWED-015 resolved.
- **Evidence:** `C:\RnD\.wt\harness-focus\manifest.json` (11 files, every live hash equal at open, `sha256_at_close` recorded); `C:\RnD\Projects\CLAUDE.md`.
- **Learned:** the project memory rule lived in 10 places (CLAUDE.md, memory.md's own header, the preamble and its 7 pasted copies); a rule change must patch every copy. `SESSIONS.md` mentions of `memory.md` are history rows, left as they are.
- **Owed / open:** phase 3 of the plan (scripts, OWED-018, hook draft); `habait-deploy-qa` / `habait-ux-judge` paths (OWED-009). Main session.
- **Second reader:** the Habait sessions — they read the new protocol from `Projects/Habait/CLAUDE.md` at their next start; none needs a pointer line.
