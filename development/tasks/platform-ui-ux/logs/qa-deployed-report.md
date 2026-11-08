# Card 22 — QA on the deployed site (2026-11-04)
Target: https://habait-flow.vercel.app (dpl_9RL6FWDqKuhqLbDrsPPgUPAP1Pak), real https alias, headless Chrome (playwright-core, channel chrome), fresh logged-out contexts, he-IL. Evidence: `qa-deployed/` (scripts `qa22.cjs`, `qa22b.cjs`; `results.json`, `results-b.json`; `net-*.json` full response logs; `f-*.png` / `g-*.png` frames).
Only alias of this project is habait-flow.vercel.app. Other projects, untouched by this deploy: habait.ai 200, www 308 to habait.ai, app 307 to /login (as briefed, not tested here).

## Verdict: FAIL (2 lines, one root cause) — everything else PASS
Root cause: the cinematic landing variant (`landing.html?v=b`, and the default `landing.html` when the A/B split lands on b — it did at 1440, not at 390) and `flow.html` request three never-staged files under `/_local/segments/rainbow-cine/` (`hold-arc/camera.json`, `orbit.first.jpg`, `orbit.mp4`): 3x 404, 2 `[cine]` console errors plus 3 "Failed to load resource". Frames `qa-deployed/f-1440-1.png`, `g-landing-vb-1440.png`, `g-landing-vb-390.png` show the landing hero painted as an empty black stage (only badges and disclosure text), so it is a visible defect, not just log noise. I rule FAIL rather than PASS-WITH-NOTE: the card says 0/0 literally, and the result is a black first fold on roughly half of landing loads. Mitigant: `cine.js` and `/hold/` were out of this board's scope, the same happens on the local staged copy, the other variant (a) is clean. Fix candidates are Eliran's call (stage the segment files, or make the default variant a) — no rollback is advised by this card.

## Per Check line (14 page/width rows: 3 required pages + `tab=3d` + `v=b` + `flow.html`, x 1440/390)
| Check line | / | landing (v=a) | landing (v=b / split-b) | apartment 846 | apartment tab=3d | flow.html |
|---|---|---|---|---|---|---|
| status 200 | PASS | PASS | PASS | PASS | PASS | PASS |
| 0 console errors | PASS | PASS | **FAIL** 5 (both widths) | PASS | PASS | **FAIL** 5 (both) |
| 0 responses >= 400 | PASS | PASS | **FAIL** 3x 404 (both) | PASS | PASS | **FAIL** 3x 404 (both) |
| every `_local/dist/` request <400 | PASS (0 req) | PASS (12 at 390, 4 at 1440) | PASS | PASS (4) | PASS (3) | PASS (0) |
| `fonts.check('16px Heebo')` true, 0 Google Fonts | PASS | PASS | PASS | PASS | PASS | PASS |
| no "תצוגת פיתוח"/"placeholders" | PASS | PASS | PASS | PASS | PASS | PASS |
| no sideways scroll (extra) | PASS | PASS | PASS | PASS | PASS | PASS |
| no clay image in landing gallery | n/a | PASS (12/12 gallery imgs loaded, 0 clay, both widths) | n/a (variant has no gallery) | PASS (stills tab: 12/12 loaded, 0 clay) | PASS | n/a |
| every AI still carries "הדמיה · AI-generated" | PASS (2/2) | PASS (13/13) | PASS (2/2) | PASS (11 visible in stills tab) | PASS | n/a (0 badges; flight only) |

Rows identical at 1440x900 and 390x844 except which landing variant the split picked. Console-error counts above are the raw Chrome count (includes the 3 "Failed to load resource" lines); excluding them the two real `[cine]` errors remain.
Note: in the first load of apartment pages the 11 stills read as "not complete" only because they sit in the hidden stills tab (lazy); after opening the tab all 12 load, 0 4xx.

## Comparison
Production before the deploy was 4/14 clean (main session); now 10/14 clean by the main session's check, which treats the 3 cine 404s as known. My strict reading: the 4 failing rows are exactly the cine rows (landing v=b x2, flow x2).

## Owed to Eliran
Rule on the cine 404s (stage `rainbow-cine` files / default to variant a / accept). No rollback needed for anything else. Not tested: Edge, videos' playback, 3D canvas pixels beyond the frames (`f-*-4.png`).

## Round 2 (2026-11-04, dpl_HprzbAudnPdUCLididJWbhB9Cm8X)
Target: https://habait-flow.vercel.app (alias to habait-flow-kki5ir20o). Fresh run, nothing reused from round 1: `qa-deployed/r2-qa22.cjs`, `r2-qa22b.cjs`; results `r2-results.json`, `r2-results-b.json`; response logs `r2-net-*.json`; frames `r2-f-*.png`, `r2-g-*.png`. Headless Chrome, logged out, he-IL, 6 pages x 1440x900 / 390x844 = 12 rows.

### Verdict: PASS (with 2 notes below)
| Check line | Result |
|---|---|
| status 200, all 12 rows | PASS |
| 0 console errors, all 12 rows (incl. landing v=b, default split, flow.html) | PASS: `errs` empty everywhere |
| 0 responses >= 400, all 12 rows | PASS: `bad` empty everywhere; no rainbow-cine 404 (flow.html now issues 156-167 requests, all < 400) |
| every `_local/dist/` request < 400 | PASS (landing 12/1, apartment 4, tab=3d 3; 0 bad) |
| `fonts.check('16px Heebo')` true, 0 Google Fonts | PASS on all 12 |
| no "תצוגת פיתוח" / "placeholders" | PASS on all 12 |
| no clay image in landing gallery | PASS: variant a gallery 12/12 loaded, 0 clay at both widths; apartment stills tab 12/12, 0 clay |
| every AI still carries "הדמיה · AI-generated" | PASS: 13/13 landing a, 2/2 cine hero and home, 11 visible in stills tab, 0 mismatched |
| no sideways scroll (extra) | PASS |
| Round-1 defect: hero/flight frame not black | PASS: `r2-f-1440-2.png` (v=b) and `r2-f-390-11.png` (flow) show the tower flight; hero mean luminance 136-147, std 46-56 on v=b, default split and flow frames at both widths (round 1 was an empty black stage) |
Default split: 1440 drew variant a (gallery), 390 drew variant b (cine); both clean. Variant b was also forced with `v=b` at both widths: clean.

Notes: (1) The apartment pages' 13 "not complete" images on first paint are the hidden lazy stills tab; they load (12/12) once opened. (2) Not covered by this card's Check, not tested: `/tour/` and the transition-rise interaction (rise/dive), Edge, video audio, 3D canvas pixels beyond the frames. The board-transition-rise work in this deploy still needs its own live proof if Eliran wants it.
Card 22 can move to `SHIPPED (QA 22 PASS)`; the board-row edit is the main session's.
