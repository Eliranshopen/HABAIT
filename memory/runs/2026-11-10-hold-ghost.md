---
date: 2026-11-10
layer: runs
author: rnd-9d (main session, finishing the hold-ghost agent's round)
second-reader: habait-deploy-qa (pointer added)
---
# Hold on a phone: no ghost tower on iPhone Safari

**Bug (Eliran, iPhone Safari, 09:25, test link rainbow-v2-test.vercel.app).** At the /hold/ stop on a phone, a small drag to look around showed a second, larger, translucent copy of the tower's upper floors over the sharp tower («זה פוגע בבניין והוא פתאום מתעוות»).

**Cause (verified in WebKit).** The portrait framing drew the "air" above and below the tower as a scaled copy of the same frame blurred with `CanvasRenderingContext2D.filter`. WebKit reports `filterProp: false` (`qa-evidence/platform/hold-ghost-2026-11-10/webkit-before-log.txt`), so the copy was drawn sharp, scaled and offset — the ghost. Worst while dragging because both layers redraw.

**Fix (875fa58, merged ee80a5a 09:31).** The air around the portrait framing is a gradient, never a copy of the picture (`research/fal-bench-2026-11-02/flyover3d/holdarc.js`); the journey page's floor stage got the same treatment (`platform/apartment-journey/`); `test/hold-phone.check.mjs` now asserts no second tower. WebKit (Playwright, iPhone UA) at 390 and 375, at rest and mid-drag: no ghost, errors 0 (`webkit-after-log.txt`, `webkit-before-drag-vs-after-390-375.jpg`).

**Check fix (this session, merged after ee80a5a).** `test/apartment-journey.check.mjs` read the floor stage at a wall-clock 3.9 s and, on a contended machine, caught «15» or the facts a beat early (FAIL 5 then FAIL 2 at different widths on 2026-11-10 ~09:05). It now waits for the journey's own phase and judges the landing by `window.__journey.landedAt` (7.5–10.5 s), with the wall-clock tap → tour widened to 8–16 s.

**Not deployed to habait-flow.** Published to the test link only, on Eliran's standing instruction that habait-flow changes only on his word. Worktree `.wt/hold-ghost` removal is Eliran's act.

**Gate note (10:25).** responsive-gate on the bare `/hold/` at 390 can sample the pre-load state (`טוען את ההדמיה…`) where the dev scrub bar `input#t` (305×16) is still shown; 1 of 4 runs on the link did. Follow-up for the hold: hide `#bar` until the site is loaded on phones, or give the gate a longer settle for /hold/.
