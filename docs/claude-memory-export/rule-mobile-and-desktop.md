---
name: rule-mobile-and-desktop
description: Eliran 2026-11-05 — every update must work on mobile as well as desktop; verify both before shipping
metadata:
  node_type: memory
  type: feedback
  originSessionId: bf387f38-6eee-4def-a2b7-39554f497b4b
  modified: 2026-11-05T12:03:28.558Z
---

Every change shipped to any Habait surface (the Rainbow site, the 360 tour, the building page, the developer portal, every portal-generated project) must fit and work on mobile as well as desktop. Eliran: «כל דבר שאתה מעדכן חייב להתאים גם לגרסת המובייל בנוסף לגרסת הדסקטופ».

**Why:** buyers and developers open these pages on phones. Earlier he flagged the phone UI as cramped ("הכל אחד על השני וממש צפוף").

**Enforced in code** (Eliran: «וזה כלל שחייב להיות בלוגיקה בקוד»). A single checker, `Habait/tools/qa/responsive-gate.mjs` (fork F, 2026-11-05), runs at 1440 and 390 and blocks two things: publishing a portal project, and a habait-flow deploy (the predeploy step in stage_flow / `tools/deploy-vercel/predeploy.mjs`). A FAIL refuses; never weaken the gate to pass.

**How to apply:** before any deploy, verify in headless Chrome at desktop 1440 and phone 390. Check paint, no horizontal overflow (RTL overflows LEFT, so measure both sides), 44 px touch targets, and no control covering the content. Put both screenshots in the evidence. Every agent brief that touches UI says so. The portal-generated project pages and tours get the same check, inside the runner's own QA. Related: [[rule-portal-autonomous]], [[rule-sales-plan-fidelity]].
