
## 2026-11-03 · main session (rnd-23) · board platform-ui-ux CLOSED
- **Did:** Cards 01–21 DONE: tokens + self-hosted fonts + hb-* components; Studio rebuilt and checked on its real server ($0); home, landing, apartment frame and the chrome over the media on the tokens; stage_flow stages the real apartment media. Every gate failed once and passed after fixes (G1, G2, Phase 4, ux-judge PASS-WITH-NOTES), QA live PASS. Copied back 23:15 (164 files verified); npm ci live; 846 dist + tour rebuilt. Agents minted: none.
- **Evidence:** `development/tasks/platform-ui-ux/logs/qa-live-report.md`
- **Learned:** Fresh refute-first reviewers caught a real defect at every gate (stale test, mid-number price wrap, CLS from a deferred module, drafts shown as ready). CSS shared cross-origin (the hold) must @import its own tokens.
- **Owed / open:** OWED-024 (Eliran: prod deploy go + card 22, a11y text, Q4/Q5, copy); OWED-025 (live studio npm ci)
- **Second reader:** none

## 2026-11-04 · main-session · follow-up 2026-11-04: 3D frame under the phone CTA bar (fixed after close)
- **Did:** rnd-fd found on LIVE: apartment ?tab=3d on iPhone 13, 3D frame 230..691 under the CTA bar at 595. Cause: html scroll-padding added on top of .apt-panel scroll-margin (doubled offset) + the 44 px tap targets made the top bar 65 not 57. Fixed in css/apartment.css with measured bar-height vars and one scroll offset; reopened .wt/platform-ui-ux, closed again; 846 dist rebuilt. check-04 47/0, live probe frame 125..571 < bar 595, minimap/apartment/npm test green live.
- **Evidence:** `development/tasks/platform-ui-ux/logs/fix-2026-11-04-3d-under-bar.txt`
- **Learned:** Adding scroll-padding on html when a scroll-margin already exists doubles the offset. Fixed pixel heights of sticky bars break when tap targets grow: keep them as measured vars in one place. scripts/wt.py add now reopens a file closed earlier in the same task.
- **Owed / open:** production deploy still needs Eliran's go; the 2026-11-03 preview has the old css
- **Second reader:** `platform-dev`
