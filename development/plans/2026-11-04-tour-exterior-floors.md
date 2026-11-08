# Plan — no floor-finish buttons on the tour's building and surroundings scenes
<!-- created: 2026-11-04 · author: main session rnd-fd · owner: Eliran Shopen · board: development/tasks/tour-exterior-floors/ -->

**Eliran (2026-11-04):** on https://habait-flow.vercel.app/tour/ the building-and-surroundings view shows the בטון / פרקט / שיש buttons;
they belong only to the apartment.

| Step | What |
|---|---|
| 1 | prove it on production (`probe-floors.cjs`) |
| 2 | `tour360/viewer/tour.js` `renderVideoBar`: hide `#t-floor-seg` when the scene is exterior (the plan and 3D buttons already follow `s.exterior`) |
| 3 | test build from live sources + the fix; probes (per scene, in-page hop), transition-rise `check-rise` |
| 4 | close by hash check; tour `dist/apt846/index.html` from the test build |
| 5 | QA: fresh reviewer on the live result; deployed-site QA after Eliran's own deploy go (`stage_flow.py` → habait-flow) |
