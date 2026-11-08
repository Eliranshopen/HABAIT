# QA report - tour-exterior-floors (fresh reviewer, 2026-11-04)

QA: PASS

Target: LIVE `Projects/Habait/habait-walkaround/Habait/tour360/dist/apt846` served on 127.0.0.1:8851 (killed after; netstat shows no listener). Code: `viewer/tour.js` renderVideoBar (l.960-971), called from renderRoom (l.518, `if (state.ready)`), i.e. on every scene load.

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | probe-floors.cjs on live dist (desktop + iPhone 13, 10 scenes + default) | PASS, 0 FAIL | qa-run-floors.txt |
| 2 | probe-hop.cjs (terraceOut -> entrance -> facade, no reload) | PASS | qa-run-hop.txt |
| 3 | all 11 exterior ids by ?room=, default video setting (no video=0), plain / ?floor=concrete / ?floor=marble, desktop + iPhone 13 | floors hidden everywhere (88 ok, 0 FAIL) | qa-run-routes.txt (qa-routes.cjs) |
| 4 | no empty #t-video-bar on exterior scenes: no clip -> bar hidden; clip -> bar shows only the video button (44px, no gap) | ok | qa-run-routes.txt |
| 5 | ?scope=apartment: opens in apartment, floors shown | ok | qa-run-routes.txt |
| 6 | exterior scene WITH room clip (served copy mutated: clips on aerial/facade/terraceOut/entrance + intro; clip requests held open) | #t-floor-seg hidden, video button shown, hop exterior->apartment->terraceOut and next-walk keep it right | qa-run-routes.txt |
| 7 | overlay floor switch while an exterior clip plays (setFloor reloads with room=aerial&video=0&floor=concrete) | exterior scene still hides #t-floor-seg | qa-run-routes.txt |
| 8 | code review: setFloor re-renders #t-floor-seg but never un-hides it; only renderVideoBar toggles `hidden`; deep link ?floor= and guide/next/prev all go through onLoad -> renderRoom | no route found | tour.js l.944-971, 518 |

## Defects
None blocking.

## Notes (not defects, Eliran's call)
- N1: the video PLAYER overlay has its own floor strip (#t-video-floors). While a clip plays on an exterior scene, or the building flyover intro plays, that strip is visible (3 buttons; seen in the mutated copy). It is the clip's floor-finish switch (the finish changes the clip), not the scene button Eliran named, and the fix does not touch it. This live build carries NO room clips and NO intro (`"rooms":{}`), so today it cannot occur; it can in a build that has clips. Repro: `node qa-routes.cjs http://127.0.0.1:8851/` (NOTE lines).
- N2: renderVideoBar returns early when the build has no videos block; floors then do not exist either, so nothing to hide.
- Limit: real clip playback not exercised (the build has none); tested with a mutated served copy only, nothing edited under Projects.
