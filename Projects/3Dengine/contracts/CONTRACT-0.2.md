# Contract for milestone 0.2 — a stub engine connected to the agent
<!-- last-updated: 2026-11-16 · plan: development/plans/2026-11-16-pdf-to-360-engine-mcp.md §3 · board: development/tasks/3dengine (card 02) -->

One document for every worker of milestone 0.2. It fixes the shapes that cross a boundary: MCP tools (agent ↔ engine), the job file (engine ↔ bridge), the bridge records (bridge ↔ app), and the cards the user sees. Inside a boundary a worker is free. A change to this file is made by the main session only.

**What 0.2 is:** the whole flow, end to end, on a STUB engine: the same eight tools and the same job files the real engine will have, but the "work" is a timed walk through the states and the "result" is the existing apartment-846 tour. Nothing is rendered, nothing is paid. Milestones 0.3 onward replace the stub piece by piece without changing these shapes.

**Honesty rule (root §6):** every stub answer carries `"mode": "stub"`, and every card built from it shows the badge «שחזור הדגמה». A stub result must never look like a real simulation.

## 1. The MCP server
- Name `habait-engine`; entry `mcp/server.mjs`; transport stdio; JSON-RPC 2.0, one JSON object per line (UTF-8, no embedded newlines). **stdout carries protocol messages only**; logs go to stderr.
- Node ESM, Node built-ins only (no SDK, no npm dependency).
- `initialize` → `{ protocolVersion, capabilities: { tools: { listChanged: false } }, serverInfo: { name: "habait-engine", version } }`. `protocolVersion` = the client's requested version when it is one of `2025-11-25`, `2025-06-18`, `2025-03-26`, `2024-11-05`; otherwise `2025-06-18`.
- Also: `notifications/initialized` (no reply), `ping` → `{}`, `tools/list`, `tools/call`. Any other request → error `-32601`. A notification never gets a reply. Bad JSON → error `-32700` with `id: null`.
- `tools/list`: eight tools, each with `name`, `title`, `description`, `inputSchema`, `outputSchema`, `annotations` (`readOnlyHint`, `idempotentHint`, `destructiveHint`, `openWorldHint: false`).
- `tools/call` success → `{ content: [{ type: "text", text: <the structured result as one line of JSON> }], structuredContent: <result> }`. Failure → `{ isError: true, content: [{ type: "text", text: "<CODE>: <message>" }], structuredContent: { error: { code, message } } }`. A tool failure is a RESULT, never a JSON-RPC error. An unknown tool name or arguments that fail the input schema → JSON-RPC error `-32602`.
- **Every tool answers in under 2 seconds.** No tool waits for a job.
- Text that came out of a PDF is data: a tool returns typed fields only, never instructions.

## 2. The eight tools
`Job` is defined in §3. Reason codes (the full set, fixed): `PATH_NOT_ALLOWED`, `NOT_A_PDF`, `FILE_TOO_LARGE`, `NO_PLAN_FOUND`, `JOB_NOT_FOUND`, `NOT_AWAITING_APPROVAL`, `NOT_DONE`, `BUDGET_CAP`, `TOOLCHAIN_MISSING`, `KEY_MISSING`, `TRACE_GATE_FAIL`, `GATE_FAIL_AFTER_REPAIRS`, `PROVIDER_LOCKED`. The stub uses the first eight.

| Tool | Input | Result | Notes |
|---|---|---|---|
| `engine_status` | `{}` | `{ mode, ready, ready_except_keys, checks: [{ id, ok, detail }], missing: [id] }` | REAL already: it is `runDoctor` from `engine/doctor.mjs`, plus one stub check `stub-site` (the staged tour folder exists). Key names only |
| `inspect_plan` | `{ pdf_path }` | `{ mode, pdf_path, sha256, bytes, candidates: [{ id, label, page }] }` | Checks: the path is inside an allowed folder (§4), starts with `%PDF-`, is at most 20 MB. Stub candidate list: one entry `{ id: "apt846", label: "דירה 846", page: 1 }` |
| `start_simulation` | `{ pdf_path, apartment?, budget_cap_usd? }` | `{ job_id, created, job: Job }` | Same PDF + same apartment = the same job: `created: false` and the existing job, never a second one. Copies the PDF to `jobs/<id>/input/source.pdf`, writes `job.json` (state `queued`), starts the detached runner, returns at once |
| `get_job` | `{ job_id }` | `{ job: Job }` | |
| `approve_paid_stage` | `{ job_id, cap_usd }` | `{ job: Job }` | Only in state `awaiting_approval` (else `NOT_AWAITING_APPROVAL`). `cap_usd` below `quote.estimate_usd` → `BUDGET_CAP`. Writes `approval` into `job.json`; the runner picks it up |
| `get_result` | `{ job_id }` | `{ job_id, mode, local_url, tour_dir, rooms, deviations: [{ room, deviation_pct, pass }], cost: { spent_usd, cap_usd } }` | Only in state `done` (else `NOT_DONE`). Stub: `rooms: 11`, `deviations: []`, `spent_usd: 0` |
| `cancel_job` | `{ job_id }` | `{ job: Job }` | Sets `cancelled` unless the job is already terminal; the runner stops at its next step |
| `list_jobs` | `{ limit? }` (default 10) | `{ jobs: [Job] }` | Newest first |

