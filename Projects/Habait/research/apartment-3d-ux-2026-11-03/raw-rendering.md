# Raising the dollhouse toward "looks rendered" - technique research

Date: 2026-11-03. Desk research only; nothing installed or run. Scope: Habait apartment-page dollhouse (three r170, Draco GLB ~174 KB, no UVs, flat colours, offline single-HTML ZIP, mid-range phones, no local GPU, free Kaggle T4).

Conventions. **[V]** = verified this session from the cited current doc/source. **[U]** = unverified (recollection, search snippet, vendor claim, or my own estimate). Gain 1-5 and effort in days are my judgement for this stack, not sourced. Numbers derived from the owner's Cycles figure (~30 s per 960x540 frame at 16 spp on Iris Xe CPU) are labelled "estimate".

---

## 0. Findings that change the plan (read first)

1. **r170 has no glTF lightmap path.** GLTFLoader at tag r170 registers KHR_materials_{clearcoat, dispersion, ior, sheen, specular, transmission, iridescence, anisotropy, unlit, volume, emissive_strength}, EXT_materials_bump, KHR_texture_{basisu, transform}, EXT_texture_{webp, avif}, EXT_meshopt_compression, EXT_mesh_gpu_instancing, KHR_draco_mesh_compression, KHR_mesh_quantization, KHR_lights_punctual. No lightmap extension. [V] https://raw.githubusercontent.com/mrdoob/three.js/r170/examples/jsm/loaders/GLTFLoader.js . Khronos never ratified one (PR #1017 stalled; discussion moved to issue #1658). [V-search] https://github.com/KhronosGroup/glTF/pull/1017 . So: bake into baseColor (+ `KHR_materials_unlit`), or attach `material.lightMap` yourself in JS after load.
2. **Spark (the maintained 3DGS renderer) needs three >= 0.180; r170 is below it.** Spark 2.4.0 has `peerDependencies: three >=0.180.0`. [V] https://raw.githubusercontent.com/sparkjsdev/spark/main/package.json . GaussianSplats3D (mkkellogg) is no longer actively developed; its author recommends Spark. [V] https://raw.githubusercontent.com/mkkellogg/GaussianSplats3D/main/README.md . Splats therefore imply a three upgrade or a separate bundle.
3. **three-gpu-pathtracer: the WebGL tracer is deprecated.** v0.0.21 added `WebGLPathTracer`; v0.0.25 added `WebGPUPathTracer` and deprecated the WebGL class; min three became r180 (v0.0.24), r185 (v0.0.25), r187 (v0.0.28). README now says "requires WebGPU". [V] https://github.com/gkjohnson/three-gpu-pathtracer/releases and https://raw.githubusercontent.com/gkjohnson/three-gpu-pathtracer/main/README.md . For r170 you would pin an old release (exact r170-compatible tag [U]).
4. **API facts for r170 (all [V] from r170 source):** `AgXToneMapping` (6) and `NeutralToneMapping` (7) exist in `constants.js`; `PCFSoftShadowMap` and `VSMShadowMap` exist; `GTAOPass` exists in `examples/jsm/postprocessing/`; `RoomEnvironment` has a no-arg constructor; `renderer.compile` and `renderer.compileAsync` exist; the lightmap UV set comes from `lightMap.channel` (1 -> `uv1`) and is part of the program cache key. Sources: https://raw.githubusercontent.com/mrdoob/three.js/r170/src/constants.js , .../examples/jsm/postprocessing/GTAOPass.js , .../examples/jsm/environments/RoomEnvironment.js , .../src/renderers/WebGLRenderer.js , .../src/renderers/webgl/WebGLPrograms.js .
5. **The biggest realism lever is baked lighting, and it is cheap for this geometry**: a few thousand triangles bake in minutes even on CPU (estimate in 2.7). Everything else is a supporting act.

---

## 1. Comparison table

Gain 1-5 = jump toward "looks rendered". Effort = dev-days. $ = compute cost (CPU = dev machine; T4 = Kaggle free tier). Mobile risk L/M/H. ZIP = delta to the offline ZIP. All gain/effort/ZIP figures are estimates unless sourced in the section.

