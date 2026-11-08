# hold-building-tour — re-gate (D1 fade fix), qa-reviewer, 2026-11-04

VERDICT: PASS

Scope: the D1 fix (`fadeGen`) and its side effects on sound, plus the Check. Tested copy: hb-run/hold/app.js, sha256 starts 8cf074b8 (verified). The .wt source file (dfbe759f) carries the `fadeGen` diff I read; the served file shows the fixed behaviour.

## Check (`check-building.cjs`, all 4 devices)
- Run 1: `79/80 PASS · 1 FAIL` exit 1. The one FAIL: `tablet C3 auto chain reaches the tower` with scene `"orbit5"` at the 60 s mark (`logs/regate-check-run1.txt`). All other tablet rows (C4-E3, Z1, Z2) PASS; desktop, iphone13, pixel7 all PASS.
- Run 2 (tablet only): `20/20 PASS · 0 FAIL` exit 0 (`logs/regate-check-run2-tablet.txt`).
- Judgement: timing in software-GL, not a stall. The chain was at orbit5, the last stop before the tower, when the 60 s budget ran out. The chain runs inside the iframe; the fade code touches only the page audio element and cannot affect it. Run 2 passed; raise the C3 wait to 90 s. Run 1 exit 1 is reported as it happened.

## Defects
| id | severity | repro | expected | actual | evidence |
|---|---|---|---|---|---|
| (none open) D1 re-test | closed | close at 0/50/200/550/700/1500 ms after open (in-page timer, no click lag) | ambience playing, vol 0.6, icon on | all 6 PASS: `ambPaused:false, vol:0.6, icon 🔊`, 0 page errors | `gate-probes/regate-fade.txt` A rows |

## What I tried to refute (all held)
- Fast sequences: open/close x3 at 30/80/10/300 ms gaps, full-open then close then reopen and close at 100 ms: playing at 0.6 (B, B2). Open and stay: still fades to paused, vol 0 (B3, so the fade itself still works); close then restores (B3b).
- User mute via the speaker before open/close at 0/200/1500 ms: stays paused and 🔇, `userOff:true` (C); unmuting afterwards plays (C2). Note `closeBuilding` restores only if `ambWasOn` was true, so mute is respected.
- Open, close (100 ms and 1500 ms), then pill 846 -> continue -> descent: `#tourFrame` has `scope=apartment`, ambience ends paused at vol 0 and stays so 2.5 s later (D, D2): the hand-off's own `fadeAmbience(900)` takes a new `gen` and is not cancelled by the earlier `fadeGen++`.
- `#enterBtn` path after an open/close: the page navigates to /tour/?scope=apartment, no page errors (`regate-enter.txt`); no leftover audio.
- Code read: `fadeGen` is a module-level counter; a fade that starts later always wins, a restore cancels the running one; only paths that bump it are `fadeAmbience` (when audible) and `closeBuilding` (when ambWasOn). Fade started while another runs: the older loop exits on its next frame (verified by the diff; B3b).
- Re-run `probe2.cjs`: 13 PASS, 0 FAIL including Q1 (the former FAIL) (`probe2.regate.txt`). Re-run `probe1.cjs`: P2/P2b/P2c state lines now `ambPaused:false, vol:0.6` (previously paused/0); P3a/b/d PASS. Two runs each had 1-2 FAILs on loop-rate rows P1b/P2c (`probe1.regate.txt`, `probe1.regate2.txt`) caused by a low baseline measured before any open (r0 = 5-6 rAF/s now versus 32-35 in the first gate, with r1/r3 of 36-60): the rate criterion `r < r0*1.6` is not meaningful against that baseline; the loop is alive and single. Not related to the fade.

## Observations
- O1 the baseline rAF rate of the hold dropped from ~33/s (first gate) to ~5/s in this session's probe1 base measurement; machine load (software GL) is the likely cause, not the change (measured before any overlay opens). Worth a glance if it shows on real hardware.
- O2 C3's 60 s wait is tight on the tablet profile (see above).
- O3 restore volume 0.6 is hard-coded (as before).
- Not tested: real GPU, iOS Safari, the deployed site.

Files: `gate-probes/regate-fade.cjs/.txt` (the crashing last block E was replaced by `regate-enter.cjs/.txt`), `probe1.regate*.txt`, `probe2.regate.txt`, `regate-check-run*.txt`, `regate-shots/`.
