# fal.ai model research: geometry-true photoreal pass for Blender interiors (incl. 360 panoramas)

Date 2026-11-17. Lane: capability-scout, $0, keyless (no key read, no env checked, no login, no paid call). Nothing below was *run*; "WORKS-WITH-KEY" means the endpoint exists today and accepts our inputs per its live schema, but no image was generated.
Evidence: `fal-probes/` (listings, 28 OpenAPI schemas, price table `fal-probes/README-and-price-snippets.md`). Prices are page text accessed 2026-11-17 (fal's pricing API needs a key). Page text and schema disagreed once (nano-banana-2 page says no seed, schema has `seed`): schema wins.
Local leads re-verified: `C:\RnD\memory\project\2026-11-16-kedma-d1-simulation.md`, `docs/research/buyer-capabilities/probes/fal-image-edit/2026-11-16-fal-edit-landscape.md`.

## 0. Headline
1. **No fal endpoint generates or edits a geometry-preserving equirectangular panorama.** `fal-ai/hunyuan_world` (+ `/image-to-world`) that older indexes list is DEAD (404 page, null schema, models API `not_found`). The catalogue has no panorama/skybox/equirect endpoint (searches: pano, panorama, 360, equirectangular, skybox, hdri, spherical, environment = empty; first 100 text-to-image models scanned).
2. **Your working hypothesis holds, and nothing newer refutes it:** Cycles equirect = authoritative geometry, level rectilinear flat views, an instruction-edit model repaints each, register to CG edges, project back with feathered seams. It is also what our own Kedma measurements support (whole-pano skin: doors 7-8 deg off, invented wall).
3. **Primary model: Nano Banana 2 (`fal-ai/nano-banana-2/edit`, 2K, $0.12/view).** It is the only model with our own geometry evidence (Kedma: CG view as sole image, kept geometry, matched gpt-image high at ~$0.08/view at 1K). Newer, cheaper `google/nano-banana-2.1/edit` ($0.063 at 2K) is a one-afternoon A/B, not yet validated.
4. Whole job costs about **$1.5-2.6 expected for hero + 6 stills + living pano, $4-7 with 4 more panoramas** (table in section 6).

## 1. A. Instruction-based edit (what to repaint a flat view with)
All accept a list `image_urls` (refs), a `prompt`, and output formats. "2:1" matters only for whole panoramas; flat views use 1:1 / 4:3 / 16:9.

| endpoint (listing date) | max res / aspect | seed | price (page, 2026-11-17) | notes | verdict |
|---|---|---|---|---|---|
| `fal-ai/nano-banana-2/edit` (2026-02-26) | 0.5K/1K/2K/4K (~16 MP at 4K); enum has 21:9..9:16, 4:1, 8:1; **no 2:1** | yes (schema) | $0.08 at 1K, $0.12 2K, $0.16 4K; +$0.002 high thinking | 14 refs; thinking_level, system_prompt, temperature, top_p; **our validated model** | WORKS-WITH-KEY (Kedma-proven, memory) |
| `google/nano-banana-2.1/edit` (2026-10-06) | 1K/2K/4K; same enum, no 2:1 | yes | token-billed: 1K $0.044, 2K $0.063, 4K $0.138 (+~$0.002/ref) | newer, ~45% cheaper than nb2; no geometry evidence yet | WORKS-WITH-KEY, unvalidated |
| `fal-ai/nano-banana-pro/edit` (2025-11-20) | 1K/2K/4K; no 2:1 | yes | $0.15 (1K/2K), ~$0.30 4K | "optimised for quality"; best candidate for ONE hero still; not geometry-tested by us | WORKS-WITH-KEY, unvalidated |
| `fal-ai/nano-banana/edit` (v1, 2025-08-19) | ~1 MP, no 2:1 | yes | $0.0398 | cheapest Gemini-family; older, softer | WORKS-WITH-KEY |
| `google/nano-banana-lite/edit` (2026-06-30) | fixed 1K | unverified | tokens only, per-image unverified | probably under $0.05 | unverified |
| `openai/gpt-image-2.6/sunburst/edit` (2026-11-04); 2.5 sunburst/flare; `fal-ai/gpt-image-1.5/edit` | max edge 3840, area <= 8.29 MP, aspect <= 3:1 (2:1 ok), mult. of 16; 16 refs | no | 2048x2048: low .050, med .088, high .107, xhigh .19; 3840x2160 high .100; + refs ~$0.008 | prompt-faithful; whole-pano use FAILED our test; Kedma booked high at ~$0.60, the page shows ~$0.11: real billing unverified | WORKS-WITH-KEY; strong 2nd opinion for stills |
| `fal-ai/flux-pro/kontext` / `/max` (2025-05) | ~1-2 MP, aspect 9:21..21:9 | yes | $0.04 / $0.08 per image | single input image, guidance_scale only; weaker realism than Gemini-class; known to keep layout | WORKS-WITH-KEY |
| `fal-ai/flux-2-pro/edit` (2025-11-23) | `image_size` any w x h (schema cap 14142; real cap unverified), input <= 9 MP, 9 refs | yes | $0.03 first MP + $0.015/extra MP in+out (1920x1080 = $0.045) | Kedma: copied bends of the old picture (when given one) | WORKS-WITH-KEY |
| `fal-ai/flux-2-flex/edit`, `fal-ai/flux-2-max/edit`, `fal-ai/flux-2/edit` (dev, open) | as above; flex has steps 2-50 + guidance 1.5-10 | yes | flex $0.05/MP, max $0.07+$0.03/MP, dev $0.012/MP | flex = the only one with real guidance knobs | WORKS-WITH-KEY |
| `fal-ai/flux-2/klein/9b/edit` (+4b, +lora) | ~1 MP inputs | n/s | $0.011/MP in+out | fast typed edits (platform already uses it); low realism ceiling | WORKS-WITH-KEY |
| `blackforestlabs/flux-3/edit-image` (2026-10-01) | 768sq..4k tiers; aspect enum **includes 2:1**; 10 refs | no | $0.048 at 1K; other tiers unverified | page promises "everything else stays as it was"; 4k reported as minutes (2026-11-16 note) | WORKS-WITH-KEY, unvalidated |
| `bytedance/seedream/v5.5/edit` (2026-11-11); v4.5 (2025-12-03); v5/pro | 0.92-4.62 MP, aspect 1/16..16 | no | $0.03 (<=2.61 MP) / $0.0405, +$0.012 per ref | Kedma: Seedream 4.5 copied bends (whole pano); v5.5 not tested | WORKS-WITH-KEY, unvalidated |
| `fal-ai/qwen-image-edit-2511` (+`-multiple-angles`, `/lora`) | `image_size` free (default = input size); 3 refs | yes | $0.03/MP ($0.035 with LoRA) | open weights, cheapest decent; weaker photoreal | WORKS-WITH-KEY |
| `fal-ai/hunyuan-image/v3/instruct/edit` | unverified | unverified | $0.09/MP | no evidence it beats the above | unverified |
| others seen in listing, not assessed: minimax/h3-image/edit (tokens), krea/v3/edit ($0.025/MP), alibaba/qwen-image-3/edit ($0.04-0.075), meta/muse-image/edit, microsoft/mai-image-2.5(-pro)/edit, xai/grok-imagine-image/*/edit, ideogram/v4.5/edit, bria/fibo-2/edit, luma/agent/uni-1 | | | | | NOT-PROBED |

## 2. B. Explicit geometry control (ControlNet)
| endpoint | control inputs | price | notes | verdict |
|---|---|---|---|---|
| `fal-ai/flux-general/image-to-image` | `controlnet_unions[]` (control_mode: canny, depth, tile, blur, pose, gray, low-quality; conditioning_scale 0-2, start/end %), `strength` 0.01-1, seed, LoRAs, IP-adapters, `reference_image_url` | $0.075/MP (rounded up) | the only fal path with hard canny+depth conditioning AND img2img strength; FLUX.1-dev base = visibly less photoreal than Gemini-class | WORKS-WITH-KEY, fallback |
| `fal-ai/z-image/turbo/controlnet` (+`/lora`) | `image_url` + `preprocess` (none/canny/depth/pose), `control_scale` 0-1, start/end | $0.0065/MP, 8 steps | ~1 cent per view; text-to-image style (no multi-ref); quality unproven for interiors | WORKS-WITH-KEY, cheap lane |
| `fal-ai/flux-lora-depth` | prompt + source image (depth derived by the endpoint) | $0.035/MP | no direct depth input | WORKS-WITH-KEY |
| `speridlabs/iris-z/depth-to-image` (2026-11-16, FLUX.2-based) | `depth_image_url` (depth/disparity/colorized) | $0.14 (<=1 MP) / $0.28 | **our Cycles Z-pass could be the control**; max 1024 tier, brand new, no evidence | WORKS-WITH-KEY, unvalidated |
| `fal-ai/flux-control-lora-depth/image-to-image`, `fal-ai/sdxl-controlnet-union` | | | model pages 404, schema null | **DEAD** |
| `fal-ai/fast-sdxl-controlnet-canny`, `fal-ai/sd15-depth-controlnet`, `fal-ai/controlnetsdxl` | canny / depth | unverified | 2023-24, low realism | not worth it |
No "interior design / architecture render" ControlNet endpoint found. Staging LoRAs exist (`fal-ai/flux-2-lora-gallery/apartment-staging`) but add furniture; unwanted here.

## 3. C. Realism upscalers (for the final stills / 8192x4096 panorama)
| endpoint | price | max out / factor | creativity knob | verdict |
|---|---|---|---|---|
| `fal-ai/seedvr/upscale/image` | $0.001/MP | factor 1-10 or target 720p-2160p; page states no cap | `noise_scale` 0-1 (default 0.1), seed | WORKS-WITH-KEY; faithful, almost free; 33.5 MP pano = ~$0.03 |
| `fal-ai/seedvr/upscale/image/seamless` | $0.0025/MP (2026-11-16) | same | same | "retains seamless tiling" (claims tile, NOT equirect wrap); unverified for panos |
| `topaz/upscale/image/precision` (models Standard V2, High Fidelity V3, CGI, Low Resolution V2, Text Refine) | $0.08 per started 24 MP out (33.5 MP = $0.16) | factor <= 4 | strength/denoise/sharpen | WORKS-WITH-KEY; "CGI" model suits renders |
| `topaz/upscale/image/creative` / `generative` | unverified | | higher invention | not for us |
| `fal-ai/clarity-upscaler` | $0.03/MP | factor 1-4 | `creativity` .35, `resemblance` .6 | generative, will invent micro-detail; 33 MP = $1 |
| `clarityai/crystal-upscaler` | $0.016/MP | scale 1-200 | `creativity` 0-10 (default 0) | WORKS-WITH-KEY; 33 MP = $0.54 |
| `bria/increase-resolution` | unverified | x2 / x4 | none | unverified |
| `fal-ai/recraft/upscale/crisp` | $0.004/image (2026-11-16) | size cap unverified | none | unverified |
| `fal-ai/esrgan`, `fal-ai/aura-sr` | unverified | x4 | none | old, GAN texture |
Panorama math: 8 flat views of 100 deg at 2048 px give ~15 px/deg = ~5400 px of true equirect width. 4096x2048 is fully supported by real pixels; 8192x4096 needs ~1.5x upsampling (SeedVR2 or Topaz precision, ~$0.03-0.16). Upscale AFTER seam blending, one pass, wrap-pad the edge by 256 px both sides first (no listed upscaler mentions equirect wrap handling).

## 4. D. Genuine 360 panorama on fal
| candidate | status | verdict |
|---|---|---|
| `fal-ai/hunyuan_world`, `.../image-to-world` | search snippet said "$0.15, image-to-image panorama"; live check: pages 404, schema null, API not_found | **DEAD** (`fal-probes/schemas2/fal-ai_hunyuan_world*.json` = `null`) |
| any `pano|equirect|skybox|hdri|360` endpoint | none in text-to-image first 100, image-to-image pages 1-2 (page 3 rate-limited), or any search | **none exists** (NOT-PROBED: image-to-image page 3 and text-to-image page 2+) |
| "worlds" category (`alibaba/abot-world-0`, `robbyant/lingbot-world-2`, `minimax/h3-max/*`, vast/eden) | video/world models, 2026-10 | not panorama stills; NOT-PROBED |
| open LoRAs on LoRA-capable endpoints: `ProGamerGov/qwen-360-diffusion` (MIT, Qwen-Image, text-to-image, 2048x1024, wraps seam, poles converge) into `fal-ai/qwen-image-edit-2511/lora` ($0.035/MP, `loras[{path,scale}]`) or `fal-ai/flux-lora`; `Akbartus/Flux360-LORA` (**FLUX.1-dev non-commercial licence = amber/red for a product**) | the LoRA card documents text-to-image only; applying it to an *edit* model is untested and nothing guarantees geometry | unverified; research-only, never the main path |
| Gemini-family edit of a whole pano (2:1) | nb2/nb2.1/pro enums lack 2:1; passing the 2:1 image with `auto` risks re-framing; gpt-image-2.6 and flux-3 do accept 2:1 but our gpt result was not geometry-true | not recommended (own evidence) |
**Conclusion:** if the goal is geometry-true, no panorama-native fal model exists; flat-view repaint + projection back is the only validated route. Controlled whole-pano edit would need a self-hosted pano ControlNet (out of lane).

## 5. E. Depth / QA tools
| endpoint | price | notes | verdict |
|---|---|---|---|
| `fal-ai/marigold-v2` | $0.03 per image regardless of size | `prediction_type`: depth, see-through-depth, normals, albedo; colorized output on the page | WORKS-WITH-KEY |
| `fal-ai/image-preprocessors/depth-anything/v2` | page: "$0 per compute second", real price unverified | PNG out; bit depth unverified | unverified |
| `fal-ai/imageutils/depth`, `.../marigold-depth` (2023-24), `fal-ai/image-preprocessors/zoe|midas` | unverified | old | not needed |
| `microsoft/moge-2/-3`, `fal-ai/vggt-1b` | unverified | monocular geometry; overkill | NOT-PROBED |
Cheapest QA is $0: Blender gives the true depth/normal/object-index passes; compare against a **locally run** Depth Anything v2 (open weights) on the AI view. Use Marigold on fal only if no local GPU.

## 6. Evaluation matrix (1 = poor, 5 = best; geometry and quality columns for the flat-view use)
| model | visual quality | geometry fidelity | resolution | pano compat. (as flat-view repainter) | API | cost | speed |
|---|---|---|---|---|---|---|---|
| nano-banana-2 | 4 | 4 (Kedma-proven) | 4 (4 MP at 2K, 16 MP at 4K) | 4 | 5 | 4 | 5 (seconds) |
| nano-banana-2.1 | 4? | ? | 4 | 4 | 5 | 5 | 5 |
| nano-banana-pro | 5? | ? | 4 | 4 | 5 | 3 | 3 |
| gpt-image-2.6 high | 5 | 3 (whole pano failed; flat view OK in 2.5) | 4 (3840 edge) | 3 | 5 | 3 (page) / 1 (booked) | 2 |
| flux-pro/kontext (max) | 3 | 4 | 2-3 | 3 | 5 | 5 | 4 |
| flux-2-pro / flex edit | 4 | 3 (copied bends) | 4 | 3 | 5 | 4 | 4 |
| flux-3 edit-image | 4? | 4? | 5 (4k) | 4 (2:1 native) | 5 | 3 | 2 |
| seedream v5.5 edit | 4 | 3 | 4 | 3 | 5 | 5 | 4 |
| flux-general + depth/canny ControlNet | 3 | 5 (hard control) | 3 | 4 | 5 | 3 | 3 (~15 s) |
| z-image turbo ControlNet | 2-3 | 5 | 3 | 4 | 5 | 5 | 5 |
`?` = no evidence either way; to be settled by section 8 test.

## 7. Recommendation
### 7.1 Primary pipeline (confirmed, with refinements)
1. Cycles at 2:1 (denoise with OIDN; noise is fine for the model, but remove fireflies). This is the only geometry authority.
2. Cut **8 level views (pitch 0), yaw 0..315 step 45, ~100 deg HFOV (overlap 55 deg), square 2048x2048** (matches nb2 2K; 1:1 is in the enum). Pitched views make the model "correct" verticals that then lean (Kedma). Ceiling and floor: do not repaint with the model first; try 2 extra views (pitch +/-90) only if the zenith/nadir matter; else blend a light CG-to-model colour match. (untested, ~$0.24 more)
3. Each view goes to the edit model **alone** (CG view as the only image; a second image makes it copy it where the CG is pale). Prompt: describe what the view contains and what it does NOT; "same camera, same framing, same walls/doors/windows/furniture positions; only improve materials, light, fabric, micro-detail; no new objects; no skirting boards" (house rule). Fixed seed where the endpoint allows.
4. Register each answer to the CG view (scale+shift, as `flatreg.py` did), reject if over thresholds (section 8), project back with 10-15 deg feather on the overlaps, colour-match overlaps in Lab before blending.
5. Optional: seedvr / Topaz CGI-model upscale of the finished equirect to 8192x4096 ($0.03-0.16), with 256 px wrap-padding.
6. Stills: same repaint on the full Cycles still (1 pass, 4K), then optional 2x upscale.

### 7.2 Fallback
- F1 (geometry cannot be trusted from instruction models): `fal-ai/flux-general/image-to-image` with `controlnet_unions` depth (from Blender Z pass, normalised) + canny, `strength` 0.45-0.6, ~$0.15 per 2 MP view; or `z-image/turbo/controlnet` at ~$0.01 per view for a draft. Lower realism, but the geometry is enforced by construction. Needs an A/B before relying on it.
- F2 (realism): gpt-image-2.6 high on flat views; our Kedma flat-view recipe already worked with 2.5.

### 7.3 Hero still
Best: **Nano Banana 2 at 4K ($0.16)**, with Nano Banana Pro 4K ($0.30) and gpt-image-2.6 high 3840x2160 (~$0.11) as same-input comparison, then choose by eye + section 8 metrics; total A/B < $0.60. Cheapest acceptable: `google/nano-banana-2.1/edit` ($0.063 at 2K, $0.138 4K) or `fal-ai/nano-banana/edit` ($0.0398); budget geometry-locked: z-image turbo ControlNet.

### 7.4 Cost table (USD; page prices; refs ~ +$0.002-0.008 included where token-billed)
Assumptions: hero at 4K; stills at 2K; per view 2K; counts low/expected/high: hero 1/2/4 calls; stills 6/9/18; living pano 8/10/12 views; 4 extra panos 32/40/48 views. No upscale/QA (add ~$0.2-0.5).
| scenario | low | expected | high |
|---|---|---|---|
| **nano-banana-2** core (hero + 6 stills + living pano) | 1.84 | 2.60 | 4.24 |
| nano-banana-2 + 4 more panoramas | 5.68 | 7.40 | 10.00 |
| nano-banana-2.1 core | 1.05 | 1.52 | 2.51 |
| nano-banana-2.1 + 4 panoramas | 3.13 | 4.12 | 5.63 |
| gpt-image-2.6 high core (page price) | 1.72 | 2.40 | 3.88 |
| gpt-image-2.6 high + 4 panoramas | 5.40 | 7.00 | 9.40 |
| nano-banana-pro everywhere (not advised) core / +4 panos | 2.40 / 7.20 | 3.45 / 9.45 | 5.70 / 12.90 |
Optional add-ons: seedvr 8192x4096 upscale ~$0.03 per pano; Topaz precision $0.16 per pano; Marigold QA $0.03 per view (living pano + 6 stills = $0.45). If real gpt-image billing is the Kedma-booked ~$0.60, the gpt rows are 4-5x higher: the booking is conservative, verify once from the fal usage page.

## 8. Risks and the measurable acceptance check (run on every answer, automatically)
| risk | affects | check (threshold = starting value, calibrate on the first pano) |
|---|---|---|
| re-framing / scale shift (window 36 % taller, wall 24 % nearer in Kedma) | all | register answer to CG (ECC or phase correlation); reject if scale outside 0.97-1.03 or shift > 1.5 % of width |
| moved or bent edges | all | Canny of CG vs Canny of answer after registration: recall of CG edges within 3 px >= 0.90 on structural edges (window/door frames, wall-floor lines, cabinet runs); keep a mask of structural edges from the object-index pass |
| invented objects/walls/doors | pale CG areas | edge **precision**: long (> 80 px) answer edges with no CG edge within 6 px must be < 3 % of edge length; also compare Cryptomatte object bounding boxes (window, door) within 1 % of image width |
| depth drift | all | Depth Anything v2 (local) or Marigold on answer vs Cycles Z pass: scale-shift-aligned AbsRel < 0.05 plus normal-map angle < 10 deg median |
| door/window size or sill change | Gemini and GPT both | per-opening rectangle IoU against the CG opening mask >= 0.95 |
| colour/material drift between views (seams) | panos | mean CIELAB difference in each overlap strip < 6 dE before blending; reject the view that deviates most |
| seam break at the wrap edge | panos | compare column 0 vs column W-1 after build (mean abs diff + gradient continuity); poles: variance of the top/bottom 5 % rows |
| text/logo/artefact hallucination | stills (books, labels, TV) | OCR any text on the answer; prompt "no text, no logos, no people" |
| content policy / safety refusal | rare for empty interiors | `safety_tolerance` (nano-banana 1-6 default 4; flux-2 default 2); log refusals; Gemini family also adds invisible provenance watermark (unverified) |
| non-determinism | all | store seed + prompt + model version per view in the manifest; flux-3 and seedream and gpt-image expose no seed |
| licence | Flux360 LoRA | FLUX.1-dev non-commercial: not for a product (red) |
Legal posture of the candidates: all fal endpoints listed green/amber (commercial-use tag on pages; terms unverified). The sales-plan fidelity rule (root memory: 1 % bar, 2 % hard cap) is a gate on top of the above, and the model must not add objects beyond the plan.

## 9. Next steps (need Eliran's spend word; ~$1-2 total)
1. One room still, same CG input: nb2 4K vs nb2.1 4K vs Nano Banana Pro 4K vs gpt-image-2.6 high; measure with section 8; pick the hero model and whether 2.1 can replace 2 for views.
2. One living-room panorama through 8 views with the winner; check seams and the wrap edge; one flux-general depth+canny view for the fallback lane.
3. Read the real per-call price from fal usage after the first calls (page vs booked).

NOT-PROBED: image-to-image catalogue page 3 and text-to-image page 2+ (rate limit), `bria/increase-resolution` price, `recraft/upscale/crisp` size cap, `hunyuan-image/v3/instruct/edit` limits, depth-anything v2 price, minimax/krea/qwen-image-3/mai/grok/ideogram/fibo edit models, "worlds" category, any live generation.