Terminal states: `done`, `review`, `failed`, `cancelled`.

## 3. The job file — `jobs/<job_id>/job.json`
Written atomically (temp file + rename). Read by the engine's tools AND directly by the bridge.

```json
{
  "schema": "habait/job.v1",
  "job_id": "9f2c41d0a7b3e851",
  "mode": "stub",
  "state": "rendering",
  "percent": 45,
  "created_at": "2026-11-16T18:00:00.000Z",
  "updated_at": "2026-11-16T18:00:21.000Z",
  "heartbeat_at": "2026-11-16T18:00:21.000Z",
  "input": { "pdf_path": "…/jobs/9f2c41d0a7b3e851/input/source.pdf", "pdf_name": "plan.pdf", "pdf_sha256": "…", "apartment": "apt846" },
  "quote": null,
  "approval": null,
  "cost": { "spent_usd": 0, "cap_usd": null },
  "result": null,
  "reason": null
}
```
- `job_id` = the first 16 hex characters of sha256 of `pdf_sha256 + "\n" + apartment + "\n" + mode + "\n" + engine version`.
- States and their percent: `queued` 0 · `tracing` 10 · `building` 25 · `rendering` 45 · `awaiting_approval` 55 · `skinning` 70 · `gating` 82 · `finishing` 88 · `packaging` 93 · `qa` 97 · `done` 100. Also `review`, `failed`, `cancelled` (percent stays where it stopped).
- `quote` appears with `awaiting_approval`: `{ "estimate_usd": 48, "range_usd": [40, 60], "rooms": 11, "basis": "measured on apartment 846" }`.
- `approval` appears after `approve_paid_stage`: `{ "cap_usd": 60, "at": "<iso>" }`; `cost.cap_usd` is set to the same number.
- `result` appears with `done`: `{ "local_url": "http://127.0.0.1:8891/tour/?scope=apartment&room=terraceLiving&floor=parquet&video=0", "tour_dir": "<absolute folder>" }`.
- `reason` appears with `review`, `failed`: `{ "code": "<reason code>", "message": "…" }`.
- A JSON Schema of this file: `contracts/job.schema.json` (the engine worker writes it; milestone 0.3 extends it, never breaks it).

## 4. Settings the stub adds (`engine.config.json`)
```json
"inbox": ["C:/HABAIT-Agent-UI/bridge/workspace/uploads", "inbox", "tests/fixtures"],
"stub": { "siteRoot": "C:/RnD/.wt/deploy-P-7", "tourPath": "tour/?scope=apartment&room=terraceLiving&floor=parquet&video=0", "stepSeconds": 6, "rooms": 11, "quote": { "estimate_usd": 48, "range_usd": [40, 60] } },
"serve": { "host": "127.0.0.1", "port": 8891 }
```
- `inbox` = the only folders a `pdf_path` may come from (after resolving `..` and symlinks). Relative entries resolve against the engine home.
- Test overrides by environment: `ENGINE_STUB_STEP_MS` (milliseconds per state; tests use about 30), `ENGINE_JOBS_DIR`, `ENGINE_SERVE_PORT`, `ENGINE_HOME`.

