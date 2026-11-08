# Projects/Habait/ — the Habait project's context file
<!-- last-updated: 2026-11-04 -->

> Copied from `C:\Habait` on 2026-11-03 (board `C:\RnD\development\tasks\copy-habait-2026-11-03`); paths re-pointed to `C:\RnD\Projects\Habait`, see `REPOINTED.md`. The root harness card `C:\RnD\CLAUDE.md` applies above this file. `C:\Habait` is archived after cut-over.

> **Git — local only (Eliran, 2026-11-04; replaces the 2026-11-03 "no git").** **One repo:** since 2026-11-04 this folder is tracked by `C:\RnD`'s git (commit `de560da`); `habait-walkaround` has no `.git` of its own (archived at `C:\Habait-git-archive-2026-11-04`). **A new feature = a git worktree off `main`**: `git -C C:/RnD worktree add C:/RnD/.wt/<feature> -b <feature>`, on its own branch, merged into `main` when done (root `CLAUDE.md` §8.7, procedure in `C:\RnD\.wt\CLAUDE.md`). ⛔ Never push: `origin` is the previous owner's GitHub.
> Older "no git" lines in `memory.md`, `SESSIONS.md`, `docs/_memory_preamble.txt`, `.claude/agents/` and the board files are history. `C:\Habait` was archived on 2026-11-03 as `C:\Habait-archive-2026-11-03` (frozen; never read keys from it, never write there).

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

