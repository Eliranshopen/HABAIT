---
name: feedback-recheck-source-folder
description: "Eliran adds source files to a project folder while a job runs; re-list the folder before every major phase, never trust the first scan"
metadata:
  node_type: memory
  type: feedback
  originSessionId: c76b1b3f-627c-4655-a8a1-652a0fa40800
  modified: 2026-11-17T15:42:58.864Z
---

On 2026-11-17 (Harei Zahav Na'ama, model Hatzav) Eliran put nine Corona interior renders into `Projects/Harey_zahav_Naama/` about 25 minutes after the job started (14:37–14:39; my scan was at 14:14). I built the whole furnished model without them, and he asked «עבור ההדמייה הסתמכת על התמונות שצירפתי לך?». They changed the layout (island, TV wall, dining by the glazing) and the whole look.

**Why:** he drops material in as he gets it, without announcing it. A stale file list costs a rebuild and his trust.

**How to apply:** re-list the source folder, with modification times, before each heavy phase (model build, bake, render, paid call), and say what is new. When renders of the interior exist, they decide layout and look inside the sales-plan walls; walls and openings stay by the sheet ([[rule-sales-plan-fidelity]]).
