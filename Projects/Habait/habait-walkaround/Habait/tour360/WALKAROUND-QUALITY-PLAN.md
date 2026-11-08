# Walkaround quality — the improvement plan (v0.1, 2026-10-28)

**Ask (Slava, 2026-10-28):** *"use the grill me skills and analyze my 3d walk around, understand how can you make it better, you may use also REA skill to check other platforms on the market and understand how can we improve it by quality ... research that, understand that and lets write the best plan for improvements."*
**Subject:** the apartment 846 walkaround, live at `https://habait-tour-846.vercel.app` (Rainbow Tel Aviv, floor 16; eleven rooms generated from the sales plan on 2026-10-28; the change bar behind the code).
**Method:** four grilling rounds through the question tool (24 rulings, §1) · three research lanes (`research/walkaround-quality/01–03`) · six browser captures with the REA tools (`qa-evidence/tour360/walkaround-quality/captures/`) · eight measured probes on fal.ai for ≤ $5.90 of the $50 he allowed (`qa-evidence/tour360/walkaround-quality/probes/PROBES.md`) · the benchmark `qa-evidence/tour360/walkaround-quality/BENCHMARK.md`.

---

## 0. The answer first

1. **What is wrong with 846 is the picture's origin, not the viewer.** Slava's verdict (D-WQ-2): it looks AI-painted and the rooms do not read as one apartment. Both come from drawing each room as a free sample from a 2D plan crop; no reference set removes that drift (lane 02 §9), and the sizes are approximate by construction.
2. **The cure is measured: build the geometry first, paint it second.** The Blender plan-to-pano pipeline we already own (`360walkaround/pipeline/`, 14-room pilot rendered, exact depth per camera) gives plan-true walls, openings and furniture. GPT Image 2.5 then re-skins that render into a photograph while keeping every wall, opening and piece where the render put it; a second room skinned against the first comes back as the same apartment (probes P03–P04). Muse does the same at a hundredth of the price for drafts. That is lane C, ranked first by the generative lane and chosen by Slava (D-WQ-13).
3. **The walk is the second gap, and it is shape data, not pixels.** Matterport moves through a mesh, krpano through a 16 KB room model with motion blur, Pano2VR through a hidden GLB; ours is a 650 ms dissolve (lane 01 §2, captures C2–C4). The CG lane gives exact depth for free, so the depth-based move becomes ours. First the $0 walk-in (turn to the door, zoom forward with blur and fade), then the true 3D move (D-WQ-14).
4. **Sharpness is the third gap, worst on phones.** 5.7 px/° on phones and 10.7 on desktops against 22.8–45.5 at Matterport (lane 01 §3). A seam-safe 2× upscale keeps the edges joined (P02: 6.2 against 11.9 inside) and tiles let a phone load only what it looks at (D-WQ-15).
5. **The change bar stays unique and gets a second gear.** No product generates a change inside a 360 walk (lane 01 §5, lane 03 §0.4 names Treedis as the nearest: a typed edit on a 4K pano at about $0.30–0.60, outside the walk). On the new lane a whole-apartment change patches the view now and re-skins the apartment behind, so finishes, looks and time of day agree in every room (D-WQ-21).
6. **Israel's bar is stills, not tours.** Fourteen developers, eighteen pages: photoreal CGI stills at about 2048 px, a film, plan cards and a lead form; no walkable tour, no visitor-side change (lane 03). We are below the stills on sharpness and above every page on walkability; after this plan we are above on both.

---

## 1. The rulings (Slava, 2026-10-28, through the question tool; recorded as D-WQ-1…24 in `docs/governance/DECISIONS.md`)

