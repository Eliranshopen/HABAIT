# The hold's stop on a phone — reframed and tidied
<!-- last-updated: 2026-11-09 -->

**State:** BUILT — merged into `main`, staged, gated; NOT deployed.
**Owner:** Eliran Shopen. **Built by:** sub-agent (coordinator's delegation), worktree `.wt/hold-phone` (branch `hold-phone`, off `552f5ea`).
**Ask (Eliran, via the coordinator, 2026-11-09):** the phone view of /hold/ after the fly-around, where it stops facing the building, «לא נראה טוב, צריך לתקן»; everything else approved. The coordinator's capture at 390×844 and 375×667 (test link rainbow-v2-test → «לסיור בפרויקט») and six points: framing, pills, the hint, the right column, the legal line, choosing an apartment.
**Cost:** $0. Desktop and phone landscape unchanged (every new rule is portrait-phone only; the framing is portrait-screen only).

## 1. What was wrong (the before sheet)
- **Framing:** the 1280×720 hold frame was cover-fitted, centred, on a 390-wide screen. That shows only x 0.37–0.63 of the frame, while the tower sits at 0.19–0.59 (`holdarc/camera.json` frame 91 `tower_ndc_box`). The tower was cut on its left and read as a random close-up.
- **Pills:** 24 px pills over a busy facade, staggered off their floors where they collided.
- **Chrome:** the hint pill sat over the tower and the column. The right column stood on the facade. The legal line ran to two lines over the pills.

## 2. What was done
1. **Framing from the tower's projected bounds** (`holdarc.js`, portrait screens):
   - The tower's box fills the width minus a 72 px right-edge column zone, so the column stands on the sea and sky beside the tower, not on the facade.
   - **But never a floor under 33 px on screen.** One floor is 6.36 % of the frame height at the hold pose (846's anchor ± 1.6 m through frame 91). Below 33 px, the 19 px pills one floor apart cannot keep clean 44 px hit areas, which is the responsive gate's target rule.
   - When the floor rule wins, the tower's right edge (the pills' side) stays at the column and only its left flank, which carries no pills, runs off-screen: ≈ 20 % at 375 px, 17 % at 390, 6 % at 430.
   - A jog of alternate floors was tried and dropped: with the bays ~74 px apart it cannot clear 44 px from both neighbours.
   - The frame sits a little above centre.
   - The air above and below is the same frame, cover, blurred and darkened; the sharp frame's top and bottom are feathered into it.
   - One `geom()` drives drawing and projection, so the pills and the floor glow stay on their floors through drag and zoom.
   - The framing eases in (`settle`, 1.1 s) from the film's cover framing when the film hands over, so there is no jump; it applies at once when the hold opens without the film.
   - While a card is open, the picture eases up (`lift`) just enough to keep the chosen floor above the bottom sheet (on a 375×667 phone it would be under it).
2. **Pills:** dot + number, 11 px, ~19 px tall, on their floors (no stagger at this floor pitch), each with an invisible 44 × 44 px hit area. The picked pill turns gold. The picked floor glows: a band one floor high across the tower's face, projected through the hold camera, for any unit (846's anchor ± (floor − 16) × 3.2 m, the picker's own floor step).
3. **Drag hint:** a short toast «⟷ גררו לסיבוב · צבטו לזום», low in the air above the legal line. It leaves on the first touch anywhere, or after 5 s.
4. **Right column:** Eliran's round-6 layout is kept (sound, the building icon, «דירות», the vertical legend at the right edge), as one glass look. It now stands on the sky beside the tower.
5. **Legal line:** one 11 px line on a bottom gradient, with «פרטים» opening the full text. The wording is unchanged, and «בינה מלאכותית» is on the visible line.
6. **Choosing an apartment:** a compact glass bottom sheet with the facts in one row (floor, rooms, m², terrace m²; no prices) and ONE button.
   - For 846 the button reads «כניסה לדירה» → the apartment journey. It is the same `#unitContinue`, so the iOS audio unlock in its tap is unchanged. The label comes from the picker's new opt-in `continueLabel` hook.
   - «לסיור 360°» and «עמוד הדירה» stay, as small links under the button.
   - Other units keep their action. Desktop keeps «המשיכו אל הדירה».

## 3. Checks
- New `test/hold-phone.check.mjs` (375, 390, 430 portrait + 1440). It checks the following, and that the CTA goes to the journey:
  - the settled tower framing (the tower inside the screen, left of the column, ≥ 70 % of the width);
  - pills inside the frame, ≤ 26 px drawn, 9/9 points of a 44 px hit area;
  - a one-line legal line;
  - the hint in the lower air, clear of the column and every pill;
  - 846's one button «כניסה לדירה» (desktop «המשיכו אל הדירה»), the floor glow for 846 and for another unit, no price.
- `test/hold-chrome.check.mjs` (360, 390, 430, 390-landscape, 1440) and `test/rainbow-flow.check.mjs` (the full route) on a fresh stage; predeploy on the stage.

## 4. Open
- A real-phone look (iPhone Safari: `ctx.filter` blur needs Safari 18; older Safari shows the darkened air without blur).
- The landscape phone stop was not part of this ask and is unchanged.

## 5. Fix 2026-11-10 — the ghost tower on iPhone Safari
**Report (Eliran, iPhone Safari, the /hold/ stop):** while dragging a little to look around, «הבניין מתעוות». A larger, translucent copy of the tower's upper floors showed over the sharp tower, and the bands above and below were not blurred.

**Cause (reproduced in Playwright WebKit 26.0 with iPhone 13 / iPhone SE emulation):** the portrait "air" was the same frame drawn at cover scale through `ctx.filter = 'blur(…)'`. WebKit has no `CanvasRenderingContext2D.filter` (`'filter' in ctx` is false), so the air was a SHARP, larger copy of the tower. It showed around the frame and, through the frame's feathered top edge, as the offset ghost; mid-drag both layers redraw. `draw()` draws one image per frame (no cross-blending), so that layer was the only source.

**Fix:**
- **Hold (`holdarc.js`):** the air holds no picture. It is a vertical gradient from the page's navy to the mean colour of the frame's own top / bottom 8 % (measured once per frame image), and the sharp frame's feathered edges dissolve into it. It looks the same in every browser and uses no blur API.
- **Journey (`apartment-journey/`):** the air is the same gradient (it was a CSS-blurred copy of the frame), so the hand-off from the hold still starts on the same picture.

**Proof:**
- WebKit before/after at 390 and 375, at rest and mid-drag (`qa-evidence/platform/hold-ghost-2026-11-10/`).
- `test/hold-phone.check.mjs` now measures the band above the framed tower, at rest and mid-drag: each row's luminance spread (p95 − p5) must stay ≤ 24. The old build's band measured 49–100, the fixed one 0.
