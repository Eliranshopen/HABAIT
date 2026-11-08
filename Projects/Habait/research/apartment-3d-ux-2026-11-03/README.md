# Apartment 3D view: how to maximise its UI/UX (research, 2026-11-03)

Session rnd-23, for Eliran. Research only: nothing in the product repo was changed. $0 spent.
Surface: the **תלת-ממד** tab of the apartment page (`habait-platform.vercel.app/apartment.html?project=rainbow&unit=846`), which iframes `dollhouse.html`, built from `Habait/platform/js/apartment-3d.js` (three r170) and the GLB from `360walkaround/pipeline/export_dollhouse.py`.
Raw inputs: `raw-ux-survey.md` (how the best products do it, cited) · `raw-rendering.md` (rendering techniques, checked against the r170 source) · `current/` (screenshots of the live site, headless Chrome).

## TL;DR
1. **Today the 3D tab is the odd one out on the page.** Its sibling tab, the 360 tour, is bright, warm and photoreal (`current/benchmark_tour360_living.png`). The 3D tab is a dark-navy flat-colour CAD model (`current/desktop_3d_page.png`). It also breaks your §6 rule that the interior look follows the tour's style.
2. **It looks but doesn't do anything.** There are no room names or areas, you can't tap a room, and nothing leads into the 360. The best products treat the dollhouse as **the map of the apartment**: tap a room and you fly into its 360. We already have every piece needed for that: the tour, its room parameter and `habait:goto`, the pano positions in `cameras.json`, and room ids and areas inside the GLB.
3. **The biggest visual jump is baked light, not real-time effects.** Bake Cycles lighting of the existing scene into one texture atlas: $0, about 20–40 min of CPU. three r170 has no glTF lightmap path, so it goes into the base colour.
4. **The highest ceiling is to paint the dollhouse with the tour's own panoramas**, which is how Matterport's dollhouse gets its look. We already own the projection pipeline (`Habait/flyover/project_skin.py`, `enter.py`), the per-room panos and depth maps. That would make the 3D and the 360 one visual world. It is also the riskiest option: the enter-846 flight showed exactly this method's artifacts.
5. **Recommended order:** fix the UX first (1), then the bake (2), then a projection spike A/B'd against the bake (3). The pre-rendered spinner (4) only if both fail your bar. Skip Gaussian splats and in-browser path tracing for now.

## 1. What a buyer sees today (evidence: `current/`, live site, 2026-11-03 14:00)
Captured with headless Chrome on software WebGL (SwiftShader), so colours and antialiasing may differ slightly from a real GPU. Each finding names the screenshot that shows it.

| # | Finding | Screenshot | Weight |
|---|---|---|---|
| C1 | Dark navy `#0b1220` + flat colours + ACES next to a bright photoreal tour: two different worlds on one page | `desktop_3d_page.png` vs `benchmark_tour360_living.png` | high |
| C2 | Phone: the model starts below the fold and the sticky WhatsApp bar cuts it off. The model fills less than half the frame on desktop too | `phone_3d_page.png`, `phone_3d_scrolled.png`, `desktop_3d_page.png` | high |
| C3 | No room names, areas or hotspots; nothing is tappable; no way into the 360 from the 3D | all | high |
| C4 | Surfaces read as cardboard: no AO or contact shadow, walls one white, furniture grey primitives, the black kitchen column and dark caps read as holes | `desktop_preset_3d.png` | high |
| C5 | Terrace glass rail draws as vertical dark stripes, and from Outdoor it reads as a white wall that hides the living room | `desktop_preset_outdoor.png` | medium |
| C6 | Top view reads as a dark board; terrace a blank slab; no labels, so it adds little over the Plan tab | `desktop_preset_top.png` | medium |
| C7 | The disclaimer is two lines of small text over the bottom of the canvas, not a designed badge | `desktop_3d_page.png` | low |
| C8 | Page-level, same tab: a developer badge **"fixture"** sits next to the price; the tab row overflows at 390 px | `phone_3d_page.png` | medium (not 3D, cheap) |

