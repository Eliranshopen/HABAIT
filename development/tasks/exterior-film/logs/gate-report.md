# Gate report: board exterior-film, card A4 (fresh refute-first reviewer)

Date: 2026-11-04. Read-only on the working copies and the live files; no paid calls; no .env opened; the server on 8859 was started by me (PID 91171) and killed, and only TIME_WAIT sockets remain.

## Verdict: PASS-WITH-NOTES

I found no S0 or S1. I tried to refute honesty, resolution, autoplay-refused, resize, focus and the regression flow. All of them held, except the notes below.
My own re-run of check-film.cjs on a fresh server: **76/76 PASS** (`logs/gate-check.txt`). The iPhone row Z failure from the main session did not reproduce.

## Findings

| # | Sev | Area | What I saw | Evidence |
|---|---|---|---|---|
| 1 | S2 | Quality, seam | The second crossfade (arc → descent, 0.6 s at about 23.9-24.5 s) shows a ghosted double exposure of two different building views: the tower with the lighthouse small behind it fading into the close facade with the lighthouse large. The poses do not match, so for about 0.6 s you see a translucent building on a building. The first crossfade (orbit → arc, 16.5-17 s) is clean, because the poses are the same. | contact sheet `scratchpad/rv/f/xf2.jpg` (frames 4-6 of the 8 are the ghost); xf1.jpg is clean. Recommend a hard dip or a longer, pose-matched transition, or Eliran's eye on it. |
| 2 | S2 | Quality, judder | The arc has 103 distinct source frames spread over 192 output frames, so there is no interpolation. 19 of 166 arc frames are exact duplicates. At the turn-around (about 20.5 s) the motion is stop-and-jump, with held frames and then a whole-frame step (frame-diff pattern 7.9, 0.2, 0.5, 8.2, 0.0, 0.0, 0.1 ...), not a smooth ease. The longest duplicate run is 7 frames. The orbit and the descent are clean (2 and 0 duplicates). There is no black frame and no freeze of 0.3 s or more (blackdetect and freezedetect found nothing), and I saw no flicker. | `scratchpad/rv/yavg.txt` (per-frame difference), computed with ffmpeg tblend + signalstats |
| 3 | S2 | A11y, focus | `#buildingFilm` declares `role=dialog aria-modal=true`, but focus is not trapped. While the film plays, Tab leaves it for the hold's hotspot pills underneath (BODY, then hotspot 846, 845 ...). At the end screen, Tab goes Again → Back → BODY → page buttons. The pills are invisible to a sighted keyboard user, and Enter on one acts under the film. Esc still closes. | `logs/gate-shots/probe.txt`, "4 tab seq" rows. Fix: `inert` on the hold chrome while open, or a Tab-wrap. |
| 4 | S3 | Behaviour, dead fade | "Enter 846" sets `#fade` opacity to 1 and fades the ambience, but `#fade` has z-index auto and the film is z-index 20, so the fade-to-black is never seen. You get a hard cut to the tour after 650 ms with the end screen still showing, unlike `#enterBtn` on the hold, where the fade is visible. The audio fade still works. | probe "5 enter": fadeOp 1, fadeZ auto, top element is the film's ✕. Screenshot `logs/gate-shots/5_enter_fade.png` |
| 5 | S3 | Behaviour, race | A synchronous open → close → open (one task) leaves the end-screen buttons visible over a playing film. The first `play()` is aborted by `pause()` and its `.catch` fires after the second open, setting `bEnd.hidden=false` with state "blocked". With even 300 ms between the calls, the state was clean. A real user will rarely hit it. The cause is that the catch does not distinguish an AbortError from a NotAllowedError and does not check `building.frame`. | probe "2 rapid sync", first row `{endHidden:false,state:"blocked",paused:false,t:2.43}` |
| 6 | S3 | Behaviour, resize | The source is chosen only once, on the first open (`if(!getAttribute('src'))`). Opening at 1440 px and then resizing to 600 px keeps the 1080 file, and a reopen keeps it as well. The reverse (open on a phone, then widen) keeps the 720 file. The result is soft, not broken. A phone that opens at 390 px gets the 14 MB file; a 900 px+ iPad on cellular gets 33 MB with no metering. The 900 px cut-off is as specified. | probe "3 resize" and "3 reopen" rows |
| 7 | S3 | Leftovers | The working copy has no `#buildingFrame`, `buildingUrl` or `ambWasOn`. The live originals still contain them, which is expected until copy-back. The one name left over is `building.frame`, which now holds the film box (cosmetic). `development/tasks/hold-building-tour/logs/check-building.cjs` is stale and would fail against the new overlay (it asserts the iframe), and nothing else calls the removed functions. | grep result; check-building.cjs line references `#buildingFrame` |
| 8 | S3 | Honesty note | The film is cut only from the approved clips (orbit.mp4, hold-arc frames 66-169, descend-846.mp4), per `cut_film.py` and the 2 s contact sheet, which shows 14 frames all of the same Rainbow tower and context. I saw no frame that is not from those clips and no invented building. One caveat to give Eliran: Topaz Starlight is a generative upscaler, so the 1080 pixels are re-synthesised detail on top of an already AI clip. The disclosure covers this, and I saw no geometric deviation at 2 s sampling. | `scratchpad/rv/f/sheet.jpg`, `cut_film.py`, `spend-ledger.txt` ($0.73 of $10, consistent with the rows) |

