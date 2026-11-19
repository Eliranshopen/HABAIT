## 2026-11-08 · sub-agent rainbow-landing (worktree `.wt/rainbow-landing`) · the habait-flow root becomes the Rainbow landing page
- **Did:** On Eliran's ask, `/` (`Habait/platform/index.html`) is now a dedicated Rainbow landing page. It cost $0. The hero is the exterior orbit of `building-film-1080.mp4` (AI: Kling v2v + Topaz), 0–14.4 s only, so it stops before the descent into the old interior. The loop seam dips through black. There are three encodes: 1080p 7.2 MB, 720p 3.3 MB, and a 2:3 phone crop 3.4 MB. The poster paints first and the film starts after load. A pause/play button is there, and reduced motion means no autoplay. Sections: location (render THE-1 and its place labels), architecture (THE-2/3/6), four real routes, apartment 846, and a closing CTA. Merged into main as `df98ecd`. NOT deployed.
- **Evidence:** `Projects/Habait/habait-walkaround/qa-evidence/platform/rainbow-landing-2026-11-08/` (`check/result.json` PASS 1440+390 on the worktree stage; `gate/verdict.json` 6/6; `predeploy-worktree/verdict.json` 32/32; `predeploy-main/` = the real `stage_flow.py --edit-api --studio` from live main after the merge: predeploy 32/32 + landing check PASS); media manifest `Habait/platform/fixtures/rainbow/landing/manifest.json` (sha256 per file, cost 0); plan `development/plans/2026-11-08-rainbow-landing.md`.
- **Learned:** (1) `units.json` gives 846 as 4 rooms · 118 m² · 22 m², but the sales-plan meta says 3 rooms · 106.72 m² · 26.15 m², and the apartment page prints the units.json numbers. The landing page prints neither. (2) The `_local/dist/rainbow/846` panos differ from the gated tour panos. Take interior pictures from `tour360/dist/apt846/panos*/` (v360 flat view). (3) Chrome skips a viewport-filling hero image as an LCP candidate, so the LCP is the hero text (100–164 ms). (4) `dataset` does not camel-case `data-src-720`, so use `getAttribute`. (5) Main's `development/plans/CLAUDE.md` carried another session's uncommitted rows, which blocked the merge. The row went in as my own hunk instead.
- **Owed / open:** Eliran: Q1 disclosure wording on the four renders («הדמיה» / «Render»); Q2 the 846 facts mismatch; Q3 the reference film stays unused (licensing); the deploy go (the coordinator stages and asks). Context-file tables of `platform/`, `css/`, `js/`, `test/`, `tools/`, `fixtures/rainbow/` are stale for `/sync-context`. `test/browser.mjs` step 1 was updated but not run (needs serve.mjs on live). `.wt/rainbow-landing` removal is Eliran's.
- **Second reader:** `habait-deploy-qa` — the next habait-flow deploy carries a new root page and 14 MB of new media. The deployed-site QA must re-run `test/rainbow-landing.check.mjs` against prod.

## 2026-11-08 · sub-agent rainbow-landing · round 2 (Eliran's review): project-level landing, one CTA into the unchanged hold flow
- **Did:** Following Eliran's «לא רוצה הפנייה רק לדירה 846 … אחרי הריחוף שכל הדירות יראו לי ואוכל לבחור כמו שהיה עד עכשיו», I removed the 846 hero button, the nav item, the section and every 846 string. The experience cards now describe the one flow in order and are not links. The only action is «לסיור בפרויקט» = `projectHref()`, the route of the old home page, proven equal to the production CTA. Q1 is closed: Eliran ruled «הדמיה» on his renders. Merged as `fa28f34` into main (= the live files). NOT deployed.
- **Evidence:** `Projects/Habait/habait-walkaround/qa-evidence/platform/rainbow-landing-2026-11-08/flow/flow.json` and `predeploy-main/flow.json`. At 1440 and 390: CTA → `orbit_real.mp4` plays → the hold stops → 12/12 units of units.json have a marker (9 visible at 1440, 8 at 390) → 845's card → 846 «המשיכו אל הדירה» → `#tourFrame` /tour/ in front. `predeploy-main/` = the real `stage_flow.py --edit-api --studio` from live after the merge: predeploy 32/32, landing check PASS, flow PASS. `gate/verdict.json` 8/8.
- **Learned:** The hold's own picker is `js/picker.js` without the chrome option. Only 846 can be entered (`canEnter` in the hold's `app.js`); the other units open their card. At 390 the hold's legend and «דירות» chip cover its title. That is pre-existing UI and was not changed. **Incident (mine, fixed):** my one-line replace helper ran `open(p,'wb').write(f(open(p,'rb').read()))`. Python truncates the file before it reads it, so the live `development/plans/CLAUDE.md` was emptied for about 2 minutes, including another session's 6 uncommitted rows. I restored it byte for byte from Claude Code's file history (`~/.claude/file-history/bf387f38…/223d1fb7f0ca7fed@v11`, 14:43, newer than that session's last snapshot at 14:27). Its 6 rows are back and still uncommitted, and only my row is committed. Lesson: always read into a variable before you open a file for write.
- **Owed / open:** the deploy go (the coordinator). `.wt/rainbow-landing` removal is Eliran's. The context-file tables of the platform folders need `/sync-context`. `interior-living.jpg` was taken out of the repo (now unused); a copy is in the session scratchpad and the file is in git history at `3c7c9b2`.
- **Second reader:** `habait-deploy-qa` — the deployed QA must run both `test/rainbow-landing.check.mjs` and `test/rainbow-flow.check.mjs` against prod.