| # | Question | Ruling |
|---|---|---|
| D-WQ-1 | Who judges "better" | **The developer's sales office**: the walk must beat what Israeli developers buy today as a sales tool they would pay for; the buyer side inherits it |
| D-WQ-2 | His walk of 846 | **It looks AI-painted, not photographed** and **the rooms don't read as one apartment** (not the walk, not the chrome) |
| D-WQ-3 | Inputs | **Sales plans (PDF) for new-build projects** |
| D-WQ-4 | The screen | **A phone, from a WhatsApp link** |
| D-WQ-5 | This round delivers | **A plan plus a measured benchmark report**; building starts after his ruling on the plan |
| D-WQ-6 | The habait-walkaround board | **The plan re-cuts the board; step 2 waits** |
| D-WQ-7 | Research spend | **Up to $50 on measured probes** (spent ≤ $5.90, §6) |
| D-WQ-8 | The AI's role | **The change bar, made fast and whole-apartment**; no talking |
| D-WQ-9 | Per apartment | **Up to $150 and a working day, with my review** |
| D-WQ-10 | True to plan | **Measurably true**: walls, windows, doors and ceiling height from a 3D model built from the plan |
| D-WQ-11 | The date | **Within a month** (the pitch to Israel Canada) |
| D-WQ-12 | Review | **I review every room; he sees the result** |
| D-WQ-13 | The lane | **CG geometry + AI skin** |
| D-WQ-14 | The walk | **Two tiers: the walk-in first, then the true 3D move** |
| D-WQ-15 | Sharpness | **Tiles from a 2× seamless upscale** |
| D-WQ-16 | Plan intake | **Hand-trace 846 now; a DWG/DXF importer for scale**; the raster tracer later |
| D-WQ-17 | The V2 rule (S-V2-2, 2026-09-01: no generative call on the CG lane) | **Reopened for the skin, the geometry rule kept**; an Original/Designed switch with the AI label |
| D-WQ-18 | The developer's plan (consent) | **Private pitch first; Israel Canada's consent before any wider use** (OWED-656 stands) |
| D-WQ-19 | Measurement | **Dimensions on the plan sheet only, for now**; no ruler inside the picture until the skin passes the openings test |
| D-WQ-20 | World Labs depth-to-panorama | **Skip it; GPT is proven** (no new key, no new vendor) |
| D-WQ-21 | Whole-apartment changes | **Patch the view now, re-skin the apartment behind** |
| D-WQ-22 | The look | **One Habait designer look, swappable per project** |
| D-WQ-23 | The writers | **Main session plus one widened engineer** (the walkthrough engineer's boundary widened to `Habait/tour360/**`) |
| D-WQ-24 | Build cap | **$200 for the round**, every dollar ledgered and reported |

Standing rails that bind every card: disclosure on every scene and in the footer (root `CLAUDE.md` §6); every prod deploy its own go; secrets by name only; no Vercel command inside the harness tree; the Machine resource rules (Blender renders and headless Chrome are heavy: `timeout` first, foreground, one at a time, point-chunked); English toward Slava; questions through the question tool.

---

## 2. What was measured

### 2.1 The probes (`qa-evidence/tour360/walkaround-quality/probes/PROBES.md`, ≤ $5.90)

| # | Probe | Result | What it decides |
|---|---|---|---|
| P01 | Marigold depth on a generated pano (2048, $0.02) | a usable relief of the living room; relative, perspective-trained; the floor under the camera and the ceiling read nearest (correct for an equirect) | a 2D model's depth is a stand-in; the CG lane's depth is exact and free |
| P02 | SeedVR2 seamless 2× on `04-living` 3840→7680 ($0.03) | edge join **6.2** (11.9 inside) against the original 13.3 (14.2): the edges still join; sharper at 100 %; foliage slightly synthetic | the upscale for the tiles is safe on the sphere's seam |
| P03 | "AI skin" on the pilot apartment's CG living room, six editors, one prompt, the 846 living room as the style reference | **GPT Image 2.5** (3840×1920, join 4.6): every wall, opening and piece where the render put it, photoreal. **Muse** (2240×1120, $0.01, join 3.4): the same at a quarter of the pixels. **FLUX 3** (2896×1440, join 2.8): the most literal, still a render by look. **Nano Banana Pro** (5824×2880): invented a TV wall at the seam. **Seedream 5**: beautiful, redrew the layout. **Qwen 2509** 1024² and **FLUX 2 pro** 2288×1824: ignored the 2:1 | the skin lane is GPT for finals, Muse for drafts; FLUX 3 is the reserve for a stricter skin |
| P04 | The CG kitchen skinned against its own skinned living room (GPT and Muse) | the same floor, fronts, counters, cove, glazing and haze as the living room; every cabinet and appliance in place — **one apartment** | cross-room consistency is a property of the lane, not of a prompt |
| P03-m/c, P04-m | Two Sobel edge-retention metrics | texture-dominated; an unrelated apartment scored 51 % "kept"; retired for ranking, kept as a < 55 % tripwire | the acceptance test is the openings test (§4.2) plus the eye |

### 2.2 The captures (`qa-evidence/tour360/walkaround-quality/BENCHMARK.md`; REA `capture_browser_scenario`, Chromium 156 headless, 1280×720)

| # | Platform | What loads | Reading for us |
|---|---|---|---|
| C1 | NadLan, the Rainbow project page (the Israeli comparator) | a custom three.js 0.170 city "stage" (`stage.js`, `city.json`, Mapbox), a booking API; the 360 interior is a sub-page | the local bar is a 3D project stage plus stills; the walk is a side room |
| C2 | krpano 1.24 depth-map apartment (everpano) | `krpano.js` in 407 ms, `project3d.xml`, **295 tiles of 512 px at level l3 across six cube faces** in 14.7 s, the first tile at 109 ms | tiles plus a 16 KB room model carry a motion-blurred 3D move |
| C3 | Matterport showcase 26.10.3 (three.js 0.184) | 388 requests, 76 scripts, **a 50k-triangle mesh with 256 px texture tiles** from `cdn-2`, 253 JPEGs, GraphQL prefetch | the mesh is what the camera flies through; the toolbar carries dollhouse, floor plan, walk and measure |
| C4 | Pano2VR 8 villa (vtour.cloud) | **one Draco GLB per node** (`node8.glb`, 1.4 s) with the Draco and Basis WASM decoders, cube-face tiles `cf_0…5` level `l_0` | the hidden model is loaded before the first move |
| C5 | Metareal Stage sample | the asset is gone (404 on `/view/asset/…`); three.js r87 player | no result; the lane's reading stands |
| C6 | Ours, `habait-tour-846.vercel.app` | 20 requests: the engine, four fonts, **one 3840×1920 WebP**, the plan sheet, eleven thumbnails | one big image per room; no tiles, no geometry |

### 2.3 Where 846 stands against the market

| Measure | 846 today | The market | After this plan |
|---|---|---|---|
| Picture origin | each room a free sample from a plan crop | photos (Matterport) or CG stills (Israel) | CG geometry from the plan, skinned to a photograph |
| One apartment | drift (island yes/no, bath sizes) | one capture or one model | one model, one material board |
| True to plan | approximate | exact (scans, CG) | exact walls and openings; the skin tested per opening |
| The walk | 650 ms dissolve | mesh / depth move with blur | walk-in, then the depth move on exact depth |
| Sharpness | 5.7 px/° phone · 10.7 desktop | 22.8–45.5 (Matterport) · stills ≈ 23–29 | ≥ 21 px/° from 7680×3840 tiles |
| Orientation | plan sheet with position | plan + view cone + compass; dollhouse | plan sheet + view cone + compass; dollhouse later (needs the model: we will have it) |
| AI inside the tour | typed change, 24 s, per view | none inside a walk (Matterport removes furniture; Treedis edits outside) | per-view patch now + whole-apartment re-skin behind |
| Disclosure | badge + line + note on every scene | "AI Enhanced" label (Matterport) | the same plus an Original/Designed switch |
| Phone delivery | one 2048 image | tiles | tiles, gyroscope on a tap |

---

## 3. The architecture of the improved walkaround

```
sales plan (PDF, later DWG/DXF)
   │ trace (hand now; importer later)           cameras.json (positions, links, bearings)
   ▼                                              │
plan.json (cm) ──► build_scene.py ──► Cycles ──► per camera: CG equirect 8192×4096 + exact depth
                                                  │
                        material board (one Habait look; the first skinned room = the apartment anchor)
                                                  ▼
                 skin: Muse draft ($0.01) → my review → GPT Image 2.5 final ($2.40) → openings test → edge-join test
                                                  ▼
                 SeedVR2 seamless 2× (7680×3840) ──► cube-face tiles, 512 px, 3 levels ──► build-tour --engine
                                                  ▼
            viewer: PSV adapter + walk-in (tier 1) + depth move (tier 2, from the CG depth) + plan sheet with view cone
                    + Original/Designed switch (AI label) + the change bar (patch now, re-skin behind)
```

### 3.1 The production lane (per apartment, ≤ $150 and a working day, D-WQ-9)
1. **Trace** the plan into `plan.json` (`360walkaround/pipeline/SCHEMA.md`, centimetres; `validate-plan.mjs` exit 0). 846: by hand from the 288 dpi crop already scaled at 2.25 px/cm; the eleven cameras of `cameras.json` become `camera_points[]`.
2. **Build and render** with the V2 pipeline (`build_scene.py`, `render_tour.mjs --mode draft` first, `--mode final` point-chunked under `timeout 540`, ≈ 23 min a point at 8K on this laptop; the ledger row before any rented machine). Output per camera: the CG pano and the packed depth.
3. **Skin** each CG pano with the material board: the living room first (it becomes the anchor), then every room with [the CG pano, the skinned anchor, the board] as the references. Muse for drafts and my review; GPT Image 2.5 high at 4096×2048 for finals (answers 3840×1920).
4. **Accept** per room: the openings test (§4.2), the edge join at or under the inside baseline, my eye against the plan (D-WQ-12); a failed room is re-rolled with a new seed or a stricter FLUX 3 skin.
5. **Deliver**: SeedVR2 seamless 2× → tiles → `make-sets` v2 → `build-tour.mjs --engine` → stage → deploy (his go) → paint proof → live check.

### 3.2 The viewer
- **Resting view:** Photo Sphere Viewer 5.15.1 behind the Pannellum adapter (unchanged), tiles through the adapter (spike E5 proved tiles on PSV on 2026-10-13).
- **Tier 1 walk-in** ($0): on a door tap, turn to the door's bearing, zoom forward 0.5–0.8 s with blur while cross-fading, arrive facing the direction of travel; 0 ms under reduced motion.
- **Tier 2 depth move:** a three.js layer over PSV: the current pano on a depth-displaced sphere, a dolly from camera to camera along the plan path, a mid-path cross-fade to the target's depth sphere; the smear bound of §4.2 is its gate.
- **Orientation:** the plan sheet keeps the position and gains a view cone and a compass (data we hold: the scene heading and the bearing of `lookAt`); room dimensions on the plan sheet (D-WQ-19); dollhouse later from the same model.
- **Disclosure:** badge, concept line and AI note stay; an **Original/Designed** switch shows the plain CG render under the AI label (wording his, OQ-1).

### 3.3 The change bar (D-WQ-8, D-WQ-21)
- **A view change** (a cushion, a wall colour in this view): as today, a server-made crop, Kontext, ring test, the decal lands in seconds (the board's T12–T14, T20–T25 carried).
- **A whole-apartment change** (a finish in every room, a look, time of day): the view is patched at once; a background job re-skins every room from the CG with the changed material board (Muse first, GPT when the visitor keeps the change), the set is swapped in when ready, the version is kept.
- **Ready-made looks** (three looks, sunset, night): material boards, pre-rendered for the pitch apartment.

---

## 4. Tests and gates

### 4.1 Standing proofs (unchanged)
`smoke.mjs` · `paint-proof.mjs` six cells (phone/desktop × he/en/fr, `X-Robots-Tag: noindex, nofollow`) · `live-check.mjs` with one paid change under the code · the compliance warden's read of any new wording.

### 4.2 New acceptance tests (this plan)
| Test | What it measures | Bound | Why |
|---|---|---|---|
| **Openings test** | for every door and window in the CG depth map, the bounding box in the skinned answer (edge map inside the box) | IoU ≥ 0.80 per opening; no opening missing or added | the skin must keep what the plan draws (D-WQ-10); Nano Banana invented a wall |
| **Edge join** | mean abs difference of the first and last pixel columns against the 8 px inside baseline | join ≤ baseline + 2 | a sphere must close (the apt37/846 rule) |
| **Material match** | the skinned room's floor, wall and front swatches against the anchor's (mean colour and texture distance) | within the board's tolerance | one apartment (D-WQ-2) |
| **Smear bound** (tier 2) | share of mid-path frame area in stretched triangles | ≤ 8 % on the pitch path | the depth move must not tear |
| **Sharpness** | px/° at the phone's and desktop's default field of view | ≥ 21 on desktop zoom, ≥ 11 on the phone | the market gap (lane 01 §3) |
| **Phone memory** | the tiles' peak GPU memory on a 390×844 headless profile and his phone | no iOS reload | krpano's documented crash |
| **Frame rate** | p50 / p1 during a move | ≥ 45 / 24 desktop, ≥ 30 / 20 phone | the 3D board's bar |

---

## 5. Phases and cards (the board re-cut, D-WQ-6; filed by `/plan-to-tasks` on his go)

Owners: **main** = the main session (R-3) · **WE** = `walkthrough-engineer` with its boundary widened to `Habait/tour360/**` (D-WQ-23) · **QA** = `habait-deploy-qa` (sonnet, fresh) · **W** = `compliance-warden` (sonnet). Tiers: T0 sub-decision · T1 his pick · T2 his go.

| Phase | # | Card | Owner | Depends | Budget | Acceptance |
|---|---|---|---|---|---|---|
| **1 — 846 on the true lane (week 1)** | Q01 | Trace 846 into `plan.json`; the eleven cameras as `camera_points[]` | main | — | $0 | `validate-plan.mjs` exit 0; ten known segments within ±2 % of the PDF; scale 2.25 px/cm |
| | Q01b | **The general-polygon extension** (D-WQ-28): SCHEMA v0.2.0 behind `plan_meta.geometry: "general"` (any simple room loop; `walls[].polygon_cm`; openings as an oriented cutter on a wall segment; a `glazing[]` polyline of panes for the curved façade); the validator (shoelace area, polygon overlap by triangulated SAT, coverage by edge proximity, general segment intersection in the camera placer); the builder (walls extruded from polygons, oriented cutters, panes along a polyline); the furniture templates run in each room's dominant-wall frame; the pilot apartment still validates and builds byte-identical on the rectilinear path | main | Q01 | $0 | `validate-plan.mjs` exit 0 on 846 and on the pilot; the pilot's scene report unchanged; a draft render of one 846 room |
| | Q02 | Build and draft-render 846 (`build_scene.py`, `render_tour.mjs --mode draft`, point-chunked) | main | Q01 | $0 (local) | the scene report's geometry and clearance checks pass; 11 draft panos + depth |
| ✅ | Q02b | The plan’s DRAWN furniture as placeholder masses: `fixtures[]` read off the gridded sheet into `trace-config.json` (19 boxes: the kitchen L and its oven column, the dining table, the sofa, armchair, coffee table and TV unit, the beds, the closet runs, the bathroom fixtures), exported by the tracer, checked by eye on the `plan-grid.mjs --plan` overlay, validator V13; the builder extrudes them in a light-grey placeholder material and re-renders the eleven | main · RPE | Q02 | $0 | the overlay against the sheet; V13 CLEAN; the eleven re-renders; a skin that dresses the masses instead of inventing |
| | Q03 | The material board v1: the Habait look as a prompt pack + swatches, the per-room skin prompts | main | — | $0 | the warden's read of any wording; the board file in `catalog/` |
| ✅ | Q04 | Skin 846: Muse drafts, my review, GPT finals, the living room as the anchor | main | Q02 · Q03 | ≤ $45 (drafts $0.20, finals $26.40, re-rolls ≤ $18) | the openings test, the edge join, the material match, my eye per room (D-WQ-12) |
| ✅ done 04:48 | Q05 | Final 8K render of the accepted cameras (`--mode final`, chunks under `timeout 540`) | main | Q04 | $0 (≈ 4.3 h local) | the Original set at 8K; depth sha256 in the manifest |
| ✅ built, re-proof pending | Q06 | Upscale 2× seamless + cube-face tiles; `make-sets` v2; the tiles adapter on PSV | WE | Q04 | $0.33 | sharpness and phone-memory bounds (§4.2) |
| ✅ deployed 02:42 | Q07 | Build, stage, deploy to `habait-tour-846` (his go), paint proof, live check | main · QA | Q05 · Q06 | ≤ $0.50 | 6/6 paint cells; the live change PASS; the deploy id reported |
| **2 — the walk (week 2)** | Q08 | Tier-1 walk-in on the adapter (turn, zoom with blur, fade, arrive facing the path; reduced motion 0 ms) | WE | Q07 | $0 | a frame series per link; his phone feel (T1) |
| ✅ built, re-proof pending | Q09 | View cone + compass on the plan sheet; room dimensions on the sheet; the Original/Designed switch with the AI label | WE · W | Q07 | $0 | the warden's read of the wording; the switch on every scene |
| | Q10 | Deploy (his go) + proof | main · QA | Q08 · Q09 | ≤ $0.50 | as Q07 |
| **3 — the change bar on the true lane (weeks 2–3)** | Q11 | The server as the board planned it (T20–T25: jobs API, handler, server crops, acceptance, budgets, the gate), re-scoped to the new sets | main | Q07 | the board's $18.72 allocation | the board's card checks; the fresh gate |
| | Q12 | Whole-apartment changes: re-skin behind (a job over all rooms with a changed board; Muse preview, GPT on keep; swap; versions) | main | Q11 | ≤ $60 for the proofs | every room agrees on the changed finish (material match); the swap under 3 min for eleven rooms |
| | Q13 | Ready-made looks: three boards + sunset + night, pre-rendered for 846 | main | Q12 | ≤ $40 | his pick of the three (T1); each look passes §4.2 |
| | Q14 | Free text behind the code (T32), the replace matrix (T33), the UX judge (T34), the gate (T35), deploy (his go), live proof (T37) | main · QA · judge · W | Q12 · Q13 | the board's allocations | as the board |
| **4 — the 3D move (week 4)** | Q15 | The depth-move layer over PSV from the CG depth (two depth spheres, the dolly, the mid-path fade) | WE | Q07 | $0 | the smear bound and the frame-rate bound (§4.2) |
| | Q16 | Deploy (his go) + his walk; the fix list | main | Q15 | ≤ $0.50 | his verdict (T1) |
| **5 — scale (after the pitch)** | Q17 | The DWG/DXF → `plan.json` importer (Israel Canada's CAD on his ask, OQ-2) | main | Q07 | $0 | a traced apartment in minutes; the ruler check ±2 % |
| | Q18 | The raster tracer for PDF-only plans (vision model or CubiCasa-class) | main | Q17 | ≤ $20 | the same ruler check on three plans |
| | Q19 | Dollhouse from the model; room-tap navigation | WE | Q15 | $0 | the orientation table's differentiators |

**Spend.** Phase 1 ≤ $46 · Phase 2 ≤ $1 · Phase 3 ≤ $119 (incl. the board's $18.72) · Phase 4 ≤ $1 · the research so far ≤ $5.90 → **≤ $173 of the $200 cap** (D-WQ-24). Local renders are $0 and still get their ledger row (`360walkaround/pipeline/RENDER-LEDGER.md`).

**The month (D-WQ-11).** Phase 1 by 2026-11-04 · Phase 2 by 2026-11-11 · Phase 3 by 2026-11-18 · Phase 4 by 2026-11-25 · the pitch pack in the last week of November. Each phase ends on his look and his deploy go; a phase that slips does not block the pitch, because every phase leaves the link better than before.

---

## 6. Spend of this round
Research probes: P01 ≤ 0.02 · P02 0.03 · P03 ≤ 3.23 · P03-muse 0.01 · P04 ≤ 2.41 · P03-flux3 ≈ 0.20 (2k price not stated) → **≤ $5.90 of the $50** (D-WQ-7); the GPT rows are booked at the worst case, the fal dashboard carries the real sum. The three lanes and the six captures cost $0.

---

## 7. Risks

| # | Risk | Mitigation |
|---|---|---|
| R1 | The skin moves small things (a chair, a lamp) even when walls hold | the openings test gates walls and openings; small moves are allowed by the disclosure line; FLUX 3 is the stricter reserve |
| R2 | GPT Image 2.5 is token-billed and sometimes answers 3840 for 4096 | book the worst case; the upscale closes the gap; the ledger reconciles against the dashboard |
| R3 | The final 8K render takes ≈ 4.3 h for eleven points on this laptop | draft mode for the skin's input (4096 is enough: GPT downsamples); the final render runs point-chunked while the skin is reviewed |
| R4 | Tiles on iOS: GPU memory | 512 px tiles, three levels, the phone-memory bound; krpano's documented limit as the ceiling |
| R5 | The depth move tears at disocclusions | the smear bound; the walk-in stays as the fallback per link |
| R6 | The developer's plan is not ours to publish | D-WQ-18: private pitch first; OWED-656; the DWG comes on his ask |
| R7 | Licences | Tencent world models banned for EU output (lane 02 §0.6), DAP non-commercial (lane 01 §9): neither is used; PSV, three.js MIT; GPT/Muse/SeedVR2 through fal under the account's terms |
| R8 | Two writers on one tree | disjoint file sets: WE owns `engine/`, `viewer/`, the tiles; main owns `apartments/`, `tools/`, `server/`; the board's single-writer-per-file-set rule |

---

## 8. Open questions for Slava (never decided here)
- **OQ-1** ~~The Hebrew, English and French wording of the Original/Designed switch and the AI label (the warden reads it; the words are his).~~ **Closed 2026-10-29 (D-WQ-30): the drafted four strings stand, rewritable any time.**
- **OQ-2** Ask Israel Canada for the DWG/DXF of unit 846 (and the type L family) — the importer's first input; and their consent before the link goes beyond the pitch (OWED-656).
- **OQ-3** Camera count per apartment: 846's eleven, or the pilot's fifteen (one more in the corridor and the terrace's two ends).
- **OQ-4** Whether the pitch link opens on Designed (default) with Original one tap away, or shows both side by side on the first screen.

---
- **OQ-2 (2026-10-29, open):** the skin's geometry in equirect space — the wrap seam, the freehand floor lines, a counter drawn 50° off. Which fix order: the viewer's field of view now (no generation), the seam test + masked closes, the CG floor as the real tile grid before a re-skin, a perspective-space skin probe. Ruled D-WQ-33/34 (2026-10-29 10:4x): all of it in order, two deploys. Step 1 (the field of view, the thumbnails) DEPLOYED 11:36; steps 2–4 in progress; evidence `qa-evidence/tour360/walkaround-quality/phase1/issues-2026-10-29/index.html`.


## 9. Decision log
| Date | Decision |
|---|---|
| 2026-10-28 (20:2x) | **Q01b done (the render-pipeline engineer, `360walkaround/pipeline/GENERAL-POLYGONS.md`): 846 builds (182/182 geometry checks, deterministic, 4–6 s), three draft panos with depth (living, kitchen, main bedroom; 4096×2048, about 3 min a point), the pilot byte-identical.** The builder derives what the drawing implies but the plan does not list (facings at the traced outlines, door infills, pane-joint posts, a floor/ceiling fill) and found that two coplanar ceiling faces leak sky in Cycles 4.x. Its door finding: my snap of the doors onto "the nearest wall edge" slid every door half a width along its own axis onto solid wall (the nearest edge is the jamb); the snap is removed, the validator tests door ends, the plan re-exported. Also: the bedroom's east pane becomes a façade (it was a 110 cm railing, the room open to the sky), the terraces are roofed outdoor rooms with cameras, `plan_meta.ground_offset_cm` −5120 (floor 16). **The first plan-true picture exists:** `qa-evidence/tour360/walkaround-quality/phase1/q02-living-cg-draft.jpg` and its Muse draft skin ($0.01) `q04-living-skin-muse-draft.jpg`: the curved glazing, the hall doors and the bedroom door where the plan puts them, the look applied, furniture invented (no templates yet). The openings test now measures the jamb shift in degrees of view (cross-correlation of the vertical-edge profiles); on the Muse draft the façade and the door moved 0.5–2.1°, the railing 3.4°. Q02 (all eleven points) runs with the engineer on the corrected plan. |
| 2026-10-30 (01:1x) | **DEPLOYED — the furnished tour on the link (D-WQ-37).** His go through the question tool on the served walk sheet; deployed from the staged folder to the same project as `dpl_9Gwykbg67jAWj8rpHCKTrYZbGzyF` (production, Ready 01:0x), alias https://habait-tour-846.vercel.app. Live paint proof 6/6 (phone/desktop × he/en/fr, disclosure 3/3, the walk-in on every cell); the 26 live walks ok and equal to the served ones (78 before/arrived/look-back pairs, mean pixel difference 0.00, max 0.02 — `qa-evidence/tour360/walkaround-quality/furnished-2026-10-29/walks-live/`, the three review strips beside the sheet). No spend; $160.78 of $200. Ruled with the go: the sun terrace camera moves a step off the column in a second pass (OWED-660): re-render cp-terraceLiving, re-polish (~$2.40), re-walk its doors, redeploy on its own go. Still open: arrivals facing a wall in the baths (arrival yaw = travel direction), OQ-G10/G12, the validator’s `furnishing` rule. Tag `deploy/tour360-apt846-furnished-2026-10-30`. |
| 2026-10-29 (19:xx) | **BUILT — the furnished CG + the locked polish, every door walked (D-WQ-36 executed; the deploy waits on his go).** The pipeline lane furnished 846 (build_scene v1.5.0 + general_furnish.py: 53 catalog placements, door leaves ajar 12°, no grey mass; drafts at 4K/64 spp, ~3.5 min a camera, $0). The polish probe on the living: Nano Banana 2.1 (21:9 only, reframes), FLUX depth-control (locked, soft), **GPT Image 2.5 over the furnished render keeps every object in place — the lane** (`tools/make-polish-prompts.mjs`, the living final as Image 2, the seam parked via make-skin-prompts --roll auto on the furnished renders + two parks by hand: the sun terrace’s column, the guest bath’s wall). Eleven rooms polished; the six whose wrap failed re-run with the park — now the seam and every door/facade/railing row pass on 10 of 11 (the bedroom terrace’s sliding door 0.598 vs 0.60). Build 16.6 MB, smoke PASS, served paint proof 6/6, the 26 served walks agree door to door (`qa-evidence/tour360/walkaround-quality/furnished-2026-10-29/walks-served/index.html`). Spend $160.78 of $200. The media header now revalidates (his day-old tiles). Open for his ruling: the sun terrace camera beside the column (OQ-G7), arrivals facing a wall in the baths, the lock test (tools/cg-lock-test.mjs) advisory only. |
| 2026-10-29 (17:3x) | **THE CROSS-ROOM FINDING — the lane re-cut (D-WQ-36).** His eye: “a major major issue with the transition between the images”. All 26 doors walked headlessly on the live link (`qa-evidence/tour360/walkaround-quality/reskin-2026-10-29/walks-live/index.html`: the door view, six walk frames, the arrival, the look back): every walk lands in a different apartment — the living shows a kitchen run and three doors toward the entrance, the entrance is a bench, hooks and a mirror; the living shows a dining table through the kitchen door, the kitchen has none there. Cause: the CG carries grey masses where furniture goes (`qa-evidence/tour360/walkaround-quality/reskin-2026-10-29/walks-live/_cg-vs-skin.jpg`) and every room’s skin invents its own apartment; every test so far judged one picture, none judged a picture against its neighbour. Ruled: the apartment exists once — catalog furniture, door leaves and materials in the CG for every room (the general branch gets the rectilinear path’s furnishing), the AI a depth/edge-locked polish only, a door-match test on every pair, the live link untouched until it passes and he gives the go. The last-four re-skin is cancelled. Owner: render-pipeline-engineer (the furnished scene), the main session (the locked polish probe, the door-match test). |
| 2026-10-29 (16:16) | **DEPLOYED — seven rooms on the line-true CG (D-WQ-35).** Step 3 ran: the tile grid in the CG (pipeline v1.4.0, 6 mm joints after 3 mm read faint), the living probe PASSED (seam 8.5, every facade, the floor lines straight; the wardrobe door 0.51 because it sat on the parked seam — the chooser now needs 10° of clear wall and allows a passage), the seam parked per camera (nine of eleven), the self-anchor. Seven rooms rendered at 8K (about 20 min each) and skinned ($2.40 each, entrance twice); kitchen, dining, main bedroom PASS; the sun terrace has no wall for its seam and the masked close only took it 24.7 → 21.1. He saw the old seam still live and ruled the seven ship now: `dpl_64yBRnB5ku7m95iQc62Q6w8HEstx`, paint proof 6/6 served and live, alias https://habait-tour-846.vercel.app. Spend $117.03 of $200. Next: the last four rooms, a third deploy on his go; open: a visible door leaf in the CG (a flush door reads as wall), the sun terrace’s seam, the passage/fixture rows’ calibration on the tiled floor. |
| 2026-10-29 (12:3x) | **The seam-close tool, tried once on the living ($2.40).** `tools/close-seam.mjs`: the final and its CG rolled half a turn, a 12° mask band on the join, GPT Image 2.5 edit with `mask_url` and the rolled CG as Image 2, only the band pasted back (feathered), rolled back, ledgered. The living’s seam step fell 23.0 → 4.1 (bound 10): the hall now joins the kitchen and the floor and the cove continue — but the band repaint shrank the armchair to a thin white sliver, and the island stays where the skin put it. Not picked: the re-skin (step 3) is the fix for the living, the close is the fallback for a seam left after it. The material board is at 1.2.0: the floor sentences tell the model Image 1 carries the real grout grid. Evidence `qa-evidence/tour360/walkaround-quality/reskin-2026-10-29/living-seam-close-trial-before-after.jpg`. Spend $93.03 of $200. |
| 2026-10-29 (12:1x) | **Step 2 of D-WQ-33 — the openings test learns the seam, and reads fixtures and passages (advisory).** `openings-test.mjs` gains a `seam` row (the skin’s luminance step across its own wrap edge, bound max(10, 3 × the CG’s step)): on the eleven finals it FAILS exactly the five the eye called (living 23.1, dining 37.6, terrace-living 38.5 hard; kitchen 15.2, guest bath 10.2 mild) and passes the six clean ones. Two more rows were built and then held back as ADVISORY after calibration: `fixture` (a placeholder’s silhouette kept/new/shift — a dressed box’s silhouette moves 0.1–17.6° on pieces the eye accepted, and a fitted box’s silhouette is the wall’s own edges: four kitchen answers, the one GPT left EMPTY among them, all read kept 0.70–0.85) and `passage` (the floor-edge density through a zone opening, skin against CG — against the plank-textured CG floor the ratio does not separate a covered passage from a clean one; it gets its bound once the CG floor carries the real tile grid). The honest state: one new verdict row (the seam), two instruments that report. The test that would catch an added island is a depth one (a monocular depth of the skin against the CG depth) — phase 2. |
| 2026-10-29 (11:36) | **DEPLOYED — the field of view (D-WQ-33 step 1, D-WQ-34’s first go).** The viewer’s default 80° across (was 100°), 45–100 allowed (was 50–120), the vertical field capped at 80° on any window shape (a phone held upright: 137° → 80°); the thumbnails as perspective views of the first look. Engine typecheck clean, 15/15 tests (two new on the policy), the build 19.48 MB, smoke PASS, the paint proof 6/6 served and 6/6 live, the walk-in 689 ms at 0.00° (its resting field on a phone is now 42.4° across, the cap’s doing). `dpl_GvAH7WtdF3Lvwj5aeR5s79DzrGAP` on `habait-tour-846`, alias https://habait-tour-846.vercel.app, tag `deploy/tour360-apt846-fov-2026-10-29`. Next, in his order: the seam test and the fixture/zone-opening test, the CG’s real lines (the builder lane is on the tile grid, no Blender runs in a lane), the living probe, then the re-skin round on its own go. |
| 2026-10-29 (10:1x) | **Slava's eye on the live link: two screenshots of the living room looking at the entrance.** Measured (`qa-evidence/tour360/walkaround-quality/phase1/issues-2026-10-29/index.html`): (1) a hard cut at the entrance = **the pano's wrap seam** — the AI skin does not join its own edges and the living camera faces the terrace, so the seam lands on the entrance; three hard seams (living ×2.2, dining ×3.1, terrace-living ×6.0 the neighbour baseline), two mild (kitchen, guest bath); the CG renders all join. (2) "fisheye" = the viewer's 100° default with the vertical field uncapped (a phone in portrait gets 137°) **plus the skin's own bent lines** (the CG floor is oak planks, the spec is 120×120 tile, so every grout line is invented freehand in equirect space; the CG at the same view is straight). (3) The entrance hotspot on the island = the kitchen counter drawn 50° too far left, as an island inside the hall opening; the openings test skips zone-boundary openings and fixtures, so it passed. (4) The thumbnails are squeezed equirects. The research had called for the edge-join measurement (02-generative-frontier.md, P5b); phase 1 shipped without it — a test gap, recorded. Recommendations put to him (the field-of-view policy and perspective thumbnails, a seam test + masked seam closes, the CG floor as the real tile grid before any re-skin, a fixture/zone-opening test, a perspective-space skin probe). |
| 2026-10-29 (05:0x) | **The viewer lane retracted its alignment verdict** (the living room reads as one viewpoint in both sets; a generative skin has no single rigid offset from its CG, so its `pano-align.mjs` now prints NO VERDICT and crop sheets for the eye; six rebuilds, every one knocked down by its own controls). Its crops found a third deviation for his eye: the living room’s wardrobe door drawn at about 25° of view against the plan’s 9° (2.8× in the picture) over part of the hall passage (Q04-RESULTS.md). The original set rebuilt from the 8K renders sits in the same frame as the deployed one (0/0 px in the six re-rendered rooms). A process slip logged: one instrument run started beside a render (both finished inside their bounds). The lane’s agent memory file is at 194 KB, the rotation line is 200 KB (the next `/close-board` rotates it). |
| 2026-10-29 (04:50) | **Q05 DONE.** The six remaining 8K finals rendered from the main session, one bounded foreground call each (17–23 min a point, 128 spp, every point PASS; ledger L47–L52): all eleven points now at 8192×4096 (the last two on the framed-door scene; the five earliest without the frame, OQ-G8). The original set rebuilt from them at 2048 (`panos/original`, 6 files changed) — NOT redeployed: the live link’s originals came from the same cameras at 4096 and read the same at 2048, and a redeploy is its own go (standing law 2). Phase 1 complete but for the two deviations under his eye and the viewer lane’s instrument fix. |
| 2026-10-29 (02:42) | **DEPLOYED (Q07) under D-WQ-29.** The viewer lane’s re-proof on the restaged build: the walk-in PASS (682–698 ms, 0.00° off), the paint proof 6/6, the eight mutation checks caught (and a real hole closed: a truncated tile passed smoke; smoke now checks the WebP length); its new Original-vs-Designed alignment check reported a 65° yaw gap in the living room — refuted by a direct split-and-blend of the 8K CG over the final (every wall, door, glass line and furniture mass coincides; evidence `q09-original-vs-designed-living-split-and-blend.jpg`) and by the openings test passing against the 8K with the draft’s numbers; the instrument is owed a fix. Deploy: `dpl_BV5vNZCgZMFi5qC3qm1FACRJ4Sx7` on `habait-tour-846` (production, from the staged folder), alias https://habait-tour-846.vercel.app; the live paint proof 6/6 (tiles 37/58 per cell, the walk-in on every cell, disclosure 3/3 × 3). Spend $90.63 of $200. Next: Q05’s six remaining 8K points from the main session; phase 2. |
| 2026-10-29 (02:3x) | **The door-in-glass frame, and Q05 partial.** The builder stopped the 8K render under machine rule 5 at seven of eleven (128 samples, the setting of record; the harness began backgrounding its calls after 180 s), built a frame of posts and a head for every door cut through a pane (o-13 the only one here) and re-rendered the two bedroom-side drafts with it. On the framed render the main bedroom’s GPT final is taken (the door frame visible, o-13 kept 0.56, fine by eye). The bedroom terrace resisted a third time: GPT and FLUX 3 both redraw the door as the whole glass run, Muse keeps the frame but draws the living room behind it — the earlier GPT final stays, deviation recorded. The five earlier 8K finals show no frame (OQ-G8); the four unrendered points and the two framed ones get their 8K from the main session after the deploy. Spend 0.63 of 00. Restaged for the viewer lane’s re-proof. |
| 2026-10-29 (00:2x) | **Ruled at the gate (D-WQ-29–32), every answer the recommended option:** the deploy after the paint proof as ONE go (no second ask), the switch strings as drafted (OQ-1 closed), the floor-key north arrow, the skyline kept with the provenance wording corrected. Next: when Q05 frees the machine, restage with the 8K originals, the paint proof, the viewer lane’s re-proof, the deploy, the live check. |
| 2026-10-28 (23:55) | **Phase 1 at his gate: the build is staged.** The viewer lane delivered Q06 (cube-face tiles, three levels, the hybrid adapter; phone first paint 286 → 160 KB, 5.7 → 10.7 px/°, 16 MB a room, 102 MB peak), Q08 (the tier-1 walk-in: 650 ms, 60 fps, arrival 0.00° off, the door back behind you on all 26 links) and Q09 (the view cone 0.00° off, the compass from the plan’s north arrow 291.6°, the Original/Designed switch) — proven on the 23:14 pictures, the re-proof on the new finals waits for the machine. make-sets v2 writes the original set from the CG renders; the switch strings are DRAFTS for OQ-1. Tiles cut, `build-tour --engine` 19.6 MB, smoke PASS, staged outside the tree (20.6 MB, api/edit present). The paint proof and the deploy wait: the Q05 8K render holds the machine until ~03:00 and the deploy is his go. Four rulings asked through the question tool: the deploy go, the switch strings, which north arrow (two on the sheet, 44° apart), the skyline through the glass versus the provenance’s “unrecognisable haze”. Spend $85.61 of $200. |
| 2026-10-28 (midnight) | **Q02b DONE, Q04 DONE: the eleven furnished finals chosen.** The builder extruded the 19 fixtures (grey placeholder prisms) and re-rendered the eleven twice (the second pass greyer, 23:25). The living final on the furnished render became the anchor; every room was drafted on Muse, then GPT, then tested and viewed. Three more prompt-side truths landed on the way: a hidden opening is dropped from the openings line (the prompt had named the two hall doors that sit round the guest-bath corner, and GPT drew one on the wall), the drawn furniture carries its own words (the dining table was dressed as a kitchen island until told it is NOT one), and a pane stretch cut by a zone boundary has no jamb there (the test read 7° on a jamb that does not exist). Verdict per room (the eye on every one): PASS entrance, kitchen (facade-2 kept 0.46 on a 20° pane, fine by eye), living, terrace-living, bedroom-main, wardrobe, bath-main, bath-guest; dining accepted by eye with facade-1 shift 7.4° (the curved glass wall redrawn with its own mullion rhythm), bedroom 2 accepted with facade-1 5.9° / kept 0.73 (the test box overshoots the glass into the partition), terrace-bedroom accepted with a structural deviation: GPT draws the sliding door as the full glass section, twice. Spend $85.61 of $200 (34 Muse drafts, 22 GPT finals incl. re-rolls). `panos/balanced` + `thumb` rebuilt from `_local/picks.json`; scenes regenerated for the two moved cameras. Next: the viewer lane’s tiles and walk-in (Q06/Q08/Q09), the build and the deploy on his go (Q07). |
| 2026-10-28 (towards midnight) | **Q04 round 1 measured, Q02b opened.** Eleven Muse drafts and five GPT finals (entrance, kitchen, dining, wardrobe, bedroom 2; $12) against the living anchor. The eye found what the openings test could not: a corridor drawn behind the main bedroom’s glass, a balcony behind bedroom 2’s window, glass doors inside the wardrobe, and then an EMPTY kitchen and a dining room with no kitchen in it once the prompt forbade invention — the CG has no furniture, so the skin either invents or leaves bare. Three fixes: (a) the prompt now carries, from the plan, what every opening in the view is (`{NEIGHBOURS}`: door / glass facade / railing, by bearing, with the room beyond) and forbids interior glass doors and unlisted openings; (b) the openings test reads the CG depth (metres × 100, RGB-packed) and skips what a nearer wall hides (the terrace’s curved wall hid two living panes that read as FAIL), tests a facade only along the stretch that bounds the room (bedroom 2’s window is 40 % of facade-1), and lets kept ≥ 0.75 settle a shift the curtains confuse; (c) card Q02b: the sales plan’s drawn furniture becomes `fixtures[]` placeholder masses (19 boxes) the builder extrudes and the prompt names by kind and bearing (`{FIXTURES}`). Results so far: kitchen, wardrobe and bedroom 2 finals PASS the test; the entrance final fails because the CG shows no door where o-10/o-11 should open (the builder is on the infill), the dining final fails on a 7° facade shift. Every final is re-done after the fixtures re-render (≈ $26), the material board is v1.1.0. Spend $49.50 of $200 at 22:00; projected total ≤ $110. |
| 2026-10-28 (late night) | **Q01 done, Q01b half done.** The trace is semi-automatic now (`tools/trace-plan.mjs`): walls from the drawing's grey fill, glazing from its double strokes (façade and railing by adjacency), door leaves as wall-connected single strokes, long straight singles dropped as dimension lines, zone bars by hand; `apartments/apt846/plan.general.json` = 11 rooms (the bedrooms within 2 % of the printed sizes; indoor 91.1 m², terrace 18.7 m²), 37 wall pieces, 13 openings (doors snapped to the wall line), 12 panes, 11 cameras; the raster pinned by sha256. `validate-plan-general.mjs` (SCHEMA v0.2.0 draft: general loops, triangulated overlap, coverage by proximity, outdoor cameras allowed) runs CLEAN; `validate-plan.mjs` delegates to it and the pilot apartment still passes on the rectilinear path. The builder extension runs with the render-pipeline engineer (walls extruded from polygons, oriented door cutters, glass panes; no furniture templates in this first version; a draft render of the living room is the deliverable). |
| 2026-10-28 (night) | **Phase 1 finding: 846 is not rectilinear** (a fan footprint, 96° corners, a curved glass façade, two diagonal walls). Ruled D-WQ-28: the pipeline is extended to general polygons (card Q01b), not the plan approximated. The wall footprints were extracted from the drawing raster (37 components, `apartments/apt846/_local/plan/walls-extracted.json`, overlay checked by eye). |
| 2026-10-28 (later) | **Ruled as written (D-WQ-25); phase 1 started the same evening.** OQ-3 closed: eleven viewpoints (D-WQ-26). OQ-4 closed: Designed opens, Original one tap away (D-WQ-27). Commit fa48a223. |
| 2026-10-28 | This plan v0.1 written at the end of four grilling rounds (D-WQ-1…24); the measured benchmark and probes filed; the habait-walkaround board re-cut by §5 on his ruling D-WQ-6; S-V2-2 reopened for the skin (D-WQ-17); the walkthrough engineer's boundary widened (D-WQ-23). Building starts on his ruling on this plan. |

Document control: v0.1 · 2026-10-28 · main session · companions: `research/walkaround-quality/01-platform-viewers.md`, `02-generative-frontier.md`, `03-israel-developers.md`, `qa-evidence/tour360/walkaround-quality/{BENCHMARK.md, probes/PROBES.md, captures/}`, `development/tasks/habait-walkaround/README.md`, `360walkaround/pipeline/CLAUDE.md`, `apartments/apt846/cameras.json`.
