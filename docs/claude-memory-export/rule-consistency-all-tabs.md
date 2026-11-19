---
name: rule-consistency-all-tabs
description: "Eliran 2026-11-10 — before fixing or generating any simulation picture, audit EVERY tab for cross-scene consistency (doors, entrance, kitchen look the same from every tab)"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 6ebc3d8f-7b16-4880-90d0-725aacae9a04
  modified: 2026-11-17T11:05:17.718Z
---

Before any fix or new generation in a 360 simulation, go over all the tabs (every interior scene and every floor-finish set) and make the same element look the same everywhere it is seen — e.g. the entrance door and the doors must be identical in the entrance, dining and living tabs.

**Why:** Eliran found the entrance door oak in the dining tab and taupe in the entrance/living tabs, while the fixture-only consistency judge passed 9/9 (doors were not an audited group). «הכלל שלך הוא עקביות».

2026-11-12 (the 3D walk): «חשוב שתיהיה עקביות … ולא נגיע למצב שהרהיטים ישתנו בין התמונות» — the same rule for walking: one 3D scene where each piece exists ONCE (each modelled after ONE reference picture), never a cross-fade into the AI tour pictures (they differ slightly between tabs), never a method that blends several AI views of a piece (projection, splats from inconsistent views).

2026-11-17 (Kedma D/1, with two screenshots of the kitchen island seen from the pantry and from the kitchen): «אין עקביות … כל חדר אמור להיראות אותו דבר מכל נקודת תצפית». The same words in the prompt do not give the same room. Method adopted: every viewpoint is rendered from ONE 3D model with depth, and the painted surfaces of a finished viewpoint are CARRIED into the next (`jobs/kedma-d1/hand/carry_over.py`); the image model only finishes what no finished viewpoint sees. Also: while a tour mixes old and new pictures, say so IN the tour (`hand/mark_old.py` adds «תמונה ישנה, תוחלף» to the viewpoint's name) — he reviews everything he is shown and counts each old defect as a new mistake.

**How to apply:** run `consistency-check.mjs --all-groups` (door groups added 2026-11-10) on the DEFAULT set the visitor sees (parquet) and on every finish set, look at the sheets by eye, then fix; after a fix, re-judge every scene that sees the element. Also check the change at the viewer's zoom. A paint band can change geometry (a door widened 45 %): measure against the plan/render. Related: [[rule-sales-plan-fidelity]], [[feedback-realism-over-diagram-look]].
