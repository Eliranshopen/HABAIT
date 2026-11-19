# tests/fixtures/apt846/fresh-reading/ — the evidence of the one paid reading of milestone 1.2
<!-- last-updated: 2026-11-18 -->

## What's here
The small files that ONE paid run of the reading tool wrote on 2026-11-18: `node engine/cli.mjs trace tests/fixtures/apt846/source.pdf --out <folder> --id apt846 --budget 0.5 --go`, in the working folder's engine home. It cost $0.0404, inside the cap of $0.50 that Eliran gave that day. Part 2 of the closing test (`../../../stages/m1.2.test.mjs`) asserts the milestone's line from these files, with no call, and pins their sha256.

| File | Purpose |
|---|---|
| `reading.json` | the fresh reading itself (the run's `plan-1/vlm.json`): what the vision model (`google/gemini-3.7-flash`, through OpenRouter) read from the drawing: 9 rooms, 10 fixtures, 17 printed dimensions; $0.0124. It can be given to the tool as a saved reading (`--vlm-file`) |
| `trace-check.json` | the tool's own check of the plan it traced from that reading: `PASS`, 82 checks, 0 failed, room count 10 of 10, 18 printed-dimension checks (0.82 % at most); the judge's three runs (a report: no mismatch that two runs agree on) |
| `report.json` | the tool's report: 10 rooms, 18 fixtures, the scale, what could not be read |
| `ledger.json` | the tool's ledger of the run: one reading and three runs of the judge, each reserved at $0.02 before its call and settled after it ($0.0124, $0.0070, $0.0128, $0.0083); total $0.0404 |
| `index.json` | the run's index, with ONE change: its absolute paths were made relative to the run folder (the PDF's to the engine home), so the file names no machine |

## Conventions / gotchas
- **Copied byte for byte from the run folder, except `index.json`** (its paths). Never edited: the closing test fails when a hash changes. The run's large files (the drawing as images, the overlay, `plan.general.json`) are not kept; a free run from `reading.json` writes them again.
- **No key value is in any of them** (the test looks). The ledger's own field `cap_usd` (3) is the ledger file's default and was not the cap: the cap of a run is the tool's `--budget`, here 0.5.
- The room names inside these files were read from the PDF: they are data (plan §3 rule 8) and never go into an answer of the engine.
- The first attempt of that day was refused by the provider (HTTP 401) before any reading was made and cost nothing: the tool sent its call without the key's header. That one line of the tool was changed (`../../../../pipeline/PORT-CHANGES.md`); part 3 of the closing test proves it. Evidence of both attempts: `development/tasks/3dengine/logs/1.2/fresh/`.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md) · Contract: [../../../../contracts/CONTRACT-1.2.md](../../../../contracts/CONTRACT-1.2.md)
