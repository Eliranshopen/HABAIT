GATE 4: PASS (0 defects; 1 low observation, not a defect)

Reviewer: qa-reviewer, fresh context, 2026-11-03. Work tree `C:\RnD\.wt\apartment-3d\files\...\Habait\platform`; headless Chrome (SwiftShader), desktop 1440x900 DPR 1 and 2, iPhone 13, Pixel 7. Port 8851 only, no Blender, no network, no sub-agents. `live drift: 0` at start and end. My build_zip run rebuilt the work-tree `_local/dist/rainbow/846` (as every earlier build did). Check scripts that write frames were copied to `logs/gate4-*.cjs` with their output dir redirected to `after\gate4\`, so no author frame was overwritten. Frames and crops: `C:\RnD\.wt\apartment-3d\after\gate4\`.

## Check lines
| # | Line | Result | Evidence |
|---|---|---|---|
| 1 | build_zip rainbow 846 | PASS exit 0, 27 files, 4.87 MB | gate4-build.txt |
| 2 | smoke / minimap.test / apartment.test | PASS all three exit 0, "all green" (minimap.test was the D3 failure at gate 3) | gate4-smoke.txt, gate4-minimap.test.txt, gate4-apartment.test.txt |
| 3 | check-03 / 04 / 05 | PASS 40 / 47 / 22 ok, 0 fail, exit 0 | gate4-check-03/04/05.txt |
| 3 | check-08 | PASS 8 ok, 0 fail, exit 0 | gate4-check-08.txt |
| 3 | check-08-fallback | PASS exit 0 (no lightmap, hemisphere 1.05, no page errors) | gate4-check-08-fallback.txt |
| 3 | check-urlfix | PASS exit 0 | gate4-check-urlfix.txt |
| 3 | probe-labels-embedded | PASS Pixel 7 11/11, iPhone 13 11/11 | gate4-probe-labels-embedded.txt |
| 4 | export_dollhouse.py --selftest | PASS "64 cases, 0 failed" (was 63; one case added by the fix) | gate4-selftest.txt |
| 5 | D1 dark dashes/stripe blocks, embedded 3D tab, Top, parquet, DPR1, DPR2, iPhone 13, Pixel 7 | PASS: no dashes or stripe blocks on floors, wall bases, entrance corner, sun terrace or room interiors at any of the four devices. Gate 2/3 frames of the same corner show the stacked bars (`gate3\z_d1_desktop2x_top.before.png`, `gate2\iphone13_p2_top.png`); gate 4 crops of the same spots are clean | `after\gate4\z_desktop2x_top_entrance.png`, `z_desktop2x_top_floor.png`, `z_iphone13_top_floor.png`, `z_pixel7_top_floor.png`, `z_desktop1x_top_floor.png` |
| 5 | 3D and Outdoor presets x parquet / concrete / marble | PASS: contact sheet of all 9 at DPR2, no dashes; finishes differ | `after\gate4\sheet_desktop2x.png`; all 36 frames `{device}_{preset}_{floor}.png` |
| 6 | D3 `floorColor` | PASS: reports the finish colour under a texture: parquet 0.4/0.25/0.13, concrete 0.46/0.45/0.42, marble 0.8/0.78/0.74 (desktop and iPhone 13); test/minimap.test exit 0 | gate4-d34.txt |
| 6 | D4 floor-switch race | PASS: 5 sequences each on desktop and iPhone 13 (concrete>parquet, marble>concrete, 4- and 5-step chains, 3-step), plus a 30 ms stagger: `floor` equals `floorTexture.current` every time and equals the last request | gate4-d34.txt |
| 6 | Floorfill offset vs thresholds | PASS: floorfill (3 meshes) has polygonOffset factor 2 / units 2 and cast-shadow in the bake is off; floorfill_1 follows the finish (map set, lightmap set). With every other floor mesh hidden, floorfill alone paints the whole footprint (thresholds included) in the same parquet look, so no gap or door strip vanishes where no floor covers it; frames at DPR2 show no flicker or colour jump at door thresholds | gate4-thresh.txt, `after\gate4\thresh_exposed_parquet.png`, `z_thresh_exposed_parquet.png` |
| 7 | 3 floor GLBs share ONE BIN | PASS 208,388 B, sha 51d18730..., 1 buffer each | gate4-geometry.txt |
| 7 | geometry = live Phase-1 GLB | PASS 27 nodes both, 0 transform / triangle / bounds diffs, report triangles 0 diffs (wt report adds only a `bake` key) | gate4-geometry.txt |
| 7 | dollhouse.html growth | PASS 2,256,428 - 1,809,571 = +446,857 B (budget 600 KB; gate 3 was +422,573) | gate4-legal.txt |
| 7 | legal text | PASS apartment.json legal equals the live dist's (except `source`); 0 Hebrew runs of the live dollhouse.html missing from the page; the only visible-text difference from live is the added pill "הדמיה להמחשה בלבד." (card 04, present since gate 2); caption and notice unchanged | gate4-legal.txt |
| 7 | live drift | PASS `live drift: 0` at start and end | wt.py drift |

## Observation (low, not a defect, pre-existing)
Thin 1 px dark diagonal lines cross the living-room / kitchen floor in Top (visible on Pixel 7 and iPhone 13, e.g. from the entrance corner toward the kitchen sofa). They are present in the gate 2 frame (`gate2\iphone13_p2_top.png`) and in the gate 3 frames, so they are not new and not the D1 stripe blocks; likely triangle-edge seams of the lightmap or floor texture on the large floor polygons. Eliran's look call; not routed as a defect.

## Verdict reasoning
Refute attempts failed: D1 dashes absent at every device and preset I could open, D3 and D4 hold under chained and staggered switches, the polygon offset does not expose or flicker any threshold, geometry and legal are unchanged, size within budget, every Check line exits 0.
Not covered: real tour on :8848 is stubbed; no real GPU (SwiftShader only).
