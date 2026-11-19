---
name: feedback-cost-time-report-and-no-generation
description: "Eliran 2026-11-17 — at a project's end report credits per tool/model and total build time; for apartment visuals he supplies the pictures, never generate; wants interactive 3D walkarounds, not 360 panoramas"
metadata:
  node_type: memory
  type: feedback
  originSessionId: a826489f-c0d3-4cc9-9c28-58426afe685b
  modified: 2026-11-17T15:25:39.838Z
---

Three asks from Eliran during the Avnei Hefetz Kedem job (2026-11-17), see [[project-kedma-d1-simulation]] for the sibling job:

1. «חשוב לי מאוד לדעת כמה עלה לי הפרויקט» — at the END of a project, show the credits used per tool and per model, plus the elapsed time from receiving the task to full completion.
   **Why:** he is cost-sensitive (angry at paid mistakes on Kedma D/1).
   **How to apply:** keep `ledger/costs.json` + `ledger/timeline.json` from the first minute; the session's own Claude token bill is not readable from inside, so point him at `/cost` (Claude Code) or his claude.ai usage page and say so plainly.

2. «ברגע שאתה מגיע לשלב הג'ינרוט… תעצור ותגיד לי» — do not generate images (fal etc.) for the apartment; stop at that stage and ask him for the pictures he will supply.
   **How to apply:** my reading — this binds visual generation for property simulations until he says otherwise; confirm scope once on the next project rather than assuming.

3. «I want a fully interactive 3D Walkaround visualization, not a 3D 360° panorama» — for this job the deliverable became a real-time three.js walkthrough built from the sheet-measured geometry (no Blender rendering needed).
