# Knowledge reuse — RAINBOW (apt846) and Pesel_yazamot (kedma-d1) for the Na'ama house

Written 2026-11-17 for the job "דגם חצב, 3 rooms, 80 m², Moshav Na'ama (הרי זהב)". Read-only investigation: no Blender run, no paid call, no network, no `.env*` file opened. Every row says whether the artifact was seen on disk on 2026-11-17.

**Binding note.** No geometry and no assumption of apt846 or kedma-d1 may be copied into the new house. That covers wall polygons, room loops, openings, camera points, ceiling heights (Kedma 290 cm assumed, pilot 260 cm assumed), sill and head heights (Kedma 100 / 105 / 150 / 215 cm, all assumed), the Rainbow material board, the terrain offset (−300 cm = "one floor below", wrong for a house on the ground) and every first-look heading. Only tools, methods, settings and lessons are reused. Every Na'ama dimension comes from its own sales-plan PNG; every assumption is listed as one.

Path short names used below:

| Short | Path |
|---|---|
| `ENG` | `C:\RnD\Projects\3Dengine\pipeline` (the Rainbow pipeline, brought unchanged from git `a63494a`; do not edit) |
| `P360` | `ENG\360walkaround\pipeline` |
| `T360` | `ENG\Habait\tour360` |
| `KWT` | `C:\RnD\.wt\kedma-d1\Projects\3Dengine` (Kedma worktree, branch `kedma-d1`, six tracked pipeline files modified, nothing committed) |
| `KJOB` | `KWT\jobs\kedma-d1` (gitignored; the only copy of the hand-trace and fix scripts) |

## 1. The two projects in one table

| | RAINBOW apt846 | Pesel_yazamot kedma-d1 |
|---|---|---|
| Source | CAD-exported PDF, vectors and layers, to scale (2.268 px/cm) | furnished marketing raster, one Photoshop image per PDF, no vectors, no text, no printed scale |
| Trace | `trace-plan.mjs` (semi-automatic) + `trace-snap.py`; later `auto-trace.mjs` | auto-trace FAILED (116/139); hand trace: walls by colour, scale fitted from 24 printed dimensions |
| 3D | `build_scene.py` general-polygon branch, 11 cameras | same builder, 13 cameras, 15 rooms, 22 openings, 54 fixtures |
| Render machine | lab laptop, RTX A2000 4 GB (OptiX), 8192×4096 @ 256 spp ≈ 23 min a point | this machine, CPU only, 2048×1024 @ 16 and 3072×1536 @ 20–32 |
| Final look | whole-panorama AI skin (gpt-image-2.5 through fal), 3840×1920 | first a whole-panorama skin (rejected by Eliran), then view-by-view painting on the CG view (Nano Banana), 4096 wide |
| Spend | ledger $264.65 (record in `C:\RnD\memory\HOT.md` only; the apt846 `_local` ledger is NOT on disk) | $30.13 in `KWT\pipeline\Habait\tour360\apartments\kedma-d1\_local\ledger.json` (verified on disk, 390 rows, cap 44.9) |
| State | live on habait-flow | not deployed; kitchen redone, 12 viewpoints open |

Neither project produced a photoreal picture from Cycles alone. In both, the Cycles render is the geometry reference and the photoreal look was bought from an image model. A Cycles-only photoreal result has no proven recipe here.

## 2. Plan parsing and geometry extraction

