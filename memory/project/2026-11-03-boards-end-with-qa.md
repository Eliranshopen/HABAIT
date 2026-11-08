
## 2026-11-03 · main session rnd-ed · Eliran: every board ends with QA cards (root 8.9)
- **Did:** Eliran ruled that every plan-to-tasks breakdown ends with QA cards. Written to root CLAUDE.md 8.9, plan-to-tasks Step 16 and Rule 12, development/tasks/CLAUDE.md conventions. Applied to board platform-ui-ux: card 20 is now copy-back only; added 21 (fresh qa-reviewer on the live repo) and 22 (habait-deploy-qa on the deployed site, blocked on the deploy go).
- **Evidence:** `CLAUDE.md` · `.claude/skills/plan-to-tasks/SKILL.md` · `development/tasks/platform-ui-ux/task-21-qa-live.md`
- **Learned:** A board is CLOSED only when its last QA card passes. Gates on the working copy are not enough; the final QA checks the result where it lives (live files, then the deployed URL). The deploy QA card never asks for a deploy.
- **Owed / open:** Board apartment-3d was filed before the rule and ends with its close card (10); adding a final QA card is rnd-fd's or Eliran's call.
- **Second reader:** none
