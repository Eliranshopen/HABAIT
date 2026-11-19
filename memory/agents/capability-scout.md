# capability-scout — agent memory (file created 2026-11-16; none existed)

## 2026-11-16 · capability-scout · fal image-edit landscape for the 2:1 pano skin pass ($0 docs-only)
- **Did:** keyless fal listing + openapi schemas + model pages for newer edit models, structure-locked and upscalers; no keys, no paid calls.
- **Evidence:** `docs/research/buyer-capabilities/probes/fal-image-edit/2026-11-16-fal-edit-landscape.md`
- **Learned:** gpt-image-2.6 (sunburst/flare, 2026-11-04) exists; 2.5/2.6 have quality xhigh and max; page prices for 2.5 high at ~2MP are ~$0.04-0.07 + refs, far below our booked $0.60 (booking looks conservative; verify real billing). flux-3/edit-image takes aspect 2:1 natively. Nano Banana 2.1 has no 2:1. fal pricing API needs a key.
- **Owed / open:** no model was run; bake-off needs Eliran's spend word.
- **Second reader:** none

## 2026-11-17 · capability-scout · fal model pipeline for geometry-true interior renders + 360 panoramas ($0, keyless)
- **Did:** keyless listing, 28 OpenAPI schemas and model pages for edit, ControlNet, upscaler, depth and panorama candidates; report with verdicts, cost table, acceptance checks.
- **Evidence:** `.wt/harei-zahav-naama/out/harei-zahav-naama/3-rooms/docs/fal-model-research.md` + `docs/fal-probes/`
- **Learned:** no fal endpoint does geometry-true equirect panoramas; fal-ai/hunyuan_world is DEAD (404); flat-view repaint with nano-banana-2/edit (2K $0.12) stays the primary route, nano-banana-2.1 ($0.063 at 2K) is the unvalidated cheaper A/B; fal-ai/flux-general (depth+canny, $0.075/MP) is the hard-geometry fallback; fal listing API 429s after ~25 calls/min.
- **Owed / open:** A/B bake-off needs Eliran's spend word (~$1-2); NOT-PROBED rows in the report.
- **Second reader:** none

## 2026-11-17 · capability-scout · upgrade research: image-to-3D, luxury repaint, free assets, web photoreal for the harei-zahav-naama walkaround ($0, keyless)
- **Did:** keyless fal catalogue + 18 OpenAPI schemas for image-to-3D, Poly Haven/BlenderKit/Sketchfab keyless searches, three 0.170 pass presence, splat/GPU tool review; report with verdicts.
- **Evidence:** `.wt/harei-zahav-naama/out/harei-zahav-naama/3-rooms/docs/upgrade-research.md` + `docs/probes-upgrade/`
- **Learned:** fal prices live in `https://fal.ai/api/models?q=<id>` field `pricingInfoOverride` (keyless). Seed3D deprecated; Hunyuan3D 2.1 not on fal (only v2, v3, 3.1 pro/rapid). Best: hunyuan-3d/v3.1/pro ($0.375 +0.15 PBR/multiview/facecount) then rodin v2.5 ($0.40). Renders are only 1200 px, so rebuild each piece with nano-banana-pro first. No fal splat endpoint; Spark needs three>=0.180; splats/bake only polish the box furniture. BlenderKit search keyless, download needs account key (403 scene_uuid). Poly Haven CC0 has no boucle sofa/rattan chair/paper lantern; BlenderKit free has them.
- **Owed / open:** no live generation; ~$1.5 screening + up to ~$8 needs Eliran's spend word; visual check of candidate assets.
- **Second reader:** none

## 2026-11-18 · capability-scout · fal 3D model research for the Avnei Hefetz photoreal walkaround ($0, keyless)
- **Did:** fal catalogue (image-to-3d, worlds, texture), ~30 OpenAPI schemas, model pages, World Labs pricing/FAQ docs; no generation, no keys.
- **Evidence:** `.wt/avnei-hefetz-kedem-4/Projects/Avney_Hefets_Kedem_4/docs/fal-3d-model-research-2026-11-18.md` + `docs/fal-probes-3d/`
- **Learned:** objects: Hunyuan 3.1 Pro with multi-view+PBR ($0.825) then Rodin 2.5; Marble is NOT on fal (own API, $1.20-1.28/room, PLY free, Spark for three.js); fal "worlds" = WebRTC video, no 3D; triposplat 404; patina/material/extract = seamless 5-map PBR ($0.17); extra views via nano-banana-pro ($0.15) or qwen multiple-angles ($0.035/MP). Likely main "game look" cause is diffuse-only lighting, not the model (judgement).
- **Owed / open:** bake-off ~$6-18 needs Eliran's spend word; speed and texture px unverified.
- **Second reader:** none
