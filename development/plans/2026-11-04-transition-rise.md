# Plan — option 3 in the product: rise out of the 360 into the dollhouse, dive back into a room
<!-- created: 2026-11-04 ~00:20 · author: main session rnd-fd · owner: Eliran Shopen · board: development/tasks/transition-rise/ -->

**Eliran's ruling (2026-11-04, AskUserQuestion):** "להפוך את אפשרות 3 למוצר" — after the spike (`development/tasks/dollhouse-in-tour/logs/spike-07/REPORT.md`,
v2 clean). Standing for the night: everything approved, **no deploy**, $0.

## What the buyer gets
In the 360 tour, the 3D button no longer cuts to the dollhouse: the picture they look at lifts off — the camera climbs out of the room
(the room's panorama on its own depth mesh, dissolving as it rises) and settles on the whole apartment. "צפו ב-360°" on a room dives
the camera down into that room's panorama point, facing where the tour will open, and the tour takes over on that frame. Reduced
motion or a slow device (< 15 fps measured): the plain switch of today.

## How
| Part | File | Change |
|---|---|---|
| viewer | `Habait/platform/js/apartment-3d.js` | `mountDollhouse` gets a camera transition it drives itself (the orbit is paused while it plays): `rise({pano, depth, x_cm, y_cm, eye, bearing0, yaw, pitch, hfov})` and `dive(sameShape)`; the room = depth mesh (`depthmesh.js`, loaded by a dynamic import so node tests are unaffected), fading 3–28 %, climb led over 85 % (the spike's v2), 1.6 s; fps guard + reduced motion |
| dollhouse page | `Habait/platform/tools/build_zip.mjs` (template) | inline `habait/depthmesh.js` in the import map; messages `habait:scenes` (per scene: pano, depth, bearing0, heading) and `habait:rise {scene, yaw, pitch, hfov}`; "צפו ב-360°" inside the tour plays the dive, then posts `habait:enter-room` |
| tour | `Habait/tour360/viewer/tour.js` | preload the dollhouse hidden (`#defer`) once the tour is idle; on open send `habait:rise`; on `habait:enter-room` go to the scene and close the layer when its panorama has loaded |
| outputs | platform 846 dist, tour `dist/apt846` | rebuilt from the live files at close |

## Gate and close
Acceptance: the rise starts on the tour's frame (pixel difference of the central band, deterministic `riseAt(0)`), ends on the 3D preset;
the dive ends facing the scene's opening view; the switch happens; reduced motion skips; every check of dollhouse-in-tour + apartment-3d
stays green; paint-proof 6/6. Fresh reviewer (refute). Close by hash check; no deploy.
