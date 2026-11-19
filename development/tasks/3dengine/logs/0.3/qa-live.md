# QA live — milestone 0.3, claim: kill the runner mid-stage, resume, nothing lost / repeated / double-billed
Reviewer: qa-reviewer (fresh). Engine `C:\RnD\Projects\3Dengine` @ cdc4e1e. Probes in the session scratchpad (`...\scratchpad\qa\p1..p5.mjs`, temp homes, free ports, no real jobs/ or port 8891).

Check as written: `node --test tests/milestones/m0.3.test.mjs` = 7/7 pass; `npm test` = pass, 100% lines on engine/mcp.
Hooks ENGINE_TEST_PAUSE_AFTER_RESERVE_MS / _SETTLE_MS: in `engine/ledger.mjs` and `runner.mjs hooksFromEnv`, only `await sleep(ms)` when > 0; no other behaviour.

| # | Item | Result | What I tried / evidence |
|---|---|---|---|
| 1 | lose a stage | PASS | ~25 hard kills (p1): right after start (queued), exactly at a state change, twice in a row in one stage, at awaiting_approval, 6 random kills over skinning..qa, plus 60 kills of one job (p2). After every kill: no state past a stage without its done row; final job `done`, 8 stages, one live row each. |
| 2 | repeat a finished stage | PASS | Rows snapshotted after each kill and compared byte-for-byte after resume: none changed, none superseded, no second live row. Kill + cancel + restart (p4 d): done stages kept attempt 1. |
| 3 | double settle / spent_usd | FAIL | No `call_key` ever settled twice. BUT `spent_usd` can differ from the settled sum: see D1. |
| 4 | hidden reservation | PASS | Kill while reserved: row became `orphaned`, stayed in file, `engine ledger <job>` printed `ORPHANED 1: outcome unknown, $30 counts toward the cap`; counted toward the cap (D3). |
| 5 | heavy lock | PASS | B killed in `rendering`: lock file kept dead pid 25688; C took over (`pid 38900`), reached approval; resumed B waited with `waiting_for: heavy-lock`. No overlap seen. |
| 6 | corrupt files | PASS (files) | job/manifest/ledger parsed after every kill (p1, p2 x60). BUT a killed runner left an EMPTY `job.lock` (D2). |
| 7 | leftover processes | PASS | Every runner/serve pid checked dead after each probe (`left []`). No second live runner observed. |

## Defects
- **D1 (Low-Medium) `spent_usd` stale after a kill between ledger settle and job update.** `ledger.mjs` writes the settled row (line 140) and only then calls `updateJob` for `cost.spent_usd` (142). A kill in between leaves `spent_usd` low; the resumed run answers from the cache (line 86-92), which never updates `spent_usd`. Repro: run to finishing's settle (hook 4000 ms), kill, set `job.cost.spent_usd` to 1.2 (the state the kill window leaves), start again: final `done`, `spent_usd 1.2`, settled sum 1.8. Window is tiny; I did not hit it by a real kill (simulated disk state, flagged). Fix: on cache hit (and at runner start) resync `spent_usd` from the ledger.
- **D2 (Medium) empty `job.lock` after a hard kill blocks resume.** `withFileLock` (`atomic.mjs`) creates the lock with `wx`, then writes the pid; a kill between leaves a 0-byte lock, which is not "dead pid" and is only stale after 10 s. Real kill, 1 of 60 (p2): `start_simulation` threw `job <id>: lock busy` after 2025 ms; in p1 four such errors. Self-heals after 10 s. Fix: treat an empty lock older than ~1 s as stale.
- **D3 (Medium) a job that fails BUDGET_CAP after an orphan can never be given a bigger cap.** Cap 48, call 30: kill while reserved, resume -> orphan 30 + 30 > 48 -> `failed BUDGET_CAP`. `approve_paid_stage` -> `NOT_AWAITING_APPROVAL`; `start_simulation` restarts at `skinning` with the old cap (approval kept) and fails again. Stuck for good. (Cap below 48 cannot be approved at all, so this needs a real stage costing over half the cap.)
- **D4 (Low) cancel during a paid call still appends the manifest row.** Hook holds skinning's call 1.5 s, `cancel_job`: state `cancelled`, but manifest has a `skinning` row (contract 6: no row for an interrupted stage). Harmless: outputs exist, never repeated.

## Observations
- A kill after the cache write but before settle: row is `orphaned` and the call is sent again (re-billed); by contract 3.3 (outcome unknown) but the cached answer is ignored.
- `runner.pid` and heavy lock trust `pidAlive`; a recycled pid would look alive (not tested).
- `cap_usd` below the quote estimate ($48) is refused, so contract-9 "cap below reserved" cannot be reached with the stub amounts.

VERDICT: FAIL
