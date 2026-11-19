VERDICT: FAIL
(One reproduced defect, Low: a cache file whose amount is `null` or missing is treated as an answer worth $0, against section 14 item 2. Gate stable, 14 of 14. D3 of round 5 is fixed: no violation in about 50 late-runner kills and every tool and CLI report. Nothing else broke.)

# QA live round 6, milestone 0.3. Fresh reviewer
Engine `C:\RnD\Projects\3Dengine` @ `5d18190`. Contract read in full; code of ledger, runner, control, manifest, heavy-lock, jobs, atomic, stub, cli, stub-engine and the soak lib read. Nothing changed in the repo except this report and the `qa-r6-*` files beside it. Every run used a temp home (`ENGINE_HOME`, jobs dir inside it, free port), never `jobs/`, never 8891, no `.env`, no network.

## What I ran
Scripts (copies beside this report as `.txt`; originals in `C:\Users\elira\AppData\Local\Temp\claude\76e6db1160dffba0\40c3c5f2-e1ea-4dd3-baf1-ad71447227fd\scratchpad\qa-r6\`): `s1-late.mjs` (late runner killed around its settle, chains of three runners, every tool and both CLI commands compared with the ledger), `s2-copy.mjs` (wrong copy by hand in 7 states x 7 values, lock held, ledger damaged), `s3-direct.mjs` (O-J, O-L), `s4-reader.mjs` + `s4-writer.mjs` (does a reader see a file as absent during an atomic replace), `s5-chaos.mjs` (heavy-lock loss with two jobs, random kill / cancel / start / approve sequences), `s6-misc.mjs` (heartbeat remark, cap stop), `common.mjs` (invariant checker computed from the three files, sends.log and runner.log). Results: `qa-r6-results.txt`, `qa-r6-gate-runs.txt`.
- Own real kills (`process.kill` of pids I recorded): s1 27 (seeds 6001, 6002), s5 20 = **47**.
- Own real takeovers and lock losses (a second or third runner owns `runner.pid` while the earlier one is a live blocked process; heavy lock taken from a silent or dead holder): s1 50, s5 6 = **56**. s1 includes 8 chains of three runners (two late settles, three sends).
- Baseline soak, not counted: `node tests/soak/kill-soak.mjs --kills 30 --freezes 30 --seed 6606`: `kills=35 takeovers=30 second_runner_kills=9 never_sent_rows=6 late_rows=7 violations=0`, clean-up said no process remains.
- Checker after every scenario: parse; no `reserved` at done; `orphaned` only with `sending_at`; `not_sent` never with it; no settled row without `sending_at`; at most one plain settled row per call; sends.log lines <= rows marked; copy = settled sum; counted <= cap; one valid manifest row per stage; no overlapping `rendering`; no heavy lock left; no runner crash line. Zero violations in s1 (38 scenarios), s5 (6 heavy, 8 chaos, 2 s6 jobs).

## Claim A, the gate
| Command | Runs | Result | Duration |
|---|---|---|---|
| `timeout 300 npm test` | 6 | 6 pass, 0 fail (245/245 each) | 81-82 s |
| `timeout 200 node --test tests/milestones/m0.3.test.mjs` | 8 | 8 pass, 0 fail (17/17 each) | 80-81 s |
`git status --short Projects/3Dengine` after the runs and after every attack script: empty. Claim A holds: 14 of 14. (Runs 1-3 of `npm test` are in `npm-1..3.txt` of the scratchpad; the first three lines of `qa-r6-gate-runs.txt` were typed by me from those outputs, 81/82/82 s.)

## Round 5's items
| Item | Answer | Evidence |
|---|---|---|
| D3 (late settle, kill before sync) | **Answered.** s1: 27 kills, among them kills inside the pause after the settle, inside the pause after the cache write, and 0-25 ms after the wake with no hook, at skinning, gating, finishing, and on chains where two replaced runners settle late. Raw `job.json` copy equalled the ledger sum right after every kill; get_job, list_jobs, get_result, CLI `job --json` and `jobs --json` all reported it (checked 38 times each). Not hit: a kill exactly between the ledger write and `copySpent` (a few ms apart); by design that is the stated limit | `qa-r6-results.txt` s1 lines |
| Wrong copy by hand, every state | **Answered.** queued, skinning, awaiting_approval, cancelled, failed, review, done x copies 0, 99, 1.2, null, "1.8", unset, true value: get_job, list_jobs, get_result, start_simulation, approve_paid_stage, cancel_job (252 asks, plus CLI `job --json` / `jobs --json` on 63): all reported 1.8 and put the copy right. 0 violations | s2 matrix |
| Job lock held while asking | **Answered.** Held 3-5 s (also with refreshed mtime): every tool reports the ledger total; the copy stays wrong (99) while held and is put right by the next read after. Cost: each tool call waits the 2 s lock wait first (get_job 2008 ms; list_jobs 2011 ms) | s2 lock lines. Observation O-M |
| ledger.json damaged / removed | Truncated, empty, `[]`, `{"rows":null}`, garbage: tools and CLI `--json` report the copy; CLI human `job` and `ledger` exit 1 with a JSON error. Deleted: reports 0 and OVERWRITES the copy with 0 (a missing file reads as an empty ledger). Observation O-N | s2 |
| O-J (cache amounts) | **Defect D4 (below)** for null and missing; negative, text, "5", true, array: not an answer, call sent, old row orphaned (correct); 0, 0.6, 50: answer (correct). 1e308 is an answer but the row is written with `settled_usd: null` (usd() overflows to Infinity); 1e300 settles 1e300 | s3 oj, 2 repeats |
| O-L (failing send, lock busy) | **Answered as stated.** Busy 1 s, 5 s, 12 s: caller got the send's own error ("provider said no"), row `failed`, after 1.1 s, 5.1 s, 10.1 s (live holder taken over at 10 s). Busy 40 s with refreshed mtime: caller got the own error after 33.6 s, row stays `reserved` with its mark; the next attempt: row `orphaned`, one new send, held 0.6. Matches section 14 item 3 | s3 ol |
| O-I | **Stated truthfully** (billed above estimate is not defended; stub bills exactly its estimate); not re-run, code read: the cap is checked on estimates only | ledger.mjs decide step 4 |
| O-K | **Stated truthfully.** Cap run (calls $25, cap 60): stop at the third call, quote 75, a cap of 74.99 refused, 75 continues to done, spent 75 = ledger, counted never above the cap in force | s6 cap |
| Heartbeat remark (14.4c) | **Stated truthfully.** Job lock held with a refreshed mtime by a live process: `runner.alive` true for 1.2 s, then false for the remaining 4.8 s, `heartbeat skipped` in runner.log; after the lock was freed the same runner went alive again. Section 14.4(c) describes this | s6 heartbeat |

## Sections 10 to 14, read as a lawyer
Every always/never line was tied to code or to a run above. Lines tied to code only: 10.4 (hard link creates the lock with content), 11.2 (`syncSpent` reads inside the lock), 12.1 (decide closes every other reserved row), 13.1 (`inFlight` map). One line the code does not do as written: **14.2 / C "only when its amount is a number of zero or more"**: `readCache` does `c.settled_usd ?? 0`, so null or a missing amount passes (D4). 11.5 / 10.11 known limits not attacked. 12.5 was replaced by 13.1.

## Own attacks on B, C and D
| Claim | Attack | Result |
|---|---|---|
| B: reported spent = ledger | s1 (38 scenarios, 5 report paths each), s2 (252+ asks) | pass |
| B: copy written in the locked step | kill in the pause right after the settle, 15 times (raw copy checked before any read) | pass |
| C: no reserved at done, orphaned only with sending_at, sends <= marked, second settled row only late/resend_of | checker after 52 scenarios | pass |
| C: same-key calls are one call, cap never crossed, cap not a dead end | cap run (s6) | pass |
| C: answer not lost to a busy lock; failed-send close retried | s3 ol | pass |
| C: cache amount rule | s3 oj | **D4** |
| D: no lost / repeated stage, replaced runner writes nothing | chains of 3 runners with two late settles; 8 chaos sequences (kill, cancel, start, double start, approve, hooks) | pass; every job reached done, one valid row per stage |
| D: no overlapping rendering rows, heavy lock lost | 6 two-job scenarios: A frozen holding the lock, B takes it over, then A woken at once / mid-B / after B / B killed / A killed | pass: 0 overlaps, A attempts rendering 2, no lock left |
| D: reader never sees a file absent during an atomic replace | s4: 102,800 reads of ledger, manifest, job.json against 15,000 replaces by another process | 0 absent, 0 errors |

## Defect
**D4 (Low) A cache file whose amount is `null` or missing is an answer worth $0. Breaks section 14 item 2 ("A file whose amount is not a number of zero or more is not an answer") and C.**
Steps (`qa-r6-s3-direct.mjs.txt`, `node s3-direct.mjs oj`): a ledger row `reserved` with `sending_at`, and `cache/<key>.json` = `{"answer":{...},"seq":1}` or `{"answer":{...},"settled_usd":null,"seq":1}`; call `paidCall` with that key. Expected: not an answer, row turned `orphaned`, call sent, settled 0.6. Actual: `sends=0`, row `settled`, `recovered`, `settled_usd` 0, `spent_usd` 0. 2 of 2 repeats, both variants. Cause: `engine/ledger.mjs` `readCache`, `const cost = c.settled_usd ?? 0`. The engine itself always writes a number, so only a damaged or old-format file shows it; the cost is a paid call recorded as free.

## Observations
- O-M Every read tool waits 2 s when the job lock is busy before it answers (the sync wants the lock); the answer is right but slow.
- O-N A deleted `ledger.json` reads as an empty ledger: tools report 0 and overwrite the copy with 0. A damaged one reports the copy. The contract says only "unreadable".
- O-O CLI human `job` and `ledger` crash with a JSON parse error on a damaged ledger; `job --json` works.
- O-P A finite huge amount in a cache file (1e308) is written to the ledger as `settled_usd: null`.
- In a chain of three runners the cap stop and `orphaned` rows (rows `3:orphaned` seen at runner 2 killed) behave as section 10.10 / 13.4 state.

## Process check
```
(empty)
```
Command as given, run after my last script and the clean-up of every temp home (each `E.cleanup` printed `leftover=[]`).
