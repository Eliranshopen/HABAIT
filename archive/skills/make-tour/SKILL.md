---
name: make-tour
description: "Orchestrate the full Apartment Visualizer pipeline for one listing — staging, parallax animation, stitch, and the self-contained tour.html. Applies the routing rule (empty unit -> cinematic video, furnished/luxury -> 360/3D). Use when the user says 'make a tour for <listing>', 'build the tour', 'generate the walkthrough', or invokes /make-tour."
argument-hint: "<listing-id> [--video|--360|--3d]"
user-invocable: true
allowed-tools: Bash, Read, Edit
model: inherit
disable-model-invocation: true
---
> Explicit-invocation only since 2026-10-22 — D-AUD-29 (Q 6.1, DEC-054; B-06): dormant-track skill, D1 and D2 untouched, not an archive; invoke it by name (`/make-tour`); the flag is reversible and nothing is archived.

# Make Tour — the orchestrator

> **Build status:** WIRED (2026-05-30). The deterministic 2D-video path is proven end-to-end (`stage.py → animate.py → build_tour.py → build_page.py`; see `memory/runs/2026-05-30-flagship-pipeline-proven.md`). `depth.py` (true 2.5D parallax) is the pending upgrade — `animate.py` runs the Ken-Burns fallback until torch + Depth Anything 3 are installed. 360/3D paths are still deferred.

## Collective memory — read first, write last (CLAUDE.md §0)
Before acting: read `memory/INDEX.md` + `memory/listings/<id>.md` + `memory/project/local-environment.md` (env gotchas: ffmpeg via imageio-ffmpeg, AMD/no-CUDA, cp1252). After finishing: append a `deliverable` entry + INDEX line.

This skill turns the whole pipeline into one instruction: *"make a tour for `listings/seaview-42`"*. It encodes room ordering, the routing rule, where outputs land, and the disclosure guardrails — it does **not** reinvent them per run. All look-and-feel comes from the **locked** `style/style.yaml` + `style/reference/`.

## Proven commands (the wired flow)
```bash
# 0. preconditions: GEMINI_API_KEY in .env; photos in listings/<id>/inputs/; refs in style/reference/
set -a; source .env; set +a
python scripts/stage.py      --listing listings/<id>   # inputs -> staged (paid; manifest-gated, skips done rooms)
python scripts/animate.py    --listing listings/<id>   # staged -> clips (Ken-Burns push-in; parallax when depth/ exists)
python scripts/build_tour.py --listing listings/<id>   # clips  -> output/tour.mp4 (labels, locked room order)
python scripts/build_page.py --listing listings/<id> --agent-name "<brand>" --agent-contact "<contact>"
#                                                       # -> output/tour.html (self-contained: video + gallery + disclosure)
```
Each script is idempotent + manifest-gated, so a re-run skips completed work and never re-bills staging.
⚠ **Machine resource rules** (root `CLAUDE.md`; backed by the `test-guard` hook once it is installed per `.claude/hooks/README.md` — until then this line is the only rule): every test, build, server, browser or render command runs in Git Bash as `timeout N <cmd>` (tests 300 s, build/typecheck 540, servers/sweeps/renders 540 per chunk, 1800 once `BASH_MAX_TIMEOUT_MS` is raised) with the tool timeout above N; one heavy run at a time; foreground only; kill what you start by PID; never sleep-poll a backgrounded run — stop it, kill its tree, re-run bounded once.

## Step 0 — Preconditions

1. Resolve the listing id from `$ARGUMENTS`. If missing, ask which listing and stop.
2. Confirm `listings/<id>/inputs/` exists and contains photos. If not, point the user to `/new-listing`.
3. Confirm `GEMINI_API_KEY` is set (`.env`) and `scripts/` has stage/animate/build_tour/build_page. If staging the first time, ensure `style/reference/` has 4–8 furniture images (else not style-locked — `stage.py` warns).
4. Load `listings/<id>/manifest.json`. Everything below is **manifest-gated**: skip any room/stage already marked done with a matching input content-hash.

## Step 1 — Decide the experience (the routing rule)

Per `plan.md` §2 — *the apartment decides*:

- **Empty / unfurnished** → `video` (2D staged cinematic tour; staging does the work).
- **Furnished / luxury** → `360` or `3d` (capture does the work; little staging).

Honor an explicit `--video|--360|--3d` flag if given. Otherwise infer from the photos (are rooms empty/dated vs. furnished/high-end?) and **state your choice and reasoning** before proceeding. Record it in `manifest.experience`.

## Step 2 — Stage (paid; the only dominant cost)

For each room photo in `inputs/` not already staged (per manifest hash):

```bash
python scripts/stage.py --listing listings/<id> --room <room>
```

`stage.py` injects the locked style prompt + reference set and the **add-only** guardrail clauses from `style.yaml`. It writes `staged/<room>.png`, keeps the original untouched, and records the staged hash + style version in the manifest. **Never re-run a room that's already staged with a matching input hash** — that re-bills the API.

## Step 3 — Depth → parallax → clips (free, local)

```bash
python scripts/depth.py   --listing listings/<id>     # staged -> depth
python scripts/animate.py --listing listings/<id>     # staged + depth -> clips (camera grammar from style.yaml)
```

Deterministic. If a clip looks wrong, lower `camera.parallax_strength` in `style.yaml` and re-run *just* `animate.py` — staging is untouched.

## Step 4 — Stitch + page

```bash
python scripts/build_tour.py --listing listings/<id>  # clips -> output/tour.mp4 (room order from style.yaml)
python scripts/build_page.py --listing listings/<id>  # assets -> output/tour.html (self-contained)
```

For a `360`/`3d` experience, the page build wires the appropriate viewer instead of (or alongside) the video.

## Step 5 — Verify & hand off

- Confirm `output/tour.html` opens (double-click, no server) and the disclosure footer + per-image badges are present on every staged image.
- Confirm an unaltered original exists for every staged photo.
- Report the output path and the per-listing cost (count of staging calls × current rate).

## Step 6 — Update memory (collective memory, CLAUDE.md §0)

Append to `memory/listings/<id>.md` a `deliverable` entry: which experience was built, rooms staged, model + cost, output path, and any per-room learning (e.g. "kitchen needed a re-roll — window hallucination at high parallax"). Add the matching `runs/` line if this was a full pipeline run, and update `memory/INDEX.md`. **The tour isn't done until its memory is written.**

## Hard rules (from CLAUDE.md §2/§6)

- All look comes from the **locked** style — never invent a new palette/furniture vibe per run.
- **Add-only**: staging never removes damage, alters views, or changes dimensions.
- **Disclosure** badge on every staged image + footer is structural, never optional.
- **Manifest-gated**: never re-bill a completed paid stage on retry.
- If unsure about disclosure or cost policy, **escalate to Eliran** — not a Navigator-mode call.
