---
name: source-deals
description: >
  Run the Deal Sourcing organ for an area — pull Yad2 for-sale listings (Apify),
  attach free GovMap transaction comps, score each seller private-vs-agency, dedup,
  and write LEAD records (+ DEAL records for private sellers, status `sourced`, with
  comps attached) to the flat-file CRM in data/. PII (phone/name) is quarantined to
  data/contacts/ with consent_status="none". STOPS at the outreach gate — contacts
  nobody. Use when the user says "source deals", "find private sellers in <area>",
  "run sourcing for <area>", or invokes /source-deals.
disable-model-invocation: true
---
> Explicit-invocation only since 2026-10-22 — D-AUD-29 (Q 6.1, DEC-054; B-06): dormant-track skill, D1 and D2 untouched, not an archive; invoke it by name (`/source-deals`); the flag is reversible and nothing is archived.

# /source-deals — the Deal Sourcing organ

Wraps the proven sourcing flow (built + proven by hand on Florentin, 2026-05-30)
into one instruction. **It never contacts anyone.** It sources, classifies, and
writes records up to the `approve-outreach` gate, then stops.

## Memory contract (read first / write last)
1. BEFORE: read `memory/INDEX.md`, `memory/project/israel-legal-compliance.md`,
   `memory/agents/sourcing.md`, and the relevant `memory/listings/`/run files.
2. AFTER: append a `memory/runs/<date>-...source-deals.md` entry + an INDEX line.
   An action is not done until its memory is written.

## Usage
```
/source-deals --area=florentin [--since=24h]
```
- `--area` (default `florentin`) — a named area seed (city + neighbourhood) known to
  both `yad2_apify.py` (`AREA_INPUTS`) and `govmap.py` (`AREA_SEEDS`). Add new areas
  by adding a seed to both, or pass `--city`/`--neighbourhood`/`--point` directly.
- `--since=24h` — intended for the nightly cron sweep; passed through to the pull
  window (Yad2 actor permitting). For the manual demo it is informational.

## What it runs (deterministic order)
1. **Dry-run first (default).** `source_deals.py --area <area>` prints the planned
   Apify call + estimated cost and makes **no paid call**. Show the user the plan
   and the est cost; get a go-ahead before spending.
2. **Execute.** `source_deals.py --area <area> --execute` does the small paid Yad2
   pull (manifest-gated — a retry never re-bills), pulls free GovMap comps, classifies,
   dedups, and writes records via `crm_store.py`.
   - Add `--enrich` ONLY when the user explicitly wants seller phone/name pulled
     (extra cost + PII). Phone/name are written to `data/contacts/` (gitignored),
     never to the LEAD.
   - `--max-items N` (default 30) caps cost. The script refuses any plan whose worst-
     case est cost exceeds **$5** — if it trips, lower `--max-items` and report.

## Hard rules (do not bypass)
- **Cost stop:** if an Apify actor errors or the est cost exceeds ~$5, STOP and
  report — do not retry-spend. The paid step is manifest-gated; a free-step failure
  must never re-bill the pull.
- **Facts only / no pixels:** LEADs carry factual fields + a `source_url` provenance
  ref ONLY. Listing image pixels/URLs are NEVER stored as assets.
- **PII quarantine:** any phone/name goes to `data/contacts/` with
  `consent_status="none"`, provenance, and `suppressed=false`. Never to a LEAD.
- **Rights gate:** every record needs a `rights_flag` + `provenance`; the entrypoint
  refuses any record lacking them.
- **STOP AT THE GATE:** never attempt outreach, never set `consent_status` to anything
  but `none`, never write a `comms_event`. Outreach is the licensed human's act and is
  lawyer-gated (see `memory/project/israel-legal-compliance.md`).

## Underlying scripts (all idempotent, manifest/cache-gated)
- `organs/sourcing/scripts/govmap.py` — Lane 1 comps (free; `www.govmap.gov.il/api`).
- `organs/sourcing/scripts/yad2_apify.py` — Lane 2 listings (swappable Apify adapter;
  `swerve/yad2-scraper`, ~$0.005/result; dry by default).
- `organs/sourcing/scripts/classify_seller.py` + `organs/sourcing/lexicon.he.yaml`
  — the scored private/agency classifier (versioned lexicon).
- `organs/sourcing/scripts/source_deals.py` — the entrypoint above.

## Report back
The pull count, the classifier split (private/agency/unknown), how many LEADS +
private DEALS landed, how many CONTACTS were quarantined, the comps median ₪/m²,
and the actual Apify cost. Then write the memory entry.
