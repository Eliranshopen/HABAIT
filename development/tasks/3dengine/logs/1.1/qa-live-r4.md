VERDICT: FAIL

# QA round 4 of milestone 1.1, on `aaec50c`

**Why.** The two round-3 defects are closed and the new write rule held everywhere I pushed: 200 upload-read calls under locks, ACLs, removals and toggling locks gave only reason codes and no JSON-RPC error; 88 foreign-manifest scenarios across all eight tools, five CLI commands and a hand-started runner changed no byte of the job or of a bystander. One narrow break remains in section 1 (line 14) and section 3. When the upload is replaced by a FOLDER between the path check and the intake's copy, `start_simulation` answers `TOOLCHAIN_MISSING` "the folder of job <id> cannot be used by the engine". That blames the job folder, and it is not `NOT_A_PDF`, which the contract names for the intake's copy read. Reproduced both in a race (4 of 2500 calls) and deterministically at the unit level. Low severity, but it is a reproduced break of a binding line, so FAIL. If the intake's copy read of a folder counts as "another file error of the job folder" (section 3, line 39), the code is right; I give both readings below.

## Part A, the gate (run by me)
| Run | Command | Tests | Pass | Fail | Duration | Load before | Coverage (lines) |
|---|---|---|---|---|---|---|---|
| A1-1 | `node --test tests/milestones/m1.1.test.mjs` | 13 | 13 | 0 | 38.3 s | 5 % | n/a |
| A1-2 | same | 13 | 13 | 0 | 34.4 s | 9 % | n/a |
| A1-3 | same | 13 | 13 | 0 | 34.7 s | 6 % | n/a |
| A2-1 | `npm test` | 367 | 367 | 0 | 112.0 s | 18 % | 99.72 |
| A2-2 | `npm test` | 367 | 367 | 0 | 146.1 s | 17 % | 99.72 |
| A3 | `git status --short Projects/3Dengine` minus `CLAUDE.md` | no other tracked file changed | | | | | |

The second `npm test` ran past 180 s only because the tool moved it to the background; it was not saturated (load 17 %). Evidence: `qa4-a1-run1..3.txt`, `qa4-a2-run1..2.txt`, `qa4-a1-load.txt`, `qa4-a2-load.txt`.

