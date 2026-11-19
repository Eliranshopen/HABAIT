---
name: rule-sales-plan-fidelity
description: "Eliran 2026-11-04 — every simulation must match the sales plan (תכנית מכר) exactly: dimensions, details, every element"
metadata:
  node_type: memory
  type: feedback
  originSessionId: bf387f38-6eee-4def-a2b7-39554f497b4b
  modified: 2026-11-05T09:52:25.212Z
---

Every simulation (tour, film, dollhouse, edits, furniture swaps, new projects) must match the sales plan exactly: dimensions, walls, windows, doors, fixed elements. A buyer must never see a simulation that differs from the plan. Eliran: "חשוב מאוד מאוד מאוד".

**Why:** a buyer who sees a simulation that differs from the sales plan is a liability and trust problem for the developer and for Habait.

**How to apply:** treat fidelity as a hard gate before anything is published. Furniture/décor edits only; structure and view edits stay refused. apt846 was audited 2026-11-04: DEVIATES (3 S0 made by the AI skin pass, 3 S1) — `Projects/Habait/research/fidelity-audit-2026-11-04/REPORT.md`. Eliran then ruled the AI checks fidelity automatically, not the developer. **2026-11-05: the deviation cap is 2% per room, hard** ("אסור סטייה של 29%, סטייה נורמלית זה גג עד 2%"): a room over 2% never ships, and the disclosure line is the fixed text «הדמיה על בסיס תכנית המכר. המידות תואמות לתכנית בסטייה של עד 2%. הריהוט והגימורים להמחשה בלבד.» shown only when the gate proves it (never a "measured number" variant). Never claim accuracy beyond what the check proves. Repo record: `memory/project/2026-11-04-sales-plan-fidelity.md`. Related: [[feedback-realism-over-diagram-look]].
