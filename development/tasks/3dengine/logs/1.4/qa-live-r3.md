VERDICT: PASS

# QA third round, milestone 1.4 (a saved reading)
Reviewed: live engine home C:\RnD\Projects\3Dengine, local main commit 2f249804 (git log -1 at start, 2026-11-19). Status at start: only generated CLAUDE.md files modified under Projects/3Dengine.

## My plan of attack on the lock (written before opening either earlier report)
Read from atomic.mjs and contract section 11 only.
1. One-winner claim: N real processes rename a prepared folder onto a free path at one moment; same onto an EMPTY folder (Windows MoveFileEx onto an empty dir), onto a folder whose release/break is half done, onto a dir in delete-pending state.
2. Break targets an exact entry name. Attack: holder releases and a new holder takes between a taker's look and its moveOut (fixed sequence through the `alive` option); same pid reused; same ms; breaker's removeEmpty hitting a folder that a new holder just filled.
3. Real storms with takers already INSIDE their wait before the event: holder killed (taskkill /F), holder exits in body, live holder stale by age; 2/4/8/16 takers; then the old holder's late release. Three generations; a taker broken right after taking.
4. Liveness by planting every intermediate state: *.new.tmp left, entry moved out + folder left, *.gone.tmp left, two entries, foreign file, sub-folder, old lock FILE (live/dead/empty/garbage), junction (also dangling), read-only parent, missing parent, long path, Hebrew and spaces; immovable entry (spin time, lock busy at waitMs).
5. fn once; fn throws -> release; release throws masks fn's error? a promise-returning fn released early? re-entrant take by same pid (self-deadlock until staleMs?).
6. pidAlive wrong answers (other-user pid, huge pid, pid 0), clock jump either direction, NaN/negative takenAt.
7. Callers: grep .lock/openSync/'wx'/renameSync in engine/ and mcp/; anything counting on look-then-act (claim, serve.json, superseded/<n>, first-look record); lock temp names reaching manifests, snapshots, reading show, or a store listing.

## Part A, the gate (progress saved)
| Command | Tests | Pass | Fail | Seconds | Load before | File |
|---|---|---|---|---|---|---|
| `timeout 540 npm run test:stages` | 13 | 13 | 0 | 482 (exit 0; the 1.4 file finished inside the limit this time, the known O-3 did not bite) | 11 pct | qa3-test-stages.txt, qa3-load-stages-before.txt |
| `timeout 300 npm test` | 434 | 434 | 0 | 131 | 4 pct | qa3-npm-test.txt, qa3-load-npmtest-before.txt |
| `node engine/cli.mjs doctor` | | READY | | | | qa3-doctor.txt |
| `git status --short -- Projects/3Dengine` before | 142 lines (generated CLAUDE.md files) | | | | | qa3-git-status-before.txt |

## Part B progress, scope A (lock), rows saved as finished
| Attempt | How many | Result | File |
|---|---|---|---|
| Fixed sequences, in-process (46 checks: states, old lock FILE x6, junctions x3, paths, parents, fn, alive-hook swaps x4, nested) | 46 | 45 ok; 1 FAIL was MY test (I planted a 17-digit time, which the name rule calls foreign; with a 16-digit time the lock runs: qa3-lock-16digits.txt) | qa3-lock-fixed.txt, qa3-lock-16digits.txt |
| My harness against the FIRST form (5c9b049f copy in a temp folder), holder killed, 4 takers waiting | 4 runs, 20 procs | 4 of 4 BAD (TWO holders + LOST hold): the harness does see the round-2 defect | qa3-lock-storm-kill-4-OLDFORM-5c9b049f.txt |
| Holder killed (TerminateProcess), takers already inside their wait | N=2,4,8,16 x 4 runs | 16 of 16 HEALTHY (0 two holders, every taker ran once, 0 lost hold) | qa3-lock-storm-kill-*.txt |
| Holder killed with taskkill /F, N=8 | 4 runs | HEALTHY | qa3-lock-storm-taskkill-8.txt |
| Holder exits inside its body | N=4,8,16 x 4 | 12 of 12 HEALTHY | qa3-lock-storm-exit-*.txt |
| Live holder silent past staleMs wakes mid-takers (late release): timeline shows it woke inside a taker's hold | N=4,8 x 4, + N=8 x 3 with timeline | all HEALTHY; the woken holder's release touched nothing | qa3-lock-storm-age-*.txt |
| Three generations: holder killed, then the first 3 takers to get in killed inside | N=4,8,16 x 4 | 12 of 12 HEALTHY | qa3-lock-storm-gens-*.txt |
| Barrier start (all at the same ms), 3-5 take/release cycles each, counter read-modify-write + overlap marker: free path, empty folder, dead entry, left *.new.tmp, left *.gone.tmp | N=16 x 5 runs each; N=32 free x5, dead entry x4; N=8 free x3 | all counters exact (0 lost updates), 0 TWO | qa3-lock-bar-*.txt |
| The exclusive step measured with 8 real processes: rename of a prepared folder onto a free path / an EMPTY folder / a full folder | 30 rounds each, 720 procs | free: exactly 1 winner in 30 of 30; onto an empty folder: 0 winners (EPERM); onto a full one: 0 | qa3-rename-free.txt, qa3-rename-emptydir.txt, qa3-rename-fulldir.txt |
| Entry that cannot be moved (open with no share by another process) | 3 cases | breaker: `lock busy` at waitMs (1513 ms for 1500) and runs once the handle is freed. RELEASE with an immovable entry: fn ran, its return value is LOST and a raw EBUSY is thrown; the lock stays held (O-3); a throw of fn is masked by it (O-3) | qa3-lock-immovable.txt |

