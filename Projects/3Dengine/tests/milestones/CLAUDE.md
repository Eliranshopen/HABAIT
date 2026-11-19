# tests/milestones/ — one closing test per milestone
<!-- last-updated: 2026-11-18 -->

## What's here
`m<id>.test.mjs` = the «מוכן כאשר» line of milestone `<id>` in plan §7.1, written as a runnable test against the REAL environment. A milestone is closed only when its file passes; `npm test` runs all of them, so a closed milestone stays closed.

| File | Milestone | What it proves |
|---|---|---|
| `m0.1.test.mjs` | 0.1 the engine home | parity `41 rows · PASS`; `fetch.mjs --verify-only` prints `57/57 rows OK`; the readiness command reports ready except the keys; every file under `pipeline/` has the git blob id of its source in commit `a63494a` (context files excepted); a file listed in `pipeline/PORT-CHANGES.md` has the blob id that the list records for it (since 1.2) |
| `m0.2.test.mjs` | 0.2 a stub engine connected to the agent (engine half) | the REAL `node mcp/server.mjs` on a temp home: `initialize`; `tools/list` = the eight tools with both schemas; one job inspect → start → `awaiting_approval` (quote) → approve → `done` → `get_result` → the local link answers 200 with the temp site's HTML; same PDF → `created: false`; `cancel_job`; the eight stub reason codes; -32601 / -32602 / -32700; every `tools/call` < 2 s; stdout = JSON-RPC lines only; each result validates against its tool's output schema |

| `m0.3.test.mjs` | 0.3 a job on the disk | REAL detached runners on a temp home, hard-killed by pid: (1) kill mid-`rendering`: the state stays, `runner.alive` false; (2) resume: finished rows untouched, `rendering` attempt 2; (3) kill between reserve and settle: one `orphaned` + one `settled` row; (4) kill after settle: `gating` runs again, still one ledger row; (5) `done`, one row per stage, `spent_usd` 1.8, the link answers 200; (6) two jobs never overlap in `rendering`; (7) restart after a cancel. `M03_KEEP=1` keeps the temp home |
| `m1.1.test.mjs` | 1.1 intake and a first look | the real server, Python, scanner and 846 PDF: (1) one sheet, one drawing (`p1`, 8,515 vector paths), kept, no text of a PDF in an answer; (2) the same PDF under two names → the same `job_id`, a read-only copy with the PDF's hash; (3) outside the inbox, `..`, a junction → `PATH_NOT_ALLOWED`; (4) an empty page → no candidate, no job; (5, 5b, 5c) a stored copy changed by hand, also under a live runner or with its hash rewritten → no stage runs, no bill; (6) a job file that names another job → a runner exits 1, changes nothing; (7–10) below |

**Parts added to `m0.3.test.mjs` after the first QA round (contract 0.3 §10):**
- (8) a kill after the cache write: ONE row, `recovered`, one send; (9) a wrong `spent_usd` on the disk is corrected; (10) the cap is reached: back to `awaiting_approval`, a larger approval continues to `done`.
- (11) an empty `job.lock` does not block a resume; (12) a recycled pid is not a live runner.
- (13) a LIVE runner that gives no sign of life (hook `ENGINE_TEST_FREEZE_MS`) is replaced; when it wakes it writes nothing and sends nothing: (a) blocked at the start of a stage, (b) after a reserve, (c) with the answer of a sent call in hand, the late answer.
- (14) a runner that was silent loses the heavy lock to another job: it stops rendering, writes no row, waits and renders again; the two rendering rows do not overlap.
- (15) a damaged and a deleted output of earlier stages are rebuilt byte for byte; no later stage runs again and nothing is billed again.
- (16) a reservation left by a dead runner is always closed (contract 0.3 §12): (a) the third QA round's defect, three real runners: late answer, second runner killed after it marked its call, third runner; (b) a runner killed while blocked before its send: the reservation is dropped, the call is sent once, nothing is held.
- (17) what was spent is what the ledger says, also after `done` (contract 0.3 §14.1): a late answer whose runner is killed right after its settle; then the copy in `job.json` set back by hand, and every read through the engine reports the ledger's total and puts it right.
- Parts 6, 9 and 15 block the runner with the freeze hook at the point they need and wake it themselves; no part has to catch a short window.

