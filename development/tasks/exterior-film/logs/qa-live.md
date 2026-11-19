# QA live, board exterior-film, card A6 (fresh reviewer, refute-first)

Date: 2026-11-04. Read-only on live files, working folder and git. No deploy, no paid call, no .env. Server on 8861 started by me (PID 99419), killed; netstat shows no LISTEN on 8861. Evidence copies are in `logs/qa-live/`.

## Verdict: PASS

No FAIL rows. I tried to refute honesty, disclosure, legal text, each gate note and the hold regression; all held. Two observations (not failures) at the bottom.

| # | Check | Result | Evidence |
|---|---|---|---|
| 1a | 5 live files = working copies = manifest `sha256_at_close` | PASS. index.html d1dbf5bf…, app.js 84c45e1d…, 1080 fb386d9a…, 720 ba677da8…, poster 7c29c9d2…: all three sources identical for every file | sha256sum of live and `.wt/exterior-film/files/...`; manifest.json |
| 1b | c7a3677 changed only index.html and app.js under flyover3d | PASS (the 3 media files are not in git, as expected) | `git show --stat c7a3677` |
| 2 | Nothing out of scope in c7a3677 | PASS. Outside `development/tasks/exterior-film/**` only the two flyover3d files and `development/plans/2026-11-04-exterior-realistic-video-3d.md` | `git show --name-only c7a3677` |
| 3a | Test stage builds and serves | PASS. stage_flow.py ok, film files staged under `hold/data/video/` | stage run, `qa-live/` |
| 3b | check-film.cjs, 4 devices | PASS 76/76, 0 FAIL, zero page errors, zero 4xx/5xx; includes the regression flow (pill, card, descent, E1/E2/E3, hand-off scope=apartment, F1) | `qa-live/check.txt` |
| 3c | glide-probe: the hold rests after the clip | PASS. 1440: diffs 4.56 (settle), then 0.07 / 0.03 / 0.02 / 0.01 / 0.02. 390: 7.71, 1.61, then 0.02 / 0.03 / 0.02 / 0.02. After the first second max about 1.6 (the 390 second step is the tail of the settle), the rest 0.0x | `qa-live/a6-1440-strip.jpg`, `a6-390-strip.jpg`; glide JSON printed in run |
| 3d | Legal text byte-equal to #clipLegal; badge on screen | PASS. `.film-legal` textContent === `#clipLegal` (198 chars); badge "הדמיה · AI-generated" visible; both are DOM overlays above the video and the end screen (seen over the end screen in the fade shot) | `qa-live/probe.txt`, `probe_fade.png`; check.txt C-rows on all devices |
| 3e | Honesty of the film | PASS. 2 s contact sheet: orbit, arc and descent all show the same Rainbow tower and its context (lighthouse, chimney, sea), last frame is the 846 terrace/interior of the approved descent clip; no frame from outside the approved clips found. Caveat unchanged from the gate: Topaz Starlight is generative; the disclosure covers it | `qa-live/sheet.jpg` |
| 4.1 | Crossfade ghost fixed | PASS. The live film is the re-cut v2 (24.83 s, 596 frames, 1920x1080, 24 fps), not the 28.4 s one the gate saw. Arc to descent is now a fade through black (luma min 16 at 20.54 s; dark frames 20.50-20.62 s), no double exposure. The orbit to arc crossfade (16.5-17 s) is pose-matched, 10 frames, clean | `qa-live/dip.jpg`, `qa-live/xf1.jpg` |
| 4.2 | Arc judder fixed | PASS. Per-frame difference over all 595 transitions: 0 duplicate frames (threshold 0.05), longest duplicate run 0; arc mean step 11.3, no stop-and-jump. Only the two fade steps at 20.42-20.46 s are large, as designed (the dip) | tblend + signalstats; numbers in this run (y.txt) |
| 4.3 | Focus trap | PASS. Tab while playing: 4 presses, focus stays on ✕. At the end: Again, Back, ✕, Enter, Again (cycles inside the film); Shift+Tab goes back to Enter. Never reaches the hold's pills. Code: Tab handler in app.js, `keydown` | `qa-live/probe.txt` (tabPlaying, tabEnd, shiftTab) |
| 4.4 | Dead fade | PASS. On "Enter 846" `#fade` has z-index 30 (above the film's 20); screenshot at 300 ms shows the end screen going dark under the fade; the audio fade is still called | `qa-live/probe.txt` (fade), `probe_fade.png` |
| 4.5 | play() race | PASS. Synchronous open, close, open leaves `endHidden:true`, video playing (t 1.14), film open. The catch now acts only on NotAllowedError and only if `building.frame` | `qa-live/probe.txt` (race); app.js openBuilding |
| 4.6 | Resize / source choice | PASS. Open at 1440 px gets the 1080 file; close, resize to 600 px, reopen gets the 720 file (decodes 1280x720). The source is chosen per open | `qa-live/probe.txt` (resize) |
| 5 | Hold flow regression | PASS (check.txt E1-E3, F1, D1-D3 on 4 devices; hold rests per 3c) | `qa-live/check.txt` |

## Observations (not failures)
- Resizing while the film is already playing does not switch the source until the next open (by design, "per open"). A phone user rotating mid-film keeps the file it started with. Soft, not broken.
- `check-building.cjs` in hold-building-tour/logs still asserts the removed iframe (gate note 7); it is stale, nothing runs it.
