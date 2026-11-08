---
name: analyze-plan
description: "Run an A-to-Z analysis of the Apartment Visualizer plan — fan out parallel domain researchers (staging engine, depth/video, 360/3D, MCP/harness, legal/disclosure, architecture critique), adversarially verify the high-stakes claims (prices, model IDs, legal timelines — they move fast), and synthesize a C-level report into docs/. Use when the user says 'analyze the plan', 're-research the tools', 'refresh the tech stack', 'verify pricing', 'update the report', or invokes /analyze-plan. The tech field moves fast — re-run this before any build decision that depends on tool availability or cost."
argument-hint: "[focus: staging|video|spatial|harness|legal|all]"
user-invocable: true
allowed-tools: Task, Read, Write, WebSearch, WebFetch, Bash
model: inherit
disable-model-invocation: true
---
> Explicit-invocation only since 2026-10-22 — D-AUD-29 (Q 6.1, DEC-054; B-06): dormant-track skill, D1 and D2 untouched, not an archive; invoke it by name (`/analyze-plan`); the flag is reversible and nothing is archived.

# Analyze Plan — A-to-Z research + C-level report

The Apartment Visualizer leans on a fast-moving field (image/video models, prices, Gaussian-splat tooling, EU AI-Act timelines). This skill re-runs the structured analysis so decisions rest on **verified current reality**, not stale knowledge. It is the analytical counterpart to the build skills.

## When to run it

- Before committing to a staging provider or a per-listing cost policy.
- Before starting a new phase (1→2→3) whose tooling may have changed.
- Whenever the user asks to "refresh", "re-verify", or "update" the tech stack or report.

## How it works (the proven harness)

Use a **Workflow** (multi-agent orchestration) with this shape — it is the pattern already validated for this project:

1. **Research (fan-out).** One sub-agent per domain, each web-search-heavy and forced to cite URLs and distinguish *verified-online* from *model-knowledge*:
   - `staging` — Gemini Nano Banana family (model IDs, image-to-image, multi-reference style-locking, pricing, EU data terms) + alternatives (Flux Kontext, Seedream, purpose-built staging APIs).
   - `video` — Depth Anything V2/successors (local, Windows), 2.5D parallax techniques, ffmpeg encoding, optional AI hero-video tools (Veo/Kling/Runway/Higgsfield) + pricing.
   - `spatial` — Pannellum vs Photo Sphere Viewer; equirectangular capture; Gaussian-splatting capture→train→web pipeline + file-size/self-contained feasibility.
   - `harness` — Claude Code skill/sub-agent/hook mechanics; MCP build-vs-connect; WhatsApp/CRM trigger surface.
   - `legal` — EU AI Act Art. 50 disclosure + UCPD; GR/CY/PT/ES; Israel; US NAR best-practice wording.
   - `plan-critique` — skeptical senior-architect critique of `plan.md` (self-contained-HTML limits, cost realism, sequencing, missing pieces).
2. **Verify (adversarial).** For each domain's *high-stakes claims* (prices, model availability, legal timelines), spawn skeptical fact-checkers that default to "unverifiable" without a current source, and emit a corrected statement.
3. **Synthesize.** Merge into a structured dossier, then write/refresh `docs/c-level-report.md` and `docs/research-dossier.md`.

If a `focus` argument is given, run only that domain (plus a light verify pass).

## Implementation note

The reference script lives at `docs/` history; re-create the Workflow with: 6 domain prompts → `pipeline(domains, research, verifyHighStakesClaims)` → synthesis agent. Schema-force the research (domain, summary, findings[{title,detail,confidence,source}], high_stakes_claims, recommendations, open_questions) and the verdicts (claim, verdict, corrected_statement, evidence). Pass `plan.md` text via `args.plan` to the critique agent.

## Output

- `docs/research-dossier.md` — raw structured findings + verification verdicts (the evidence trail).
- `docs/c-level-report.md` — the executive report: verified tech stack, action items, recommendations, risks, cost, legal wording, topology, open decisions. **Always date it and flag any claim a verifier corrected.**

## Rules

- **Cite everything.** A recommendation without a current source is an open question, not a finding.
- **Prices and model IDs are perishable** — never copy them forward from an old report without re-verifying.
- Legal disclosure wording is liability-sensitive: present it, but flag that Eliran/counsel signs off (not a Navigator-mode call).
