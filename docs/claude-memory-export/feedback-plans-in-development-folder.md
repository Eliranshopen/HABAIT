---
name: feedback-plans-in-development-folder
description: "Eliran expects every plan to be visible as a file in C:\\RnD\\development\\plans\\YYYY-MM-DD-<slug>.md as soon as it is written, not only in Claude Code's private plan file (2026-11-03)."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 689e5e0d-c957-404d-94a8-b8dcfadbb8b2
  modified: 2026-11-03T13:25:47.676Z
---

On 2026-11-03 Eliran asked twice why he didn't see the plan under `C:\RnD\development\plans`. Plan mode had written it only to `~/.claude/plans/<random>.md`. Given the choice, he picked "exit plan mode, only save the plan, don't execute".

**Why:** the department's plans folder is where he reads and judges a plan. A plan he can't find there doesn't exist for him.

Later the same day he made it a standing rule: "every plan that we are creating has to be in the plans folder in the development folder … from now on" → root `CLAUDE.md` §8.8, plus `"plansDirectory": "development/plans"` in `C:\RnD\.claude\settings.json` so plan mode writes there (random file name — rename to the dated slug).

**How to apply:**
- Write a plan to `C:\RnD\development\plans\YYYY-MM-DD-<slug>.md` and add its row to that folder's `CLAUDE.md` table. If plan mode blocks the write, say so plainly and offer "save the plan only" before asking for approval.
- Don't stack ExitPlanMode prompts while he is still asking questions.
- Language: on 2026-11-03 he asked "תכתוב באנגלית ובקצרה", so reply in English and keep it short, even when he writes in Hebrew.

See [[feedback-research-before-ux-work]] and [[rule-worktree-for-every-new-thing]].
