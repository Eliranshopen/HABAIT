# RAW REPORT 2 — AI rendering / restyling / staging tools for archviz & real estate (image side), Nov 2026

Research subagent output (session habait-ab). English, sources inline. Not edited; see ../SUMMARY-he.md for the Hebrew synthesis.

Scope: not re-benchmarking fal models already tested (GPT Image 2.5, Nano Banana 2, Seedream 5 Pro, Kling O3 Pro, LTX). Focus: who offers what, API-readiness, geometry lock, 360° support, consistency, and what is missing. Prices are as published by vendors or dated third-party checks; several vendors hide pricing behind login, flagged where so.

## 1. The user's list

**MyArchitectAI** — Pay-per-call REST API (`api.myarchitectai.com/v1`, `x-api-key`), OpenAPI spec published. Endpoints: `/render/interior`, `/render/exterior` (image + optional prompt → photoreal from a "3D view export"), `/edit-by-prompt`, `/change-textures` (mask-based, "keeping geometry"), `/set-atmosphere` (time of day/season/weather/interior lighting presets), `/style-transfer` (with `styleTransferStrength`), `/animate` (one or two keyframes → short video), `/upscale` (4K/8K), `/text-to-image`; 5 req/s, failed generations refunded, `/balance` returns USD (https://www.myarchitectai.com/openapi.json, https://myarchitectai.com/llms.txt). The Polish API page claims ~$0.03/render, ~13 s, 99.8% success (https://www.myarchitectai.com/pl/api); the per-endpoint price table did not render in my fetch, so verify. App plans $29/$49/$99 per month, inputs JPG/PNG/WebP only, 4K download claimed (https://www.renderahouse.com/blog/best-ai-rendering-tools). No depth/edge control parameter is exposed, no 360 or multi-view feature. Verdict: cheapest ready-made "clay → photoreal" API, but geometry fidelity is implicit (img2img), not controllable.

**Spacely AI** — Enterprise REST API documented: Instant Rendering (preset styles / custom input / image style transfer), Product Visualization (furniture/decoration placement), Precision Space Planning (1-/2-point perspective); 1 credit per successful call; API key from dashboard (https://docs.enterprise.spacely.ai/spacely-ai-enterprise/introduction/credit-consumption). Business-plan subscribers got API access in Oct 2025 (https://resources.spacely.ai/whats-new-in-spacely-ai-faster-smarter-and-more-creative-october-2025-edition). Plans restructured July 2026 to Personal/Studio/Agency (https://spacely.ai/blog/spacely-ai-subscription-plans-2026-new-pricing-explained); third-party listing: $12.75/$38.25/$102 per month (https://knowara.com/ai-tools/image/spacely-ai-review/). Price per credit not published. No 360.

**GenRoom / RoomsGPT (RoomGPT) / ReRoom AI** — consumer interior restylers, no public APIs found. GenRoom from $5.99/mo, 2048 px output; ReRoom up to 4096 px on Professional, also exteriors; RoomGPT paywalled since 2024 (https://genroom.io/en/blog/best-ai-room-design-tools). Not SaaS-backend material.

**Midjourney** — Still no official API as of Oct 2026; ToS prohibits automation; resellers (Apiframe, CometAPI) exist but violate ToS (https://unifically.com/blogs/midjourney-api, https://pricepertoken.com/midjourney-pricing). Plans $10/$30/$60/$120 (https://eesel.ai/blog/midjourney-pricing). V8.2 default since 24 Jul 2026; `--oref` dropped on V8, replaced by an Edit Model accepting up to 4 references; `--sref` remains (https://blog.picassoia.com/midjourney-v8-2-edit-model-new-features-and-omni-reference, https://docs.midjourney.com/docs/style-reference). Video: image-to-video 5 s, extendable to 21 s, ~26 GPU-min per 4-clip batch. No native equirectangular/HDRI mode found; it "invents geometry". Verdict: style-reference engine only; not usable in a backend.

**PromeAI** — 42-tool suite incl. sketch rendering; official pricing not published to G2; third-party figures conflict ($19–$39/mo Basic/Pro; one lists $119/mo Pro) (https://www.g2.com/products/promeai/pricing, https://dupple.com/tools/promeai). No developer API documentation found.

**Rendero** — no product by that name found; closest is "Renderro" (cloud workstation, $99/mo) (https://www.xpay.sh/agent-ready-index/renderro/). Treat as unverified.

**ArchitectGPT** — $25/$45/$90 per month, Basic 300 generations (https://architectgpt.io/pricing, https://architectgpt.io/faq). No API found.

## 2. Competitors / adjacent

**Veras (Chaos, ex-EvolveLAB)** — Plugin for Revit, SketchUp, Rhino, Archicad, Vectorworks, Forma, Allplan plus web app; now bundled into Enscape/V-Ray/Corona ("Chaos puts Veras everywhere", May 2026) (https://www.chaos.com/veras, https://digitalproduction.com/2026/05/29/chaos-puts-veras-everywhere/). Pricing: Starter $16.90/mo, Pro $29/mo billed annually (500 / 2,000 Chaos credits). "Geometry Override" slider controls departure from the model; material/façade studies "keep massing intact" and are powered by Nano Banana. Reviewers note detail varies between views of the same building (https://aitoolsbakery.com/blog/veras-review/). No public API. Chaos credits: $8.30/250, $25.30/1,000, $50.80/3,000 (https://www.chaos.com/get-more); AI Enhancer = 20 credits full image, 15 object-only; older docs cap it at 2048².

**ArkoAI** (SketchUp/Rhino/Revit plugins, renders current view, no fixing control, tiers unpublished), **LookX** (free + ~$20/mo; sketches/plans/CAD; "less dependable for strict geometry"), **ArchiVinci** ($79/mo or $549/yr), **mnml.ai** (Lite $29 / Plus $49 / Studio $119; API only in enterprise bundles from $349/mo), **ReRender AI** ($45/mo; weaker multi-view consistency), **Rendair** ($19/$49/$190), **Gendo** (~£79/mo studio) — all from a Sept/Oct 2026 price check (https://www.renderahouse.com/blog/best-ai-rendering-tools); Archsynth ~ $16/mo (https://gendo.ai/blog/top-10-ai-rendering-software-architects-2026). **Visoid**: free tier, Revit 2025–2027 and Rhino plugins, reviewers report invented window frames (https://visoid.com/pricing, https://tooliverse.ai/tools/visoid). **Maket**: floor-plan generator, Plus $20/mo — not a renderer. **Vizcom**: Starter free (credits cut to 800/mo in Jul 2026), Pro ~$49/mo, Enterprise custom; no public API (https://www.vizcom.com/pricing).

**Interior staging / consumer**: Virtual Staging AI (virtualstagingai.app) $16–$79/mo for 6–150 photos ($2.67→$0.53/photo), API only on Enterprise (https://www.virtualstagingai.app/prices). REimagine Home (Styldod): from $14–$29/mo, REST + webhooks advertised, API rates quote-only. Collov: API advertised, ~$0.23–0.27/image on plans, quote-based. HomeDesigns AI from $27/mo, "API" listed. Interior AI Pro $996/yr; no API found. Palette.fm: colorization only, low relevance.

**Real-time engines' AI**: D5 Render 3.0 (Jan 2026): AI Scene Match (lighting from reference), AI Enhancer, AI Image→3D, PBR Material Snap, style transfer, inpainting, super-res; Pro $38/mo or $360/yr; D5 Lite free with 50 AI attempts; Windows + RTX only (https://www.d5render.com/posts/d5-render-3-0-ai-rendering-design-workflow, https://www.cgchannel.com/2026/01/dimension-5-launches-d5-render-3-0-and-d5-lite/). Lumion Pro 2025: AI 8K upscaler only. Twinmotion: $445/yr, free under $1M revenue, no notable AI image features found. SketchUp Diffusion → renamed "AI Render", free to subscribers, credit-limited, img2img not 3D-aware. Autodesk Forma Board AI rendering: images/PDF/Revit views, Standard vs Pro tiers; Forma Building Design launched 7 Apr 2026. None of these have a cloud API suited to a SaaS.

**General-purpose APIs**: Flux — 1 credit = $0.01; Kontext pro $0.04, max $0.08; FLUX.2 per-megapixel (pro ~$0.03, max ~$0.07 first MP) (https://docs.bfl.ai/quick_start/pricing.md); FLUX.1 Depth/Canny use channel-concat conditioning, Depth is commercially licensed, Canny is dev/non-commercial (https://huggingface.co/docs/diffusers/main/en/api/pipelines/flux); community FLUX.2-dev-Fun-ControlNet-Union covers canny/HED/depth/MLSD (https://hackernoon.com/a-guide-to-flux2-dev-fun-controlnet-union); Klein LoRA training on fal $0.0043/step (https://fal.ai/models/fal-ai/flux-2-klein-9b-base-trainer/llms.txt). Krea 3 API ~$0.03 at 1K / $0.06 at 2K, +$0.02 per reference, early access; Krea app syncs live viewports from Revit/Rhino/SketchUp/Blender. Ideogram 4.0 API $0.03–$0.10, Instructional Edit $0.20. Leonardo: pay-as-you-go tokens. Depth: Marigold v2 on fal $0.03/image (https://fal.ai/models/fal-ai/marigold-v2); Depth Anything 3 (ByteDance, Apache-2.0, arXiv 2511.10647) on Replicate ~$0.001/run.

**360 / panorama**: Blockade Labs Skybox AI — API: Model 3 8192×4096 (1 credit), Model 4 4096×2048 (3 or 6 credits), `control_image` remix (equirectangular ≥2048×1024, "keeps structure not colors"), `init_image`/`init_strength`, 2048×1024 depth map, `horizon_shift` (https://docs.blockadelabs.com/api/skybox.html). Plans: Essential $20 (100 cr, no API), Standard $48 (300 cr, API), Business $112 (500 cr, HDRI, commercial IP), Enterprise custom (https://skybox.blockadelabs.com/plans). Model 3.1 added Remix of uploaded 360s and mesh export for top tier. World Labs Marble API: $1/1,250 credits; world from panorama $1.20 (Draft $0.12), from image/text +$0.064, mesh export $2.80, splat free; AMD acquisition announced 28 Sep 2026, API continuity unstated (https://docs.worldlabs.ai/api/pricing). Hunyuan World 1.0 image-to-world on fal $0.30/run, commercial use permitted. Open LoRAs: Flux.2 Klein 9B 360 LoRA and ERP outpaint LoRA (https://huggingface.co/crafiq/flux-2-klein-9b-360-panorama-lora, https://huggingface.co/nomadoor/flux-2-klein-9B-360-erp-outpaint-lora); Qwen-Image-2.1-Edit pano360 LoRA (warns stacking realism LoRAs weakens projection) (https://huggingface.co/Gogodr/qwen-image-2.1-edit-pano360-lora); Krea-2 ERP LoRAs; fal hosts Qwen-Image-Edit-2511 with LoRA (~$0.05/img). Research: DiT360 (Insta360, CVPR 2026, MIT, ~37 GB VRAM); 360Anything perspective→360 (arXiv 2601.16192); PanoWorld whole-house consistent panoramas (arXiv 2605.17916); Pano2World panorama→3D Gaussians (arXiv 2607.00832); DiffPano++ multi-view panorama (IJCV 2026). GPT Image 2 / Nano Banana 2 produce 2:1 ERP by prompt, seams need a viewer test or ComfyUI Panorama Seam Prep.

**ComfyUI clay→render**: standard recipe = depth pass or Canny from the 3D model → ControlNet/Flux Depth → refine → upscale; Flux is the community default, Qwen-Image for signage, Z-Image for light GPUs; ~24 GB VRAM for full Flux (https://archigenai.com/qwen-flux-zimage-comfyui-architecture-render-2026.html); ArchForge (SDXL, dual ControlNet, accepts clay renders) (https://github.com/jilt/ArchForge); recommended strengths depth 0.6–0.9, canny 0.5–0.8.

## 3. What studios/proptech actually use (2026)

- RIBA Journal (Mar 2026): image generation is the most common AI use among architects; examples built with Flux 2 in ComfyUI, edits with Nano Banana (https://www.ribaj.com/intelligence/how-architects-use-and-will-use-ai-in-2026-and-beyond/).
- Chaos/Architizer 2026 report: ~two-thirds of firms experimenting, ~1 in 5 fully embracing; 86% of users report time savings; value concentrated in concept generation and image enhancement (https://architizer.com/blog/inspiration/industry/ai-in-architecture-report-2026-chaos/). CGarchitect 2024 survey: 72.9% had used AI tools; Chaos 2025 State of ArchViz: only 11% of firms had AI in the viz pipeline.
- Production finals remain V-Ray/Corona; AI sits in concepting, mood, post. D5 cites WilkinsonEyre and Chapman Taylor (vendor claim). Kunkun Visual (CGarchitect 3D Awards 2025 winner) uses AI to shorten developer launch campaigns (https://www.kunkunvisual.com/insights/archviz-trends-2026/).
- Takeaway: nobody ships a "sales plan → tour" product on these tools; studios use plugin tools (Veras/D5) for concept and ComfyUI/Flux for controlled img2img. The clay-control pipeline is in line with the professional pattern, not behind it.

## 4. Comparison table

| Tool | Input | Geometry control | 360 ERP | API | Price |
|---|---|---|---|---|---|
| MyArchitectAI | image (+prompt/mask/ref) | implicit img2img; mask textures | no | yes, pay-per-call | ~$0.03/render (verify) |
| Spacely AI | photo/render | implicit | no | yes (Business/Enterprise) | 1 credit/call, $/credit unpublished |
| Veras (Chaos) | live BIM/3D view | Geometry Override slider | no | no | $16.90–29/mo + credits |
| Chaos AI Enhancer | Enscape/V-Ray render | enhance only | no | no | 20 credits ≈ $0.35–0.65 |
| D5 Render 3.0 | D5 scene | native 3D | 360 render native, AI not | no | $38/mo |
| Skybox AI (Blockade) | text, ERP control/init image | remix keeps structure | yes, 8K/4K + depth | yes (Standard+) | $48–112/mo, 1–6 cr/gen |
| World Labs Marble | pano/image/text | n/a (world gen) | pano in, splat/mesh out | yes | $1.20/world, mesh $2.80 |
| Hunyuan World (fal) | image | n/a | panoramic world | yes | $0.30/run |
| Flux.2 / Kontext (BFL, fal) | image + prompt (+depth/canny on FLUX.1 or community CN) | yes with control models | via LoRA only | yes | $0.03–0.08/img |
| Qwen-Image-Edit-2511 + LoRA (fal) | image + prompt | edit-preserving; pano LoRA | yes via LoRA | yes | ~$0.05/img |
| Krea 3 API | image + refs | not exposed | ERP LoRA (Krea 2, self-host) | early access | $0.03–0.06/img |
| Ideogram 4.0 | text/image | no | no | yes | $0.03–0.20/img |
| Marigold v2 / Depth Anything 3 | image | produces depth | no | yes | $0.03 / ~$0.001 |
| Virtual Staging AI / REimagine / Collov | photo | furniture only, room fixed | no | enterprise/quote | $0.23–2.67/img |
| Midjourney | text/image refs | none | no | none (ToS) | $10–120/mo |
| GenRoom/RoomGPT/ReRoom/ArchitectGPT/PromeAI/LookX/ArkoAI/Visoid/Vizcom | image/plugin | weak or plugin-view | no | no | $6–90/mo |

## 5. Shortlists

**Clay render → photoreal, geometry locked (test these 5):**
1. FLUX.1 Depth [pro] (BFL/fal) — official, commercial, channel-concat depth from the Blender Z pass; $0.04-class pricing.
2. FLUX.2-dev + Fun ControlNet Union (self-host/ComfyUI) — canny+depth+MLSD together for straight walls/windows; check dev licence.
3. Qwen-Image-Edit-2511 with a custom LoRA (fal) — edit model that preserves input structure, LoRA trainable on the developer's own renders for the "Rainbow look".
4. MyArchitectAI `/render/interior` + `/set-atmosphere` — zero-engineering baseline at ~$0.03 to benchmark against.
5. Flux.2 Klein 9B LoRA trained on fal ($4.30/1,000 steps) + depth control — cheapest path to a project-specific style model.

**Photoreal 360 panorama from a 3D scene (3):**
1. Blockade Skybox AI Model 4 with `control_image` = Blender equirectangular clay render (remix keeps structure, 4096×2048 + depth map, HDRI on Business).
2. Qwen-Image-2.1-Edit pano360 LoRA or Flux.2 Klein ERP LoRA fed with the equirectangular clay render as edit input (self-host or fal LoRA endpoint).
3. Hybrid: render 6 cube faces in Blender → restyle each with a geometry-locked model → stitch to ERP → seam-inpaint; then optionally Marble ($1.20) or Hunyuan World ($0.30) to get a walkable splat for the clickable tour.

## 6. Risks
- **Geometry drift is universal**: every img2img tool (Veras, Visoid, MyArchitectAI, Midjourney) is documented inventing windows/frames or varying between views; only explicit depth/edge conditioning keeps sales-plan accuracy — a legal issue for marketing apartments.
- **Multi-view consistency is unsolved commercially**: only research (PanoWorld, DiffPano++, Pano2World) addresses same-room-from-several-angles; plan on 3D-reconstruction (splats) rather than independent generations.
- **Licensing**: FLUX.1 Canny and FLUX.2-dev are non-commercial; Flux Depth and Qwen are commercial-safe; Blockade commercial IP only on Business.
- **Vendor instability**: Veras absorbed into Chaos credits; World Labs being acquired by AMD with no API guarantee; Midjourney API resellers breach ToS.
- **Pricing opacity**: Spacely, PromeAI, Collov, REimagine, Vizcom hide per-call costs; MyArchitectAI's table did not render — confirm by test calls before modelling COGS.
- **Panorama LoRAs degrade when stacked with realism LoRAs** and leave seams; budget a seam-repair pass.

Gaps not verified: PromeAI/Palette.fm/Interior AI API existence, Leonardo per-image rates, 360Anything code release, MyArchitectAI exact per-endpoint prices.
