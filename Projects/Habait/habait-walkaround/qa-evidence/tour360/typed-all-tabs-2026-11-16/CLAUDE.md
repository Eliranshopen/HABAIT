# typed-all-tabs-2026-11-16/ — context file
<!-- last-updated: 2026-11-16 -->

## Purpose
Evidence of P1 of plan `development/plans/2026-11-16-typed-change-all-tabs.md`: a typed change in the 360 tour repeated in every tab that sees the spot, checked at $0 (no vendor call).

## What's here
| File | What |
|---|---|
| `REPORT.md` | what was run, what it showed, what it does not show |
| `1440x900-record.json` · `390x844-record.json` | the page's own account of each run (`tools/follow-live-check.mjs`): the spot, the aimed rooms, every stub call, the stacks |
| `*.jpg` | screenshots and the views the page cut — not tracked by git (`qa-evidence/**/*.jpg`) |
| `bench/` | the paid editor speed bench: `REPORT.md` (the table), `results.json`, `ledger.json` ($2.48), `sheet-<case>.jpg` and every picture |
| `real/` · `real-fast/` · `real-fast-2/` · `real-final/` | the four paid end-to-end runs of the cross-tab proof: `real-1440x900-record.json`, `real-ledger.json`, every view sent and picture answered; `real-final/` is the code as committed |
| `real-speakers-tv/` | Eliran's own example, an object: floor speakers beside the TV typed in the living tab, followed into dining, entrance and kitchen (`sheet-speakers-four-tabs.jpg`) |
| `real-speakers/` | ⚠ an INVALID run of that example (the view was not on the TV: the check ignored `--look=…`); kept because it showed the page aiming the bedroom behind the TV wall |
| `judge-anchor-test.json` · `judge-near-check.json` | the judge wordings tried on the real follow answers (the anchor judge: 12 of 12) |
| `scripts/` | the two one-off scripts behind those numbers: `follow_metrics.py` ($0), `judge_anchor_test.mjs` (paid, $0.004 a call) |

## Gotchas
- The figures in the pictures are the check's stub (two plain shapes), not an editor's output.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md) · Tools: `Habait/tour360/tools/follow-check.mjs`, `follow-live-check.mjs`
