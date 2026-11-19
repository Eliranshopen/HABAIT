VERDICT: PASS

# QA of milestone 1.3 (the trace gate), live main
Reviewer: fresh qa-reviewer, 2026-11-18. Reviewed: `C:/RnD/Projects/3Dengine` on local `main`, commit `ef2d2dc` (still the head when I finished; nothing later). Scope: binding lines of `contracts/CONTRACT-1.3.md` (§1 to §7). The reading tool under `pipeline/` was not touched. No tracked file was changed by me; `qa-status-after.txt` is empty apart from generated `CLAUDE.md` date changes (not mine, not findings).

## Why PASS
I tried to break each binding line and could not. Every failing reading I made on the REAL tool ended `review` / `TRACE_GATE_FAIL` with no manifest row, no ledger row, no later-stage folder. No setting, input or planted key made a free run pay. No marker text left the attempt folder. Cancel left no process and no row; a hard kill of the runner plus resume used its own attempt folder. Both gate tiers pass again. Nothing was paid; no `--go` was passed.

## Part A: the gate (live home, once each)
| command | tests | pass | fail | seconds | load before | file |
|---|---|---|---|---|---|---|
| `npm run test:stages` (timeout 540) | 10 | 10 | 0 | 131 | 28 % | qa-test-stages.txt |
| `npm test` (timeout 300), lines 99.75 % | 410 | 410 | 0 | 100 | 1 % | qa-npm-test.txt |
| `node engine/cli.mjs doctor` | - | READY (key names present) | - | - | - | qa-doctor.txt |
| `npm run test:soak -- --kills 14 --freezes 8` | kills 19, takeovers 8, second_runner_kills 3 | violations 0 | - | 58 | 2 % | qa-soak.txt |
`git status` before/after: only generated `CLAUDE.md` files (qa-status-before.txt, qa-status-after.txt). No cut runs, no left processes.

