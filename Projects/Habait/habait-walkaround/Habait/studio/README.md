# Habait Studio — sales plan + developer material in, per-room visualization videos out
<!-- created 2026-11-01 -->

A dashboard and a FIXED pipeline. You drop a developer's sales plan (PDF), renders, photos and notes into a
project; an LLM reads all of it into one structured `intake.json`; nine deterministic stages turn that into a
Blender scene, a camera path (exterior flyover → facade → the terrace door → every room), clay renders,
style keyframes, photoreal clips (fal.ai render-to-real) and a master video. Geometry always comes from the
traced plan (D-WQ-10/17); generative models only paint. Every paid call is gated and ledgered.

```
Habait/studio/
  server.mjs            the dashboard host + API (Node 24, zero deps beyond the Anthropic SDK + zod)
  cli.mjs               the same pipeline headless: new / add / run / show / list
  dashboard/            index.html · app.js · style.css (Hebrew, RTL)
  lib/env.mjs           paths + secrets BY NAME from the repo-root .env (FAL_KEY, ANTHROPIC_API_KEY, BLENDER, …)
  lib/projects.mjs      one folder per project under _local/projects/<id>/ (gitignored)
  pipeline/index.mjs    the stage order and the runner (stops at the first blocked stage)
  pipeline/stages/      intake · site · plan · shots · scene · clay · keyframes · video · assemble
  tools/                render_shots.py (Blender) · pano_crop.py · fal_video.py · fal_image.py · prep_image.py
  styles/presets.json   8 visual styles with camera grammar, grade, palette and prompt fragments
  fixtures/             apt846.intake.json — the mock intake used when no LLM key is present
  test/run.mjs          node test/run.mjs (13 checks)
```

## Run

```bash
cd Habait/studio && npm install          # once: @anthropic-ai/sdk, zod
node server.mjs                          # http://127.0.0.1:8820/
node test/run.mjs
```

Headless:

```bash
node cli.mjs new "apt846 Rainbow TLV" --latlon 32.1147,34.7821 --fixture apt846 \
  --panos Habait/tour360/apartments/apt846/panos/balanced --file "../../דירה 846- 16.pdf" --file ../tour360/apartments/apt846/plan.general.json
node cli.mjs run apt846-rainbow-tlv                       # all stages
node cli.mjs run apt846-rainbow-tlv clay --clay-res 320x180 --clay-samples 8 --max-frames 3   # a smoke render
node cli.mjs run apt846-rainbow-tlv video,assemble --force
```

## Environment (root `.env`, names only)

| Name | Purpose | Default |
|---|---|---|
| `ANTHROPIC_API_KEY` | the intake / plan-draft LLM through the API (`claude-opus-5-5`, structured outputs) | missing → **the Claude Code CLI under Eliran's subscription** (`claude -p`, `lib/llm.mjs`) when `claude` is on PATH; else mock mode from `fixtures/<fixture>.intake.json` |
| `HABAIT_CLI_MODEL` | the model alias passed to `claude -p --model` | `sonnet` (the CLI fails here without an explicit model) |
| `HABAIT_LLM_MODEL` | override the model | `claude-opus-5-5` |
| `FAL_KEY` | render-to-real video, image edits | missing → dry runs |
| `HABAIT_ALLOW_SPEND` | `1` lets paid calls run | `0` (every paid stage records an estimate and skips) |
| `HABAIT_CAP_USD` | per-project ledger cap | `10` |
| `BLENDER` | Blender 4.5 executable | the portable install under `C:\RnD\Projects\Habait\tools`, else Program Files |
| `HABAIT_PY` | the Python venv with numpy / Pillow / fal_client / requests | `C:\RnD\Projects\Habait\tools\habait-venv\Scripts\python.exe` |
| `HABAIT_PORT`, `HABAIT_PROJECTS_DIR` | server port, project root | `8820`, `_local/projects` |

## The stages and their contracts

| # | Stage | Reads | Writes | Paid? |
|---|---|---|---|---|
| 1 | intake | `intake/*` (PDF as document blocks, images as image blocks, text inline) | `derived/intake.json` (IntakeSchema: developer, project, building, unit, drawing incl. north, rooms, images, uncertainties, confidence) | LLM |
| 2 | site | intake, project latlon/address | `derived/site.json` (origin, north_deg, floor, floors, OSM buildings/coast/roads in local metres, tower footprint slot) | no (Nominatim + Overpass) |
| 3 | plan | an uploaded `plan.json` / `plan.general.json` → the repo validator; else an LLM draft held for review | `derived/plan.json` or `plan.draft.json` | LLM (draft only) |
| 4 | shots | plan (+ site) | `derived/shots.json`: ext-approach, ext-facade, ext-enter (through the terrace door), room-<cp> × N | no |
| 5 | scene | plan | `renders/scene.blend` via `360walkaround/pipeline/build_scene.py` | no |
| 6 | clay | scene, shots, site, tower-footprint.json (optional) | `renders/clay/<shot>/clay.mp4 + first.png` via `tools/render_shots.py` (tower mass + OSM neighbours + ground added at render time) | no (CPU here) |
| 7 | keyframes | clay, panos_dir | `renders/keyframes/<shot>.png`: rooms = crops of the skinned panos; exterior = fal image edit or clay | fal (exterior only) |
| 8 | video | clay, keyframes, style | `renders/video/<shot>.mp4` via `fal-ai/ltx-2.3-quality/render-to-real` (0.0024075 USD/MP) | fal |
| 9 | assemble | clay/video | `outputs/clips/<shot>.mp4`, `outputs/master.mp4`, `outputs/tour.json` (photoreal where it exists, else the clay draft) | no (ffmpeg) |

A `tower-footprint.json` with `polygon_cm` (plan frame) in `derived/` replaces the default tower mass (the unit's hull + 1 m).

## Known limits (2026-11-01)
- The LLM plan draft is schematic; a human trace to `plan.json` is still the rule (D-WQ-16).
- Clay on this laptop is CPU Cycles (15–25 s per 720p frame measured by the sibling session); render full shot lists on a GPU box.
- The exterior tower is a massing assumption until the floor key is traced or the architect's DWG arrives.
- Developer branding and marketing references stay out of generated frames until the developer consents (D-WQ-18).
