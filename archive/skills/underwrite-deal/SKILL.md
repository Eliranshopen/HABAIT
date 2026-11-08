---
name: underwrite-deal
description: "Underwrite a sourced DEAL into a buy/pass — taxes + financing + reno → a 0–100 deal-score, grade A–F, and an offer RANGE, written back onto the deal record (status → underwritten). Deterministic Python on open gov data + dated tax constants (the cleanest legal lane). Use when the user says 'underwrite <deal-id>', 'run the numbers on <deal>', 'score this deal', 'buy or pass on <deal>', or invokes /underwrite-deal."
argument-hint: "<deal-id> [--tier cosmetic|standard|gut] [--dry-run]"
user-invocable: true
allowed-tools: Bash, Read
model: inherit
disable-model-invocation: true
---
> Explicit-invocation only since 2026-10-22 — D-AUD-29 (Q 6.1, DEC-054; B-06): dormant-track skill, D1 and D2 untouched, not an archive; invoke it by name (`/underwrite-deal`); the flag is reversible and nothing is archived.

# underwrite-deal — taxes · finance · reno · score (the Underwrite organ)

Turns a sourced DEAL into a buy/pass decision. This is the **Underwrite** stage organ from `docs/agency-c-level-plan.md` §6 Phase U — built 2nd, lowest legal risk (clean open-gov data + deterministic math, no outreach, no PII). It chains four deterministic Python scripts into one verdict and writes it back onto the deal.

**It is mechanical by design.** No model judgment is required — `deal_score.py` is the entrypoint and chains the legs. The skill just resolves the deal-id, runs the chain, and reports.

## Collective memory — read first, write last (CLAUDE.md §0)
Before acting: read `memory/INDEX.md`, `memory/project/israel-legal-compliance.md` (the tax/finance + lawyer-gated facts), `memory/agents/underwriting.md` (this organ's learnings), and the deal's listing memory if one exists. After finishing: append a `memory/runs/<date>-underwrite-<deal-id>.md` entry + update `memory/agents/underwriting.md` + add INDEX lines. **An action is not done until its memory is written.**

## Step 0 — Resolve the deal
- `$ARGUMENTS` first token = the **deal-id** (e.g. `deal-sample-20260530-florentin`). If empty, ask for it and stop.
- Confirm the deal exists: `python -c "import sys; sys.path.insert(0,'agency/scripts'); import crm_store; print(bool(crm_store.load_entity('deal','<id>')))"`. If `False`, tell the user the deal isn't under `data/deals/` and stop.
- The deal must carry at minimum `asking_price_ils` and `area_sqm`. If thin, ask whether to enrich it (rent, condition, comp ₪/m²) before running.

## Step 1 — Run the underwriting chain
Always do a **`--dry-run` first** (computes + prints; writes nothing):

```bash
python organs/underwriting/scripts/deal_score.py <deal-id> --dry-run
```

Review the printed score / grade / yield / offer range / risk flags against the verified Florentin baseline (`listings/demo-telaviv-1/report_data.json`): gross yield should land ~2.5–3% for central TLV, asking ₪/m² near ₪52–68k, purchase tax = 8% of price for an investor below the split threshold. If those are sane, run the real write:

```bash
python organs/underwriting/scripts/deal_score.py <deal-id>          # writes the deal
python organs/underwriting/scripts/deal_score.py <deal-id> --tier gut   # force a reno tier
```

What `deal_score.py` chains (all in `organs/underwriting/scripts/`):
- `tax_constants.py` — DATED constants (purchase tax 8%/10% ⚠️ rate order lapses **2026-12-31**, mas shevach 25% +5% surtax, betterment 50% per-event stub, BoI 3.75%). Each carries `verified_on` + `re_verify_by`.
- `underwrite_tax.py` — purchase tax + mas shevach (on the modeled ARV exit) + betterment.
- `underwrite_finance.py` — **50% investor LTV cap**, mortgage at BoI+margin, DSCR, gross/net yield, cap rate, leveraged cashflow.
- `underwrite_reno.py` — ₪/m² tiers (cosmetic/standard/gut) + 15% contingency → reno cost + ARV uplift.

## Step 2 — What it writes (idempotent, deal-record-as-checkpoint)
- The **schema-legal summary** onto `DEAL.underwrite` (`arv_ils`, `offer_low/high_ils`, `gross_yield_pct`, `dscr`, `deal_score`, `tax_constants_dated`) and flips `status` → `underwritten` (validated against `deal.schema.json` on write).
- The **full breakdown** (tax/finance/reno/rubric/risk_flags) to a sidecar `data/deals/<deal-id>.underwrite.json` (the schema's `underwrite` object is `additionalProperties:false`, so the rich detail lives beside the deal, not on it).
- A **stage-transition line** appended to the deal's `events.jsonl` — **only when the status actually changes** (re-underwriting an already-`underwritten` deal refreshes the numbers without spamming the append-only log).
- Refreshes the deal's `data/deals/INDEX.md` hook line.

The math is deterministic, so a re-run is a true no-op on the result — safe to re-run any time the constants are re-verified.

## Step 3 — Report to the user
Surface: **score + grade**, gross/net yield, DSCR, monthly cashflow at 50% LTV, ARV, the **offer range**, and **every risk flag** (the purchase-tax lapse warning, negative-cashflow / thin-DSCR flags, the comps-recency caveat). State the buy/pass read in one line.

## Rules / guardrails
- **Money-critical = re-verify before relying.** If `tax_constants.check_freshness()` flags a stale constant or the purchase-tax rate order has lapsed (post-2026-12-31), say so loudly — do not present numbers as final.
- This is a **design brief, not tax/financial/legal advice.** Real offers need Israel Tax Authority comp confirmation + a licensed advisor (CLAUDE.md §6 / plan §8 legal gate).
- Underwriting takes **no regulated act and contacts no one** — it's the safe lane. The `broker_act` gate and outreach gates live downstream (mandate/negotiate), not here.
- Costs nothing (local compute only). No API keys needed.
