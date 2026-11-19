# mcp/ — the habait-engine MCP server and the stub engine behind it
<!-- last-updated: 2026-11-18 -->

## What's here
The server the agent (Pi) talks to: JSON-RPC 2.0 over stdio, one JSON object per line, Node built-ins only, no SDK. Milestone 0.2 puts a STUB engine behind the eight tools: real checks on the PDF, real job files, a detached runner that walks the states on a timer, and the existing apartment-846 tour as the result. Nothing is rendered, nothing is paid; every job carries `"mode": "stub"` (since 1.1 the first look itself is real: `inspect_plan` answers `"mode": "real"`). The shapes are fixed by `../contracts/CONTRACT-0.2.md` §1–§5; milestones 0.3 onward replace the stub without changing them.

## Key files
| File | Purpose |
|---|---|
| `server.mjs` | `createServer({handlers})` → `handleMessage` / `handleLine`; `runStdio()` reads stdin until it ends. `initialize` (version negotiation), `ping`, `tools/list`, `tools/call`; errors -32700 / -32600 / -32601 / -32602 / -32603. A tool failure is a RESULT (`isError: true`, `structuredContent.error`). Runs its main only when executed (`node mcp/server.mjs`) |
| `tools.mjs` | the eight tools' title, description, annotations; loads the schemas from `../contracts/tools/` and inlines the Job (`$ref` → `../job.schema.json`); drops `$schema` / `$id` from what `tools/list` returns |
| `schema-check.mjs` | `validate(schema, value)` for the JSON Schema subset the contracts use; `assertSupported` refuses any other keyword. Validates every `tools/call` input |
| `stub-engine.mjs` | `createStubEngine(config, deps)` → the eight handlers; `createDoctorCache` (the readiness report runs in a child, ~5 s, cached in memory and `<runtimeDir>/doctor.json`). (0.3) `start_simulation` on an existing job goes through `engine/control.mjs` `startOrResume` and returns `resumed`; `get_job` / `list_jobs` add the computed `runner` field. Re-exports `configEnv`, `tourDir`, `runnerAlive`, `spawnRunnerDefault`, `RUNNER` from `engine/control.mjs` |

The runner is `../engine/runner.mjs` since milestone 0.3 (`mcp/stub-runner.mjs` was removed; nothing starts it).

## Conventions / gotchas
- **stdout is the protocol.** Logs go to stderr; children (runner, static server, doctor) never inherit stdout. `tests/milestones/m0.2.test.mjs` asserts every stdout line is a JSON-RPC message.
- **Every tool answers under 2 s, except a FIRST look at a PDF; none waits for a job.** A first look is one Python start inside the call: about 2 s on a quiet machine, up to the 30 s limit on a saturated one (then `FILE_TOO_LARGE`; contract 1.1 §9, owed by milestone 2.1). A repeated look comes from the record. `engine_status` returns the cached readiness report (waits at most 1 s for the first one, then says it is still running); `get_result` may restart the static server (≤ 1.5 s).
- **The same PDF + apartment = the same job** (`job_id` from the PDF's sha256, apartment, mode, engine version). Starting it again (0.3 §6): `done` → as it is; a live runner → as it is; a working job with a dead runner → a new runner, `resumed: true`; `cancelled` / `failed` / `review` → RESTARTED at the first stage with no valid manifest row, `resumed: true` (this replaced the 0.2 rule that a cancelled job stays cancelled).
- **Every job a tool returns carries the ledger's settled total as `cost.spent_usd`** (`shownJob` / `withTrueCost` of `engine/control.mjs`, contract 0.3 §14.1), not the copy in `job.json`; the read puts the copy right when it is behind. A new tool that returns a job does the same.
- **The first look and the intake are real since 1.1; the stages are still stubs.** `inspect_plan` answers `mode: "real"` with `pages`, `kind`, `page_rows` and `candidates` from `engine/inspect.mjs`; a job carries the mode of the settings (`stub` unless they say `real`: contract 1.3 §1). `start_simulation` asks for the look itself, takes `apartment` = a candidate id (left out = the only candidate; `chooseCandidate`), and copies the PDF through `engine/stages/intake.mjs`.
- `NO_PLAN_FOUND`: a PDF with no candidate, several candidates with none chosen, or an `apartment` that is not one of them (the stub's old id `apt846` is not). The message lists the candidate ids and never echoes a string that is not an id.
- `createStubEngine(config, { inspect })`: the first look is a dependency. The tests that start dozens of made-up PDFs pass a scripted one (`scriptedLook` in `tests/soak/lib.mjs`); nothing in the engine does.
- A job whose `job.json` or `manifest.json` is not that job's file (contract 1.1 §5) is answered with `JOB_NOT_FOUND` by every tool, the message naming the job and the reason; `list_jobs` leaves it out.
- **A file error never reaches the agent raw (contract 1.1 §1, §3, §5).** The upload's trouble is `NOT_A_PDF` (`checkedUpload`: the path check and the hash read); a job folder's trouble during a start is `TOOLCHAIN_MISSING` naming the job (`jobFolderWork`), or `NOT_A_PDF` for a file where the job folder belongs; any other file error of the engine's own folders is `TOOLCHAIN_MISSING` with one fixed message (`answerOf`). The error's code goes to stderr; a local path never goes into an answer.
- **What is left is a JSON-RPC -32603 with no path:** `server.mjs` replaces a file error's own message with `a file error of the engine (<code>)`. The one case met: the job lock held longer than the 2 s a tool waits (`job <id>: lock busy`); the call answers when it is repeated (contract 0.3 §17 item 5; contract 1.1 §9).
- `approve_paid_stage` and a repeated `start_simulation` restart the runner when its `runner.pid` is gone; the runner waits for an approval at most 24 h, then exits.
- Output schemas describe the success result only; a failure's `structuredContent` is `{ error: { code, message } }`.
- Detached processes in tests: temp `ENGINE_HOME` / `ENGINE_JOBS_DIR`, a free `ENGINE_SERVE_PORT`, `ENGINE_STUB_STEP_MS` ≈ 30; kill by pid from `runner.pid` and `.runtime/serve.json` in `after`.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md) · Contract: [../contracts/CONTRACT-0.2.md](../contracts/CONTRACT-0.2.md) · Job layer: [../engine/CLAUDE.md](../engine/CLAUDE.md)
