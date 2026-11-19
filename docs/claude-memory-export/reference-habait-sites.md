---
name: reference-habait-sites
description: "Which URL is which Habait site — the platform's production is habait-flow.vercel.app, NOT habait.ai"
metadata:
  node_type: memory
  type: reference
  originSessionId: 6683ba3a-fb19-404a-b004-9f31015522b3
  modified: 2026-11-04T09:04:48.288Z
---

- **Platform (home, landing, apartment, /hold/, /tour/)**: Vercel project `habait-flow`, team `eliran-5390`, production https://habait-flow.vercel.app. Built by `Projects/Habait/tools/deploy-vercel/stage_flow.py` (stages the 846 dist and, since 2026-11-04, the cine clips that flow.cine.json references).
- **habait.ai** = a separate marketing site ("the AI platform for real estate"). www.habait.ai 308 → habait.ai. **app.habait.ai** = the agent app (307 → /login). Never deploy the platform there.
- I once told Eliran "I'll upload to habait.ai" — wrong; corrected before the deploy (2026-11-04).
- Every prod deploy needs Eliran's own go. Since 2026-11-04 (Eliran: "אני לא רוצה ששום בדיקת בטיחות תעצור אותך תריץ אתה") I run the deploy myself after his go, not a `!` handoff: stage from live (`stage_flow.py <new folder>`), diff vs the last deployed stage, copy `.vercel/project.json` from the last stage (no `vercel link` → no keys file), `npx vercel@65.9.0 deploy --prod --yes --scope eliran-5390`. First run: dpl_3avVrzv8zeGVMjMifW2bYbz9KQsZ. Check with the other sessions first: one stage from live, one deploy. Written into root CLAUDE.md §8.2 and INHERITED-DECISIONS on his "כן" (2026-11-04); deletes still go to him as a `!` command.