## What held (refutation attempts that failed)

| Area | Result |
|---|---|
| Legal text | byte-equal to `#clipLegal` (Python compare of the two HTML strings: True). Also checked on every device by C3. |
| Disclosure | The badge and the legal text are DOM overlays (z-index 1 above the video and above `#buildingEnd`), so they are on every frame, including the poster, the blocked screen and the end screen. I saw them in `6_*_end.png` and `1_blocked.png`. |
| Resolution | The desktop 1440 px open decodes at 1920×1080, and the 720 file at 1280×720 on phones. Both are h264 yuv420p 24 fps, 682 frames, 28.417 s, with moov at the front. 1080 is 32.6 MB (9.2 Mbps) and 720 is 14.0 MB (3.9 Mbps), as expected. |
| Autoplay refused | With `play()` rejected (NotAllowedError): the end screen shows with the actions, focus is on ✕, and "צפייה חוזרת" starts the film (t advanced, paused false). Without `--autoplay-policy`, the muted video autoplays natively. |
| Esc and focus | Esc closes during play and at the end; focus returns to `#buildingBtn`; on open focus goes to ✕; at the end focus goes to the enter button. |
| Reduced motion | The transition drops to 1e-05 s and the film opens at opacity 1. |
| RTL | The progress line is origin-right, the legal text is `direction: rtl`, the badge sits at inline-end, and the buttons are centred. |
| Phones | iPhone 13, Pixel 7, iPhone SE (320 px) and a landscape phone: ✕ (44 px, top-centre) overlaps neither the badge nor the legal text; the badge does not overlap the legal text; the end buttons are all inside the screen. On the 320 px SE the legal text takes 7 lines and about 114 px of the bottom, which is legible. |
| Regression | The 76-row check passes: pill → card → continue → descent → tour, E1 (button hidden during the descent), E2 (hand-off `scope=apartment`) and F1. There are zero page errors and zero 4xx/5xx. |

## Evidence index

- `logs/gate-check.txt`: my 76/76 re-run. `logs/gate-check/`: its frames.
- `logs/gate-shots/`: probe screenshots. `logs/gate-shots/probe.txt`: probe rows.
- Probe source: `C:\Users\elira\AppData\Local\Temp\claude\76e6db1160dffba0\6683ba3a-fb19-404a-b004-9f31015522b3\scratchpad\rv\probe.cjs`.
- Frame analysis: `scratchpad\rv\yavg.txt`, `scratchpad\rv\f\sheet.jpg`, `xf1.jpg`, `xf2.jpg`.
