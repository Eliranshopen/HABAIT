# Projects/3Dengine/ — the engine: sales-plan PDF → full 360 tour
<!-- last-updated: 2026-11-18 -->

## What's here
The engine that turns a developer's sales-plan PDF (תכנית מכר) into a full 360 apartment tour, built to be driven by the agent through MCP. Plan: `development/plans/2026-11-16-pdf-to-360-engine-mcp.md` (the page Eliran reads is the `.html` beside it). Board: `development/tasks/3dengine/` — one card per milestone (0.1 → 7.5), each closed by its gate before the next starts (Eliran, 2026-11-16).

**State 2026-11-19:** milestones 0.1 to 1.4 are closed (0.3 after eight QA rounds, 1.1 after five, 1.2 and 1.3 after one, 1.4 after three). The first look and the intake are real, the engine starts the reading tool (`node engine/cli.mjs trace`), the reading is the first REAL stage of a job of mode `real`, and the engine keeps the reading it paid for: the model reads a PDF once. Every stage after the reading is still a stub, and the real home's jobs are still `stub`. Next: 2.1, the render as an engine stage.
- **0.1, the engine home:** the pipeline as it was in git, the runtime, the render assets, the readiness command.
- **0.2, connected to the agent:** the MCP server `habait-engine` with its eight tools, on a STUB that replays the apartment-846 tour (`"mode": "stub"`, nothing rendered or paid). Contract: `contracts/CONTRACT-0.2.md`.
- **1.1, intake and a first look (closed 2026-11-17):** `inspect_plan` reads the PDF itself (`engine/inspect.mjs` runs the pipeline's `auto_pages.py scan` on a private copy): pages, a sheet or a booklet, the drawings found. A job keeps its own verified, read-only copy of the PDF (`engine/stages/intake.mjs`); a runner checks it at every start and before every stage. Every stage after the intake is still a stub. Contract: `contracts/CONTRACT-1.1.md` (§9 what is not in 1.1, §10 the five QA rounds).
- **1.1, the rules its QA rounds added:** `job.json` and `manifest.json` are read only when they are this job's, and nothing is written to a job when one of them is not. A file that cannot be read has a fixed answer with no local path: the upload's trouble is `NOT_A_PDF`, the trouble of the engine's own folders is `TOOLCHAIN_MISSING`. A stored first look is rebuilt from the scanner's output, never believed.
- **1.2, the reading of a drawing (closed 2026-11-18):** the existing tool `pipeline/Habait/tour360/tools/auto-trace.mjs` turns the 846 PDF into a measured plan inside the engine home, started only through `engine/trace.mjs`. From the saved reading it costs $0 and reproduces the measured run byte for byte (10 rooms, 82 of 82 checks, printed dimensions 0.82 % at most); one fresh reading passed the same way for $0.04. A run pays only with `--budget <usd> --go`. ONE line of the tool was changed (`pipeline/PORT-CHANGES.md`). Contract: `contracts/CONTRACT-1.2.md`.
- **1.3, the trace gate (closed 2026-11-18):** the settings' `mode` says whether a new job is `stub` (the default) or `real`. A real job reads its own copy of the PDF with the reading tool, free, from the kept reading the engine holds for that PDF (since 1.4: `.runtime/readings/<sha256>/`). A reading that fails its own check hands the job to a person (`review`, `TRACE_GATE_FAIL`) and never reaches the build; with no saved reading the job ends `BUDGET_CAP` before anything starts. A real job stops at `building` today. Contract: `contracts/CONTRACT-1.3.md`.
- **1.4, a kept reading (closed 2026-11-19):** the engine keeps the model's reading of every PDF (`engine/readings.mjs`: the reading as the tool wrote it, and a record that is checked against it). A second run of the same PDF calls no model, pays nothing and gives the same `plan.general.json` byte for byte. A kept reading is valid until the reading tool or the model changes (Eliran), not until the engine version does. Commands `reading show` / `reading import`. The file lock was replaced on the way (two reviews; contract 1.4 §11). Contract: `contracts/CONTRACT-1.4.md`.
- **0.3, a job on the disk:** one detached runner (`engine/runner.mjs`) walks the stages of `engine/stages/`; every job keeps `manifest.json` (what was really done) and `ledger.json` (every paid call, reserved before it is sent); a killed runner resumes from the same point, with no finished stage repeated and no call billed twice. Contract: `contracts/CONTRACT-0.3.md` (sections 10 to 16 = what the QA rounds added; section 17 = what is still open).

## Key files
| File | Purpose |
|---|---|
| `engine.config.json` | the ONE settings file: where Python, Blender, Chrome, the pipeline, the assets and the legal data are; the key NAMES; (0.2) `inbox` (the only folders a PDF may come from), `stub` (site root, tour path, seconds per state, rooms, quote), `serve` (host, port 8891); (0.3) `stub.callUsd`, `runner` (heartbeat, stale time, heavy stages, heavy lock); (1.1) `inspect` (large image, vector page, timeout); (1.2) `trace` (time limit, the most a reading may cost, judge runs) |
| `engine.config.json`, since 1.3 | `mode`: the mode of a NEW job, `stub` (the default, and what the real home keeps) or `real` (every stage must be real); `readingsDir`: where the saved readings of PDFs are (when absent, `readings` inside the runtime folder); `trace.rounds`: the reading tool's self-correction rounds (1 to 9, default 3) |
| `engine.config.local.json` | (untracked) the machine's overrides of the settings file, merged one level deep. Test overrides come by env: `ENGINE_HOME`, `ENGINE_JOBS_DIR`, `ENGINE_SERVE_PORT`, `ENGINE_STUB_STEP_MS` |
| `requirements.lock.txt` | the Python environment, 20 pins, the versions of the environment that produced apartment 846 |
| `package.json` | the engine version (part of every job id; since 1.1 it is the number of the last closed milestone); `npm test` (the whole suite, fails under 80 % line coverage of `engine/**` and `mcp/**`), `npm run test:unit`, `npm run doctor`; (1.2) `npm run test:stages`, the closing tests that run a real pipeline tool |
| `.gitignore` | keeps `.venv/`, `.runtime/`, `jobs/`, `node_modules/` and every env file out of git |
| `.gitattributes` | (1.1) `*.pdf` and `tests/fixtures/**` are bytes: git never changes their line endings (a checkout once turned a fixture's LF into CRLF in the live home) |

## Subfolders
| Folder | Context file | Purpose |
|---|---|---|
| `engine/` | [`engine/CLAUDE.md`](engine/CLAUDE.md) | the engine's own code: settings, readiness, set-up scripts, CLI, job files, inbox check, static server |
| `mcp/` | [`mcp/CLAUDE.md`](mcp/CLAUDE.md) | the MCP server `habait-engine` (stdio), the eight tools, the stub engine and its detached runner |
| `contracts/` | [`contracts/CLAUDE.md`](contracts/CLAUDE.md) | the milestone contracts and the JSON Schemas of the job file and the tools |
| `pipeline/` | [`pipeline/CLAUDE.md`](pipeline/CLAUDE.md) | the tools brought from git `a63494a`, unchanged |
| `house/` | [`house/CLAUDE.md`](house/CLAUDE.md) | brand and legal data the tour carries |
| `appdeps/` | [`appdeps/CLAUDE.md`](appdeps/CLAUDE.md) | the two Node libraries the pipeline loads (`sharp`, `playwright-core`), locked |
| `tests/` | [`tests/CLAUDE.md`](tests/CLAUDE.md) | unit tests, one closing test per milestone, and (1.2) the tier of closing tests that run a real pipeline tool |

Not in git, rebuilt by the set-up scripts or at run time: `.venv/` (Python), `appdeps/node_modules/`, `.runtime/` (set-up manifests; `serve.json` + `serve.log` of the static server; `doctor.json`, the cached readiness report; (1.1) `inspect/<sha256>/`, the first look of a PDF), `jobs/` (one folder per job: `job.json`, `manifest.json`, `ledger.json`, `cache/` (paid answers), `stages/<stage>/`, `input/source.pdf`, `runner.pid` while the runner lives, `runner.log`), `.runtime/heavy.lock` (one heavy stage at a time), and the render assets inside `pipeline/360walkaround/`.

Since 1.3 also: in a job of mode `real`, `stages/tracing/attempt-<n>/` (everything the reading tool wrote in that attempt, its own log too). Since 1.4: `.runtime/readings/<sha256 of a PDF>/` (`reading.json` as the tool wrote it, `record.json`, and `superseded/<n>/` for a replaced pair: the engine never deletes a reading), and a lock is a FOLDER (`job.lock`, the heavy lock's guard, `store.lock`) that is there only while it is held.

## Commands
```
node engine/cli.mjs doctor              # is the engine ready? (exit 0 = ready, or ready except the keys)
node engine/cli.mjs env                 # the environment pointers the pipeline gets
node engine/cli.mjs setup-env [--go]    # Python environment + Node libraries, from the locks (dry-run without --go)
node engine/cli.mjs bring-assets [--go] # render assets from the backup, verified by sha256 (dry-run without --go)
node engine/cli.mjs mcp                 # the MCP server habait-engine on stdio (same as: node mcp/server.mjs)
node engine/cli.mjs jobs [--json]       # the newest jobs, one line each
node engine/cli.mjs job <job_id> [--json]   # one job: stages + manifest rows, ledger total, orphaned rows, STALLED
node engine/cli.mjs resume <job_id>     # a runner for a stalled job; restart a cancelled / failed / review one
node engine/cli.mjs ledger <job_id> [--json] # the job's paid calls: reserved, settled, failed, orphaned
node engine/cli.mjs trace <pdf> --out <dir> [--id <id>] [--vlm-file <file>] [--fresh] [--no-judge] [--budget <usd> --go]   # read a drawing into a measured plan; asks the kept reading first (1.4); free unless --budget and --go
node engine/cli.mjs reading show <pdf>            # (1.4) what is kept for this PDF, and whether it is still valid (exit 0 only when it is)
node engine/cli.mjs reading import <pdf> <file> [--go]   # (1.4) keep a reading by hand; nothing is written without --go
node engine/cli.mjs serve --root <dir> [--port N]   # static server for a folder, foreground (default port 8891)
npm test                                # the whole suite + the 80 % coverage bar (434 tests since 1.4: about 150 s quiet, up to 280 s on a saturated machine; give it timeout 300)
npm run test:stages                     # the closing tests that run a real pipeline tool (1.2 on; five files side by side since 1.4). timeout 540 can cut it now (537 s twice, 482 s once, quiet machine):
node --test tests/stages/m1.4.test.mjs  # ... after a cut run this once: it goes on from the checkpoint the first run left (the tier's time is owed to milestone 2.1)
npm run test:e2e                        # browser → bridge → Pi → a scripted model → the engine (0.2); evidence goes to a temp folder unless E2E_LOG_DIR names one
npm run test:soak -- --kills 60 --freezes 40   # random kills, then takeovers of runners that look dead (0.3)
```

## Conventions / gotchas
- **One milestone at a time** (Eliran, 2026-11-16): plan to tasks → develop → tests → test coverage ≥ 80 % → sync-context → the next. The process and the milestone log: plan §7.2.
- **Each tier of tests runs ONCE in a gate** (Eliran, 2026-11-18): `npm test` once and `npm run test:stages` once; a run is repeated only when it failed or was cut by its limit. After a merge the live home gets the readiness command only. The board's `run-tasks.md` step 3.
- **`pipeline/` is not edited.** A change there is listed in `pipeline/PORT-CHANGES.md` (one line so far, milestone 1.2); the closing test of 0.1 compares every file with git `a63494a`.
- **Keys by NAME only** (`FAL_KEY`, `OPENROUTER_API_KEY`): the readiness command says present or missing, never a value. No env file is committed; never name one in a command.
- **Where the keys are (Eliran, 2026-11-17).** Both keys are in the repo's one keys file, at the repo root. By default the engine looks in its own folder (`envRoot: "."`) and then says both are missing. The untracked `engine.config.local.json` of an engine home points it at the root: `{ "envRoot": "C:/RnD" }`; the readiness command then prints `FAL_KEY: present, OPENROUTER_API_KEY: present` and `READY`. A worktree needs its own copy of that file.
- **The Blender lock is machine-wide** (`C:/RnD/.wt/_blender.lock`): one Blender at a time on this machine, whichever folder starts it (root §12).
- **The Kenney pack zip cannot be downloaded any more** (the URL returns a web page). `fetch.mjs --verify-only` needs it in `pipeline/360walkaround/catalog/.cache/` to verify 45 of the 57 models, and without it prints `12/57 rows OK` while still exiting 0. The only copies: the 2026-11-03 archive under `C:\HABAIT-Archive`, and this home's cache.
- Development happens in the git worktree `C:\RnD\.wt\3dengine` (branch `3dengine`); a closed milestone is merged into the local `main`. Never pushed.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md) · Plan: [../../development/plans/2026-11-16-pdf-to-360-engine-mcp.md](../../development/plans/2026-11-16-pdf-to-360-engine-mcp.md) · Board: [../../development/tasks/3dengine/README.md](../../development/tasks/3dengine/README.md)
