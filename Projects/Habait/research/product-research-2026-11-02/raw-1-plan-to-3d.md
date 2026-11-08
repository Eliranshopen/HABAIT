# RAW REPORT 1 — 2D Floor Plan → 3D Model: Market & Technology Scan (2 Nov 2026)

Research subagent output (session habait-ab). English, sources inline. Not edited; see ../SUMMARY-he.md for the Hebrew synthesis.

Scope: automatic conversion of a sales plan (PDF/DWG/raster) into parametric 3D (walls/doors/windows/rooms), plus building massing and Israeli players. Note: web-search budget ran out near the end; Coohom 3D export, Forma SDK, Hypar Elements licensing, Space Designer 3D AI import and the exact text of the Israeli sale-spec regulations were not verified and are flagged below.

---

## 1. Commercial 2D→3D tools

### Planner 5D (strongest B2B "plan image → editable 3D" API)
- Recognition pipeline exposed as REST: POST plan to `/api/floor-plan/recognize`, poll, receive `project_id`, `editable_3d_url`, `room_data`; outputs editable 3D scene, 2D/3D plan renders, interior renders, 360° walkthrough. Inputs: JPEG/PNG/PDF/DWG/DXF/BMP/TIFF. Pricing: €99 trial (10 recognitions + 10 AI images + 1 month), then custom annual usage-based. https://planner5d.com/business/api-integrations
- Consumer help: 18 input formats, recognition takes "10 minutes to 24 hours", one floor per image, plans "should include dimensions", results may need manual wall/dimension fixes, elevations skipped. https://support.planner5d.com/en/articles/14434484-how-to-upload-a-floor-plan
- Vendor page says a human designer reviews results; API "1–3 min" figure conflicts with the 10 min–24 h help-center figure. https://tool.planner5d.com/b2b-floor-plan-recognition
- Export of raw 3D (GLB/OBJ) is NOT documented; only import of OBJ/GLB/FBX is. https://intercom.help/planner-5d/en/articles/9942428-uploading-your-3d-model
- Hebrew/cm: not stated; dimensions are read from the drawing, Hebrew labels unverified.

### Floorplanner
- Developer API (Business/Enterprise only), HTTP Basic auth, sandbox/prod; create projects, import FML (JSON/XML, coordinates in metres), import Apple RoomPlan JSON; export 2D/3D images, panoramas, 3D tours (credit charge). No image-recognition endpoint, no OBJ/GLB export. https://floorplanner.readme.io/ ; https://docs.floorplanner.com
- Unofficial `fml2blender` rebuilds FML scenes in Blender by pulling GLB assets from Floorplanner's CDN. https://pypi.org/project/fml2blender/

### Homestyler (Easyhome)
- Import Floor Plan: Image (JPG/PNG ≤5 MB), DWG (≤10 MB, AutoCAD ≤2023), PDF (≤10 MB, 20 pages, one floor/page), RoomScan (LiDAR). After import: "Draw Manually" over underlay or "Auto Generate (Beta)". No scale-reading detail given. https://www.homestyler.com/forum/view/2077998093719244802?lang=en_US
- Homestyler's own help articles contradict each other on OBJ/FBX export; the more specific ones say whole-model export is not available. https://www.homestyler.com/article/how-to-export-d-models-seamlessly

### Coohom
- CAD-only recognition: DWG/DXF drawn in AutoCAD, walls as double lines 50–400 mm, doors as rect+arc, windows 3–4 lines, units mm/m/ft/in auto-detected, rooms must be closed; furniture should be removed. No image/PDF recognition. 3D export not covered on the page. https://www.coohom.com/helpcenter/3FO4K4WKMHXQ?hl=en
- Open APIs exist (design-standard page) but no public endpoint list for recognition/export found. https://www.coohom.com/helpcenter/3FO4K4WKO1G7

### RoomSketcher
- Import a 2D plan and trace (paid feature); "redraw service" returns a 3D plan next business day; export is images/PNG; no API found. https://www.roomsketcher.com/features/pro-features/draw-from-a-blueprint