| Tool | What it does | On disk | Use for Na'ama |
|---|---|---|---|
| `T360\tools\auto_pages.py` | PDF pages, embedded images, drawing counts | verified | no (input is a PNG) |
| `T360\tools\auto_walls_pdf.py` | walls, windows, doors from CAD PDF layers | verified | no (no vectors) |
| `T360\tools\auto_prep.py` | brochure plan → greyscale by the wall colour | verified | method only |
| `T360\tools\extract-walls.mjs` | grey wall fill → components → polygons in cm | verified | yes, if the walls are one flat colour |
| `T360\tools\trace-plan.mjs` | flood rooms from seeds, bars across openings | verified | with care: every pane becomes floor-to-ceiling glass (sill 0), no window with a sill |
| `T360\tools\auto-trace.mjs` | PDF → plan with no hand work (paid judge) | verified | no: fails on furnished rasters |
| `T360\tools\plan-grid.mjs` | 100 cm labelled grid over the sheet | verified | yes |
| `T360\tools\dimline-reader.py` | reads a printed dimension between its own ticks | verified | yes, if the sheet has tick marks |
| `T360\tools\printed_dimensions.py` (+ `.mjs` wrapper) | the one check "trace agrees with the printed dimensions" | verified | yes |
| `T360\tools\trace_check.py`, `dims_gate.py`, `trace-snap.py` | trace gate; loops snapped onto wall faces | verified | method |
| `KJOB\hand\wall_probe.py` | finds the wall fill colour, writes a clean wall mask | verified | yes: the method that worked on a furnished raster |
| `KJOB\hand\wall_polys.py`, `probe_extras.py` | wall mask → polygons; lighter partitions and boxes by colour | verified | yes |
| `KJOB\hand\zoom.py`, `sheet_zoom.py` | gridded crops of the sheet for reading positions by number | verified | yes |
| `KJOB\hand\build_clean.py`, `post_edit.py` | clean CAD-like sheet for the tracer; windows with a sill added after the trace | verified | pattern only (Kedma data inside) |
| `KJOB\hand\snap_loops.py`, `split_open_edges.py`, `add_cistern.py` | three plan patches the gate needed | verified | pattern only |
| `KJOB\hand\plan_audit.py`, `audit_page.py` | sheet beside a drawing of the model alone, per room, plus printed dimensions against wall-to-wall spans | verified | yes: run before any render |
| `KJOB\hand\geometry.json`, `transform.json` | Kedma's measured geometry and px→cm transform | verified | never (Kedma data) |
| `Projects\Habait\research\fidelity-audit-2026-11-04\REPORT.md` | the apt846 audit | NOT on disk (the folder holds context files only) | – |

What worked: wall fill extracted by colour plus a small morphological opening (Kedma: grey 85, 10 clean wall groups); scale fitted from the printed dimensions (Kedma 3.3506 px/cm, 24 of 24 within max(2 %, 5 cm)); a hand trace with every door, window and passage measured into a geometry file; a second, independent reading of the sheet against a model-only drawing (found 12 real differences after the first reading was called equal).

What failed: auto-trace on a furnished raster (open space and balcony assigned wrongly, no window read); fixture rectangles read by eye (up to 30 cm off); a centre-line span compared with a printed dimension; a furnish rule that rotated a kitchen island 28°.

## 3. Blender automation (`P360`, all verified on disk)

| Script | Lines | Role | Notes for Na'ama |
|---|---|---|---|
| `build_scene.py` v1.5.0 | 2,640 | `plan.json` → `.blend`, headless, deterministic | needs a plan in SCHEMA form; sets Cycles bounces and colour management in the scene |
| `plan_general.py` | 1,251 | 2-D half of the general-polygon branch | read its docstring first |
| `render_pano.py` v0.3.0 | 1,630 | `.blend` + camera points → equirect + depth | reusable as is (section 7) |
| `render_tour.mjs` | – | batch wrapper, resumable by input hashes | modes: draft 4096×2048 @ 64, final 8192×4096 @ 256 |
| `place_cameras.py` | 490 | deepest interior point, longest sightline, z 140 cm | a general plan is never auto-filled; the runner's own rule uses eye 160 cm |
| `materials_kit.py` v0.3.0 | 443 | material presets | section 5 |
| `furnish_from_plan.py`, `general_furnish.py`, `placement_templates.py` | 1,830 / 1,168 / 1,723 | furniture by rule + audit | the fixed versions are on branch `kedma-d1` only (`KWT\pipeline\PORT-CHANGES.md`, verified) |
| `export_dollhouse.py` | 1,597 | cut-away GLB (Draco, flat materials) + top view, optional light bake | optional; 3 min on this CPU for Kedma |
| `floor_textures.py` | 148 | rectifies a floor square out of a finished panorama into a tileable texture | not a texture library |
| `validate-plan.mjs`, `validate-plan-general.mjs` | – | schema enforcement | yes |
| `SCHEMA.md`, `ENV.md`, `GENERAL-POLYGONS.md`, `RENDER-LEDGER.md` | – | contracts and measured records | read; `ENV.md` figures are the lab RTX machine, not this one |

Frame contract (build_scene.py:49–58): plan in centimetres, +y down; world X = x/100, world Y = −y/100, Z up; yaw 0 = plan north, clockwise; camera euler (90°, 0, −yaw).

## 4. Wall and opening reconstruction (general branch, build_scene.py:945–1178)