## Why PASS
No binding line of contract 1.4 was broken, in either scope. Lock: about 2,370 real processes, 0 runs with two holders, 0 lost updates, 0 lost holds, in every shape that broke the first and second forms (holder killed, exits, silent past staleMs; takers already inside their wait; 3 generations; barrier starts). The same harness against a copy of the first form (5c9b049f) fails the kill case 4 of 4 and the age case 3 of 3, so it can see the defect. Store, command, stage, settings: 197 forged records, 70 store checks, 98 disk-full scenarios, 33 CLI checks, 254 settings checks, 4 real-tool runs, all held. O-2 and O-3 are the nearest to a defect; neither breaks a binding line as written.

## Part A, the gate
Rows are in "Part A (progress saved)" above. Git status before and after for Projects/3Dengine: identical (qa3-git-status-before.txt, qa3-git-status-after.txt). Commit seen: 2f249804 (HEAD at start); no later commit seen.

## Part B, scope A, additional rows
| Attempt | Result | File |
|---|---|---|
| First form (5c9b049f copy), holder silent past staleMs, 8 takers | 3 of 3 BAD (7 TWO + 1 LOST each): contract 11's claim that the age test fails on the first form holds; kill case 4 of 4 BAD (above) | qa3-lock-storm-age-8-OLDFORM.txt |
| Callers: grep of withFileLock, .lock, openSync, wx, renameSync in engine/ and mcp/ | only job.lock (withJobLock), heavy.lock.guard (3 uses), store.lock; nothing else relies on rename or unlink being exclusive; lock temp names are matched by no listing (intake TEMP_RE is source.pdf.N.tmp; listJobs filters job ids; pairOf and supersededCount look at fixed names) | READ |
| PORT-CHANGES line: diff of auto-trace.mjs against a63494a ignoring line ends | exactly the two listed hunks (4 inserted, 2 removed); blob id equals the listed c55bfe16 | qa3-port-diff.txt |