What is already good: GLB 174 KB, so first paint is fast; standard gestures; animated presets; floor-finish switch; RTL preset bar; the minimap bridge to the tour exists (`habait:view` / `habait:goto`).

## 2. What the best products do (from `raw-ux-survey.md`)
Evidence quality is uneven; the raw file marks each claim. The patterns that matter for us, strongest first:
1. **Dollhouse = map; tap a room → its 360 → back the same way** (Zillow, CloudPano, Kuula, Cupix link plan/dollhouse to 360; Matterport flies in). The single strongest pattern, and we own the 360.
2. **Room labels inside the model with name + area.** Matterport added exactly this to its dollhouse.
3. **Selection = camera moves to the room + highlight** (Archilogic).
4. **Smart walls**: low cut by default, walls facing the camera drop away; optional three-state toggle (Sims precedent; Matterport reportedly hides near walls).
5. **One sheet per room on phones** (area, orientation, "view in 360") instead of a desktop inspector.
6. **Premium = baked light/AO + soft ground shadow + warm backdrop + a designed entry move + poster-first load.** This ranking is judgement, not a study.
- Avoided by the best: raw mesh noise, heavy chrome over the model, cutaways that delete interior walls, first-person walking inside the dollhouse (the 360 does that).
- Correction to the raw file: residence.tech was not found by the web search, but our own capture of 2026-11-02 (`../product-research-2026-11-02/residence-tech-reengineering.md`) **observed** it: model-viewer 4.3.1, flat-colour GLB, 3D / Top / Outdoor. Today we match the closest competitor; we do not beat it.

## 3. How to make it look rendered (from `raw-rendering.md` + our own assets)
| Option | Visual gain | Effort (est.) | $ | Phone risk | Fit with your rulings |
|---|---|---|---|---|---|
| A. Look pass: Neutral/AgX tone map, `RoomEnvironment` IBL, warm light backdrop matching the tour, warm caps, glass fix, DPR cap, render-on-demand | +1–2 | ~1 day | 0 | low | fine; still "real-time 3D" |
| B. **Cycles bake** of the existing `scene.blend` (full height + ceiling + windows for correct light, then cut) into one 1–2K atlas, `KHR_materials_unlit` | +3–4 | 3–6 days | 0 (CPU ~20–40 min, T4 minutes) | low | rendered light, deterministic, not generative → no AI badge needed for the bake (wording your call) |
| C. **Project the tour's panoramas** onto the dollhouse, baked into the same atlas as B | +4–5, and the same look as the tour | spike 2–3 days on top of B | 0 | low at runtime | geometry from the plan, AI only paints (D-WQ-10/17); AI imagery → badge; enter-846 showed the failure modes: faces no pano sees, glass carrying a view |
| D. Pre-rendered hero spinner (36–72 Cycles frames, GLB invisible for picking/labels), reusing the `holdarc.js` player | +5 for the frames | 5–8 days | 0 (T4 ~0.5 h) | lowest | your ±45° arc read as "stuck": must be full 360° + zoom, which multiplies frames |
| E. Gaussian splats | high but fuzzy edges | 8–15 days | 0 | medium-high | needs three ≥ r180 (Spark), 10–30 MB; defer |
| F. Browser path tracing | desktop only | 3–5 days | 0 | not for phones | WebGL line deprecated; skip |
| G. Pixel streaming (Unreal) | photoreal | high | a GPU per viewer | low | ongoing cost per session; out of scope |

Key facts behind the table (verified in `raw-rendering.md`): r170 has `AgXToneMapping`, `NeutralToneMapping`, `GTAOPass`, `RoomEnvironment`, `compileAsync`; GLTFLoader r170 has no lightmap extension, so B/C go into baseColor or a hand-wired `lightMap` on `uv1`. The risk on phones is fill rate and texture memory, not geometry: one 2048 px atlas ≈ 22 MB VRAM, so ship 1024 px to phones. For the offline ZIP prefer WebP/JPEG over KTX2, and test meshopt instead of Draco.