Soak race (the author's claim): right. `gate-soak-1-dump.txt` shows the ledger row's `sending_at` 09:42:33.666Z and the send's line 09:42:33.669Z: mark first, send after, so the old check (ledger read, then sends counted) could see a send with no mark in between. The new check counts sends first, then reads the ledger; any counted send already has its mark in the later read. A real violation (send with no mark, ever) stays in the ledger and is still caught at the next check; the only thing loosened is the in-flight instant. My own soak run: 0 violations.

## Part B: my attempts
| # | what | count | result | evidence |
|---|---|---|---|---|
| B1 | REAL job, 846 PDF. Marker sentence in every string field of the saved reading + one dimension changed, run; restarted with `start_simulation`; restarted with `engine resume`; reading replaced by one with a room removed, restarted | 4 real readings | all `review` / `TRACE_GATE_FAIL`, message made of numbers (6 of 86 / 5 of 76 checks); attempts 1..4 each in own folder; review record replaced (attempt 4 at the end); no manifest file, no ledger file, `stages/` holds only `tracing`; spent 0; marker found in no job file, no tool answer (781 kept) | qa-real-fail_chain.txt |
| B2 | REAL job, reading folder with Hebrew letters in its path (`readingsDir` setting), a bedroom dimension +80 cm | 1 | `review` / `TRACE_GATE_FAIL`, 4 of 82 checks; the tool read the reading from the non-ASCII folder fine | qa-real-other.txt |
| B3 | REAL job, room type renamed to a made-up type | 1 | the tool's check PASSED it: manifest row, job stopped at `building` (`STAGE_FAILED`, no real build) as the contract says; see O-1 | qa-real-other-run1.txt |
| B4 | REAL job, `cancel_job` ~10 s into the reading | 1 (+1 aborted by a bug of my script, kept) | state `cancelled`, 0 processes of the temp home after 6 s (node and both python children gone), no manifest file, no ledger file, no `index.json` | qa-real-kill.txt, qa-real-kill-run1.txt |
| B5 | REAL job, hard kill (`taskkill /F`, runner only) mid-reading, then `engine resume` | 1 (attempt 2 killed, attempt 3 complete) | 0 processes left right after the kill and 90 s after the end; attempt 3 in its own folder, attempt 2 never got an `index.json`; one manifest row (tracing, attempt 3, done), its 5 outputs under `attempt-3/`; job then stopped at `building`; spent 0; ledger none; runner.log shows one runner at a time | qa-real-kill.txt |
| B6 | Fake tool through the real `runTrace` and real `realStage`: 14 exit-code/forged-index cases, PASS with 0 and 2 plans, FAIL with 0 plans, PASS with exit 5, FAIL with exit 0, wrong index id/dir, hostile field types, hang, log text "budget" with exit 1 | 40 cases | table holds: exit 4 = `NEEDS_PAID_RUN` only, exit 1 stays `STEP_FAILED` whatever the log says; a result disagreeing with its exit is `RESULT_UNREADABLE`; hostile fields give `?`/null, never text; no MARK/SECRETLINE in any result, error or log | qa-fake-results.txt, qa-script-fake.txt |
| B7 | Free-run environment and arguments (planted FAKE `fal_key`, `Fal_Key`, `OPENROUTER_API_KEY`, lower-case, a config-named extra key, `HABAIT_ENV_ROOT`) | 1 dump | child sees only `FAL_KEY=free-run-no-key` (other planted names gone, any case); args `--budget 0 --env-root <attempt folder> --no-judge --rounds N --vlm-file`, no `--ledger`, no `--go`. (the one FAIL line in qa-fake-results.txt, FAILED_CHECKS=1: my own filter also caught the harness's `CLAUDE_CODE_MESSAGING_TOKEN`; not an engine fault.) The tool reads keys only from the process env and `<--env-root>/.env`, and every vision call needs `0.02 + booked <= 0`: refused with exit 4 | qa-fake-results.txt |
| B8 | Saved reading missing / empty / not JSON / array / `rooms` not a list / `null` / a folder; hostile `pdf_sha256` (upper case, `../`, short, undefined); non-empty attempt folder | 13 | missing or no valid name -> `BUDGET_CAP`, anything else -> `STAGE_FAILED`; in every case the tool is never started and no `stages/` folder is made; a non-empty attempt folder is refused, never mixed | qa-fake-results.txt |
| B9 | `cancel` through the stage with the fake hanging tool | 1 | stage threw exactly what `checkCancelled` threw in 2.05 s, no `index.json` | qa-fake-results.txt |
| B10 | Hand-edited `review` records (extra key, other stage, stage/path mismatch, attempt 0/-1/1.5/"1"/mismatch/"01", `..` anywhere, absolute, backslash, `:`, space, newline, non-ASCII, wrong file names, `__proto__`, arrays, null; a record on `building`/`failed`/`done`) through `checkJob`, `writeJob`, a hand-written file read by `readJob`, `listJobs`, `restartJob` | 44 cases x 3 | 88 expectations held, 0 failed: refused everywhere it is read or written, accepted only the in-attempt shapes | qa-review-results.txt, qa-script-review.txt |
| B11 | Settings: `trace.rounds` (0, 10, 2.5, "abc", null, "", -1, 9, 1, "3", " 5 ", true, [4], "0x3") and `mode` (case variants, spaces, 1, true, array, empty) | 27 | out-of-range or non-integer refused; `mode` strictly `stub`/`real` or absent; no value reaches the tool except as a whole number 1..9 | qa-fake-results.txt |
| B12 | Non-ASCII output folder and odd characters (`é`, zero-width, NBSP, tab, DEL, control) | 7 | refused as `OUT_PATH` before anything is created | qa-fake-results.txt |
Real-tool starts: 10 (7 reading to the end, 3 stopped on purpose: two cancels, one killed runner), slightly above the "about 8" in my brief because the first kill script died on a bug of mine after the cancel part.
Contract §5 and §7: every file named in §7 exists (`m1.3.test.mjs`, `m1.3-pass.test.mjs`, `real-home.mjs`, `tracing-stage`, `review`, `trace` cases, `intake-wiring`); `package.json` is 1.3.0; `engine.config.json` carries `"mode": "stub"` and `trace.rounds: 3`; `engine_status` returns `mode`; `readingsDir` defaults to `<runtime>/readings`. They match.

## Defects
None.

## Observations (outside the binding lines)
- O-1 (milestone 3.x, the build stage): a hand-made reading with an unknown room `type` passes the tool's own check (B3) and goes on. The gate sees geometry only. The building stage must validate types.
- O-2 (none, unreachable): a tool answer `FAIL` with an index of zero plans gives `review` with an empty `files` record. The real tool answers exit 3 there.
- O-3 (1.4 or later): `trace.rounds` accepts `true`, `[4]`, `"0x3"` (coerced by `Number`). Harmless: the tool gets a whole number.
- O-4: my hard kill left no orphan tool (the tool died with or right after the runner), so "an orphan of attempt 1 still writing" was not exercised live. Safe by design (a new attempt gets a new folder and the tool writes only into its own `--out`), not proven by a live orphan.
- O-5: a very large saved reading (hundreds of MB) is read and parsed twice (`savedReadingFor`, `decide`) in the runner. Not tried.
- O-6: the schema and `checkJob` accept `review: null` in any state; fine.

## Not done, and why
- No paid path in any form (rule 3); the paid path stays covered by the author's `m1.2-paid-path` test, which passed in Part A.
- No port 8891, no real `jobs/` folder: every home was a temp `qa13*` folder, removed by the harness; 0 processes named them at the end.
- No test with a PDF carrying page text through the real tool (marker in the reading was tried; PDF text relies on the stage never reading the PDF, which the code confirms).
- Large-reading test (O-5).
