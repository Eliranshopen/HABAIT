# Upgrade research: from "cartoonish" boxes to real, high-end objects (image-to-3D, repaint, free assets, web realism)

Date 2026-11-17. Lane: capability-scout, $0, keyless (no key read, no .env opened, no login, no paid call, nothing generated). "WORKS-WITH-KEY" = endpoint exists today and its live schema accepts our inputs; no model was run.
Extends `docs/fal-model-research.md` (same date); that file's edit/upscaler tables are NOT repeated, only deltas are. Evidence in `docs/probes-upgrade/` (file list at the end). Prices come from fal's public catalogue endpoint (`https://fal.ai/api/models?q=<id>`, field `pricingInfoOverride`) and model pages, all accessed 2026-11-17, unless tagged `unverified`.

## 0. Headline (read this first)
1. **The "cartoon" comes from the source scene (box furniture, flat materials), not from the bake.** Every route that renders the *current* scene better (3D Gaussian Splatting, a higher-quality bake, PBR shading) polishes boxes. Only replacing the objects changes the verdict. So the order is: objects first, shading second, splats never (for this job).
2. **Objects:** a three-source mix. (a) CC0/royalty-free real models for the generic pieces (Poly Haven CC0, BlenderKit free tier); (b) fal image-to-3D for the 4-5 design-specific hero pieces (bouclé sofa, rattan chair, lantern, oak dining chair) at about $0.40-0.83 per attempt; (c) **do NOT AI-generate the oak shelving**: thin boards are the known failure of every generator, keep it modelled in Blender and give it a real oak PBR texture.
3. **Best fal image-to-3D for furniture:** `fal-ai/hunyuan-3d/v3.1/pro/image-to-3d` (multi-view inputs, PBR, face count control, GLB) with `fal-ai/hyper3d/rodin/v2.5` as the second opinion (clean quad meshes, 4K texture add-on). `fal-ai/trellis-2` is the cheapest sanity check. Seed3D is deprecated on fal.
4. **Input is the bottleneck:** our renders are only 1200 px wide, so a sofa crop is roughly 500-700 px. Do not feed raw crops. First have `fal-ai/nano-banana-pro/edit` ($0.15) rebuild the piece as a clean studio shot on white (and 2-6 other angles for Hunyuan multi-view), then image-to-3D.
5. **Web shading:** MeshStandardMaterial/Physical with baked lightmap + tiled PBR detail maps + a per-room environment probe is a 1-2 day job, $0, works in three.js 0.170 (GTAOPass, SSRPass, OutputPass all present in the 0.170.0 examples, HTTP 200). Splats need three >= 0.180 (Spark) and an NVIDIA/WebGPU GPU to train; not possible on this CPU-only machine.

---
## 1. fal image-to-3D (all $0 schema + catalogue probes, 2026-11-17)
Source of the list: `https://api.fal.ai/v1/models?category=image-to-3d&status=active` (38 active endpoints, `probes-upgrade/list-i23d-api.json`). Source of prices: `pricingInfoOverride` in `probes-upgrade/list-i23d.json`. Schemas: `probes-upgrade/schemas/`. Typical time: **not stated on any page I could read; unverified** (measure on the first paid run).

