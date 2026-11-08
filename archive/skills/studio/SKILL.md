---
name: studio
description: "The Studio Lead — one instruction produces a realtor's full marketing set for a listing: virtual tour, market-research report, listing presentation deck, and social creatives, all in the locked house style, gated for legal compliance. Use when the user says 'run the studio for <listing>', 'make everything for <listing>', 'full package for <listing>', 'do the whole listing', or invokes /studio. Orchestrates the proven per-deliverable skills/scripts; built last, after each flow was proven by hand."
argument-hint: "<listing-id> [--only tour,report,deck,social] [--lang en|he]"
user-invocable: true
allowed-tools: Task, Bash, Read, Write, WebSearch, WebFetch
model: inherit
disable-model-invocation: true
---
> Explicit-invocation only since 2026-10-22 — D-AUD-29 (Q 6.1, DEC-054; B-06): dormant-track skill, D1 and D2 untouched, not an archive; invoke it by name (`/studio`); the flag is reversible and nothing is archived.

# Studio — the orchestrator (built last)

Turns *"make everything for `listings/florentin-12`"* into the full set. It does **not** reinvent any flow — it sequences the proven scripts/skills and the sub-agents, applies the routing rule, and gates compliance before declaring done. All look comes from the locked `style/` (style.yaml + theme.yaml + components).
⚠ **Machine resource rules** (root `CLAUDE.md`; backed by the `test-guard` hook once it is installed per `.claude/hooks/README.md` — until then this line is the only rule): every test, build, server, browser or render command runs in Git Bash as `timeout N <cmd>` (tests 300 s, build/typecheck 540, servers/sweeps/renders 540 per chunk, 1800 once `BASH_MAX_TIMEOUT_MS` is raised) with the tool timeout above N; one heavy run at a time; foreground only; kill what you start by PID; never sleep-poll a backgrounded run — stop it, kill its tree, re-run bounded once.

## Collective memory — read first, write last (CLAUDE.md §0)
Before acting: read `memory/INDEX.md`, `memory/listings/<id>.md`, `memory/project/{local-environment,verified-tech-stack,agent-team-decisions}.md`. After each deliverable AND at the end: append entries + INDEX lines. An action is not done until its memory is written.

## Step 0 — Preconditions
Resolve `<listing-id>` from `$ARGUMENTS`. Ensure `listings/<id>/inputs/` has photos (else → `/new-listing`), `GEMINI_API_KEY` is set, and `style/reference/` has the furniture set. Honor `--only` (subset of `tour,report,deck,social`) and `--lang`.

## Step 1 — Route (router sub-agent)
Delegate to the **`router`** agent: it decides the tour `experience` (empty→video; furnished/luxury→360/3d, currently deferred→falls back to video with a flag) and the deliverable set, and records them in the manifest. Honor its reasoning; state it to the user.

## Step 2 — Tour (deliverable #1)
Run the proven pipeline (the `/make-tour` flow):
```bash
set -a; source .env; set +a
python scripts/stage.py --listing listings/<id>          # paid; manifest-gated
```
Then delegate the staged stills to **`visual-qa`** — it diffs each staged image vs its original for add-only violations (hallucinated windows, altered views, hidden defects) and returns pass/re-stage per room. **Re-stage any room it flags** (adjust the prompt per its suggestion) before continuing. Then:
```bash
python scripts/animate.py    --listing listings/<id>
python scripts/build_tour.py --listing listings/<id>
python scripts/build_page.py --listing listings/<id> --agent-name "<brand>" --agent-contact "<c>"
```

## Step 3 — Market report (deliverable #2, the /make-report flow)
Delegate research to the **`market-researcher`** agent (4 angles, cited, confidence-flagged, hard numbers verified) → write `listings/<id>/report_data.json` → `python scripts/build_report.py --listing listings/<id> --data listings/<id>/report_data.json --agent-name "<brand>" --agent-contact "<c>"`.

## Step 4 — Deck (deliverable #3)
`python scripts/build_deck.py --listing listings/<id> --agent-name "<brand>" --agent-contact "<c>" --pdf`  (pulls staged stills + report KPIs + branding → deck.html + deck.pdf).

## Step 5 — Social (deliverable #4, if requested)
`python scripts/build_social.py --listing listings/<id> --headline "<title>" --price "<p>" --beds <n> --area "<area>" --agent-name "<brand>" --agent-contact "<c>"`  (9:16 reel + 4:5 flyer).

## Step 6 — Compliance gate (mandatory, before "done")
Delegate to **`compliance-warden`** (runs `scripts/compliance_check.py` + judgement). **If it BLOCKs, do not declare the set ready** — report blockers + fixes. Only on CLEAR do you hand off.

## Step 7 — Hand off + memory
List every artifact in `listings/<id>/output/` with sizes, the per-listing staging cost, and the routing decision. Write the run to `memory/runs/` + update `memory/listings/<id>.md` + INDEX.

## Hard rules
- Locked style only; manifest-gated (never re-bill staging); disclosure structural on every deliverable.
- The compliance gate is non-negotiable — nothing ships on a BLOCK.
- Escalate disclosure/cost/locked-style questions to Eliran (CLAUDE.md §6), not Navigator-mode.
