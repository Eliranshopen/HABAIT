# tests/fixtures/apt846/ — the golden input: the sales plan of apartment 846
<!-- last-updated: 2026-11-18 -->

## What's here
| File | Purpose |
|---|---|
| `source.pdf` | the real sales-plan PDF (תכנית מכר) of apartment 846, Rainbow Tel Aviv: 183,222 bytes, sha256 `0c74ab308917dd177aa9d307a2c7877ef0c9a1801849b85ad1b1b3eb542c0f0a`. One vector sheet, 1684 × 1191 pt, 8,515 vector paths, four small images, no text layer |
| `saved-reading.json` | (1.2) ONE saved reading of the drawing by the vision model (`google/gemini-3.7-flash`, 2026-11-06, about $0.009): 9 rooms, 10 fixtures, 16 printed dimensions. 4,783 bytes, sha256 `55787164…05a51537`. A byte-for-byte copy of `.wt/portal-stage/Projects/Habait/habait-walkaround/Habait/tour360/out/ptrace846/trace/plan-1/vlm.json`. With it the reading tool runs at $0 (`--vlm-file`) |
| `changed-dimension-reading.json` | (1.3) `saved-reading.json` with ONE printed dimension changed by hand: the master bedroom's 348 cm is written as 448 cm, in the room's own dimensions and in the list of printed values; nothing else differs. 4,784 bytes, sha256 `a83f0b37…c33180ad`. The reading tool fails its own check on it (measured 2026-11-18: 6 of 86 checks, room count 11 of 10), so a job that reads it ends in `review` with `TRACE_GATE_FAIL` |
| `expected-trace.json` | (1.2) what a reading of this PDF from that saved reading must give, written by `../make-expected-trace.mjs` from the hand run of 2026-11-17: `PASS`, 82 checks, 0 failed, room count 10 of 10, 18 printed-dimension checks (0.82 % at most), and the sha256 of the run's `trace-check.json`, `report.json`, `rooms.json` and (1.4) `plan.general.json`: written again on 2026-11-18 from a run with the drawing's id and the reading's day, every number and the first three hashes unchanged |

## Subfolders
| Folder | Context file | Purpose |
|---|---|---|
| `fresh-reading/` | [`fresh-reading/CLAUDE.md`](fresh-reading/CLAUDE.md) | (1.2) the small files the ONE paid reading of 2026-11-18 wrote ($0.0404): the reading, the tool's check and report, its ledger, its index; pinned by sha256 |

## Conventions / gotchas
- A COPY of `Projects/Habait/data/sales-plans/israel-canada/rainbow-tel-aviv/unit-846/source.pdf` (tracked there), brought in at milestone 1.1 so that the engine's tests do not depend on that folder being on the disk. Never edited: `tests/unit/intake-wiring.test.mjs` fails when its hash changes.
- It is the apartment every milestone of the engine is measured on (plan §7.1). The expected numbers of each stage are added beside it by the milestone that proves them.
- Bytes, not text: `../../../.gitattributes` keeps git from changing its line endings.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md) · Contracts: [../../../contracts/CONTRACT-1.1.md](../../../contracts/CONTRACT-1.1.md), [../../../contracts/CONTRACT-1.2.md](../../../contracts/CONTRACT-1.2.md), [../../../contracts/CONTRACT-1.3.md](../../../contracts/CONTRACT-1.3.md)
