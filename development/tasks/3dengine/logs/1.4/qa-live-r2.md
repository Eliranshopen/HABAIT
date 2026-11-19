VERDICT: FAIL

# QA round 2, milestone 1.4: a saved reading (second review, the lock first)

## What was reviewed
Live engine home `C:\RnD\Projects\3Dengine` on local `main`, commit `c647cdd8` (seen with `git -C C:/RnD log --oneline -1` on 2026-11-18). Reviewer: fresh sonnet, read-only. Scope A (the lock, contract 1.4 section 11) was attacked; scope B was covered only by the gate (see "What I did NOT do"). The review was cut by a network error on the evening of 2026-11-18 and finished on 2026-11-19 from saved files only; no attack was run after the cut.

## Why FAIL (one defect, D-1)
Contract 1.4 section 11 says take-over is one atomic rename that "succeeds only while THAT hold is still in place", so exactly one taker takes over a dead holder. With several takers already waiting on a holder that is KILLED, several of them take over at once and run `fn` together: 10 of 10 runs in `qa2-lock-takeover-overlap.txt`; 4 of 8 runs in `qa2-lock-kill-sleeper-dead.txt`. The lock guards a job's files, the heavy lock's guard and the readings store, so this is the same class of hole as the first round's D-1, on the crash path instead of the exit path.

## Plan of attack on the lock (written after reading engine/lib/atomic.mjs and before opening qa-live.md)
Reading of the code: take = rename of a prepared folder onto the path (one winner on NTFS, a rename onto an existing folder fails); release = rename own entry out, rmdir; take-over = rename old entry to my entry inside the folder.
Suspected weak points, to test:
1. Look-then-act steps: (a) state held and stale, then the take-over rename; (b) state empty, then rmdir; (c) state file, then unlink; (d) release's rmdir loop after the entry left; (e) the `alive` check between look and act.
2. Mutual exclusion with REAL short-lived processes: N holders (8, 16, 32) each doing a read-modify-write on a counter under the lock; the sum must equal N and an overlap marker must stay clean.
3. Killed holder (taskkill /F) with takers waiting: exactly one takes over.
4. A holder that sleeps past staleMs and wakes: its release must not touch the taker's lock.
5. Fixed sequences by hand: planted states (free, empty, two entries, foreign file, sub-folder, old lock file live/dead/empty/garbage, future time, huge time, dead/live pid, leftover `*.new.tmp` and `*.gone.tmp`), and the `alive` hook changing the holder between look and act.
6. Paths: spaces, Hebrew, very long, missing parent, read-only parent, junction at the path.
7. Callers: any code still using the old file lock; any listing that may mistake lock temp names for data.
8. Errors from fn pass on and the lock is released; fn runs exactly once.

## Part A, the gate
| Command | Tests | Pass | Fail | Seconds | Load before | File |
|---|---|---|---|---|---|---|
| `npm run test:stages` (first run) | 8 test lines passed; `m1.4.test.mjs` cut by the 540 s limit (537 s inside it) | 8 | 0 (1 file cut = time) | 540 | 1 pct | `qa2-test-stages.txt`, `qa2-load-stages-before.txt` |
| `node --test tests/stages/m1.4.test.mjs` (resumes from its checkpoint) | 3 | 3 | 0 | 271 | 2 pct | `qa2-test-stages-m14-rerun.txt`, `qa2-load-stages-rerun-before.txt` |
| `npm test` | 432 | 432 | 0 | 149 | 1 pct | `qa2-npm-test.txt`, `qa2-load-npmtest-before.txt` |
| `node engine/cli.mjs doctor` | | READY | | | | `qa2-doctor.txt` |
| `git status --short -- Projects/3Dengine` before and after | 142 lines both, no difference | | | | | `qa2-git-status-before.txt`, `qa2-git-status-after.txt` |

Note: the stage tier cannot end in 540 s even on a quiet machine (load 1 pct) because the 1.4 test makes two real runs of about 270 s; the checkpoint lets a second run finish it. Time, not a failure.