| Element | How it is built | Line |
|---|---|---|
| Walls | each `walls[].polygon_cm` extruded to `height_cm` (`new_prism`); thickness is the drawn fill itself, never assumed | 956–963 |
| Facings | thin boxes whose front is the room loop edge, buried 2 cm into the wall; closes the 2–5 cm stroke band | 965–979 |
| Skirting | 7 × 1.6 cm along facings; `--skirting off` exists (Eliran's rule: no skirting) | 981–993 |
| Panes | `panes[]` extruded from `sill_cm` to `head_cm` in the glass material | 995–1001 |
| Doors / windows | an infill box across the span, then an oriented cutter (overshoot 8 cm per side), Boolean DIFFERENCE, solver EXACT, applied in plan order | 1017–1085 |
| Glazed openings | kinds `window`, `sliding_door`, `glazed_door` get a 0.8 cm glass leaf; `entrance_door` a 4.5 cm solid leaf | 1047–1055 |
| Sills | `sill_cm` / `head_cm` per opening set the cutter's z range; a skirting is not cut where the sill is above 0 | 1064, 1076 |
| Virtual boundary | `kind: "opening"` with head = ceiling: nothing built, nothing cut | 1018–1022 |
| Pane-joint posts, door-in-glass frames | close slits where glass stops short; frame a door cut through glass | 1005–1016, 1117–1140 |
| Floor / ceiling fill | 1 cm raster fill, 0.25 cm below floors and above ceilings, never coplanar | 1149–1164 |
| Checks | every wall top-face area against the polygon's shoelace area, 1 mm bar; camera clearance 40 cm | `verify_general` 1311 |
| Terrain | 200 m plane at z −300 cm unless `plan_meta.ground_offset_cm` is set | 779–811 |

Glass material (materials_kit.py:124–158): Principled, transmission 1.0, IOR 1.45, roughness 0.02, mixed with a Transparent BSDF for shadow rays only, so sunlight reaches the floor. No frame profiles, mullions or reveals are modelled beyond a 6 × 7 cm frame constant.

## 5. Materials, textures, lighting

| Item | Fact | On disk |
|---|---|---|
| Wall, ceiling, skirting, metal, fabric | flat-colour Principled presets (`simple()`), procedural, no image | `P360\materials_kit.py` verified |
| Floor, tiled | procedural Brick Texture grid in world space, 6 mm grout, sizes from a material board (`floor_tile`, 210–246) | verified |
| Floor, wood | image PBR set `laminate_floor_02` (Diffuse, Rough, nor_gl, 2K JPG) through `floor_wood` (161–207); falls back to a flat colour with a WARN | the set is NOT in the engine home; verified at `C:\HABAIT-Archive\Habait-Backup\habait-walkaround\360walkaround\pipeline\probe\probe-assets\textures\laminate_floor_02\` (3 files, 8.2 MB) |
| Style palette | 15 flat PBR entries (fabric, oak, walnut, metal, ceramic, glass, mirror…) in `ENG\360walkaround\catalog\style-habait-modern.json` v1.3.0 | verified |
| HDRI | `qwantani_noon_puresky_4k.hdr`, 17,857,544 B, pure sky, strength 1.0, rot_z 38.9° (measured), selected by slug + sha256 | verified at `P360\probe\probe-assets\hdri\` |
| Second HDRI | `clarens_midday_2k.hdr`, 6.5 MB | only in `C:\HABAIT-Archive\Habait-Backup\…\probe-assets\hdri\` (verified there) |
| Sun | SUN lamp, plan bearing 165°, elevation 52°, 4 W/m², disc 0.526° | build_scene.py:126–130, 1930–1937 |
| Interior lights | AREA disc flush under the ceiling facing down, `40 + 6 × area_m2` W, warm; POINT bulb in pendants; daylight AREA panel 35 W inside glazing wider than 200 cm | style lock `lighting` |
| Colour management | AgX, look "AgX - Punchy", exposure 0 | build_scene.py:2092–2098 |

There is no library of photoreal PBR surface materials (plaster, stone, wood, tile images). The only image textures on disk are the 2K maps inside the ten Poly Haven models.

## 6. Furniture catalog

Folder `ENG\360walkaround\catalog\models\` (verified): 57 model folders, 275 MB, CC0, sha256-locked in `catalog.manifest.json`.

| Source | Models | Format | Size | Quality |
|---|---|---|---|---|
| Kenney Furniture Kit | 45 | `.glb`, about 23 KB each, no textures | 924 KB | low-poly game-kit stand-ins: beds, sofas, all kitchen units, sink, stove, fridge, hood, toilet, bathtub, shower, tables, desk, TV, rugs, lamps |
| Poly Haven | 10 | `.blend` + 2K PNG/EXR/JPG maps | 274 MB | photoreal PBR: arm chair, ceiling lamp, 2 coffee tables, wooden cabinet, outdoor table + chair set, potted plant, steel shelves, display shelves, picture frame |
| Quaternius | 2 | `.glb` | 248 KB | low-poly |

Kedma's record: stand-in models are a class of error. A squeezed dining chair was painted as two different stools; the catalog fridge was painted with a window in it. They were replaced by procedural pieces in `general_furnish.py` on branch `kedma-d1` (bar stool, pouf, lounger, washer, tall cabinet column, round table, bathtub on its drawn rectangle). The Kenney pack zip can no longer be downloaded; the copies are the engine home's cache and `C:\HABAIT-Archive`.

## 7. Rendering: settings, cameras, CPU time on this machine

Settings `render_pano.py` applies (line numbers in `P360\render_pano.py`): engine CYCLES (351); device AUTO → OPTIX, CUDA, then CPU fallback (204–234; on this machine the sidecar records "no GPU backend available -- fell back to CPU"); samples default 256 (158); adaptive sampling on, threshold 0.01 (159–160, 353–354); denoiser OPENIMAGEDENOISE on the CPU (355–358); seed 0, no animated seed (359–360); resolution W + 2×pad by H, 100 % (366–368); wrap pad default 512 columns each side, cropped in the compositor (111, 302–334); camera PANO / EQUIRECTANGULAR, longitude ±180° × pad scale, latitude ±90° (266–299); output WebP quality 90, optional PNG master, depth as 24-bit RGB PNG in centimetres (377–386, 446–455); 2:1 enforced (1529); self-checks for size, 2:1, an all-black polar row, depth holes (1168–1196). Bounces and view transform are NOT set there; they come from the `.blend` (build_scene.py:2084–2098: max 12, transmission 12, transparent 16, AgX Punchy).

Cameras: eye 160 cm in the runner rule (`run-project.mjs`:379) and `cameras.json` `eye_m` 1.6; 140 cm in `place_cameras.py`:72; clearance 40 cm; one point per room, more above 20 m².

Measured on this machine (i9-13900H, Iris Xe, 16 GB; sidecars `KWT\pipeline\360walkaround\tours\kedma-d1\renders\cp-*\pano.render.json`, verified):

| Resolution (rendered with pad) | Samples | Wall clock per point |
|---|---|---|
| 2048×1024 (3072×1024) | 16 | 59 s, 64 s, 95 s, 148 s |
| 3072×1536 (4096×1536) | 20 | 153, 178, 247, 252, 273, 322, 447 s |
| 3072×1536 (4096×1536) | 32 | 264 s, 501 s |
| 4096×2048 | 64 | about 25 min a point (`C:\RnD\memory\runs\2026-11-04-project-runner.md`: "~50 min for 2 points") |
| 1024×512 | 16 | about 1 min a point (same record) |

Cost notes: the 512 pad adds 50 % pixels at 2048 wide, 33 % at 3072, 25 % at 4096; `--wrap-pad 128` is the documented fallback (render_pano.py:107–110). One Blender process for all points pays the scene sync once. A run over 10 minutes is killed by the tool limit: chunk with `--points`.

## 8. Panorama viewer

`T360\viewer\` (verified): Pannellum 2.5.6 vendored (`vendor\pannellum-2.5.6.js` 56,359 B, `.css` 10,771 B), `tour.js` 197,648 B, `tour.css`, `template.html`, `edit-live.js`, six self-hosted woff2 fonts. `build-tour.mjs` inlines the scripts into one page (template.html:251–254). No CDN and no external URL in `template.html` or `tour.js`. It works offline from a local static server (`T360\tools\serve-dist.mjs`); opening it as `file://` was not tested.

Kedma's viewer rules exist on branch `kedma-d1` only (`KWT\pipeline\Habait\tour360\viewer\tour.js`, 201,153 B, uncommitted): eye-level limit `tiltBounds` (285–291), wide first look `fitHfov` (270–279), scene config (1377–1381), `applyTilt` (1448), Pannini projection `PAN_D` (226–269) with two hooks in the vendored library. Data: `apartment.json` `view: {tiltDeg: 10, pannini: 1}`.

## 9. fal.ai and OpenRouter integrations

| Script | Endpoint as written in the code | Booked price |
|---|---|---|
| `T360\tools\image-models.mjs` (model table) | `openai/gpt-image-2.5/sunburst/edit` | high $0.60, medium $0.20, low $0.06 per 2048×1024 |
| same | `fal-ai/nano-banana-2/edit` | $0.08 at 1K; 2K × 1.5 = $0.12; 4K × 2 |
| same | `fal-ai/bytedance/seedream/v4.5/edit`, `fal-ai/flux-2-pro/edit` | $0.04, $0.13 (both refused on Kedma: they copied bends) |
| `T360\tools\fidelity-gate.mjs` | `fal-ai/image-preprocessors/depth-anything/v2` | $0.01 a call |
| `T360\tools\scan-pieces.mjs`, `consistency-check.mjs` | OpenRouter chat completions (`google/gemini-3.7-flash` for the judge) | scan about $0.04 a scene; judge $0.009–0.017 a call |
| `KJOB\flatfix-call.mjs` | one ledgered image call per straight-line view, dry by default, `--go` sends, `--cap` required | by the table above |
| `KJOB\fal-price.mjs` | fal pricing API by endpoint id | $0 |

Key handling: `T360\tools\file-ledger.mjs` `loadEnv(root)` (lines 22–33) reads the keys file under the given root by NAME into the child's environment and never prints it; the root is `HABAIT_ENV_ROOT` = `C:/RnD` (`run-project.mjs`:48). Names: `FAL_KEY`, `OPENROUTER_API_KEY`.

Ledger: `apartments\<id>\_local\ledger.json`, schema `tour360/ledger.v1`: `{cap_usd, note, rows[]}`, a row = `{seq, at, op, scene, model, model_key, reserved_usd, settled_usd, status, inputs_hash, width, height}`. A row is reserved BEFORE the request and settled after; the total is the sum of settled-or-reserved; a call that would pass the cap is refused; an answer already on disk under its input hash costs $0.

Measured on Kedma (the ledger, verified): 28 whole-panorama calls at $0.60 = $16.80; flat-view fixes 7 high $4.20, 14 medium $2.80, 34 Nano Banana $3.04; 175 depth calls $1.75; scans $0.74; judge $0.51. Known losses: `skin-project.mjs --keep-picks` paid $0.66 unasked; a paid batch can exhaust the fal balance and take production's typed change down.

## 10. QA procedures and helpers

| Check | Tool | On disk | Needs |
|---|---|---|---|
| 2:1, size, black polar row, depth holes | inside `render_pano.py` (1168–1196) | verified | every render |
| Wrap seam metric and strip | `T360\tools\seam-park\seam.mjs metric\|strip` | verified | pano files, `HABAIT_APP_DIR` |
| Straight-line contact sheet from one panorama | `KJOB\hand\look_sheet.py` | verified | pano file only (generic) |
| Reference view against a browser screenshot | `KJOB\hand\browser_view.py` | verified | pano file + screenshot (generic) |
| Rectilinear cutter library | `T360\tools\pano-geometry.mjs` (`loadPano`, `render`) | verified | sharp |
| Two-panorama side by side | `KJOB\flatview.mjs`, `flatsheet.mjs`, `hand\flatcheck.py` | verified | Kedma paths hard-coded |
| Fidelity gate (plan ray-cast against picture depth, bar 1 %, cap 2 %) | `T360\tools\fidelity-gate.mjs`, `T360\fidelity.json` | verified | apartment layout, paid depth calls |
| Cross-scene consistency | `T360\tools\consistency-check.mjs` | verified | apartment layout, paid judge |
| Openings kept by a skin | `T360\tools\openings-test.mjs` | verified | CG + skin |
| Built-tour smoke test (2:1 from the WebP header, off-site references) | `T360\tools\smoke.mjs` | verified | a built tour |
| 1440×900 and 390×844 | `ENG\Habait\tools\qa\responsive-gate.mjs`; `T360\tools\qa\views.mjs`, `levelview.mjs`, `allbuttons.mjs`; `shots.mjs` | verified | a served tour URL, playwright-core + Chrome |
| Seam instrument of the lab | `360walkaround\scripts\g0-seam-poles.mjs`, `360walkaround\server\seam.mjs` | NOT on disk | – |

What the 1 % gate does not see (Kedma, 2026-11-17): a fixture rotated in the model, a door drawn 7–8° off, an invented wall in an opening, windows drawn too tall, objects bent near the camera.

## 11. Previously solved problems and known failures

| Problem | RAINBOW | kedma-d1 |
|---|---|---|
| Inaccurate scale | sheet to scale; `dimline-reader.py` read 12 dimensions at 0.9989–1.0038; loops 2.7–4.7 cm inside the walls fixed by `trace-snap.py`; rule: a printed dimension is checked between its own extension lines | scale fitted from 24 printed dimensions; `snap_loops.py` (loops 1–5 cm inside the faces); fixtures up to 30 cm off until read on a gridded overlay; 22 dimensions re-audited within 2 % or 5 cm |
| Wall thickness | walls are the extracted fill polygons, checked to 1 mm; no defect record found | same; lighter partitions and cistern build-outs were missing from the wall mask and added by hand (`probe_extras.py`, `add_cistern.py`) |
| Reversed normals | prevention only: slabs flipped when the normal is wrong (build_scene.py:240–252, 857–865), loops must be positively oriented; no defect record found | no record found |
| Overlapping geometry | coplanar faces leak light in Cycles 4.x even with one material (`GENERAL-POLYGONS.md` §4 #4): fill ±0.25 cm, infill faces 0.1 cm short, facings buried 2 cm; "every wall once" against z-fighting | room loops lying on or inside a wall solid rendered pure black walls: render from loops 1–2 cm inside the room (`hand\render_base.py`) |
| Unrealistic glass | sun blocked by refractive glass: shadow-ray transparent mix; 0.8 cm real pane; a door cut through glass needs a frame; slits at pane ends need posts | clear glass railing invisible in the CG view (`rail_guide.py`); tracer makes floor-to-ceiling glass only, windows with a sill added by `post_edit.py` |
| Weak photorealism | CG is structure only; the look was an AI skin, which invented a glass wall, a window and a doorway (3 S0) | whole-panorama skin not geometry-true and half the sharpness; Eliran: "looks cheap", blurred; redo paints straight-line views on the CG view; low-poly stand-ins painted wrongly |
| Inefficient CPU rendering | lab GPU; CPU about 7× slower there; hybrid GPU+CPU 18 % slower | 16–32 spp + adaptive 0.01 + OIDN; one process for all points; resume by input hash; renders made before the reading of the sheet was settled were waste |

## 12. What we reuse for Na'ama, and what we do not

| Item | Decision | Why |
|---|---|---|
| Wall fill by colour, scale fit from printed dimensions, gridded overlays, second independent reading | reuse the method | the only route that worked on a raster sheet |
| `plan-grid.mjs`, `printed_dimensions.py`, `plan_audit.py` pattern | reuse | $0, sheet-true |
| `auto-trace.mjs`, `trace-plan.mjs` as the tracer | do not reuse | fail or need three patches on furnished rasters; a small rectangular house is faster traced by hand into a geometry file |
| `build_scene.py` wall, opening, sill and glass construction; the glass material; the non-coplanar rule | reuse the technique | proven, checked to 1 mm |
| `render_pano.py` | reuse as is | wrap pad, 2:1 and hole checks, sidecar, depth |
| Cycles settings (adaptive 0.01, OIDN, AgX) and the measured CPU times | reuse for planning | measured here |
| `_blender.lock` protocol | must follow | another session renders on this machine today |
| HDRI `qwantani_noon_puresky_4k.hdr`, the sun rig, the luminaire rule | reuse | on disk, CC0, non-locating |
| Poly Haven models (10) | reuse | photoreal |
| Kenney and Quaternius models (47) | do not reuse for final pictures | low-poly stand-ins |
| Flat-colour material presets as the final look | do not reuse | not photoreal; image PBR materials are needed |
| Pannellum 2.5.6 (vendored, offline) and the eye-level + wide-first-look rules | reuse | Eliran's standing viewer rules |
| The full tour system (rings, catalog, edit API, packaging) | do not reuse today | not asked; carries apt846 house data |
| Whole-panorama AI skin | do not reuse | rejected: not geometry-true |
| fal ledger pattern (reserve, settle, cap, dry by default) | reuse if any paid call is approved | root §7 |
| Any plan, camera, heading, material board or assumption of apt846 or kedma-d1 | never | another building |
