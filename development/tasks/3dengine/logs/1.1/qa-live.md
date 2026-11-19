VERDICT: FAIL

# Milestone 1.1 · task 08 — QA on the live main (commit ac717c5), fresh reviewer
<!-- written 2026-11-17 by the qa-reviewer (general-purpose spawn); read-only on the repo; evidence beside this file as qa-* -->

**Why FAIL.** The gate is green and almost every binding line held under about 1,200 attempts of mine: no text of a PDF ever reached an answer, an error, a log or a record; paths outside the inbox were refused in 84 forms; a changed, replaced, deleted or swapped stored copy never ran a stage and nothing was reserved or billed (39 cases, queued, between stages, waiting for approval with a live runner, after approval, resume by the CLI, restart after cancel); a `job.json` that names another job (or none) changed no file of any other job and `jobs/undefined` never appeared (46 variants, real runners, tools, CLI). Two lines of section 1 did break, and both reproduce with one command each: **D1** (a first look made while the upload is being rewritten in place is kept under the PDF's hash and is served later for the intact file) and **D2** (a first look that cannot be stored because the runtime folder is unusable ends as a raw `ENOTDIR` / JSON-RPC -32603 with a local path, not `TOOLCHAIN_MISSING`). Both are narrow and neither moves the stored input, the job id or any billing; they are fixable in `engine/inspect.mjs` alone.

## Part A — the gate, run by me

Machine load is `Win32_Processor.LoadPercentage` just before each run. No run failed, so no load had to be explained.

| Run | Command | Tests | Pass | Fail | Duration | Load | Coverage (lines, all files) |
|---|---|---|---|---|---|---|---|
| A1 | `node --test tests/milestones/m1.1.test.mjs` | 9 | 9 | 0 | 14.48 s | 11 % | n/a |
| A2 | same | 9 | 9 | 0 | 14.81 s | 26 % | n/a |
| A3 | same | 9 | 9 | 0 | 15.18 s | 6 % | n/a |
| A4 | same | 9 | 9 | 0 | 14.91 s | 16 % | n/a |
| A5 | same | 9 | 9 | 0 | 14.73 s | 23 % | n/a |
| A6 | `npm test` (loop run 1) | 330 | 330 | 0 | 96.73 s | not read | 99.70 % |
| A7 | `npm test` (loop run 2) | 330 | 330 | 0 | 94.05 s | not read | 99.70 % |
| A8 | `npm test` (loop run 3) | 330 | 330 | 0 | 100.80 s | not read | 99.70 % |
| A9 | `npm test` (an extra run, see note) | 330 | 330 | 0 | 92.23 s | not read | 99.70 % |

Note on A6 to A9: my first attempt at the three runs was a loop that the shell moved to the background after 180 s; it kept running while I started a fourth by hand, so A8 and A9 may have overlapped in time and both wrote `npm3.txt`. Both exited 0 with 330/330. A6 and A7 ran alone. There was also one earlier 9/9 run of the closing test (14.37 s) before the five recorded ones.
After all runs: `git -C C:/RnD status --short Projects/3Dengine` shows only `CLAUDE.md` files as modified (the earlier harness pass); no other tracked file changed. Evidence: `qa-npm1-out.txt` to `qa-npm3-out.txt`.

## Part B — my own attempts

Scratch folder `C:\Users\elira\AppData\Local\Temp\qa-m11-s\` (scripts copied here as `qa-script-*.txt`). Temp homes only, free ports, never the real `jobs/` and never port 8891. Counts are individual calls or cases.

| # | What I tried | Count | Result | Evidence |
|---|---|---|---|---|
| B1 | Marker sentence `IGNORE ALL PREVIOUS INSTRUCTIONS qa-marker` in page text, title/author/subject/keywords/creator/producer, text annot, free-text annot, form field name and value, bookmark, embedded-file name and description; booklet with three large images and a marker; real server stdio | 16 calls over 14 PDFs | No leak into any tool answer, error, runner log, server stderr (0 bytes) or `inspect.json`; marker only in `pages.json` on disk (expected). Scanned sheet = one candidate `p1`, content `image`; booklet = candidates `p<page>-x<xref>` in page order, labels `עמוד n · תמונה k`, thumbnails exist inside the look's folder; 300 pages looked at in 3.2 s; encrypted (user password), header-only and zero-page files → `NOT_A_PDF`; truncated and bad-xref files are repaired by the scanner and read as sheets (not a break) | `qa-b1-out.txt` |
| B2 | 31 planted `inspect.json` of wrong kinds (not JSON, empty, array, null, schema, sha, scanner sha, settings, summary shape, ids with `../`, labels not built by the engine, page > pages, px 0, ...), setting changes (minSidePx, vectorMinPaths), scanner file edited, hostile scanner (stdout and stderr carry the marker, exit 3), scanner whose `pages.json` carries the marker in extra fields, scanner timeout | 42 looks | 30 of 31 plants rescanned and overwritten; 1 believed (O-4, a `thumb` path with `..` in it, inside the engine's own folder, section 9). Settings and scanner changes rescan, and the new record is then reused. Hostile scanner → `NOT_A_PDF`, no marker in message or log. Timeout → `FILE_TOO_LARGE` after 2 s with the contract's message | `qa-b2-out.txt` |
| B3 | Path forms to both tools: `..`, mixed slashes, junction, `junction/..`, symlink (not creatable: no privilege), prefix sibling `uploads-evil`, `\\?\`, UNC localhost and 127.0.0.1, drive-relative, ADS, trailing dot and space, 8.3 short names, upper case, NUL, 300-char path, 400-char name, device names, `file:`, `~`, `%TEMP%`, empty, `.`, the inbox itself; legit forms (Hebrew name, spaces, `\\?\` inbox, upper case, 8.3 short inbox, a hard link) | 84 + 6 + 8 calls | 0 accepted outside the inbox; `PATH_NOT_ALLOWED` or `NOT_A_PDF`; no job folder and no inspect folder created by any refused call. Hebrew and spaces work and start a job. A hard link inside the inbox to an outside PDF is accepted (O-3) | `qa-b3-out.txt`, `qa-b3b-out.txt` |
| B4 | Candidates through the real server and straight at the handler: booklet with none chosen, 32 ids (case, whitespace, NUL, `../`, Unicode, 64/65/5000 chars, `__proto__`, `constructor`, `apt846`, non-strings), `start_simulation` with no `inspect_plan` before, each candidate twice, empty PDF, the real 846 PDF | 52 calls | Every non-candidate → `NO_PLAN_FOUND` or JSON-RPC -32602 (schema pattern); no id outside the pattern is echoed; no job created for a refused call; one job per candidate, same id on repeat (`created` false); 846 with `apt846` refused, with `p1` or no apartment → one job, mode stub | `qa-b4-out.txt` |
| B5 | Intake: copy hash, read-only (mode and `attrib`), second start no-op, upload deleted afterwards, foreign file at `input/source.pdf` (read-only), directory at `input/source.pdf`, right-hash writable copy, left-over temps (dead pid, live pid, own pid), direct `intakePdf` with a changed, missing, deleted-at-copy and torn source; 10 rounds of three processes starting one PDF at one moment; 40 starts while the upload was rewritten every 3 ms | 81 calls | Copy has the upload's hash and is read-only; second start no-op (mtime unchanged); foreign file never overwritten, `NOT_A_PDF` names the job, no `job.json`; dead-pid temp removed, live-pid kept; torn, changed and gone sources → `NOT_A_PDF` with nothing left in `input/`; 30 starts out of 30 processes in 10 rounds: exactly one `created: true` each, copy intact; rewrite race: 0 folders whose copy differs from the recorded hash or whose id is not the id of its own input. A directory at `input/source.pdf` → raw `EPERM` (O-5). Side effect that led to D1: 28 of the 40 racing starts answered `NO_PLAN_FOUND` for a PDF that has a drawing | `qa-b5-out.txt` |
| B6 | ABA: the upload is rewritten in place with the same bytes while a look runs (300-page file, 1 small sheet), then the file is quiet and asked again | 25 + 30 + 3 runs | 300-page file: 25 of 25 refused `NOT_A_PDF` (good). Small sheet: 9 of 30 looks returned a WRONG answer, and in 3 of 3 targeted runs the wrong look was KEPT and served again for the intact file → **D1** | `qa-b6-out.txt`, `qa-b6b-out.txt`, `qa-b6c-out.txt` |
| B7 | Stored input: 8 mutations (one byte flipped, same-size swap, append, truncate, other real PDF, delete, directory, atomic rename keeping read-only) on a queued job with a real runner; hash rewritten in `job.json` (6 variants incl. `engine_version`, `apartment`, `mode`); change between stages (live runner, 900 ms steps); change while waiting for approval, then approve; change right after approval; `engine resume` after a kill with a swapped copy; cancel, change, start again | 39 cases + 1 | All 8 mutations: job `failed` / `STAGE_FAILED`, 0 manifest rows, 0 ledger rows, spent 0. Between stages: the runner failed the job before the next stage. Waiting for approval: the paid stage never started, `ledger.json` has 0 rows. After approval: failed. CLI resume and restart after cancel: failed. Rewriting the hash with `engine_version` kept or changed, `apartment` or `mode` changed → tools `JOB_NOT_FOUND`, runner exit 1, nothing runs. Only a file with `engine_version` REMOVED (a "pre-1.1" file) ran on the swapped copy, as contract section 4 says (O-7) | `qa-b7-out.txt`, `qa-b7b-out.txt` |
| B8 | Section 5 on real runners, the 8 tools in process and the CLI: 21 `job.json` variants (other id, none, null, number, `undefined`, `../other`, schema, state `stuck`/null/`__proto__`, no input, input array, cost null, array/null/string file, not JSON, empty, BOM) and 25 `manifest.json` variants (other id, none, schema, rows not array, null row, bad stage, attempt 0/-1/1.5/"1", short or upper-case hash, outputs `../other/job.json`, absolute, `a/../../b`, backslash, drive-relative, UNC, NUL, not a string, array, not JSON); every file of two other jobs hashed before and after | 46 variants, 770 calls | In all 46: runner exit 1, log names the job, stops; no file of any other job changed; no `jobs/undefined`, no new folder; X's own files not rewritten by the runner. `job.json` variants: all 8 tools answer `JOB_NOT_FOUND`, `list_jobs` leaves X out, CLI exits 1. `manifest.json` variants: `start_simulation`, the runner and the CLI refuse; `get_job`, `approve_paid_stage`, `cancel_job` and `list_jobs` still answer for X (O-1). The first run flagged all 25 manifest variants as BAD because my check treated the legitimate `job.json` writes of `approve` and `cancel` as a fault; it is kept as `qa-b8-out.txt`, and the corrected run is `qa-b8-man-out.txt` (0 BAD) | `qa-b8-out.txt`, `qa-b8-man-out.txt` |
| B9 | Three processes looking at one PDF at one moment (8 rounds, booklet with thumbnails); dead, live and unrelated temp folders; a scanner copy that waits 4 s while another process changes the PDF (append a byte, delete, replace by another PDF, rewrite with the same bytes) for both tools; storage failures (`.runtime/inspect` is a file, `.runtime` is a file, `inspect/<sha>` is a file); Python missing, pipeline missing, Python is a directory | 35 + 10 + 2 | Concurrent looks: 24 of 24 correct, 3 thumbnails each, no temp folder left. Sweep: dead pid removed, live pid and foreign names kept. Changed or deleted while read → `NOT_A_PDF`, nothing kept under the old hash, both tools, no job created. Same-bytes rewrite → accepted (ABA, see D1). `inspect/<sha>` is a file → replaced, look works. Python/pipeline missing → `TOOLCHAIN_MISSING`. `.runtime/inspect` or `.runtime` unusable → raw `ENOTDIR` (**D2**), over the real server as JSON-RPC -32603 | `qa-b9-out.txt` (its first half has a harness fault: a timer that cannot fire while the handler blocks), `qa-b9b-out.txt`, `qa-b9c-out.txt` |
| B10 | Earlier tests: `git diff 954e0d6 ac717c5` of every test and the lines of engine files that earlier milestones owned, against section 8 | 36 files | Every item of section 8 is in the diff. Changes NOT listed in section 8: see O-8. No assertion of 0.1 to 0.3 was removed other than the listed ones | (this file) |

## Defects

### D1 — a look made while the upload is rewritten in place is kept and served for the intact file
- **Severity:** medium-low (needs a rewrite of the upload during the first look; the effect is a wrong look or a false `NO_PLAN_FOUND` for that PDF until the scanner file or the settings change; the stored copy, the job id and billing are not touched).
- **Binding line:** section 1, "The file changed, or went away, while the scanner read it (its hash is taken again after the scan) → `NOT_A_PDF`, and nothing is kept under its old hash", and "A first look is reused only when it names what it is".
- **Why it breaks:** the check is two hashes of the whole file (before the scan, after the scan). A writer that truncates and rewrites the file with the very same bytes (an uploader overwriting in place, or a client that copies the file again) makes the scanner read a half-written file while both hashes equal the intact file's. The torn scan is stored under the intact file's hash. All 6 attempts under a slow scanner (B9: append, delete, replace, through both tools) were refused correctly when the bytes DIFFERED; the same-bytes case is the hole.
- **Reproduce (two commands, about 2 minutes, from any folder):**
  1. `C:/RnD/Projects/3Dengine/.venv/Scripts/python.exe -I C:/Users/elira/AppData/Local/Temp/qa-m11-s/qa-mkpdfs.py C:/Users/elira/AppData/Local/Temp/qa-m11-s/pdfs` (makes the test PDFs; copy of the script: `qa-script-mkpdfs.txt`)
  2. `node C:/Users/elira/AppData/Local/Temp/qa-m11-s/qa-b6c-kept.mjs` (copy: `qa-script-b6c-kept.txt`)
- **Output (3 of 3 runs; `qa-b6c-out.txt`):**
  ```
  wrong look returned: vector_paths 393 vs true 400 content vector candidates 1 vs 1
  record on disk for the PDF hash (file is quiet and has that exact hash: true ): vector_paths 393
  ask again, quiet file: vector_paths 393 candidates 1 → STILL THE WRONG LOOK (served from the record)
  ```
  A softer form: `node ...qa-b6b-aba-small.mjs` → "correct 16, refused NOT_A_PDF 5, WRONG look returned 9" out of 30. With a drawing that the torn read loses completely the look says `content: empty` and `start_simulation` answers `NO_PLAN_FOUND` for a PDF that has a drawing (28 of 40 starts in B5 part b).
- **Suggested direction (not my job to fix):** read the file once into memory, hash it, hand the scanner a copy of those bytes (the intake does this already for the job), or compare size and mtime as well as the hash before and after.

### D2 — a look that cannot be stored answers with a raw file error, not `TOOLCHAIN_MISSING`
- **Severity:** low (needs a damaged or full runtime folder; the answer is still an error and nothing is created).
- **Binding line:** section 1, "A look that cannot be stored in the engine's runtime folder → `TOOLCHAIN_MISSING`: that is the engine's trouble, not the PDF's. No new reason code."
- **Why it breaks:** `inspectPdf` converts only a failed rename (`place()`); the `mkdirSync` of the temp folder, a few lines above, sits inside `try/finally` with no `catch`, so its error leaves as it is.
- **Reproduce:** `node C:/Users/elira/AppData/Local/Temp/qa-m11-s/qa-b9b-changed.mjs` (its last block; copy: `qa-script-b9b-changed.txt`), or by hand: in a temp home make `.runtime/inspect` a FILE and call `inspect_plan` on any valid PDF in the inbox.
- **Output (`qa-b9b-out.txt`):**
  ```
  server, look cannot be stored: line = {"jsonrpc":"2.0","id":2,"error":{"code":-32603,"message":"internal error in inspect_plan: ENOTDIR: not a directory, mkdir 'C:\\Users\\elira\\AppData\\Local\\Temp\\qa-m11-home-...\\.runtime\\inspect\\.tmp-3d53...-39500-1'"}}
  server start_simulation:  {"jsonrpc":"2.0","id":3,"error":{"code":-32603,"message":"internal error in start_simulation: ENOTDIR: ...
  ```
  The message carries a local path of the engine (not text of a PDF).

## Observations (do not change the verdict)

- **O-1 (milestone 1.1, wording or code):** for a `manifest.json` that is not the job's, only `start_simulation`, the runner and the CLI refuse. `get_job`, `approve_paid_stage`, `cancel_job` and `list_jobs` still answer for the job (they never read the manifest), while section 5 says "the tools answer `JOB_NOT_FOUND`... `list_jobs` leaves such a folder out" for both files. Nothing is written through. If the sentence is meant literally for the manifest too, it is a defect. `qa-b8-man-out.txt`.
- **O-2 (0.2 inbox):** `pdf_name` is the basename as the caller spelled it, so an 8.3 short path gives `LONG-F~1.PDF`. Cosmetic.
- **O-3 (0.2 inbox):** a hard link inside the inbox to a PDF outside is accepted (a real path cannot tell). Whoever can create it already reads the file; the trust boundary is the inbox folder.
- **O-4 (1.1, section 9 territory):** `validSummary` checks a candidate's `thumb` by prefix only, so a planted record with `<dir>/thumb-/../../../x` is believed. Needs write access to `.runtime/inspect`, which section 9 trusts.
- **O-5 (1.1 intake):** a foreign DIRECTORY at `input/source.pdf` ends as a raw `EPERM` (message with the local path), not `NOT_A_PDF`. The contract lists a foreign file, not a directory.
- **O-6 (2.1 board, "Carried items"):** the first look is `spawnSync` inside the handler, so the MCP server answers nothing else during a look (about 2 s quiet, up to the 30 s limit busy). Section 9 covers the 30 s answer; the blocking itself is not named.
- **O-7 (1.1, documented in section 4):** a job file with `engine_version` removed is not checked for id identity; swapping the copy and rewriting the hash in such a file runs on the swapped bytes (stub stages never read them). Only a hand that removes the field can do it.
- **O-8 (1.1 contract section 8 completeness):** test changes in the diff that section 8 does not list: `tests/unit/runner.test.mjs` (a virtual clock in the claim-wait test, `verifyInput` stubbed for hand-made jobs), `tests/soak/lib.mjs` (manifest fixture hash `'i'` to 64 hex, forced by section 5), reworded tool descriptions in `mcp/tools.mjs`. None weakens an assertion that matters, but the list is not complete.
- **O-9 (UX, 1.1):** restarting a job whose upload was deleted answers `NOT_A_PDF` although the job holds its own copy; consistent with section 3 ("the upload went away").
- **O-10 (qa process):** a temp home whose job folders hold a read-only `source.pdf` was removed by `fs.rmSync` once only after clearing the read-only mark (one `EPERM` in B4, with the runners killed 1 s earlier). The repo's own `removeHome` handled it in the gate runs; noted for scripts of others.

## What I did NOT test
- A really saturated machine (I did not create load; section 9 owns it) and a first look during a render.
- Symbolic links (not creatable here without privilege); a junction in place of `input/` (section 9); alternate data stream content INSIDE the inbox.
- `npm run test:e2e`, the soak, anything with the bridge, Pi or the app; anything that costs money or uses the network.
- A real Hebrew-text PDF (my marker PDFs are English; the marker travels the same code); a booklet of vector plans (section 9); PDFs near the 20 MB limit other than a 15 MB booklet.
- Two servers on one jobs folder over stdio (I used two or three engine processes over the handlers instead).
- Kill-in-the-middle of the intake (a process killed between the copy and the rename); I tested its leftovers (dead-pid temp files) and the torn copy, not a real kill.

## Process check (at the end)
Command for runner, serve, mcp server and kill-soak node processes:

```
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match 'runner\.mjs|cli\.mjs serve|mcp.server\.mjs|kill-soak' } | Select-Object ProcessId, CommandLine | Format-List
```
Output: empty (no process). The same question for `python.exe` whose command line names `qa-m11`: empty. One orphan runner of my own (pid 40672, from a script of mine that crashed) was stopped by pid before the end; three temp homes of crashed scripts (`qa-m11-home-*`) were removed; no `qa-m11-home-*` folder is left under `%LOCALAPPDATA%\Temp`. The scratch folder `qa-m11-s` (PDFs and scripts) stays; the 14 test PDFs in it can be deleted by Eliran.

## Evidence files (this folder)
`qa-script-*.txt` (18 scripts), `qa-b1-out.txt` … `qa-b9c-out.txt`, `qa-b8-man-out.txt`, `qa-npm1-out.txt` … `qa-npm3-out.txt`. No PDF and no image here.
