# tests/e2e/ — the end-to-end test of milestone 0.2
<!-- last-updated: 2026-11-17 -->

## What's here
One script that proves the whole chain in a real browser with NO language model: the React app → the bridge → Pi 1.5.2 in RPC mode → a scripted fake model → the engine's MCP tools → the stub runner's job files → the bridge → the app's job card. Pi runs on a temp agent folder (`PI_CODING_AGENT_DIR`, with `HOME` / `USERPROFILE` pointed at a temp folder too), so the user's own Pi folder is never used. No provider, no key, no network beyond 127.0.0.1, $0.

| File | Purpose |
|---|---|
| `m0.2.e2e.mjs` | the test: prerequisites, the temp layout, the wrapper's own installer on the temp agent folder, `pi mcp list`, the app build, the bridge, the browser runs (A at 1440: quote → guard card → «לאשר» → done → the tour link; B at 390: quote → guard card → «לחסום»), the overflow and console checks, the cleanup. Writes `report.json`, seven screenshots, `pi-mcp-list.txt` and `bridge.log` (pairing line removed) to `development/tasks/3dengine/logs/0.2/e2e/` |
| `fake-model.mjs` | the scripted model: an OpenAI chat-completions streaming server on loopback that decides by the LAST message only (upload → `inspect_plan`; its result → `start_simulation` with `apartment` left out (1.1: the engine takes the only candidate); the approve button's message → `approve_paid_stage` with the job id and `cap_usd` parsed from it; otherwise a short Hebrew text) |
| `live.mjs` | `--live [--dry]`: ONE conversation with the REAL model on the owner's real setup (bridge in place from `C:/HABAIT-Agent-UI`, its own config, Pi's own folder and login, the live engine, `vite preview` on 4173). Hard brake: > 20 tool activities, > 8 min, or an unexpected card → abort, kill, exit 1; never retries. Tool order from the bridge log's `[tool]` lines; cost is not exposed. `--dry` = prerequisites + the plan, nothing started or spent. Evidence: `development/tasks/3dengine/logs/0.2/live/`. Spends money: only on Eliran's approved cap |
| `procs.mjs` | spawn with a log file, kill by pid with the child tree (`taskkill /T /F`), port checks, the in-process static server for the built app, the leftover-process and `netstat` checks |

## Commands
```
npm run test:e2e        # node tests/e2e/m0.2.e2e.mjs — exit 0 only when every assertion holds (about 1 minute)
E2E_KEEP=1 npm run test:e2e   # keep the temp folder (logs, sessions, jobs) for a look afterwards
```
Env: `HABAIT_UI_DIR` (default `C:/HABAIT-Agent-UI/.wt/engine-mcp`), `HABAIT_PI_WRAPPER_DIR` (default `C:/pi-main/habait/.wt/engine-mcp`) — point them at the main copies to run the same test there; `E2E_LOG_DIR` (1.1: default a folder in the temp directory; a gate that keeps evidence names `…/logs/<milestone>/e2e`), `E2E_BRIDGE_PORT` (8787), `E2E_APP_PORT` (4173; the bridge allows only 4173 / 5173), `ENGINE_STUB_STEP_MS` (1000), `CHROME_PATH`, `PLAYWRIGHT_CORE_FROM`.

## Conventions / gotchas
- **Nothing in the three worktrees is changed.** The bridge is COPIED into the temp folder (its `config.json`, `sessions/`, `state/`, `workspace/uploads/` live there); the web extension is copied fresh from the wrapper; the app is built with `vite build --outDir <temp>`; the engine runs from this worktree on a temp `ENGINE_HOME` whose `inbox` is the bridge copy's uploads folder.
- The installer writes the engine entry with the LIVE path (`C:/RnD/Projects/3Dengine/mcp/server.mjs`); the test then points that entry at this worktree's `mcp/server.mjs` and adds the `ENGINE_*` env (temp jobs, a free serve port that is never 8891, the step time).
- The app polls a job every 2 s, so a step time under about 1 s hides the intermediate percents; 1000 ms shows some of them (the runs of 2026-11-16: `0 → 25 → 55`).
- `watchUntilQuote` reads the percent badge once more after the approve button appears. The two arrive in one render but are read in two steps, and on a loaded machine the first read can be the old one (2026-11-16: `0 → 25` with the button already there, 1 run in 6).
- A missing prerequisite (Pi CLI, Chrome, the staged 846 site, python, a busy port 8787 / 4173, `playwright-core` in `appdeps/`) is a FAILURE with its name, never a skip.
- (1.1) The engine behind the chain runs the REAL first look, so the temp engine home's settings point `python` and `pipelineRoot` at this engine home. The fixture `sample.pdf` has one drawing, and the scripted model leaves `apartment` out.
- Every process it starts is killed in `finally` (bridge tree = Pi + MCP server; runners by `runner.pid`; the static server by `.runtime/serve.json`); the run then asserts no node process mentions the temp folder or this engine's code and that the ports are free.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md) · Contract: [../../contracts/CONTRACT-0.2.md](../../contracts/CONTRACT-0.2.md) · Card: `development/tasks/3dengine/m0.2/task-06-integration.md`
