# contracts/ — the shapes that cross a boundary
<!-- last-updated: 2026-11-18 -->

## What's here
The contract of each milestone and the JSON Schemas of what crosses a boundary: the MCP tools (agent ↔ engine) and the job file (engine ↔ bridge). The server loads its `tools/list` schemas from here, so these files ARE what the agent sees.

## Key files
| File | Purpose |
|---|---|
| `CONTRACT-0.2.md` | milestone 0.2, a stub engine connected to the agent: the server, the eight tools, the job file, the settings, the runner and the local link, the bridge, the app, Pi. Changed by the main session only |
| `CONTRACT-0.3.md` | milestone 0.3, a job on the disk: one runner and its stages, `manifest.json`, `ledger.json`, alive or stalled, the heavy lock, start / resume / cancel, the closing test. Sections 10 to 16 = the rules added after the first seven QA rounds; each wins over what is before it. Section 17 = the eighth round (PASS) and what it saw that the milestone does not answer. Changed by the main session only |
| `CONTRACT-1.1.md` | milestone 1.1, intake and a first look at the PDF: what `inspect_plan` answers, the candidates and how a job chooses one, the verified read-only copy, the check of the stored input, the identity of `job.json` and `manifest.json` (carried from 0.3), the settings, the engine version, the ten parts of the closing test, what changed in earlier tests. Section 9 = what is not in 1.1; section 10 = the build's decisions and the five QA rounds (four FAIL, the fifth PASS). Changed by the main session only |
| `CONTRACT-1.2.md` | milestone 1.2, reading the 846 plan inside the engine: how the engine starts the existing reading tool and what it passes, the rule of the paid path (free unless a go AND a cap), what is read back and returned (no text of the PDF), outcomes and exit codes, a run that is stopped, the `trace` settings, the command, the two tiers of tests and the closing test, what is not in 1.2. Changed by the main session only |
| `CONTRACT-1.3.md` | milestone 1.3, the trace gate: the mode of a job (`stub` or `real`, from the settings), the wrapper of the reading tool tightened for a job, the reading as the first real stage and the ONE table from its outcome to what the job does, `review` (a stage hands a job to a person: `ReviewNeeded`, the `review` record), the settings, the closing test in two files, what is not in 1.3. Changed by the main session only |
| `CONTRACT-1.4.md` | milestone 1.4, a saved reading: the store (the reading and its record, the four answers of `findReading`), the reader and when a kept reading stops being valid (Eliran's decision: across engine versions, until the reading tool or the model changes), why the same reading gives the same plan bytes (the day, the id), the command (`trace` with the store, `reading show` / `import`), the stage, settings numbers, the closing test, what is not in 1.4. Changed by the main session only |
| `job.schema.json` | `jobs/<job_id>/job.json` (`habait/job.v1`): every field, the 14 states, the 14 reason codes (0.3 added `STAGE_FAILED`), (0.3) `attempts`, `waiting_for`, and the computed `runner` of `get_job` / `list_jobs`; (1.1) `input.pdf_bytes`; (1.3) `review`, only while the state is `review`. Unknown top-level fields allowed (later milestones extend, never break) |
| `manifest.schema.json` | (0.3) `jobs/<job_id>/manifest.json` (`habait/manifest.v1`): one row per finished stage attempt |
| `ledger.schema.json` | (0.3) `jobs/<job_id>/ledger.json` (`habait/ledger.v1`): every paid call, `reserved` / `settled` / `failed` / `orphaned`; `sending_at` (set just before the send); the flags `recovered`, `late`, `not_sent`, `resend_of`, `answer_not_kept` (contract 0.3 §10 to §16) |

## Subfolders
| Folder | Context file | Purpose |
|---|---|---|
| `tools/` | [`tools/CLAUDE.md`](tools/CLAUDE.md) | one input and one output schema per tool, 16 files |

## Conventions / gotchas
- Only the keywords `mcp/schema-check.mjs` implements may be used (`assertSupported` fails the tests otherwise): type, enum, const, properties, required, additionalProperties, items, min/maxItems, minimum/maximum, min/maxLength, pattern; plus annotations.
- A nullable object is `"type": ["object", "null"]`; its `required` applies only when it is an object.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md) · Server: [../mcp/CLAUDE.md](../mcp/CLAUDE.md)