## 2026-11-08 · sub-agent rainbow-landing · round 3: the hold's phone chrome at the stop (first screen after «לסיור בפרויקט»)
- **Did:** Fixed the 390 pile-up on /hold/ at $0. On a portrait phone the picker row was pinned at 64 px, on the title at 72 px. Now one flowing column sits under the two top buttons: title → legend → «דירות» → the legal line on a glass panel (it is the AI disclosure). «לחצו על דירה» is dropped on phones. `placeDragHint()` puts the drag chip under the chrome (phones) or under the title (wider; at 1440 it used to cover pills 836/826), and the chip still leaves on the first drag or after 9 s. Flow and data untouched. Merged as `69cfd49` into main (= live). NOT deployed.
- **Evidence:** `Projects/Habait/habait-walkaround/qa-evidence/platform/rainbow-landing-2026-11-08/hold-chrome-before/hold-chrome.json` (live main before: FAIL, title×legend and title×«דירות» at 360/390/430, the drag hint on 836/826 at 1440). `hold-chrome/hold-chrome.json` (after: PASS 360/390/430/1440). `predeploy-main/` (the real `stage_flow.py --edit-api --studio` from live after the merge: predeploy 32/32, hold-chrome PASS, flow PASS, landing PASS). `gate/verdict.json` 8/8.
- **Learned:** The hold's picker chrome is `js/picker.js`'s `.picker-chrome` with absolute children. Making it a flex column on phones (children `position: static`) removes the overlap class for any text length. The coordinator's rule: a file that is no longer used goes into an `_unused/` folder, never `git rm` (deletions are Eliran's act).
- **Owed / open:** the deploy go (the coordinator). At 1440 the hold's legal line at the bottom-end sits over a busy roof; it is pre-existing and was not changed. `.wt/rainbow-landing` removal is Eliran's.
- **Second reader:** `habait-deploy-qa` — the deployed QA adds `test/hold-chrome.check.mjs` (the hold at 360/390/430/1440) to the landing and flow checks.

## 2026-11-08 · main session · combined round deployed
- **Did:** deployed the landing, the hold phone fix, the 846 numbers and the tour menus/walkthrough/voice cut/disclosure on Eliran's go (dpl_6JZXxQ2B, stage deploy-R-12).
- **Evidence:** the SHIP-LEDGER row dpl_6JZXxQ2B; predeploy 32/32; served hashes = stage; map→3D 6/6; prod flow PASS 1440+390.
- **Learned:** Eliran wants the landing page to be project-level, with all apartments selectable after the fly-around, never a single-unit shortcut. He ruled «הדמיה» for the developer renders and «להסתיר» for the fixture prices (a separate round). He approves only on screenshots, so send the approval page first.
- **Owed / open:** hide the fixture prices (apartment page and hold card); the other type-L units (826/836/856/866) still show template numbers. Rollback = promote dpl_5VvtfScS.
- **Second reader:** habait-deploy-qa, which already has pointers for the new checks and #t-view-btn.

