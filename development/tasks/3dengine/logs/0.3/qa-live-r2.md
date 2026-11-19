VERDICT: FAIL
(The FAIL rests on one item only: contract §7 says `npm test` passes, and it does not pass reliably: test 11 fails about 4 runs in 10. The kill and takeover claim itself was NOT refuted: 0 violations in 164 real kills, 86+ real takeovers or lock losses, and the project's own soak.)

# QA live round 2, milestone 0.3. Fresh reviewer
Engine `C:\RnD\Projects\3Dengine` @ `8a2fab3` (git main). Contract read in full; section 10 wins. Nothing changed in the repo except this report and the `qa-r2-*` evidence files beside it. All runs used temp homes under the system temp folder, free ports, never `jobs/` and never port 8891. Real runner processes, hard kills with `process.kill(pid)`, real suspension with `NtSuspendProcess` (a persistent PowerShell, only pids the script spawned itself).

## What I ran
Scripts are in `C:\Users\elira\AppData\Local\Temp\claude\76e6db1160dffba0\40c3c5f2-e1ea-4dd3-baf1-ad71447227fd\scratchpad\qa-r2\` (copies: `qa-r2-script-*.mjs.txt` beside this report). Every check is done by my own code from the files (`q.mjs` `inv()`): the three files parse; no call_key settled twice; no stage with two valid rows; no later stage with a row while an earlier one has none; sends.log count against ledger rows (a send beyond 1 + orphaned/late/failed rows is a violation; a non-recovered settled row without a send is a violation); ledger total never above the cap in force; `spent_usd` equal to the settled sum; no `reserved` row left at `done`; rendering rows of different jobs never overlap.

| Script | What | Real kills | Takeovers / lock losses |
|---|---|---|---|
| `a1-events.mjs` (2 runs, seeds 101 / 202; callUsd 0.6 and 25 with cap 60) | 60 jobs, kills fired by EVENT with a 1 ms poll: job.lock present (the holder dies inside its lock), a `*.tmp` file present (mid atomic write), `reserved`, cache written and not settled, state changes, manifest row counts, settled counts, heavy.lock / heavy.lock.guard present, fixed delays; 1 to 3 kills per job; the three pause hooks on the first runner | 60 | 0 |
| `a4-disk.mjs` | kills in 10 states + disk attacks (see table) | 34 | 0 |
| `r1-round1.mjs` | round-1 items D1 to D4 and observations, with real processes | 47 | 0 |
| `a6-races.mjs race` | double / triple `start_simulation` right after a kill (2 or 3 runners alive together); cancel and restart at once (10) | 6 | 0 |
| `a6-races.mjs capkill` | kills around the cap-reached transition | 10 | 0 |
| `a2c-combo.mjs kill2` | kill of the SECOND runner after a takeover, third resume | 4 | 8 |
| `a2d-heavy.mjs` | heavy lock with 2 or 3 jobs | 3 | 12 |
| `a2a-freeze.mjs` (seeds 301, 302) | hook freeze at random points, replaced | 0 | 25 |
| `a2b-pid.mjs` | manual second runner; runner.pid deleted, rewritten (foreign live pid, garbage, empty, 0, dead pid) under a live runner; rewritten while a call is reserved / already cached | 0 | 16 (12 ownership losses + 4 manual second runners that must exit) |
| `a2c-combo.mjs cancel`, `cap` | takeover + cancel (6); takeover + cap reached (3 valid) | 0 | 9 |
| `a3-suspend.mjs` (seeds 902, 1401) | REAL suspension of a runner for 1.5 to 3.3 s (and 4 x 11.5 s) at random delays and at events (lock, tmp, reserved, cache, states, heavy lock), a second runner started meanwhile, the first woken | 0 | 24 |
| `a6-races.mjs heavysusp` | 2 or 3 jobs, the heavy-lock holder really suspended | 0 | 10 |
| `a5-lockrace.mjs` | 6 processes fighting for ONE lock that is re-planted stale (dead pid / empty-old) every 2 ms, 20 s each, 14934 critical sections | 0 | n/a |
| Total | | **164** | **about 104** (a2a 25, a2b 16, a2c 17, a2d 12, a3 24, a6 10) |

Baseline: `node tests/soak/kill-soak.mjs --kills 40 --freezes 15 --seed 4242` → `SOAK kills=42 jobs_finished=6 orphaned_rows=1 recovered_rows=0 resume_retries=0 longest_resume_ms=36 takeovers=15 never_sent_rows=3 woke_before_done=11 violations=0`, exit 0 (`qa-r2-soak.txt`). Not counted in my numbers.

Gate: `timeout 540 npm test` → exit 1. **221 tests, 220 pass, 1 fail**, 58 s. Coverage line gate passed (all files 99.59 % lines, 96.34 % branches, 96.73 % functions). The failure is test `11. an EMPTY job.lock does not block a resume…`, assertion `no lock left behind` (`m0.3.test.mjs:452`) (`qa-r2-npmtest.txt`). See defect G1.

## Round-1 items

| Item | Result | Evidence |
|---|---|---|
| D1 spent_usd stale after a kill between settle and update | **FIXED** | `r1-round1.mjs`: used PAUSE_AFTER_SETTLE, which is exactly that window (row settled, `syncSpent` not yet run). 4 real kills inside it: at the kill `spent_usd` 0 (or 0.6) while settled 0.6; 0.5 s after the resume it equals the settled sum; final 1.8 in all 4, skinning sent once. Also `a4` D1: `spent_usd` hand-set to 99, -5, "abc", null, 0 while the runner was dead: all corrected at the runner start (1.2) and at done (1.8); set to 123 under a LIVE runner: corrected by done. |
| D2 empty job.lock after a hard kill blocks resume | **FIXED** (rule 10.4) | 40 real kills, 35 of them with job.lock present at the instant of the kill: 0 empty locks left, longest resume 43 ms. Old locks planted by hand: empty-fresh 1.04 s, empty-old 51 ms, garbage-fresh 1.06 s, garbage-old 19 ms, dead pid 28 ms, pid 0 / negative / float about 1.04 s, live foreign pid older than 11 s 21 ms. The only slow ones are live-foreign, see O2. |
| D3 BUDGET_CAP after an orphan = dead end | **FIXED** (rule 10.3) | callUsd 30, cap 48, kill while reserved, resume: state `awaiting_approval`, `reason.code BUDGET_CAP`, quote 60, `cap_reached: true`, `approval` null, `approvals` 1. `approve_paid_stage` 60 accepted, the job went on to `done` (a second cap stop at 90 and a larger approval on the way); ledger `skinning:orphaned, skinning:settled, gating:settled, finishing:settled`; counted total never above the cap in force. Also 10 more kills around the cap transition (`a6 capkill`): all reached `done` with a larger approval. |
| D4 cancel during a paid call still appends the manifest row | **CHANGED BY RULE 6** | Cancel with the call in flight: state `cancelled`, manifest has `skinning#1` (the call settled), no `gating` was started, runner gone, restart goes to `done` with skinning sent once. This is the behaviour rule 6 now prescribes. |
| Obs 1: kill after the cache write is re-billed | **FIXED** (rule 10.1) | PAUSE_AFTER_CACHE, real kill: one row, `settled`, `recovered: true`, sends 1. 4 more kills with `cacheUnsettled` as the event in a1/a2c. |
| Obs 2: recycled pid looks alive | **FIXED** (rule 10.5) | runner.pid = this script's own live pid, pid file and heartbeat 60 s old: `runner.alive` false, `resumed: true`. Variant with a FRESH pid file mtime: reported alive until about `staleMs` after the write (by design, a runner that has just started), then not. |
| Obs 3: cap below the quote is refused, so "cap below reserved" cannot be reached | **UNCHANGED, still true** | `approve_paid_stage` cap 1 → `BUDGET_CAP` "below the estimate $48". A hand-made `awaiting_approval` with `approval: null` and 2 settled calls, approved with 48: accepted and the job finished with total 1.8, so nothing crossed. |

## Own attacks, results (every row: 0 violations unless said)

| Attack | Result | Evidence |
|---|---|---|
| 60 event-triggered kills (lock held, tmp present, reserved, cache-unsettled, state changes, heavy.lock(.guard) present, rows:n, delays), 1 to 3 per job, hooks on the first runner | PASS: every job `done`, 8 stages, one valid row each, 3 settled, `spent_usd` = settled sum | `qa-r2-a1-run1.txt`, `a1-run2.txt` |
| Two and three kills in a row in one job; kill while waiting for approval (state:awaiting_approval, 12+ times); kill at queued (`delay:1`, `delay:5`) | PASS | a1, a4 D5, r1 |
| Resume of a job killed in each of the 8 stages, in `awaiting_approval`, hand-set `failed` / `review` / `cancelled` | PASS (all resumed, all `done`, `reason` cleared) | `qa-r2-a4-run1.txt` D5, D5b |
| Output of an earlier stage changed / deleted while killed in `packaging` | PASS for lose / repeat. The runner goes back, redoes that stage and everything after it. Inputs changed, so by §9 the paid calls get new keys and are billed again (6 settled, `spent_usd` 3.6 = settled sum). My own first check called this a double bill; it is the documented keying, not a defect. Rows: old ones kept and `superseded`. | a4 D2 |
| Kills of the SECOND runner (event: delay, joblock, tmp, reserved, cacheUnsettled, heavyfile) with the first still blocked, third resume | PASS (4 kills landed, 4 not; the replaced runner always left by itself) | `a2c-kill2.txt` |
| Hook-frozen runner replaced at 25 random points (every stage and `<paid>:reserved`) | PASS: replaced runner wrote no row for the stage it was blocked in or after, every paid call sent once, no open reservation, 'stopped: superseded' logged, runner.pid left to the second runner | `a2a-run1.txt`, `a2a-run2.txt`. One setup in 26 did not replace (see O5). |
| Real suspension at random moments, 24 times, 1.5 to 3.3 s, plus 4 x 11.5 s | PASS (after wake: no row, no state change, no double send; the woken runner left by itself) | `a3-run1.txt`, `a3-long.txt` |
| Manual `node engine/runner.mjs <id>` while the first runner is alive (4 states) | PASS: the second exits (busy), runner.pid never changed, it wrote no row | `a2b-run1.txt` B1 |
| runner.pid deleted under a live runner (tracing / building / rendering / awaiting_approval) | The runner stops (it no longer owns the job), resume works, all `done`. Job is stalled until a resume (by design) | B2 |
| runner.pid rewritten to a live foreign pid / garbage / empty / 0 / dead pid | PASS: the real runner stops; resume after 1.8 s always starts a new one. A live foreign pid with a FRESH pid file looks alive for one stale window (reported `runner.alive true` for that moment) | B3 |
| runner.pid rewritten while a call is reserved (twice) / already cached | Reserved: first row `failed` + `not_sent`, the second runner reserves and sends ONCE. Cached (call already sent): row settles, no resend, sends 1 | B6 |
| Takeover + cancel (6), cancel at once + restart (10) | PASS: state stays `cancelled`, the manifest stops growing, restart finishes, no done stage rerun, no double send | `a2c-cancel.txt`, `a6-race.txt` |
| Takeover + cap reached (3 valid; callUsd 25) | PASS: not_sent row frees the hold, cap stops, larger approval continues; sends 1 each; total never above cap. (2 more setups were invalid: the freeze point is unreachable with cap 60, my script's fault.) | `a2c-cap.txt` |
| Double and triple `start_simulation` right after a kill: 2 to 3 runners alive together | PASS: one wins, no double send | a6 race A0 to A7 |
| Heavy lock, 2 or 3 jobs: holder frozen at `rendering` (3), lock file garbage / empty / deleted / naming a dead pid / naming a live foreign pid (5, under a LIVE healthy holder), holder hard-killed holding it (3), holder frozen + cancelled (1) | PASS: never two overlapping rendering rows; a holder that lost the lock gave attempt 1 up with no row and ran as attempt 2 | `a2d-run1.txt` |
| Heavy-lock holder really suspended, 10 times (9 with the lock in its hand), 2 or 3 jobs | PASS, no overlap, holder rendered as attempt 2 | `a6-heavy.txt` |
| 6 processes + a saboteur re-planting a stale lock every 2 ms | PASS: 0 mutual-exclusion violations, 0 lost updates (7326 + 7608 sections) | a5 |
| A job whose `job.lock` holds a LIVE foreign pid | See O2 | a4 D3 |

## Defects
**G1 (Low) the gate `npm test` does not pass reliably. Breaks contract §7 ("the whole suite passes").**
Test `11. an EMPTY job.lock does not block a resume…` fails at its last line, `assert.equal(fs.existsSync(job.lock), false, 'no lock left behind')`. Reproduced: gate run 1 of 1 (exit 1, 220/221); the test alone 3 of 5; the m0.3 file 1 of 4 (and 0 of 3 earlier) → about 4 of 10. Cause (checked): not a left-over lock but a race in the test. The runner of the job (awaiting approval, heartbeat every 0.1 s in this test) takes `job.lock` for every heartbeat, so the assertion catches it present now and then. My probe (`p11.mjs`, 8 jobs, sampling the lock every ~15 ms for 2 s, about 130 samples each): the lock was present in 1 sample of 1039, never for more than one sample. Expected: a stable test. Actual: the closing test fails a share of the runs. Also `13. a live runner that gives no sign of life is replaced…` failed 1 of 12 runs of the m0.3 file; the cause was not captured (the first failure was seen without its text; 11 later runs passed). Engine behaviour is not affected.

No other defect. I did not reproduce any loss of a stage, repeat of a finished stage, second bill of a call, wrong `spent_usd`, crossed cap, dead end at the cap, lock blocking a resume after a dead holder (longest: 1.06 s), recycled pid looking alive, write by a replaced runner, or overlap of heavy rows.

## Observations
- **O1 (the rule-10 exception) not reached.** I never saw a `late` row. The window "call on the wire when the runner is replaced" needs a replacement during `fn()`. The stub call has no duration; the hooks pause BEFORE the send (reserve) or AFTER it (cache, settle), so only B6 "cached" came near it (settles, no resend). Untested: a replaced runner whose call is in flight while the second sends the same call.
- **O2 a `job.lock` naming a LIVE foreign pid blocks `start_simulation`.** `lock busy` is thrown after 2.0 s and keeps being thrown until the lock is older than 10 s (fresh: 10.0 s over 5 tries; 6 s old: 4.0 s over 2 tries). Same when a runner is really suspended while it holds the lock: 7 of 24 suspensions in `a3` made `start_simulation` throw `lock busy` up to 4 times. Contract rule 4 and the claim are about a lock left by a DEAD process (those are taken at once), so this is not a breach. But it is a recycled-pid hazard for `job.lock` and the heavy `.guard`: a dead holder whose pid was reused by any other live process blocks for 10 s, and the caller gets an exception, not a wait. The contract is silent on it.
- **O3 `syncSpent` is not behind the ownership guard, and reads the ledger outside the job lock** (`ledger.mjs` lines 72 to 80; called by `paidCall`'s `finally` and by `runner.spent()`). A replaced runner can still write the DERIVED `cost.spent_usd` after it was replaced, and a stale value can in theory overwrite a newer one for a short time (it is corrected at the next sync and before `done`). Code reading only; I could not hit it with real processes in about 100 takeovers, and every final `spent_usd` equalled the settled sum. Rule 9 says a replaced runner makes "no state change"; this write is a value that does not change meaning, so I did not call it a defect.
- **O4 rule 11 (suspension INSIDE a locked section longer than 10 s) was not exercised.** The persistent PowerShell needs a few tens of ms to suspend a pid, so the 4 x 11.5 s suspensions aimed at `job.lock` all landed after the lock was released. 4 other suspensions (short) did land with the lock held and showed only the `lock busy` of O2.
- **O5 a flap with `staleSeconds: 1`.** In one `a2a` setup (packaging, 1 of 26) the harness saw `runner.alive false`, then `start_simulation` answered `created false, resumed false` (alive again). I could not reproduce it (14 repeats at the same point). Most likely a healthy runner stalled for more than 1 s on a loaded machine (another session is running a heavy job) and then beat again. With the default 10 s it should not show. Reported, unconfirmed.
- **O6 a deleted or rewritten `runner.pid` makes a healthy runner stop** (it thinks it was replaced) and leaves the job stalled until a resume. Correct per rule 9, noted because a stray `rm runner.pid` has that effect.
- **O7 a re-run of an earlier stage costs money again** (a changed or deleted output sends the runner back; the paid calls of every later stage have new keys and are billed again). Correct by §9 ("keyed on the stage's inputs hash"). Worth a line in the real engine's docs: a stage's output must be byte-stable for a rerun not to re-bill the stages after it. The stub's `stub.json` holds the attempt number, so every rerun changes it.
- Concurrency note: up to 3 runners were alive for one job (double and triple starts); one always won within 3 s and the others left, as designed.

## Process check (before finishing)
Command: `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -match 'runner\.mjs|kill-soak|cli\.mjs serve|qa-r2' } | Select-Object ProcessId, CommandLine | Format-List"`
Output: (empty; exit 0). Nothing of mine remains. Every temp home I created was removed by its own clean-up.