### Cedreo / HomeByMe / Foyr Neo
- Cedreo: import JPG/PNG/PDF/DWG/DXF as "Trace image" and redraw walls manually; auto detection only for exterior walls (roof). https://help.cedreo.com/en/how-to-import-a-dwg-or-dxf-file ; https://cedreo.com/mac/floor-planner
- Foyr Neo: upload-and-trace, no auto detection documented. https://datadrivenaec.com/tools/foyr-neo
- HomeByMe: export only to DraftSight (.DSHBM) / screenshots. https://help.solidworks.com/2020/English/DraftSight/DraftSightSW/c_import_homebyme_plans.htm

### Rayon / Arcol
- Rayon: lossless DWG/DXF import (blocks, xrefs), PDF/JPG/PNG import, DWG export; 2D only, no IFC/GLB, no API documented. https://docs.rayon.design/documentation/import-export/dwg-dxf-import
- Arcol: DWG/DXF as underlay for floor plans; buildings give area metrics; no API. https://intercom.help/arcol/en/articles/10447921-buildings-and-floor-plans

### Space Designer 3D
- Exports GLB/glTF (default), IFC4 (walls, openings, levels), DXF; "Enterprise plans: exports automated via API". Image auto-recognition not confirmed. https://www.spacedesigner3d.com/features/multi-format-export

### Strukt AI (new, image → GLB/IFC)
- Upload PNG/JPG/WEBP (PDF/CAD must be rasterised first); auto-reconstructs walls, doors, windows, rooms; exports IFC, BLEND, GLB, DAE, OBJ, FBX, SVG; free 10 plans/month, credits ₹200/2000 (30 credits per Pro plan read); Indian OPC company; no API; "dimensions are estimates", manual correction expected. https://www.struktai.work/ ; https://www.struktai.work/blog/floor-plan-to-glb-revit-export

### Floor Plan AI (floorplanai.net)
- Text/reference image → 2D PNG + GLB; Pro $19/mo 300 credits; third-party listing says no API. https://www.capterra.com/p/10043654/FloorPlanAI/ ; https://www.saasworthy.com/product/floor-plan-ai/pricing

### Getfloorplan
- Upload JPG/PNG/PDF → 2D/3D plans + 360° tour, ~24 h delivery, bundles reported $20–$70 per plan with volume discounts; enterprise "custom quote incl. API integration"; pricing figures conflict across directories (official page returned no content). https://topai.tools/t/getfloorplan ; https://10web.io/ai-tools/getfloorplan/

### Spacely AI
- "Get 3D floor plans in a few clicks" labelled **coming soon** on official site; credit pricing since Sept 2025; $1M seed July 2025. https://www.spacely.ai ; https://www.stork.ai/en/spacely-ai

### Maket.ai
- Generates plans from constraints; DXF/DWG/PDF export on Plus ($20/mo, 300 credits); FAQ lists "Does Maket have an API?" without answer; one April-2026 review says CAD export "in development". https://www.maket.ai/faqs ; https://maket.ai/pricing

### Scan-based (not plan-based): CubiCasa, Magicplan, Matterport, Polycam
- CubiCasa: phone-scan → plan in 6–24 h; developer page `cubi.casa/developers` gated (403 on fetch); outputs include CAD files; Redfin integration 2025. https://www.redfin.com/news/redfin-cubicasa-integration-2025/ ; https://www.xpay.sh/agent-ready-index/cubicasa/
- Magicplan: official REST API (`apidocs.magicplan.app`, Report/PRO plan), exports DXF, IFC (Report/PRO), OBJ, USDZ; no PDF import. https://apidocs.magicplan.app/ ; https://help.magicplan.app/export-formats
- Matterport: floor plan + DWG LOD 200 as paid add-on from its own cameras. Polycam: DXF floor plans need LiDAR iPhone + Business plan. https://poly.cam/blog/best-floor-plan-software-compared-accuracy-speed-and-cost-for-every-budget
- Floorfy: 360° photos in, plan out, not plan-to-3D. https://blog.floorfy.com/en/2d-automatic-floor-plans

