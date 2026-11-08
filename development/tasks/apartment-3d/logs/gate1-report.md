GATE 1: FAIL (1 defect, minor)

Reviewer: qa-reviewer, fresh context, 2026-11-03. Work tree: `C:\RnD\.wt\apartment-3d\files\Projects\Habait\habait-walkaround\Habait\platform`. Devices: iPhone 13, Pixel 7, desktop 1440x900 (headless Chrome, SwiftShader). Screenshots: `C:\RnD\.wt\apartment-3d\after\phase1\gate1\` (and `gate-c03`, `gate-c04`, plus check-05's own).
Own probes (different method from the author's checks): `gate1-probe.cjs` (+`.txt`), `gate1-probe2.cjs`, `gate1-probe3.cjs`, `gate1-probe4.cjs` in `logs\`. Raw outputs `gate1-*.txt`. The author's old results are kept as `check-0N.author.txt` (the re-runs overwrote `check-0N.txt`).

## Gate lines
| Line | Result | Evidence |
|---|---|---|
| build_zip 846 | PASS (exit 0, 27 files, 4.49 MB) | gate1-build.txt |
| test/smoke.mjs | PASS (exit 0) | gate1-smoke.txt |
| test/minimap.test.mjs | PASS (exit 0). Cold #3d deep link under CPU x4: 2.77-2.96 s (baseline 3.7 s); warm tap 284 ms | gate1-minimap.test.txt |
| test/apartment.test.mjs | PASS (exit 0) | gate1-apartment.test.txt |
| check-03 / 04 / 05 | PASS 40 / 47 / 22, exit 0 each | gate1-check-03/04/05.txt |
| Live repo untouched | PASS: `live drift: 0` (run at the end) | wt.py drift |
| Legal text unchanged | PASS. `apartment.json` legal block equals live dist (only `source` path differs). dollhouse caption: only addition is the pill `<p class="pill">`, a copy of the first sentence; the he/en short text and the full notice are word for word; probe taps the pill and compares to `legal.short` he+en verbatim. Source sentence is in `disclaimer-he-en.md` | gate1-probe.txt, python diff |
| ZIP offline | PASS. Unzipped `846.zip` to `logs\gate1-zip\`, opened `3d/dollhouse.html` via file://: loaded, 28,820 tris, 11 labels, 1 request (the file itself), 0 non-file, no page errors | gate1-probe.txt l.180-182 |

## Card 03
| Acceptance line | Result | Evidence |
|---|---|---|
| `#rooms` has 11 entries; scenes in scenes.json; areas = plan within 0.01 | PASS | check-03; probe (scene per room) |
| Top preset: 11 pills visible, iPhone 13 | PASS (11 standalone and embedded) | probe2 |
| Top preset: 11 pills visible, desktop | PASS | probe2 |
| Top preset: 11 pills visible, Pixel 7 | **FAIL, embedded in apartment.html (frame 382x634): 10 of 11; "חדר רחצה הורים" (r-bath-main) is culled.** Standalone Pixel 7 shows 11. Author's check only asserts >= 7 on phones, so it passes | gate1-probe2.txt "pixel7 top labels"; shot `pixel7_emb_top_labels2.png` |
| `__dollhouseSelect('r-living')`: selected, sheet visible, target within 0.3 m | PASS x3 | check-03 |
| "צפו ב-360°" posts `habait:enter-room` with the right scene | PASS, all 11 rooms, each room_id and scene correct | probe (per-room loop) |
| Labels: Hebrew name + area + מ״ר, `<bdi>`, inside frame, no overlap, English with `#lang=en` | PASS. Area is shown rounded to a whole m² (6 not 6.252): by design, noted | probe |
| Tap a floor selects the right room (truth = plan polygon, point away from pills) | PASS: 10/10 iPhone, 11/11 Pixel, 10/10 desktop | probe |
| Drag 40 px does not select; tap on empty space deselects and hides the sheet; Escape and × close it | PASS x3 | probe |
| minimap.test asserts still pass | PASS | gate1-minimap.test.txt |

