# RAW REPORT 4 — AI video / AI 3D for architecture + "AI for real-estate marketing" landscape + business snapshot (2 Nov 2026)

Research subagent output (session habait-ab). English, sources inline. Not edited; see ../SUMMARY-he.md for the Hebrew synthesis.

Scope note: ~45 searches + ~35 page fetches. The per-turn web-search budget ran out before verifying Archi.ai, Renderlab, Spotlight Realty AI, Styldod, Restb.ai, Compass AI, Smplrspace, Immoviewer, and funding for Maket / LookX / Spacely / Archsynth — flagged as gaps at the end.

## 0. Headline findings (what matters for the stable-flyover problem)

1. **The API landscape shifted in the last 60 days.** Google shut the Veo 3.1 Preview endpoints on 22 Oct 2026 and points developers to **Gemini Omni 1.1 Flash**, a generate+edit video model with video-to-video (input ≤10 s, output 3–10 s, 360p–4K @24 fps) (https://ai.google.dev/gemini-api/docs/video, https://ai.google.dev/gemini-api/docs/models/gemini-omni-flash). OpenAI removed `sora-2`/`sora-2-pro` and the whole Videos API on 24 Sep 2026 with no replacement (https://developers.openai.com/api/docs/deprecations). **Kling 4.0** went GA 15 Oct 2026: 3–30 s single pass, 720p/1080p now (4K/HDR "coming soon"), up to 10 keyframes, Omni Reference of 10 images + 5 videos, and a video-edit mode that can "alter camera position and movement" (https://runware.ai/kling-4).
2. **No commercial API today gives true depth/structure-locked video-to-video at 1080p.** The one depth-conditioned hosted endpoint (fal `wan-vace`, depth mode, 720p, ≤240 frames, $0.20/video) is now **deprecated** (https://fal.ai/models/fal-ai/wan-vace). Depth control survives only in open weights: **LTX-2.3** (Apache-2.0/LTX community license, up to 4K, depth-to-video & canny-to-video ComfyUI workflows) (https://comfy.org/workflows/model/ltx-2-3/, https://www.mindstudio.ai/blog/ltx-2-3-video-to-video-modes-results) and **Wan 2.1/2.2 VACE** (depth/flow/layout control; 81-frame base limit) (https://github.com/ali-vilab/VACE). **fal's official Blender extension already does "export depth animation from the scene → depth-guided LTX video, optional first-frame reference"** — the closest off-the-shelf match to the Blender clay pipeline (https://github.com/fal-ai/fal-blender-extension).
3. **The scene-level 3D route matured a lot**: World Labs **Marble** now exports Gaussian splats (SPZ/PLY), collider meshes and GLB textured meshes, accepts multi-image prompts with directional layout and a **Chisel** 3D blocking tool, and (Oct 30 2026) a beta `posedImages2Splats` API that takes **≥2 posed RGB-D frames (8–16 views per room recommended) and returns a refined splat for $5/run ($0.50 draft)** (https://docs.worldlabs.ai/marble/export/gaussian-splat/index.md, https://radiancefields.com/world-labs-opens-gaussian-splat-creation-in-marble). Tencent **HY-World 2.0** (Apr–May 2026) is the open-weight equivalent: text/single/multi-view image/video in → mesh + 3DGS + point cloud out, full pipeline ~10 min on an H20 (https://github.com/Tencent-Hunyuan/HY-World-2.0).
4. **Archviz practitioners converge on the same hybrid**: the 3D model stays the source of truth for geometry; AI is a finishing/motion layer; small text and mullions drift; check roof silhouette and window divisions against the source after every pass (https://visiomake.com/en/blog/best-ai-tools-for-architectural-animation-2026, https://rendervi.com/blog/ai-rendering-in-architecture-research-2026, https://www.krea.ai/blog/best-ai-tools-for-architectural-rendering-in-2026). The one archviz-specific trick with evidence: Kling **first+last frame** between two real renders to interpolate a camera move without warping (https://www.aifire.co/p/ai-vs-render-farm-professional-archviz-workflow-2026).

## 1. Video models — comparison table (Nov 2026)

Prices are API list prices; Runway's dev API resells most third-party models at 1 credit = $0.01 (https://docs.dev.runwayml.com/guides/pricing/).

| Model | Geometry / structure control (v2v) | Camera-path control | Keyframes / multi-shot | Max len / res | API $/s (output) |
|---|---|---|---|---|---|
| **Gemini Omni 1.1 Flash** (replaces Veo 3.1) | v2v edit/extend, input ≤10 s; "relight/restyle preserving composition and motion" (vendor claim) | prompt only | up to 5 ref images | 3–10 s; 360p–4K | 0.034/0.10/0.15/0.30 (360p/720p/1080p/4K) +0.01 per input sec |
| **Veo 3.1** (via Runway/fal; Google preview shut 22 Oct) | extend-video only (30 s total) | prompt | first+last frame, ≤3 ref images, 8 s cap | 8 s; 720p–4K | 0.40 w/ audio, 0.20 silent |
| **Sora 2 / 2 Pro** | — | — | storyboard | 20–25 s; 1080p | **API shut down 24 Sep 2026** |
| **Kling 4.0** (Oct 15 2026) | video edit: ≤5 clips / 30 s; change camera, style, background | keyframe-directed camera moves | 10 keyframes; Omni Ref 10 img + 5 vid | 30 s; 720p/1080p | 0.157 (720p) / 0.235 (1080p); +20% with input video |
| **Kling O3 Pro** (benchmarked, drifted) | v2v edit endpoint, preserves "original motion" only | prompt per shot | storyboard multi-shot, elements | 15 s; 1080p | 0.168 (fal) |
| **Runway Aleph 2** | in-context v2v: relight, restyle, new camera angles (~5 s input) | "generate new camera angles" | ref image for style | 5 s; 1080p | 0.28 |
| **Runway Gen-4.5** | no | prompt | — | 1080p | 0.12 |
| **Luma Ray 3.2** | `video_edit` (modify) | 16-keyframe camera/timing control (review claim) | keyframe extend | 10 s; 1080p; HDR/EXR | gen 0.20–0.80; edit 0.72/1.44 per 5 s |
| **Wan 2.7 / Wan 3** | Wan 2.7 video-edit endpoint; VACE depth/flow in open 2.1/2.2 | — | ref-to-video | 15 s / 30 s; 1080p | wan3 0.05/0.10/0.20 |
| **Seedance 2.0 / 2.5** | reference video input (30 s cap) "adapts pacing/composition" | prompt | multi-shot; 30 s single pass | 30 s; 1080p (4K on 2.0) | 2.0: 0.14–0.40; 2.5: 0.20–0.68 + ref sec |
| **Hailuo 3 / MiniMax H3** | reference video (≤15 s) | prompt | keyframes | 2K | 0.10 / 0.15 |
| **Happy Horse 1.0** (Alibaba) | `video-edit`: "keeps source structure, motion and composition" (vendor) | — | — | input 3–60 s; 1080p | 0.14 / 0.28 |
| **LTX-2.3** (open weights) | **depth-to-video, canny-to-video, ref-image v2v** (ComfyUI, fal Blender add-on) | via control video | first frame ref | up to 20 s; up to 4K @50 fps | hosted 0.06–0.32; self-host = GPU time |
| **HunyuanVideo 1.5** (open) | no official depth/v2v | — | — | 720p (+SR) | self-host |
| **Marey (Moonvalley)** | "camera motion from video": clip/image → 3D scene → keyframe a virtual camera | yes (3D camera) | — | n/a | $14.99/100 cr |
| Pika 2.5 / Vidu Q3 / Higgsfield | consumer-tier; no structure control | presets | — | 1080p | subscriptions |

Helper endpoints: `fal-ai/depth-anything-video` (temporally consistent depth, $0.04/s); SeedVR2 / ByteDance video upscalers to 4K at $0.007–0.03/s (https://fal.ai/learn/tools/best-video-to-video-apis-2026).

## 2. Image/video-to-3D and scene generation

**Object-level (no tool generates a whole building at correct scale from a plan):**

| Tool | Latest | Inputs | Export | Price |
|---|---|---|---|---|
| Tripo | H3.1, P2.0 quad topology | single, **multi-view to 3D** | GLB/FBX/OBJ/USDZ | $0.10–0.30 per model (https://developers.tripo3d.ai/) |
| Meshy | Meshy 6 | image/text | fbx/obj/usdz/glb/stl/blend | Pro ₪60/mo 1,000 cr; API from Pro |
| Rodin (Hyper3D) | Gen-2 | image | Blender plug-in, 4K PBR | Business $120/mo for API; $1.50/credit |
| TRELLIS.2 (Microsoft) | 4B, MIT | single image | GLB + PBR | self-host (https://github.com/microsoft/TRELLIS.2) |
| Hunyuan3D 2.x/3 | open | image | mesh/PBR | self-host; hosted ≈$0.34–0.38 |
| Hitem3D (Sparc3D) | 2.0 | image | USDZ etc. | from $19/mo |
| SPAR3D (Stability) | Jan 2025 | image | mesh, <1 s | free <$1M revenue |
| Luma Genie | community only | — | — | — |
| CSM | site unreachable | — | — | — |

**Scene-level / world models:**

| Tool | What it builds | Scale from plan? | Export | Price / access |
|---|---|---|---|---|
| **World Labs Marble 1.1 / 2** | explorable 3DGS world from text, image, multi-image, video, or **Chisel** block-out | Chisel = coarse 3D layout + style; no documented metric units | SPZ/PLY splat, collider mesh, GLB textured (Pro) | $20/$35/$95 mo; API $1 = 1,250 cr; posedImages2Splats $5/run |
| **Tencent HY-World 2.0/2.1** (open) | text / single / **multi-view images / video** → mesh + 3DGS; WorldMirror 2.0 = feed-forward multi-view recon | no plan input; multi-view recon of own renders is the path | mesh, 3DGS, Unreal/Unity/Blender | open weights (check License; 1.5 was non-commercial) |
| Google Genie 3 / 4 | interactive 720p worlds, 60 s sessions; Genie 4 announced 27 Oct 2026 | no | **no export, no API** | $250/mo Ultra |
| Odyssey-3 | interactive world model, API by request | no | none | n/a |
| Runway GWM-1 / Worlds 2 | research preview | no | no | n/a |
| MVSplat / AnySplat | posed or unposed sparse views → 3DGS in one pass | n/a | PLY | open (https://city-super.github.io/anysplat/) |

## 3. "AI for real-estate marketing" vendors (2026)

- **Floor-plan → 3D/tour:** Getfloorplan $20 (2D+3D) / $35 (+virtual tour) / $60 (+renders+branding) per set, 24 h (https://getfloorplan.com/); Roomagen plan→dollhouse in <90 s (https://roomagen.com/tools/floor-plan-to-3d); Archilogic $24.90–$59 per floor plan/month, API from Professional; Floorplanner $5–29/mo + credits; Ogulo (DE) €69–189/mo (https://www.ogulo.com/preise); Smplrspace metered per active floor plan, SDK/API. Manual 3D floor-plan services: $200–800 per floor, 3–7 days. None produce an exterior flyover or a photoreal unit-level tour from a sales plan — they stop at dollhouse/3D plan quality.
- **AI rendering for architects (stills):** Rendair $19/$49/$190; Veras now Chaos-owned; Visoid, LookX, mnml, Gendo. Rendair states its tool "cannot fly through the model in real time; it generates static views or clips based on views" (https://rendair.ai/blog/tools-top-6-unreal-engine-alternatives-for-architects-in-2026) — nobody in this class solves the stable flyover.
- **Agent-side marketing stacks:** Luxury Presence ($22M Series C); Zillow Showcase = AI interactive floor plan + walkthrough from 360 panos, AI virtual staging, "instant floor plans from smartphone" promised for late 2026 (Zillow 2Q26 letter). Virtual staging: AI $1–15/image; human-edited (BoxBrownie) $15–75/image. Resale-listing tools, not new-build tools.
- **Unit selector / developer sites:** Miami cost guide (Oct 2026): unit grid $2.7k → $6.5k (real-time API) → $9.2k (+site map); interactive 3D model $6.5k; typical developer site total $22–41k (https://kolonell.com/en/blog/property-developer-new-homes-website-cost-miami-2026). $8–20k for a 50–200-unit selector platform (Maverick Frame).

## 4. Business snapshot — Israel

**Market size (CBS via Nadlan Center, Mar/May 2026):** 2025 housing starts ≈80,000 units (+14.6%, record since 1991), permits ≈81,200, completions ≈59,700, **≈207,000 units under active construction** (+11%), 28% of starts in urban renewal, average build time 32–38 months. Starts by district: Center 26%, Tel Aviv 22%, South 16%; top cities Tel Aviv-Yafo 7,070, Jerusalem 6,870, Lod 2,920 (https://www.nadlancenter.co.il/article/14163, https://www.boi.org.il/media/jw4nb1h0/2025-chap-8e.pdf). Bank of Israel: unsold new-dwelling inventory hit a record in 2025; developers lean on 20/80 financing and "gimmicks" to move stock (https://en.globes.co.il/en/article-1001550541). Proxy: 80k starts ÷ ~40–60 units per project ≈ **1,300–2,000 new multi-unit projects launched per year**.

**Marketing spend:** only Israeli benchmark found is old (Bizportal 2010): sales+marketing incl. advertising = **2–4% of project cost**; ad spend ₪3k–23k per apartment sold (https://www.bizportal.co.il/general/news/article/238717). TASE annual reports are the way to update it.

**What developers pay studios today (Israel, NIS incl. VAT):**
- Exterior/interior photoreal stills: ₪1,000–3,000 per image; large residential building sets ₪30k–100k (https://www.midrag.co.il/Content/Price/9879, https://waissman.co.il/, https://3dx.co.il/).
- Project animation video: ₪15k basic → ₪80k+ polished; campaign/launch film ₪30–60k (https://avastudio.co.il/kama-ole-sirton-hadmaya-laproject/); cheap walkthroughs ₪2–7k.
- VR simulation ₪15k+.
- International: 60 s flythrough avg $2,966 (range $1k–16k; EU $3,950, US $6,120); $50–200/s; cinematic launch films $300–600+/s (https://advids.co/pricing/how-much-animated-flythrough-video-creation-cost).
- Implied per-project studio bundle (10 stills + 60 s film + 360 tour + unit-selector site): roughly **₪80k–200k** in Israel; a SaaS at ₪5–15k/project undercuts it 10×; API COGS for a 60 s 1080p flyover <$20 at today's per-second rates.

**Funding / M&A signal:**
- Chaos acquired EvolveLAB/Veras, Feb 2025.
- Dream (a16z-led $17M seed, Oct 29 2026, AI building design); FORMAS.AI $3.98M pre-seed, Apr 2026; Visoid $2.5M seed, Aug 2026; Arkyv €700k pre-seed, Apr 2026.
- Model layer: World Labs +$1B (Feb 2026) and a reported $8.2B AMD all-stock acquisition (Sep 2026, aggregator-only, verify); Luma $900M Series C at ~$4B (Nov 2025); Higgsfield $400M at $5.4B (Aug 2026); Moonvalley $84M (Jul 2025); Runway $315M (Feb 2026); Luxury Presence $22M C.

## 5. Shortlist — four approaches to a geometrically stable flyover

1. **Pure 3D photoreal render + light AI finish (lowest risk, recommended baseline).** Blender/D5/Twinmotion renders the camera path. Then only per-frame-consistent AI: SeedVR2/ByteDance upscalers ($0.007–0.03/s) and a weak Omni Flash / Happy Horse / Aleph-2 relight pass on ≤10 s shots with strength kept low. Geometry guaranteed; AI adds vegetation/people/sky.
2. **Depth-locked v2v with open weights (what fixes the drift).** Export depth + canny from the Blender clay flythrough (the fal Blender extension does this for LTX) and run LTX-2.3 depth-to-video / Wan 2.2 VACE depth mode with the developer's render as first-frame/reference; stitch 10 s chunks last-frame→first-frame. Needs own GPU/ComfyUI serving (no hosted depth endpoint survives); expect 20–30% latency overhead.
3. **Gaussian splat from AI-upgraded views (true free camera, photoreal).** Render 8–16 posed clay views per facade, upgrade each with GPT Image 2.5 (layout-preserving, validated), reproject depth from Blender, feed Marble `posedImages2Splats` ($5/run) or HY-World 2.0 WorldMirror / AnySplat, then fly any camera in the splat in Spark/three.js — also gives the clickable-building 3D viewer. Risk: multi-view inconsistency between AI-upgraded views; keep upgrade strength low.
4. **Unreal/Twinmotion real-time pipeline (studio-grade, highest CAPEX).** Best realism and interactivity, steepest learning curve. Do not use closed i2v/v2v (Kling 4, Omni Flash, Seedance 2.5) as the primary generator for the building shot: none exposes depth control, reviewers still report mullion/facade drift. They remain good for ≤10 s "life" inserts and the first+last-frame trick between two true renders.

## 6. 3D-gen tools worth testing (in order)

1. **Marble (Chisel + multi-image + posedImages2Splats)** — only commercial API that takes a block-out plus posed rendered views and returns splat + collider + GLB.
2. **HY-World 2.0 (WorldMirror 2.0 / full pipeline)** — open equivalent; check License for commercial/geo terms.
3. **Tripo H3.1 Multi-view→3D** ($0.20–0.30) and **TRELLIS.2** (MIT, PBR GLB) — for furniture/entourage and single-building massing from the hero render.
4. **AnySplat / MVSplat** — fast feed-forward splat from own unposed renders if Marble's $5/run or latency is a problem.
Skip for now: Genie 3/4, Odyssey-3, Runway GWM (no export/API), Luma Genie, CSM.

## 7. Gaps not verified (search budget exhausted)
Archi.ai, Renderlab, Spotlight Realty AI, Styldod per-image price, Restb.ai pricing, Compass AI, Immoviewer current pricing, Hunyuan3D 3.1 / Rodin Gen-2.5 status, Maket/LookX/Spacely/Archsynth funding, Kling O3 video-to-video schema details, Israeli 2024/25 marketing-spend ratio (needs TASE filings), and the AMD–World Labs deal (aggregator sources only).