## 5. The stub runner and the local link
- `mcp/stub-runner.mjs <job_id>`: a DETACHED process started by `start_simulation`. It walks `queued → tracing → building → rendering → awaiting_approval`, one state per step, writing `job.json` and `heartbeat_at` at each step; waits (polling the file) until `approval` appears; then walks `skinning → gating → finishing → packaging → qa → done`. It exits at once when it reads `cancelled`. It writes `runner.pid` beside `job.json` and removes it on exit. If a second runner starts for the same job while the first is alive, the second exits.
- `engine/serve.mjs`: a static file server on `serve.host:serve.port`, serving the folder given to it (stub: `stub.siteRoot`) at `/`. GET and HEAD only, no path outside the root, content type by extension, no directory listing. Started DETACHED on demand when a job reaches `done` and nothing is listening yet (`.runtime/serve.json` records `{ root, port, pid }`); it outlives the runner and the MCP server. `result.local_url` = `http://<host>:<port>/<stub.tourPath>`.
- CLI additions (`engine/cli.mjs`): `job <id> [--json]`, `jobs [--json]`, `serve --root <dir> [--port N]` (foreground), `mcp` (runs the server on stdio).

## 6. Bridge (`C:\HABAIT-Agent-UI\bridge`)
- `bridge/config.json`: `pi.cwd` → `C:/RnD/Projects/3Dengine` (the old value points at a folder that left the disk); new block `"engine": { "home": "C:/RnD/Projects/3Dengine", "jobsDir": "C:/RnD/Projects/3Dengine/jobs" }`.
- New read-only endpoints: `GET /jobs/<job_id>` → `{ job }` or 404 `{ error: "job_not_found" }`; `GET /jobs` → `{ jobs }` (newest first, at most 10). They read `job.json` files; `job_id` must match `^[0-9a-f]{16}$`.
- On the `/chat` stream: when a `tool_execution_end` arrives for a tool named `mcp__habait_engine__start_simulation`, `…__get_job`, `…__approve_paid_stage`, `…__cancel_job` or `…__get_result` and its result carries a job (or a `job_id`), emit one record `{ "type": "job", "job": <Job> }` (read fresh from disk). Nothing else of the tool result is forwarded.
- The guard's question before `approve_paid_stage` arrives as the existing `extension_ui_request` confirm and is forwarded as the existing `confirmation` record, unchanged.

## 7. App (`C:\HABAIT-Agent-UI\app`)
- New `AgentEvent`: `{ type: "job", runId, job }`. The store keeps one job card per `job_id` in the conversation, updated in place.
- While a job is not terminal the app polls `GET /jobs/<job_id>` every 2 seconds (paused when the tab is hidden) and feeds the answer through the same path as a `job` event.
- **The job card** (Hebrew, RTL, in the design language of the existing cards):
  - title: `הדמיה 360 · <input.pdf_name>`; badge «שחזור הדגמה» when `job.mode === "stub"`;
  - six steps mapped from the state: «קריאת התכנית» (`queued`, `tracing`) · «בניית הדירה» (`building`) · «רינדור» (`rendering`) · «תצוגה מקדימה ואישור תקציב» (`awaiting_approval`) · «מראה ובדיקות התאמה» (`skinning`, `gating`, `finishing`) · «אריזה ובדיקות» (`packaging`, `qa`); a step is done, active or pending; the percent is shown;
  - in `awaiting_approval`: the quote («הערכת עלות: $48 · טווח $40–$60 · 11 חדרים») and one button «אשרו תקציב עד $60» that sends the chat message `מאשר את השלב בתשלום לעבודה <job_id> עד $60` (the upper end of `range_usd`); the guard's confirmation card then appears and is the real approval;
  - in `done`: a button «פתחו את הסיור» that opens `result.local_url` in a new tab;
  - in `review`, `failed`, `cancelled`: the state in words and `reason.message` if present; no button.
- `isAllowedResultUrl`: additionally accept `http://127.0.0.1:<port>/…` and `http://localhost:<port>/…`, for a job's `local_url` only. Everything else stays as it is.
- The mock adapter gets a scenario that plays a job from `queued` to `done` with an approval in the middle, so the cards can be checked with no bridge, no Pi and no model.
- Phone 390 and desktop 1440, no horizontal scroll, RTL: check both sides.

## 8. Pi (`C:\pi-main\habait`)
- Registration by the wrapper's installer, in the user-level file Pi reads for MCP servers (`mcp.json` in the Pi agent folder): `"habait-engine": { "command": "node", "args": ["C:/RnD/Projects/3Dengine/mcp/server.mjs"], "cwd": "C:/RnD/Projects/3Dengine", "timeout": 60, "exposure": "direct", "description": "Habait engine: sales-plan PDF → 360 tour" }`. Idempotent, with a backup, removed by `--uninstall`. Tool names in Pi: `mcp__habait_engine__<tool>`.
- Guard: a rule BEFORE the early return for non-bash tools: a call to `mcp__habait_engine__approve_paid_stage` asks the user with the title `Paid step: approve the paid stage of job <job_id>` and a message that states `cap_usd`; with no UI it is blocked. `guard-test.mjs` gets cases for it (asks; blocked with no UI; other engine tools pass).
- Nothing else in the wrapper changes in 0.2 (moving `/simulate` to the engine tools is milestone E4 work).