**Israeli/Hebrew handling**: none of the vendors above document Hebrew text, cm-dimension parsing, or ממ"ד detection. Coohom and Homestyler auto-detect metric units from DWG; raster recognisers rely on drawn dimension strings or manual scale.

---

## 2. Open-source / research

| Model | Year | Input | Output | License | Notes |
|---|---|---|---|---|---|
| Raster-to-Vector (Liu) | 2017 | raster | junctions→walls/openings/icons | research | Torch7; doors/windows indistinguishable. https://art-programmer.github.io/floorplan-transformation/paper.pdf |
| DeepFloorplan | 2019 | raster | wall/door-window/room-type masks | GPL-3.0 | TF 1.10, Py2.7. https://github.com/zlzeng/DeepFloorplan |
| CubiCasa5K | 2019 | raster | 80+ classes, rooms/icons | dataset CC BY-NC-SA 4.0 | 5k mostly Finnish marketing plans. https://zenodo.org/records/2613548 ; https://arxiv.org/pdf/1904.01920 |
| HEAT | 2022 | density maps / outdoor imgs | planar graph | GPL-3.0 + non-commercial | not for raster plans directly. https://github.com/woodfrog/heat |
| RoomFormer | 2023 | point-cloud density maps | room polygons (+doors/windows variant) | MIT | needs retraining for raster. https://github.com/ywyue/RoomFormer |
| FloorPlanCAD | 2021 | CAD vectors | symbol spotting | CC BY-NC 4.0 (mirror) | https://docs.voxel51.com/dataset_zoo/datasets_hf/floorplancad.html |
| **Raster2Seq** (Cornell, SIGGRAPH 2026) | Feb 2026 | raster RGB | labelled room/door/window polygons | code MIT, **weights CC BY-NC 4.0** (SaaS inference "not authorized") | CubiCasa5K Room-F1 88.7 vs RoomFormer 83.5; W&D F1 77.8; 0.52 s/img on A6000. https://github.com/Cornell-VAILab/Raster2Seq ; https://cornell-vailab.github.io/Raster2Seq/ |
| **FloorplanVLM** (Feb 2026) | 2026 | raster | JSON walls (thickness, curvature) + nested openings + rooms as wall loops | FPBench-2K to be released; no code/weights stated | Qwen2.5-VL-3B, SFT+GRPO; Ext-IoU 0.925, Room-F1 0.825, Opening-F1 0.733; ~3k tokens/plan latency. https://arxiv.org/html/2602.06507v1 |
| Community Qwen2.5-VL-3B LoRA (GRPO on CubiCasa5K) | 2026 | raster | same JSON schema | Apache-2.0 adapter but card says non-commercial (CubiCasa) | runnable recipe with HF `peft`. https://huggingface.co/mudasir13cs/qwen25-vl-3b-floorplan-grpo |
| FloorPlanNet | 2026 | raster | SVG/DXF/GeoJSON walls centrelines, rooms, door/window rects | MIT (browser model trained on synthetic plans) | DeepLabV3+ MobileNetV3, ONNX in browser <1 s; F1 door 0.985/window 0.994 on synthetic only. https://github.com/thatguywhodoestecheverysatnight/FloorPlanNet |
| RasterScan | 2024 | raster | vector JSON (R2V-based) | no license file; paid "lifetime license", Docker on-prem, RapidAPI | last update Aug 2024. https://github.com/RasterScan/Floor-Plan-Recognition |
| MitUNet | Dec 2025 | raster | wall segmentation | – | pre-trained on CubiCasa5K. https://arxiv.org/html/2512.02413v1 |
| SALI-FP evidence-gated multimodal | Sep 2026 | plans | semantic maps, vectors, relations; 11,534 plans | no code stated | https://arxiv.org/abs/2609.25615 |
| ResPlan-FP / fpvec-lab (He Zhang, 2026) | 2026 | raster | walls/openings/rooms; edit-cost metric | CC BY 4.0, code released | 16,998 plans; detection readout beats autoregressive on CubiCasa5K (+2.7/+5.1 wall F1); fusion +7. https://arxiv.org/abs/2608.25608 ; github.com/Cyprinus12138/fpvec-lab |