## Part B, my attempts (lock, scope A)
| Attempt | How many | Result | File |
|---|---|---|---|
| N short-lived holders on one lock, counter read-modify-write plus `wx` overlap marker (shape of the first round's D-1) | N=8: 20 runs, 160 processes; N=16: 10 runs, 160; N=32: 6 runs, 192 | 0 two-holders, 0 errors, 0 lost updates. The first round's D-1 does NOT reproduce | `qa2-lockrace-counter.txt`, `qa2-script-race.txt`, `qa2-script-race-child.txt` |
| Fixed sequences, planted states, in-process | 32 cases | 32 of 32 behave as section 11 says (free, empty folder, dead, live fresh/old, future and huge times, two entries, foreign file, sub-folder, bad entry name, old lock FILE dead/live/aged/empty/garbage, leftover `*.new.tmp`/`*.gone.tmp`, Hebrew and spaces, missing parents, long path, junction to empty and to held, fn throws, return value, three `alive` swaps between look and act, taken-over holder's release leaves the taker's entry, nested same lock busy). My first run had 4 false failures of my own test (staleMs below waitMs); fixed and rerun | `qa2-lock-fixed.txt`, `qa2-script-fixed.txt` |
| Killed holder (taskkill /F), 4 takers waiting | 8 runs, 40 processes | 4 runs with several takers inside at once (run 0: four enters within 3 ms, exits together) | `qa2-lock-kill-sleeper-dead.txt`, `qa2-lock-kill-log-run0.txt`, `qa2-script-kill.txt` |
| Minimal repro: planted entry of a live process of mine, 4 takers waiting, that process killed | 10 runs, 40 takers | 10 of 10 runs overlap | `qa2-lock-takeover-overlap.txt`, `qa2-script-trans.txt` |
| Holder silent past staleMs wakes while its taker holds; a third waits | 5 runs, 15 processes | the third never entered while the taker held; the woken holder's release left the taker's lock (A and B overlap by design) | `qa2-lock-kill-sleeper-dead.txt` (sleeperBad 0) |
| 8 takers at once on one planted dead entry | 20 runs, 160 processes | 0 overlaps (takers start apart; a clean race proves little) | same file (deadRaceBad 0) |
| Debug COPY of `atomic.mjs` in my temp folder logging each take-over rename | 10 runs, failing run kept | four takers each logged the rename of the SAME source entry as `done` | `qa2-lock-takeover-rename-debug.txt`, `qa2-script-atomic-dbg-copy.txt` |

Counts: about 780 lock processes in all, none left; 32 fixed checks; 0 real-tool runs of my own (2 in the gate's stage tier). The first round's D-1 (reproduction against the new code): 36 runs, 512 holders at once, 0 two-holders.

## Defects
**D-1. A killed holder is taken over by SEVERAL waiting takers at once (contract 1.4 section 11: take-over "succeeds only while THAT hold is still in place"; never two holders).**
- Steps (minimal, `qa2-script-trans.txt`): make a lock folder `x.lock` holding one entry `h.<pid of a live process of yours>.<now>.abcdef01`; start 4 node processes that each call `withFileLock(x.lock, fn, { waitMs: 60000, staleMs: 10000 })` where `fn` logs enter, sleeps 60 ms, logs exit; after 500 ms `taskkill /F` the planted holder's process. Result: 10 of 10 runs, the four `fn` overlap (`qa2-lock-takeover-overlap.txt`). Through real lock use (a holder process of `withFileLock`, killed, 4 takers waiting): 4 of 8 runs (`qa2-lock-kill-sleeper-dead.txt`, `qa2-lock-kill-log-run0.txt`).
- Cause: the symptom is PROVEN, the mechanism is READ. Proven: in the debug copy each of four takers logged `moveEntry(lock/<same dead entry>, lock/<own new name>) = done` (`qa2-lock-takeover-rename-debug.txt`): four renames of ONE source name all report success. Read, not proven: on Windows a rename opens the source by name and then renames the open file by handle, so renames that all opened it before the first one finished all succeed and the file just moves again; a rename by name is therefore not a compare-and-swap, and section 11's central claim does not hold for take-over. It shows when several takers poll in step, as they do after a holder dies; takers that start apart rarely show it.
- Reach: a crash of any command holding a job lock, the heavy lock's guard or the readings store lock while two or more commands wait; likely also a holder silent past staleMs (same code path, not run). For the readings store: two keeps of one PDF inside at once can lose the record of a paid reading.

## Observations
- O-1 (1.4, section 11): an entry whose time is far in the future (or 16 digits) with a LIVE pid is never stale; the lock stays busy until that process ends. Hand-forged only; cap `takenAt` at now or say so in section 11.
- O-2 (1.4 tests): `tests/unit/lock-race.test.mjs` starts takers apart; no test kills a holder with takers waiting. Add one with the fix.
- O-3 (stage tier): needs two real runs of about 270 s for 1.4, so the card's `timeout 540` Check cannot pass in one run on a quiet machine; the checkpoint covers it.

## What I did NOT do, and why (the next reviewer starts here)
I stopped on the coordinator's word (no more attacks, tests or storms; the author is changing the lock). By name:
- Scope B, my own runs: the first round's store, command and config attack scripts against the new code (my one call gave them no output-path argument and crashed at the last line; nothing kept). Brief attack 1 (no second paying run: `--fresh`, `--fresh` with `--vlm-file`, judge on/off, `--go` with a kept reading, a job never writes the store), attack 2 (forged pairs, junctions, half-written pair, leftover `reading.json.<pid>.<x>.tmp`, many keeps from real processes with `superseded/` numbering, one changed byte of a COPY of the tool or model file), attack 3 (same bytes of `plan.general.json` whatever day, id, version; midnight; reading with no date; hostile `_meta`; date never read as a flag), attack 4 (full disk at each file operation of a keep via `deps.fs`; marker sentence through every output), and attack 5 beyond the gate (sentence-by-sentence match of sections 4, 6, 8, 11 with code and tests; non-number settings and non-text `readingsDir` refused by name). The gate (stage tier 11 test lines, `npm test` 432 of 432) passed, which covers what the author wrote, not my own forgeries.
- Re-attack by hand of the first round's O-2, O-4, O-5 fixes; the diff of the one changed line of `pipeline/PORT-CHANGES.md` against its source.
- Lock attacks not done: read-only parent folder; two takers on a holder stale BY AGE (live pid) at the same moment (same path as D-1, expected to fail alike); a pid reused by a live process (covered in kind by the fixed case `live-old`); a taker taken over at once; reading `engine/lib/lock.mjs` and the tests' own lock helpers; checking that lock temp names never reach a job's manifest, a snapshot or `reading show`. I did read every caller of `withFileLock` in `engine/` (job lock, heavy lock guard, readings store): none writes a lock the old way.
- No real reading, nothing paid, no env file or value touched, port 8891 and the real readings folder untouched.

## Cleanup (checked 2026-11-19)
No node process names a qa2 script. My temp folders were removed by name (a leftover test folder and two crash leftovers of my first-round-script call); `C:\Users\elira\AppData\Local\Temp\qa2` holds only my scripts, copied here as `qa2-script-*.txt`. Key-like scan of `qa2-*` and this report: see the last line of my final message.
