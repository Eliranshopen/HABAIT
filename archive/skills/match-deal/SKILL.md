---
name: match-deal
description: "Run the Matching organ for a deal — score every investor PROFILE against a DEAL, hard-filter the deal-breakers, rank the survivors 0–100 with a transparent per-factor breakdown, and write MATCH records. Use when the user says 'match this deal', 'who fits deal X', 'find buyers for <deal>', 'rank investors for <deal>', or invokes /match-deal <deal-id>."
argument-hint: "<deal-id> [--dry-run] [--top N] [--profile <id>]"
user-invocable: true
allowed-tools: Bash, Read
model: inherit
disable-model-invocation: true
---
> Explicit-invocation only since 2026-10-22 — D-AUD-29 (Q 6.1, DEC-054; B-06): dormant-track skill, D1 and D2 untouched, not an archive; invoke it by name (`/match-deal`); the flag is reversible and nothing is archived.

# Match Deal — rank investor profiles against a deal

The **Matching organ** (C-level plan §2). Deterministic scorer: HARD deal-breaker
filters first (budget · geo · asset-type/size · strategy), then a WEIGHTED soft
score (budget-fit · geo · asset · yield · motivation) → 0–100 fit + a transparent
per-factor breakdown. Writes a MATCH record (`profile_id × deal_id`) per survivor and
maintains the ISA securities offeree-counter scaffold. **No AI, no API, no cost** —
pure local Python over the flat-file CRM.

## Collective memory (CLAUDE.md §0) — read first

Before running, read `memory/INDEX.md` and (if it exists) `memory/agents/matching.md`
for the scoring policy + known gotchas, plus the deal's listing memory if one exists.
After a meaningful run, append a one-line note to the run log + INDEX (the script
already writes the MATCH records + their data-INDEX lines).

## Step 1 — Parse arguments

`$ARGUMENTS`: first token is the **deal id** (e.g. `deal-sample` or the full
`deal-sample-20260530-florentin` — a unique prefix resolves). Optional flags:
- `--dry-run` — score + print, write nothing (use to preview).
- `--top N` — show only the top N ranked matches.
- `--profile <id>` — score only one profile (prefix ok).

If no deal id is given, ask **"Which deal id should I match? (e.g. `deal-sample`)"** and stop.

## Step 2 — Run the matcher

```bash
python organs/matching/scripts/match.py <deal-id> [--dry-run] [--top N] [--profile <id>]
```

The script:
1. Loads the DEAL and every PROFILE in `data/profiles/`.
2. Runs **hard filters** — any profile that trips budget / geo / rooms+area / a
   structural deal-breaker (e.g. a `central Tel Aviv` breaker vs a TLV deal, or a
   `sub-3% yield` breaker vs the implied yield) is **EXCLUDED** with reasons and never
   written as a match.
3. Scores the survivors, ranks them high→low, and writes one **MATCH record** each
   (`data/matches/match-…json` + an INDEX line) via `crm_store`. IDs are derived from
   `profile_id × deal_id`, so re-running is **idempotent** (overwrites, no duplicates).
4. Prints the ranking + breakdowns, the excluded list, and the **securities counter**.

## Step 3 — Read the output back to the user

Surface, in order:
- the **ranked matches** (rank · score/100 · profile · financeable?) with the
  per-factor breakdown for at least the top match;
- the **excluded** profiles + the hard-filter reason(s);
- the **securities counter** line (offeree total/unclassified vs the <35/<50 cap — 0
  for brokerage/own-account deals; only `syndication`-lane deals count offerees).

## Notes & guardrails

- **Yield is provisional pre-underwrite.** If the DEAL has no `underwrite` block
  (status `sourced`), the yield factor uses a coarse neighborhood rent proxy off the
  listed price/area and the note says so. Once the **underwriting organ** fills
  `underwrite.gross_yield_pct`, re-run `/match-deal` and the yield factor refines.
- **Flippers/value-add have no yield target** — the matcher does not penalise a
  missing/low yield for them; their score leans on budget-fit + (future) discount-to-ARV.
- **Securities cap is a scaffold** (plan §4): present and 0 at MVP (brokerage). It only
  counts offerees on `syndication`-lane deals; classified investors don't count against
  the <35 unclassified cap. Above threshold it flags "route to a licensed offering
  coordinator" — that path is **lawyer-gated**, escalate to Eliran, never auto-pitch.
- A high match is the seam to the **visualizer-as-pitch-generator** (`/studio-v2`) — but
  generating/sending a pitch crosses the outreach + broker gates; do **not** auto-trigger
  it from here.
- **No PII** is read or written — profiles carry labels only; real names live in CONTACT.
