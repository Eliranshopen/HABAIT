---
name: studio-v2
description: "The deterministic v2 pipeline — one instruction produces a listing's single interactive dashboard.html. Runs the FIXED sequence stage → route(empty/furnished) → video|viz → dashboard, manifest-gated, in fixed room order, with the compliance gate before ship. Model judgment is reserved for ONE decision: empty-vs-furnished. Driven by the pure-orchestrator main agent; built LAST, after each flow is proven by hand. Use when the user says 'run studio-v2 for <listing>', 'build the dashboard for <listing>', or invokes /studio-v2."
argument-hint: "<listing-id> [--only video,viz,dashboard] [--lang en|he] [--dry-run]"
user-invocable: true
allowed-tools: Agent, Read, TodoWrite
model: opus
disable-model-invocation: true
---
> Explicit-invocation only since 2026-10-22 — D-AUD-29 (Q 6.1, DEC-054; B-06): dormant-track skill, D1 and D2 untouched, not an archive; invoke it by name (`/studio-v2`); the flag is reversible and nothing is archived.

# studio-v2 — the deterministic pipeline (shell)

Turns *"build the dashboard for `listings/florentin-12`"* into the single `dashboard.html`. This skill is **deterministic by design**: a fixed sequence of sub-agent calls, manifest-gated, in **fixed room order** (from `style.yaml`). It reinvents nothing — it sequences the proven specialists. **Model judgment is reserved for exactly ONE step: the empty-vs-furnished branch.** Everything else is mechanical. See `docs/v2-plan.md` §8 (phased execution). This shell is scaffolded now; its body fills in as each flow is proven by hand (constitution §3 — orchestrator/pipeline built last).

## Collective memory — read first, write last (CLAUDE.md §0)
Before acting: read `memory/INDEX.md`, `memory/listings/<id>.md`, and `memory/project/{local-environment,verified-tech-stack,agent-team-decisions}.md`. After each stage AND at the end: append entries + INDEX lines (delegated to a write-capable worker if the running agent can't write). An action is not done until its memory is written.

## Operating mode
Driven by the **pure orchestrator** (`Agent, Read, TodoWrite` only — no Write/Edit/Bash). The pipeline **sequences workers**; workers never delegate (one level deep). Handoff between steps is **artifact-on-disk + `manifest.json`**, not structured returns — Read the manifest after every step to learn what was produced. See CLAUDE.md §10.

## Step 0 — Preconditions
Resolve `<listing-id>` from `$ARGUMENTS`. Confirm `listings/<id>/inputs/` has photos (else → `/new-listing`), `GEMINI_API_KEY` is set, `style/reference/` has the furniture set. Honor `--only` (subset of `video,viz,dashboard`), `--lang`, and `--dry-run` (no paid calls).

## Step 1 — Stage (deterministic; the dominant paid step)
Delegate to **`stager`**: `stage.py` → Gemini, **locked style**, **add-only**, manifest-gated (content-hash skips done rooms; never re-bill). Then delegate the staged stills to **`visual-qa`** (structural-diff add-only backstop); **re-stage any flagged room** before continuing. Fixed room order throughout.

## Step 2 — Route (the ONE model-judgment branch)
Delegate to **`router`** — the only place judgment is allowed:
- **Empty / unfurnished / dated → video path** (the proven default).
- **Furnished / luxury → 360/3D** — **deferred / not-yet-buildable** → fall back to **video** with a flag.
Record `experience` as a **manifest field** (inspectable, overridable). Every downstream step reads it; the skill does not re-decide.

## Step 3 — Build the visuals (deterministic, gated on the route + manifest)
- **Always: `viz`** — before/after slider, static map, inline-SVG charts (price-history line · comps bars · yield gauge · neighborhood radar), clickable floor-plan. Style-switcher only if Eliran decision #7 = yes.
- **If `experience == video`: `video`** — Veo 3.1 furnish-reveal (first=empty / last=staged) + walkthrough + ffmpeg stitch. **Dry-run by default; paid call gated on Eliran decision #6.** Then route the clip through the **`visual-qa` Veo gate** before it enters the dashboard.
- Market data for the panel comes from **`market-researcher`** → `report_data.json` (cited, confidence-flagged).

## Step 4 — Compose the dashboard (deterministic)
Delegate to **`dashboard-composer`**: the self-contained hash-router SPA (#overview · #gallery · #before · #video · #floorplan · #market) from the locked components, **cockpit+sidecar media rule** (inline downscaled images ≤15 MB; Veo `.mp4` as a **relative sidecar**, never base64), structural disclosure footer, `@media print` → PDF. Writes `listings/<id>/output/dashboard.html` + manifest.

## Step 5 — Compliance gate (mandatory, before "done")
Delegate to **`compliance-warden`** (deterministic disclosure / photo-rights check + judgment). **On a BLOCK, do not ship** — report blockers + fixes. Only on CLEAR hand off.

## Step 6 — Hand off + memory
List the artifact(s) in `listings/<id>/output/` (paths + sizes from the manifest), the routing decision, and the per-listing staging/video cost. Write the run to `memory/runs/` + update `memory/listings/<id>.md` + INDEX.

## Hard rules
- **Fixed sequence + fixed room order + manifest gate** — reruns skip completed work; a failed free step never re-bills the paid staging/video step.
- Model judgment is reserved for **Step 2 only**; everything else is mechanical.
- Locked style only; disclosure structural on the dashboard; one level deep; artifact-on-disk handoff.
- Escalate cost / legal / locked-style to Eliran (CLAUDE.md §6, v2-plan §9) — not Navigator-mode.