## 2026-11-08 · sub-agent rainbow-landing · round 4: prices hidden behind one switch, no portal link on the landing
- **Did:** Eliran's two rulings: «כן, להסתיר» on the fixture prices, and «פורטל יזמים … לא צריך להיות בדף נחיתה». Added `prices_public: false` to `fixtures/rainbow/project.json`. `js/picker.js` (the hold/flow card and the «דירות» list, including «מחיר לפי פנייה»), `js/apartment.js` (`#aptPrice` and the «אודות» row) and `js/landing.js` render a price only when the flag is `true`. `tools/build_zip.mjs` copies the flag into apartment.json. The dist was not rebuilt (no flag = no price). The fixture values stay in the data. The /hold/ stage now rises above its top buttons while a card or the list is open (they used to float over the list). The landing footer lost its /studio/ link in HE and EN. Merged as `6673204` into main (= live). NOT deployed.
- **Evidence:** `Projects/Habait/habait-walkaround/qa-evidence/platform/rainbow-landing-2026-11-08/no-price-before/no-price.json` (live main before: FAIL, 7,950,000 / 8,050,000 / «מחיר» / the /studio/ link). `no-price/no-price.json` (PASS 360/390/1440). `no-price/prod-dev-only.json` (prod dpl_6JZXxQ2B: the fixture chip and the a11y TODO are hidden). `predeploy-main/` (the real `stage_flow.py` from live after the merge: predeploy 32/32, no-price, flow and hold-chrome PASS). `gate/verdict.json` 8/8.
- **Learned:** The dev-only items (the «fixture» chip, the a11y TODO, the v0 footer) key on DEV = localhost or ?dev=1, so they show in every local check and never on prod. `#pickerStage` is position:fixed and therefore its own stacking context: the z-index of its children cannot beat the root's z-6 buttons, so the stage itself must rise (`:has(open panel)`). flow.html's HUD targets are under 44 px; that is pre-existing on main, and flow.html is not a Rainbow buyer route. Not fixed. A slip of mine: an `rm -f` in a shell line removed my own two just-made gate screenshots of flow.html. The identical before-evidence stays in the scratchpad `gate-flow-main/`. Lesson: relocate, never rm, even scratch evidence.
- **Owed / open:** the deploy go (the coordinator). The tour's furniture-catalog prices («מחיר נכון ל-…») are catalog prices, not unit prices, and belong to fork A's viewer; flagged, not changed. The lead webhook still sends `price` in its payload (not rendered). `.wt/rainbow-landing` removal is Eliran's.
- **Second reader:** `habait-deploy-qa` — the deployed QA adds `test/no-price.check.mjs` against prod.

## 2026-11-08 · main session · final round deployed (17:12)
- **Did:** deployed sections 6–8 on Eliran's go (dpl_FfHZZ5z1, stage deploy-R-13): the walkthrough and music on every visit, the wide-screen clip fix, prices hidden, the landing without the portal link, and /studio/ live status. Main now equals live for the portal too.
- **Evidence:** the SHIP-LEDGER row dpl_FfHZZ5z1; prod gate 32/32; map→3D 6/6; prod flow PASS.
- **Learned:** Eliran's rule for today: «אני לא רוצה בנייה אמיתית שעולה כסף, רק שהכל יעבוד תקין», so the portal build lock stays closed. The /hold/ → tour music-without-tap behaviour is proven by a labelled stand-in, not in a real browser; a check on Eliran's own Chrome is owed.
- **Owed / open:** a real-Chrome confirmation of the music on /hold/ → tour; the type-L units 826/836/856/866 still show template numbers. Rollback = promote dpl_6JZXxQ2B.
- **Second reader:** habait-deploy-qa (pointers already added by the forks).

