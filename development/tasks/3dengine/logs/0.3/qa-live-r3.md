VERDICT: FAIL
(One reproduced defect, D1: a `reserved` ledger row is left open for good after a late answer plus a kill of the second runner. The gate itself was stable: 18 of 18 unloaded runs passed. Claims B, C, D were otherwise not refuted.)

# QA live round 3, milestone 0.3. Fresh reviewer
Engine `C:\RnD\Projects\3Dengine` @ `d74f5fc`. Contract read in full (11 wins over 10 wins over 1-9); `qa-live-r2.md` read. Nothing changed in the repo except this report and the `qa-r3-*` files beside it. Every run used a temp home, free ports, never `jobs/`, never 8891. Real detached runners, hard kills with `process.kill(pid)`, freeze hooks with `ENGINE_TEST_FREEZE_WAKE`, the three pause hooks. Invariants are computed by my own code from the files (`qa-r3-script-q.mjs.txt` `inv()`): the three files parse; no `call_key` settled twice unless the extra row is `late`; sends.log lines against ledger rows; at most one valid manifest row per stage; `spent_usd` equal to the settled sum when quiet; counted total never above the cap in force (skipped when a late row exists); no `reserved` row at `done`; no rendering overlap across jobs.

## What I ran
Scripts: `C:\Users\elira\AppData\Local\Temp\claude\76e6db1160dffba0\40c3c5f2-e1ea-4dd3-baf1-ad71447227fd\scratchpad\qa-r3\` (copies `qa-r3-script-*.mjs.txt` beside this report).

| Script | What | Real kills | Takeovers / lock losses |
|---|---|---|---|
| `k.mjs` seeds 11, 21, 22, 23 (8+10+10+10 jobs) | 1-3 kills per job at event or delay (job.lock present, `.tmp` present, reserved, cache-unsettled, heavy.lock, heavy.lock.guard, state, row count), pause hooks on half; output damage while DEAD (1 to 4 of delete / garbage / truncate / flip) and while ALIVE; resume; check | 66 | 0 |
| `t.mjs latekill` seed 31 (8) | late answer + kill of the SECOND runner in each pause window + third runner; first woken before / during / after the third | 8 | 16 |
| `t.mjs wakewin` seed 41 (8) | wake the blocked first runner inside the second's reserve / cache / settle window | 0 | 8 |
| `t.mjs spentrace` seed 51 (8) | wake at a random moment while the owner works | 0 | 8 |
| `t.mjs cancel` seed 61 (8) | takeover + cancel + wake at random order, then restart | 0 | 16 |
| `t.mjs cap` seed 71 (6) | takeover + late answer + the cap (callUsd 25) | 0 | 6 |
| `t.mjs heavy3` seeds 81, 92 (13) | 3 jobs, holder frozen in `rendering`, takeover of the lock, wake early / during / late, hard kill of the new lock holder | 1 | 13 |
| `r1.mjs` (8 reps) | repro of D1 | 8 | 16 (8 takeovers + 8 third runners) |
| `c1.mjs` (3) | cache folder deleted / garbage + paid-stage output deleted, runner dead | 3 | 0 |
| Total | | **about 87** | **about 83** |

Baseline (not counted): `node tests/soak/kill-soak.mjs --kills 30 --freezes 20 --seed 7331` gave `SOAK kills=35 ... takeovers=20 never_sent_rows=6 late_rows=2 woke_before_done=12 violations=0`.

## Claim A, the gate
| Command | Runs | Result | Duration |
|---|---|---|---|
| `timeout 200 npm test` | 8 | 8 pass, 0 fail (228/228 each, coverage gate passed) | 62-63 s each |
| `timeout 120 node --test tests/milestones/m0.3.test.mjs` | 10 | 10 pass, 0 fail (15/15 each) | 60-61 s each |
| the same file with 24 CPU-bound node loops of mine on 20 logical CPUs | 3 | 2 pass (177 s, 179 s); 1 killed by MY 180 s timeout while test 15 was running (14 passed, no assertion failed) | about 3x slower |

G1 is answered in my runs: 18 of 18 unloaded runs passed (round 2: test 11 failed about 4 in 10). Tests 11 and 13 passed in every run, loaded ones included. I read the tests for one-look or clock-bound assertions: test 11 `dtA < 2500` / `dtB < 2800` (resume latency), test 9 `spent_usd` within 3000 ms of a resume, test 15 `before = rows tracing..finishing` taken after `E.kill` (packaging must not have finished in the 400 ms stub step between the state look and the kill), test 6 `waitedWhileOtherRendered.size === 1` (a 15 ms poll must see a 400 ms window). They are the remaining ways to fail on a slow machine. Under 3x slowdown none failed in 2 complete runs; I did not get a failing run, so this is an observation, not a defect. Note: a loaded full run takes about 180 s, so a 120 s tool timeout on that command would fail on a loaded machine.

## Round 2's items
| Item | Answer | Evidence |
|---|---|---|
| G1 | **Answered** (18/18 clean; loaded 2/2 complete runs clean) | gate table, `qa-r3-gate-runs.txt` |
| O1 (late answer reachable) | **Answered**. `<paid stage>:sent` reaches the late answer; 16 late rows seen in my runs (wakewin 3, spentrace 5, cancel 6, cap 3, latekill 2), each `settled` + `late: true`, both sends in sends.log, cache of the second runner kept, never a third send in a plain takeover | `t.mjs` outputs, rows `settled/late` |
| O3 (`syncSpent` in the lock) | **Answered**. 8 wake-at-random runs plus the late runs: `spent_usd` equal to the settled sum every time both runners were gone (including the late rows: 1.8 -> 2.4) | spentrace, cancel, cap |
| O7 (outputs rebuilt) | **Answered**. Damage while dead (1 to 4 outputs, four ways) and alive, 66 kills: every job ended `done`, 0 violations; `c1 cache-none-output-only` ledger 3 -> 3, spent 1.8, each paid stage sent once | `k.mjs`, `c1.mjs` |
| O2, O4, O5, O6 | O2 and O4: stated truthfully in section 11 item 5. O6 (deleted `runner.pid` stops a healthy runner) follows from rule 9; O5 (flap with `staleSeconds` 1) is not mentioned; neither was a violation here. | contract §10 rule 9, §11 item 5 |

## Attacks on B, C, D
| Attack | Result | Evidence |
|---|---|---|
| 66 kills at event or delay, 1-3 per job, damage while dead / alive | PASS: 0 violations. First run of seed 11 reported one, a bug in my own check (a `recovered` row also consumed a send); fixed, seeds 21-23 clean | `k.mjs` |
| Late answer + kill of second in reserve window, first woken BEFORE the kill | **FAIL (D1)** | `qa-r3-repro-D1.txt` |
| Late + kill of second after cache / after settle, first woken before / during / after the third | PASS (rows `failed/ns,settled/rec` or `settled/late,settled`; sends <= rows; spent = sum) | latekill |
| Wake at the second's reserve / cache / settle windows | PASS 8/8 | wakewin |
| `spent_usd` race (random wake) | PASS 8/8 | spentrace |
| Takeover + cancel, wake in random order, restart | PASS 8/8: state stays `cancelled`, manifest does not grow, restart finishes | cancel |
| Takeover + late + cap (callUsd 25) | PASS 6/6 for ledger and sends; total never above the cap in force before a late row | cap |
| Heavy lock, 3 jobs, wake early / during / late, kill of the new holder | PASS 13/13: no overlapping rendering rows, no heavy lock file left | heavy3 |
| Claim C: damaged / deleted outputs, dead and alive, one or several, before and after the paid stages | PASS: ledger did not grow, paid stages sent once (only orphan resends counted) | `k.mjs` |
| Cache folder deleted or garbled + the output of `skinning` deleted | see O-A below | `c1.mjs` |

## Defect
**D1 (Medium-Low) a `reserved` row is never closed. Breaks contract section 3 item 3 / section 10 rule 1 ("only a reserved row with NO cache file becomes orphaned" and a reserved row of a dead runner has an unknown outcome and is closed), and the claim of section 10 rule 12 / section 11 item 6 that no reservation is left open.**
Steps (`qa-r3-script-r1.mjs.txt`): runner 1 frozen at `skinning:sent`; runner 2 takes over with `ENGINE_TEST_PAUSE_AFTER_RESERVE_MS` and reserves seq 2 (seq 1 becomes `orphaned`); wake runner 1 (it settles seq 1 `late` and caches the answer); kill runner 2 while seq 2 is still `reserved`; start a third runner. `decide()` answers from the cache at step 2 (the late row is settled with a matching answer) and returns before step 3, so seq 2 is never orphaned, never closed. Expected: no `reserved` row at `done`. Actual: `1:settled/late 2:reserved 3:gating 4:finishing`, the `reserved` row stays for ever. Its reserved amount counts toward the cap for the rest of the job: with callUsd 25 and a cap of 80 (three real calls cost 75) the job stops with BUDGET_CAP at `finishing` (2 of 2), because the phantom hold makes it 100. Reproduced 8 of 8 runs (callUsd 0.6: 3/3 `reserved` left; 25: 3/3; 25 with cap 80: 2/2 spurious cap stop). `spent_usd` stays right and the call is sent once; only the hold is wrong. Not found by the project soak (it never kills the second runner).

## Observations
- **O-A cache lost = a paid call is made again.** Deleting `cache/` or garbling its files together with the output of `skinning` while the runner is dead: `skinning` is sent a second time, a second `settled` row (not `late`), spent 1.8 -> 2.4 (2 of 2). The contract's section 3 item 2 specifies the fall-through, so it is consistent with the text, but it contradicts the headline "never billed twice"; the contract does not name the cache as a single point of failure.
- **O-B a `late` + orphan-resend combination can send a call three times** (first runner late, second killed after its send and before its cache, third resends as an orphan); every send has a row. I built the windows but did not catch that exact interleaving; code reading only.
- **O-C** tests listed under Claim A remain speed-dependent; a loaded run takes about 180 s.
- **O-D** my timeout kill of the loaded run 2 left three static servers (`cli.mjs serve`) of the test's temp homes; I killed those three pids (see below). The tests clean in `after`, which does not run when the test process is killed.

## Process check
Command (as given). First look, after my loaded run 2 was killed by my timeout: three `cli.mjs serve` processes of `m03-home-*`, `m03p13-*`, `m03p15-*` temp homes (pids 11792, 40376, 26988), mine from that killed run. I killed exactly those pids. Second look: output empty.