## 4. What your earlier rulings imply (from `C:\RnD\Projects\Habait\memory.md`)
- **Realism bar:** the real-time 3D you've seen so far hasn't met it; what buyers see must be rendered or skinned. → A alone is not enough; B or C is the point.
- **One world:** a GPT sphere cut against a Kling frame read to you as "a photo from Google". → The 3D must not look like a different product from the tour. → C is the strongest answer; B with the tour's palette is the safe one.
- **No loading screens in the flow.** → Show a pre-rendered still at once and fade the live model in over it. No spinner.
- **Freedom of movement:** the arc felt "stuck" when it hit its end. → Keep the free orbit; any pre-rendered mode must be full 360°.
- **Design rules §6:** zero-line cream doors, no skirting, seamless floors, three floor finishes, interior look = the tour's style. `export_dollhouse.py` already enforces most of these. With B or C, the three finishes mean three bakes, or a bake of the light only with the floor tinted at runtime.

## 5. Recommended plan (each phase in its own working folder `C:\RnD\.wt\<name>`, root §8.7, no git: copies of the files it changes plus a sha256 manifest; copied back into the live repo only after it is verified)
**Phase 1: make it useful and coherent (~2–3 days, $0, no Blender).**
- Room labels from the GLB extras (`room_id`, `room_area_m2`; Hebrew names from the tour's scenes), upright, bidi-safe numbers.
- Tap a room → camera eases to it + highlight + a bottom sheet (name, area, "צפו ב-360°"), which opens the 360 tab at that room. Back returns to the same 3D view.
- Hotspots at the 11 pano points from `cameras.json`. The mapping is in memory §7: cm = px / 2.25, GLB X = x/100, Z = y/100; mind the 0.8 % engine/tour scale gap.
- Frame: the model fills about 80 % of the canvas; phone layout puts the 3D above the fold, clear of the sticky bar.
- Option A look pass (light warm backdrop that matches the tour, Neutral tone map, IBL, warm caps, glass stripes fixed); poster-first load; render on demand.
- Page-level: hide the "fixture" badge from buyers; make the disclaimer a designed badge.
- Proof: before/after screenshots at desktop and 390 px in headless Chrome, plus one real phone; first-paint time; frame rate on a mid-range phone.

**Phase 2: the look jump (3–6 days, $0, needs a Blender window).** Option B: UVs in the exporter, Cycles bake with ceiling and windows, cut afterwards, a 1–2K atlas, one bake per floor finish, manifest rows with the scene hash. Falls back to the Phase 1 look if the atlas is missing.

**Phase 3: same world as the tour (2–3-day spike, $0).** Option C on the Phase 2 atlas, using the tour's balanced panos from the 11 points. Then an A/B on a real phone: B vs C at the same angles. You pick. C carries the AI badge.

**Only if 2 and 3 miss your bar:** Option D, full-360° spinner. **Not now:** E, F, G.

## 6. Your calls before Phase 1 starts
1. **Look direction to aim for:** "premium architectural model" (B: rendered light, honest, deterministic) or "the same photoreal world as the tour" (C: painted from the AI panos, badge). Recommendation: build B, spike C, then choose on a phone.
2. **Disclosure wording on the 3D tab** (yours by rule): B is a render of the plan (not generative); C is AI-painted.
3. **Scope:** the apartment page on habait-platform only, or also the offline ZIP and habait-flow?
- No longer open: the worktree base. Under the no-git rule (root §8.7, 2026-11-03), the working folder copies today's live files, uncommitted edits included. If another session changes one of those files meanwhile, the close-time hash check catches it.

## 7. Gaps (not verified here)
Real-device frame rates for every option; Kaggle T4 Cycles speed and quota (docs 404); residence.tech, Matterport and Realsee hands-on on a phone; whether the phone layout bug (C2) also holds on a real iPhone (headless iPhone-13 emulation only).
