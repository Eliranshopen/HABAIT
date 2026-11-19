# Tools research: 360 viewer, relight day/night, AI edit, assets (2026-11-17)

Every claim has a URL. UNVERIFIED = not confirmed from an official page in this pass (stated from general knowledge only). Prices are as shown on fal.ai model pages today and can change.

## A. Panorama viewers

| Viewer | Cross-fade of two panoramas | Mobile / gyro | Tiles | License | Maintenance |
|---|---|---|---|---|---|
| Photo Sphere Viewer v5 | `setPanorama()` has `transition {speed, rotation, effect}`, default 1500 ms `fade`; also `black`/`white`; the Virtual Tour plugin has its own fade between nodes. Source: https://photo-sphere-viewer.js.org/guide/config and https://photo-sphere-viewer.js.org/api/types/VirtualTourPlugin.VirtualTourTransitionOptions.html . Note: this fade is a node-to-node load transition, NOT a scrubbable mix slider (UNVERIFIED that a slider-driven mix is possible; would need a custom overlay) | Official Gyroscope plugin: https://photo-sphere-viewer.js.org/plugins/ | Equirect-tiles, cubemap and cubemap-tiles adapters as separate npm packages: https://www.mintlify.com/mistic100/Photo-Sphere-Viewer/migration | MIT: https://photo-sphere-viewer.js.org/plugins/ | Active: 5.14.x packages on jsDelivr: https://cdn.jsdelivr.net/npm/@photo-sphere-viewer/cubemap-adapter@5.14.1/README.md |
| Plugins (v5) | Autorotate, Compass, Gallery, Gyroscope, Map, Markers, Overlays, Plan, Resolution, Settings, Stereo, Video, Virtual Tour, Visible Range: https://photo-sphere-viewer.js.org/plugins/ . Overlays and Plan map directly to the reference's floor-plan modal and hotspots (Markers). No relight plugin | | | | |
| Marzipano | Scenes are stacks of layers sharing one view; `switchTo` and `lookTo` tweens exist, but layer opacity or cross-fade is not documented on the page read: https://www.marzipano.net/reference/Scene.html . A mix of two layers by opacity is plausible (UNVERIFIED) | "Supports all major desktop browsers and mobile devices", gyro not mentioned: https://www.marzipano.net/ | Multires: UNVERIFIED on the pages read (it is known for it) | Apache-2.0 | ARCHIVED, read-only since 2026-04-20: https://github.com/google/marzipano . Do not build on it |
| Pannellum | No built-in scene cross-fade seen in the page read: https://github.com/mpetroff/pannellum | Gyro: not stated on the page read (UNVERIFIED) | Multires generator `utils/multires/generate.py` (needs Hugin nona): same URL | MIT: same URL | Release date not shown; 212 open issues: same URL. Sparse, UNVERIFIED |
| three.js custom sphere | Fully ours: two textured spheres (or one shader with `mix(texA, texB, t)`) and a slider drives `t`. Exactly the reference's mechanism. Standard three.js technique; no doc fetched, UNVERIFIED by URL | DeviceOrientation controls: UNVERIFIED by URL | Cube tiles/multires: we write it | MIT (UNVERIFIED by URL) | Active (UNVERIFIED by URL) |

Reading: for a slider-driven day/night, only a shader mix on our own sphere (or a PSV overlay we write) reproduces the reference exactly. PSV gives viewer chrome (gyro, markers, plan, tiles) for free and has a fade only between nodes.

## B. Real-time web 3D for lighting changes

