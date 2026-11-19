# 04 — Reuse from earlier projects (Phase 4)

Surveyed READ-ONLY (nothing written there): `Projects/Habait` (Rainbow), `Projects/Pesel_yazamot`, `Projects/3Dengine`, `.wt/kedma-d1`. Each line says whether outputs on disk prove it works.

| Asset | Path | Proven by outputs? | Used in the PoC |
|---|---|---|---|
| Blender 4.5.10 LTS | `C:\Program Files\Blender Foundation\Blender 4.5\blender.exe` (pinned in `Projects/3Dengine/engine.config.json`) | yes | yes |
| Equirect renderer `render_pano.py` (wrap-pad seam fix, seed, adaptive, OIDN, depth map, manifest) | `.wt/kedma-d1/Projects/3Dengine/pipeline/360walkaround/pipeline/render_pano.py` | yes: 13 Kedma panoramas + `pano.render.json`, depth check 3/3 | **yes, called unchanged** for every keyframe |
| Furnished scene Kedma D/1 (13 rooms) | `.wt/kedma-d1/…/tours/kedma-d1/scene-full.blend` + `plan.json` | yes: `scene-full.report.json` 112/112 checks | **yes**: room `cp-living` |
| Scene builder `build_scene.py` (sun constants, HDRI world, ceiling luminaires, AgX Punchy) | `…/pipeline/build_scene.py` | yes | conventions reused (sun rotation formula verified against it) |
| Style lock (luminaire energy law, HDRI slug/sha) | `…/catalog/style-habait-modern.json` | yes | read only |
| Noon HDRI `qwantani_noon_puresky_4k.hdr` | `…/probe/probe-assets/hdri/` | yes | replaced by a Nishita sky per keyframe (no dusk/night HDRI exists on disk) |
| Tour viewer (Pannellum 2.5.6 + `tour.js`; engine on Photo Sphere Viewer 5.15.1 + three 0.185.1, `pannellum-compat.ts`) | `Projects/Habait/habait-walkaround/Habait/tour360/` | yes (live tours) | **not** used: no in-node cross-fade; `setLook()` swaps scenes with a fade, not a slider. The PoC shader is the piece to port |
| fal.ai edit models (nano-banana edit, flux-2/kontext, seedream) | `tour360/tools/*.mjs, edit_bench.py` | yes (skins/edits) | not used ($0 rule of this task) |
| QA gates: `fidelity-gate.mjs` (1 %), `consistency-check.mjs`, depth check 2 cm | `tour360/`, `render_pano.py` | yes | the depth-hash idea reused as the alignment proof |
| Playwright core | `Projects/3Dengine/appdeps/node_modules/playwright-core` | yes | **yes** (QA screenshots, read-only import) |
| Pesel_yazamot | `Projects/Pesel_yazamot` | — | source PDFs/renders only, no code; nothing to reuse for this feature |

**Not found anywhere:** a time-of-day parameter, a night world, a lights-on switch, a dusk/sunset/night HDRI, a slider cross-fade. `WALKAROUND-QUALITY-PLAN.md` lists "sunset + night looks" as planned card Q13 only. This PoC is the first working version.

**Environment facts found on the way:** this machine renders Cycles on CPU ("no GPU backend available", same as the Kedma log); the GPU box timings in `RENDER-LEDGER.md` (8192×4096 / 256 spp ≈ 1 404 s) are a different machine. Other sessions were rendering in Blender at the same time (hatzav, avnei-hefetz-kedem-4), so the PoC used 16 spp.