**General VLMs as parsers**: no published head-to-head of GPT-5/Gemini-3/Claude on wall extraction. Blueprint-Bench (photos→plan) found GPT-5, Claude 4 Opus, Gemini 2.5 Pro, Grok-4 mostly "at or below random baseline" (Gemini 2.5 Pro 0.421, GPT-4o 0.129, human 0.547). https://arxiv.org/abs/2509.25229 ; https://andonlabs.com/evals/blueprint-bench. OpenAI's GPT-5.5 cookbook on floorplan-grounded layouts reports that "semantic grounding is the hardest part" and outputs are "not self-validating" (needs deterministic repair). https://developers.openai.com/cookbook/examples/multimodal/grounded_spatial_reasoning_layouts. Agentic LLM floor-plan parsing to room graphs (CVPRW 2026) beats Claude 3.7 Sonnet direct reasoning. https://arxiv.org/html/2604.23970v1

**Extension to 3D**:
- IfcOpenShell `geometry.create_2pt_wall` builds a wall from two XY points + height/thickness, openings subtracted by default; wall direction (inside/outside) matters. https://docs.ifcopenshell.org/autoapi/ifcopenshell/api/geometry/create_2pt_wall/index.html ; https://community.osarch.org/discussion/1110/python-ifcopenshell-blenderbim-using-an-edge-mesh-to-create-ifcwalltype-instances
- Open-source editors: openPlan3D (MIT, SvelteKit+three.js, walls/doors/windows/stairs, exports SVG/DXF/PDF/JSON, no GLB) https://github.com/laanlabs/openPlan3D; Planova (Apache-2.0, Tauri+R3F, JPG/PNG/PDF → HomeSceneJSON rooms/walls/openings → GLB, uses an "AI vision model", 8 stars) https://github.com/XUranus/planova; yakden/ai-media-stack v2.0.0 (`GET /api/jobs/{id}/scene.glb`, walls with cut openings, VLM room labels + "cubicasa-service" wall partitioning) https://github.com/yakden/ai-media-stack/releases.

---

## 3. Building massing / stacking floors

- **Snaptrude**: PDF underlay one page per storey, DWG with exact units; "Create Building" turns massing into BIM walls/slabs/doors; plugin API exports GLB/OBJ in-browser (base64); IFC 2x3/4 export; Pro $50–60/mo, Enterprise "Open API access". https://docs.snaptrude.com/plugin-api/core/io/import.html ; https://docs.snaptrude.com/plugin-api/core/io/export.html ; https://www.snaptrude.com/pricing
- **Autodesk Forma**: Site Design massing; Forma Building Design launched 7 Apr 2026 generating massing/unit-mix and reportedly facades; ACC renamed to Forma Mar 2026; API status conflicting (one directory: REST+GraphQL beta). https://resources.rework.com/tools/ai-tools/best-ai-tools-for-architects-2026 ; https://aps.autodesk.com/developer/overview/forma
- **Archistar**: generative floorplates with planning rules; exports GLTF/DXF/Rhino; Forma extension; no public API. https://archistar.ai/for-architects/page/85
- **Giraffe**: massing on site, storey-driven feasibility, JS SDK, CAD/BIM export; from $45/mo. https://www.giraffe.build/
- **Modelur**: SketchUp/Rhino parametric massing, GeoJSON/SHP in, no public API. https://modelur.com/
- **TestFit**: exports DXF/SKP/glTF/CSV/PDF + Revit add-in; Site Solver from $8k/yr; no API. https://testfit.io/try-testfit
- **Finch**: program→layouts; Rhino/Grasshopper/Revit; pricing €1k/mo (3 seats) per third party; API claims conflict. https://datadrivenaec.com/tools/finch3d
- **Hypar**: DXF/DWG/PDF/image site underlay, 3D plans with rooms/doors/windows; exports PDF/image/Excel/Revit/Rhino. https://docs.hypar.io/
- None of these auto-generate a facade from a sale plan; Forma Building Design is the closest (unverified beyond press).