| # | Technique | Gain | Effort | Compute $ | Mobile risk | ZIP delta | r170 notes |
|---|---|---|---|---|---|---|---|
| 1a | Bake lighting into baseColor atlas (`KHR_materials_unlit`) | 5 | 3-5 | $0 (CPU ~20-40 min / T4 ~2-6 min, est.) | L | +150-500 KB | works, no extension needed |
| 1b | Bake AO/indirect to `material.lightMap` on UV1, keep runtime light | 4 | 4-6 | $0 | L-M | +150-500 KB | needs `texture.channel=1`, `uv1`, manual wiring |
| 1c | Bake to vertex colours (no UVs) | 3 | 1-2 | $0 | L | +0-60 KB | COLOR_0; needs tessellation [U] |
| 2a | Env IBL (RoomEnvironment / tiny HDRI via PMREM) | 3 | 0.5 | $0 | L | 0 / +100-300 KB | `new RoomEnvironment()` |
| 2b | AgX / Neutral tone mapping + colour grade | 2-3 | 0.5 | $0 | L | 0 | constants present |
| 2c | GTAO / N8AO | 3 (1 if baked) | 1-2 | $0 | M-H | +20-60 KB | GTAOPass present; N8AO needs r161+ |
| 2d | Contact shadow / soft shadows | 2-3 | 0.5-1 | $0 | L-M | 0 | PCFSoft, VSM, PCSS via chunk patch |
| 2e | SMAA/FXAA, gradient backdrop, cap styling | 2 | 0.5-1 | $0 | L | 0-10 KB | |
| 3 | Wall cutaway (stencil caps, dynamic height, fade, x-ray) | 2 | 1-3 | $0 | L-M | 0 | `localClippingEnabled` |
| 4 | Gaussian splat of furnished interior | 4-5 but fuzzy | 8-15 | ~$0 (T4 30-90 min, est.) | M-H | +3-30 MB | Spark needs r180+ |
| 5 | Pre-rendered spinner + hidden GLB for picking | 5 | 5-8 | $0 (CPU ~8 h / T4 ~0.5 h, est.) | L | +3-8 MB | no three constraint |
| 6 | Browser progressive path tracing (idle still) | 4 desktop / 0 mobile | 3-5 | $0 | H | +100-200 KB | WebGL tracer deprecated |
| 7 | Mobile perf discipline | enabling | 1-2 | $0 | lowers risk | 0 | `compileAsync` exists |

---

## 2. Technique 1 - Baked lighting from Blender

### 2.1 Why it wins
The scene already exists in Blender 4.5. Cycles bakes soft shadow, window light, AO and bounce into a texture; the browser only samples it: no light or shadow cost, photographic gradients, which the eye reads as "rendered". Cycles uses the render-panel samples/bounces for baking, so quality matches a render; bake types include Diffuse (Direct/Indirect/Color toggles) and AO. [V-search, 2.81 manual - confirm in the 4.5 manual] https://docs.blender.org/manual/en/2.81/render/cycles/baking.html

### 2.2 Three ways to consume the bake in r170
- **A. Full bake into baseColor (try first).** Bake Combined (or Diffuse Direct+Indirect+Color), use as `baseColorTexture`, export with `KHR_materials_unlit` (supported in r170 GLTFLoader [V]) or swap to `MeshBasicMaterial` in JS. Pros: zero runtime lighting; looks like the Cycles bake; works with any tone mapper. Cons: no dynamic light; changing a floor colour needs a re-bake or a multiply tint; glass and cap faces stay separate.
- **B. `material.lightMap`** on `MeshStandardMaterial`: the field exists (`lightMap`, `lightMapIntensity`, `aoMap`) [V] https://raw.githubusercontent.com/mrdoob/three.js/r170/src/materials/MeshStandardMaterial.js ; the UV set is `lightMap.channel` -> `uv1` [V] WebGLPrograms r170. A forum remark says lightmaps multiply indirect diffuse [V-search] https://github.com/KhronosGroup/glTF/issues/947 - so remove or dim the runtime light or you double-light. GLTFLoader will not populate it; ship a sidecar JSON mapping materialName -> lightmap and set `texture.channel = 1`, `flipY = false`, `colorSpace`, and a `uv1` attribute yourself [U for glTF flipY details].
- **C. Community extension.** webgi has `WEBGI_materials_lightmap` [V-search] https://webgi.xyz/docs/api/classes/Asset_Management.GLTFMaterialsLightMapExtension ; Epic's exporter has `EPIC_LightmapTextures` [V-search] https://dev.epicgames.com/documentation/en-us/unreal-engine/API/Plugins/GLTFExporter/EGLTFJsonExtension . Neither is read by r170. Not worth it versus A or B with a sidecar.

