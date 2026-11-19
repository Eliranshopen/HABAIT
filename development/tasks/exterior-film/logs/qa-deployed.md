# Card A7 — QA on the DEPLOYED site (exterior-film)
Date 2026-11-04 · agent habait-deploy-qa · target https://habait-flow.vercel.app = dpl_Em7YappXsXsEuBGfBYs9dj9JoU3k (habait-flow-fhbzvi57b) · read-only, headless Chrome (playwright-core), logged-out.

## Verdict: PASS (with two intermittent timing rows flagged, no product defect found)

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | check-film.cjs, desktop + iphone13 + pixel7 + tablet (38 rows each device set) | 74/76 on the first run; the 2 FAILs are E1 (iphone13, tablet) — see Flags. Re-runs of tablet+iphone13: 36/38 (tablet D1 + E1), then 38/38, 38/38 | `qa-deployed/check-film.txt`, `check-film-rerun.txt`, `qa-deployed/rerun*/`; shots `qa-deployed/*_{1_hold,2_film,3_end,4_back,5_handoff}.png` |
| 1a | Rows A, B, C1-C7, D2, D3, E2, E3, F1, Z1 (0 page errors), Z2 (0 responses >= 400) | PASS on all 4 devices in every run | same |
| 2 | glide-probe a7: hold rests after the first second | PASS. 1440: diffs 5.09 (first sample), then 0.02, 0.03, 0.03, 0.41, 0.01. 390: 1.84, 0.01, 1.6, 0, 0, 0 (max after the first sample 1.6, inside 0-2) | `qa-deployed/` (glide-probe output, printed to stdout; values copied here) |
| 3 | site_check, 7 pages x 2 widths | PASS 14/14, 0 console errors, 0 responses >= 400 | `qa-deployed/site-check.txt`, `site-check.json` |
| 4a | Network: building-film-1080.mp4 on desktop 1440 | `206 video/mp4`, request `Range: bytes=0-`, `Content-Range bytes 0-28563571/28563572`, then a second Range request (bytes=23789568-); poster 200 image/jpeg | `qa-deployed/a7probe.json` |
| 4b | Network: building-film-720.mp4 on iPhone 13 (390) | `206 video/mp4`, `bytes 0-11972256/11972257`, plus a seek Range; the 1080 file was NOT fetched; decoded 1280x720 | same |
| 4c | Time to first frame after the click (currentTime > 0, readyState >= 2) | iPhone 13: 515 ms; desktop: 680 ms | same |
| 4d | Frame content (canvas sample of the video) | not black: luminance 138 / 137, stddev 41 / 43 | same |
| 4e | Disclosure on the film | badge "הדמיה · AI-generated" and the legal text ("הדמיה להמחשה בלבד. הופקה בסיוע בינה מלאכותית ... Rainbow תל אביב מיום 15.10.2025...") visible, inside the viewport (bottom 650/664 on phone, 886/900 on desktop); legal text byte-equal to #clipLegal (check-film C3, all devices, all runs) | `a7probe.json`, `a7_*_film.png` |
| 4f | End screen | all three actions visible, 48 px, in view: "כניסה לדירה 846 (הדמיית 360)", "צפייה חוזרת", "חזרה לבחירת דירה"; restart and back work (C5-C7) | `a7probe.json`, `a7_*_end.png` |
| 4g | Console errors / 4xx-5xx in my probe | 0 / 0 on both viewports | `a7probe.json` |

## Flags (not ruled FAIL; for the owner of check-film.cjs)
- **E1 "button hidden during the descent clip"** failed in 3 of 6 phone/tablet device-runs (iphone13 and tablet in run 1, tablet in the re-run), passed in the others. The row asserts `display === 'none'` after a fixed 150 ms sleep. My polled probe (`a7probe.json`, `e1timeline`): the button is still `block` at the first sample right after the click and `none` from ~100 ms on, on both iPhone 13 and desktop, for the whole descent. The product behaviour is correct; the fixed 150 ms sleep races the hide. Fix: poll up to 1 s. (The local runs `check-v3/check-all` passed because there is no network latency.)
- **D1 "hold loop running"** failed once (tablet, re-run): after the test forces the button to `display:none`, the hold's loop did not restore it within the fixed 400 ms. Passed in the 5 other tablet/phone runs. Same class (fixed sleep); not reproduced in 2 further runs. Worth a look only if it recurs.
- Screenshots are PNG, not lossless WebP as the recipe says (no converter run); evidence is in the folder.
- Not tested: Edge (card matrix names Chrome + Edge; only Chrome channel was used), a logged-in pass (nothing here is gated), main's 3d2e6ab surfaces beyond what site_check/check-film cover (badge on the film and platform pages are covered).

## Not done by this card
No deploy, promote, rollback, .env, paid call or git write.
