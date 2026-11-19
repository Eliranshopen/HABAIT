# 2026-11-11 — Point-to-point movement inside the 360 tour (Rainbow 846)
- **Asked by:** Eliran, 2026-11-10: «אני רוצה להוסיף יכולת של התקדמות ותזוזה בהדמייה ע"י העכבר אם זה בדסקטופ או ע"י חצים שיופיע במסך אם זה בגרסת המובייל … לפי יכולת עצמאית של המשתמש»; of the two kinds offered he chose «נלך על התקדמות בין נקודות»; 2026-11-11 «תמשיך».
- **Working folder:** `.wt/tour-point-move` (branch `tour-point-move`). **Shown on:** the test link only (rainbow-v2-test); habait-flow on his word.
- **Cost:** $0 — no new pictures. The 11 viewpoints and their links (`apartments/apt846/scenes.json` hotspots) stay as they are.

## What exists today
The tour has 11 fixed viewpoints. A visitor moves by the door rings in the picture, the room strip, or the previous / next buttons. A click on the picture itself does nothing on desktop; on a phone a tap hides / shows the controls.

## What is added (viewer only: `Habait/tour360/viewer/tour.js`, `tour.css`, `template.html`)
1. **Desktop — click the picture to advance.** A click (no drag, not on a ring, a marker or a control, no tool open) goes to the linked viewpoint whose direction is nearest the click, if one lies within 40° of it. While the mouse moves, the ring it would take is highlighted and the cursor becomes a hand. A click with no way in that direction pulses the rings (the ways that do exist).
2. **Phone — arrows on the screen.** A small pad above the bottom bar: ▲ forward (goes to the linked viewpoint nearest the direction the visitor looks, its name written on the button), ◀ ▶ turn to the next way out on that side. The pad leaves with the rest of the controls on a tap, and steps back while a panel, a menu, the walkthrough, the ruler or plan / 3D holds the screen.
3. **The move itself.** The view turns to the way out and closes in a little (≈0.45 s), then the next viewpoint fades in facing the direction of travel (the existing 0.65 s fade). Under reduced motion: the plain swap.
4. `?nav=pad` / `?nav=click` / `?nav=off` force a mode (for tests and embeds).

## Checks before the test link
- A new test `tour360/tools/point-move-check.mjs`: at 1440 a click toward each link of the living room lands in that room, a click toward a blank wall stays; at 390 (touch) the pad shows, ▲ moves, ◀ ▶ turn, a round trip through all 11 viewpoints by ▲ / ◀ ▶ only; no page errors, no horizontal scroll; the three disclosure elements stay.
- The existing journey test and the live path stay green; screenshots at 1440 and 390 looked at by eye.

## Not in this plan
Free walking to any spot (needs a full 3D model); new viewpoints; the engine build (`--engine`), which is not what the test link ships.

## Built 2026-11-11
- As planned, in `.wt/tour-point-move` (commit `67189e9`, merged). One change from the plan: ▲ always has a target (the linked viewpoint nearest the look direction, named on the pad), it is never dimmed.
- Test `tour360/tools/point-move-check.mjs` PASS on the scratch build, the stage `test-r27` and the live test link (`dpl_2YWYd8WjesFdmiJMVMQSi1EsZ2cJ`); journey test and the live entry path green. Evidence `Projects/Habait/habait-walkaround/qa-evidence/platform/point-move-2026-11-11/`; record `memory/project/2026-11-11-tour-point-move.md`.
- Left: a real phone; en / fr by eye; the walkthrough does not explain the new movement yet; habait-flow on Eliran's word.

## Changed 2026-11-11 — floor arrows (Eliran: «במובייל אני מעדיף חצים שקופים על הרצפה שמאפשר ממש התקדמות ימינה שמאלה כמו הליכה, כנ"ל בדסקטופ»)
- Item 2 (the pad) is replaced: a ring of see-through chevrons on the floor at the bottom centre, one per way out, at its bearing from the look direction, turning with the view; a tap / click walks there; phone and desktop alike. The marks in the picture become name tags. Item 1 (the desktop click) stays. `?nav=off` only.
- BUILT: commit `1e40ac2`, merge `4842b19`; test PASS on the stage `test-r28` and live (`dpl_Fmw6yZriYZZf8KH5HCAZT1gLPMbb`).