## 2026-11-08 · sub-agent rainbow-landing · round 5: the /hold/ legal line at the bottom edge, small (Eliran on his iPhone)
- **Did:** Eliran's «זה לא אמור להופיע באמצע המסך ולהסתיר את הבניין, זה אמור להיות רק למטה ובקטן». The picker's legal line left the phone column and is fixed to the bottom edge at every width: 12 px white on the image, a multi-layer text-shadow, a soft fade, no panel, above the iOS toolbar. The wording is exact (project.json disclaimer). It shows 2 lines that always carry the AI words; «פרטים» opens the full text and «סגירה» closes it (`app.js`). Phones: title, then legend + «דירות» in one row. Landscape phones: the legend row and a narrower legal strip on the inline-start side (the tower's pills reach the bottom). Desktop: the same strip, the legend row above it. Merged as `24f0f29` into main (= live). NOT deployed.
- **Evidence:** `Projects/Habait/habait-walkaround/qa-evidence/platform/rainbow-landing-2026-11-08/hold-chrome/hold-chrome.json` (worktree stage) and `predeploy-main/hold-chrome.json` (fresh `stage_flow.py --edit-api --studio` from live after the merge: predeploy 32/32, hold-chrome, flow and no-price PASS). Worst-glyph-pixel contrast with the shadow, on the live-main stage: 360 11.38 · 390 9.61 · 430 11.87 · 390-landscape 7.49 · 1440 11.10 :1; with the fade alone 2.03–3.61:1. `gate/verdict.json` 8/8.
- **Learned:** With `-webkit-line-clamp` + `overflow:hidden`, the next line paints into padding-bottom. Put the safe-area gap in a transparent border instead: the clip stops at the padding box. Contrast for text on images = glyph pixels of a frame against the same frame with the text made transparent; the text-shadow is what reaches ≥ 4.5:1, the fade alone does not. In landscape the stop frame puts pills down to the bottom edge, so a full-width bottom strip covered 826/835/836.
- **Owed / open:** the deploy go (the coordinator). With «פרטים» open, the expanded text (4 lines at 390) may sit over 826; that is a deliberate user action and it closes on a tap. `.wt/rainbow-landing` removal is Eliran's.
- **Second reader:** `habait-deploy-qa` — `test/hold-chrome.check.mjs` now covers 390 landscape and the legal line's contrast. Run it against prod after the deploy.

## 2026-11-08 · main session · /hold/ legal line deployed (21:06)
- **Did:** deployed dpl_58Y3GDw6 on Eliran's go («פשוט תעלה יאללה», no screenshot round). The /hold/ legal line moved to the bottom edge, small, with a compact phone top.
- **Evidence:** the SHIP-LEDGER row; prod gate 32/32; map→3D 6/6; flow PASS.
- **Learned:** for a small fix he reported himself, Eliran can waive the screenshot round. That go covered this deploy only; ask again next time.
- **Owed / open:** none. Rollback = promote dpl_4ZVXeYRH.
- **Second reader:** habait-deploy-qa (run the extended hold-chrome check on prod).

## 2026-11-09 · sub-agent rainbow-landing · round 6: /hold/ phones get one right-edge column, no title
- **Did:** Eliran's «יש כמה דברים שאפשר להוריד … את הסרגל של "למכירה, שמורה, נמכרה" … לאורך בצד ימין בקטן. את הכפתור דירות גם שיהיה בצד ימין». On phones (touch, ≤ 900 px wide or ≤ 500 px tall) the stop drops the title «מול החזית · בחרו דירה» and the hint «לחצו על דירה». One column sits on the physical right edge: sound → «הדמיית הבניין והסביבה» as a 44 px building icon (the same button: it opens the building film; its text stays its accessible name) → «דירות» (44 px) → the legend as a small vertical stack. The drag hint sits top-left; the legal line stays at the bottom. Desktop unchanged. Merged as `f9f6148` into main (= live). NOT deployed.
- **Evidence:** `Projects/Habait/habait-walkaround/qa-evidence/platform/rainbow-landing-2026-11-08/hold-chrome/hold-chrome.json` and `predeploy-main/hold-chrome.json` (fresh `stage_flow.py --edit-api --studio` from live after the merge: predeploy 32/32, hold-chrome, flow and no-price PASS). Phones: no title or hint, icon / «דירות» / vertical legend at the right edge, no pill covered, the icon opens the film (h4). Desktop: title and labelled pill present. `gate/verdict.json` 8/8.
- **Learned:** In an RTL flex column, `align-items: flex-start` is the physical RIGHT edge (flex-end put the legend 18 px in from it). A touch-only media query (`hover: none` and `pointer: coarse`) keeps desktop byte-identical in layout, while headless phones (isMobile + hasTouch) match it.
- **Owed / open:** the deploy go (the coordinator). `.wt/rainbow-landing` removal is Eliran's.
- **Second reader:** `habait-deploy-qa` — the deployed QA runs `test/hold-chrome.check.mjs`, which now also asserts the phone right column, against prod.

## 2026-11-09 · main session · phone round deployed (08:53)
- **Did:** deployed dpl_D9qViTbh on Eliran's go («פשוט תעלה ישר»): the /hold/ phone right-edge column and the tour tap-hint pill.
- **Evidence:** the SHIP-LEDGER row; prod gate 32/32; map→3D 6/6; flow PASS.
- **Learned:** Eliran now often waives screenshot rounds for his own phone fixes («תעלה ישר»), but the go is still per deploy.
- **Owed / open:** a real-iPhone look (safe areas, music). Rollback = promote dpl_58Y3GDw6.
- **Second reader:** habait-deploy-qa.

## 2026-11-09 · sub-agent rainbow-landing · round 6b: the /hold/ intro at 2x
- **Did:** Eliran's «הסיבוב סביב הבניין … מאוד איטי … יותר מהיר … גם במובייל וגם בדסקטופ». Made `fixtures/rainbow/orbit_fast.mp4`: `orbit_real.mp4` at 2x by re-encode (every frame kept, 24 → 48 fps, 8.54 s, 6.7 MB, last frame = the hold pose, SSIM 0.977), with a manifest row (`speed_factor: 2`, $0). `project.json` `exterior.intro.clip` points at it and the original stays. The intro title's timing scales with the clip. Merged as `7802edc` into main (= live). NOT deployed.
- **Evidence:** `Projects/Habait/habait-walkaround/qa-evidence/platform/rainbow-landing-2026-11-08/timing-before/timing.json` (17.4 s click → picker at 390 and 1440). `timing-after/timing.json` (8.8 s). `predeploy-main/timing.json` (fresh `stage_flow.py` from live after the merge: 8.9 s / 8.7 s; predeploy 32/32, flow PASS). hold-chrome, no-price and gate 8/8 PASS on the worktree stage.
- **Learned:** The time to the picker is the clip's length plus about 0.3 s; the hold scene is ready long before the clip ends. Speeding by re-encode (`setpts` + double fps, every frame kept) beats `playbackRate` on mobile and keeps the last frame exact. The flow check's prod-route comparison now ignores which orbit file is used.
- **Owed / open:** the deploy go (the coordinator). The film's own legal line (`#clipLegal`, 4 lines bottom-left during the intro) is the pre-r5 treatment; flagged, not changed. Next: round 7, the landing redesign.
- **Second reader:** `habait-deploy-qa` — after the deploy, run `test/hold-timing.check.mjs` against prod (expected ~9 s).

## 2026-11-09 · sub-agent rainbow-landing · round 7: the landing as a scroll story
- **Did:** Eliran's «שלא יראה כמו דף נחיתה פשוט של AI אלא משהו מרשים, גם למובייל וגם לדסקטופ». Read the new skills (build-awwwards-quality-sites, cinematic-scroll-storytelling + demo, landing-page-design without its image generation, refero-design anti-slop) and locked one direction: an image-led daylight launch site in numbered chapters — the film, one sentence, 01 Location, 02 Architecture, 03 Experience, then the film frame opening into the CTA. It uses Frank Ruhl Libre display and no cards. `js/landing-motion.js`: GSAP 3.12.5 + ScrollTrigger + Lenis 1.3.4, self-hosted (`js/vendor/VENDOR.json`, 50.5 KB gz). Desktop: Lenis plus pinned location / sideways gallery / sticky steps. Phones: native scroll, no pins. Reduced motion / no JS = the static page. Merged as `782594a` into main (= live). NOT deployed.
- **Evidence:** `Projects/Habait/habait-walkaround/qa-evidence/platform/rainbow-landing-2026-11-08/motion/` (m01–m12 at 1440 and 390, m00 reduced motion; `motion.json`: Lenis and 2 pins on desktop, 0 on the phone, no overflow, no error). `predeploy-main/` (fresh `stage_flow.py` from live after the merge: predeploy 32/32; landing, motion, flow, no-price and hold-chrome PASS; LCP = hero text 164–188 ms, CLS 0). `gate/verdict.json` 8/8.
- **Learned:** home.js re-renders `[data-t]` text, which used to destroy word splits. It now skips an element whose `data-split-text` equals the new text, and landing-motion re-splits on `rl:rendered` after a language switch. With Lenis, scroll programmatically through `lenis.scrollTo(y, {immediate})` (`window.__rlLenis`). A badge check must skip hosts that are not shown at a size (the sticky frame's hidden layers). The renders are only 1056 px, so in the 100 vh pinned split they are upscaled about 1.4×; a larger source would help.
- **Owed / open:** the deploy go (the coordinator). Generated context-file tables (`js/`, `js/vendor/`, `test/`, `css/`) need `/sync-context`. Larger render files would sharpen the pinned frames (Eliran's source).
- **Second reader:** `habait-deploy-qa` — the deployed QA adds `test/landing-motion.shots.mjs` (desktop pins + Lenis, phone native, reduced motion static) to the landing check against prod.

## 2026-11-09 · main session · faster intro + scroll-story landing deployed (13:29)
- **Did:** deployed dpl_389BQQbQ on Eliran's go: /hold/ intro at 2x and the landing redesigned as a cinematic scroll story with the newly installed skills.
- **Evidence:** the SHIP-LEDGER row; prod gate 32/32; map→3D 6/6; flow PASS.
- **Learned:** the renders are 1056 px wide, so they look soft in large desktop frames. Ask Eliran for larger originals.
- **Owed / open:** larger render files; the intro film's own 4-line legal text; /sync-context for the new files and skills. Rollback = promote dpl_D9qViTbh.
- **Second reader:** habait-deploy-qa.

## 2026-11-09 · sub-agent rainbow-landing · round 8: luxury palette — research + three directions (waiting for Eliran's pick)
- **Did:** Eliran's «עדיין נראה מאוד מיושן ומשעמם … צבעים יותר יוקרתיים … תחפש טמפלייטים וסגנונות עיצוב UI UX באינטרנט». Researched online (WebSearch/WebFetch) 11 sites and templates: ERA, Silver Pinewood, The Aerie, Aman Residences, Belgrade Arbor, STILL/FORM, Springs, Halden/Yosef templates, Bulgari, CPT/111W57, Tel Aviv towers. Patterns only, no brand or copy taken. Built three static direction mocks with our film frame and renders: A Onyx & Champagne, B Midnight Sea & Bronze, C Ivory Gallery & Brass. They are on one contact sheet. Recommendation: A. No product file changed; merged as `529c41b` (plan + mock sources).
- **Evidence:** `Projects/Habait/habait-walkaround/qa-evidence/platform/rainbow-landing-2026-11-08/r8-directions/contact-sheet.png` (+ `mock-a/b/c.html` and screenshots at 1440/390); research table, URLs and contrast numbers in `development/plans/2026-11-08-rainbow-landing.md` round 8.
- **Learned:** sixsenses.com and fourseasons.com return 403 to WebFetch. Fetched text rarely carries CSS, so palettes came from Awwwards colour listings (Silver Pinewood #282828/#998170), case studies (ERA) and inspiration write-ups (The Aerie hex set). Brass #8E6B38 on bone is only 4.26:1, so it is for large type and lines only.
- **Owed / open:** Eliran picks A/B/C (via the coordinator); then build the full page in that direction on the r7 motion system and run all checks.
- **Second reader:** none until the pick (no product change).

## 2026-11-09 · sub-agent rainbow-landing · round 8 build: direction B · Midnight Sea & Bronze + new copy + SplitText reveals
- **Did:** Built Eliran's pick B on the full landing. Midnight/deep-sea surfaces, sand text, bronze for large type only. The film sits in a framed window beside a large Heebo 200 headline (desktop) and goes full-width on phones. Square sand CTA with a bronze sweep; THE-2 dusk render under the closing band. The copy was rewritten with the antislop/copywriting skills: specific places, «בהדמיה» where render-based, no invented facts, EN to match. GSAP 3.12.5 → 3.13.0 (SplitText + CustomEase; ScrambleText vendored, not loaded; 3.12.5 moved to `tools/_unused/`). SplitText by lines with aria "auto"; the statement is scrubbed on desktop and plays once on phones; reduced motion leaves everything static. Trimmed scope on Eliran's "sooner": /hold/ chrome, the numeral scramble and extra gallery motion are deferred. Merged as `0b3f3be` into main (= live). NOT deployed.
- **Evidence:** `Projects/Habait/habait-walkaround/qa-evidence/platform/rainbow-landing-2026-11-08/check/` (landing PASS, CLS 0). `motion/` (m01–m12 at 1440/390, `sheetB-1440.jpg`, `sheetB-390.jpg`; vendor 57.9 KB gz). `gate/verdict.json` 8/8. `predeploy-main/` (fresh `stage_flow.py` from live after the merge: predeploy 32/32, flow PASS, no-price PASS). Before/after copy in the plan, round 8 build.
- **Learned:** GSAP 3.13 plugins attach to `window` via their UMD wrapper (`window.SplitText`, `window.CustomEase`). A split element must keep a `data-split-text` marker so home.js's i18n render does not overwrite an unchanged split. In the RTL window a Latin caption needs physical `right:` (its own `direction: ltr` flips logical insets).
- **Owed / open:** the deploy go (the coordinator). /hold/ chrome in B colours, the numeral scramble (ScrambleText already vendored) and extra gallery motion: a later round.
- **Second reader:** `habait-deploy-qa` — after the deploy, run the landing and motion checks against prod (direction B, SplitText present, reduced motion static).

## 2026-11-09 · main session · landing direction B deployed (14:33)
- **Did:** deployed dpl_BGG85yi2: direction B, the new copy and SplitText reveals.
- **Evidence:** the SHIP-LEDGER row; prod gate 32/32; map→3D 6/6; flow PASS.
- **Learned:** Eliran chose B over the recommended A. He judges the landing on «יוקרתי» and «לא משעמם»; plain copy and light stone read as old.
- **Owed / open:** the deferred extras (/hold/ chrome in B colours, numeral scramble, gallery motion); larger render files. Rollback = promote dpl_389BQQbQ.
- **Second reader:** habait-deploy-qa.

## 2026-11-09 · sub-agent rainbow-landing · the Habait brand (Eliran's vector logo)
- **Did:** Brought Eliran's original `habait-logo.svg` (HABAIT wordmark, roof line, «הבית של כל הבתים»; fill #051F6E) into `Habait/platform/brand/` verbatim. `tools/make_brand.py` derives:
  - navy, white and sand swaps;
  - a wordmark-only variant;
  - `-small` hairline variants for headers;
  - an H+roof favicon and a 180 px touch icon.
  Placements:
  - the landing header (sand wordmark);
  - the landing footer (full logo with the Hebrew tagline in HE, the wordmark in EN);
  - the apartment header (navy wordmark + project name);
  - the /studio/ header (wordmark + Studio);
  - the tour place card (inline currentColor wordmark);
  - favicons on the landing, landing.html, the apartment page and /studio/.
  /hold/ has no mark. The PNG reconstruction started first was dropped when the vector arrived (relocated, never committed). The live tour `dist/apt846/index.html` got the brand via `tour360/tools/apply-brand-to-dist.py` (one element; backup `dist/apt846.index.pre-brand.html`, outside the staged folder). Merged as `58c9ada` into main (= live). NOT deployed.
- **Evidence:** `Projects/Habait/habait-walkaround/qa-evidence/platform/rainbow-landing-2026-11-08/brand/` (`brand-diff.json`: optimised = original pixel-identical at 1×/4×/10×; `variants.png`; `placements.json` + b1–b7 at 1440/390). `predeploy-main/` (fresh `stage_flow.py --edit-api --studio` from live after the merge: predeploy 32/32, flow, no-price, hold-chrome and placements PASS). `gate/verdict.json` 10/10 incl. /studio/.
- **Learned:** Normalising big SVG translate offsets changes the antialiasing unless the summed offsets equal the renderer's float32 math (f32(element) + f32(group)). With that, the render is byte-identical. Chrome is itself ±1 noisy at 10×, so compare several renders. stage_flow's `--studio` stages the LIVE studio-web unless `--studio-src <worktree>` is passed. Thin-line logos need a same-colour hairline stroke under ~36 px high.
- **Owed / open:** the deploy go (the coordinator). The next `build-tour.mjs apt846` reproduces the brand from the template (no further patch needed). Round 9 next: the rainbowtlv.com teardown and rebuild.
- **Second reader:** `habait-deploy-qa` — after the deploy, run `test/brand-placements.shots.mjs` and `test/brand-diff.check.mjs` against prod.

## 2026-11-09 · main session · Habait brand deployed (15:39)
- **Did:** deployed dpl_HoCGVoUP: Eliran's vector logo site-wide.
- **Evidence:** the SHIP-LEDGER row; prod gate 32/32; map→3D 6/6; flow PASS.
- **Learned:** the official brand is the HABAIT thin-line wordmark with a roof line, the Hebrew tagline «הבית של כל הבתים» and navy #051F6E. The English tagline «HOME IS HABAIT» exists only as a PNG.
- **Owed / open:** a vector file of the English tagline (ask Eliran); round 9 (the rainbowtlv.com-inspired landing) is in progress. Rollback = promote dpl_BGG85yi2.
- **Second reader:** habait-deploy-qa.

## 2026-11-09 · sub-agent rainbow-landing · round 9: the rainbowtlv.com feel + who made what (merged 3a0a5e6, not deployed)
- **Did:** Read-only teardown of rainbowtlv.com (home page only).
  - `design-system` skill (HTML path) → `r9-reference/DESIGN.md`.
  - `reanimate` captures of the reference and of our clone; scroll sequences at 1440 and 390.
  - Rebuilt the landing in that feel with our content:
    - a white page with a colour-block field and a white card (our film = poster LCP, words, CTA);
    - alternating picture rows: wipe 110 % + scale 1.3→1, linear 0.9 s; text fade 100 px with CSS ease over 1 s, following ≈ 0.4 s later;
    - parallax bands;
    - a pink bottom bar with the rainbow stripe;
    - Bellefair + Assistant (OFL, Hebrew).
  - Round-8 files went to `tools/_unused/`.
  - Eliran's roles ruling, the developer named:
    - project.json `developer` as text on the landing hero and footer, the apartment header and /hold/ (clip title, and under the stop title on desktop);
    - Habait credited «הדמיה ואתר:» in the footer and on the tour card. The live `dist/apt846` was patched via the generalised `apply-brand-to-dist.py` (backup `dist/apt846.index.pre-brand-1.html`).
- **Evidence:** `Projects/Habait/habait-walkaround/qa-evidence/platform/rainbow-landing-2026-11-08/`:
  - `r9-reference/` (DESIGN.md, shots, `reanimate/ref-*` vs `clone-*` + `compare-*/sheets`, `side-by-side/sbs-1440.png`, `sbs-390.png`);
  - `r9-roles/`;
  - `r9-main/` (fresh stage of main: predeploy 32/32, landing check, LCP heroPoster, CLS 0, flow, no-price, hold chrome, brand, gate 10/10, all PASS).
  - Motion vs reference, per element track (plan round 9 table): durations within 5 ms; travel equal; text gap 0.38 vs 0.42 s; hero onset +0.11 s at 1440 (capture jitter) and +0.005 s at 390.
- **Learned:**
  - reanimate's bun hangs launching Playwright on Windows. Node 24 runs the `.ts` scripts directly; `ffmpeg-static` needs a hard link `ffmpeg` → `ffmpeg.exe`.
  - compare.ts pixel windows are meaningless when the clone has a playing film; use the `track.json` per element.
  - `[data-dev]` collides with `<html data-dev>` (dev.js), so use `data-dev-name`.
  - `body{overflow-x:clip}` propagates to the viewport and does not stop RTL scroll overflow; clip `main` instead.
- **Owed / open:** the deploy go (the coordinator).
  - The tour data has no developer field, so the tour card shows only the Habait credit.
  - The merge commit 3a0a5e6 lacks the Co-Authored-By trailer (the round commit 1722388 has it).
- **Second reader:** `habait-deploy-qa`. After the deploy, run `test/rainbow-landing.check.mjs`, `test/landing-motion.shots.mjs` and `test/brand-placements.shots.mjs` against prod, and check that the live tour card shows «הדמיה ואתר:».

## 2026-11-09 · sub-agent rainbow-landing · round 10: the project landing in our own identity (merged 4eabbab, not deployed)
- **Did:** Eliran rejected round 9 as a copy of rainbowtlv.com. Prod was rolled back to dpl_HoCGVoUP. The brief then went through three versions; the last one was used.
  - Worktree `.wt/rainbow-landing-r10`, built on the round-8 landing files (37bbdd5).
  - The habait-flow root now has v2's hero with no apartment lines: full-bleed film, large serif «Rainbow» + «תל אביב», «יזם: ישראל קנדה» from project.json, pause + badge.
  - Single CTA «לסיור בפרויקט» → /hold/, unchanged.
  - Copy rewritten from real facts only, plus a project sheet (developer, location, tagline, «הדמיה ואתר: Habait»).
  - Presentation ideas from six tower sites, inspiration only (53w53, Central Park Tower, the Rom Tower and Arlozorov Tower pages, mpbavli.co.il; v2): a numbered places legend, a picture stage with the neighbours waiting at the sides, drawn marks + an offset collage with corner chips.
  - Direction B kept (midnight/sand/bronze, Heebo + Frank Ruhl Libre).
  - Relocated to `Habait/platform/tools/_unused/`: the round-9 files and fonts, round 8 + roles, and the Landing-B draft.
  - hold/ and v2/ untouched.
- **Evidence:** `Projects/Habait/habait-walkaround/qa-evidence/platform/rainbow-landing-2026-11-08/`:
  - `r10/sbs-live-vs-r10-1440.png` and `-390.png`;
  - `r10-references/sheet-references-*.png`, `r10-mpbavli/`;
  - `r10-main/` (fresh stage of main): predeploy 32/32, gate 10/10, landing check, motion shots, no-price, brand, flow — all PASS. On the worktree stage the landing check measured LCP as the hero title (176 ms at 1440) and CLS 0.007.
  - Plan round-10 table: which idea from where.
- **Learned:**
  - "Inspiration" means ideas of presentation and motion re-made in our identity, never a reference's palette, type, grid, order or buttons. The audience (the developer) must not recognise any site.
  - mpbavli.co.il's carousel captures the mouse wheel, so capture its full page by programmatic scroll.
  - generate-cards.py `--root` writes a `docs/context-map.generated.md` under that root (relocate it). In a worktree without the PNGs it rewrites other rounds' tables (restore them with git checkout).
- **Owed / open:** the deploy (the coordinator: the test link first, then prod on Eliran's word).
- **Second reader:** `habait-deploy-qa`. After the deploy, run `test/rainbow-landing.check.mjs`, `test/landing-motion.shots.mjs` (now expects exactly one desktop pin) and `test/brand-placements.shots.mjs` against the deployed site.
