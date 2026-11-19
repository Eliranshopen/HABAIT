---
name: feedback-status-against-the-plan
description: "Eliran 2026-11-17 — every status must say which milestone and which step of the plan document I am on and what is finished against it; internal details (QA round numbers, contract sections, test hooks) do not tell him that"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 40c3c5f2-e1ea-4dd3-baf1-ad71447227fd
  modified: 2026-11-17T06:55:22.932Z
---

Eliran, 2026-11-17, during the close of engine milestone 0.3 (after an hour of my updates about "QA round 8", "contract section 17", "test clean-up"): «אני אגיד לך מה אני מפספס אני לא מצליח להבין על איזה משימה אתה עובד ומה סיימת אל מול המסמך».

**Why:** he follows the work through the plan document (the `.html` page in `development/plans/`), whose units are the milestones (0.1 → 7.5) and the per-milestone steps he set (plan to tasks → develop → tests → coverage ≥ 80 % → sync-context). My updates named internal things that are not in that document, so he could not place them.

**How to apply (my reading of it):**
- Start every update with the milestone number and name as the plan has them, and the step of his gate I am in: «אבן דרך 0.3 · שלב: סגירה».
- When he asks where things stand, or after a long stretch of work: a short table against the document — closed / now / next, and inside the current milestone which of his steps are done.
- Say an internal detail only as the reason for a delay, in one plain sentence, never as the headline.
- Keep the plan page itself true: at every milestone close its "where we are" strip and milestone chips are updated on disk; open or publish it for him sparingly (a milestone close, or his ask) — see [[feedback-focused-decision-pages]].

Related: [[project-engine-mcp-plan]], [[feedback-delegated-harness-calls]].
