GATE 3: FAIL (3 defects: 1 medium, 1 medium-low, 1 low)

Reviewer: qa-reviewer, fresh context, 2026-11-03. Work tree `C:\RnD\.wt\apartment-3d\files\...\Habait\platform`; headless Chrome (SwiftShader), desktop 1440x900 (DPR 1 and 2), iPhone 13, Pixel 7. Port 8851 only, no Blender, no network, live drift 0 at start and end. Note: my build_zip run rewrote the work-tree `_local/dist/rainbow/846` (same as the author's builds). Frames: `C:\RnD\.wt\apartment-3d\after\gate3\` (3 presets x 3 floors x 4 devices, zoomed crops `z_*.png`, `d1_triptych.png`).

## Defects
**D1 (medium) FAIL, still present: dark horizontal dashes on parquet near wall bases / entrance corner, caused by the lightmap, not the new texture.**
Stacked 1-3 px dark bars, 20-60 px long, at the entrance ("כניסה") corner and beside the sun terrace, visible on desktop DPR 1 and 2, iPhone 13 (and so the real phone path). The new floor texture does not hide them: it makes them readable on the orange wood.
Proof it is the lightmap: `d1_triptych.png` (left = textured, middle = floor texture removed, right = lightmap removed): dashes in the first two, gone in the third. Zoomed: `z_d1_desktop1x_top.png`, `z_d1_desktop2x_top.png`, `iphone13_top_parquet.png` near (740,1130).
Repro: `node logs/gate3-d1.cjs` (writes `after\gate3\d1_*.png`), or `node logs/gate3-visual.cjs desktop2x` and crop `desktop2x_top_parquet.png` x1480 y1180 280x150.
Honest note: gate 2 found desktop DPR 1 (1024 atlas) clean at its view; here the same corner is dashed at DPR 1 too, so the claim "thin-edge barcode gone at 1024" no longer holds on the textured floor.

**D3 (medium-low) FAIL: `test/minimap.test.mjs` now exits 1 (2 failing, iphone + pixel): "the 3D floor follows the tour's floor switch (marble, then concrete live)", `marble colour 1,1,1`.**
Cause: `setFloor`/`floorTex.use` set the floor material colour factor to white when a texture is present, and `window.__dollhouse.floorColor` (read from that factor) is what the unchanged test compares with `manifest.glb.floors.<id>.color`. The tour floor switch itself still works (`floor` = marble; textures change), so this is a contract/test break, not a visible bug. It was green at gate 2 and is a Check line of card 06. Evidence: `gate3-minimap.test.txt` (EXIT 1), repro `timeout 300 node test/minimap.test.mjs`. Fix is either expose the base colour in `floorColor` or update the test deliberately.

**D4 (low) FAIL: race in the lazy floor decode.** `setFloor('concrete'); setFloor('parquet')` in quick succession on a fresh page leaves `__dollhouse.floor = parquet` but `floorTexture.current = concrete`, i.e. the wrong finish is drawn (the slow decode of the first call lands after the cached second call). Desktop and iPhone 13, `gate3-visual-desktop-iphone13.json` -> `race`. Repro: `node logs/gate3-visual.cjs desktop` then read `desktop.race`. Fix: guard `use()` with a sequence token / check `state.floor === id` after the await.

## Check lines
| Line | Result | Evidence |
|---|---|---|
| build_zip rainbow 846 | PASS exit 0, 27 files, 4.85 MB | gate3-build.txt |
| smoke / apartment.test | PASS exit 0 | gate3-smoke.txt, gate3-apartment.test.txt |
| minimap.test | FAIL exit 1 = D3 | gate3-minimap.test.txt |
| check-03 / 04 / 05 | PASS 40 / 47 / 22 ok, 0 FAIL, exit 0 | gate3-check-0N.txt (author copies `*.author3.txt`) |
| check-08 | PASS 8/8, exit 0 (floor switch min pairwise distance 24.4 desktop / 19.9 phone, was 42.7/37.0 before textures; still > 12) | gate3-check-08.txt |
| check-08-fallback | PASS exit 0 (no lightmap, hemisphere 1.05, 0 errors) | gate3-check-08-fallback.txt |
| check-urlfix (rider a) | PASS exit 0, relative exterior.url and relative tour base OK | gate3-check-urlfix.txt |
| probe-labels-embedded (rider b) | PASS 11/11 Pixel 7 + iPhone 13 | gate3-probe-labels-embedded.txt |
| export_dollhouse.py --selftest | PASS "63 cases, 0 failed" | gate3-selftest.txt |
| floor_textures.py determinism | PASS: re-run with the recorded picks gives byte-identical parquet / concrete / marble webp (sha 6adcc4f1..., 97e6dd03..., cbeb010a...) and identical floor-textures.json | gate3-ft.txt, gate3-ft/ |
| 3 floor GLBs share ONE BIN | PASS 208,388 B, sha 51d18730..., 1 buffer each | gate3-geometry.txt |
| geometry = Phase 1 | PASS: 27 nodes both, 0 triangle / bounds / transform diffs | gate3-geometry.txt |
| dollhouse.html growth <= 600 KB | PASS: 2,232,144 - 1,809,571 = +422,573 B | stat |

## Claims
| Claim | Result | Evidence |
|---|---|---|
| 08b texture on every interior dry floor, 3 presets, 3 devices | PASS: `map` set on all 8 `web_floor_parquet` meshes (each with uv1), desktop + iPhone 13 (probe), floors visibly textured in frames at 3d/top/outdoor; Pixel 7 frames captured | gate3-visual-*.json, after\gate3\*_{3d,top,outdoor}_*.png |
| NOT on walls, furniture, terraces, wet floors | PASS: only material `web_floor_parquet` has a map; `web_floor_outdoor`, `web_floor_wet`, `web_cap`, walls, oak, fabrics have map 0. (uv1 attribute also sits on 17 non-floor meshes sharing floor geometry: harmless, unused) | gate3-visual-*.json `mats` |
| Floor switch changes the floor | PASS: three finishes differ (pixel probe above; texture `current` follows each switch), but see D3 and D4 | check-08, visual json |
| Tiling seams / repetition | NOTE (low): the 2 m tile shows soft rectangular step edges at 1/4 and 3/4 of the tile when repeated 2x2 and knots repeat identically; at the 3D/Top presets the floor reads as smooth warm wood grain and the steps are not noticeable. No plank joints are visible at all, so "planks 15-25 cm" cannot be confirmed; the grain is soft and fairly flat. Marble/concrete read as near-flat beige at the presets | tex_parquet_2x2.png, z_desktop_3d_parquet.png, z_desktop_3d_marble.png |
| D2 compact labels <= 2.5 label heights, Top 11/11 | PASS: Pixel 7 max 1.82, iPhone 13 max 2.45 (r-bath-main, at the limit), 0 overlaps, none outside the frame | gate3-labels.out, gate3-labels.cjs |
| Spike code out of the product | PASS: no reference to project_panos / compose_panos / spike-08b in any work-tree file; only floor_textures.py and export_dollhouse.py in `360walkaround/pipeline/` | grep |
| Legal text unchanged | PASS: `apartment.json` legal equals the live dist's (except `source`); every Hebrew string of the live `dollhouse.html` is still present; the caption "הדמיה להמחשה בלבד. הופקה בסיוע בינה מלאכותית מתכנית המכר..." and the full notice are word-for-word the same. (The extra "הדמיה להמחשה בלבד." pill is card 04's, present at gate 2) | gate3-legal.txt |
| Disclosure on AI-skinned floor textures | PASS as ruled (02d: wording unchanged); the page still carries the AI caption. For Eliran: the floor textures now derive from AI-skinned panoramas; the existing sentence "הופקה בסיוע בינה מלאכותית" is the only cover | dollhouse.html |
| Live repo untouched | PASS: `live drift: 0` at start and end | wt.py drift |

## Verdict reasoning
Build, geometry, size, determinism, labels, both riders and legal PASS. FAIL on: D1 (barcode dashes unchanged, lightmap), D3 (a Check test now red), D4 (finish race).
