---
name: make-report
description: "Produce a self-contained market-research report.html for a listing or area — fan-out web research, adversarially verify the hard numbers, then compose it from the locked components in the house style. Use when the user says 'make a market report', 'research the area', 'neighborhood report', 'comps report for <area>', or invokes /make-report. Deliverable #2 of the realtor studio."
argument-hint: "<area-or-listing-id> [lang: en|he]"
user-invocable: true
allowed-tools: Task, Read, Write, WebSearch, WebFetch, Bash
model: inherit
disable-model-invocation: true
---
> Explicit-invocation only since 2026-10-22 — D-AUD-29 (Q 6.1, DEC-054; B-06): dormant-track skill, D1 and D2 untouched, not an archive; invoke it by name (`/make-report`); the flag is reversible and nothing is archived.

# Make Report — market-research deliverable

Turns an area (or a listing's area) into a polished, **cited, confidence-flagged** `report.html` that shares the tour's locked house style. This is the proven flow from `memory/runs/2026-05-30-market-report-deliverable.md` — follow it; don't reinvent it.

## Collective memory — read first, write last (CLAUDE.md §0)
Before acting: read `memory/INDEX.md`, the area/listing's memory file if any, and `memory/project/verified-tech-stack.md`. After finishing: append a `deliverable` entry to `memory/listings/<id>.md` (or `memory/runs/`) + an INDEX line.

## Step 1 — Scope
Resolve the target from `$ARGUMENTS`: an area name (e.g. "Florentin, Tel Aviv") or a listing id (use the listing's area). If ambiguous, ask which area + market. Pick `lang` (default `en`; `he` → RTL).

## Step 2 — Research (fan-out + verify)
Run a research **Workflow** over 4 angles — **pricing & comps · market dynamics · neighborhood profile · outlook & macro** — each web-search-heavy and URL-cited, then **adversarially verify the hard numbers** (prices, ₪/m², yields, rates, dates: default to "unverifiable" without a current source; emit a corrected value). This is the validated pattern in `workflows/`-style scripts (see the `tlv-market-report-research` reference run). Schema-force the findings: `{angle, summary, data_points[{label,value,confidence,note}], chart_series[], sources[]}` and verdicts `{claim, verdict, corrected, evidence}`.

**Honesty is the product:** keep confidence levels and recency caveats in the output. Flag every low-confidence/unverifiable figure. Where verification corrected a number, use the corrected one.

## Step 3 — Structure the data
Synthesize into `listings/<id>/report_data.json` (or a temp file for an area-only report) with this shape build_report.py consumes:
```json
{ "report_title","area","recency_note","sources":[{"url","title"}],
  "kpis":[{"label","value","delta"?,"dir"?,"sub"?}],
  "sections":[{"title","body_html","kpis"?:[...],"chart"?:{"title","data":[["Jan",4.2]],"unit"?},"sources"?:[...]}] }
```
Put the 4 headline numbers in the top KPI strip; one bar chart in the pricing section. Body prose is short and concrete.

## Step 4 — Compose
```bash
python scripts/build_report.py --listing listings/<id> --data listings/<id>/report_data.json \
  --agent-name "<realtor/brand>" --agent-contact "<contact>"   # or --out <path> for area-only
```
Self-contained, locked components, disclosure baked in. Opens with a double-click.

## Step 5 — Verify & show
Optionally render a preview PNG with headless Chrome (`"C:\Program Files\Google\Chrome\Application\chrome.exe" --headless --screenshot=... file:///<abs path>`). Confirm: 4 KPIs, chart renders, sections present, sources + recency note + disclosure footer, no external asset refs (self-contained), and it shares the tour's palette/type.

## Step 6 — Update memory (§0).

## Rules
- Prices/yields/rates are **perishable** — never copy a figure forward without re-verifying; the report must show its data-recency.
- Compose from the **locked components only** (`style/components/`) — never design a one-off layout.
- This report is **informational, not a valuation** — the disclosure block says so; keep it.
