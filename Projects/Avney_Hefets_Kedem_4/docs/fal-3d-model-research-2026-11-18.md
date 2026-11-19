# fal.ai 3D model research for a photoreal apartment walkaround (2026-11-18)

Scope: read-only, $0, keyless. No generation was run, so quality claims are **judgement from specs and vendor text, not measured**. Every model id below was confirmed against fal's public catalogue (`https://api.fal.ai/v1/models?category=image-to-3d`, accessed 2026-11-18) and its OpenAPI schema (`https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=<id>`, accessed 2026-11-18; copies in `docs/fal-probes-3d/schemas/`). Prices come from the fal model pages / `fal.ai/api/models` field `pricingInfoOverride` (accessed 2026-11-18). Speed is `unverified` everywhere: fal pages state none and nothing was run.

## Ranked recommendation

| Need | Top pick | Why | Cost |
|---|---|---|---|
| Objects (furniture) | `fal-ai/hunyuan-3d/v3.1/pro/image-to-3d` with **multi-view ON + PBR ON** (front + back + left + right) | Same model as today, but today's single-view call forces it to invent the hidden sides. Multi-view and PBR are schema options we are not using (schema has back/left/right/top/bottom/left-front/right-front slots). Second opinion for hero pieces (bouclé sofa, travertine table): `fal-ai/hyper3d/rodin/v2.5` Gen-2.5-High, `hd_texture`, `texture_delight`, `material=PBR`. | Hunyuan all options on: $0.375 + $0.15 PBR + $0.15 multi-view + $0.15 face count = $0.825 per item |
| Whole-scene realism | **World Labs Marble 1.1** (NOT on fal; own API) for a one-room pilot, viewed in three.js with Spark. On fal, nothing equals it | Real photoreal splat of a room from the client's own render(s); PLY export is free. Limits: per-room worlds, view quality drops away from the source viewpoint, no furniture swap/relight (conflicts with the RAINBOW swap feature). Treat as a "look" benchmark and optional hero-room layer, not a replacement of the mesh walk | $1.20 world + $0.08 pano step for multi-image = $1.28 per room; PLY free; GLB mesh $2.80 |
| Multi-view helper (extra views of the same item) | `fal-ai/nano-banana-pro/edit` (what we already call): one call per view with the studio shot as reference and a "rotate to back / left / right, same item, same fabric, white background" prompt | Same model family keeps the material consistent; already validated in our pipeline. Cheaper A/B: `fal-ai/qwen-image-edit-2511-multiple-angles` (azimuth/elevation/zoom controls) | $0.15 per view (nano-banana-pro); Qwen $0.035 per MP |
| Seamless PBR for floor/wall/stone | `fal-ai/patina/material/extract` (photo crop -> tileable basecolor/normal/roughness/metalness/height) | The only fal endpoint found that turns a photo into a seamless 5-map PBR set | $0.17 for 1024x1024 with 5 maps |