| endpoint id | price per call (catalogue 2026-11-17) | input | output / controls | verdict |
|---|---|---|---|---|
| `fal-ai/hunyuan-3d/v3.1/pro/image-to-3d` | $0.375 base; +$0.15 PBR; +$0.15 multi-view; +$0.15 custom face count (all on = $0.825) | `input_image_url` (front, 128-5000 px, max 8 MB, "simple background, single object" tip) + optional back/left/right/top/bottom/left-front/right-front views | `model_glb` + `model_urls` (GLB, OBJ; example 38 MB GLB), `face_count` 40k-1.5M (default 500k), `generate_type` Normal/Geometry, `enable_pbr` (metallic, roughness, normal) | **WORKS-WITH-KEY, first choice** |
| `fal-ai/hunyuan-3d/v3.1/rapid/image-to-3d` | $0.225; +$0.15 PBR | single image | faster/cheaper tier | WORKS-WITH-KEY, cheap tier test |
| `fal-ai/hunyuan3d-v3/image-to-3d` | $0.225 Geometry / $0.375 Normal / $0.45 LowPoly; +$0.15 each for PBR, multi-view, face count | single (+multi-view) | LowPoly mode is web-friendlier | WORKS-WITH-KEY |
| `fal-ai/hyper3d/rodin/v2.5` (Rodin "Gen-2.5") | $0.40; +$0.80 with addon HighPack (4K texture) | `image_urls` up to 5, optional prompt, `bbox_condition` | tiers Minimum..Extreme-High; `quality_mesh_option` 4K..200K **Quad** or 2K..2M Triangle; `material` PBR/Shaded/All; `texture_delight`; `hd_texture`; formats glb/usdz/fbx/obj/stl; returns `textures[]` separately | **WORKS-WITH-KEY, second choice** (quad + delight = best for re-baking) |
| `fal-ai/hyper3d/rodin/v2.5/fast` | $0.10 | same | fast preview tier | WORKS-WITH-KEY (cheap prompt/angle tests) |
| `fal-ai/hyper3d/rodin/v2` (Gen-2) | price text empty; unverified | | older | superseded by v2.5 |
| `tripo3d/h3.1/image-to-3d` | $0.20 no texture; $0.30 standard; $0.40 HD texture; +$0.20 detailed geometry; +$0.05 quad | single image | `pbr` (default on), `face_limit` 1k-2M, `quad`, `auto_size` (real-world metres), `texture_alignment`, orientation | WORKS-WITH-KEY |
| `tripo3d/h3.1/multiview-to-3d` | same table | multi-view | | WORKS-WITH-KEY |
| `tripo3d/p2/image-to-3d` | $1.00 untextured; $1.10-$1.30 textured (fast..extreme); quad free; PBR uses texture rate | single | `face_limit` <= 50k (quad <= 25k), `delight` (default true), texture_version v3.5 | WORKS-WITH-KEY, expensive; the 50k cap suits web |
| `tripo3d/tripo/v2.5/image-to-3d` | $0.20 / $0.30 / $0.40 (+$0.05 style/quad) | single | older | WORKS-WITH-KEY, cheap fallback |
| `fal-ai/trellis-2` | $0.25 (512), $0.30 (1024), $0.35 (1536) | single image | `model_glb` only; `texture_size` 1024/2048/4096, `decimation_target` default 500k, `remesh`, UV unwrap knobs; page does not state PBR (unverified; schema has no PBR switch) | WORKS-WITH-KEY, cheapest decent GLB |
| `fal-ai/trellis`, `fal-ai/trellis/multi` | price text empty; unverified | single / multi | older | not assessed |
| `meshy/v7.1/image-to-3d` | $0.80 untextured; $1.20 textured | single | `target_polycount` (default 30k), `topology` quad/triangle, `enable_pbr`, `geometry_resolution` standard/2k/4k, `texture_image_url` | WORKS-WITH-KEY, pricey |
| `meshy/t2.5/image-to-3d` | $0.20 mesh / $0.60 textured, PBR included | single | smart topology | WORKS-WITH-KEY, good value alternative |
| `hitem3d/hi3d/v3.0/image-to-3d` | $2.10 (2048 quality) / $9.10 (2048 master) | single | PBR, `face_count` 100k-5M, glb/obj/fbx/usdz | over budget for 10+ objects |
| `fal-ai/hunyuan3d/v2` (+turbo, mini, multi-view) | price text empty; unverified | | **Hunyuan3D 2.1 is NOT on fal**: `fal-ai/hunyuan3d/v2.1` returns 404 (probe) | older generation |
| `fal-ai/bytedance/seed3d/image-to-3d` (Seed3D) | page: $0.011 per 1k tokens, ~30k tokens typical, so ~$0.33 (my arithmetic) | `image_url` only | output a ZIP | **DEAD-ish: page says "This model is no longer supported"; not in the active list** |
| `fal-ai/sam-3/3d-objects` | $0.02 | | segments an object out of a scene to 3D (new Dec 2025) | NOT-PROBED for quality; interesting for cropping *directly from the render*, but at 1200 px source it will be soft |
| `microsoft/moge-3`, `moge-2` | $0.015 / $0.01 per MP | | monocular geometry, not furniture assets | not relevant |

