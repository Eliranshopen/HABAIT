# Plan — the dollhouse inside the 360 tour (option 1, then a spike for option 3)
<!-- created: 2026-11-03 ~20:20 · author: main session rnd-fd · owner: Eliran Shopen · board: development/tasks/dollhouse-in-tour/ -->

**Eliran's rulings (2026-11-03):** "1 ואחריו 3" (the 3D button inside the tour first, then a spike of the continuous rise-out-of-the-pano
transition); "אני רוצה שעד הבוקר אני אקבל מוצר מוגמר אז הכל מאושר לך על זה" → scope "הדולהאוס בתוך הסיור + סגירה", **no deploy**
(ready for the morning), $0 / no paid call (no fal key needed).

## What the buyer gets
In the 360 tour (Habait/tour360 viewer, apartment 846), a **3D** button beside the plan button opens the dollhouse (the same file as the
apartment page's 3D tab) over the tour: the room they stand in is marked with a **"you are here" dot and a view cone** that follows where
they look; tapping a room and "צפו ב-360°" moves the tour to that room and closes the overlay; the floor finish follows the tour's.
Hidden when the tour is already embedded in the apartment page (that page has its own 3D tab).

## How (files)
| Part | File | Change |
|---|---|---|
| dollhouse | `Habait/platform/js/apartment-3d.js` | `setHere({x_cm, y_cm, bearingDeg, fovDeg})`: a dot + a translucent wedge on the floor (plan cm → model: x = x_cm/100 − shift.x, z = y_cm/100 − shift.z; bearing 0 = plan up = −z, clockwise) |
| dollhouse page | `Habait/platform/tools/build_zip.mjs` (template) | message `habait:you-are-here {scene, bearing, fov}` → the room of that scene → `setHere` |
| tour UI | `Habait/tour360/viewer/{template.html,tour.css,tour.js}` | the 3D button + overlay (lazy iframe), messages: send `habait:you-are-here` (bearing = centreBearingDeg + yaw, ~10/s while it changes) and `habait:floor`; receive `habait:enter-room` → `go(scene)` + close; Esc closes |
| tour build | `Habait/tour360/tools/build-tour.mjs` | copy the unit's `platform/_local/dist/*/<unit>/media/dollhouse.html` to `dist/<id>/3d/dollhouse.html` when exactly one exists (data.dollhouse); `--out` / `--apartments` for tests (defaults unchanged) |

## Gates
Acceptance script (desktop + iPhone 13 + Pixel 7, served over HTTP): button visible, overlay opens, marker present and turning with the
yaw, room → 360 moves the tour and closes, floor follows, embedded (`from=apartment`) hides the button, no page errors; the existing
platform + tour checks stay green. Then a fresh-context reviewer (refute). Then copy back + rebuild the live tour dist with the same
flags (plain `build-tour.mjs apt846`). **No deploy.** Then the option-3 spike (a transition prototype, report + frames, nothing shipped).

## Rails
Root CLAUDE.md: working folder `.wt/dollhouse-in-tour` (one per task), no git, `timeout` on every run, port 8851 only, never open a
`.env`, memory at the end. Disclosure unchanged (the dollhouse keeps its הדמיה · AI caption; the tour keeps its badge).
