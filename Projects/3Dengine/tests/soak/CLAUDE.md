# tests/soak/ — the soak of milestone 0.3: kills and takeovers at random moments
<!-- last-updated: 2026-11-18 -->

## What's here
The closing test of 0.3 proves each case once, at a chosen moment. The soak repeats them at RANDOM moments, with real detached runner processes on a temp engine home, and checks the invariants after every step. It is not part of `npm test` (minutes, not seconds); it is part of the gate of milestone 0.3 and of any later change to `engine/runner.mjs`, `engine/ledger.mjs`, `engine/manifest.mjs`, `engine/control.mjs`, `engine/heavy-lock.mjs` or `engine/lib/atomic.mjs`.

| File | Purpose |
|---|---|
| `kill-soak.mjs` | `node tests/soak/kill-soak.mjs [--kills N] [--freezes N] [--seed S]` (default 150 kills, 0 freezes). Phase 1 hard-kills runners at random moments (the three pause hooks make some kills land between reserve / cache / settle) and resumes them. Phase 2 (`--freezes`) blocks the first runner's thread at a random point, so it is alive and looks dead, lets a second runner take the job over, and wakes the first at a random moment. Stops at the first violation and copies the job's files into a folder named in the output. Exit 0 = no violation and no process left |
| `lib.mjs` | shared with the closing test: `mkEnv` (a temp home with its own `engine.config.json`, the real tool handlers, the pids it spawned, `cleanup`); `frozenJob`, `frozenThenReplaced`, `wakeAndLeave`, `toDone` (a blocked runner, its takeover, its wake); `gone`, `lockFree`, `seenAlive` (waits that replace one-look assertions); `freePort`, `readText` |

## What is checked
- **After every kill and every resume:** `job.json`, `manifest.json` and `ledger.json` parse; one settled row per call (a second one only when it is `late`); a call sent again only where a reservation's outcome was unknown; no stage with two valid rows; the job never `failed`; `spent_usd` equal to the settled sum; a resume never blocked by a lock for more than 3 s.
- **At the end of every job:** one valid row per stage, three settled rows, the local link answers 200.
- **One takeover in three also kills the SECOND runner** (contract 0.3 §12; half of those kills are aimed inside one of its pauses), wakes the first at a random place in that order, and lets a third runner finish. It fails on a `reserved` row at `done`, on an `orphaned` row that was never marked as sending, on more sends than rows marked as sending, and on a live runner left for a job that is done.
- **After every takeover** (contract 0.3 §10 rules 9, 10, 12 and §11): the rows the replaced runner wrote are only those of the stages before the one it was blocked in; no `orphaned` or `reserved` row is left; a call it had reserved and not sent ends `failed` + `not_sent`; a call it had already sent, and that the second runner sent again, has two settled rows, one of them `late`, and two sends; every other call was sent exactly ONCE; it stopped as `superseded` by itself; no `runner.pid` or `job.lock` left behind.

## Conventions / gotchas
- A temp home only: never the real `jobs/` folder, never port 8891. `cleanup` kills only the pids this run spawned, plus the static server of the temp home: the one its own `.runtime/serve.json` names and, when that record names a server that lost the start, the one that names this temp home in its command line (`../helpers/cleanup.mjs`).
- (1.1) `lib.mjs` exports `scriptedLook`: the first look that `mkEnv` and the closing test of 0.3 hand to the engine instead of starting Python for every made-up PDF. The intake and the runner's check of the stored copy run for real.
- The summary line starts with `SOAK` (`kills=`, `takeovers=`, `second_runner_kills=`, `never_sent_rows=`, `late_rows=`, `woke_before_done=`, `violations=`). `woke_before_done` counts the takeovers in which the replaced runner woke while the second one was still working: that is the dangerous order, so it must not be 0 in a run that is quoted as proof.
- **A check that compares two files reads them in the order the engine writes them** (found at the gate of 1.3). A call is marked in the ledger and then sent, so `check()` counts the sends first and reads the ledger after. In the other order a live runner marks and sends between the two reads, and the soak reports a send with no mark that the disk never held (once: the mark was 3 ms before the send).
- A failing run is repeated with `--seed`; the dump folder holds `WHY.txt`, the three job files, `runner.log` and the `sends.log` of each paid stage.
- **Nothing in the takeover phase depends on the clock** (contract 0.3 §11.1): the blocked runner stays blocked until the test creates its wake file (`ENGINE_TEST_FREEZE_WAKE`; `ENGINE_TEST_FREEZE_MS` 60000 is only the upper bound). The temp home needs `runner.staleSeconds` 1 so that a blocked runner looks dead after a second.
- **Never assert on one look** at `job.lock` or `runner.alive` while a runner lives: it takes the lock at every heartbeat, and with `staleSeconds` 1 a late heartbeat on a loaded machine shows `alive: false` for a moment. Use `lockFree` and `seenAlive` (the second QA round failed the gate on exactly this).

## Links
Parent: [../CLAUDE.md](../CLAUDE.md) · Contract: [../../contracts/CONTRACT-0.3.md](../../contracts/CONTRACT-0.3.md) · Closing test: [../milestones/m0.3.test.mjs](../milestones/m0.3.test.mjs)