Auth probe: POST to `queue.fal.run/fal-ai/trellis-2` without a key returns HTTP 401 "Authentication is required" (`probes-upgrade/auth-probe-no-key.txt`): confirms every call needs `FAL_KEY` (it is in the root keys file by name, per project memory; not checked here).

### 1.1 Which is best for clean furniture with fine detail
No furniture-specific head-to-head exists. Secondary sources (vendor blogs, treat as weak): 3D AI Studio's 2026 report credits Hunyuan3D for texture/PBR quality, Tripo for speed, Rodin for film-grade hero assets, Trellis.2 as open-source standout; another notes Trellis 2 does hollow/thin-walled shapes better; every guide says thin parts, legs, slats and glass stay hard ([Trellis 2 vs Hunyuan](https://www.3daistudio.com/blog/trellis-2-vs-hunyuan-3d-differences-explained), [Rodin 2.5 vs Tripo vs Hunyuan](https://www.3daistudio.com/blog/rodin-2-5-vs-tripo-vs-hunyuan-3d-comparison), [state of AI 3D 2026](https://3daistudio.com/state-of-ai-3d-generation-2026); accessed 2026-11-17).
My ranking for THIS job (judgement, not measured):
| piece | route | why |
|---|---|---|
| beige bouclé modular sofa | Hunyuan 3.1 Pro, multi-view + PBR | big soft volume, texture matters most; bouclé micro-loops cannot be modelled, so use the AI albedo + a tiling bouclé normal map in Blender |
| rattan/cane lounge chair | Rodin 2.5 (High, Triangle 150k, then decimate) or Hunyuan Pro | woven cane = see-through lattice; expect fused holes. Fallback: free BlenderKit "Rattan chair" (section 3) |
| oak dining chair | free asset first (Poly Haven `dining_chair_02`, BlenderKit "Oak Dining Chair"), else Hunyuan | thin legs/spindles are risky |
| paper lantern, rattan pendant | BlenderKit free (cc_zero lantern, royalty-free rattan pendants) | simple, assets exist |
| ceramic vases, books, branches, blanket | Poly Haven CC0 | already real |
| **oak shelving with thin boards** | **do not use image-to-3D**; keep Blender geometry, add real oak PBR material | boards 15-20 mm thick fuse into slabs or vanish; geometry is trivial to model exactly |
| oak kitchen | keep Blender cabinetry geometry + oak PBR + brushed handles | same reason (flat panels, edges matter) |