---

## 4. Israeli companies

- **Swapp (BuildOS Ltd., Tel Aviv)**: AI construction docs from Revit/ArchiCAD BIM, "2D-to-3D conversion" in its Modeling product, no API, targets North America/Europe firms; $7M seed 2021, $11.5M Series A. https://swapp.ai/llms.txt ; https://www.calcalistech.com/ctech/articles/0,7340,L-3888995,00.html
- **Treedis**: Yad2 partnership embedding 3D project environments in Yad2 pre-construction listings (Gaussian splat neighbourhoods, AI furniture planning); separate CGI product "turns 2D floor plans into immersive 3D"; Matterport partner; 14-day trial, no API stated. https://studio.treedis.com/partnerships/yad2-treedis ; https://studio.treedis.com/
- **BMBY DREAMS**: VR platform for virtual apartment fairs (250+ projects, Dec 2023; Bat Yam event sold 50+ units). https://www.haaretz.com/haaretz-labels/real-estate/2023-12-17/ty-article-labels/virtual-real-estate-fair-is-a-game-changer-for-non-residents/0000018c-7780-de9c-aded-7fa8108f0000 ; https://www.nadlancenter.co.il/article/8238
- **3Dcom / Vizit.co**: "turns 2D floor plans into photorealistic 3D virtual tours automatically", used by Ashdar (Ashtrom) Pardes Ono 2021; current status unclear (vizit.co now shows spam). https://www.israelhayom.com/2021/03/18/science-not-fiction/ ; https://innovationisrael.org.il/en/importWinner/516230950
- **Vizrise / buildfloorplan.com (Tel Aviv, 2022)**: text/sketch/image/PDF → first-draft plans, 2D/2.5D/3D-style outputs. https://www.startuphub.ai/startups/ai-floor-plan-generator
- **Vree 3D (Haifa)**: AI image-to-3D (site unreachable). https://innovationisrael.org.il/importWinner/516431319
- **Metanoia Interactive (Bnei Brak)**: VR for Israeli real estate. https://www.jpost.com/Business-and-Innovation/Tech/Israeli-company-promises-to-revolutionize-real-estate-with-virtual-reality-technology-474505
- Buildots (site monitoring), Veev (builder), BeamUp (MEP design automation) are adjacent, not plan-to-3D. https://en.globes.co.il/en/article-1001380656 ; https://therealdeal.com/2022/03/31/startup-raises-15m-to-slash-building-systems-design-construction-costs/
- No evidence found of Madlan 3D, "Dira Lehatzig", Mishtara, VisualSpec, Reality Pro, Tiv Hadira, Homm offering automated plan→3D.

---

## 5. Comparison table (plan → structured 3D)

| Tool | Input | Auto walls/doors/windows | 3D export | API | Price | Hebrew/cm |
|---|---|---|---|---|---|---|
| Planner 5D B2B | img/PDF/DWG | yes (+human review) | editable scene/360, no GLB doc | REST | €99 trial → custom | unverified |
| Homestyler | img/DWG/PDF | Auto Generate (Beta) | no whole-model export | none | consumer | DWG units auto |
| Coohom | DWG/DXF only | yes (strict drawing rules) | unverified | Open API (undocumented) | n/a | mm/m auto |
| Strukt AI | img | yes | GLB/IFC/BLEND/OBJ/FBX | none | ₹200/2000 cr | unverified |
| Space Designer 3D | manual (AI unverified) | – | GLB/IFC/DXF | Enterprise API | n/a | metric |
| Getfloorplan | img/PDF | human+AI, 24 h | 2D/3D/360 images | enterprise | ~$20–70/plan | unverified |
| Floorplanner | FML/RoomPlan | no recognition | images/3D tour | REST (Enterprise) | credits | metres |
| Magicplan | scan | n/a | DXF/IFC/OBJ/USDZ | REST | PRO sub | – |
| Raster2Seq | raster | rooms+doors+windows | polygons→your extruder | self-host | weights NC | retrain needed |
| FloorplanVLM recipe (Qwen2.5-VL-3B) | raster | walls+openings+rooms JSON | → IfcOpenShell/three.js | self-host | GPU | fine-tune on Israeli plans |
| FloorPlanNet | raster CAD-style | yes | SVG/DXF/GeoJSON | self-host | MIT | calibrate px/m |
| Snaptrude | PDF/DWG underlay | manual + Create Building | GLB/OBJ/IFC/Revit | plugin + Enterprise API | $50/mo+ | metric |

