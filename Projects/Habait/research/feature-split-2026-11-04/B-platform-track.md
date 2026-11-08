# Track 1 — the developer platform: code map for the worktree split
<!-- 2026-11-04 · read-only research · product repo habait-walkaround @ 35cc0f6 · $0, no server, no deploy -->

Paths are relative to `C:\RnD\Projects\Habait\habait-walkaround` (`HW/`) unless absolute. file:line = what I read on 2026-11-04.
The best prior map is `HW/Habait/engine/docs/upload-to-flow-gap-he.md` (card 37, 2026-11-03, 32-row table, 22 steps "manual-session"). This file re-checks it against the code today and adds the worktree view.

## 1. The chain today

**One line:** developer files (PDF plan, [images/notes]) → Studio upload → intake LLM (fal `openrouter/router/vision`) → `intake.json` → plan (human-traced `plan.json` or a draft held for review) → engine `project.json`/`building.py` → Blender clay (CPU) → fal image/video "skin" → tour360 build → platform `export` (ZIP + page) → `stage_flow.py` → Vercel (Eliran's own `!` command).

There are TWO overlapping orchestrators and neither is end to end:
- **Studio** (`Habait/studio`, Node): 9 fixed stages, upload UI, chat, per-room videos. Runs for real locally.
- **Engine** (`Habait/engine/cli.py`, Python): stages intake → plan → building → scene → clay → skin → video → export, stamp/hash skip, gates. skin is not wired; export only knows the Rainbow platform fixture.
They share no code ("nothing of the Studio is imported", `engine/cli.py:14-18`). The demo shown on `habait-flow.vercel.app` came from neither: it was made by hand-run scripts.

### Step table

| # | Step | Entry point (file:line) | Auto / hand | Model / where fal is called | Notes |
|---|---|---|---|---|---|
| 0 | Developer input | Studio `POST /api/projects/:id/files` multipart (`studio/server.mjs:12`); `studio/cli.mjs new/add` | **Auto** (local only) | — | Accepts PDF, images, text, a traced `plan.json`/`plan.general.json` (`pipeline/stages/plan.mjs:1-4`). **DWG/DXF/IFC are NOT in the Studio**; they exist only in the engine intake (`engine/intake/intake_dwg.py`, `intake_ifc.py`, `intake_pdf_vector.py`), tested on synthetic `sample.dxf/.ifc`. Brochure/price list/images: read by the intake LLM as document/image blocks; price list is not parsed into `units[]`. |
| 1a | Intake (Studio) | `studio/pipeline/stages/intake.mjs:85-98`; `lib/llm.mjs:29-36` `backendFor` | **Auto** | **fal** `openrouter/router/vision` via `lib/fal-llm.mjs:12,36`, default model `anthropic/claude-sonnet-5.5` (env `HABAIT_FAL_LLM_MODEL`); else Anthropic API (`claude-opus-5-5`), else `claude -p` CLI, else mock fixture `studio/fixtures/apt846.intake.json` | fal only when `FAL_KEY` + `HABAIT_ALLOW_SPEND=1` and only for callers that gate and ledger (`llm.mjs:77-83`, `allowFal` = intake and chat). Result is zod `IntakeSchema` (developer, building, unit, drawing/north, rooms, uncertainties). Paid check 2026-11-03 cost $0.17 (plan `2026-11-03-studio-agent-fal.md`). |
| 1b | Intake (Engine) | `engine/stages/intake.py` → `engine/intake/intake_raster.py` → `rasterize.py`, `vlm.py`, `tracer_cv.py` | **Auto** for raster (cli stage); vector/DXF/IFC readers are **hand-run tools** (not CLI stages) | VLM = `claude -p --model opus` subscription CLI, not fal (`intake/vlm.py:98`); replay via `file:<reply>` | OpenCV watershed tracer. For 846 the raster plan_gate FAILs (score 0.000, `intake/README.md:105`); vector path 0.500; only DXF reaches PASS 0.873 on a synthetic file (`:206`). So a human step (A2 correct screen, `engine/correct/serve.mjs`) is mandatory today. |
| 2 | Site / place | `studio/pipeline/stages/site.mjs:1` (Nominatim + Overpass OSM, $0) | **Auto** in Studio; for 846 the plot fit/north 304.4 and tower mass were **by hand** (`tools/bench/site846/fit_plot.py`, `tower_mass.py`, `studio/tools/export_site_glb.py`) | none | No engine `site` stage exists (gap doc row 8-9). |
| 3 | Plan (geometry) | Studio `stages/plan.mjs`; engine `stages/plan.py` (validate-plan.mjs + plan_gate + negative control) | Draft **auto** (LLM, held, "a draft never becomes plan.json by itself", `plan.mjs:3-4`); approval = **human** (`POST approve-plan`, `server.mjs:17`, or correct screen) | LLM draft through `llm.mjs` (not fal: `allowFal` false) | **846's plan was hand-traced**: `tour360/apartments/apt846/plan.general.json` (80 KB) and `360walkaround/tours/apt846*/plan.json` (ground truth for gates). D-WQ-16 "hand trace now, importers later". |
| 4 | project.json | `engine/schema/project.schema.json`, `validate_project.py`, `cli.py init` | **Hand-written** for Rainbow: `engine/fixtures/rainbow-846.project.json` (units[0]=apt846 real, others "stacked-approx" invented: `stack_units.py`, `platform/fixtures/rainbow/units.json`) | none | Nobody extracts developer/project/floors/units table from the brochure into project.json (gap row 2, 6). |
| 5 | Building mass + units.json | `engine/building.py` (`build` :294; `--mass-tool` Rainbow-only `tools/bench/site846/tower_mass.py`, `--plain-mass` generic) | **Auto** (engine stage `building`) | none | Real only for the 1 unit that has a plan. |
| 6 | Blender scene + clay | Engine `stages/scene.py`, `clay`; `360walkaround/pipeline/build_scene.py`, `render_tour.mjs`, `place_cameras.py`, `furnish_from_plan.py`; Studio `stages/scene.mjs`, `clay.mjs`, `tools/render_shots.py` | **Auto** but gated to the Blender owner (`HABAIT_BLENDER_OK=1`); ran once by hand 2026-11-02 (20 s scene + 699 s clay for 11 pts, `engine/README.md` Blender section) | none (deterministic, $0). CPU only on this laptop; GPU = Kaggle/rented | Furnishing not wired in the engine (`fixtures: []`, gap row 20). |
| 7 | Interior skin (photoreal panos) | Hand: `tour360/tools/gen-pano.mjs <apt> <scene> <model>` (:25 seedream45, :66 flux-2-pro/edit, :71 nano-banana-pro/edit); engine template `engine/stages/paid.py:24-29` (`gpt25x`, $2.40/pano) | **Hand** (cameras.json, `prompts.src.mjs`, make-refs/make-scenes by hand). Engine `skin` = REFUSE/NOT-WIRED (exit 3/4); its `cp-*` ids do not match tour360 scene names | **fal**: Nano Banana Pro/2, Seedream 4.5, Flux-2-pro, GPT Image 2/2.5; fixing tools `fal-ai/finegrain-eraser/mask`, `fal-ai/bria/eraser`, `fal-ai/flux-pro/kontext` | apt846 ledger `tour360/apartments/apt846/_local/ledger.json` is $129.74 of a $120 cap (SESSIONS.md:59) — over the cap. |
| 8 | Studio keyframes + video | `studio/pipeline/stages/keyframes.mjs:54` (`fal-ai/nano-banana-2/edit` $0.08; rooms = $0 crops of the skinned panos via `panos_dir`), `stages/video.mjs:1-14` (`fal-ai/ltx-2.3-quality/render-to-real`, 0.0024075 USD/MP), `assemble.mjs` (ffmpeg) | **Auto**, spend-gated, cached | **fal** (above). Rooms depend on pano skins from step 7, which are hand-made. | `video` stops at ~6 s per clip at 720p (render-to-real cap, `shots.mjs:304`). |
| 9 | Exterior flyover film | Hand: `Habait/flyover/orbit/orbit_clay.py`, `equirect/path.json`, `kaggle/push_pull.py`, `run_kling.sh`+`kling_args.json`; engine `video/kling_v2v.py:39` (`kling/v4/video-to-video/edit`) | **Hand** (constants of Rainbow in code: RING_R 228, RING_Z 90...) | **fal** Kling v4 v2v ≈ $0.19/s at 720p | Track 2 owns this (§3 overlap). Engine stage `video` wraps Kling per segment with cache (`cli.py` REGISTRY) but needs a hand-written `video/segments.json`. |
| 10 | tour360 build | `tour360/tools/build-tour.mjs` (header :1-10; `--engine`, `--full`, `--catalog`), make-refs/make-scenes/make-sets/smoke; `360walkaround/pipeline/assemble_tour.mjs` | **Hand recipe** (`tour360/README.md` "Add an apartment") | none | Output `tour360/dist/<id>/` is gitignored (`tour360/.gitignore:2`). No generator from engine output → `apartments/<id>/`. |
| 11 | Platform pages + ZIP | Engine `stages/export.py` → `platform/tools/build_zip.mjs` (:1-12, reads `fixtures/<p>/{project,units}.json` + `tour360/apartments/apt<unit>`); `platform/tools/build_segments.mjs` (flow.real.json); `platform/build_units.mjs` (CSV/Sheet → status/price) | `export` **auto** but only for a project that has a platform fixture; for a new project id: "N/A no platform project" (gap doc dry-run B). `build_segments`, `build_units` hand-run | none | Platform fixtures `platform/fixtures/rainbow/{project,units,flow*.json}` were hand-authored; `platform/projects.json` is a 75-byte list. |
| 12 | Deploy staging | `C:\RnD\Projects\Habait\tools\deploy-vercel\stage_flow.py:1-14` (copies platform minus excluded files, `_local/dist/<p>/<u>` media, rewrites hold URL) → `vercel deploy --prod` | **Hand**; `rainbow`/`846` hard-coded; prod deploy = Eliran's own go (root §9) | none | Live: `habait-flow.vercel.app`. |
| 13 | Developer-side agent | `studio/lib/chat.mjs`, `POST /api/projects/:id/chat` (`server.mjs:14`) | **Auto** (local) | **fal** same endpoint, `max_tokens` 1200, grounded on project data | Local only; no host, no auth (plan out-of-scope list). |

### Done by hand for apt846 (plainly)
1. `plan.general.json` traced by hand (and its ground-truth twin) — not the intake output.
2. `rainbow-846.project.json` and the 11 "stacked-approx" neighbouring units written/invented by sessions.
3. Plot fit, north (304.4), tower mass, `site.glb`.
4. Camera points, `prompts.src.mjs`, material board, every `gen-pano.mjs` call (11 panos), seam/door fixes.
5. All flyover clay, Kaggle equirect runs, Kling v2v prompts/refs, ring/arc/descent selection, ORB tracking check.
6. tour360 `build-tour`, `stage_flow.py`, Vercel deploy, QA.
Auto and real: Studio upload+intake+chat, engine intake/plan/building/export for one unit, `build_zip`, ledgers and stamps.

## 2. The gap to "upload any developer file -> the platform generates apartment + surroundings automatically"

Size: S ≤ half agent-day, M 1-2 days, L 3-5 days (card 37 convention). Risk: tech = may not work, cost = paid, legal = disclosure/liability (Eliran's call, root §6).

| # | Missing capability | Size | Risk |
|---|---|---|---|
| G1 | **One orchestrator.** Studio and engine are two pipelines with no shared project format. Decide a single source of truth (project.json) and a single runner; Studio calls engine stages or vice versa. | L | tech: high (design, touches everything); risk of a third pipeline |
| G2 | **Developer-file classifier + router** — any upload (PDF plan, brochure, price list, DWG/DXF, IFC, images, XLSX) → type → reader. Today: PDF/images only; vector/DXF/IFC readers exist as scripts, not wired; no XLSX/price-list reader. | M | tech: medium; DWG needs ODA converter (install = Eliran) |
| G3 | **Facts extraction → `project.json`** (developer, project, floors, units table, prices, types) by a frontier model with a confirmation form. Intake.json is not project.json; Rainbow's project.json is hand-made. | M | tech: med; liability: prices/areas shown to buyers → human confirm |
| G4 | **Plan → trusted geometry without a hand trace.** Raster tracer FAILs the gate on 846; vector path partial; needs per-type human approval on the correct screen (A2) wired as a queue stop, or a better fal-VLM trace. | L | tech: high (the biggest unknown); this is the quality ceiling |
| G5 | **Surroundings: engine `site` stage** (geocode/OSM/GIS fit → north → tower mass → `site.glb` + nodes) without Rainbow scripts. Studio site stage covers OSM only; tower mass/plot fit/north were manual. | L | tech: med; north error is silent (needs a negative control); data licence |
| G6 | **Interior skin backend** (clay pano + material board + refs → fal image model → seam/openings gates), generic and per apartment type. Engine `skin` is a not-wired template; `gen-pano.mjs` is hand-fed. | L | cost: ≈ $26/type at $2.40 per pano (gap doc); legal: add-only + AI badge (root §6); tech: seam/door gates |
| G7 | **Exterior film generator** from site + units (flight path, clay, fal v2v). Track 2's core; here only the *contract* (inputs from site/units, outputs a manifest). | L | cost ≈ $0.19/s; tech: Kling ring failure shows world drift |
| G8 | **tour360 generator from engine output** (`camera_points`→cameras.json, `openings`→scenes.json, apartment.json) + build + smoke. | M | tech: low-med; track 3 overlap |
| G9 | **Platform project generator:** a new project id → `platform/fixtures/<id>/{project,units,flow}.json` (+ projects.json). Today export is N/A for any non-Rainbow id. | M | tech: low |
| G10 | **Job queue + durable state + progress:** run stages in the background with stops ("waiting for your approval of plan / $X"), resumable. Studio has SSE per run, no queue; exit codes 3/4 are the only "wait" signal. | M | tech: low-med |
| G11 | **Spend gate as a product flow:** estimate → approve in UI → ledger → hard cap (today: env vars + chat). A single ledger across Studio (`studio/_local/projects/<id>/ledger.json`), engine (`ledger.json`), tour360 (`apartments/<id>/_local/ledger.json`). | S-M | cost: apt846 already $129.74 vs $120 cap |
| G12 | **Auth, multi-tenant storage and hosting** for the developer portal (today local `127.0.0.1:8820`, no login, no hosting for Blender/Python). Studio runs only on the laptop. | L | cost + tech; a hosted server holding `FAL_KEY` is a new secret surface |
| G13 | **Generic publish** (staging + legal gate `legal.publish_allowed` + developer consent) instead of `stage_flow.py` with `rainbow`/`846`. Deploy stays Eliran's own go. | M | legal: high |
| G14 | **Gates in the loop:** automatic QA per output (facade, kf_check, seam, ORB track, openings) feeding `qa.html`, not by a reviewer session. | M | tech: med |
| G15 | **Fresh-checkout reproducibility:** `media-pull` is only named in `.gitignore:6-7,15-17`; no script exists (`HW/scripts/` has only `cut/`). Large inputs (`_local/`, `tour360/dist`, floorplan.webp, flyover renders) are not reachable from git. | S | ops |

## 3. Proposed sub-features (candidate worktrees)

Env vars are NAMES only. Every worktree off `main` holds tracked files only (935 tracked files); never copy a `.env`.
**What any fresh worktree needs:** `.env` is ignored (`.gitignore:3`) → set `HABAIT_DOTENV=<path to main checkout's .env>` (supported by `studio/lib/env.mjs`, studio plan step 1) rather than copying it; Studio and platform `npm ci` (`studio` deps: `@anthropic-ai/sdk`, `zod`; `platform`: `three` 0.170.0; `tour360/engine` has its own package.json); Python venv and Blender are OUTSIDE the repo (`C:\RnD\Projects\Habait\tools\habait-venv`, `tools\blender-4.5.10`, found by absolute candidate list in `studio/lib/env.mjs`, env `HABAIT_PY`, `BLENDER`); `HABAIT_APP_DIR` (sharp, `tools\appdeps`) for `build_zip.mjs`. Env var names used across the track: `FAL_KEY`, `ANTHROPIC_API_KEY`, `MYARCHITECTAI_API_KEY`, `HABAIT_ALLOW_SPEND`, `HABAIT_CAP_USD`, `HABAIT_FAL_LLM_MODEL`, `HABAIT_FAL_BASE` (mock server), `HABAIT_LLM_BACKEND`, `HABAIT_MOCK_LLM`, `HABAIT_BLENDER_OK`, `HABAIT_PLATFORM_PROJECT`, `HABAIT_MASS_TOOL`, `HABAIT_LEGAL_DIR`, `HABAIT_UNITS_JSON`, `HABAIT_DOTENV`, `BLENDER`, `FFMPEG`, `CHROME_PATH`, `PLAYWRIGHT_CORE`, `PORT`. All spend defaults off.
**Untracked media a worktree will NOT have** (check `git check-ignore`): `Habait/*/_local/` (studio 8 GB, engine 963 MB, platform 105 MB), `tour360/dist/`, `tour360/apartments/*/_local/`, both `plan/floorplan.webp`, `flyover/renders*`, `flyover/orbit`, `flyover/skins-extra`, `platform/test/shots`. Tracked and therefore present: apt846 `panos/balanced/*.webp` (11), `platform/fixtures/rainbow/*` (videos and node PNGs), the 846 PDF (`דירה 846- 16.pdf`), `studio/fixtures/apt846.intake.json`, `tour360/apartments/apt846/plan.general.json`, `360walkaround/tours/apt846*/plan.json`. `media-pull` does not exist as a script (G15): copy ignored media by hand from the main checkout, or accept "works from tracked files + fixtures only". Tests that need no media: `studio/test/run.mjs`, `studio/test/llm-fal.test.mjs` (mock fal server), `platform` `npm test`, engine `validate_project.py`, `cli.py ... --dry-run`.

### T1-A `intake-router` — any file in, classified and read
- **Goal:** classify each upload (plan PDF vector/raster, DWG/DXF, IFC, brochure, price list XLSX/CSV, renders, photos, notes) and route to the right reader; fal vision model reads brochures/price lists into structured JSON (extends `IntakeSchema`).
- **Owns:** `Habait/studio/lib/{llm,fal-llm}.mjs`, `studio/pipeline/stages/intake.mjs`, new `studio/lib/classify.mjs`, `studio/test/llm-fal.test.mjs`; `Habait/engine/intake/**` (wiring vector/dwg/ifc as a CLI stage, `engine/stages/intake.py`).
- **Shares (conflict risk):** `studio/server.mjs` (upload API; T1-D, T1-E also edit; medium), `engine/stages/common.py`/`__init__.py` REGISTRY (T1-B, T1-C; medium), `lib/chat.mjs` (reads intake shape).
- **Depends on:** nothing. **Needs:** `npm ci` in studio, `HABAIT_DOTENV`, `HABAIT_FAL_BASE` mock for $0 tests; Python venv for `intake_*.py`; the tracked 846 PDF and synthetic `intake/fixtures/sample.dxf/.ifc`.
- **Overlap:** none with tracks 2/3.

### T1-B `project-spec` — facts to `project.json` and platform fixture generator
- **Goal:** intake → `project.json` (confirm form), and `project.json` → `platform/fixtures/<id>/{project,units,flow}.json` + `projects.json` (closes G3, G9, part of G1's data model).
- **Owns:** `Habait/engine/schema/`, `validate_project.py`, `engine/stack_units.py`, `engine/fixtures/*`, `engine/stages/export.py`, `platform/contracts/`, `platform/build_units.mjs`, `platform/projects.json`, new `studio/pipeline/stages/project.mjs`.
- **Shares:** `platform/fixtures/rainbow/*` (tracked, hand-made; track 2 also edits `flow*.json` segments — HIGH), `engine/stages/common.py`, `studio/server.mjs`.
- **Depends on:** T1-A output shape (can start with the current IntakeSchema). **Needs:** `npm ci` platform, `node contracts/validate.mjs`; no media.
- **Overlap:** track 2 (`flow.real.json` segments belong to the film), track 3 (`tour_id` mapping unit→tour).

### T1-C `site-surroundings` — the surroundings simulation inputs
- **Goal:** generic engine `site` stage: geocode/OSM/GIS → plot fit → north (with a negative control, wrong north must fail) → tower mass (`building.py --plain-mass` or from floor key) → `site.glb` + node list; contract output for the film (track 2).
- **Owns:** `studio/pipeline/stages/site.mjs`, `studio/tools/export_site_glb.py`, `engine/building.py`, new `engine/stages/site.py`, `engine/gates/facade_gate.py`.
- **Shares:** `engine/stages/common.py` (REGISTRY), `Habait/flyover/**` consumes site.glb (track 2), `tools/bench/site846/*` lives OUTSIDE the repo (Rainbow-only scripts; not in the worktree).
- **Depends on:** nothing for OSM; G4 for the floor-key. **Needs:** network (Nominatim/Overpass) for live; fixtures for $0; Blender (`BLENDER`, `HABAIT_BLENDER_OK=1`) only for glb export; `_local` studio project data NOT present in a worktree.
- **Overlap:** **track 2 (bird's-eye film) is the main consumer: agree the `site.json`/`site.glb` contract first.**

### T1-D `plan-to-geometry` — plan reading quality and the human gate
- **Goal:** raise raster/vector plan tracing to a gate-passing draft; make the correct screen (A2) a queue stop with "approve plan" wired to the pipeline (G4, part of G10).
- **Owns:** `engine/intake/tracer_cv.py`, `vlm.py`, `vlm_prompt.md`, `assign_prompt.md`, `engine/correct/**`, `engine/gates/plan_gate.py`, `360walkaround/pipeline/plan_general.py`, `validate-plan*.mjs`, `studio/pipeline/stages/plan.mjs`.
- **Shares:** `360walkaround/pipeline/*` (track 3 owns the renderer; **schema must not be reshaped**, `SCHEMA.md`), `studio/server.mjs` (`approve-plan`), `engine/gates/` fixtures.
- **Depends on:** T1-A for a routed vector file (optional). **Needs:** Python venv (OpenCV, pymupdf), tracked 846 PDF and 846 ground truth `360walkaround/tours/apt846/plan.json`; a fal VLM swap would need `FAL_KEY` and a cap.
- **Overlap:** track 3 (the plan is the room geometry).

### T1-E `skin-backend` — fal interior generation, generic
- **Goal:** wire engine `skin`: clay pano + material board + refs → fal (Nano Banana / GPT Image) → seam/openings/kf_check gates, per apartment type, ledgered; replace hand-fed `gen-pano.mjs` prompts with a generated `prompts.json`.
- **Owns:** `engine/stages/paid.py`, `tour360/tools/gen-pano.mjs`, `file-ledger.mjs`, `make-*prompts*.mjs`, `skin-seam.mjs`, `studio/pipeline/stages/keyframes.mjs`.
- **Shares:** `tour360/apartments/<id>/` data (track 3 owns the tour); `360walkaround/pipeline/place_cameras.py`; ledger format.
- **Depends on:** T1-D (a plan), T1-F (one ledger, optional). **Needs:** `FAL_KEY`, `HABAIT_ALLOW_SPEND`, `HABAIT_CAP_USD`; for tests `HABAIT_FAL_BASE` mock; a real run needs the apt846 clay panos (untracked `_local`) and ≈ $2.40/pano.
- **Overlap:** **track 3 (apartment rooms) heavily; coordinate the pano naming (`cp-*` vs `NN-room`).**

### T1-F `jobs-and-spend` — queue, one ledger, approvals
- **Goal:** background job runner with resumable stages, stops ("waiting for your approval: plan / $X"), a single ledger across Studio/engine/tour360, spend approval UI (G10, G11).
- **Owns:** `studio/pipeline/index.mjs`, `studio/lib/projects.mjs`, `engine/stages/common.py` ledger bits, `studio/dashboard/**`, `studio/styles/`.
- **Shares:** `studio/server.mjs` (high), `engine/cli.py`, ledger file formats (read by every other sub-feature).
- **Depends on:** T1-G decides the target orchestrator first. **Needs:** `npm ci` studio; tests are $0.
- **Overlap:** `platform/css` tokens (platform-ui-ux board) for dashboard look.

### T1-G `one-pipeline` — unify Studio and engine (design first)
- **Goal:** decide and implement the single runner and project format; a thin Node↔Python bridge or port. Start with an ADR and a stage-compat table, then code. Best done first or alone: it moves what A-F depend on.
- **Owns:** `studio/pipeline/**` and `engine/cli.py` + `engine/stages/__init__.py`, `engine/README.md`, a plan file in `C:\RnD\development\plans\`.
- **Shares:** everything above (very high conflict).
- **Depends on:** nothing; **others depend on it** — Eliran's ruling needed (Q1).

### T1-H `publish-generic` — export, staging, legal gate
- **Goal:** replace `stage_flow.py`/`stage_platform.py` constants with a project-driven stager, the `legal.publish_allowed` gate, developer-consent check, and a $0 `check` step (headless Chrome paint proof). Deploy itself stays Eliran's `!` command.
- **Owns:** `C:\RnD\Projects\Habait\tools\deploy-vercel\**` (outside the product repo; not a git worktree concern — a `.wt` working folder per root §8.7), `platform/tools/build_zip.mjs`, `build_segments.mjs`.
- **Shares:** `platform/fixtures/*`, `platform/apartment.html/js` (platform-ui-ux board).
- **Depends on:** T1-B. **Needs:** `HABAIT_LEGAL_DIR` (legal files live at `C:\RnD\Projects\Habait\data\sales-plans\legal`, outside the repo), `HABAIT_APP_DIR`, `CHROME_PATH`.

Suggested order: G (decision) → A, B in parallel → C, D in parallel → F → E → H. A and C, D can start now independently.

### Overlap summary
- **Track 2 (bird's-eye film, `Habait/flyover`):** consumes T1-C output (`site.glb`, nodes, units boxes) and shares `platform/fixtures/*/flow*.json`, `platform/tools/build_segments.mjs`, `engine/stages/video.py`, `engine/video/kling_v2v.py`. Keep the film generator inside track 2; track 1 only supplies the contract.
- **Track 3 (apartment rooms, `Habait/tour360`, `360walkaround`):** T1-E, T1-D touch `tour360/tools/*`, `360walkaround/pipeline/*`, `tour360/apartments/<id>`. `plan.json` SCHEMA must not be reshaped. Make `tour360/tools` the sole writer of apartments/<id> unless T1-E agrees changes.

## 4. Open questions only Eliran can decide
1. **One pipeline:** is the Studio (Node) or the engine (Python, stamps, gates) the spine? (blocks T1-G, T1-F)
2. **Which developer first / which file types are the promise?** PDF plan + brochure only? DWG/DXF/IFC (DWG needs the ODA File Converter, an install = Eliran)? Price-list XLSX? Today only PDF/images work end to end.
3. **Who approves the plan?** A human step per apartment type (the A2 screen; today mandatory because the tracer FAILs 846) is acceptable, or must the platform be zero-touch (needs a stronger, paid fal VLM, G4)?
4. **Cost envelope per project:** the gap doc estimates $130-230 per 12-unit project; apt846 alone reached $129.74 vs a $120 cap. Per-type finish ($26 at $2.40/pano), per-video ($10 soft / $20 hard, D-VID-2). Which model tier for the intake LLM (default `anthropic/claude-sonnet-5.5` on fal vs Opus)? Which interior image model (GPT Image 2.5 $2.40 vs Nano Banana Pro $0.15 vs Seedream 4.5 $0.04)?
5. **Hosting:** stays a local Studio (laptop, Blender, Python) or becomes a hosted portal (auth, storage, GPU rental)? That decides G12 and where `FAL_KEY` lives (a hosted key = new secret surface).
6. **Legal/disclosure for generated surroundings and interiors** (root §6: AI badge, add-only, developer consent, `legal.publish_allowed`) — wording is Eliran's. Does the developer get to see/approve before the buyer?
7. **Invented neighbouring units** (11 "stacked-approx" Rainbow units): keep as demo, label, or replace with a real units table before any new developer?
8. **Key rotation:** `FAL_KEY`/`MYARCHITECTAI_API_KEY` kept by Eliran's ruling (2026-11-04); every worktree reads them by name via `HABAIT_DOTENV` — confirm that is acceptable for parallel worktrees spending at once (one shared cap?).
9. **media-pull:** should a real script restore ignored media for fresh worktrees (G15), and from where (shared drive named in `.gitignore:6`)?

## Verification notes
- Read, not run: no process started, no network, no `.env` opened (env var names taken from `grep` of source `process.env`/`os.environ` only).
- `git -C HW ls-files` count 935; `git status` shows 1 modified file (`CLAUDE.md`).
- Not verified: `studio/server.mjs` upload size limits and whether the live Studio dashboard works after `zod` install (platform-ui-ux plan says it did not start); engine unit tests not run.
