---
name: rule-boards-end-with-qa
description: "Eliran 2026-11-03 — every /plan-to-tasks board ends with QA cards; the board closes only when the last QA passes (root §8.9, skill Step 16)"
metadata:
  node_type: memory
  type: feedback
  originSessionId: f5c73640-7086-4a44-b16f-bc6ebd4fa0c4
  modified: 2026-11-03T14:34:48.374Z
---

Every plan broken into tasks ends with QA cards. After the last build or copy-back card, nothing but QA comes:
- a fresh `qa-reviewer` on the result where it now lives (live files after the copy-back);
- `habait-deploy-qa` on the deployed site, filed BLOCKED until Eliran's own deploy go, never asking for one.
A board is CLOSED only when its last QA card passes.

**Why:** Eliran: "אני רוצה שהTASKS האחרונים יהיו TASK של QA … שכל פעם שיש פירוק תכנית למשימות אז יהיה בסוף גם משימות של QA". Gates on the working copy did not check the result where it actually lands.

**How to apply:** whenever running `/plan-to-tasks`, add the final QA cards before reporting, and never end a board on a "close" card. Written in root `CLAUDE.md` §8.9 and `.claude/skills/plan-to-tasks/SKILL.md` Step 16 + Rule 12. Related: [[feedback-plans-in-development-folder]], [[rule-worktree-for-every-new-thing]].