---

## 6. Top 3 recommendations (plan PDF → labelled GLB)

1. **Own fine-tuned VLM pipeline (FloorplanVLM-style)**: PDF→raster (and DWG→vector pre-pass via ezdxf when available) → Qwen2.5-VL/Qwen3-VL fine-tuned with SFT+GRPO on CubiCasa5K-style data **plus a few hundred annotated Israeli sale plans** → JSON {walls(thickness), openings, rooms} → deterministic validator/repair → IfcOpenShell `create_2pt_wall` + opening subtraction → IFC → GLB (also direct three.js extrusion for web). Rationale: reported Ext-IoU 0.93/Room-F1 0.82 on a public benchmark, JSON schema already matches "walls/doors/windows/rooms labelled", labels can include ממ"ד/מרפסת after fine-tuning; cost ~3k output tokens/plan on a 3B model.
2. **Planner 5D Recognition API as the fast commercial fallback** for a pilot (human-reviewed, DWG/PDF accepted, 360 + editable scene returned), while negotiating raw geometry/room_data export; use it to bootstrap ground-truth for option 1.
3. **Hybrid segmentation + vectorisation (FloorPlanNet/MitUNet-class, MIT)** trained from scratch on synthetic + Israeli plans to avoid CubiCasa's non-commercial taint; run in-browser or server, output DXF/SVG centrelines → same IFC/GLB extruder; fastest (<1 s) and cheapest, best for clean vector-derived PDFs typical of תכנית מכר.

For building massing: stack per-floor results with your own floor-height table and use Snaptrude (GLB/IFC via plugin API) or a plain Blender script; no vendor automates facade generation from sale plans.

---

## 7. Open risks

- **Licensing**: CubiCasa5K (CC BY-NC-SA 4.0), Raster2Seq weights (CC BY-NC 4.0, SaaS inference explicitly not authorized), HEAT/DeepFloorplan (GPL/non-commercial) — anything trained on them inherits restrictions; need in-house or synthetic data.
- **Israeli plan accuracy**: no model/vendor documents Hebrew labels, cm dimension strings, ממ"ד (thick RC walls + blast door/window symbols), or mirrored "דירה הפוכה" plans; FloorplanVLM's data came from one industrial platform; FPBench "non-Manhattan" opening-F1 drops to 0.69. Expect a labelled Israeli test set (~100–300 plans) before trusting metrics.
- **Scale**: raster recognisers return pixels; need dimension-string OCR or user-set scale (FloorPlanNet, Strukt all require calibration).
- **API maturity**: Planner 5D API details "confirmed during technical scoping", turnaround figures conflict (minutes vs 24 h); CubiCasa/Coohom/Getfloorplan APIs gated or undocumented; Spacely 3D plans "coming soon"; Floorplanner has no recognition endpoint.
- **General VLMs are not reliable parsers yet**: frontier models score near random on Blueprint-Bench and need deterministic geometry repair.
- **Unverified (search budget hit)**: Coohom 3D export formats, Forma Building Design API, Hypar Elements license, Space Designer 3D AI import, exact Israeli sale-spec (צו המכר) drawing requirements.
