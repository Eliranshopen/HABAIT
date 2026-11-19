# 360walkaround/pipeline/ — the deterministic Blender/Cycles plan → pano pipeline (V2)
<!-- last-updated: 2026-11-04 -->

> ⚠ **This machine (2026-11-03):** per `C:\RnD\Projects\Habait\CLAUDE.md` this laptop renders on CPU only, with the portable Blender 4.5.10 under `C:\RnD\Projects\Habait\tools\`. `ENV.md`\'s RTX A2000 figures describe the old lab machine. `../app/`, `../CONTRACT.md` and `../V2-PLAN.md` stayed in the lab and are not here. Git: the one repo `C:\RnD` (root `CLAUDE.md` §8.7).

## What's here
Board `360-v2`'s answer to "build GetFloorPlan, then beat it": a **deterministic** render pipeline that
turns a traced vector floor plan into an 8K-equirect 360° tour **without a single generative image
call**. The chain is `plan.json` → a headless Blender scene → rule-placed furniture → Cycles panos +
packed-depth → `tour.json`, which the **same V1 viewer** (`../app/`) consumes. V1's generative edit
pipeline (`../server/`) is untouched and still ships — these are two parallel pipelines, not a
migration. Governed by `../CONTRACT.md` §16 (C-360-79…85) and `../V2-PLAN.md` §5; owned by the
`render-pipeline-engineer` agent, minted 2026-09-01 for exactly this tree.

## Key files
| File | Purpose |
|---|---|
| `SCHEMA.md` | **NORMATIVE — `plan.json` v0.1.0**, one of the four shared file contracts (C-360-81). ⛔ **Units are part of the shape:** `plan.json` is **centimetres everywhere**, angles degrees, `area_m2` the one named exception; depth PNGs decode to **metres** — a different file, a different unit, and the two never mix. Origin `(0,0)` = the outer NW corner, `+y` grows DOWN (raster convention, so plan and source JPEG sit side by side with no sign flip) — ⚠ **a left-handed 2-D frame** a Z-up 3-D consumer must flip. May be EXTENDED by its owner; ⛔ **never RESHAPED** silently |
| `validate-plan.mjs` | SCHEMA's **enforcement point** — zero deps, Node ≥ 20, `exit 0` clean / `1` any FAIL / `2` usage. Its RED mutant is "rename one required field in a fixture" |
| `build_scene.py` | `plan.json` → a Blender scene, headless and deterministic (1,673 lines). v1 builds the WHOLE apartment: every wall once (no z-fighting, no per-room filtering), every door/window boolean cut through the REAL neighbouring geometry, floor+ceiling per room … (Notes) |
| `general_furnish.py` | v0.1.0 (2026-10-29, D-WQ-36) — the 2-D half of furnishing a general plan: `fixtures[]` → fitted catalog models or procedural assemblies, the plan's `furnishing` extension (hints, doors, pieces), derived pieces (chairs, nightstands, uppers, mirrors) dropped never moved, interior door leaves (swing/hinge/ajar rules) and the entrance-door dressing — pure Python, `--selftest`, the CLI prints every decision; record in `GENERAL-POLYGONS.md` §6c |
| `plan_general.py` | the 2-D half of the general-polygon branch (facings at the traced faces, door infills + cutters, pane-joint posts, door-in-glass frames, the floor/ceiling fill and its sky rule, luminaire points) — pure Python + numpy, `--selftest`; read its docstring before touching that branch |
| `GENERAL-POLYGONS.md` | Q01b/Q02's record: the schema delta the builder consumes (incl. the `fixtures[]` validator notes), eight render-found defects and their fixes (⭐ coplanar faces leak light in Cycles 4.x even with one material), the eleven 846 drafts, the Q05 finals and where the door frame is in sight, the openings-test visibility rule |
| `place_cameras.py` | the camera auto-placement RULE + the reconciler that writes `plan.json`'s `camera_points[]` — the ONE field this stage may generate (SCHEMA §7's "EXTEND the data, never reshape the schema"). Pure 2-D polygon geometry over `loop`/`bbox_cm`: **no Blender, no third-party deps**, so it runs in milliseconds under a plain `python3` and is testable without paying Blender's startup |
| `placement_templates.py` | deterministic, rule-driven furnishing — room polygon → placements (1,723 lines, T12). Same posture as `place_cameras.py`: pure Python, `build_scene.py` imports it under Blender, and a CLI at the bottom runs it standalone against `../catalog/style-habait-modern.json` with an explicit `--seed` |
| `materials_kit.py` | the PBR preset kit (wall/ceiling/skirting/metal/glass/fabric/floor) **plus the style palette**, which since v0.2 is **data read from `../catalog/style-habait-modern.json`**, not constants in this file |
| `render_pano.py` | the render stage: one `.blend` + camera points → equirect panos + their depth (1,606 lines, Blender 4.5.10 LTS). ⭐ **`--wrap-pad` (default 128)** exists because an equirect frame wraps left↔right while OpenImageDenoise and the WebP encoder are both 2-D operators that do not — the seam defect F-360-118. **v0.3.0 (2026-10-28):** an unroofed outdoor point's empty zenith is a NOTE, not a hole; a general plan skips `--top-view` (this re-keyed every pilot render, accepted, not re-rendered) |
| `render_tour.mjs` | the batch CLI — one command renders a whole apartment, **resumably** (`--mode draft\|final`, `--points`, `--force`). ⚠ `--mode final` ≈23 min PER POINT (ENV.md §5.1): run it point-chunked with `--points` under `timeout`, never as one blocking or sleep-polled call; `--mode draft` (~2 min/point) fits directly — root `CLAUDE.md` Machine resource rules |
| `assemble_tour.mjs` (+ `.test.mjs`) | `plan.json` + the render `manifest.json` ⇒ `tour.json`, with a machine-readable `--json` report |
| `dump_rgb.py` | decodes an image to a byte-exact raw RGB8 dump **through Blender's own loaders** — it exists because this machine has no ffmpeg and no sharp, and the seam instrument (`../scripts/g0-seam-poles.mjs`) needs a raw `W*H*3` buffer that no WebP reader here can produce |
| `ENV.md` | **the render environment of record** — machine, GPU (RTX A2000 Laptop, 4 GiB), driver, Blender build, measured not quoted. ⚠ Console codepage is cp1255, so **always `PYTHONIOENCODING=utf-8` before any Python here** |
| `RENDER-LEDGER.md` | **every render is logged, including the free ones** — a local render costs $0 and still gets a row (wall clock, peak VRAM, device, settings). Cloud lane: soft **$10** / hard **$15**, board-wide |

Notes (row overflow):
- `build_scene.py` (continued): (a balcony gets a floor and no ceiling — it is open to the sky, like a real uncovered one), and a terrain plane so a window ray has something plausible to hit. **v1.2 (2026-10-28, D-WQ-28):** a plan with `geometry: "general"` takes its own branch (polygon walls, facings, door infills, panes, a raster fill, `rooms[].roofed`,
  `plan_meta.ground_offset_cm`, `fixtures[]` as placeholder masses, no catalog furniture); the rectilinear path is dump-identical. **v1.3 (2026-10-29):** a door cut THROUGH a pane gets a frame in the wall material in the pane's own line (`general.door_glass_frames[]`) — a bare cut in transparent glass shows no edge, and the skin lane read 846's o-13 at 190 cm for 132. **v1.5
  (2026-10-29, D-WQ-36):** a general plan is FURNISHED with catalog models + procedural closets/showers + interior door assemblies, all decided by `general_furnish.py`; `--general-furnish off` = the v1.4 grey masses (the control); the pilot's dump is unchanged

## Subfolders
| Folder | Purpose |
|---|---|
| `probe/` | the determinism + scene probes (`check-determinism.py`, `dump_scene.py`, `hello-render.py`, `determinism/` verdicts, `probe-assets/` with its own `PROVENANCE.md` + `assets.lock.json` + `fetch-assets.py`, the idempotent CC0 fetcher — sha256-verifies before re-downloading) |
| `fixtures/` | the depth golden — `make-depth-golden.py` writes it, `check-depth-golden.mjs` checks it (`depth-golden-8x4.png/.json`) |

## Conventions / gotchas
- ⛔ **A rented machine gets its ledger row BEFORE it starts** — job, machine, $/h, hour cap, who
  authorised it. A cloud output whose hash appears in a `tours/*/manifest.json` with no row dated at or
  before its render is an **unledgered charge** and is reported as one (C-360-79). ⚠ That is a **gate
  check, not a code check** — a Markdown ledger is not a test and the file says so itself.
- ⭐ **Hash the DECODED data, not the container.** An identical re-render produces a different
  `.exr`/`.png`/`.webp` byte stream (Blender stamps `Date`/`RenderTime`; colour panos carry real
  Monte-Carlo differences). Only the depth map's *packed pixel bytes* are stable, and those are what
  `packed_data_sha256` hashes.
- **Rerun-skip keys on INPUT hashes only** (`plan.json` + the builder version + render settings) —
  never on an output byte stream, for the reason above.
- **The pure-Python modules are pure on purpose.** `place_cameras.py`, `placement_templates.py` and
  `materials_kit.py` import no Blender and no third-party package, so CI can assert them in
  milliseconds; only `build_scene.py` / `render_pano.py` / `dump_rgb.py` need Blender.
- ⚠ **`__pycache__/` is present on disk** — a build artifact, not a module.
- ⛔ **`build_scene.py` selects the environment HDRI by recorded identity, never by directory scan** —
  it reads the style lock's `surfaces.hdri` (`slug` + `sha256` + `exterior_class`) and refuses to build
  on a missing file, a hash mismatch, more than one candidate for the slug, or `exterior_class !=
  "non-locating"` (CONTRACT A9-7/A9-8, C-360-91). `catalog/style-habait-modern.json` is at **v1.3.0**
  (was v1.0.0 at T12) — its own `changelog` array is the record of what moved and why.

## Links
- Parent: [../CLAUDE.md](../CLAUDE.md) · Contract: [`../CONTRACT.md`](../CONTRACT.md) §16 · Plan: [`../V2-PLAN.md`](../V2-PLAN.md) §5 · Schema: [`SCHEMA.md`](SCHEMA.md) · Board: `development/tasks/360-v2/` · Memory: `memory/agents/render-pipeline-engineer.md`