### 2.3 UVs / atlas for a procedural mesh with no UVs
1. Blender `Smart UV Project` or `Lightmap Pack` run on the joined mesh in the build script (`bpy.ops.uv.smart_project`, `bpy.ops.uv.lightmap_pack`) - minimal effort [U exact quality].
2. **xatlas** (chart packing with padding; Python and JS/WASM bindings) used offline at build time [U for current API; https://github.com/jpcy/xatlas].
3. **Own deterministic planar packer in the plan builder**: floors are planar rooms, walls are vertical quads; a shelf packer gives exact, reproducible UVs with no unwrap artefacts - matches the "same inputs -> same outputs" rule (root CLAUDE.md section 2). Highest effort, best determinism.
Guidelines: 2-4 px margin, uniform texel density, no overlapping or mirrored islands. Bake target is the active Image Texture node of each material. [V-search] 2.81 manual above.

### 2.4 Wall-cut versus bake
Bake with full-height walls and a ceiling and the real window openings, so GI and window light are right; then hide ceiling/upper walls in the web view. Keep the dark cap faces as a separate unbaked material. [engineering judgement]

### 2.5 Texture budgets and formats
- JPEG/PNG/WebP/AVIF are decoded and uploaded uncompressed: a 4096x4096 image with mipmaps is ~90 MB of GPU memory whatever the file size; mipmaps add ~33%. [V] https://www.donmccurdy.com/2024/02/11/web-texture-formats/
- KTX2/Basis stays GPU-compressed (4-8x less VRAM). ETC1S ~ JPEG-size, weak on normal maps; UASTC near BC7, files 1-2x JPEG. **Basis does not support HDR.** [V] same page.
- Extensions: `EXT_texture_webp`, `KHR_texture_basisu`; both handled by r170 GLTFLoader [V]. WebP has no VRAM advantage [V-search] https://discourse.threejs.org/t/webp-vs-ktx2-for-web-textures/58651 . KTX2Loader needs the WASM transcoder and `detectSupport(renderer)` [V-search] https://threejs.org/docs/pages/KTX2Loader.html .
- **Offline ZIP**: KTX2 adds the transcoder WASM inline (size [U], a few hundred KB); for one 1-2K lightmap the VRAM benefit does not repay it. Use **JPEG or WebP, 1024-2048 px, q80-88, one atlas** (200-500 KB for 2048 px [U]). VRAM of a 2048 px RGBA texture with mips = 2048*2048*4*1.33 ≈ 22 MB (computed); 1024 px ≈ 5.5 MB. Smooth lighting survives half resolution, so 1024 px is a good phone tier.

### 2.6 gltf-transform pipeline
Commands exist [V] https://gltf-transform.dev/cli : `optimize` (e.g. `optimize in.glb out.glb --compress draco --texture-compress webp`), `draco`, `meshopt`, `etc1s`, `uastc`, `webp`, `resize`, `inspect`, `ktxfix`. Per-command flags are not on the index page; use `gltf-transform help <cmd>` [U]. For the offline file, test **meshopt instead of Draco**: r170 supports `EXT_meshopt_compression` [V] and the meshopt decoder is far smaller than the Draco WASM decoder (sizes [U]). Suggested chain: `inspect` -> `resize` to 2048 -> `webp` (or keep JPEG) -> `meshopt`.

### 2.7 Bake cost (estimates)
- Owner baseline: ~30 s for 960x540 (0.52 Mpx) at 16 spp, CPU. Assuming cost ∝ pixels x spp: a 2048 px atlas (4.2 Mpx, ~60% of texels used) at 128 spp ≈ (0.6*4.2/0.52) * (128/16) * 30 s ≈ 1160 s ≈ **~20 min CPU**; 256 spp ~40 min; 1024 px a quarter. OIDN denoising allows 64-128 spp. [estimate]
- T4: I found no verified T4 Cycles figure. Other cards show OptiX roughly 1.8-2x faster than CUDA [V-search] https://projects.blender.org/infrastructure/blender-open-data/issues/73322 . A guess of 5-10x versus the Iris Xe CPU gives **~2-6 min** [U]. Kaggle quota page returned 404; check https://www.kaggle.com/docs/notebooks [U]. Headless Blender install on Kaggle needs internet enabled [U].
- $0 either way. Record seed and scene hash in `manifest.json` (root CLAUDE.md section 5).

### 2.8 Risks
Baked shadows do not follow the camera (fine for a static layout); the bake becomes a per-listing pipeline step; avoid double tone mapping on unlit materials (tone-map once in three); disclosure wording stays Eliran's call (root CLAUDE.md section 6) - a Cycles bake of the traced plan is not generative imagery.

---

## 3. Technique 2 - Real-time upgrades with no bake

### 2a Environment IBL
`PMREMGenerator.fromScene(new RoomEnvironment())`; RoomEnvironment is one shared BoxGeometry, 13 meshes, 8 materials, no constructor args [V] link in section 0. A small HDRI (256x128 for diffuse lighting, tens of KB [U]) gives more character; HDR cannot use Basis [V]. Gain 3: lifts flat `MeshStandardMaterial` colours with soft gradients and faint floor/glass reflections. Cost: one-time PMREM; negligible per frame. Keep env as lighting only, not background.

### 2b Tone mapping and grade
`AgXToneMapping` and `NeutralToneMapping` exist in r170 [V]. Neutral (Khronos PBR Neutral) preserves base colours - good for cream doors and flat floors; AgX is a filmic roll-off; ACES (current) shifts hues [U general knowledge]. Try Neutral first. With pmndrs `postprocessing`, tone mapping moves to `ToneMappingEffect` and the renderer must stay `NoToneMapping`; it also has LUT/colour grading and vignette effects and merges effects into one pass [V] https://github.com/pmndrs/postprocessing . Subtle grade (contrast +, warm shadows, light vignette) is cheap.

### 2c SSAO / GTAO / N8AO
- `GTAOPass(scene, camera, width, height, parameters, aoParameters, pdParameters)` with outputs Default/Diffuse/Depth/Normal/AO/Denoise exists in r170 [V] https://raw.githubusercontent.com/mrdoob/three.js/r170/examples/jsm/postprocessing/GTAOPass.js . It needs a depth/normal pass plus AO and denoise passes: roughly an extra scene pass + 2-3 fullscreen passes [estimate]. On phones run at half-res or only when the camera is at rest.
- **N8AO**: `N8AOPass` (plain EffectComposer) / `N8AOPostPass` (pmndrs); WebGL2, three r161+ recommended; quality modes Performance (8 samples) to Ultra; `halfRes` gives 2-4x speed; "Performance" recommended for mobile; needs SMAA because MSAA does not work with AO; has accumulation for still cameras. [V] https://raw.githubusercontent.com/N8python/n8ao/master/README.md
- Gain 3 on an unbaked scene, ~1 when lighting is baked (but still helps unbaked furniture/ground contact).

### 2d Shadows
- `PCFSoftShadowMap` (cheap default) and `VSMShadowMap` (softer, light-bleed artefacts [U]) exist [V].
- **PCSS** = the official example overriding `THREE.ShaderChunk.shadowmap_pars_fragment` before renderer creation; contact-hardening penumbra, many taps -> desktop only. [V] https://raw.githubusercontent.com/mrdoob/three.js/r170/examples/webgl_shadowmap_pcss.html
- **Contact shadows** example: ortho depth render from below into a 512 px target + two blur passes, drawn on a plane; re-render per frame only if objects move. [V] https://raw.githubusercontent.com/mrdoob/three.js/r170/examples/webgl_shadow_contact.html . For a static apartment, render once at load: nearly free grounding.
- Cheaper: 1024 shadow map, tune `shadow.radius`, `bias`, `normalBias`; baked shadows replace all of this.

### 2e AA, backdrop, caps
SMAA/FXAA are needed once a composer is used (no MSAA through the composer unless the target is multisampled); `SMAAPass` is in three examples [U exact r170 path]. Without post, keep native MSAA and a DPR cap. Backdrop: replace flat navy with a radial gradient (CSS behind a transparent canvas) - zero cost, strong "studio" effect; keep the ShadowMaterial disc. Caps: a lighter warm-grey poché with a thin darker edge reads as an architectural section rather than a hole.

---

## 4. Technique 3 - Wall cutaway in three r170

- **Global cut / dynamic height**: `renderer.localClippingEnabled = true`; `material.clippingPlanes = [new Plane(new Vector3(0,-1,0), h)]`; animate `plane.constant`; set `clipShadows = true` for shadows. [V] https://raw.githubusercontent.com/mrdoob/three.js/r170/examples/webgl_clipping_stencil.html
- **Stencil caps** (the r170 example, [V]): per clipped solid, a BackSide mesh with stencil IncrementWrap and a FrontSide mesh with DecrementWrap (colour/depth writes off), then a cap plane drawn where `stencilFunc = NotEqualStencilFunc`, `stencilRef = 0`; `renderOrder` orders stencil -> cap -> visible mesh; `renderer.clearStencil()` after each cap; cap plane re-positioned to the cutting plane per frame. Requires **watertight** wall meshes (openings must be real holes in a closed shell). Cost: 2 extra draws per wall mesh plus a quad - fine for ~10-20 walls. Stencil buffer must be present on the context [U check default].
- **Recommended simpler route**: pre-cut wall variants (e.g. 0.2 m / 1.2 m / full) generated by the Blender builder and toggled by visibility; caps are real faces, no stencil. For a smooth slider on prism walls, scale walls in Y and move a top-face cap with them.
- **Walls fading when facing the camera**: per wall segment, compute dot(outward normal, camera direction) on control change; if the wall is between camera and interior, lerp its height down (or `visible=false`; or opacity 0.1-0.25 with `transparent`, `depthWrite=false`). Prefer visibility/height over blending on phones (sorting and overdraw). The builder already knows each wall's normal.
- **X-ray**: all walls `transparent`, opacity ~0.2, `depthWrite=false`; optionally `EdgesGeometry` lines only in x-ray mode (does not break the zero-line style at rest). `ClippingGroup` is a WebGPU-renderer feature in later versions [U], not r170 WebGL.
- Picking and labels keep using the real GLB with `Raycaster` regardless of visual state.
Gain 2 (UX polish). Effort 1-3 days. ZIP 0. Mobile risk low if transparency is avoided.

---

## 5. Technique 4 - Gaussian splatting

Pipeline: N Cycles views (100-300 cameras) with exact Blender poses (no COLMAP risk) -> train 3DGS -> PLY -> compress (SPZ/SOG) -> browser.

- **Spark**: three.js, WebGL2, "fuse splat and mesh-based objects", reads PLY (incl. compressed), SPZ, SPLAT, KSPLAT, SOG; says it "renders fast even on low-powered mobile devices" (no benchmark) [V] https://raw.githubusercontent.com/sparkjsdev/spark/main/README.md . **Needs three >= 0.180** [V]. LoD + paged streaming in Spark 2.0; one source cites ~500 K splats mobile vs ~2.5 M desktop [U-search] https://radiancefields.com/world-labs-previews-spark-2.0 . `SplatMesh.raycast()` exists [V-search] https://sparkjs.dev/docs/splat-mesh .
- **GaussianSplats3D**: .ply/.splat/.ksplat; renders opaque depth-writing three meshes together via `threeScene`; "sub-optimal performance on mobile" is a known issue; unmaintained. [V] README link above.
- **PlayCanvas SOG**: ~15-20x smaller than PLY, 2-3x better than compressed PLY, lossy; 1 GB / 4 M gaussians -> 55 MB (earlier SOGS). [V-search] https://developer.playcanvas.com/user-manual/gaussian-splatting/formats/sog/ , https://blog.playcanvas.com/playcanvas-adopts-sogs-for-20x-3dgs-compression
- **T4 training**: one anecdotal Colab-T4 report of 15-30 min on NeRF-synthetic scenes [V-search anecdote] https://dev.to/nomurasan/building-a-3d-scene-from-30-photos-getting-gaussian-splatting-running-on-colab-4n5p . For 150-300 Blender frames expect ~30-90 min [U estimate]. Faster recipes exist (FastGS ~100 s on a strong GPU, not T4) https://arxiv.org/pdf/2511.04283 . $0 on Kaggle (session limits [U]).
- **Size**: a clean synthetic interior of 0.5-1.5 M splats -> SOG ~10-30 MB (extrapolated from 55 MB / 4 M [estimate]); pruned to 300-500 K splats ~5 MB at some quality loss. Heavy for the ZIP.
- **Quality**: photoreal at/near trained poses, floaters and blur off-trajectory; straight plan lines are the weak spot [U general knowledge]. The cut-wall dollhouse is a different scene from the full-height one: train on renders of the already-cut scene; each alternative cut mode needs its own splat.
- **Picking with exact geometry**: yes - keep the GLB as an invisible raycast proxy; splats are paint only. Depth compositing against opaque meshes works in GS3D [V]; Spark mesh-depth handling not confirmed [U]. Training on Cycles renders of the plan is reconstruction, not generation, but disclosure stays Eliran's call.
- Mobile fps: no source; assume 20-30 fps at ~500 K splats [U], needs device tests.
- Verdict: **spike later**; forces a three upgrade, 10-30 MB assets, per-listing GPU training; Technique 5 gives a similar still-quality result more cheaply on phones.

---

## 6. Technique 5 - Pre-rendered hybrid spinner

Design: N Cycles frames on a circle (optionally 2 elevations) played as a draggable image sequence; the GLB stays loaded but invisible, giving raycast picking, labels and room highlights (set the three camera to the frame's Blender pose so overlays align [engineering; U on conversion details]); use the live GLB only for transitions or a "free" mode.

- Frame norms: 24-36 typical, 72 premium, 36 a sweet spot (multiple of 4), keep total under ~20 MB, WebP ~35% smaller than JPEG, preload all frames. [V-search] https://helpdesk.nuorder.com/hc/en-us/articles/360046239871 , https://www.webrotate360.com/blog/2024/how-many-images-do-i-need-for-a-360-product-view.aspx , https://imajize.com/blog/360-image-tips/choose-frame-count-image-dimensions , https://spotlight.scaleflex.com/docs/experience-types/spin-360
- Size: 36-72 frames at 1280x720 WebP q80 ≈ 60-120 KB each ≈ 3-8 MB [estimate]. ZIP +3-8 MB.
- Compute (estimates): 1280x720 at 128 spp + denoise ≈ 30 s * 1.8 * 8 ≈ 7 min/frame CPU -> 72 frames ≈ 8.6 h CPU; T4 perhaps 10-30 s/frame -> 12-36 min [U]. $0.
- **Products**: spin viewers are standard in e-commerce (WebRotate 360, Scaleflex Spotlight). For real estate, Matterport, iStaging, Virtuance, Houzz Pro and render studios deliver live 3D dollhouses or stills; I found no real-estate product shipping a pre-rendered dollhouse spinner [V-search, negative result] https://matterport.com/blog/engage-home-buyers-and-sellers-3d-floor-plan-views .
- **AI-paint consistency risk**: per-frame img2img/ControlNet flickers; naive ControlNet relighting is reported to flicker, and dedicated multi-view methods (SyncLight, LightSwitch, coupled diffusion sampling) exist to fix it. [V-search] https://arxiv.org/html/2601.16981v1 , https://arxiv.org/html/2508.06494v1 , https://arxiv.org/html/2510.14981v1 , https://arxiv.org/pdf/2409.08947 . Safe route: **Cycles frames as the product** (no consistency risk, no invented geometry). If painting is wanted: depth/edge-conditioned, fixed seed, low strength, automated edge-drift check against the clay render, mandatory badge (root CLAUDE.md section 6).
- Mobile: decode + draw only, best phone performance of any option. Memory: 72 decoded 1280x720 frames ≈ 72 * 3.7 MB ≈ 266 MB (computed) - too much for iOS; decode on demand (ImageBitmap for current +/- 3 frames) or use fewer/smaller frames. Avoid video scrubbing.
- Limits: view locked to the orbit; each wall-cut mode multiplies frame sets; no free zoom (keep GLB mode as fallback).
Gain 5, effort 5-8 days.

---

## 7. Technique 6 - Progressive path tracing in the browser

- `three-gpu-pathtracer`: BVH-based; MeshStandard/Physical only; spot/directional/point lights only with MIS; emissive without MIS; denoising demo. [V] https://raw.githubusercontent.com/gkjohnson/three-gpu-pathtracer/main/README.md
- Status: `WebGLPathTracer` (v0.0.21) deprecated in v0.0.25; current line needs `WebGPURenderer`, three r185+. [V] https://github.com/gkjohnson/three-gpu-pathtracer/releases . A pre-0.0.24 WebGL release may work with r170 but is unmaintained [U].
- Gain on desktop idle: high after seconds of accumulation, but noisy at first and it duplicates what a bake gives for free. **Mobile: no** (thermal, memory, BVH). WebGPU phone coverage [U].
- Verdict: skip; ship a pre-rendered Cycles still for desktop instead.

---

## 8. Technique 7 - Mobile performance

Budget sources are weak rules of thumb: draw calls <= 100 (some say < 50), < 100 K polygons, avoid 4K textures on iOS [U] https://discourse.threejs.org/t/problems-with-performance-on-mobile-devices/23734 , https://discourse.threejs.org/t/page-auto-refresh-in-mobile-browsers/42232 . The dollhouse (27 nodes, a few thousand triangles) is far inside geometry/draw-call budgets; the real risks are **fill rate (DPR x post x shadows) and texture memory**.
- DPR: `renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5))` on phones [setPixelRatio exists r170, V], 1.0 under load.
- Adaptive quality: moving average of frame time; if > ~24 ms for ~1 s step down: AO off -> shadow map 2048 -> 1024 -> DPR down -> stop auto-rotate. **Render on demand** (stop the loop when idle) - biggest battery win.
- Warm-up: `await renderer.compileAsync(scene, camera)` [V r170], upload textures early with `renderer.initTexture()`, `ImageBitmapLoader` for off-thread decode [V-search McCurdy page].
- Memory: a 2048 px lightmap ≈ 22 MB with mips; keep total texture VRAM under ~100 MB [U].
- Measure: `renderer.info.render.calls/triangles` and `info.memory` [V `info` in r170]; Chrome remote debugging (Android) and Safari Web Inspector (iOS); `stats.js`; `EXT_disjoint_timer_query_webgl2` where present [U]; CPU throttle in devtools only as a smoke test; test on a real mid-range Android plus an older iPhone; compare 5-minute battery/thermal with idle rendering on and off [U].
- Auto tier from `navigator.hardwareConcurrency`, `deviceMemory`, GPU string, with a manual toggle.

---

## 9. Recommended stack (order to try)

1. **Same-day look pass (0.5-1 day)**: `NeutralToneMapping` (A/B with AgX), `RoomEnvironment` at low intensity, radial gradient backdrop, lighter warm cap colour, DPR cap, render-on-demand. Gain +1-2, near-zero risk; sets up the real-phone screenshot A/B.
2. **Baked lighting atlas (3-6 days) - the main jump.** Add UVs in the builder (own planar packer or Smart UV + xatlas), bake Combined/Diffuse with ceiling and windows at 128-256 spp + denoise (CPU 20-40 min or Kaggle T4 minutes), export `KHR_materials_unlit` baseColor in a 1024-2048 px WebP/JPEG, optimise with gltf-transform (resize, webp, meshopt). ZIP +0.2-0.5 MB. Falls back to today's look if the atlas is absent. Optional: AO-only `lightMap` on `uv1`.
3. **Contact shadow rendered once + optional N8AO/GTAO at rest (1-2 days)**: N8AO "Performance"/halfRes on mobile; only on high-tier devices.
4. **Cut-away polish (1-3 days)**: fade/hide walls facing camera, discrete pre-cut heights (no stencil), styled caps.
5. **Pre-rendered spinner for the hero view (5-8 days)** if step 2 does not reach "rendered": 36-72 Cycles frames, WebP, GLB invisible for picking/labels, same Blender scene as step 2 so both look alike.

**Avoid / defer**: Gaussian splats now (three >= r180, 10-30 MB, per-listing training, fuzzy straight edges); browser path tracing (WebGPU-only maintained line, not for phones); stencil caps unless walls are proven watertight; PCSS/VSM and 4K textures on phones; KTX2 for a single small lightmap in the offline ZIP; per-frame independent AI img2img for the turntable; any extra runtime light on top of baked lighting.

---

## 10. Gaps to close in a spike
Exact T4 Cycles speed-up and Kaggle limits (docs URL returned 404); the Blender 4.5 bake manual text; xatlas current API; gltf-transform per-command flags; r170-compatible three-gpu-pathtracer tag; Basis transcoder and Draco/meshopt decoder byte sizes for the ZIP; real-device fps for every option.

## 11. Sources
three r170 source: raw.githubusercontent.com/mrdoob/three.js/r170/ - src/constants.js, src/materials/MeshStandardMaterial.js, src/renderers/webgl/WebGLPrograms.js, src/renderers/WebGLRenderer.js, examples/jsm/loaders/GLTFLoader.js, examples/jsm/postprocessing/GTAOPass.js, examples/jsm/environments/RoomEnvironment.js, examples/webgl_clipping_stencil.html, examples/webgl_shadow_contact.html, examples/webgl_shadowmap_pcss.html.
Other: https://gltf-transform.dev/cli ; https://www.donmccurdy.com/2024/02/11/web-texture-formats/ ; https://discourse.threejs.org/t/webp-vs-ktx2-for-web-textures/58651 ; https://threejs.org/docs/pages/KTX2Loader.html ; https://github.com/N8python/n8ao ; https://github.com/pmndrs/postprocessing ; https://github.com/gkjohnson/three-gpu-pathtracer ; https://github.com/sparkjsdev/spark ; https://sparkjs.dev/docs/splat-mesh ; https://radiancefields.com/world-labs-previews-spark-2.0 ; https://github.com/mkkellogg/GaussianSplats3D ; https://developer.playcanvas.com/user-manual/gaussian-splatting/formats/sog/ ; https://blog.playcanvas.com/playcanvas-adopts-sogs-for-20x-3dgs-compression ; https://github.com/KhronosGroup/glTF/pull/1017 ; https://github.com/KhronosGroup/glTF/issues/947 ; https://webgi.xyz/docs/api/classes/Asset_Management.GLTFMaterialsLightMapExtension ; https://docs.blender.org/manual/en/2.81/render/cycles/baking.html ; https://projects.blender.org/infrastructure/blender-open-data/issues/73322 ; https://dev.to/nomurasan/building-a-3d-scene-from-30-photos-getting-gaussian-splatting-running-on-colab-4n5p ; https://arxiv.org/pdf/2511.04283 ; spinner norms and consistency papers linked inline above.