Fetched material on this was thin. Confirmed:
- Gaussian splats bake illumination into the model; relighting is research code, shadows weaker, glass unhandled: https://arxiv.org/pdf/2410.11419 , https://arxiv.org/pdf/2504.18468 . No browser-ready relighting found.
- Unreal Pixel Streaming: roughly 1 GPU instance per 1 to 4 sessions; g4dn.xlarge about $0.53/h on-demand (blog-level source, treat as indicative); one blog estimate ~$3,120/month for 100 peak concurrent users, GPU only: search result set at https://forums.unrealengine.com/t/pixel-streaming-cost/660659 and https://www.abratabia.com/unreal-engine/pixel-streaming-hosting.php . Managed tiers $3.90 to $6.60/h: https://fr.zerolight.com/omnistream . Verdict: per-viewer cost, wrong for a public listing page.
- three.js, React Three Fiber, Babylon.js, PlayCanvas: UNVERIFIED by official page in this pass. From general knowledge: all run WebGL2 on phones, baked lightmaps plus light probes are the way to get "photoreal" static interiors, and a day/night switch means shipping 2 to 4 baked lightmap sets or the same cross-fade of pre-rendered images. Real-time global illumination and soft area-light shadows at photo quality on mid phones are not realistic; that is why the reference and we pre-render.

Conclusion for B: on phones, the photoreal path is pre-rendered panoramas plus a cheap shader mix. Real-time relighting is not needed for the add-on.

## C. Offline rendering (Blender)

- Cycles-only features: light linking and shadow linking are listed as Cycles-only in the manual: https://docs.blender.org/manual/en/latest/render/cycles/object_settings/object_data.html (page truncated, only the heading line confirmed).
- Eevee Next is the new real-time engine since 4.2 LTS: https://wiki.blender.org/release_notes/4.2/eevee/ and https://www.cgchannel.com/2024/07/eevee-next-finally-arrives-in-blender . Its interior quality vs Cycles for emissive night fixtures: UNVERIFIED. Our pipeline is already Cycles; keep it for fidelity and deterministic seeds.
- Sky: the Sky Texture node uses the Nishita model with sun elevation and sun disc controls, intended for day and sunset skies: https://docs.blender.org/manual/en/latest/render/shader_nodes/textures/sky.html . Sun Position add-on: UNVERIFIED by URL. Night: switch sky strength down, moon/ambient fill, turn on emissive lamps (our own scene work).
- AgX replaced Filmic as the default view transform in 4.0 and handles over-exposed bright areas better: https://wiki.blender.org/release_notes/4.0/color_management/ . Use the same view transform for all four variants so they stay pixel-aligned and cross-fade cleanly.
- Denoise settings for night interiors (OIDN vs OptiX): UNVERIFIED in this pass.
- Key point: render the 4 variants from the SAME camera, SAME seed, SAME geometry, only changing lights and sky. That gives the pixel-aligned keyframes the reference has, with zero invented geometry. This is a deterministic equivalent of the reference's (probably AI) relight.
- Poly Haven HDRIs: CC0, any purpose incl. commercial, no credit: https://polyhaven.com/license . Day/sunset/night variants exist by name in the library; exact per-HDRI inventory UNVERIFIED here.

## D. AI relighting, 360 generation, image-to-video (fal.ai)

| Model | Use | Price on the official page | URL |
|---|---|---|---|
| FLUX.1 Kontext [pro] | instruction image edit | $0.04/image | https://fal.ai/models/fal-ai/flux-pro/kontext |
| Nano Banana edit (Gemini image) | image edit | $0.0398/image | https://fal.ai/models/fal-ai/nano-banana/edit |
| Qwen-Image-Edit | image edit | $0.03/megapixel; page says DEPRECATED | https://fal.ai/models/fal-ai/qwen-image-edit |
| IC-Light v2 | relight plus background replace by prompt | $0.1/megapixel | https://fal.ai/models/fal-ai/iclight-v2 |
| HunyuanWorld image-to-panorama | image to 1920x960 equirect | $0.15/image (search-result summary, page not fetched directly) | https://fal.ai/models/fal-ai/hunyuan_world |
| HunyuanWorld image-to-world | 3D world | $0.30/generation (same caveat) | https://fal.ai/models/fal-ai/hunyuan_world/image-to-world |
| Kling 2.5 Turbo Pro image-to-video | aerial intro | $0.35 for 5 s, +$0.07/s | https://fal.ai/models/fal-ai/kling-video/v2.5-turbo/pro/image-to-video |
| Veo 3 Fast image-to-video | intro | $0.10/s no audio, $0.15/s audio; page says DEPRECATED, Veo 3.1 listed instead | https://fal.ai/models/fal-ai/veo3/fast/image-to-video |

