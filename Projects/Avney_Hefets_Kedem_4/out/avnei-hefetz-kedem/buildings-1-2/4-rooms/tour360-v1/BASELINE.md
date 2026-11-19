# tour360-v1 — RAINBOW baseline, row by row (2026-11-18)

Checklist: `C:\RnD\docs\rainbow-baseline-features.md`. Viewer: RAINBOW `tour360` (tour.js, edit-live.js, template, copy pack, server handler — read-only), Pannellum build (the engine bundle `engine/dist` is not built in the RAINBOW tree, so `--engine` was not possible). Built with `tools/tour360/build-tour.mjs` (adapted copy). Interface only: no RAINBOW furniture, catalog photo or apartment media is in this build. QA evidence: `qa/qa-report.json` + screenshots (1440×900 and 390×844, all checks PASS).

| # | Feature | State | Note |
|---|---|---|---|
| 1 | Swap rings → catalog, item card | **built** | 15 rings in 5 scenes (sofa, coffee table, dining table, chair set; living, dining, kitchen, foyer, corridor), placed from the plan's furniture and checked against the ray-cast depth ($0, no vision scan); 8 items from OUR catalog (3 sofas, 2 coffee tables, 2 dining tables, 1 chair), AI studio photos. Left out: the 3 armchairs (there is no armchair in the panoramas). The replace itself is a paid live turn: shown on the stub host (ring → pick bar with our 3 sofas), not run. |
| 2 | Free-text design line | **built** | The RAINBOW line and server function, staged with `api/edit`. Works only after FAL_KEY, OPENROUTER_API_KEY and TOUR_EDIT_CODE (or TOUR_EDIT_OPEN=1) are set on the Vercel project. Not run (paid). |
| 3 | Undo · original · reset · my changes | **built** | RAINBOW code, unchanged. It only does something after a live change, so it was not exercised at $0. |
| 4 | «שינוי שלכם» tag + fixed «הדמיה» badge + AI note | **built** | The badge and the AI note were checked on every QA screen. The tag appears after a live change (not exercised). |
| 5 | Finish set (parquet / concrete / marble) | **left out** | Needs one more full panorama set per finish, which is a paid generation, or new renders plus a GPT pass. |
| 6 | Designed / original | **built** | Original = the clean Cycles render of each room (same yaw frame); switch checked. |
| 7 | Prepared examples | **left out** | Every example is a paid edit (`edit-pano.py run`). |
| 8 | Room navigation: floor door markers, room strip, ‹ › | **built** | 26 door markers from the plan's openings (bearing, not by eye); kitchen↔foyer has no opening on the plan, so it goes «the way round». Strip and door both checked on desktop and phone. |
| 9 | Click-to-move, arrow keys | **built (not separately checked)** | RAINBOW code on our plan positions. |
| 10 | Plan with position + view cone + compass | **built differently** | The sheet is a crop of the architect's sales sheet with 11 numbered pins and the view cone. The compass is left out because there is no north arrow and no site plan in the sources; it was not guessed. |
| 11 | 3D dollhouse | **left out** | There is no dollhouse page for this unit. The 3D walk (walk3d-v6) is a separate site. |
| 12 | View-modes menu | **built** | 360° + the plan. |
| 13 | Measure (two points) | **built differently** | The depth maps are ray-cast from `scene/apartment.blend` (the scene the panoramas came from), not from a Cycles Z pass. The tool shows in «כלי עזר». |
| 14 | Voice tour | **left out** | No recorded guide. It would need a voice (Eliran's call). |
| 15 | Button walkthrough (coach) | **built** | RAINBOW coach, first visit. |
| 16 | Zoom, auto-rotate, reset, full screen | **built** | |
| 17 | Tap to hide controls (phone) | **built** | The hint shows at 390. |
| 18 | Languages he / en / fr | **built** | Hebrew first. Room names in he (from plan.json), en and fr. lang=en was checked. |
| 19 | Intro passage, back to building | **left out** | No exterior nodes for this building. |
| 20 | Room / intro video | **left out** | No videos. Making them is paid generation. |
| 21 | Shareable URL | **built** | `?room=…&lang=…` was checked. |

## Open (Eliran's calls)

**Disclosure line**
- The copy pack's concept line says «המידות תואמות לתכנית בסטייה של עד 2%».
- RAINBOW's fidelity gate was NOT run on these panoramas, because it needs a paid depth-model call.
- The trace itself is within 1% on 13 of 14 printed dimensions. The worst is the bath, at −1.21% (plan.json `dims_check`).
- Decide: keep the line, have it measured, or change the wording.

**Deploy**
- The deploy needs its own go.
- The keys must be set on the new Vercel project by name.
