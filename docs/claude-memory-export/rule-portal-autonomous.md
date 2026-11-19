---
name: rule-portal-autonomous
description: "Eliran 2026-11-05 — the developer portal must be fully autonomous; uploaded plans are acceptance tests (846 PDF must reproduce the hand Rainbow result); habait-flow is the session's own responsibility"
metadata:
  node_type: memory
  type: feedback
  originSessionId: bf387f38-6eee-4def-a2b7-39554f497b4b
  modified: 2026-11-05T12:04:01.923Z
---

The developer portal (habait-flow /studio) must run on its own, end to end. Never offer "Habait fixes it by hand" as the plan for a portal job. The review queue is only a safety net that should never fire.

**Why:** Eliran: «הפורטל צריך להיות עצמאי». The sales plans he uploads (the 846 PDF, the Maale Efraim brochure) are only tests that the automatic result equals the hand result made for Rainbow apt846.

**How to apply:** the portal acceptance test is the 846 PDF uploaded through the portal. Its automatic trace and tour must match the hand apt846 result room by room. Report progress against that metric, never "we'll fix it manually". The portal must run on the SAME final code and logic that produced the fixed Rainbow result (skin, fidelity gate, fix loop, consistency check, finishes, rings, build). Anything Rainbow-specific becomes per-project data, never a second code path. Every rule set on Rainbow binds the portal too: ≤1–2% fidelity per room, and cross-scene consistency for every element seen from more than one scene (Eliran 2026-11-05: «זה כלל שצריך להיות גם בתוצאות מהפורטל»). Eliran 2026-11-05: «כל אותם דברים שאנחנו עושים על RAINBOW, הפורטל צריך לדעת לעשות לבד». This is enforced as a parity registry in PROJECT-PACKAGE.md: each rule maps to a shared module and a runner step, and `run-project.mjs --parity` fails when a row is missing. Every Rainbow change adds its row in the same change. Separately, the live Rainbow site (building film + 360 tour at habait-flow.vercel.app) is entirely the session's responsibility to get right, independent of the portal. Related: [[rule-sales-plan-fidelity]].
