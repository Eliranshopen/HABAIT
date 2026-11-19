VERDICT: FAIL
(One reproduced defect, D3, Low: a replaced runner that is hard-killed after its LATE settle and before its `syncSpent` leaves `cost.spent_usd` below the ledger's settled sum for good on a job that is already `done`. The gate was stable, 13 of 13 plus 2 loaded runs. Round 4's D2 is fixed. About 95 real kills and about 88 real takeovers did not break anything else.)

# QA live round 5, milestone 0.3. Fresh reviewer
Engine `C:\RnD\Projects\3Dengine` @ `1e359d4` (git main). Contract read in full (13 wins over 12, 11, 10, 1-9), then `qa-live-r4.md`, `ledger.mjs`, `runner.mjs`, `manifest.mjs`, `control.mjs`, `heavy-lock.mjs`, `jobs.mjs`, `lib/atomic.mjs`, `lib/proc.mjs`, `stages/stub.mjs`, `mcp/stub-engine.mjs`, `tests/soak/lib.mjs` (and the head of the m0.3 test). Nothing in the repo was changed except this report and the `qa-r5-*` files beside it. Every run used a temp home (`ENGINE_HOME`, jobs dir inside it), a free port, never `jobs/`, never 8891, no `.env`, no network.

## What I ran
Scripts (copies beside this report as `.txt`; originals in `C:\Users\elira\AppData\Local\Temp\claude\76e6db1160dffba0\40c3c5f2-e1ea-4dd3-baf1-ad71447227fd\scratchpad\qa-r5\`): `qa-r5-script-h.mjs.txt` (invariant checker computed from the three files, `sends.log`, `runner.log`; never the engine's summary), `-key` (D2, O-E, direct `createPaidCall`), `-lockbusy` + `holder.mjs` (O-G), `-storm` (suites A B C D E F with real runners), `-late` (D3), `-misc` (holder, lockstress, cap, ended, over). Result lines: `qa-r5-results.txt`. Gate runs: `qa-r5-gate-runs.txt`.
The invariants: parse; no `reserved` row at done / when quiet; `orphaned` only with `sending_at`; `not_sent` never with `sending_at`; no settled row without `sending_at`; at most one settled row of a call that is neither `late` nor `resend_of`; sends.log lines <= rows marked sending; settled rows <= sends; `spent_usd` = settled sum when quiet; settled + held <= cap in force; one valid manifest row per stage and no repeated stage without damage; no runner crash line; no overlapping `rendering` rows; no heavy lock left.

Own real kills (`process.kill` of a runner pid I could see in `runner.pid`/the heavy lock): counted by my script 92, plus the first D3 runs (13 more kill attempts, not in the counter): about 95. Own real takeovers (a second runner owns `runner.pid` while the first is a live, blocked process): 75 counted plus 13 in the first D3 runs: about 88. Baseline soak, not counted: `node tests/soak/kill-soak.mjs --kills 30 --freezes 30 --seed 5150` gave `kills=39 takeovers=30 second_runner_kills=8 (5 inside a pause) never_sent_rows=5 late_rows=3 violations=0`, and its clean-up said no process remained.

| Suite | What | Count | Kills | Takeovers | Result |
|---|---|---|---|---|---|
| A | freeze at `<paid>:sent`, a live foreign process holds `job.lock` (real withFileLock holder, a planted live-pid lock, or a lock whose mtime is refreshed), wake, KILL the runner while it waits in `keep()`, free the lock, THREE runners start at the same instant | 10 | 10 | 0 | 10 pass |
| B | kill at a random stage and delay, a random pause hook (reserve / cache / settle) on the first runner, THREE runners spawned at the same instant | 20 | 18 (2 had already finished) | 0 | 20 pass |
| C | takeover at a random point (stage start, `:reserved`, `:sent`), second runner with or without a pause; then (a) wake the first, (b) kill the second then wake the first and spawn a third, (c) wake and spawn two more at once | 30 | 9 | 52 | 30 pass |
| D | job killed at `packaging` or `qa`; 1-3 outputs of EARLIER stages damaged (delete, truncate, flip a byte, append, empty), paid stages included; resume | 14 clean + 14 (5 void, my script: see below) | 28 | 0 | 14 of 14 pass |
| E | cancel inside the reserve / cache / settle pause of each paid stage, restart the same PDF | 9 | 0 | 0 | 9 pass (the manifest row of the paid stage is written, one settled row) |
| F | dead-process locks (job.lock, empty job.lock, job.lock with a newline, heavy.lock.guard, heavy.lock, runner.pid) planted after a kill, then resume; time to first progress | 14 | 14 | 0 | 14 pass; longest 1135 ms (the empty lock, as §10.4 says) |
| G | runners started by hand for a done job (4 at once, 3 times) and a cancelled job; two jobs + heavy lock, the holder killed in `rendering` (4) | 8 | 4 | 0 | 8 pass |
| cancel-frozen | cancel while the runner is blocked at `:sent`, wake, restart | 2 | 0 | 0 | 2 pass |
| cap | takeover at `skinning:sent` / `gating:sent` with calls of $25, cap 60 | 2 | 0 | 2 | 2 pass |
| L | D3 (below) | 3 + 10 + 8 + 8 + 3 | see D3 | 29 | 2 of 10 natural runs (no hook) and 3 of 3 hooked runs fail only the `spent_usd` line |
| lockstress | 6 and 10 worker processes, 600 to 2000 critical sections each run, an injector that keeps planting dead-pid locks (takeOverStale races): 6 runs, 6600 sections | 6 | 0 | 0 | lost updates 0, overlaps 0 |
Void in D: the first 14-run batch used `finishing` as a kill target; the `finishing` call of the resumed stage is its own first call, so "ledger grew 2 -> 3" was my script's mistake (5 of 14, all `kill@finishing`); I removed that target and re-ran 14 clean. Void in cap: my third case (`finishing:sent`, cap 60) never reaches the send because 3 x $25 hits the cap first; not an engine fault.

## Claim A, the gate
| Command | Runs | Result | Duration |
|---|---|---|---|
| `timeout 300 npm test` | 5 | 5 pass, 0 fail (239/239 each) | 75-76 s |
| `timeout 200 node --test tests/milestones/m0.3.test.mjs` | 8 | 8 pass, 0 fail (16/16 each) | 73-75 s |
| the same two under CPU load (20 busy node processes on 20 logical cores) | 1 + 1 | both pass (16/16, 239/239) | 153 s each |
13 of 13 unloaded, 2 of 2 loaded. Claim A holds as measured. Section 13 item 5 ("about 75 seconds, about three times that under heavy load, timeout 300 or more") is true: 75 s unloaded, and my load made it about 2x (153 s), well inside 300 s.

## Round 4's items
| Item | Answer | Evidence |
|---|---|---|
| D2 (two same-key calls at once send twice) | **Answered.** n = 2, 3, 10 and send delays 0, 50, 800 ms: always `sent=1`, one row, the same answer for every caller. A failing send (n = 2, 3; delays 0, 300): `sent=1`, one `failed` row, every caller gets the same error. The same key again after the first finished: no send (success) or one new send with the failed row kept (failure). Different keys at once: 3 calls of 500 ms ran side by side in 552 ms; with cap 1.0 one send and two `BUDGET_CAP`, with cap 1.2 two sends | `qa-r5-results.txt` (`D2 ...`) |
| D2, the same key in ANOTHER attempt / runner while the first is in flight | Not the same case, and behaves as sections 12.3 / 13.1 say: the second call turns the first row `orphaned`, sends, the first answer comes back `settled/late`: 2 sends, 2 settled rows, `spent` 1.2 | `D2-other-instance` lines |
| O-E (planted cache files) | **Answered as the contract states it.** 10 variants with an UNMARKED reserved row (cache with the right seq, no seq, seq null, seq as a string, seq right with `settled_usd` 50, two unmarked rows, garbage, answer null): never settles, the unmarked rows end `failed/not_sent`, one send, `spent` 0.6. An unmarked row next to a marked one: the marked one owns the cache. Marked / orphaned rows with a cache are settled from it, `sent=0`. See observation O-J: for a MARKED row the file's own `settled_usd` is what `spent_usd` follows (50 gave 50, -5 gave -5) | `O-E ...` lines |
| O-G (job lock busy between the send and the cache write) | **Answered, as section 13 item 3 says.** Lock held by a live process for 1 s: no retry line, 1 send. 5 s (real holder): 1 retry line, 1 send. 12 s (real holder, and a planted live-pid lock): taken over after 10 s, 2 retry lines, 1 send. 40 s with the lock file's mtime refreshed (a lock that cannot be taken over): the answer is lost after 30 s (7 retry lines), row 1 `orphaned`, the call is sent again by the next attempt, `skinning sends=2`, job ends `done`, no runner crash. A runner KILLED while it waits in `keep()` (also 10 runs in suite A with three simultaneous resumers): `orphaned` + one new send, never more than the rows marked `sending_at`. So a paid call can be sent twice because a file lock is held by a live process for over 30 s; section 13 item 3 says exactly that | `O-G ...` lines |
| O-F (an orphaned row stays orphaned) | **Stated truthfully.** Rows `2:orphaned 3:settled` appear in 7 of 16 L runs (the first runner killed before its late settle); the hold stays and counts toward the cap | `L1` lines |
| O-H (gate time) | **Stated truthfully** (above) | gate table |

## Sections 10 to 13, read as a lawyer
Every "always / never" line was tied to code or to a run. Lines I tied to code only, with no run of my own that could show a violation (the code is plain): 10.4 (the lock is created by a hard link of a temp file, so it is born with its content; the empty-lock timing I did run in F: 1135 ms), 10.5's heartbeat during an approval wait (timer), 11.2 (`syncSpent` reads the ledger inside the job lock). Lines for which I built an attack and found the code does not make them true with real timing:
- **Section 10 rule 2 / section 3 "spent_usd = the ledger total, updated after every settle" and the claim "spent_usd ends equal to the sum of the settled rows once every runner is gone"**: recomputed at runner start, in the `finally` of every `paidCall`, and before `done`. A late settle by a replaced runner after the job is `done`, followed by a kill before that `finally`, breaks it and nothing repairs it afterwards (a `done` job gets no runner). This is defect D3.
Contract gaps (not defects, see observations): O-I (a billed amount above the estimate crosses the cap), O-J (a planted file decides `spent_usd` for a marked row).

## Own attacks on B and C (table above gives counts; one line per claim)
| Claim | Attack | Result |
|---|---|---|
| B: same key = one call | D2 matrix, 18 combinations plus other-attempt and different-key cases | pass |
| B: cache is an answer only for a row whose send started | 21 planted-file cases | pass (O-J aside) |
| B: a busy lock does not lose the answer | 8 lock-holder variants, 4 durations, kill inside `keep()` | pass; 40 s refreshed lock gives the stated loss |
| B: no `reserved` at done; `orphaned` only with `sending_at`; sends <= marked rows; second settled row only `late` / `resend_of` | checker run after every one of ~150 real scenarios | no violation |
| B: `spent_usd` = settled sum once every runner is gone | L (late row after done, killed late runner) | **FAIL, D3** |
| B: counted total never crosses a cap in force | caps 60 with $25 calls, takeovers at `skinning:sent` and `gating:sent`, orphan holds, late rows; checker polled at the end | pass (the job stopped at the cap twice, approval 75 / 200 finished it, final counted <= cap). O-I |
| B: reaching the cap is never a dead end | the same | pass; after a cap stop caused by an orphan hold that later settles `late`, the quote is stale (it still says $75 / $100 although fewer dollars are needed): approval 60 is refused, 75 works. Not a dead end |
| C: no lost stage, no repeated finished stage | suites A to G | pass |
| C: a replaced runner writes nothing more | C: 30 takeovers with wake at random moments; checker: no extra rows, `runner.pid` of the owner never touched | pass |
| C: two jobs never overlap in `rendering` | G: holder killed 4 times, plus the earlier suites | pass, no heavy lock left |
| C: a damaged or deleted earlier output is rebuilt byte for byte, no later stage runs again, ledger does not grow | D: 14 clean runs, 28 damaged outputs of every kind, paid stages included; compared sha256 before / after, manifest rows, sends.log, ledger rows, cache folder | pass |
| C: a lock left by a DEAD process never blocks a resume for more than about 2 s | F: 14 cases | pass, longest 1135 ms |
| C: a runner started for a job that has ended leaves at once, takes no `runner.pid` | G: 12 runners for done jobs, 2 for a cancelled one | pass: each gone within 112 ms, job / ledger / manifest bytes unchanged, no pid file |
| lock mutual exclusion under dead-holder takeovers (not a contract line, a risk I read in `takeOverStale`) | lockstress, 6600 sections, injector planting dead locks | 0 lost updates, 0 overlaps |
| cancel during a paid call (§10.6) | E (9) and cancel-while-frozen (2) | pass: the stage writes outputs and its row, one settled row, restart finishes, nothing repeated |

## Defect
**D3 (Low) A replaced runner killed after its late settle and before its `syncSpent` leaves `cost.spent_usd` wrong for good. Breaks section 10 rule 2 (derived: "recomputed ... after every `paidCall`"), section 3 ("`job.cost.spent_usd` = the ledger total of settled amounts, updated after every settle") and the stated end state "`spent_usd` ends equal to the sum of the settled rows once every runner is gone".**
Steps (`qa-r5-script-late.mjs.txt`, `node late.mjs 3 SETTLE skinning:sent`, temp home, `runner.staleSeconds` 1): (1) runner 1 is blocked at `skinning:sent` (the call was sent, the answer is in hand) and has `ENGINE_TEST_PAUSE_AFTER_SETTLE_MS=20000`; (2) the same PDF is started again: runner 2 takes the job over, re-sends the call and finishes the job: `done`, `spent_usd` 1.8; (3) the wake file is created: runner 1 writes its late row (`settled`, `late: true`) and enters the pause that sits between the settle and the `finally` that calls `syncSpent`; (4) `process.kill(runner 1)`. Expected: `spent_usd` equals the settled sum (2.4), or something repairs it. Actual: settled sum 2.4, `job.cost.spent_usd` 1.8, `get_result` reports `cost.spent_usd` 1.8, runner gone, and `start_simulation` for the done job starts nothing, so no later runner ever syncs. 3 of 3 with the hook, in `qa-r5-results.txt` twice (the first three runs and the repeat at the end). With NO hook, a hard kill at a random 0-80 ms after the wake: 2 of 10 hit the window naturally (`rows=1:settled/late 2:settled`, `spent_usd=1.8`, settled 2.4); the same attack at `gating:sent` and `finishing:sent` (16 runs) did not hit it (the window is a few ms; the killed runner was often already gone, which is why the kill count is lower than the run count). This is the round-1 defect ("a kill between the settle and the update left it too low for good") surviving on one path: the fix recomputes at the next runner's start, and a `done` job has none.
Severity: Low. The ledger itself is right (the late row is there and `settled`), only the summed figure in `job.json` / `get_result` is too low by one call's price, and it needs a late answer plus a hard kill or crash inside a window of a few milliseconds.

## Observations
- **O-I** The cap is a reservation, not a ceiling on billing: a call whose provider bills more than `estimate_usd` makes the counted total cross the cap (direct `createPaidCall`, estimate 0.6, billed 5, cap 1.0: counted 5; the next call is then refused with `BUDGET_CAP`, so it is not a dead end). The stub bills exactly the estimate, so nothing in 0.3 shows it; section 13's "never crosses a cap" is true only for billed <= estimate. A real stage needs a billed-vs-estimate rule.
- **O-J** For a `reserved` / `orphaned` row WITH `sending_at`, a cache file decides the settled amount: `settled_usd` 50 gave `spent_usd` 50, -5 gave -5, "abc" gave 0 (the row is `settled`, `recovered`). Section 13 item 2 says "`spent_usd` follows what was billed, never a file", which holds for unmarked rows only (tested). A hand-edited or corrupted cache of a marked row is a way to move `spent_usd`; the contract treats the cache as the record of what was billed and does not say how an impossible amount is judged.
- **O-K** After a cap stop caused by a presumed-lost row (`orphaned`) that later settles `late`, the new quote still counts the old hold twice over (quote $75 for 3 x $25 calls where the late answer made the real need lower for a moment). Approval of the quote's amount works; a smaller cap is refused. Cosmetic.
- **O-L** `closeRow` after a FAILED send is not wrapped in `keep()`: a lock that is busy at that moment throws `lock busy` in place of the call's own error, and the row stays `reserved` with its mark until the next attempt turns it `orphaned` (a failed call that then holds its estimate toward the cap for the life of the job). Code reading only; I did not reproduce it with a real failing provider.
- Section 13 item 3's 30 s bound is real but the engine blocks its own heartbeat while it waits (`sleepSync` inside the lock wait): during a 40 s refreshed lock the runner looked dead (`heartbeat skipped` lines) and a resume started in that time would have taken the job. Safe by the fencing of section 10 rule 9; stated only in part by section 11 item 5.
- Contract gap: the contract does not say what `get_result.cost.spent_usd` shows when late rows exist after `done` (D3).

## Process check
Command as given, run after my last script and after the kill-and-cleanup of my own temp homes (every `E.cleanup` printed no leftover pid):
```
(empty)
```