## Card 04
| Acceptance line | Result | Evidence |
|---|---|---|
| 3D select living, click 360: tour tab active, frame URL `room=living`; chip visible | PASS x3 | check-04 |
| Chip click returns to 3D, `selected` still `r-living` | PASS x3 | check-04 |
| Tour already loaded: `habait:goto` | PASS. Fallback: a tour that never answers goto gets a reload with `room=bedroom2` after 3 s | check-04; probe4 |
| Deep links: `&tab=3d#tour`, `#3d`, `&tab=photos#bogus`, `#bogus`, none, `&tab=bogus#bogus`, `#photos` | PASS, 8/8 x3 devices | gate1-probe4.txt |
| Phone scrolls the opened panel to just under the sticky tabs | PASS: tabs bottom 115 = panel top 115 | probe4 |
| 390 px: 3D frame above the mobile bar; scrollWidth == innerWidth | PASS (page 390/390, Pixel 412, iframe 360/360 and 382/382) | check-04; probe |
| `#aptFixture` hidden off-localhost without `?dev=1` | PASS | check-04 |
| Legal full text unchanged; caption collapsed to a pill, tap expands | PASS | probe |
| smoke passes; no new analytics event | PASS (event list unchanged). Note below | gate1-smoke.txt |

## Card 05
| Acceptance line | Result | Evidence |
|---|---|---|
| Screenshots at 3 presets (desktop + iPhone) in `after\phase1\` | PASS | check-05; `after\phase1\*.png` |
| 3D preset covers >= 70 % of the frame width | PASS (desktop 77 %). Mesh and alpha bboxes inside the frame at 3 presets x 3 devices, embedded | check-05; probe |
| Model not under the preset bar or the caption (3 presets x 3 devices, orbit) | PASS: 0.0 % overlap | probe |
| Auto-rotate on a fresh open, model in frame through a full turn | PASS. 6 azimuths settled on Pixel 7 and desktop (alpha): min margin 0.038. Fresh open turns on all 3 devices; it is slow only because SwiftShader renders 1-2 fps. My first orbit probe reported a Pixel 7 FAIL (-0.001) and a 2.5 s "no turn" FAIL; both were my wait being too short for the distance to converge, and are void | gate1-probe2.txt, gate1-probe3.txt |
| Glass shows no stripes (<= 2 transitions per 40 px) | PASS (worst 1) | check-05 |
| Idle: frames stop (also with a selection and sheet open) | PASS, 0 frames in 2.5 s | check-05; probe |
| Floor finishes still change the colour (`habait:floor` from the parent) | PASS: parquet, concrete and marble give 3 different colours; `#floor=marble` applies | probe |
| Canvas fades in; no page error; timings no worse | PASS (prepare 89-93 ms; first frame 357 ms desktop, 966 ms phone) | check-05 |

## Defect 1 (FAIL), repro
Open `http://127.0.0.1:8851/apartment.html?project=rainbow&unit=846&tab=3d` in Pixel 7 emulation, call `__dollhouseView.setPreset('top',{animate:false})` in `#dollFrame`. `__dollhouse.labelsVisible` is 10 and `r-bath-main` has no visible label; card 03 says "11 pills visible" on Pixel 7. The same page on iPhone 13 shows 11. Collision culling is also in card 03 item 3, so the card contradicts itself; the main session or Eliran can waive it or ask card 03 for a smaller pill. Severity: low.

## Notes (not defects)
- A label can sit far from its room when it is moved to avoid a collision. iPhone 13 Top: "חדר רחצה כללי" sits over the dining and living area (`iphone13_emb_top_labels.png`). Taps on the pill select the right room.
- `enterRoom` fires `room_view{from:'3d'}`, then `showTab('tour')` also fires `room_view`/`apartment_tab`: two events for one jump. Existing event names, none new.
- Dollhouse posts `habait:enter-room` with target origin `'*'` (`build_zip.mjs:455`); the card says same origin. The receiver checks `e.source`, so it is safe.
- With `#lang=en` the dollhouse root still has `dir=rtl lang=he`; the labels are English.
- Pill text is the legal first sentence "הדמיה להמחשה בלבד." rather than the card's "הדמיה · להמחשה". Legal text is preserved word for word.
- The tour was a stub in all page-level tests (the real tour reads `?room=` and `habait:goto` per `tour.js:36,1139`; read, not run).