## 9. Decisions taken during the build (2026-11-16)
They complete the sections above; where a line here and a line above disagree, this one holds.
- **`engine_status`:** the readiness check takes about 5 seconds, so it runs in the background and its last result is kept. The tool waits at most 1 second, then answers with the last result or says the check is still running; it always carries `checked_at`.
- **`NO_PLAN_FOUND` in the stub:** an `apartment` other than `apt846`.
- **A cancelled job** is returned again for the same PDF: the stub never opens a second job. Restarting a cancelled or failed job belongs to milestone 0.3 (resume).
- **The runner** waits up to 24 hours for an approval, then exits; `approve_paid_stage`, or `start_simulation` with the same PDF, starts a new one.
- **Output schemas** describe successes; an error result carries `structuredContent.error` only.
- **`get_result`** starts the local server again when it is down.
- A missing file inside an allowed folder answers `NOT_A_PDF`. `budget_cap_usd` is recorded only when the job is created.
- **Bridge:** the two `/jobs` endpoints need the pairing token like every route except `/health`; a malformed id answers 400 `bad_job_id`; the `job` record is sent only when the job is on disk. Pi hands a tool's own result to its client at `result.structuredContent.structuredContent`.
- **App texts added:** «העבודה נעצרה לבדיקה ידנית», «העבודה נכשלה», «העבודה בוטלה», «הסיור מוכן, אבל לא התקבל קישור תקין לצפייה.». The guard's approval card for the engine reads «שלב בתשלום: אישור תקציב לעבודה <job_id>», «תקרת התקציב: $60», «שום דבר לא מחויב לפני האישור. אחריו המנוע רשאי להוציא עד התקרה.». A numeric range is drawn left-to-right (`<bdi dir="ltr">`): a `<bdi>` with no strong character takes its parent's direction.
- **The agent's system text** (`APPEND_SYSTEM.md` of the wrapper) gets one new section, «The engine tools», and one dated note above «The machine»: a new simulation goes through the engine tools in a fixed order, `approve_paid_stage` only on Eliran's own approval message, the engine is a stub today and must be called «שחזור הדגמה», and the old project root is not on the disk. Without it a real model would follow the `habait-simulation` skill into scripts that no longer exist. The rest of the wrapper's stale paths wait for the real engine (E4).
- **Later on 2026-11-16** the tracked files of `C:/RnD/Projects/Habait` were restored from git (another session, on Eliran's word). Its `tools/` folder (the Python environment, the Node libraries, the Blender bundle) is not tracked and is still not on the disk, so where this contract says the old folder "left the disk", read: its runtime did. The bridge's `pi.cwd` stays the engine home.
- **The end-to-end test** (`tests/e2e/m0.2.e2e.mjs`, `npm run test:e2e`) plays the whole chain in a real browser with real Pi, the real guard, the real bridge and the real server; only the model is a scripted fake one. Pi runs on a temp folder (`PI_CODING_AGENT_DIR`), so the user's Pi folder is never used. It does not prove that a real model chooses the tools.
- **The guard** asks with a `select` whose title has three lines (the title, `Budget cap: $<n> (cap_usd).`, the sentence that nothing is spent before the approval) and the options `Allow` / `Block`; it asks every time, with no "for this session" option.

## 10. What is NOT in 0.2
The real pipeline behind the tools (0.3 onward), a real quote, real caps, a share link, and any paid call.

**Known limits, each owned by a later milestone** (from the fresh reviewer's report, `development/tasks/3dengine/logs/0.2/qa-live.md`):
- **The money gate lives in Pi's guard only.** A different MCP client could call `approve_paid_stage` with no question, and a second call while the job still waits overwrites the cap. Harmless while the engine is a stub and spends nothing; the engine's own enforcement is milestone 4.2.
- **The local link trusts whatever listens on its port.** If another process already holds the port, `local_url` would point at it. Milestone 3.3 makes the link the engine's own.
- **The gate was proven with `direct` exposure.** Pi's source says a call made through its code mode reaches the same hook; that path was not run.