Not verified: Skybox AI (Blockade Labs) pricing, Seedance price, equirect edge seam handling by the edit models. Image-edit models work on a flat 2:1 image; they can leave the seam, poles and small objects inconsistent and may alter details. A relit variant therefore is NOT guaranteed pixel-aligned with the base. That matches the reference's observation of small objects changing between day and night. For our hard rule, any AI relight must be diffed against the Blender base (mask check on walls, windows, openings) and carry the AI badge.
Also seen: tencent/hy-world-2.1-panorama on OpenRouter (text to equirect, price unclear, UNVERIFIED): https://openrouter.ai/tencent/hy-world-2.1-panorama

## E. Asset licenses

- Poly Haven: CC0, commercial OK, no credit required; site logos, example renders and user renders are excluded; no scraping: https://polyhaven.com/license
- ambientCG: CC0 1.0, commercial OK, credit appreciated not required: https://docs.ambientcg.com/license/
- BlenderKit: two licenses. Royalty Free (commercial OK, no credit, no resale of the asset in the same form) and CC0; per-asset, so check each asset; free vs paid plan restrictions not described on the page: https://www.blendkit.com/docs/licenses/ (the blenderkit.com URL 301-redirects there)

## F. The specific reel / workflow

Searched the exact title and "comment property" phrasing. No post, no creator and no workflow description found. Only generic third-party material (Claude Design property sites, Ritn3D floor-plan-to-3D): https://thepaperlessagent.com/blog/anthropics-claude-design-smashes-single-property-websites , https://www.chatprd.ai/how-i-ai/workflows/how-to-create-an-interactive-3d-house-model-from-a-floor-plan-using-ai . Verdict: UNKNOWN. A "comment to get the workflow" reel is typically a lead-gen funnel, so a public workflow may not exist (inference, UNVERIFIED).

## Ranked recommendation (fidelity first, day/night as add-on)

1. Keep Blender Cycles as the source of truth. Render 4 lighting variants per node from the same camera and seed (Nishita sky for Morning/Day/Sunset, low sky plus emissive fixtures for Night), AgX for all. Result: pixel-aligned keyframes, no invented geometry, deterministic, fits manifest and cost rules. Cost is render time only.
2. Viewer: Photo Sphere Viewer v5 (MIT, active) for chrome (gyro, tiles, markers, plan, virtual-tour nodes); add the day/night slider as our own overlay or a small shader mix. If PSV cannot mix two textures under a slider, fall back to a minimal custom three.js sphere with a `mix(A,B,t)` shader (the reference's exact mechanism). Do not use Marzipano (archived). Pannellum is a weaker fallback.
3. Day/night slider: linear mix of two adjacent baked variants, ship as tiles or cubemap JPEG/AVIF per variant; test on a 390 px phone. Decision for Eliran: 4 keyframes or 3.
4. AI relight only as an optional shortcut: Kontext or Nano Banana at about $0.04 per image can produce night variants cheaply, but results are not guaranteed aligned and must pass a diff gate against the Blender base plus the AI badge. Only on Eliran's go, within the spend rails. Use it for night mood on stills, not as the panorama of record.
5. Aerial intro: image-to-video (Kling 2.5 Turbo Pro, about $0.35 per 5 s) from a rendered exterior is atmosphere only; label as AI per disclosure rule, and never as a real property.
6. Skip: Unreal Pixel Streaming (per-viewer GPU cost), Gaussian splats (baked light, no relight), real-time GI on phones.

Open verifications before any build: PSV mix-slider feasibility (hand-prove on one room per root §3), Poly Haven night HDRI inventory, Cycles night denoise settings, Skybox AI and Seedance prices.