Honest caveat: no head-to-head test exists for furniture; the ranking among Hunyuan, Rodin, Meshy and Tripo is judgement plus vendor claims. Secondary 2026 comparisons credit Hunyuan for texture/PBR, Tripo for speed, Rodin for hero assets ([3daistudio Rodin vs Tripo vs Hunyuan](https://www.3daistudio.com/blog/rodin-2-5-vs-tripo-vs-hunyuan-3d-comparison), copied from the 2026-11-17 upgrade research, weak source). A $-gated bake-off on 3 items would settle it (see end).

## 1. Image-to-3D object models on fal

All rows: schema confirmed 2026-11-18 (HTTP 200). Texture resolution is rarely stated by fal; stated where the schema says it.

| Model id | Inputs | Output / PBR / polycount | Price | Speed | Verdict | Source |
|---|---|---|---|---|---|---|
| `fal-ai/hunyuan-3d/v3.1/pro/image-to-3d` | front image + optional back/left/right/top/bottom/left_front/right_front (multi-view) | GLB+OBJ; `enable_pbr` (metallic, roughness, normal); `face_count` 40k-1.5M, default 500k; `generate_type` Normal/Geometry; tex resolution not stated | $0.375; +$0.15 PBR; +$0.15 multi-view; +$0.15 custom face count (all = $0.825) | unverified | **#1 objects, use multi-view+PBR** | [page](https://fal.ai/models/fal-ai/hunyuan-3d/v3.1/pro/image-to-3d), [schema](https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=fal-ai/hunyuan-3d/v3.1/pro/image-to-3d) |
| `fal-ai/hyper3d/rodin/v2.5` | up to 5 `image_urls` (multi-view capable), prompt, bbox | glb/usdz/fbx/obj/stl; tiers Minimum..Extreme-High; quad 4K-200K or triangle 2K-2M; `material` PBR/Shaded/All; `texture_delight`, `hd_texture`; `is_micro` (Extreme-High only); HighPack add-on | $0.40; HighPack +$0.80 | unverified | **#2, hero pieces** (delight helps when a render's baked light would otherwise double up with our lightmap) | [page](https://fal.ai/models/fal-ai/hyper3d/rodin/v2.5), [schema](https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=fal-ai/hyper3d/rodin/v2.5) |
| `meshy/v7.1/multi-image-to-3d` | 1-4 images | GLB/FBX/OBJ/USDZ/STL; PBR maps (base, metallic, normal, roughness); `target_polycount` 100-300k (default 30k); `texture_model` meshy-n1 = 2K base colour; no 4k geometry in multi-image | $0.80 untextured; $1.20 textured (+$0.20 rig) | unverified | #3, pricier, good multi-view fallback | [page](https://fal.ai/models/meshy/v7.1/multi-image-to-3d), [schema](https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=meshy/v7.1/multi-image-to-3d) |
| `meshy/v7.1/image-to-3d` | single image | same, `geometry_resolution` standard/2k/4k | $0.80 / $1.20 | unverified | single-view only | [page](https://fal.ai/models/meshy/v7.1/image-to-3d) |
| `tripo3d/h3.1/multiview-to-3d` and `/image-to-3d` | multi-view `image_urls` / single | `pbr` default on, `geometry_quality` and `texture_quality` standard/detailed, `face_limit` 1k-2M, `quad`, `auto_size` (metres) | $0.20 no texture / $0.30 standard / $0.40 HD texture; +$0.20 detailed geometry; +$0.05 quad | unverified | cheap multi-view alternative worth one A/B (~$0.80 max) | [page](https://fal.ai/models/tripo3d/h3.1/multiview-to-3d), [schema](https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=tripo3d/h3.1/multiview-to-3d) |
| `tripo3d/p2/image-to-3d` | single | `face_limit` <=50k, `delight` default true, texture v3.5 | $1.00 untextured, $1.10-$1.30 textured | unverified | expensive; low poly cap suits web | [page](https://fal.ai/models/tripo3d/p2/image-to-3d) |
| `hitem3d/hi3d/v3.0/multi-view-to-3d` (and `/image-to-3d`) | front/back/left/right | `resolution` 2048quality / 2048master; recommended face count 2M / 5M; PBR default on; shading (de-shading) 0-1; glb/obj/stl/fbx/usdz | $0.02/credit: 2048quality $2.10; 2048master $9.10 (both incl. texture+PBR) | unverified | too heavy for a web walk (2M-5M faces); only as an offline reference benchmark | [page](https://fal.ai/models/hitem3d/hi3d/v3.0/multi-view-to-3d) |
| `fal-ai/trellis-2` | single | GLB only; `texture_size` 1024/2048/4096; `resolution` 512/1024/1536; `decimation_target` 5k-2M; no PBR switch in schema | $0.25 / $0.30 / $0.35 by resolution (prior research page read, 2026-11-17) | unverified | cheapest sanity check; no PBR | [schema](https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=fal-ai/trellis-2) |
| `fal-ai/trellis/multi` | multi-image | `texture_size`, `mesh_simplify` | price unverified | unverified | older generation | schema fetched |
| `fal-ai/hunyuan-3d/v3.1/rapid/image-to-3d` | single | OBJ+MTL+PNG texture; PBR option | $0.225; +$0.15 PBR | unverified | fast preview tier only | [page](https://fal.ai/models/fal-ai/hunyuan-3d/v3.1/rapid/image-to-3d) |
| `fal-ai/sam-3/3d-objects` | one scene image + text/point/box/mask prompt | GLB (optionally textured, `export_textured_glb`) and Gaussian-splat PLY per object, handles occlusion | $0.02 | unverified | useful to lift an item **directly out of the client render** (no studio-shot step); texture quality unknown, NOT-PROBED | [page](https://fal.ai/models/fal-ai/sam-3/3d-objects) |
| `speridlabs/idol` | single image | schema has `num_gaussians` (human-avatar splat model by its name) | price unverified | unverified | not for furniture | schema |
| Seed3D (`fal-ai/bytedance/seed3d/image-to-3d`) | | | | | DEAD per 2026-11-17 research ("no longer supported"); not in the active list today | prior report |
| Hunyuan3D 2.1 | | | | | not on fal (`fal-ai/hunyuan3d/v2.1` 404 in 2026-11-17 probe); only `hunyuan3d/v2*` older | prior report |

Ranking for photoreal furniture (judgement): 1 Hunyuan 3.1 Pro multi-view+PBR, 2 Rodin 2.5 (High, hd_texture, delight), 3 Meshy 7.1 multi-image, 4 Tripo h3.1 multiview (detailed texture), 5 Trellis-2. Fabric like bouclé and fine travertine pores are limited by the **input views and the 2K-ish texture**, not just the model: thin loops of bouclé will bake to a smooth fuzzy colour in any of them. Stone and wood grain are better handled as separate tiled PBR materials (section 3), mapped onto a clean low-poly shape, than as part of a generated texture atlas.

## 2. Image/scene-to-3D worlds

| Candidate | On fal? | Input | Output | Price | three.js? | Verdict | Source |
|---|---|---|---|---|---|---|---|
| World Labs **Marble 1.1** (and Plus, Draft) | **No** (no Marble endpoint in fal's catalogue; search 2026-11-18 found none) | pano image, single image, multi-image, text, video | SPZ splat (generated), PLY export (free, `full_res`), GLB mesh export (async) | rate 1,250 credits = $1: world $1.20 (1,500 cr), draft $0.12 (150 cr), Plus $1.20-$2.40; multi-image adds $0.08 pano step; HQ mesh GLB $2.80; PLY free; min purchase $5 | Yes: Spark (three.js splat renderer, PLY/SPZ/SOGS/splat/KSPLAT) | **Top whole-scene realism pick**, WORKS-WITH-KEY (separate vendor key, not probed) | [pricing](https://docs.worldlabs.ai/api/pricing), [FAQ](https://docs.worldlabs.ai/api/faq.md), [Spark](https://sparkjs.dev/), accessed 2026-11-18 |
| World Labs **Atlas** tasks (`images2PosedRGBD`, `posedImages2Splats`, `splats2Mesh`) | No | posed images (RGBD) | splat, GLB mesh + collider GLB | refined splat $5, draft $0.50 (secondary source, conflicting, beta); no public price page | Spark | amber/unverified; would let us build a splat from our own multi-view renders | [vr.org 2026-11-16](https://vr.org/articles/world-labs-atlas-six-api-endpoints-splats-to-mesh-open-access-2026) |
| `fal-ai/sam-3/3d-objects` | yes | one image + prompts | per-object GLB + Gaussian PLY | $0.02 | PLY via Spark, GLB native | cheap probe of "lift from render"; object-level only | [page](https://fal.ai/models/fal-ai/sam-3/3d-objects) |
| `microsoft/moge-3` (+`moge-2`) | yes | one image | depth-based textured GLB + coloured PLY point cloud | price unverified | GLB native | a 2.5D relief of one render, good for a parallax "window", not a walkable room | schema |
| `fal-ai/vggt-1b` | yes | many images or video | camera intrinsics/extrinsics, depth maps, point cloud | price unverified | feeds a splat/mesh trainer elsewhere | building block only (poses for Atlas-style flow) | schema |
| fal "worlds" category: `alibaba/abot-world-0`, `robbyant/lingbot-world-2`, `vast/eden-live-14b-game` / `5b-game`, `minimax/h3-max/director` | yes | WebRTC session (schema = SDP/ICE) | **live generated video stream, no exportable 3D** | unverified | No | DEAD for our purpose (interactive video, not geometry) | catalogue `category=worlds`, schemas |
| `tripo3d/triposplat` | **No**: fal catalogue search returns nothing and the page returns 404 on 2026-11-18, although a search snippet claimed $0.05 | | | | | unverified, treat as not available | [fal llms.txt](https://fal.ai/models/tripo3d/triposplat/llms.txt) (404) |
| `fal-ai/hunyuan_world` | No | | | | | DEAD (404, 2026-11-17 probe) | prior report |

Non-fal note: besides Marble, the options are self-hosted Gaussian-splat training from posed views (needs real or rendered multi-view; our 11 renders are single viewpoints) and Spark/SuperSplat for viewing. Splats also cannot swap furniture, relight, or measure, so they cover the RAINBOW baseline poorly.

## 3. Image helpers

| Purpose | Model id | Inputs | Output | Price | Verdict | Source |
|---|---|---|---|---|---|---|
| Extra views of the same item | `fal-ai/nano-banana-pro/edit` | prompt + up to many `image_urls`, `resolution`, `aspect_ratio` | image | $0.15 per image, 4K double | **Primary** (already in pipeline). Generate back/left/right sequentially, passing the studio front as reference | [fal price text](https://fal.ai/models/fal-ai/nano-banana-pro/edit) |
| same | `fal-ai/gemini-3.1-flash-image-preview/edit` and `fal-ai/nano-banana-2/edit` | same family | image | NB2 $0.08 at 1K (x1.5 at 2K) | cheaper A/B; consistency across views unverified | price text, 2026-11-18 |
| same | `fal-ai/qwen-image-edit-2511-multiple-angles` | `image_urls`, `horizontal_angle`, `vertical_angle`, `zoom` | image | $0.035 per MP | numeric camera control; product consistency untested | [page](https://fal.ai/models/fal-ai/qwen-image-edit-2511-multiple-angles) |
| same | `fal-ai/flux-2-lora-gallery/multiple-angles` | same controls | image | unverified | alternate | schema |
| Seamless PBR from a crop | `fal-ai/patina/material/extract` | `image_url`, `maps`, `tiling_mode`, `tile_size`, `upscale_factor` (SeedVR 2x/4x), `strength` | tileable basecolor, normal, roughness, metalness, height | $0.10 + $0.02/MP + $0.01/MP/map: 1024^2 with 5 maps = $0.17 | **Primary for wood floor, travertine, bouclé weave** | [page](https://fal.ai/models/fal-ai/patina/material/extract) |
| same, from a prompt | `fal-ai/patina/material` | prompt (+ optional image, mask) | same maps | same card (page not read) | alternative when no clean crop exists | schema |
| make an image tile | `fal-ai/z-image/turbo/tiling`, `fal-ai/seedvr/upscale/image/seamless` | image | tileable image | unverified | basecolor-only fallback | schema |
| Re-texture a mesh | `meshy/v7/retexture` (`texture_resolution`, `enable_pbr`), `meshy/n1/retexture`, `fal-ai/trellis-2/retexture`, `hitem3d/hi3d/texture` | mesh + style image | GLB | unverified | possible second pass: keep the Hunyuan geometry, re-texture from several clean views | schemas |

## What changes in our pipeline

1. **Stop single-view image-to-3D.** After the nano-banana-pro studio shot (front), make back, left, right views (3 more calls, $0.45) and pass them in the Hunyuan multi-view slots. Per item: 4 views $0.60 + Hunyuan $0.825 = about $1.43 (today's single-view path is $0.15 + $0.825 = $0.975 with PBR and face count on; if PBR is not on today, it is the cheapest part of the gap).
2. **Make sure `enable_pbr` is true** and that the slimming step keeps the normal, roughness and metallic maps; baked diffuse-only is the surest route to a "game" look. (Judgement.)
3. **Surfaces become materials, not mesh textures:** floors, wall stone and worktops get `patina/material/extract` maps ($0.17 each), applied tiled on clean geometry with correct real-world scale; bouclé and wood grain keep PBR normal detail. One tile per surface type, not per object.
4. **Lighting is probably the main "game" cause** (judgement, out of fal's scope): a diffuse-only lightmap flattens PBR. Test baked lightmap + AO on top of PBR, a probe/IBL reflection, and tone mapping; the model change alone will not fix it.
5. **Whole-scene benchmark:** one Marble room as the realism target and an optional splat layer; compare side by side with the mesh walk before committing.
6. **Optional shortcut:** `sam-3/3d-objects` at $0.02 per call straight from the client render, as a free-to-try replacement for crop -> studio shot -> 3D if its texture holds.

## Proposed bake-off (needs Eliran's spend word, nothing run)

Three items (bouclé armchair or sofa, wood-and-stone table, a lamp), each through: Hunyuan Pro single-view (today), Hunyuan Pro 4-view PBR, Rodin 2.5 hd_texture, Tripo h3.1 multiview detailed, Meshy 7.1 multi-image. About $0.83 + $1.43 + ($0.40 + $0.80 HighPack) + $0.80 + $1.20 = about $5.5 per item before the extra views, so roughly $16-18 for three; a trimmed two-item, three-model run is about $6-8. Plus one Marble room (about $1.28) and three Patina materials (about $0.50). Cap proposal for Eliran: $10 soft / $20 hard.

## NOT-PROBED

- Real generation quality and seconds for every model (no key, no spend).
- Texture pixel size on Hunyuan Pro and Rodin (fal pages do not state it).
- `sam-3/3d-objects` texture quality; `patina` real tiling quality on bouclé.
- World Labs key, Atlas endpoint prices (conflicting), splat view quality in a Hebrew-RTL three.js page; commercial-terms check (legal: amber, read World Labs ToS before use).
- Prices not shown on pages: Trellis multi, MoGe, VGGT, IDOL, retexture endpoints, Flux-2 multiple-angles.

## Evidence files

`docs/fal-probes-3d/list-image-to-3d.json`, `list-text-to-3d.json`, `search-misc.json`, `prices-all.json`, `prices-img.json`, `schemas/*.json` (about 30 OpenAPI schemas).
