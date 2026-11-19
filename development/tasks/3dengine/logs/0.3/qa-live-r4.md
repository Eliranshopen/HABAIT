VERDICT: FAIL
(One reproduced defect, D2: contract section 12 item 5 "never two sends" is not true for two calls with the same key in one stage. Low severity. The gate was stable, 13 of 13. Round 3's D1 is fixed. Claims B and C were not refuted by about 190 real kills and 105 real takeovers.)

# QA live round 4, milestone 0.3. Fresh reviewer
Engine `C:\RnD\Projects\3Dengine` @ `42be630`. Contract read in full (12 wins over 11 over 10 over 1-9), `qa-live-r3.md` read, then `ledger.mjs`, `runner.mjs`, `manifest.mjs`, `control.mjs`, `heavy-lock.mjs`, `jobs.mjs`, `lib/atomic.mjs`, `stages/stub.mjs`, the soak lib and the m0.3 tests (16 and 13 in detail). Nothing in the repo was changed except this report and the `qa-r4-*` files beside it. Every run used a temp home, a free port, never `jobs/`, never 8891, no `.env`, no network.

## What I ran
Scripts (copies beside this report: `qa-r4-script-h.mjs.txt` = invariant checker and runner-chain helpers, `qa-r4-script-chain.mjs.txt`, `qa-r4-script-misc.mjs.txt`; originals in `C:\Users\elira\AppData\Local\Temp\claude\76e6db1160dffba0\40c3c5f2-e1ea-4dd3-baf1-ad71447227fd\scratchpad\qa-r4\`). Every result line: `qa-r4-results.jsonl.txt` (cut to 1200 chars per line). The invariants are computed by my own code from the three files, `sends.log` and `runner.log`, never from the engine's summary: parse; no `reserved` row at done / while quiet; `orphaned` only with `sending_at`; `not_sent` never with `sending_at`; at most one settled row of a call that is neither `late` nor `resend_of`; a row with `sending_at` after a non-late settled row must carry `resend_of`; sends.log lines <= rows marked sending; non-recovered settled rows <= sends; `spent_usd` = settled sum when quiet; settled + held <= cap (also live, polled during every wait); one valid manifest row per stage, no repeated stage when I did no damage; no runner crash line; no live pid in `runner.pid` at done; no rendering overlap across jobs; no leftover heavy lock.

| Script / mode | What | Scenarios | Real kills | Takeovers | Kills of 2nd / 3rd runner | Violations |
|---|---|---|---|---|---|---|
| `chain.mjs d1` | D1 matrix: paid stage (skinning, gating, finishing) x pause hook of runner 2 (RESERVE, CACHE, SETTLE) x runner 1 woken before the kill / after the kill / after runner 3 started (runner 3 plain or blocked at the next stage); runner 2 killed inside its pause | 27 | 27 | 27 | 27 / 0 | 0 |
| `chain.mjs rand` seeds 5 | chains of 3-4 runners, each with a random freeze point (stage, `:reserved`, `:sent`), a pause hook or nothing; kill or takeover at each link; random mid-chain wakes; random wake order at the end | 40 | 49 | 28 | 20 / 3 | 1, my own checker's false positive (a runner I killed at the instant of done left a dead pid in `runner.pid`; checker fixed to flag only a LIVE pid) |
| `chain.mjs cap` seeds 7, 9 | the same with calls of $25 and caps 48 / 60 / 75 / 80 / 100, approvals raised after each BUDGET_CAP | 25 clean (+3 void, see below) | 25 | 22 | 8 / 4 | 0 |
| `chain.mjs randc` seed 11 | the same plus cancel and restart between links | 30 | 37 | 24 | 12 / 9 | 0 |
| `misc.mjs edit` | job dead at `packaging`; one cache file edited by hand (delete, garbage, empty, seq 99, no seq, seq null, seq as string, `settled_usd` changed, whitespace only, no answer, answer null) + output of the stage deleted; control | 24 | 24 | 0 | 0 / 0 | 0 |
| `misc.mjs state` | runner killed with a reserved row not yet marked (`skinning:reserved`) or with the answer in hand (`skinning:sent`); a cache file written by hand (none, seq right, no seq, seq 77, usd 0, usd 50); next runner | 12 | 12 | 0 | 0 / 0 | 0 (observation O-E) |
| `misc.mjs ended` | runners started by hand for a done job (3 at once), while another finishes it (6 spread over the run), for a cancelled and a failed job | 10 | 6 | 0 | 0 / 0 | 0 (2 void: my script judged an old pid file, fixed and re-run clean) |
| `misc.mjs heavy` seed 3 | 3 jobs, random freeze at rendering/building/tracing, kills, takeovers, wakes in random order; overlap check | 8 | 9 | 4 | 0 / 0 | 0 |
| `misc.mjs key` | two paid calls with the same key at once through `createPaidCall` | 5 | 5 | 0 | 0 / 0 | 5 of 5 (D2) |
| Total | | 181 (+3 void) | about 194 | 105 | 67 / 16 | D2 only |

The 3 void cap runs: my first cap setting started with a $30 cap, below the $48 quote; the engine correctly refused it and my script waited for 24 h of approval. Not an engine fault; the processes were killed and the setting changed to 48 and up.
Baseline soak (not counted): `node tests/soak/kill-soak.mjs --kills 30 --freezes 30 --seed 4417` gave `kills=38 takeovers=30 second_runner_kills=7 never_sent_rows=9 late_rows=3 woke_before_done=12 violations=0`.

## Claim A, the gate
| Command | Runs | Result | Duration |
|---|---|---|---|
| `timeout 300 npm test` | 5 | 5 pass, 0 fail (236/236 each, coverage gate passed: all files 99.6 / 96.5 / 96.8) | 75-76 s each |
| `timeout 200 node --test tests/milestones/m0.3.test.mjs` | 8 | 8 pass, 0 fail (16/16 each) | 74-76 s each |
Total 13 of 13 (`qa-r4-gate-runs.txt`). Not tested: a loaded machine (I did not run the gate under CPU load this round, so the slow-machine risk below is from reading only). From reading: part 11 `dtA/dtB < 5000` (resume latency), part 5 `waitFor ... 30000`, part 6's 15 ms poll that must see the 400 ms window, and the 5 s kill-gone waits are the remaining bounds that a machine 3x slower than round 3's could miss. Round 3 saw a loaded full run take about 180 s; with this commit an unloaded run takes 75 s (round 3: 62 s), so a 120 s tool timeout on the whole gate would be tight on a loaded machine. Observation, not a defect.

## Round 3's items
| Item | Answer | Evidence |
|---|---|---|
| D1 (a `reserved` row left for ever after late answer + kill of runner 2 + runner 3) | **Answered.** The exact recipe (runner 1 at `skinning:sent`, runner 2 with RESERVE pause, wake 1, kill 2, run 3) ends `1:settled/late 2:orphaned`, no `reserved`, one send, `spent` 1.8, in 27 of 27 variations over three paid stages, three pause hooks, wake before / after the kill / after runner 3 started. With the CACHE pause runner 3 gives `settled/late` + `settled/recovered`; with SETTLE `settled/late` + `settled`. Cap with callUsd 25 and cap 80/100 did not stop with a phantom hold in any of 25 cap chains | `qa-r4-results.jsonl.txt` (`d1`, `cap`) |
| O-A (cache lost = paid again) | **Stated truthfully** (section 12 item 4) and behaves exactly as stated: every edit of a cache file (11 kinds x 2 stages) gave a resend, the new row carries `resend_of`, the control (cache intact, output deleted) never grew the ledger. Cost of the edit: spent 1.8 -> 2.4 | `edit` lines |
| O-B (three sends: late + orphan resend) | **Stated truthfully** in section 12 item 3, and reproduced for real: `g2:settled/late g3:orphaned g4:settled` and `g2 late, g3 settled, f4 settled/late` appear in `d1`/`rand` lines, every send has a marked row, none violated an invariant | `d1` gating W=2 frozen, `rand` |
| O-C (tests speed-dependent) | **Partly answered**: parts 6, 9, 15 now use the wake file and part 11's bound is 5 s; 13 of 13 clean. Not tested under load (see Claim A) | table above |
| O-D (a killed run leaves detached processes) | **Stated truthfully**: `tests/CLAUDE.md` names the command. My own runs left none (see the last section) | process check |

## Attacks on B and C
| Attack | Result |
|---|---|
| Runner 2 killed inside RESERVE / CACHE / SETTLE pause while runner 1 is woken before, after or later than the kill, runner 3 plain or blocked (27) | PASS 27/27 |
| Chains of 3-4 runners, kills AND takeovers at every link, freeze at `<stage>`, `:reserved`, `:sent`, pauses, mid-chain wakes (70, with and without cancel/restart) | PASS (the one hit was my checker, fixed) |
| Kill of the third runner (16 real), kill of the second (67 real) | PASS: no `reserved` left at done, no `orphaned` without `sending_at`, no extra settled row that is not `late` / `resend_of`, sends <= marked rows |
| Late answer while the third runner is inside its own reserve/pause (d1 W=2 with runner 3 blocked at the next stage, and random chains) | PASS |
| Two blocked runners woken in random order, with random delays | PASS |
| Kill / block between reserve and the `sending_at` mark (`:reserved`, 12 `state` runs plus chain points) | PASS: row ends `failed` + `not_sent`, nothing held, sent once |
| Cache edits in 11 ways with settled rows; hand-written caches with reserved rows (marked / unmarked) in 12 ways | PASS against the contract; see O-E |
| Ledger + cap, calls of $25, caps 48-100, takeovers, late rows, cancel: counted total polled live and at the end | PASS: counted never above the cap in force; no job ended `failed`; every BUDGET_CAP was answered with a larger approval and ended `done` |
| Cancel and restart in the middle of the chains (30 + 60 random links) | PASS |
| A runner started by hand for a done job (3 at once, 2 runs), while another runner finishes it (6 extra runners each, 2 runs), for cancelled and failed jobs (4 runs) | PASS: each left within 120 ms, never took or created `runner.pid`, job/ledger/manifest bytes unchanged, the job still reached done |
| 3 jobs, one heavy lock, freezes, kills, takeovers (8) | PASS: no overlapping `rendering` rows, no heavy lock left |
| Damaged / deleted outputs: not re-attacked beyond the `edit` runs (output deleted, rebuilt; ledger did not grow in the control) | PASS |
| Two same-key calls at once | **FAIL (D2)** |

## Defect
**D2 (Low) Two calls with the same key at the same moment send TWICE. Breaks contract section 12 item 5 ("One call per key at a time ... the second closes the first one's reservation and the first stops before its send: never two sends").**
Steps (`qa-r4-script-misc.mjs.txt`, function `keyScenario`, run `node misc.mjs key`): a job with an approval in a temp home; `const pc = createPaidCall({ jobsDir, jobId, stage: 'skinning', attempt: 1 })` (the same function a stage gets as `ctx.paidCall`); `Promise.allSettled([pc(spec, fn), pc(spec, fn)])` with the same `spec.key` and an `fn` that counts sends. Expected: one send, the first call fails with `STAGE_FAILED`. Actual: `sent = 2`, both calls fulfilled, rows `1:settled/late 2:settled`, both billed. 5 of 5 (send delays 50, 300, 800 ms).
Cause by reading: `call()` runs `decide`, `confirm` (which sets `sending_at`) and starts `fn()` in one synchronous run, so the second call, which can only start afterwards, always finds the first row `reserved` WITH `sending_at` (a send in flight) and turns it `orphaned` (section 3 / 12 item 3 treats it as unknown), then sends. The "first stops before its send" branch can never happen with real timing; the unit test `tests/unit/resilience.test.mjs` "two calls with the SAME key at once" only passes because its `beforeSend` hook edits the ledger by hand. No real stage does this today (the stub makes one call per stage), so nothing is billed twice in 0.3; it matters for a real stage. The ledger records both sends truthfully, so no other invariant breaks.

## Observations
- **O-E** A cache file written by hand without `seq` (or with the right `seq`) settles a reserved row that was NEVER marked as sending (`recovered`, `settled`, no `sending_at`, zero sends): ledger shows a settled row with no send, `spent_usd` follows the file's `settled_usd` (a hand file with 50 gave `spent` 51.2). This is the "legacy file without seq" path of `decide()` and hand editing; section 12 item 1 names failed rows and sha mismatches but not an unmarked reserved one. Not a violation of a binding line.
- **O-F** A settled row can carry no `sending_at` (see O-E) and an orphaned row whose runner died BEFORE its `fn` ran (kill inside the RESERVE pause) stays `orphaned` for ever when the answer is in the cache from another row: its $ keeps counting toward the cap (`d1 ... H=RESERVE`: `1:settled/late 2:orphaned`). Stated truthfully by section 3 / 12; with callUsd 25 it costs headroom but never made a dead end here.
- **O-G** A transient `lock busy` between the send and the cache write (code reading, not reproduced): the answer in hand is lost, the retried stage finds a `reserved` row WITH `sending_at` from its own runner, marks it `orphaned` and sends again. Consistent with the sections, but a second paid send caused by a file-lock timeout, not by a kill.
- **O-H** The gate takes 75 s here against 62 s in round 3 (machine speed), see Claim A.
- Open in the contract: the contract does not say what the first of two same-key calls does once its send has started (D2); it does not name the unmarked-reserved row in the legacy-cache path (O-E).

## Process check
Command as given. Output after my last run (before this report was written) and again after deleting my temp homes: empty. During the run one kept temp home and no process of mine was left; the 3 void cap runs were cleaned by their own scripts.
```
(empty)
```
