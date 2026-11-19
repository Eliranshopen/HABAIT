VERDICT: FAIL

# QA on the live main, milestone 1.4 (a saved reading)

## What was reviewed
- Live home `C:\RnD\Projects\3Dengine`, local `main`. Commit at the start: `e0aee0cb`; HEAD at the end: `21cd9f96` (two later commits, memory and HOT only: `git diff --stat e0aee0cb HEAD -- Projects/3Dengine` is empty). Date 2026-11-18.
- Scope: contract 1.4 §1 to §6 and §8, and the one changed line of `auto-trace.mjs` (diff against `a63494a`: `qa-tool-diff.txt`; blob `c55bfe16...` equals the id in `PORT-CHANGES.md`; the diff is the 1.2 header line plus the `--trace-date` line, nothing else).
- Nothing was paid. No `--go` in the real home. No network. All attempts ran in temp folders or with a recording `spawn` and fake `runTrace`; the only planted key values are the words `fake-qa-planted` and `fake-qa-planted2`, in `qa-script-cli-attack.txt`.

## Why FAIL
One binding line is broken by an attempt of mine: "under one lock per PDF" / "a reading that was paid for is never destroyed" (§1). Several processes that keep at once are not serialised, and the record of a kept pair can be lost (D-1). Everything else I tried held.

## Part A: the gate
| Run | Tests | Pass | Fail | Seconds | Load before | File |
|---|---|---|---|---|---|---|
| `timeout 1500 npm run test:stages` (the long background run of rule 7) | 13 | 13 | 0 | 1111 (18m31) | 100 % | `qa-test-stages.txt`, `qa-load-stages-before.txt` |
| `timeout 300 npm test` | 428 | 424 | 4 | 189 | 100 % | `qa-npm-test.txt`, `qa-load-npmtest-before.txt` |
| the two files that held the 4 failures, once: `node --test tests/milestones/m0.2.test.mjs tests/unit/proc.test.mjs` | 11 | 11 | 0 | see file | 19 % | `qa-rerun-failed-files.txt`, `qa-load-rerun-before.txt` |
| `node engine/cli.mjs doctor` | | READY, both key names present | | | | `qa-doctor.txt` |

- The 4 failures of `npm test` are TIME on a machine at 100 %: three in `m0.2.test.mjs` (`get_result took 2046 ms` against a 2 s limit, and the cascade of it: the same PDF again found `awaiting_approval`, the stdout test) and `pidAlive` in `proc.test.mjs` (a finished process still answered alive). None touches 1.4 code. Both files pass at 19 % load. Coverage of the failed run: 99.77 % lines. Written as time, not as a defect.
- `git status --short -- Projects/3Dengine`, tracked files other than generated `CLAUDE.md`: empty before (`qa-git-status-before.txt`) and empty after (`qa-git-status-after.txt`). I changed no tracked file.

