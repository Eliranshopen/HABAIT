GATE 2: FAIL (2 defects: 1 medium, 1 low)

Reviewer: qa-reviewer, fresh context, 2026-11-03. Work tree `C:\RnD\.wt\apartment-3d\files\...\Habait\platform`; headless Chrome (SwiftShader), iPhone 13 / Pixel 7 / desktop 1440x900. No Blender run, no network beyond 127.0.0.1, port 8851 only, live drift 0 (start and end).
A/B: `C:\RnD\.wt\apartment-3d\after\compare.png` (top row desktop, bottom iPhone 13; per preset 3d / top / outdoor, left = Phase 1, right = Phase 2). Frames: `after\gate2\`.
IMPORTANT for the A/B: `after\phase1\*_preset_*.png` are NOT Phase 1 any more. Check-05 is re-run against the baked build and overwrites them (sha256 of `phase1\desktop_preset_3d.png` equals `phase2\desktop_preset_3d_parquet.png`). My true Phase 1 = the author's fallback build (live Phase-1 GLB, sha 1259daf0..., no atlas, hemisphere 1.05), captured by `logs\gate2-ab.cjs` with the same code, presets and devices.

## Defects
**D1 (medium) FAIL: "barcode" dashes are NOT cured on floors when the 2048 px atlas is used (every phone with DPR >= 1.5, i.e. the real iPhone/Pixel path, and any hi-DPI desktop).**
Horizontal dark dashes 1-3 px thick, 20-60 px long, stacked in rows on the parquet near wall bases (entrance / wardrobe corner, and along the kitchen edge). Phase 1 is clean at the same spot.
Repro: `node logs/gate2-ab.cjs`, then see `after\gate2\zoom_streaks_left2.png` (iPhone 13, Top, crop x150 y900 300x140 of `iphone13_p2_top.png`) vs `zoom_streaks_left2_p1.png`; also `logs/gate2-dpr2.cjs` -> `desktop_dpr2_top.png` / `zoom_dpr2_top.png` (desktop DPR 2 = 2048 atlas) shows the same rows. The author's own frame `phase2-author-copy\phone_preset_top_parquet.png` already contains them (same crop identical), so check-08 never asserted this. The 1024 px atlas (desktop DPR 1) is clean at the same view.
Claim refuted: card 07 "thin-edge barcode gone (thin-island collapse)". It is gone on wall tops at 1024, not on floors at 2048.

**D2 (low) FAIL by the stated metric: Pixel 7 embedded Top, `r-bath-main` label sits 2.98 label-heights from its room anchor (limit ~2.5).** iPhone 13 worst = 2.45 (r-bath-main), passes. Visually the pill still touches the bath's upper edge (`after\gate2\labels_pixel7_top.png`); the main session may waive. Repro: `logs/gate2-labels.cjs` -> `logs/gate2-labels.txt`.

## Check lines (outputs in `logs\gate2-*.txt`)
| Line | Result | Evidence |
|---|---|---|
| build_zip 846 | PASS exit 0, 27 files, 4.83 MB | gate2-build.txt |
| smoke / minimap.test / apartment.test | PASS exit 0 each | gate2-smoke.txt, gate2-minimap.test.txt, gate2-apartment.test.txt |
| check-03 / 04 / 05 | PASS 40 / 47 / 22 ok, exit 0 (author copies `check-0N.author2.txt`) | gate2-check-03/04/05.txt |
| check-08 | PASS 8/8, exit 0 | gate2-check-08.txt |
| check-08-fallback | PASS 3/3, exit 0 | gate2-check-08-fallback.txt |
| export_dollhouse.py --selftest | PASS "63 cases, 0 failed", exit 0 | gate2-selftest.txt |
| 3 floor GLBs share ONE BIN | PASS: parquet/concrete/marble BIN 208,388 B, sha256 51d18730..., 1 buffer each | gate2-geometry.txt |
| light.webp <= 600 KB | PASS 143,200 B (phone copy 62,060 B) | dir listing |
| dollhouse.html growth <= 600 KB | PASS 2,197,887 - 1,809,571 = +388,316 B (incl. phone atlas) | stat |

## Card 07 acceptance
| Line | Result | Evidence |
|---|---|---|
| selftest passes | PASS (63/63) | gate2-selftest.txt |
| No flag -> GLB sha equals today's | PASS. `c07-nobake.txt` does not print a hash; I hashed its output (scratchpad `ed-nobake\apt846.glb`, 174,036 B) = 1259daf0b254...1c5c = live `apt846.glb` and `apt846-parquet.glb` | sha256sum |
| 3 GLBs one BIN, atlas <= 600 KB, bake time in report | PASS: BIN as above; `report.json bake{res 2048, samples 128, seconds 263.17, atlas_bytes 143200, scale, scene_sha256}` present; output hashes equal `c07-bake-manifest.json` | gate2-geometry.txt |
| Live scene.blend sha unchanged | PASS: 2bc0d5d8... equals the manifest's `scene_sha256` | sha256sum |
| Visual: no black islands, no seams > 2 px on walls, no light above the 1.2 m cut | PASS at 1024 px and on walls/terrace at 2048 (zoom_terrace_edge4.png, crop_desk3d.png, crop_ph3d.png); geometry ends at the cut so nothing is baked above it. FAIL for floor dashes at 2048 = D1 | after\gate2 |
| Palette override is bake-only | PASS: all 17 material factors identical to Phase 1 | gate2-materials.txt |

## Card 08 acceptance
| Line | Result | Evidence |
|---|---|---|
| Lightmap on every material except glass and web_cap | PASS, own probe: lightMap on 15 materials, none on `web_cap`, `glass` (desktop and iPhone 13) | gate2-ab.txt |
| 3 presets x 3 floors captured; floor switch changes floor colour | PASS: min pairwise distance 42.7 desktop / 37.0 phone (> 12) | gate2-check-08.txt |
| Atlas removed -> clean fallback = Phase 1 | PASS: no lightmap, hemisphere 1.05, 0 page errors; fallback GLB sha = live; visible text identical to baked page | gate2-check-08-fallback.txt, gate2-ab.txt |
| +388 KB <= 600 | PASS | above |
| CPU x4 cold open | PASS: cold #3d deep link CPUx4 3111 ms (iphone) / 3240 (pixel) on serve.mjs, 3324 / 3297 gzip; baseline 3.7 s. Warm CPUx4 951 / 917 ms | gate2-minimap.test.txt |
| Phone tier (< 1.5 DPR or deviceMemory <= 4 -> 1024 atlas) | PASS to the letter: desktop DPR 1 -> 1024, iPhone 13 (DPR 3) -> 2048, DPR 2 -> 2048. Consequence: real phones (DPR >= 2, Safari has no deviceMemory) get the 2048 atlas, which is where D1 shows | gate2-ab.txt, gate2-dpr2.cjs |
| 0 network requests, no page errors | PASS (file://, 0 non-file requests, 0 errors, 4 device/build combos) | gate2-ab.txt |

## Other lines
| Line | Result | Evidence |
|---|---|---|
| Geometry unchanged from Phase 1 | PASS: 27 nodes both; per-node triangle count equal (report.json, 0 diffs) and accessor bounds equal within 0.005 m for all mesh nodes; node transforms equal | gate2-geometry.txt |
| Legal text unchanged | PASS: `apartment.json` legal equals the live dist's (except `source` path); dollhouse visible text (caption, pill, full notice) identical to the Phase 1 page; sentences present in `disclaimer-he-en.md` | gate2-legal.txt |
| Live repo untouched | PASS: `live drift: 0` at start and end | wt.py drift |
| Rider (a) relative exterior.url | PASS. Real browser (iPhone 13), `apartment.json` intercepted: `exterior.url="/hold"` -> 5 tabs render, 0 errors, back-link `http://127.0.0.1:8851/hold?from=platform&project=rainbow&room=tower`; absolute `http://127.0.0.1:8899/` unchanged form. Control: the LIVE `apartment.js` served into the same page throws `Failed to construct 'URL'` in `backToBuildingUrl` and shows "Invalid URL" | gate2-urlfix.txt/.cjs, after\gate2\urlfix_*.png |
| Rider (b) embedded Top labels | 11/11 on Pixel 7 and iPhone 13, 0 overlaps, all inside the frame = PASS; far-from-anchor: iPhone max 2.45 PASS, Pixel 7 `r-bath-main` 2.98 = D2 | gate2-labels.txt |

## Notes (not defects)
- `after\phase1\` frames were overwritten by re-runs of check-03/04/05 (author's and mine): use `after\gate2\*_p1_*` for Phase 1. Pre-rerun backups: `after\phase1-author-copy`, `after\phase2-author-copy` (same content, same cause).
- `c07-nobake.txt` prints no hash; the byte-identity is proved only by `c07-bake-manifest.json`, which I confirmed on the artifact.
- At 1024 and on walls Phase 2 reads as real light (soft wall gradients, contact darkening); the parquet colour is unchanged.
- Card 02d (disclosure wording) is untouched by this build.