The user is **Eliran** (writes in Hebrew; answer in the language he writes in — main session on Eliran's delegation, 2026-11-03, OWED-015).

## Memory protocol (2026-11-03 — replaces the 2026-11-02 rule; main session on Eliran's delegation, plan `C:\RnD\development\plans\2026-11-03-harness-focus.md`, OWED-014)

**The department memory `C:\RnD\memory\` binds every Habait session** (root `CLAUDE.md` §0). `C:\RnD\Projects\Habait\memory.md` (200 KB, Hebrew) is frozen reference as of 2026-11-03.

- **At the start of every session:** read this file, then `C:\RnD\memory\HOT.md`, then `C:\RnD\Projects\Habait\SESSIONS.md`. Never read `memory.md` whole: grep it for the topic at hand (a heading or a term) and read only that section.
- **At the end of every task, and whenever something worth remembering happens** (a decision by Eliran, a pivot, a verdict on a model or an approach, a new upload in `C:\RnD\Projects\Habait`): one entry in the department layer that owns it (`C:\RnD\memory\project\` for product facts, decisions and verdicts; `runs\` for a board close) plus its `INDEX.md` line (root §0.2). `memory.md` is no longer written. Session open/close stays a row edit in `SESSIONS.md`.

## Before any task

1. **Read `C:\RnD\memory\HOT.md` and `C:\RnD\Projects\Habait\SESSIONS.md` first.** `SESSIONS.md` is the single source of truth for which Claude session owns which paths, what is in progress, and the money ledgers. Several sessions share one working tree. Do not edit paths owned by another session; message that session (`SendMessage`) instead. Update only your own row, with `Edit`, never by rewriting the file.
2. **Paid calls** (fal.ai, OpenAI/GPT Image, Anthropic API) are gated and ledgered. Every ledger (`ledger*.json`) has one owner and a cap. Eliran's approval is valid only in the chat where it was given. Run `C:\RnD\Projects\Habait\tools\bench\kf_check.py` on a keyframe before spending on it.
3. **Feature work is committed on its worktree branch under `C:\RnD\.wt\`** and merged into `main` when done (root §8.7). On `main` itself: no `checkout / stash / reset / clean` and no direct commit without Eliran's explicit request. Never push.
4. **Console codepage is cp1255** → set `PYTHONIOENCODING=utf-8` before any Python.
5. **Blender = CPU only** here (Intel Iris Xe, no CUDA/oneAPI). Only one session runs Blender at a time (see SESSIONS.md rule 4). Full-quality renders are a rented-GPU job.

## Layout of `C:\RnD\Projects\Habait`

| Path | What |
|---|---|
| `habait-walkaround/` | **The code repo** (git). A byte-for-byte "cut" from the lab repo `Slava12233/RealEstateTeam` at tag `walkaround/cut-2026-11-01`; `PROVENANCE.json` + `docs/rnd/HISTORY.md` record where every file came from (`node scripts/cut/verify-provenance.mjs`). |
| `habait-walkaround/.env` | Secrets by name (`FAL_KEY`, `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`, …). Gitignored. All tools read keys from here, never from arguments. |
| `tools/` | Local toolchain, documented in `tools/README.md`: portable Blender 4.5.10, the Python venv `habait-venv` (numpy, Pillow, cv2, shapely, ezdxf, pymupdf, fal_client, OpenEXR…), `appdeps/` (sharp + playwright-core for tour360 tools, via `HABAIT_APP_DIR`), `bench/` (the gates: `kf_check.py`, `openings_gate.py`, `fidelity_gate.py`, `render_to_real.py`), Ghidra/REA. |
| `research/` | Dated research folders with their own README (fal model bench, product research + work plan in Hebrew). Each belongs to one session. |
| `data/sales-plans/` | Developer sales-plan corpus (inputs, never generated). |
| `.claude/skills/plan-to-tasks` | Project skill: plan file → task files for an agent team. |

Hebrew-named files at the root (`Reengeneering for demo - ניתוח.md`, the PDF `דירה 846- 16.pdf`, the Facebook videos) are Eliran's uploads and references, not code. Check for new uploads at the root before starting a task.

## Environment setup (Git Bash)

```bash
export BLENDER="/c/RnD/Projects/Habait/tools/blender-4.5.10/blender-4.5.10-windows-x64/blender.exe"
export PYTHONIOENCODING=utf-8
export HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps        # sharp + playwright for skin-frame / openings-test / close-seam
PY=/c/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe     # the venv; the Studio reads it as HABAIT_PY
cd /c/RnD/Projects/Habait/habait-walkaround
```

Pipeline scripts default Blender to Program Files, which does not exist here: always pass `--blender "$BLENDER"` or export `BLENDER`. Wrap heavy runs in `timeout <s>` as the READMEs do; one heavy run at a time.

## The repo: four product lanes in `habait-walkaround/`

The product: a developer uploads a sales plan + renders → Habait produces visualizations (360° apartment tour, exterior flyover/360 nodes, clickable building). **Geometry always comes from the traced plan; generative models only paint** (D-WQ-10/17). Current pivot (2026-11-02): no video, an all-360 tour that starts outside.

### `360walkaround/` — deterministic Blender pipeline (plan.json → clay 360 panos)
No generative calls. `plan.json` (SCHEMA.md: **centimetres everywhere**, origin = outer NW corner, +y DOWN; depth PNGs decode to metres) → `build_scene.py` (headless Blender, furnishes a `geometry: "general"` plan via `general_furnish.py`) → `render_pano.py` (Cycles) → `tour.json`. Details and the schema contracts: `360walkaround/pipeline/CLAUDE.md`, `SCHEMA.md`, `GENERAL-POLYGONS.md`, `RENDER-LEDGER.md`.

```bash
node 360walkaround/pipeline/validate-plan.mjs <plan.json> [--json]            # exit 0 clean / 1 FAIL / 2 usage
node 360walkaround/pipeline/render_tour.mjs 360walkaround/tours/apt846 --mode draft --points cp-living --blender "$BLENDER"
node 360walkaround/pipeline/render_tour.mjs <tour-dir> --mode final --res WxH --samples N [--dry-run] [--scene <file.blend>]
"$BLENDER" -b --factory-startup -P 360walkaround/pipeline/probe/hello-render.py   # 3 s smoke
node 360walkaround/pipeline/assemble_tour.test.mjs
$PY 360walkaround/pipeline/general_furnish.py --selftest ; $PY 360walkaround/pipeline/plan_general.py --selftest
node 360walkaround/catalog/fetch.mjs --verify-only --blender "$BLENDER"        # the CC0 furniture catalog
```

### `Habait/tour360/` — the 360° apartment tour (generator + viewer, one folder per apartment)
`apartments/<id>/` (cameras.json, scenes.json, prompts.json, apartment.json, panos) → `tools/build-tour.mjs` → ONE self-contained `dist/<id>/index.html` (Pannellum, zero deps). AI panoramas via `tools/gen-pano.mjs` (GPT Image 2.5, ledgered, cached by input hash); skins over clay via `skin-frame.mjs` / `skin-seam.mjs` / `close-seam.mjs`; live typed changes via
`server/handler.mjs` + `tools/edit-server.mjs`. The full recipe, the catalog/point-to-replace wave and the proof kit: `Habait/tour360/README.md`; state, decisions and key-file table: `Habait/tour360/CLAUDE.md`; plans: `PLAN.md`, `WALKAROUND-PLAN.md`, `WALKAROUND-QUALITY-PLAN.md`.

```bash
timeout 540 node Habait/tour360/tools/build-tour.mjs <id> [--engine --full --catalog]
timeout 300 node Habait/tour360/tools/smoke.mjs <id>                            # the one eval of a built tour
node Habait/tour360/tools/make-refs.mjs <id> && node Habait/tour360/tools/make-scenes.mjs <id>
timeout 300 node Habait/tour360/tools/gen-pano.mjs <id> <scene> gpt25x --cap <usd>   # PAID
node Habait/tour360/tools/edit-server.mjs <id>                                  # laptop host, :8720
cd Habait/tour360/engine && npm ci && node test/run.mjs                        # the Photo Sphere Viewer engine (v0.1 adapter)
```

### `Habait/studio/` — dashboard + fixed 9-stage pipeline (intake → site → plan → shots → scene → clay → keyframes → video → assemble)
Node 24, deps: `@anthropic-ai/sdk`, `zod`. Projects live in `_local/projects/<id>/` (gitignored). Without `ANTHROPIC_API_KEY` the intake LLM falls back to the Claude Code CLI (`claude -p --model sonnet`, Eliran's subscription) and otherwise to `fixtures/<fixture>.intake.json`. Paid stages run only with `HABAIT_ALLOW_SPEND=1` under `HABAIT_CAP_USD`. Stage contracts and env table: `Habait/studio/README.md`.

```bash
cd Habait/studio && npm install && node server.mjs      # http://127.0.0.1:8820/
node test/run.mjs
node cli.mjs new "<name>" --latlon <lat,lon> --fixture apt846 --panos <dir> --file <pdf>
node cli.mjs run <project-id> [stage[,stage]] [--force] [--clay-res 320x180 --clay-samples 8 --max-frames 3]
```

### `Habait/engine/`, `Habait/platform/`, `Habait/flyover/` — the from-zero track (habait-1d; board `development/tasks/habait-workplan-2026-11-02`)
`engine/`: project.json → intake (vector PDF `intake/intake_pdf_vector.py` first; raster + VLM fallback; DXF/IFC) → correction screen A2 (`correct/serve.mjs`, :8870, needs a human) → `cli.py` (8 idempotent stages, ledger before/after every call, `qa.html`; scene/clay only with `HABAIT_BLENDER_OK=1` in the Blender owner's session; skin/video REFUSED (exit 3) without
`HABAIT_ALLOW_SPEND=1` + `HABAIT_CAP_USD`, and not wired (exit 4)) → `dist/<unit>/` via `platform/tools/build_zip.mjs`. Gates in `gates/`, live model bench in `bench/`. Docs: `engine/README.md`, `engine/docs/{add-a-project,swap-a-model,fresh-run-checklist}-he.md`.
`platform/`: buyer flow (`flow.html` flight → hold picker → apartment), `apartment.html` (5 tabs + ZIP), `landing.html` A/B, analytics + local JSONL sink, `contracts/`; `serve.mjs` on :8850. `flyover/`: segmented flight path (`equirect/`), Kaggle render farm (`kaggle/`), life layers, per-frame unit polygons (`hotspots/`), 72-frame availability turntable, `enter.py`, bake v5 (`renders/baked-v5/`); each folder has a `README-he.md`.

```bash
$PY Habait/engine/cli.py init Habait/engine/_local/<p> --from Habait/engine/fixtures/rainbow-846.project.json
$PY Habait/engine/cli.py run Habait/engine/_local/<p> --stage all --dry-run        # then --stage intake / plan,building / export
$PY -I Habait/engine/intake/intake_pdf_vector.py "<plan.pdf>" --out <dir> --apartment-id <unit>
node Habait/engine/correct/serve.mjs --plan <plan.json> --out Habait/engine/_local/<p>/plan/<unit>/corrected
$PY Habait/engine/bench/habait_bench.py <fal-endpoint> --tracks keyframe,flyover,pano --dry-run
cd Habait/platform && npm test && node tools/build_zip.mjs fixtures/rainbow 846 --out _local/dist/rainbow/846
```

## Conventions that cut across the repo

- `_local/` anywhere = gitignored machine-local data (masters, ledgers, turns, projects, refs). Tracked panorama sets are `balanced` and `thumb` only, ≤ 10 MB per apartment.
- Evidence reports stay tracked; evidence images (`qa-evidence/**/*.png|jpg|mp4`) do not.
- Decisions are numbered (`D-T360-n`, `D-CAT-n`, `D-WQ-n`) and live in the plan files; cite them rather than re-deciding.
- Shared schemas (`plan.json`, the platform contracts) may be EXTENDED by their owner, never reshaped silently.
- Models of record: GPT Image 2.5 (`openai/gpt-image-2.5/sunburst/edit`) for keyframes and panos; Seedream 5 Pro cheaper for pano restyle but breaks the 360 seam; Kling 4.0 for flyover video (currently parked). The dated benchmark: `research/fal-bench-2026-11-02/README.md`.
- Developer branding/marketing references stay out of generated frames until the developer consents (D-WQ-18).