## Part B: my attempts
| # | What | How many | Result | Evidence |
|---|---|---|---|---|
| B1 | The store in a temp home with a stand-in pipeline root: forged pairs (another PDF's pair copied in; reading swapped under a record; same size, one byte; appended newline), 40 record mutations (extra, every field missing, wrong types, sentences in dates, `--budget` as a date, hour 25, negative and huge cost, other reader, array reader, BOM, empty), file/folder/junction swaps, half pairs, `superseded` as a file, one changed byte (and CRLF) of the stand-in tool and of the model file, tool missing, other engine version, hostile `_meta` (14 shapes), non-readings, refused arguments, junk hashes, `drawingId` over 2000 inputs, `isDate`, `isInstant` | 227 checks | 225 ok, 2 flagged: both are observations O-1, O-2. Never `found` when it should not be; `stale` never used; a stale reading is superseded, never overwritten; superseded pairs intact | `qa-store-attack.txt`, `qa-script-store-attack.txt` |
| B2 | The command and the stage with a recording `spawn`: kept reading with free, paid, judge on and off, `--fresh`, `--fresh` + `--vlm-file`, stale, bad, `--go` without a cap, hostile ids, paid pass keeps, second paid pass supersedes, keep failing, FAIL keeps nothing, two plans keeps nothing; `reading show` / `import` (dry, go, again, usage, non-reading); the stage's four statuses and what it hands the wrapper; who calls `keepReading` | 55 checks | 55 ok. With a valid kept reading no run hands the tool a reading call: the kept file is always given; free runs get budget 0, the fixed word under the fal name and no other key; `--fresh` without `--go` is DRY; a stage never pays and never keeps (callers of `keepReading(`: `cli.mjs`, `readings.mjs` only); no reading text in any output | `qa-cli-attack.txt`, `qa-script-cli-attack.txt` |
| B3 | Every numeric field of the real settings file (14 found plus 5 optional) set to `true`, `[4]`, `"3"`, `"0x3"`, `null`, an object, `"1e1"`; the two environment overrides with hex, spaces, `1e3`, `-1`, `true`, `5.5` | 114 checks | 114 ok: refused by name (null is taken as the default) | `qa-config-attack.txt`, `qa-script-config-attack.txt` |
| B4 | Eight processes keep eight different readings of one PDF at once | about 55 runs in all, 16 of them with an operations log | 4 runs (`qa-race-anomaly-1.txt`, `-10`, `qa-race-ops-anomaly-10.txt`, `-11`) end with a half pair in `superseded/` (a `reading.json` with no `record.json`) or one keep failing with an `ENOENT` rename error. In the half-pair runs 8 keeps succeeded and only 7 records exist: one record is gone. The reading bytes survived (paid readings lost: 0) | `qa-race-*.txt`, `qa-script-race.txt` |
| B5 | The lock helper alone (`withFileLock`, the one `keepReading` uses): 8 processes, a marker file created exclusively inside the lock | 15 runs of 8 processes | 4 runs saw 1 to 3 holders at once (11 saw none). With 6 processes and 3 ms inside: 0 in 8 runs | `qa-lockrace-b1..b15.txt`, `qa-lockrace-1..8.txt`, `qa-script-lockrace.txt` |
| B6 | Real-tool runs | 0 | not needed: the stage tier of Part A runs the real tool on the 846 reading (command and job give the pinned hash, second run books $0 and makes no request, no room name anywhere) and passed 13 of 13 | `qa-test-stages.txt` |

## Defects
**D-1. Keeps made at the same moment by several processes are not serialised; a kept pair's record can be lost, or a keep fails (contract 1.4 §1: «under one lock per PDF», «a reading that was paid for is never destroyed»).**
- Steps: B5. Start 8 node processes at once, each calls `withFileLock(<dir>/x.lock, fn)` from `engine/lib/atomic.mjs` with a body that creates a marker file with the `wx` flag, waits 25 ms and removes it. In 4 of 15 runs a process finds the marker present: two holders at once. Then B4: 8 processes call `keepReading` for the same PDF with different readings; in 4 of about 55 runs the store ends with a `superseded/<n>/` holding `reading.json` and no `record.json` (the record of a paid reading was overwritten or lost), or one process fails with `ENOENT: rename ...record.json -> superseded/<n>/...`. The final pair was always consistent and `found`; no reading bytes were lost; the failing keep ended with a clean error and left its reading in the run's folder (in the command: `NOT KEPT`, exit 1, with the line that says how to import it).
- Likely cause (read, not proven by a patch): `takeOverStale` in `lib/atomic.mjs` moves a lock aside on the word of text read earlier; a holder that has just ended (a command that exits right after its keep) makes the next process judge a lock stale, and the lock that stands there at that moment is moved aside and put back, so for a moment nobody holds it and a third process takes it. The code is milestone 0.3's; 1.4 relies on it and states the line.
- Reach: two commands (`trace --go`, `reading import --go`) of one PDF at the same moment. A job never keeps. Rare, but it is the case the card names, and the harm is a record (cost, source, reader) of a paid reading.
- Evidence: `qa-lockrace-b*.txt`, `qa-race-anomaly-1.txt`, `qa-race-anomaly-10.txt`, `qa-race-ops-anomaly-10.txt`, `qa-race-ops-anomaly-11.txt`, scripts `qa-script-lockrace.txt`, `qa-script-race.txt`.

## Observations
- O-1 (milestone 1.4 or a later one that touches `keepReading`): `_meta.model` of a reading, kept or imported, is copied to the record and printed by `reading show` when it is shaped like a model id (one Latin word is enough: my marker word `ZZSECRETWORD` was printed). Contract §1 allows exactly this; §4's «never any other text of a reading» is then true only for text with a space or non-ASCII. No fix needed unless Eliran wants the model name limited to a list.
- O-2 (1.4): `isInstant` accepts `T24:00:00Z` (V8 parses it as the next day) while `plan_date` is cut from the first ten characters, so such an instant gives the day before its real day. The tool writes `toISOString()`, which never produces it; only a hand-made file can. Same bytes every time, so nothing breaks.
- O-3 (1.4): a command run with the default id (`apt-new`) or another `--id` gives other bytes of `plan.general.json` than a job (the drawing's id) from the same reading. By contract §3 the id is the caller's in the command; the closing test passes the drawing's id. Worth one sentence in the command's help.
- O-4 (1.4): `readingsDir` is passed through `String()`, so a number or `true` becomes a folder named `5` or `true` inside the home. §6 speaks of numbers only; no number is involved.
- O-5 (1.4): if the write of the new pair fails after the old pair was moved to `superseded/`, the folder has no valid reading until a person puts one back (the old one is intact). Matches the contract's wording («never destroyed»).
- O-6 (0.2, tests): `m0.2.test.mjs` fixes its limit at 2 s and `proc.test.mjs` assumes a finished pid reads dead at once; both fail at 100 % machine load and pass at 19 %.

## What I did NOT do, and why
- No real reading and no paid path: not needed (B6) and forbidden for a paid path outside a temp home with a scripted `fetch`; the scripted path is what the author's closing test already exercises and passed in Part A.
- I did not run `npm run test:e2e` or the soak: outside the card's check.
- I did not patch `lib/atomic.mjs` to prove the cause of D-1: read-only review.
- I did not touch the real readings folder, port 8891, `jobs/`, any env file, or any process that is not mine. My temp folders are removed; no process of mine is left.
- I did not test a run that crosses midnight with a real clock: shown by reading that the command decides the day before the tool starts, and by B2 (`today` fixed at 2030-01-01 lands in the record and in `--trace-date` of the paid run).
- Key-like scan of my evidence files: the only hits are the fake planted words named above.