## Part B, scope B
| Attempt | How many | Result | File |
|---|---|---|---|
| Store functions: keep, same again, superseded 1..5, reader change by one byte of a COPY of the tool or model file (stale, then found again), tool missing or a folder (TOOLCHAIN_MISSING), bad inputs of keep, _meta hostile (13 cases), layouts (record only, reading only, folder where file belongs, file where folder belongs, junctions, leftover temp files, superseded as a file, dead and foreign store.lock) | 70 checks incl. 197 forged-record variants (each field missing, wrong type, impossible date, 24:00:00, 31 Feb, zones, sentences, 1e999, BOM) | 0 failed (my first run had 2 false failures of my own test, fixed and rerun); nothing found that should not be; stale only when the reader differs | qa3-store-attacks.txt |
| Disk full at EVERY file operation of a keep (deps.fs stand-in): first, replace, replace over a lone file; one failure and disk-stays-full | 98 scenarios | the old reading is never destroyed, the lock is released, no text in errors, a clean keep afterwards works | qa3-store-diskfull.txt |
| Many keeps from real processes of one PDF, all at once; HOLDER of store.lock killed at random moments inside its hold (3, 6, 8 kills) while others wait | 392 processes, 33 runs | every record whole, superseded/ without a gap, every keep that said kept is on disk, clean keep afterwards found; a kill mid-supersede leaves a split pair (O-4) | qa3-keeps-*.txt |
| Settings: every numeric field of engine.config.json x 11 non-number values and 3 raw texts; defaults-only fields; readingsDir 7 non-text values; env overrides | 236 + 18 | all refused by name except stub.callUsd=null and an empty env override (O-5) | qa3-config-attack.txt, qa3-config-attack-2.txt |
| The command in a temp home with a planted FAKE key: usage mistakes, import dry / --go / again / different / non-readings, show for none, found, stale, bad, trace DRY answers (judge on, --fresh, --fresh with --vlm-file exit 2), a marker sentence in every string field | 33 checks | 32 ok; the 1 FAIL was my regex (the stale sentence says "another reader": qa3-cli-stale-bad-words.txt); no marker in any output | qa3-cli-attack.txt |
| REAL tool a: kept reading (imported fixture), trace --go --budget 0.5 --no-judge, drawing id | 1 run, 219 s | 0 requests, $0, plan.general.json = pinned 5e03e678..., trace_date 2026-11-06 | qa3-real-a-kept-go-nojudge.txt |
| REAL tool b: same, record plan_date planted 2031-12-31 | 1 run, 217 s | 0 requests; the only differing field of the plan is plan_meta/trace_date (the record's day) | qa3-real-b-planted-plan-date.txt |
| REAL tool c: --fresh --go --no-judge with a kept reading (scripted model) | 1 run, 236 s | exactly 1 request (the deliberate fresh reading), kept, superseded/1, record date = today UTC = plan trace_date, no room name in the output | qa3-real-c-fresh-go.txt |
| REAL tool d: kept reading + --go, judge ON | 1 run, 443 s | 3 requests, all ledger rows auto-trace-judge, no reading call; same plan bytes as c | qa3-real-d-kept-go-judge.txt |
| A job never writes the store or pays | READ | keepReading is called only by cli.mjs (paid trace, import); the stage calls findReading only; the stage tier (13 of 13) ran a real job at $0 | grep |

## Earlier defects again, against the new code
Round 1 D-1 (short-lived processes, two holders): barrier starts, 712 processes, 0 two-holders, 0 lost updates. Round 2 D-1 (killed holder, several takers waiting): kill storms 136 processes, taskkill 36, generations 124, exit 124, takers inside their wait before the event, 0 overlaps; the first form fails the same script. Round 1 O-2, O-4, O-5 closures held (24:00:00 refused; readingsDir non-text refused; a failed write keeps the old pair, but see O-2).

## Defects
None.

## Observations
- O-1 (1.4, store): a hand-made folder superseded/999999999 makes later keeps overwrite earlier superseded pairs (numbers above 9 digits are not counted): 3 of 5 paid readings lost. PROVEN with a planted folder (qa3-store-numbering-overflow.txt); unreachable by use (10^9 supersedes). Cap or refuse.
- O-2 (1.4, store; nearest to a defect): after the old pair is moved into superseded/n and before the new files are renamed in, a failure or a kill leaves the PDF `none` while the valid old reading sits in superseded/n; the next run asks to pay again. Contract 1 says a failing write leaves the old pair standing: true for writes, not for those two renames. PROVEN (qa3-store-demote-window.txt). Fix: move back on failure, or supersede last.
- O-3 (0.3 lock, seen at 1.4): a release that cannot move its entry (a scanner holding it more than 1 s) throws a raw EBUSY AFTER fn ran: fn's return value is lost, fn's own error is masked, the lock stays held until stale, and isTransient(EBUSY) may make a caller run the work twice. PROVEN (qa3-lock-immovable.txt).
- O-4 (1.4, store): a keeper killed between the two renames of the supersede leaves a split pair (record in superseded/n, reading in superseded/n+1); nothing is lost (qa3-keeps-16-kill*.txt, split-pairs column).
- O-5 (1.4, settings): stub.callUsd null is read as absent, not refused; empty env overrides are ignored (by design).
- O-6 (1.4, dates): a reading whose _meta.at is far in the future (9999-12-31) sets the plan date to it (a valid day).
- O-7 (lock): a killed taker or keeper leaves *.new.tmp folders and reading.json.*.tmp files that nothing removes (cosmetic; the reading temp files hold reading text).
- O-8 (lock): a live holder loses its hold when the clock moves further than staleMs in either direction (documented in section 11); nested take of one lock in one process waits staleMs, then runs inside (fixed check).
- O-9 (stage tier): this time npm run test:stages ended inside 540 s (482 s, 13 of 13): the known O-3 of round 2 did not bite on this run.
- As decided in contract 10: model copied when model-id shaped (a one-word marker in _meta.model is copied); the command's id is the caller's.

## What I did NOT do
- Took no lock in and wrote nothing to the real home's readings or jobs folder; no port 8891; no real provider call (all four real runs used the scripted-model preload and a planted FAKE key, in temp homes).
- Did not run the author's lock-race.test.mjs against the first form (rule 6: no swapped tracked file); my own harness was used instead.
- No real clock jump under a running holder (read from the code only).
- No full-disk test of the lock's own operations (atomic.mjs uses the real fs); no long path beyond 294 characters.
- No MCP server plus a job runner against the store lock together (the stage tier covers one job).

## Cleanup
No process of mine left (checked); temp homes removed; my scripts are in C:\Users\elira\AppData\Local\Temp\q3 and copied as qa3-script-*.txt. Key-like scan of qa3-* and this report: only variable NAMES (present or missing) and the planted FAKE key text in a script.