## Changed 2026-11-11 — keyboard + joystick (Eliran: the arrows on the picture are not comfortable; desktop = the keyboard's arrows with an on-screen word for each press; phone = four small black arrows on the right, like a joystick)
- The floor arrows are removed and the door rings are back. Arrow keys (desktop) and the joystick `#t-joy` (phone) share one rule: ↑ the faced way, ← → the next way to that side, ↓ the one behind; no such way = ← → turn 45°, ↓ turns around, ↑ pulses the rings. `#t-nav-hud` names every press. The desktop click on the picture stays.
- BUILT: commit `5701958`, merge `d26fe11`; test PASS on the stage `test-r29` and live (`dpl_Ara2jqN8u6eHWGpmzT9bgUSWt7yx`).

## Changed 2026-11-11 — as a person walking (Eliran: «החיצים אמורים לפעול כמו בן אדם שצועד בדירה»; the phone's arrows must not leave with the other controls)
- ↑ a step to the way ahead; ← → turn the view while held and never change room; ↓ a step back, still facing the room just left. The joystick stays on the phone's screen when a tap hides the other controls.
- BUILT: commit `9a52108`, merge `92855eb`; test PASS on the stage `test-r30` and live (`dpl_GC6YPJNzArWANbMU5BgxfGEee3h1`).

## Added 2026-11-11 — the room buttons (Eliran: the bedroom button points at the terrace; the buttons must show the right direction)
- All buttons of apt846 audited on their pictures; seven re-placed or removed by hand in `scenes.json` (the suite button now on its door, leading to the wardrobe corner under the suite's name). BUILT: commit `8fbf39a`, merge `d2a3d8d`; live `dpl_DXyNBwkGWv5dctSWJXzJXvrXTAQc` (stage `test-r31`).
- Owed: `make-scenes.mjs`'s through-the-wall fallback and `cameras.json` links (a regeneration would revert the hand placements).

## Added 2026-11-11 — owed items closed; the open question
- Closed: `hotspot-pins.json` + the generator's fallback (a regeneration keeps the hand placements), the walkthrough explains the walking arrows, joystick arrows 44 px. Live `dpl_7sSKCgVGxd2Jwsj3GqGeBJep6vc9` (stage `test-r33`).
- **Open — Eliran's call (paid):** «איך נעשה שאני אוכל להתקדם למסדרון ולכל מקום שארצה כמו בן אדם שהולך בדירה?» With 11 pictures a visitor stands in 11 places; the rooms' corridor has none. Option A (recommended): add viewpoints on the walking routes, first the rooms' corridor as a pilot, ≈ $5–10 a viewpoint (ledger: $0.81 a picture, $0.54 a floor finish, plus retries); each new viewpoint passes the sales-plan fidelity gate and the consistency audit. Option B: keep 11 viewpoints (today). Option C: free walking in a 3D model — turned down earlier for realism. Nothing is generated before his word.

## Closed 2026-11-11 — the corridor viewpoint (option A) was probed and dropped
- A camera in the passage was rendered from the 3D model at $0: a 1.2 m niche, the view is door leaves and wall. No picture generated, $0 of the $10 spent. The entrance keeps two buttons at the mouth of the passage (guest bath, bedroom 2).
- Also done: pinned buttons pass the depth model (24/26, two exact by eye); the hold loads its nodes one at a time (slow-line entry). Live `dpl_6CcuvKAmgCVtKUZ3pysKSxTtRwst` (stage `test-r35`).
- Left for Eliran: his own check on a real phone and desktop; the suite door's ~10° picture-vs-model difference (paid, his call); the live entry check on a normal line.

## Changed 2026-11-11 — the phone joystick removed (Eliran: fixed viewpoints are not continuous walking; «נוריד את הכפתורי התקדמות כמו הליכה במובייל»)
- Phone: no walking arrows; door rings, the room strip and ‹ › move it. Desktop: the arrow keys and the click stay. The entrance gets a button on the master suite's door. BUILT: live `dpl_CxRYaZ9UkhhYfsXXvXxVbLKjhHYk` (stage `test-r37`).
- Continuous walking stays open and undecided: a depth-warp transition ($0, unproven), many more viewpoints (paid), or a 3D-model walk.
