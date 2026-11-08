# RAW REPORT 3 — Interactive delivery layer: web 3D, 360 tours, clickable buildings (2 Nov 2026)

Research subagent output (session habait-ab). English, sources inline. Not edited; see ../SUMMARY-he.md for the Hebrew synthesis.

Note: the shared web-search budget ran out near the end; a few Israel-specific checks (Israel Canada project pages, "Fold", "Studio Aviv", "3DVision", Madlan tours) could not be completed and are flagged as "not found" rather than guessed.

## 0. Headline findings

- The commercial "apartment finder" category is mature and cheap at the low end: Flatter (Hungary) charges **€50–100 per unit in year 1, €1,000 minimum, live in 3–10 business days** (https://www.flatter.hu/en); R2U's 3D sales platform **starts at ~$2,700** (https://r2u.io/en/blog/interactive-floor-plan-real-estate/); bespoke 3D sales apps run **$8k–15k (simple unit selector) to $15k–35k (full walkthrough) to $35k–80k+** (https://intwopixel.com/blog/what-is-a-3d-sales-app). None of the mass-market tools does a true "fly into the apartment"; they do click → card → separate tour.
- Nearly every vendor that discloses its mechanism uses **pre-rendered content with hotspots**, not real-time 3D: Render Vision's exterior is "a 360° spinner made from 140 high-resolution renders" with a clickable facade (https://render-vision.com/services/3d-apartment-viewer-services/); R2U's unit sightlines and renders are "photo-real pre-rendered outputs" on a WebGL shell. Real-time Unreal via pixel streaming is reserved for Gulf mega-projects (DAMAC/PropVR) (https://www.unrealengine.com/spotlights/propvrs-digital-twins-help-real-estate-developer-boost-revenue-by-10x).
- Browser tech moved a lot in 2026: **three.js r186 ships a native Gaussian-splat renderer (WebGPU/TSL, PLY+SPZ, raycasting)** (https://radiancefields.com/three.js-ships-its-native-gaussian-splat-renderer-and-splat-raycasting-in-r186); World Labs' **Spark** (MIT, targets 98%+ WebGL2 devices, reads PLY/SPZ/SPLAT/KSPLAT/SOG) (https://github.com/sparkjsdev/spark) and Spark 2.0 adds LoD/paging capped at 0.5–2.5M active splats per device; **WebGPU is on by default in Safari 26 (iOS/macOS, Sept 2025)**, Chrome Android 121+, Firefox 141/145 desktop, Firefox Android still pre-release (https://web.dev/blog/webgpu-supported-major-browsers).
- Israeli developers' public sites show **static renders only** on the pages checked (Azorim; Tidhar). The 360 tours that exist are mostly of **built model apartments**, shot by Panovision-type studios for Africa Israel, Ashdar, Dimri, Boney HaTichon etc. (https://www.panovision.co.il/dom/realestate_companies).

## 1. Platforms used by developers

### Unit finder / apartment selector products

| Product | Mechanism (as disclosed) | Flow | Pricing | Embed / white-label / API |
|---|---|---|---|---|
| **3D Flat Finder** (HU, Cordia etc.) | "interactive 3D" in browser; inputs are renders, plans, panoramas, tours | masterplan → building → home → view; filter/compare | per-project, not published | one-line embed, white-label, CRM data layer, no public API (https://www.3dflatfinder.com/) |
| **Flatter** (HU) | 3D model built by their team + "panoramic viewer" | click building → card (plan, price, status) → gallery | €100/unit (≤20) down to €50/unit (≤300) yr-1; €12–25/unit/yr after; €1,000 min | embed or subdomain; branding; no API (https://www.flatter.hu/en) |
| **Render Vision** (DE) | 140-render 360° spinner + clickable facade; tours optional add-on | facade click → unit card → PDF exposé | quote after scoping; ~4 weeks delivery | "fully white-labelled" embed, mobile (https://render-vision.com/services/3d-apartment-viewer-services/) |
| **3D Estate "3D Twin"** (PL/UK; Robyg, YIT, Greystar) | rotating photoreal model; 2D floor search synced with 3D; balcony panoramas | building → floor → unit → balcony 360 | packages CORE/COMFORT/ELITE, no prices | two-way CRM, analytics (https://3destate.pl/en/3d-real-estate/) |
| **R2U** (BR; Tegra/Brookfield) | WebGL shell + pre-rendered floor/unit renders | tower render → floor plate colour-coded → unit panel + view | from ~$2,700; 3–10 weeks | (https://r2u.io/en/blog/interactive-floor-plan-real-estate/) |
| **Seenic 3D Explorer** (US multifamily) | aerial community model + Engrain sitemaps + Matterport 360 | community → sitemap → unit → Matterport tour | demo only | "on your brand" (https://seenic.io/product-3d-explorer) |
| **Hauzd / CuEngine / UnitAtlas / Maverick Frame** | sales-centre apps; CuEngine "cuts the building to the selected floor" on touch | — | not public | (https://maverickframe.com/services/interactive-apartment-selector/) |
| **GenPlan.ONE** | "drone-like" fly-over of masterplan, unit status on building, CRM-synced prices | — | — | (https://genplan.one/en/) |

Not found / not verifiable: Archilogic "Spotlight" unit finder (Archilogic sells a quote-based 3D Embed API, https://archilogic.com/pricing), Smplrspace pricing, Hutsy, Metareal, Zuzor, Vizion, Momentum 3D, 3D Inspire, Ogulo, Treedis.

### 360-tour engines

- **krpano**: €179 license + €299 branding-free add-on, perpetual (https://krpano.com/buy/).
- **3DVista VT Pro**: $499 one-time, unlimited tours; hosting from €99/yr; "3D transition effect" between panos and 3D-model import (https://www.3dvista.com/en/products/virtualtour).
- **Pano2VR**: €499 perpetual or €360/yr.
- **Kuula**: Pro ~$20/mo, Business ~$36/mo; **CloudPano** Pro Plus $33/mo; **Panoee** free tier; **Floorfy** from $25/user/mo; **EyeSpy360** has an API; **Giraffe360** ~£399/mo incl. camera.
- **Marzipano / Pannellum**: free OSS; the paid tools' differentiators are the editor, hosting, hotspot UI and transitions, not rendering.

### Matterport

- Matterport's own new-homes marketing is about off-plan and pre-launch phases (https://matterport.com/blog/new-marketing-approach-new-homes); CGI-to-Matterport is done by third parties who build a tour from renders (https://liquidambient.com/en/cgi-to-matterport/); Sansiri (TH) case study claims higher web-visit → sales-visit conversion. No "digital twin from plans" product was found.
- Pricing in flux: Oct-2026 diff reports Professional ≈ $69/mo; SDK/API sold separately as "Developer Tools" (https://pricingsaas.com/companies/matterport/diffs/2026W42).
- Transition mechanism: the walk between panos is the current pano projected onto a low-res mesh while the camera moves, then cross-fade (https://www.wegetaroundnetwork.com/topic/7605/how-matterport-tour-transitions-work/).

### Real-time web exporters and pixel streaming

- **Shapespark**: $19/mo Starter / $49/mo Standard; perpetual option. Baked-lighting WebGL.
- **Enscape Web Standalone**: WebGL2 export, "Draft" quality (https://learn.enscape3d.com/?p=64153).
- **Twinmotion Cloud**: presentations up to 4 GB, streamed from a cloud GPU, 30-min idle disconnect.
- **Pixel streaming hosting**: Vagon Streams $0.025–0.047/min per GPU session ≈ $1.50–2.80/hour (https://vagon.io/streams/pricing); Arcware Lite €10/mo + €0.15/min, Core €89/mo + ≤€0.10/min (https://arcware.com/pricing); Eagle 3D ~$100/CCU/month; PureWeb enterprise. Rule of thumb: ~€5–10 per buyer-hour; a 2,000-visit/month site at 5 min each ≈ €1,000–1,500/month.

## 2. Israeli market

- **What the big developers show**: Azorim home page: "הדמיית חוץ" stills only, no tours, selectors or video (https://www.azorim.co.il/). Tidhar's Raoul Wallenberg 16 page: render gallery, no 360/selector/floor plans (https://tidhar.co.il/project/raoul-wallenberg-tel-aviv/). Israel Canada's home page lists People, Dubnov Tower, Vertical City, She, Rainbow, Lev Bavli, Midtown Jerusalem.
- **360 of built model apartments** is the established format: Panovision's gallery lists Africa Israel, Ashdar, Dimri (render-based tour), Boney HaTichon, Danto, Hanan Mor, Neve Gad, Peretz Bonei HaNegev (https://www.panovision.co.il/dom/realestate_companies). P360 and Tourwise sell the same service.
- **Virtual fair precedent**: a 2023–24 online "virtual fair" for diaspora buyers featured Aviv Group, Aura, Hagag, Tidhar and Gindi with model-apartment tours and "real view from the balcony" (https://www.ice.co.il/media/news/article/988859) — the "view from the window" feature is already expected.
- **Render studios** serving developers: Totem, Lotus 3D, Kiss Renders, Triple D, Studio Vida (VR tours), N-Trace, 3DX, Vida3D. "Fold/Fold3D", "Studio Aviv", "3DVision", VisualSpec, Reality Pro: not found under those names.
- **Israeli prices (vendor guides, VAT incl.)**: photoreal exterior render 1,500–3,000 ₪/image, interior 1,000–2,500 ₪, basic 6-image set 3,000–5,000 ₪, walkthrough animation 2,000–7,000 ₪ (https://www.midrag.co.il/Content/Price/9879); VR/AR virtual tour 8,000–50,000 ₪ (3dx.co.il); simple 360 tour 200–1,500 ₪ (virtualhome.co.il). Implication: a per-project package at 10–30k ₪ that bundles flyover + facade selector + N apartment tours undercuts a single VR tour quote.
- **Portals/proptech**: Madlan's latest launch is "Madlan AI" conversational search, not 3D. No Madlan/Yad2 3D-tour programme for new builds was found (but see report 1: Treedis × Yad2). Semerenko Group markets 3D/VR/video pre-construction packages to Israeli developers for diaspora buyers.

## 3. Browser technology options

| Option | Fidelity | Authoring cost | Hosting cost | Mobile |
|---|---|---|---|---|
| **three.js + GLB, baked lighting** | good if lightmaps baked in Blender; "draft" look if not | medium: UV2 + bake per scene | static CDN, ~free | yes, WebGL2 everywhere; keep GLB < 20–30 MB |
| **3D Gaussian Splats (Spark / three.js r186 / SuperSplat)** | photoreal for captured or rendered-then-reconstructed scenes; soft on thin geometry, plain walls, windows | render 8–16 posed views per room; Marble refined splat $5/run (beta), draft $0.50 | static; SPZ ≈ 10x smaller than PLY | phones struggle above ~1–3M splats; Spark 2.0 caps 0.5–2.5M active |
| **Generated worlds (Marble, HY-World 2.0, Genie 3, Odyssey)** | Marble: persistent splat worlds, exportable SPZ/PLY, weak on exteriors. HY-World 2.0: open weights, mesh + 3DGS, community license. Genie 3 / Odyssey: video streams, no export | Marble credits; HY-World self-hosted GPU | as splats | as splats |
| **Pre-rendered video transitions + 360 (Matterport/Zillow style)** | highest per-pixel fidelity; motion is scripted | one clip per edge, or pano-on-mesh warp | static MP4/HLS on CDN, cents | best of all; hardware decode |
| **Unreal Pixel Streaming** | best real-time fidelity | high (UE scene build) | $1.50–2.80/GPU-hour or €0.08–0.15/min | needs good network |
| **WebGPU** | enables splats/TSL post-fx; three.js WebGPURenderer falls back to WebGL2 | pin three.js version | n/a | Safari 26+, Chrome Android 121+, Firefox Android not yet |

## 4. Reference sites: how "flyover → click unit → interior" is actually built

1. **Sobha One, Dubai (VisEngine)** — https://sobhaone.sobha.cloud/3d/?&type=genplan — master plan: zone → filter → unit floor plan → 360 walks (https://visengine.com/case-study-sobha-one-interactive-3d-master-plan-as-a-sales-transformation-tool/).
2. **DAMAC digital twin (PropVR, Unreal)** — master plan → building → unit → interior in Unreal via web pixel streaming; vendor claims sales rose from $24M to $400M+.
3. **Coda, Battersea (Avanton × Como London, 2021)** — "real-time, web-based 3D apartment finder": every home, floorplans, Matterport video tours inside, favourites, QR, analytics (https://www.showhouse.co.uk/developer-and-tech-firm-launch-first-3d-apartment-finder/news/). Pattern: real-time exterior + pre-shot interior.
4. **ERA by Tekta (Vide Infra)** — three.js WebGL site map, parametric selector with animated floor selection (https://videinfra.com/blog/case-study-a-triple-site-of-the-day-winner-powered-by-webgl).
5. **Chapter London Bridge (3D Estate)** — 39-storey rotating photoreal model, 2D floor search synced to 3D, balcony panoramas per unit (https://3destate.pl/en/case-study/chapter-london-bridge-case-study-en).
6. **Terminal Tower Residences, Cleveland** — https://www.terminaltower.com/interactivepropertymap — hover highlights a building section, click → floors → units (image + SVG-hotspot).
7. **Render Vision: Quartier Thaerstraße, MAGGIE Wien** — 140-frame render spinner, clickable facade, filters, PDF exposé.
8. **Seenic: Stella at Star Metals (Atlanta)** — aerial → sitemap → unit → Matterport 360.
9. **Burj Binghatti Jacob & Co, HMR Waterfront** — real-time-engine 3D sales apps, unit selector → one-click into interior walkthrough (https://intwopixel.com/blog/what-is-a-3d-sales-app).

Takeaway: no mass-market product delivers a continuous camera flight from facade into the unit. Everyone cuts: exterior → card → interior. A seamless flight is a differentiator you can own with pre-rendered video.

## 5. Comparison table (for the flyover + facade + interior product)

| Approach | Visual fidelity | Build cost / project | Hosting | Mobile | Click-unit → fly-in | Risk |
|---|---|---|---|---|---|---|
| Pre-rendered flyover MP4 + SVG facade hotspots + per-unit "dive" clip + pannellum 360 | highest | lowest; N dive clips | CDN, cents | best | yes (scripted) | no free orbit; re-render on design change |
| three.js GLB exterior (baked) + hotspots + 360 interiors | medium exterior | medium | static | good if < 30 MB | yes (tween, then cut to 360) | look mismatch vs renders |
| Gaussian-splat exterior/interior | photoreal if reconstructed from many renders | medium-high | static, 50–200 MB per scene | fragile above ~2M splats | yes (free camera) | mobile memory, thin geometry |
| Unreal pixel streaming | highest real-time | highest | €0.08–0.15/min/user | OK on good networks | yes | per-minute burn |
| Generated worlds (Marble / HY-World) | variable; interiors OK, exteriors weak | low per room ($0.50–5) but layout drift | static splats | as splats | no | fidelity to the developer's renders |

## 6. Recommended architecture (cheap, mobile-first, fits Blender + fal.ai + pannellum)

1. **Exterior = video, not 3D.** One continuous flyover encoded as HLS/MP4 at 720p/1080p with 3–5 named **hold frames** (hero views). Each hold frame carries an **SVG overlay of facade polygons** (one per apartment, generated from the Blender camera by projecting unit bounding boxes to screen space, so no manual tracing). Zero runtime GPU.
2. **"Fly into the apartment" = per-unit dive clip.** On click: highlight polygon → play a 2–3 s clip rendered from the hold-frame camera to the apartment's first 360 node. Clip ends on a frame that is the equirect node's forward view, then **cross-dissolve into the 360 viewer** at the same yaw/FOV. Dedupe: units of the same type share clips.
3. **Interior = the 360 viewer**, with hotspot-to-hotspot **transition clips** between nodes; fall back to a fade when bandwidth is low.
4. **Data layer**: units.json (id, floor, type, status, price, polygon per hold frame, 360 node graph); developer edits status in a small admin; analytics (views per unit, favourites, enquiries), which is what sells the product to sales managers.
5. **Optional 3D later**: baked-GLB or splat exterior as a progressive enhancement on desktop only.
6. **Pricing posture**: per-unit (Flatter: €50–100/unit yr 1) or per-project (R2U from $2.7k; Israeli VR tour quotes 8–50k ₪) — room for a 10–30k ₪ package.

## 7. Risks

- Re-render churn on facade/plan change; mitigate with deterministic Blender camera rigs and batch re-render.
- Fidelity drift of fal.ai-generated dive clips vs the developer's renders; keep dive clips Blender-rendered where possible.
- Mobile autoplay/decoding: iOS requires muted inline playback; lazy-load dive clips; HLS with seek points.
- Perceived "not real 3D": counter with multiple hold frames and a sun/time toggle.
- Splat/WebGPU immaturity if added.
- Competitive: Flatter/3D Flat Finder are 3–10 days turnaround and €1k minimum; the moat must be the continuous flight + photoreal 360 at similar turnaround.
- Israel-specific unknowns: which vendor Israel Canada/Azorim/Tidhar use for tours.

## Not found / needs follow-up
Archilogic "Spotlight", Smplrspace pricing, Hutsy, Metareal, Zuzor, Vizion, VU.CITY, Ogulo, Treedis pricing; Fold3D / Studio Aviv / 3DVision / VisualSpec / Reality Pro; Madlan/Yad2 3D-tour programmes; Emaar/Berkeley/Related/Aman/One57 mechanisms; Matterport official 2026 price table.
