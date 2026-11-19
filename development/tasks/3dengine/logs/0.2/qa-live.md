# QA live — milestone 0.2 (qa-reviewer, fresh context)
State reviewed: engine 3e9e753, agent UI 309802f, Pi wrapper 89751a0. The three git status checks are clean (no stray files).

| # | Item | Result | Evidence |
|---|---|---|---|
| 1 | Eight tools keep the contract | PASS | m0.2.test 8/8; own JSON-RPC probe: names, inputs, reason codes (NOT_DONE, BUDGET_CAP, PATH_NOT_ALLOWED, NOT_A_PDF, JOB_NOT_FOUND), -32602 for unknown tool and bad args. Slowest answer 1011 ms (first engine_status, doctor still running, documented); all others under 70 ms. 0 of 24 stdout lines were not JSON-RPC |
| 2 | Same PDF never opens a second job | PASS | Probe: start x3 (apartment omitted, explicit apt846, same bytes under another file name) gave created:false and one job folder |
| 3 | Money gate through Pi | PASS (with notes) | Guard rule sits before the non-bash early return; asks every time ("Allow"/"Block" only, no session option); no UI = block. Pi's nested (codemode) calls go through `_beforeToolCall` with the same tool name (Pi source `agent-session.js`); codemode is inactive by default. e2e: job file has no `approval` while the guard card shows; after «לחסום» it never gets one. guard-test 39 cases PASS |
| 4 | Honesty | PASS | `mode:"stub"` on engine_status, inspect_plan, get_result and in every `job` object; badge «שחזור הדגמה» visible in 390-done and 1440-quote screenshots; APPEND_SYSTEM.md lines 22-31 say "STUB … «שחזור הדגמה»" |
| 5 | Local link | PASS | Probe: tour URL 200, real tour page; listener `127.0.0.1` only (netstat). `..`, `%2e%2e`, `%5c`, `//..//`, a drive path: 404/403, POST 405, `%00` 400 |
| 6 | Tests and coverage | PASS | Engine suite 144/144, lines 99.84% (every file at least 97%); bridge 16/16 at 100%; app 35/35 at 100%; guard 39 PASS; installer 8 PASS; e2e 51/51 PASS |
| 7 | Secrets | PASS | Key-value pattern grep over the milestone's logs and files: no value; doctor prints key names only; e2e sets `PI_CODING_AGENT_DIR` and HOME to a temp folder |
| 8 | Registration | PASS | `pi mcp list`: habait-engine connected, 8 tools (direct, global) |

## Defects
No defects found.

## Observations
1. The contract does not say that a client other than Pi (any process that starts `mcp/server.mjs`, or `bash` in Pi running it) can call `approve_paid_stage` with no question. Harmless in 0.2 (the stub pays nothing) but §8 and §9 should say "the gate lives in Pi only" so 0.3 or later does not assume otherwise.
2. `approve_paid_stage` can be called again while the job is still `awaiting_approval`: it answers success again and the second cap overwrites the first (probe). Pi's guard still asks each time.
3. Error results carry no `mode` (the contract says output schemas describe successes only). Not a honesty hole, since no result is returned.
4. If something else listens on port 8891, `ensureServe` sees "listening" and `local_url` points at that process. I could not exercise it without touching the real port.
5. The guard's engine gate was verified for exposure "direct". If `mcp.json` is edited to "codemode" or "deferred", nested calls reach the same hook by the registered name according to Pi source, but I did not run it.
6. The bridge and app coverage numbers cover only the new logic modules (as scoped). The glue (bridge `/chat` wiring, the card component) is proved by the e2e only. Not hollow, but not unit-covered.
7. 1440-approval.png is scrolled, so the badge is not in frame there; the badge is in 1440-quote, 390-done and 1440-done. The quote is readable and nothing is cut or overflowing at 1440 or 390 (the test also checks scrollWidth).
8. My probe started a detached static server (PID 37644) and rewrote the git-ignored `.runtime/serve.json` in the real engine home. I killed the server; ports 8787, 4173, 8891 and the probe port have no listener (netstat, only TIME_WAIT).

VERDICT: PASS