### 1.2 Required pipeline wrapper (what makes the difference)
1. Crop the piece from the Corona render (1200 px wide sources: expect ~500-700 px crops, `ls` of file sizes in `probes-upgrade/render-sizes.txt`).
2. `fal-ai/nano-banana-pro/edit` ($0.15; see section 2): "same sofa, same fabric, clean e-commerce studio photo, white background, soft light, no extra items"; plus 2-6 further angles for Hunyuan's `left/right/back/top/left_front/right_front` slots. Multi-view surcharge is only $0.15 and it removes the occluded-back guesswork.
3. Image-to-3D with PBR on, `face_count` ~60-150k (not 500k).
4. Blender: decimate/retopo to 20-60k tris, fix scale in metres, drop into the scene, **bake with the room lighting** (the AI's baked highlights are replaced; use Rodin `texture_delight` or Tripo `delight` to reduce double lighting).
5. Mandatory: honesty/disclosure rules of the harness (AI-made assets of a property carry the "הדמיה · AI-generated" badge; the walkaround is already a simulation). Eliran's call, not mine.
Budget for 5 hero pieces x 2 attempts x ~$0.83 (Hunyuan all add-ons) + 5 x 2 x $0.15 (nano-banana-pro sheets) = about **$9.8 worst case**; with Trellis-2 as screening step (5 x $0.30) about $1.5 to find which pieces are viable first. All "typical time" values unverified.

---
## 2. 2D photoreal pass: deltas only (base list in `fal-model-research.md` section 1 and 3)
New or newly priced since that file (catalogue 2026-11-17, `probes-upgrade/new-edit-model-prices.txt`):
| endpoint | price | note | verdict |
|---|---|---|---|
| `fal-ai/gemini-3-pro-image-preview/edit` | $0.15 (1K), $0.30 (4K); page: up to 4K, "up to 2 reference images" (the existing nano-banana-pro/edit page says 14 refs; conflict, unverified) | same model as Nano Banana Pro under another id, updated 2026-11-17 | WORKS-WITH-KEY; use `fal-ai/nano-banana-pro/edit` |
| `fal-ai/gemini-3.1-flash-image-preview/edit` | $0.06 (512), $0.08 (1K), $0.12 (2K), $0.16 (4K) | page says it is "Nano Banana 2", i.e. the same price card as `nano-banana-2/edit` | duplicate of the validated NB2 |
| `bytedance/seedream/v5/pro/edit` (2026-07-07) | $0.0675 (<= 1536x1536), $0.135 (<= 2048x2048), "tentative", +$0.0045 per extra input | "changes one element, keeps rest"; region-precise | WORKS-WITH-KEY, unvalidated; candidate for local fixes (swap a texture on one object) |
| `openai/gpt-image-2.6/flare/edit` and `/sunburst/edit` (2026-11-04/06) | token billed: image out $30/M tokens, default quality high | "changes only what's asked, composition intact" | WORKS-WITH-KEY; real per-image cost unverified (the prior file already warns the $0.60 booking looks high) |
| `bytedance/seedream/v5.5/layerize`, `fal-ai/qwen-image-layered` | NOT-PROBED | split an image into layers | could isolate a furniture piece with alpha; not assessed |
| `fal-ai/bria/background/remove`, `fal-ai/birefnet/v2` | birefnet schema fetched (200); price unverified | cutout of the piece before image-to-3D | only needed if nano-banana white-background sheet is not used |
Not re-probed (already in the earlier report, prices there): nano-banana-2 ($0.12 at 2K), nano-banana-2.1 ($0.063 at 2K), flux-pro/kontext ($0.04/$0.08), flux-2 family, qwen-image-edit-2511 ($0.03/MP), SeedVR ($0.001/MP), Topaz precision ($0.08 per 24 MP), clarity-upscaler ($0.03/MP), crystal-upscaler ($0.016/MP). Topaz/clarity/crystal/bria ids did not appear in the catalogue search endpoint today (`probes-upgrade/upscaler-prices.txt`), so those prices remain page-text claims from the earlier file.

**Recommendation (stills):** `fal-ai/nano-banana-pro/edit` ($0.15) for hero stills and for the object sheets of section 1.2; `fal-ai/nano-banana-2/edit` 2K ($0.12) for the batch; SeedVR ($0.001/MP) as the only upscaler (faithful, ~free). Creative upscalers (clarity, Topaz creative) invent micro-detail and move edges, so they are wrong for "keep geometry exactly".
**Caveat that matters:** a repainted still is a flat picture. It can NOT replace the walkaround's bake (view-dependent, would not match from other angles). Its real uses here: (1) marketing stills, (2) the reference sheets for image-to-3D, (3) texture reference (re-project into an atlas by hand; research-grade effort, NOT-PROBED).

---
## 3. Free / cheap real assets matching the design line
### 3.1 Poly Haven (CC0)
Licence: all assets CC0, commercial use, no attribution needed, redistribution allowed ([polyhaven.com/license](https://polyhaven.com/license), accessed 2026-11-17). Keyless API works: `api.polyhaven.com/assets?t=models` returned 522 models (200, `probes-upgrade/polyhaven-models.json`; a User-Agent was sent) and `/files/<id>` lists glTF at 1k/2k/4k. Full candidate scan (269 keyword hits) in `probes-upgrade/polyhaven-fit-candidates.txt`. Exact ids that fit the brief (look not visually checked unless noted, **fit = candidate**):
| need | Poly Haven ids | fit |
|---|---|---|
| ceramic vases | `ceramic_vase_01`, `_02`, `_03`, `_04` (2.2k tris, 8k tex for _04), `antique_ceramic_vase_01`, `ceramic_pot`, `planter_pot_clay` | good |
| dried branches | `dry_branches_medium_01` (glTF listed), `dead_quiver_branch_01/_02` | good |
| books | `decorative_book_set_01` (softcover/hardcover with ~90 cover variants), `book_encyclopedia_set_01` | good |
| cushions | `throw_pillows_01` | good (not a blanket) |
| baskets | `wicker_basket_01`, `wicker_basket_02` | good, rattan feel |
| dining chair / table | `dining_chair_02` (2.7k tris), `wooden_stool_01/_02`, `round_wooden_table_01/_02`, `small_wooden_table_01`, `dining_table` | candidate, check style |
| lounge / sofa | `mid_century_lounge_chair`, `modern_arm_chair_01`, `Ottoman_01`; `sofa_03` (8k tris, **vintage leather**), `Sofa_01`, `sofa_02` | NO bouclé modular sofa exists |
| tables | `modern_coffee_table_01/_02`, `coffee_table_round_01`, `side_table_01`, `side_table_tall_01` | candidate |
| lamps | `modern_ceiling_lamp_01`, `Lantern_01` (metal), `wooden_lantern_01`, `hanging_industrial_lamp` | **no paper lantern, no rattan pendant** |
| shelves | `wooden_display_shelves_01`, `wooden_bookshelf_worn` | not our oak line; keep own geometry |
| plants | `potted_plant_01/_02/_04` (02 and 04 already in the model folder) | already used |
| not found at all | bouclé sofa, rattan lounge chair, throw blanket, paper lantern, rattan pendant | see 3.2 |
Poly Haven also has CC0 PBR *textures* (oak, plaster, linen), the best fix for the shelving/kitchen materials; not enumerated here (NOT-PROBED, textures endpoint `?t=textures`).

### 3.2 BlenderKit
- Licence: royalty-free assets are usable commercially; the main restriction is selling the asset on its own ([FAQ](https://www.blenderkit.com/faq-frequently-asked-questions/) via search result, accessed 2026-11-17; **verify the licence text before shipping**). A few assets are `cc_zero`.
- Free plan $0/month, catalogue limited (search snippet: about 22.9k models free vs 80k with Full ~$9-9.90/month; sources disagree, unverified) ([pricing](https://www.blenderkit.com/plans/pricing)). One redirect on the docs page pointed to a look-alike domain (`blendkit.com`); I did not follow it, treat that domain as untrusted.
- **Search is keyless and works headless**: `https://www.blenderkit.com/api/v1/search/?query=asset_type:model+<terms>+is_free:true` returned results (`probes-upgrade/blenderkit-search-free.txt`). Result rows carry a `files[]` list with `gltf`, `blend`, `resolution_1K` entries.
- **Download needs an account key**: the glTF URL returned HTTP 403 `"Parameter scene_uuid not set"` without login (`probes-upgrade/blenderkit-download-probe.txt`). So headless download = one free account + API key (kept in env, names only) + the `scene_uuid` parameter; exact header format NOT-PROBED. Alternative: Eliran downloads by hand in the Blender add-on.
- Free matches found by search (all `isFree: true`): "Bouclette bench", "Black wood and boucle tissu round stool" (royalty_free, bouclé-covered but not a modular sofa; 11 hits for "boucle sofa"), "Rattan chair" (glTF listed, 4,328 faces, 2K textures), "Indochine Lounge Chair", "Calova Lounge Chair", "Medan Lounge Chair" (82 hits for rattan lounge chair), "Japanese Hanging Paper Lantern" (**cc_zero**), "Japanese Lantern", "Sepherina Rattan Pendant Light", "Beatrice Pendant Lamp", "Oak Dining Chair", "Dark oak dining chair", "Ollie Dining Chair", "Ceramic Vase 02" (cc_zero), "Throw Pillows 01" (cc_zero), "Fabric sofa". Look and quality not inspected (NOT-PROBED visually).

### 3.3 Sketchfab
- Search is keyless: `api.sketchfab.com/v3/search?type=models&downloadable=true&license=cc0|by` (`probes-upgrade/sketchfab-search-cc0.txt`). **CC0 hits for the design pieces: none** (only museum vases at 60-300k faces, not usable). CC-BY hits: Japanese paper lanterns (800-2,750 faces), "Woven Bamboo Sphere Pendant Light" (40k), "The Rattan Venus Chair" (530k, too heavy), "COCOON Lounge Chair" (36k, replica of a named designer chair, rights risk), "Oak Chair" (20k), bouclé sofas "Lilt Sofa Boucle Gray" (1.5M faces, too heavy), "Sofa from MRS Collection" (49k).
- Download requires a signed-in account (OAuth/API token) per [Sketchfab download guidelines](https://sketchfab.com/developers/download-api/guidelines) (2026-11-17). CC-BY requires visible author credit and licence; the guidelines say the app must display licence and attribution and state models come from Sketchfab. Acceptable in a credits panel, but for a developer's marketing walkaround it adds a legal chore. Classification: **amber** (per-asset licence check, attribution UI, replica-of-branded-design risk). Sketchfab is the last resort.

### 3.4 Licence for real-estate marketing
Poly Haven CC0: green. BlenderKit royalty_free/cc_zero: green-amber (commercial use allowed; keep a per-asset licence log; do not redistribute the raw asset files). Sketchfab CC-BY: amber. AI-generated meshes (fal): output ownership/commercial terms are per-vendor; fal lists these endpoints as `license_type: commercial` in the catalogue (2026-11-17); read each vendor's terms before delivery (unverified). Lawyer-gated: none of this is final legal advice.

---
## 4. Making the web walkaround photoreal
Current state (read-only): `walkaround/walk.js` uses `MeshBasicMaterial` with baked diffuse atlases (bake_0..5, 2048 px jpg), three.js 0.170, `walkaround/model` = 33 MB.

| route | what it is | needs | effort | $ | expected gain | verdict |
|---|---|---|---|---|---|---|
| **A. PBR layer on the bake** | MeshStandardMaterial (or Physical for glass/ceramic): albedo `map` + **lightMap/aoMap** from a separate Cycles pass, tiled `normalMap`/`roughnessMap` for oak, plaster, fabric; `scene.environment` from a PMREM of the sky/HDR; optional GTAOPass + SSRPass (floor/glass) + OutputPass; ACES tone map | re-bake **two** passes (albedo/diffuse-colour and lighting) instead of one combined; second UV set for lightmaps | 1-2 days of bake-script work + 1 day viewer (my estimate) | $0 | medium: kills the flat, "painted" look, gives glossy floor/ceramic response; does NOT fix box geometry | **DO, after the objects are replaced** |
| A1. three.js passes available in 0.170.0 | GTAOPass, SSRPass, SSAOPass, SAOPass, SMAAPass, UnrealBloomPass, OutputPass: all HTTP 200 on unpkg (`probes-upgrade/three170-passes.txt`) | | | | docs: [GTAOPass](https://threejs.org/docs/pages/GTAOPass.html), [SSRPass](https://threejs.org/docs/pages/SSRPass.html); a forum thread reports SSR and SSAO passes do not chain well in stock three | stack carefully; cost = frame time on phones (unmeasured) |
| A2. libraries | `n8ao` 2.1.0 (ISC, three >= 0.137), `realism-effects` 1.1.2 (SSGI/SSR, MIT, three >= 0.148); both need the `postprocessing` package | | | | | usable on 0.170; npm registry 2026-11-17 |
| **B. 3D Gaussian Splatting** | train splats from a few hundred Cycles renders, view in browser | NVIDIA CUDA GPU for original code and gsplat ([gsplat](https://github.com/nerfstudio-project/gsplat): PyTorch + CUDA); Postshot = Windows + NVIDIA (RTX 2060 class, search result); Brush = Rust/WebGPU, any GPU vendor, no documented CPU mode ([Brush](https://github.com/ArthurBrussee/brush)); **no splat/NeRF/3D-reconstruction endpoint exists on fal** (11 keyword searches empty, `probes-upgrade/fal-splat-search.txt`) | 300 CPU Cycles renders at 1200+ px: several hours to a day (estimate, unmeasured) + 1-2 days pipeline (COLMAP-format export from Blender cameras; a commercial add-on "Datasplat" exists, [listing](https://superhivemarket.com/products/datasplat---blender-to-gaussian)) + rent a GPU: RunPod 4090 community from ~$0.34/h, A100 80GB $0.89-1.79/h, trackers disagree after the Sep-Oct 2026 hikes ([search results](https://www.runpod.io/pricing), 2026-11-17); training ~20-60 min per run (unverified) so about $1-3 | **no gain here**: splats reproduce the training renders, which contain the same box furniture; synthetic images train cleanly but floaters appear, and walking off the camera path degrades | **NO** for this job. If ever wanted: Spark (`@sparkjsdev/spark` 2.4.0, MIT) loads PLY/SPZ/SPLAT/KSPLAT/SOG next to normal three meshes **but requires three >= 0.180**, i.e. an upgrade from 0.170 with likely regression work; collision = keep the existing walk grid/glTF as an invisible collider (World Labs' Collider Builder is the standard idea) |
| **C. Better bake on cloud GPU** | more samples, 4096-8192 atlases, OptiX denoise, separate passes | RunPod/any Blender-capable GPU; our scripts are CPU Cycles | 0.5 day to port the bake script; cost about $1-3 per full bake (estimate from the GPU rates above) | small (noise/resolution only), no change to look | worth it only for the final pass after A and the new objects; the current CPU route works |
Windows CPU-only machine: A is fully doable locally; C and B need a rented GPU; nothing in section 1-2 needs a local GPU.

---
## 5. Recommended sequence and spend ask (Eliran's call; nothing was spent)
1. $0: scan Poly Haven + BlenderKit candidates visually (thumbnails), pick the generic pieces; download CC0 now (Poly Haven needs no key).
2. About $1.5 (needs Eliran's word): Trellis-2 screening of 5 hero pieces from nano-banana-pro sheets ($0.15 x 5 + $0.30 x 5); pick the ones that hold.
3. Up to about $8 more: Hunyuan 3.1 Pro (multi-view + PBR) / Rodin 2.5 on survivors.
4. Replace boxes in Blender, keep own oak shelving/kitchen with real oak PBR textures (Poly Haven textures, $0).
5. Re-bake in two passes, add MeshStandardMaterial + environment probe + GTAO in the viewer (route A).
6. Skip splats.

## 6. NOT-PROBED / unverified list
- Any live generation (no key use): output quality, time per call, GLB poly/texture sizes, whether Trellis-2 gives PBR.
- Typical times for every endpoint.
- Poly Haven asset *looks* (only names/categories/poly counts); Poly Haven textures list.
- BlenderKit authenticated download format; free-tier catalogue limits; exact licence text.
- fal vendor commercial-output terms (Hunyuan/Tripo/Rodin/Meshy) per vendor.
- `fal-ai/sam-3/3d-objects` quality; layerize endpoints.
- Brush CPU-only mode (undocumented); gsplat CPU mode (undocumented); Spark collision docs; splat file sizes.
- three.js SSR+GTAO chaining in 0.170 and mobile frame cost.
- RunPod prices (third-party trackers disagree).

## Evidence files (`docs/probes-upgrade/`)
`list-i23d-api.json`, `list-i23d.json` (catalogue incl. price text), `schemas/*.json` (18 OpenAPI schemas: seed3d, hunyuan pro/rapid/v3, rodin 2.5 + fast, tripo h3.1/p2/multiview, trellis-2, trellis/multi, meshy 7.1/t2.5, hitem3d v3, birefnet, sam-3 3d-objects), `auth-probe-no-key.txt`, `new-edit-model-prices.txt`, `list-i2i-api.json`, `upscaler-prices.txt`, `polyhaven-models.json`, `polyhaven-fit-candidates.txt`, `sketchfab-search-cc0.txt`, `blenderkit-search-free.txt`, `blenderkit-download-probe.txt`, `fal-splat-search.txt`, `three170-passes.txt`, `render-sizes.txt`.
