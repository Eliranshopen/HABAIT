# habait-ux-judge — lessons (newest last)
<!-- created 2026-11-03 by habait-ux-judge at its first task (board platform-ui-ux card 19); no archive shelf yet -->

## 2026-11-03 · habait-ux-judge · platform-ui-ux card 19 (Phase 4 frames review)
- **Did:** read ~45 before/after frames (current\, after\, .wt\platform-ui-ux\after\) against the plan, research §2.2/§4 and raw-B's 15 principles; Check PASS (40/40 names, viewport sizes equal); verdict FAIL — 4×S1: Studio deliverables "מוכן" while 13/14 scenes are clay drafts (app.js:405,414); review step hard-coded ✓ while "עוד לא נקרא" (index.html:84,110); home has no action above the fold at 1440/390/1280; landing B shows two EN toggles + project title ×3. Reopen 07, 11, 14, 16 (+06 S2, +18 re-capture).
- **Evidence:** `development/tasks/platform-ui-ux/logs/ux-review.md`
- **Learned:** (1) A capture set taken before an audit-fix pass proves nothing about the fixes — check timestamps (capture 22:28–22:31, fixes later; phase4b-cls still 0.346). (2) `'‹'` written for Hebrew renders as `›` in RTL (U+2039 is Bidi_Mirrored) — a "mirrored by hand" chevron flips twice. (3) Full-page captures can show lazy images blank; compare with the builder's own frames before calling a gallery empty. (4) A frame named for a state (07 images) may show another state — open it, never trust the name.
- **Owed / open:** Eliran's Q1–Q7 in the review (draft state, landing-B voice, intake language, developer-name display, legal ×3, highlights, accessibility slot); a fresh re-review of 01, 04, 11 and phone 05 after the reopened cards.
- **Second reader:** `platform-dev` — the reopened cards 07/11/14/16/06 are its work, with file:line anchors in the review.

## 2026-11-03 · habait-ux-judge · platform-ui-ux card 19 re-check
- **Did:** re-judged on frames re-captured after `tools/ux_fix.py` (fix 22:55, frames 22:58–23:02): F1/F2/F3 closed, F5 unverified (the unread-intake state was not re-photographed), F6/F7b/F13–F15 closed; still open F7 (timeline bidi still scrambled), F11 (fade on the start edge; the hidden tab is on the end edge), new F23 (half-empty grey spec grid at 1440/1280). Verdict PASS-WITH-NOTES, on condition of one unread-state Studio frame before card 20.
- **Evidence:** `development/tasks/platform-ui-ux/logs/ux-review.md` §"בדיקה חוזרת"
- **Learned:** a fix that removes items can leave holes (2 of 4 grid cells → an empty slab); an RTL "scroll hint" fade must sit on the inline-end edge — check which edge the hidden item is on.
- **Owed / open:** the F5 unread-state frame (capture lane); F7, F11 and F23 recommended before the copy-back; Q4/Q5/Q7 are Eliran's.
- **Second reader:** `platform-dev` — F7, F11 and F23 are its fixes.

## 2026-11-03 · habait-ux-judge · platform-ui-ux card 19 re-check 2 (final)
- **Did:** judged the five items on the second-round frames (studio-recheck 23:10, c16-recheck 23:12–23:13): F5 closed (the real server shows "·" + "עוד לא נקרא" before the read and "!" with 10 open), F7, F9, F11 and F23 closed (F7 and F11 keep S3 residues). Final verdict PASS-WITH-NOTES: 0 S1, open S2 F8, F10, F12.
- **Evidence:** `development/tasks/platform-ui-ux/logs/ux-review.md` §"בדיקה חוזרת 2"
- **Learned:** a condition phrased as "photograph state X" closes a verdict cleanly; a hand-rolled RTL fade can sit over the selected item — check the selected state, not only the overflow.
- **Owed / open:** Eliran's Q4, Q5 and Q7; F8 and F10 are logged S2.
- **Second reader:** `platform-dev` — nothing more to reopen; the S3 residues (fade over the selected tab, the "בוקר: 14" order on the phone) are optional.
