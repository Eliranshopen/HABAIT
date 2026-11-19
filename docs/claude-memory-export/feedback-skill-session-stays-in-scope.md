---
name: feedback-skill-session-stays-in-scope
description: "A session asked to build a skill must not touch, or offer to touch, a project — 2026-11-18"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 19ae0004-ecc4-4541-a0fd-839a98d55670
  modified: 2026-11-18T18:17:34.404Z
---

When the Day/Night session offered «להעביר לפרויקט חי» as the next step, the reply was «למה אתה נוגע בפרויקט? התפקיד שלך היה רק ליצור סקיל» (2026-11-18).

**Why:** projects belong to their own sessions (Hatzav, Kedma, AHK B10 each have one); a skill session that reaches into them, even only by proposing to, crosses lanes.

**How to apply:** a skill session reads reference projects read-only and writes only in its own research folder and in `.claude/skills/<skill>/`. When the skill is done, say it is done and stop. Do not offer a port into a project, a project re-bake or project tuning as a next step. Related: [[project-day-night-reverse-engineering]].