**Parts added to `m1.1.test.mjs` by its QA rounds (contract 1.1 §8):**
- (7) a look that cannot be stored (`.runtime/inspect` is a file) → `TOOLCHAIN_MISSING`, no path, no job. (8) the upload rewritten in place by another process during six fresh looks: every answer is the true look, `NOT_A_PDF`, or a look at half-written bytes under their own hash; never a wrong look kept.
- (9) a candidate planted in a stored look is scanned again; a file where the job folder belongs → `NOT_A_PDF`; the CLI's `resume` on a job with a bad manifest exits 1 and starts no runner.
- (10) an upload held by another program with no sharing → `NOT_A_PDF` from both tools, and it is looked at when it is free; the CLI's `job` and `ledger` on a bad manifest write nothing. Its lock holder is a PowerShell process that gets 150 s to start: at 100 % load 30 s were missed twice, and 150 s once in the fifth reviewer's runs. A failed wait there is time, not the engine.

## Conventions / gotchas
- **Never assert on one look** at something a live runner changes by itself (`job.lock`, `runner.alive` with a small `staleSeconds`); wait for the expected look with `lockFree` / `seenAlive` from `../soak/lib.mjs`. A freeze test wakes its blocked runner itself (`wake()`), it never waits out a fixed time (contract 0.3 §11.1).
- Assert on the tool's text, not only on its exit code: `fetch.mjs` exits 0 even when it could verify only 12 of 57 rows.
- A tool that rewrites a tracked file (`fetch.report.json`) is run inside a `try` / `finally` that puts the bytes back, and the put-back is tried again for up to 10 s when another process holds the file (`patiently` in `m0.1.test.mjs`): a `git status` of the editor once made it fail with `UNKNOWN` and left the tracked file modified.
- Every spawn has a timeout.
- **A temp home that runs the real first look** is pointed at the real engine home's Python and pipeline: `{ ...BASE, python: REAL.python, pipelineRoot: REAL.pipelineRoot }` with `REAL = loadConfig({ env: {} })` (`m0.2`, `m1.1`). Relative paths of the settings file would resolve inside the temp home, where there is no Python.
- **Since 1.1 the closing test of 0.2 uses the real first look** (`sample.pdf` has a drawing): a first look (one Python start) has no wall-clock bound, and these two temp homes give the scanner 120 s: it takes about 2 s on a quiet machine and took over 30 s when another session had saturated it. A repeated look must take under 2 s; every other call stays under 2 s. The closing test of 0.3 passes a scripted look (`scriptedLook`), because it starts dozens of made-up PDFs.
- **Compare a whole jobs folder only when nothing in it is alive:** a live runner writes a heartbeat into its own `job.json` several times a second (part 6 of `m1.1` kills the bystander's runner first).
- An `after` hook removes its temp home with `removeHome(home, port)` of `../helpers/cleanup.mjs`, after it stopped its runners (`stopPids`). Never by the record alone: `serve.json` can name a static server that lost the start while another one serves and holds the folder (QA round 8 of milestone 0.3: one gate run in ten failed on `EPERM`). And never with a large `maxRetries`: `fs.rmSync` waits `retryDelay` × 1, 2, 3 … between tries, so 60 tries of 150 ms can block for 4.5 minutes.
- A test that causes a detached process (runner, static server) uses a temp `ENGINE_HOME` / `ENGINE_JOBS_DIR`, a free `ENGINE_SERVE_PORT` (never 8891), a tiny temp site, and in `after` stops every runner it finds (`runner.pid`) and then the static server and the home (`removeHome`).

## Links
Parent: [../CLAUDE.md](../CLAUDE.md)
