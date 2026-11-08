# Regate report - board transition-rise (qa-reviewer, fresh, refute-first)

REGATE: PASS

Scope: gate D1 (Esc/x during the "view in 360" dive must cancel it) and N2 (same-room dive ends on the dive's end view). Code read: tour.js closeDh / enter-room handler (lines ~1186-1235), build_zip.mjs hideGen / onEnterRoom (lines ~431-510). Run tree was not rebuilt; working copies not edited.

## Code reasoning
- 3d-hide only ever sent by closeDh (tour). The apartment page never sends it, so hideGen stays 0 there and its enter-room is never dropped (confirmed by grep: only tour.js and build_zip.mjs mention 3d-hide).
- gen is captured before the await and compared after, so a close during the dive drops it, and a close + reopen also drops it (gen differs), while a dive started after the reopen captures the new gen and works.
- Stale enter-room that slips past (post was in flight) is caught by the tour's `!dh.open` guard. Plain (non-dove) path goes through the same guard.
- closeDh called from the enter-room handler itself posts one extra harmless 3d-hide after the post has already happened.

## Checks
| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Author probe3 on pixel7 (S1-S7, not run by the author) | PASS 22/22 | logs\regate-probe3-pixel7.txt |
| 2 | R1 close + reopen during a dive: no stale navigation, layer stays open; R1b new dive after reopen still enters | PASS desktop, pixel7 | regate-races-desktop-R1-R4.txt, regate-races-pixel7.txt |
| 3 | R2 plain (non-dove) enter-room: navigates while open, ignored while closed | PASS desktop, pixel7 | same |
| 4 | R3 apartment-style embed (never sent scenes or 3d-hide): enter-room still posted (dove false); also still posted for a later click after a 3d-hide | PASS desktop | regate-races-desktop-R1-R4.txt |
| 5 | R4 Esc with focus in the frame during a dive: closes, tour stays in living, no inert leftovers | PASS desktop, pixel7 | same |
| 6 | R5 reduced motion: dive completes and enters kitchen; Esc right after go leaves tour usable | PASS desktop | regate-races-desktop-R5-R7.txt |
| 7 | R6 two rooms fast + Esc: usable; a following normal dive works; no page errors | PASS desktop | same |
| 8 | R7 same-room dive from tour yaw 70 and -120: both end at yaw 0, pitch -2, fitted hfov (not the old yaw) | PASS desktop (hfov 111.4), pixel7 (hfov 60) | same, regate-races-pixel7.txt |

Not re-run (author results taken, not re-verified): fix-check-rise 36/0, fix-reg-check-* PASS, probe3 desktop/iphone13, fix-probe-n2 (not rerun to avoid overwriting its file; R7 covers N2). iphone13 not run by me for the races (touch emulation covered by pixel7).

## Defects
None blocking.

Observations (not defects, pre-existing behaviour, accepted at the gate as S3b):
- O1: two different rooms clicked within ~150 ms: dive 1 is superseded, resolves null and posts a plain enter-room at once, so the tour ends in the FIRST room (dining) while the buyer's last click was kitchen. Repro: `timeout 400 node logs\regate-races.cjs desktop R6`. Not a regression of D1/N2; not caused by the fix.
- O2: R7 "heading" read from tour data is null (the data shape does not expose it to the probe), so the yaw-0 end view is inferred from yaw moving from 70/-120 to 0 plus pitch -2; the author's fix-probe-n2 compares against the config yaw.