## Part B
| What I tried | How many | Result | Evidence |
|---|---|---|---|
| B1 upload reads, real server over stdio, both tools: lock modes (Read/None, ReadWrite/None, Read/Read, ReadWrite/Read, ReadWrite/ReadWrite) with and without a stored look; ACL denies (R,RD,GR / RX / full, on the file; RX on the inbox folder); file removed, replaced by a folder, zero-byte, half file, `%PDF-` plus garbage, restored; a lock toggling about every 15 ms across 140 calls | 200 calls | 0 JSON-RPC errors, 0 paths in messages. Answers: 148 `NOT_A_PDF`, 50 ok (shared-read locks and the restored file are healthy), 2 `PATH_NOT_ALLOWED` (inbox folder denied: a reason code, odd but allowed). No stray record under another hash | `qa4-b1-out.txt`, `qa4-script-b1.txt` |
| B1b the intake's copy, direct `intakePdf`: source locked None / locked Read / ACL-denied / gone / folder / free | 6 | lock None, ACL denied, gone: `NOT_A_PDF`; locked Read and free: ok; **folder: raw EPERM** (see D-1). The input folder was left empty each time | `qa4-b6-out.txt` |
| B1c race: the upload swapped for a folder, removed, or zeroed while `start_simulation` runs (in-process engine, a fresh job each time) | 2500 folder-mode, 2500 remove-mode (zero-mode timed out under my 170 s cap, no result) | folder mode: 36 ok, 2402 `NOT_A_PDF`, 58 `PATH_NOT_ALLOWED`, **4 `TOOLCHAIN_MISSING` "the folder of job … cannot be used"**; remove mode: 2498 `NOT_A_PDF`, 2 ok | `qa4-b7-out.txt`, `qa4-script-b7.txt` |
| B2 `job.json` never written past a foreign manifest: 11 manifest spoils (not JSON, empty, BOM, wrong id, wrong schema, array, bad stage, path escape, attempt 0, bad hash, a folder) x 8 job states (queued, tracing, awaiting_approval, skinning, failed, cancelled, review, done), each with a wrong cost copy planted. Per scenario: 6 tools, `job`, `job --json`, `ledger`, `jobs`, `resume`, and a hand-started runner on the 5 non-ended states; a bystander healthy job in the same folder. Every file hashed before and after | 88 scenarios | 0 changed files, no `jobs/undefined`, 0 JSON-RPC errors. Tools answered `JOB_NOT_FOUND`, the CLI exited 1 (`job --json` 0, as contract 0.3), the runner exited 1 (0 on ended jobs) | `qa4-b2-out.txt`, `qa4-script-b2.txt` |
| B2b the other direction: `job.json` not this job's (not JSON, wrong id, a folder, state outside the contract, `engine_version` mismatch); all tools, CLI and a runner | 5 | no file of the job changed (manifest, ledger, source.pdf included) | same file |
| B2c no `job.json` and a foreign `manifest.json`: `start_simulation` | 1 | `JOB_NOT_FOUND`, naming the job; no `job.json` written; the job folder holds `input/` and `manifest.json` only (the intake's copy stays, as section 10 says it may) | same file |
| B3 wrong kind of thing at 31 paths of `.runtime/`, `jobs/` and the job folder (files where folders belong, folders where files belong, read-only files, ACL write-denied folders), 7 tools each, plus `engine_status` for two plants | 221 calls | 3 JSON-RPC errors, all the section-9 «lock busy» for `job.lock` as a folder. 0 paths in any answer. Others: `TOOLCHAIN_MISSING` 19, `JOB_NOT_FOUND` 66, `NOT_A_PDF` 1, plus the contract's `NOT_DONE` / `NOT_AWAITING_APPROVAL` | `qa4-b3-out.txt`, `qa4-script-b3.txt` |
| B4 healthy lifecycle with real runners: to `done`; a wrong cost copy put right by `get_job` and by `engine job`; runner killed in `skinning` and resumed by `start_simulation` and by `engine resume`; cancelled then restarted by both; two jobs at once; three server processes starting one PDF at once | 12 flows | all passed. Every finished job has 8 manifest rows and 3 ledger rows, one live row per stage, nothing repeated. The three-process start gave exactly one `created: true`, one job folder. `get_job` does not resume a dead runner (my first script assumed so; it is by design, `start_simulation` and `resume` do) | `qa4-b4-out.txt`, `qa4-script-b4.txt` |
| B5 earlier defects: 14 mutations of a stored look (extra keys, `..` thumb, emptied candidates, changed counts, scanner hash, settings, id, schema, emptied or deleted `pages.json`, text marker in `pages.json`, array, BOM) | 14 | every one rescanned and answered the true look, with no marker in any answer. Round 1 D1 / D2, round 2 D-1 to D-3, round 3 D-1 / D-2: closed by B1, B2, B3, B5 and the three m1.1 runs | `qa4-b5-out.txt` |
| B6 regressions: record reused with a Python that exists but cannot scan (answered in 252 ms, so Python is not started); the same PDF under two names, one job; stored copy appended to while a live runner waited, then approved (job `failed` / `STAGE_FAILED`, no new row, no ledger); marker text in a sheet and a booklet (0 leaks in answers, stderr, job files, records; the text stays only in `pages.json`); 12 paths outside the inbox or malformed (`..`, junction, UNC, `file:`, relative, NUL, a folder, ...) | about 40 | all as the contract says. `s.pdf::$DATA` (an alternate data stream of a file in the inbox) is accepted: same file, not a defect | `qa4-b5-out.txt`, `qa4-b6-out.txt` |

## Defects
**D-1 (low). The intake's copy read of an upload that became a folder answers `TOOLCHAIN_MISSING`, not `NOT_A_PDF`, and names the job folder.**
- Binding lines: section 1, line 14 ("every read of the upload has one answer when it fails: `NOT_A_PDF`... the intake's copy... Never an internal error"), and section 3, lines 39 and 40.
- Why it breaks: `intakePdf` classifies a failed copy as the upload's trouble only when `canRead(source)` is false. `fs.openSync(<folder>, 'r')` succeeds on Windows, so `canRead` says the upload is readable, the copy's raw `EPERM` leaves, and the engine blames the job's folder (`start_simulation` wrapper → `TOOLCHAIN_MISSING`, "the folder of job <id> cannot be used by the engine"). Round 4's own item 15 treats a folder at the upload's path as "cannot be read" for the first look; the intake is not given the same treatment.
- Reproduction (deterministic, unit level): `node C:\Users\elira\AppData\Local\Temp\qa-m11-r4-s\b6.mjs` → line `[intake folder] Error EPERM | EPERM: operation not permitted, copyfile ...`.
- Reproduction (through `start_simulation`, a race): `node C:\Users\elira\AppData\Local\Temp\qa-m11-r4-s\b7.mjs folder` → `{"ok":36,"EngineError:TOOLCHAIN_MISSING":4,...}` with message `the folder of job 04762ca47a173685 cannot be used by the engine`.
- Counter-reading: section 3 line 39 says any other file error of the job folder while making the copy is `TOOLCHAIN_MISSING`, and a folder at the source is an error the engine cannot tell apart from a job-folder error by its code alone. But a folder in place of the upload is "the upload is not a file", and the contract's own list for the upload (lines 14, 40) has no `TOOLCHAIN_MISSING`. The code follows the second sentence of line 39; I read line 14 as the stronger one. The fix is small: treat `source.path` not being a regular file as the upload's trouble.

## Observations
- O-1 (section 1): the check of the path answers `PATH_NOT_ALLOWED`, not "cannot be read", when the inbox folder itself is ACL-denied for reading (the real path cannot be resolved). It is a reason code and only an odd choice.
- O-2 (section 9, small): `get_job` does not restart a dead runner; only `start_simulation` and `engine resume` do. By design from 0.3, worth a line in the Pi wrapper text.
- O-3 (section 5): the write rule is checked then written, not atomic. A manifest spoiled in the gap between the check and the write of `job.json` could still let a write through. I did not build a race for it; a paid-call settle that hits `ManifestUnreadable` inside `copySpent` after the send would leave the row orphaned rather than lost, as far as I read the code (not run, stub calls cost $0).
- O-4 (section 8 test 8, carried): part 8 of the closing test reported "6 true" on every run here, so the writer race is not tested with half-written looks on this machine.
- O-5 (process): the stub engine's detached runners and `serve` processes outlive a script that starts a job through a real server; a reviewer must record their PIDs (I did not at first in B1 and B3; I found and stopped them, see below).

## What I did NOT test
Zero-byte rewriting race (B1c zero mode timed out under my cap, no result); a manifest spoiled in the gap between check and write (O-3); a lock acquired exactly between the hash read and the intake's copy of a healthy file (only the toggling lock and the direct `intakePdf` forms); `engine_status` beyond two plants; booklet starts beyond the marker booklet; the 250-character path limit; Python-less machines; no network, no paid call, no e2e, no soak.

## Process check
I started and stopped: 12 runners (B1) by PID, 8 runners (B3) by PID, 11 runner PIDs tracked and checked dead (B4), 2 (B5), and 7 detached `cli.mjs serve` processes whose roots were my `qa4-home-*` folders (PIDs 6156, 30612, 46700, 27636, 42852, 28284, 12496). A `taskkill` over a name pattern also stopped my own wrapper shells once. Final check, a node process list filtered on `runner.mjs`, `cli.mjs serve`, `mcp/server.mjs`:

```
33244 engine\cli.mjs serve --root C:/Users/elira/AppData/Local/Tem... (root is a qa3-home folder: an earlier reviewer's, left alone)
```

No qa4 process is left. The processes with `kedma` in their name were not touched. `qa4-home-*` temp folders: all 14 removed (a first `rm` failed on read-only job copies and running `serve` processes; after stopping the serves and `chmod` it left none; `ls Temp | grep qa4-home` is empty). The folders `qa3-home-*` were left alone. Part A step 3: no tracked file changed except `CLAUDE.md` files.
