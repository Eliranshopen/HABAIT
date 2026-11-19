# Plan — the Rainbow landing page at the habait-flow root
<!-- 2026-11-08 · worktree .wt/rainbow-landing (branch rainbow-landing, off main 1a54ce0) · owner: Eliran Shopen · $0 -->

## The ask (Eliran, verbatim)
«אני רוצה גם שתשפר את כל הנראות של הדף נחיתה הראשוני של הפרויקט — שזה יהיה ממש דף נחיתה ייעודי לפרויקט, לפרויקט RAINBOW, ששם ישר יהיה סרטון של כל הבניין מבחוץ איך שנכנסים לעמוד» … «ללא עלות».
Later the same day: «עבור הדף נחיתה בהתחלה אתה יכול לקחת רעיונות מהסרטון הזה C:\RnD\screenshots\Rainbow-Boutique-1080p.mp4» (ideas only) and «הוספתי לך עוד כמה תמונות שאתה יכול להשתמש בהם … C:\RnD\screenshots» (THE-1/2/3/6, cleared for the page).

## What exists (measured 2026-11-08)
- `/` = `Habait/platform/index.html` (stage_flow.py step 1 copies the platform folder to the site root). Today: a generic "projects" page — a short aerial still, «סיור בבניין, לפני שהוא קם.», one project card. `projects.json` lists ONE project (rainbow); no other project exists, so there is nothing to keep a list for.
- Exterior films, all AI (Kling v2v over the Blender clay orbit; the 1080 one is Topaz Starlight, board exterior-film A2): `hold/data/video/building-film-1080.mp4` (24.8 s = orbit 0–14.5 s → facade arc → dip to black 20.5 s → descent INTO the apartment, i.e. the old interior Eliran flagged), `fixtures/rainbow/orbit_real.mp4` and `_local/segments/rainbow-cine/orbit.mp4` (720p versions of the same orbit), `approach.mp4` / `intro-approach-interim.mp4` (fixture crossfades of clay stills). Contact sheets: scratchpad `frames/*.jpg`.
- Facts we may print (our data only): `project.json` name, tagline «מגדל מגורים על קו הים», developer «ישראל קנדה» (shown since OWED-024), the disclaimer; apartment 846: floor 16, the 360 tour of 11 spaces (`apartment.json tour.rooms`), sales plan DBLK Architects 15.10.2025; THE-1's printed place labels (נמל ת"א, פארק רידינג, מרינה, חוף הים, כוכב הצפון).
- **Not printed, on purpose:** price, unit counts (units.json is a fixture: "every price and every unit except 846's geometry is invented"), and 846's rooms/area — `units.json` says 4 rooms · 118 m² · 22 m² terrace, but the sales-plan meta (`data/sales-plans/israel-canada/rainbow-tel-aviv/unit-846/meta.json`) says 3 rooms · 106.72 m² · 26.15 m². The apartment page shows the units.json numbers → open question Q2.

## Reference: Rainbow-Boutique-1080p.mp4 (ideas only, not shipped, no footage cut)
27 s, 1920×1080. What we took: (1) the building is introduced by an aerial over the sea, then the name appears; (2) the wordmark is a classical Roman serif in wide-tracked caps with a small tracked sub-label under it — we set «RAINBOW» in our own display serif (Frank Ruhl Libre, house token) with 0.14 em tracking and «TEL AVIV» under it; (3) one short Hebrew line per beat, low on the frame, start side; (4) a small «הדמיה» mark sits in the same corner on every frame — our badge sits bottom-end on the hero and on every picture; (5) bright daylight, sea blue + warm sand + white — matches our film and the house warm stone. Not taken: its claims ("220 sold", "resort"), its people, birds, logo plate, or any frame.

## Direction (locked, navigator mode)
Editorial, quiet, daylight. Light warm-stone page (house tokens: `--brand-primary #005d83`, `--brand-accent #eea927`, Heebo + Frank Ruhl Libre), one dark band only in the hero and the closing CTA.
1. **Hero** — the film full-bleed, 100 svh (phone and desktop, min 560 px, max 980 px); the header floats over it (turns solid once the hero scrolls away). Bottom-start: eyebrow, the RAINBOW wordmark, one promise line, primary CTA «לסיור בפרויקט» (the same route as today: `projectHref()` = /hold/ with the orbit intro) + secondary «לדירה 846». Bottom-end: «הדמיה · AI-generated» + a 44 px pause/play (WCAG 2.2.2). Scrim only at the bottom (text) and a thin top band (header).
2. **Location** — THE-1 (render with its place labels) + the five place names as a list.
3. **Architecture** — THE-2 (dusk), THE-3 (street), THE-6 (roofs): a three-picture mosaic, no claims, captions describe the view only.
4. **The experience** — four cards, each a real route: fly around (/hold/ + film) · pick an apartment on the facade (/hold/ without the film) · walk into 846 (/tour/ living) · change finishes (/tour/ kitchen). Pictures = our own film frames and flat views of the current tour panoramas.
5. **Apartment 846** — a large living-room view + the facts above + links: apartment page, plan tab, 3D tab, 360 tour.
6. **Closing band** — the CTA again; footer: developer, the legal disclaimer (one line → full), the a11y slot (Eliran's), a quiet «פורטל יזמים» link to /studio/.

## Media (all $0, local ffmpeg, `Habait/platform/tools/make_landing_hero.py`, manifest `fixtures/rainbow/landing/manifest.json`)
- **Film chosen: `building-film-1080.mp4`, 0 → 14.4 s only** (the clockwise orbit: whole tower, sea, city; best source = 1080p Starlight). Cut before the facade arc, so no interior and none of the old apartment images. Loop seam: the last 0.8 s dip through black into its own first 0.8 s (a plain dissolve ghosted two orbit poses — the same lesson as exterior-film A), so `<video loop>` restarts on the identical frame. Encodes: `hero-1080.mp4` 7.2 MB (H.264 high, ~4.4 Mb/s, faststart, no audio), `hero-720.mp4` 3.3 MB (small landscape screens), `hero-portrait.mp4` 3.4 MB (portrait screens); poster = loop frame 0 (`hero-poster-1920/960.jpg`, the LCP image).
- Section stills: `facade.jpg` (film frame, card 02), `interior-entrance.jpg` (card 03), `finish-parquet.jpg` + `finish-marble.jpg` (card 04, the same floor view in two tour finishes shown side by side in HTML, no compositing), `interior-living.jpg` (apartment 846) — v360 flat views of the CURRENT gated tour panos, not the older `_local/dist` stills, whose panos differ from the tour's. Phone hero: `hero-portrait.mp4` (2:3 crop of the 1080 source around the tower, 3.4 MB) + `hero-poster-portrait.jpg`.
- THE-1/2/3/6: originals 1056×696 (nothing larger exists; never upscaled) → `renders/the-N-{1056,640}.{webp,jpg}`; scale + re-encode only, originals in `screenshots/` untouched.

## Decisions logged (navigator mode, for Eliran's audit)
- D1 The root becomes the Rainbow landing page; no "other projects" link (none exist). `landing.html` (the A/B lead page) stays reachable as before.
- D2 Video starts only after the poster is painted (`load`); portrait screens get the 2:3 crop, landscape ≤ 900 CSS px or DPR-width ≤ 1400 the 720p, poster-only on Save-Data; pauses off-screen; reduced motion = poster + play button, no autoplay.
- D3 No new facts: everything printed is from project.json, apartment.json, the sales-plan meta, or THE-1's labels.
- D4 Strings live in `js/home.js` (its own he/en table); `js/i18n.js` untouched (parallel forks).

## Open questions for Eliran (not blocking the build; raised by the coordinator at the deploy go)
- ~~Q1 Disclosure wording on THE-1/2/3/6.~~ **CLOSED 2026-11-08 — Eliran ruled «הדמיה»** (as built; EN shows «Render»). Our own AI media keeps «הדמיה · AI-generated».
- **Q2 846 facts mismatch** (fork A is fixing units.json to the sales plan; this landing touches no unit data). units.json (4 rooms, 118 m², 22 m²) ≠ the sales plan (3 rooms, 106.72 m², 26.15 m²); the apartment page prints the units.json numbers. Sales-plan fidelity says the plan wins; the fix is outside this landing (the landing prints neither).
- **Q3 The reference film.** Not used. If Eliran wants a clip of it on the page, that is a licensing call (third-party material).

## Done when
Headless Chrome at 1440 and 390 (poster first paint, video playing, sections, EN): video `currentTime` advances, 0 page errors, no horizontal overflow, a badge on every property picture, every CTA resolves; responsive gate PASS; predeploy PASS on a local stage; merged into main; NOT deployed (the coordinator asks Eliran).

## Round 2 — Eliran's review (2026-11-08, before the deploy)
His words: «בדף הנחיתה עצמו אני לא רוצה הפנייה רק לדירה 846 אלא סרטון כללי על הפרויקט ואז יש מעבר לסיור בפרויקט ואז מתחיל כל הסרטון ריחוף של הבניין ועצירה ומראה של כל הדירות וכל מה שאנחנו מכירים» · «אני לא רוצה שרק דירה 846 תהיה האופציה היחידה, אני רוצה אחרי הריחוף שכל הדירות יראו לי ואוכל לבחור כמו שהיה עד עכשיו».
- **Done:** the page is about the whole project. Removed: the «לדירה 846» hero button, the «דירה 846» nav item, the apartment-846 section and every 846 string (the check asserts 0 × «846» in `<main>`). Nav = «המיקום» · «החוויה». The four experience cards now describe the steps of the ONE flow in order (fly around → stop at the facade with every apartment marked → step inside → change the design). They are not links. The page has one action, «לסיור בפרויקט» (hero + closing band), and both go to the same route.
- **The route is unchanged:** `projectHref()` = `/hold/?…&orbit=<orbit_real.mp4>`, the same as the old home page (1a54ce0). It was proven equal to the production home page's CTA, origins stripped. Flow proof (`test/rainbow-flow.check.mjs`, 1440 + 390):
  - landing → CTA → the fly-around film plays (`orbit_real.mp4`) → it hands over to the hold and stops in front of the tower;
  - all 12 units of units.json have a marker; 9 pills are visible at 1440 and 8 at 390, and the rest sit behind the front units, as before;
  - pick 845 → its card; pick 846 → «המשיכו אל הדירה» → descent → the apartment tour is in front.
- The flow itself (`/hold/`, `js/picker.js`, the tour) was not touched. Only 846 can be entered today (`canEnter` in the hold). That is the existing behaviour, not a landing change.
- Observed in round 2: at 390 the hold's legend and «דירות» chip sat over its title (fixed in round 3).

## Round 3 — the hold's phone chrome (coordinator, 2026-11-08, $0)
The hold is now the first screen after «לסיור בפרויקט». At 360/390/430 its top chrome piled up: the picker row was pinned at 64 px, on the title at 72 px.
- **Fix** (`research/fal-bench-2026-11-02/flyover3d/index.html` CSS + `app.js` `placeDragHint()`; flow and data untouched). On a portrait phone everything sits in one column, in flow, under the two top buttons, so nothing can overlap whatever its height: title → legend → «דירות» → the legal line, on a glass panel because it is the AI disclosure and must read over the sky. The hint «לחצו על דירה» is dropped on phones because the title already says «בחרו דירה». The drag hint goes 14 px under the column and still leaves on the first drag or after 9 s. On wider screens the drag hint now goes under the title; at 1440 it used to cover pills 836/826. The rest of desktop is unchanged.
- **Proof:** `test/hold-chrome.check.mjs` checks the bounding boxes of the top elements pairwise, against the viewport and against the visible pills. On live main before the fix it FAILS (6 overlaps on phones, the drag hint on 2 pills at 1440); after the fix it PASSES at 360/390/430/1440. The flow check, the responsive gate and predeploy were re-run.

## Round 4 — prices hidden, no portal link on the landing (Eliran, 2026-11-08, $0)
Eliran: «כן, להסתיר» (the units.json prices are fixtures) and «פורטל יזמים … לא צריך להיות בדף נחיתה».
- **One switch:** `fixtures/rainbow/project.json` `"prices_public": false`. Every price render reads it, and anything but `true` means no price:
  - `js/picker.js` (the unit card and the «דירות» list on /hold/ and flow.html; the «מחיר לפי פנייה» line also goes);
  - `js/apartment.js` (`#aptPrice` hidden, and no price row in «אודות»);
  - `js/landing.js` (no price row in the facts).
  - `tools/build_zip.mjs` copies the flag into `apartment.json`. The dist was not rebuilt: an `apartment.json` without the flag means no price, so the live 846 dist already renders none. Turning prices on later = `true` in project.json plus a build_zip rebuild of the dist.
  - The fixture price values stay in units.json and apartment.json.
- **No layout gap:** the card's price line is not rendered at all. The facts row follows the head with the sheet's own 12 px gap, so there is no orphan «₪».
- **The /hold/ list:** while the unit card or the «דירות» list is open, the picker stage rises above the top buttons and the drag hint (`#pickerStage:has(open panel) { z-index: 8 }`); they used to float over the list and its title.
- **Landing footer:** the «פורטל יזמים» link is gone in HE and EN; /studio/ stays live at its own address. The footer reads Habait mark · «יזם: ישראל קנדה» · the legal line.
- **The «fixture» chip** next to «למכירה» on the apartment page and **the landing's a11y TODO** are dev-only (DEV = localhost or ?dev=1). Confirmed hidden on prod dpl_6JZXxQ2B (`no-price/prod-dev-only.json`).
- **Not touched:** the tour's furniture-catalog prices («מחיר נכון ל-…», IKEA items) are catalog prices, not unit prices, and they belong to the tour viewer (fork A's files). flow.html's HUD targets are under 44 px; that is pre-existing on main and flow.html is not a Rainbow buyer route.

## Round 5 — the /hold/ legal line at the bottom edge (Eliran on his iPhone, 2026-11-08, $0)
Eliran: «במובייל מופיע באמצע המסך ההודעה של "הדמיה להמחשה בלבד" … זה לא אמור להופיע באמצע המסך ולהסתיר את הבניין, זה אמור להיות רק למטה ובקטן».
- **Legal line, all widths:** fixed to the bottom edge, 12 px white straight on the image, a multi-layer text-shadow, a soft bottom fade, no panel. It sits above the iOS toolbar (`env(safe-area-inset-bottom)` as a transparent bottom border, so a third line never peeks into it).
  - The wording is untouched: it is the `project.json` disclaimer, as before.
  - It is clamped to 2 lines; the two visible lines always carry «הדמיה להמחשה בלבד. הופקה בסיוע בינה מלאכותית…» (asserted).
  - When the full text does not fit, a «פרטים» cue shows; a tap (or Enter/Space) opens it whole and «סגירה» closes it (`app.js`). At 1440 it fits on one line, so there is no cue.
- **Phones, portrait:** the top is compact — the title, then the legend and «דירות» side by side in one row. The drag hint sits under them.
- **Phones, landscape:** the legend / «דירות» row and the legal line (a strip of `min(44vw, 380px)`) go to the inline-start side, over the city, because the tower and its pills reach the bottom edge. The hint «לחצו על דירה» is dropped.
- **Desktop:** the same bottom treatment; the legend / «דירות» row stands just above it (`--picker-bottom: 70px`). Nothing else moved.
- **Proof** (`test/hold-chrome.check.mjs`, extended): it measures the legal TEXT box, not its fade, against every visible pill and the top items, at 360/390/430 portrait, 390 landscape (844×390) and 1440. It also checks that the line sits in the bottom quarter, takes at most 3 lines, keeps the AI words on a visible line, and that «פרטים» opens and closes it.
  - **Contrast**, white text against its backdrop at the worst glyph pixel, measured from frames with the text made transparent:
    - **with the shadow:** 360 10.87:1 · 390 8.90:1 · 430 11.19:1 · 390-landscape 7.01:1 · 1440 10.44:1;
    - **with the fade alone (no shadow):** 1.86–3.40:1. The shadow is what carries the legibility.

## Round 6 — /hold/ phones: a right-edge column (Eliran, 2026-11-09, $0)
Eliran: «יש כמה דברים שאפשר להוריד: את המשפט "מול החזית בחרו דירה", "הדמיית הבניין והסביבה". את הסרגל של "למכירה, שמורה, נמכרה" אני מעדיף שיהיה לאורך בצד ימין בקטן. את הכפתור דירות גם שיהיה בצד ימין».
- **Phones** (touch, ≤ 900 px wide or ≤ 500 px tall; portrait and landscape): the stop shows the tower, its pills, one compact column on the physical right edge and the legal line at the bottom.
  - The column runs: the sound button (unchanged) → «הדמיית הבניין והסביבה» as a 44 px building icon → «דירות» (44 px) → the legend as a small vertical stack (12 px, dots).
  - The title «מול החזית · בחרו דירה» and the hint «לחצו על דירה» are gone. The drag hint sits in the top-left corner and still leaves on the first drag.
- **«הדמיית הבניין והסביבה» is a function, not a label:** it opens the building film (board exterior-film: the realistic 1080p film of the tower and its surroundings, with «כניסה לדירה» at the end, ✕ back to the hold). It stays the same button with the same function and the same accessible name (its text); on phones it is drawn as an icon in the right column. The check taps it and asserts the film opens and ✕ closes it.
- **Desktop (mouse):** unchanged. The check asserts that the title and the labelled pill are still there at 1440.
- **Proof:** `test/hold-chrome.check.mjs` passes at 360/390/430 portrait, 390 landscape and 1440. On phones it asserts no title or hint, the building icon at ≥ 44 px on the right, «דירות» ≥ 44 px at the right edge, a vertical legend at the right edge, and nothing covering a pill, including the legal line.

## Round 6b — the /hold/ intro at 2x (Eliran, 2026-11-09, $0)
Eliran: «אני רוצה שהסרטון אחרי העמוד נחיתה יהיה יותר מהיר, הסיבוב סביב הבניין, כי כרגע זה מאוד איטי … גם במובייל וגם בדסקטופ».
- **The clip:** `fixtures/rainbow/orbit_fast.mp4` = `orbit_real.mp4` at 2x. It is re-encoded, not `playbackRate`: every one of the 409 frames is kept, timestamps are halved, 24 → 48 fps, so nothing is dropped or blended. It runs 8.54 s and is 6.7 MB, down from 40 MB.
  - The last frame is still the hold's stop pose (SSIM 0.977 against the original's last frame), so the hand-off is unchanged.
  - `project.json` `exterior.intro.clip` points at the new file. `orbit_real.mp4` stays.
  - It has a manifest row with the input hash and `speed_factor: 2`, at $0.
  - /hold/ uses a single intro file, with no portrait or 1080 variants.
- **The title overlay** «Rainbow תל אביב» scales with the clip: in at 6 % of its length, out at 45 %. «דלג» is unchanged.
- **Click → picker interactive** (`test/hold-timing.check.mjs`, 2 runs each): before 17.4 s at both 390 and 1440 (17577/17418 and 17403/17395 ms); after 8.8 s (8942/8766 and 8747/8759 ms).

## Round 7 — the landing as a scroll story (Eliran, 2026-11-09, $0)
Eliran: «תתקין סקילים מתאימים של UI UX כדי לעצב את העמוד נחיתה בהתאם, שלא יראה כמו דף נחיתה פשוט של AI אלא משהו מרשים, גם למובייל וגם לדסקטופ».
**Skills read:** `build-awwwards-quality-sites` (direction first, one smooth-scroll engine, a static first frame, reduced motion = final state, no fake proof), `cinematic-scroll-storytelling` (motion tokens: power4.out entrances, word stagger 0.045 s, scrub for scenes, sticky stack, parallax, a scrubbed CTA hand-off; demo read), `refero-design` (anti-slop: no cards by default, light mode, no one-word serif swap; the Refero MCP is not connected here, so the bundled craft refs were used), `landing-page-design` (one CTA, mobile first). Its image generation was NOT used. **References:** Eliran's own sources only — the developer's launch film (Rainbow-Boutique-1080p.mp4, ideas only: a Roman wordmark over the aerial, one line per beat, daylight sea palette) and his four renders, plus the film.
**Direction (locked):** an image-led daylight launch site told as numbered chapters — the film, one big sentence, then 01 Location · 02 Architecture · 03 Experience, closing on the film's frame opening into the CTA. Light warm stone with dark only inside the media, Frank Ruhl Libre display for Hebrew headlines (house token, full Hebrew glyphs; justified by the developer's Roman wordmark), Heebo for UI. No cards: hairline-ruled lists, full-bleed and split-screen media.
- **Motion** (`js/landing-motion.js`; GSAP 3.12.5 + ScrollTrigger + Lenis 1.3.4, self-hosted in `js/vendor/` with `VENDOR.json`: npm integrity, sha256, licences; 50.5 KB gz together):
  - the hero film drifts and the title lifts away;
  - the statement darkens word by word as it is read (scrubbed);
  - headings rise word by word out of masks, once;
  - Location: a pinned split screen with a slow push-in on THE-1, the five place names light up in order;
  - Architecture: a pinned gallery travelling sideways (RTL: the next picture enters from the left), the renders drifting inside their frames;
  - Experience: a sticky frame whose picture follows the step in view;
  - the closing band: the film frame opens from an inset window to full bleed (scrubbed), the CTA rises in.
- **Phones:** designed separately. Native scroll, no Lenis, no pins: full-bleed media, chapters stacked, clip reveals on the pictures, the same scrubbed closing band. Targets ≥ 44 px, no sideways scroll.
- **Reduced motion / no JS:** the static editorial layout, every word visible (asserted).
- **Unchanged truths:** the hero film, the one CTA «לסיור בפרויקט» into the unchanged /hold/ flow, only real facts (no 846, no prices), the badges (AI media «הדמיה · AI-generated», his renders «הדמיה»), and the house tokens. The poster or hero text stays the LCP (164–188 ms), CLS 0.

## Round 8 — luxury palette: research + three directions (Eliran, 2026-11-09, $0) — Eliran picked B
Eliran on r7 (live dpl_389BQQbQ): «העמוד נחיתה עדיין נראה מאוד מיושן ומשעמם. אני רוצה שתשתמש בצבעים יותר יוקרתיים ותחפש טמפלייטים וסגנונות עיצוב UI UX באינטרנט ותשפר את הנראות». For the landing only, the warm-stone/amber house tokens are overridden.

### Research (WebSearch + WebFetch, 2026-11-09) — patterns only, no brand, logo or copy taken
Several official sites refused automated fetches: sixsenses.com and fourseasons.com returned 403. For Bulgari and Central Park Tower the searches found no description of the site design. Those rows are marked "pattern only" and are based on the brands' publicly known look, not a fetched page.

| # | Site (URL) | Palette · type | Hero / framing · navigation | Rhythm · motion · CTA | What we take |
|---|---|---|---|---|---|
| 1 | ERA, Vide Infra; Awwwards/FWA/CSSDA SOTD — videinfra.com/work/era, videinfra.com/blog/era-premium-real-estate-website-case-study | deep velvety evening blue + rose-gold and gold accents "used sparingly"; Art-Deco geometry, restrained display type | night-sky splash with the building silhouette forming; a light-line motif runs through the nav | short sections each with its own visual device; one 8,000 px render scrolled as a camera; hover glow; CTA «Get in touch» modal | dark base + ONE warm metallic used sparingly; one scroll-driven "camera" moment |
| 2 | Silver Pinewood Residences — awwwards.com/sites/silver-pinewood-residences (SOTD + Developer) | listed colours #282828 + #998170 (graphite + bronze-taupe); pastel accents | "True luxury is quiet"; video ×3, layered compositions | even scroll rhythm, timed reveals, WebGL object | graphite + bronze is a proven luxury pair; quiet, even pacing |
| 3 | The Aerie, kombai inspiration — kombai.com/gallery/inspirations/aerie | bone #F6F3EC, ink #23262B, slate #4A4E55, ONE brass accent #9C7C4A; Fraunces Light display, Hanken Grotesk 300 body, mono 11 px tracked labels | full-screen photo under a 40 % scrim, centred two-line serif headline; fixed transparent header with a 1 px hairline | full-viewport sharp-edged frames with "03 — THE EDGE" captions; scale 1.06 → 1 reveals; Lenis; spec rows on hairlines; CTA = brass «PRIVATE VIEWING» → slide-in drawer; no shadows, radii or cards | the light-luxe system for direction C: hairlines, tracked labels, full-viewport frames, one brass accent |
| 4 | Aman Residences — aman.com/residences | (fetched as text; known look: ivory/black, serif display, extreme restraint) | wide feature banner, "Menu" toggle + «Enquire» link in the header | intro → destination filter → alternating image/text cards → enquiry form; CTA «Make an enquiry» anchors to the form | an always-present quiet CTA in the header; generous whitespace; few words |
| 5 | Belgrade Arbor; Awwwards SOTD + Developer, 17 Oct 2026 — belgradearbor.rs/en | (not in source) nature-led imagery | full-bleed hero, caps eyebrow; header «Inquire» + language toggle; scroll-progress "0 %" | intro statements → location with five places and travel times → residences → horizontal "view from above" strip → numbered 01/02/03 steps | a numbered chapter rhythm, a horizontal image strip, a persistent header CTA |
| 6 | STILL / FORM — stillform.homes | warm neutrals, deep-red accents; sentence-case display set in short stacked lines | full-bleed hero, two CTAs below; "Scroll to enter" | statements, image grids and numbered split blocks; marquee wordmark band; «Step inside» → a 3D tour | short stacked display lines; a final "step inside" CTA into the experience (our /hold/) |
| 7 | Springs; Vide Infra, Awwwards SOTD — videinfra.com/blog/meditation-in-luxury-real-estate-website-design | (not described) | full-screen render in greenery | slow, unhurried motion; planes dissolve into each other | slow motion = luxury; nothing bouncy |
| 8 | Halden Homes (Framer) and Yosef Realty (SuperDesign) — framer.com/marketplace/templates/halden-homes, app.superdesign.dev/library/yosef-realty-luxury-residences | dark, image-led; serif editorial type; magazine-style asymmetric grids | large photography, bold type | residence archive, enquiry form | dark editorial is a recognised luxury-residences template family |
| 9 | Bulgari Residences (pattern only; site not fetched) — bulgarihotels.com/…/residences | black + bronze/gold, Roman caps | — | — | Roman wordmark with wide tracking over dark (our RAINBOW wordmark already matches) |
| 10 | Central Park Tower / 111 W 57th (pattern only) — centralparktower.com, 111w57.com | Manhattan supertalls: graphite/ink with bronze or terracotta (the 111 W57 facade is terracotta + bronze) | — | — | bronze/terracotta metallic on ink for a tower |
| 11 | Tel Aviv luxury towers (m-y-s.com Akirov Towers, Masterpiece Bavli, Meier on Rothschild) — m-y-s.com/Akirov-Towers | mostly conventional architect / developer pages | galleries + facts + «Contact us» | — | the local bar is low; a cinematic launch page stands out |

**Patterns that recur across 1–8:** a dark or bone base with ONE metallic accent (gold, brass or bronze); serif or Roman display with wide-tracked caps; thin hairlines instead of cards or shadows; full-bleed or framed-window imagery with numbered captions; slow reveals (1.0–1.2 s, scale 1.06 → 1); a persistent quiet CTA plus a final "step inside" CTA.

### Three directions (static hero + one section; real HTML with our film frame and Eliran's renders; real facts only)
Contact sheet: `Projects/Habait/habait-walkaround/qa-evidence/platform/rainbow-landing-2026-11-08/r8-directions/contact-sheet.png`. The mocks are `mock-a/b/c.html`, with one screenshot each at 1440 and 390.
- **A · Onyx & Champagne.** Onyx #0D0D0E, ivory #F2ECE2, champagne #CDB083 as the only accent. A thin champagne hairline frames the full-bleed film; the RAINBOW Roman wordmark is centred and huge; gold pill CTA; split chapters with gold numerals. Contrast: ivory/onyx 16.5, champagne/onyx 9.4, onyx on champagne CTA 9.4, muted ivory 7.9.
- **B · Midnight Sea & Bronze.** Midnight #0A1A28 / deep sea #10283B, sand #EDE3D3, bronze #C08E5C. The film sits in a framed window beside a very large, very light Heebo 200 headline (architectural, modern); square sand CTA; the dusk render carries the palette. Contrast: sand/midnight 13.9, bronze/midnight 6.1.
- **C · Ivory Gallery & Brass.** Bone #F4EFE7, ink #17181A, brass #8E6B38 on lines and numerals only. Full-bleed film under a soft scrim with a centred serif headline; square bone CTA; whitespace statements and full-viewport frames with tracked captions. Contrast: ink/bone 15.5; brass/bone 4.26, so brass is only for large type and lines, never body text.
- In all three the badges stay the existing dark chip («הדמיה · AI-generated» / «הדמיה»), legible over every palette.

**Recommendation: A · Onyx & Champagne.** It answers «צבעים יותר יוקרתיים» most directly: dark plus one champagne metallic is the strongest recurring luxury-residence pattern (ERA, Silver Pinewood, Bulgari, Halden). It keeps the film full-bleed as the hero, and every text pair passes AA by a wide margin. C risks reading as "plain" again, and B shrinks the film.
**Next:** after Eliran's pick, build the full page in that direction on the r7 motion system (the same chapters, the same facts and CTA), then run all checks. No build before the pick.

### Round 8 build — direction B · Midnight Sea & Bronze (Eliran's pick) + new copy + text motion (trimmed scope, 2026-11-09)
- **Palette and type:**
  - the landing overrides the surface tokens (`body.rl-b`): midnight #0A1A28, deep sea #10283B, sand #EDE3D3 (13.9:1), bronze #C08E5C (6.1:1, accents and large type only);
  - Heebo 200/300 display at very large sizes; Frank Ruhl Libre only for the RAINBOW wordmark caption in the film window;
  - square sand CTA with a bronze underline that sweeps in on hover and focus;
  - the badges are the unchanged dark chip.
- **Hero:**
  - desktop: the film in a framed window (7fr) beside the headline (5fr);
  - phones: the film goes full-width under the header (64 svh), the text follows on midnight;
  - the corner (badge + pause) sits inside the film window;
  - the closing band uses Eliran's dusk render THE-2 (badge «הדמיה»).
- **Copy (antislop + copywriting):** specific places from THE-1, no triplets, no «לא רק X אלא Y», no invented facts. Every render-dependent line says «בהדמיה». Before → after:
  - hero: «RAINBOW / מגדל מגורים על קו הים בתל אביב. סיירו בו לפני שהוא קם.» → «גבוה מעל הים. / עוד לפני שהוא קם.» + «טסים סביב המגדל, ומשם ישר אל תוך הדירה. הכול בהדמיה.»
  - statement: «מגדל מגורים על קו הים של תל אביב. סיור בבניין, לפני שהוא קם.» → «בין נמל תל אביב למרינה, מול הים הפתוח. את המגדל הזה כבר אפשר לראות מבפנים, בהדמיה.»
  - 01: «על קו הים של תל אביב» → «בין הנמל למרינה»
  - 02: «המגדל והבניינים שלצידו» → «מרפסות כמו גלים»
  - 03: «מהשמיים, אל הסלון» → «מהשמיים, ישר לסלון»
  - closing: «הטיסה מתחילה בלחיצה.» → «הטיסה מתחילה כאן.»
  - CTA «לסיור בפרויקט»: unchanged. The EN mode carries the same lines.
- **Text motion:**
  - GSAP 3.13.0 (all plugins free) replaces 3.12.5; the old files moved to `tools/_unused/`.
  - SplitText by LINES, never characters (Hebrew stays whole), masked from below with a CustomEase «rl-rise» and short staggers; `aria: "auto"` puts the sentence on the parent; `autoSplit` + `onSplit` rebuild after fonts load.
  - Applied on the hero headline (on load), every chapter title and lead (once), the statement (scrubbed line by line on desktop, once on phones) and the closing title.
  - Phones: no scrub. Reduced motion / no JS: nothing split, all text visible.
  - VENDOR.json is updated. JS total: 57.6 KB gz.
- **Deferred (Eliran wants it sooner):** /hold/ chrome in B colours, the numeral scramble (ScrambleText is vendored but not loaded) and extra gallery motion.

## The Habait brand (Eliran, 2026-11-09: «HABAIT … הבית זאת בעצם החברה שבנתה את זה והמיתוג יהיה»)
- **Source:** Eliran's original vector `Habait/platform/brand/habait-logo.svg`: the HABAIT thin-line wordmark, the roof line and the Hebrew tagline «הבית של כל הבתים», with all fills #051F6E (the official navy). The first raster-based reconstruction was dropped when the vector arrived; its files were relocated, not committed.
- **Derived files** (`tools/make_brand.py`, $0; geometry unchanged):
  - the empty `Line_130` is dropped;
  - the offsets are normalised to the float32 values the renderer computes, so the optimised file renders pixel-identical to the original at 1×, 4× and 10× (`test/brand-diff.check.mjs`; at 10× Chrome itself is ±1 noisy on about 240 bytes);
  - colour swaps: navy, white and sand;
  - a wordmark-only variant (no `Path_87–99` or `Rectangle_426/428`);
  - `-small` variants with a same-colour 0.9 hairline stroke so the 24–36 px headers keep ≥ 1 px lines;
  - a favicon mark (the H + roof, white on navy) and a 180 px touch icon.
- **Placements:**
  - the landing header: sand wordmark, 30 px desktop / 26 px phone;
  - the landing footer: the full logo with «הבית של כל הבתים» at 120 px in Hebrew; the wordmark in EN, since there is no vector «HOME IS HABAIT»;
  - the apartment page header: the navy wordmark, then the project name;
  - the /studio/ header: the navy wordmark plus «Studio»;
  - the tour place card: the wordmark inlined in `viewer/template.html` (currentColor, 24 px). It is carried into the built `dist/apt846` by `tour360/tools/apply-brand-to-dist.py` (exactly one old element replaced, backup outside the staged folder), with no full rebuild;
  - the favicon and apple-touch-icon on the landing, landing.html, the apartment page and /studio/.
- /hold/ shows no Habait mark, so nothing changed there. Navy #051F6E is used only on light grounds; on the landing's midnight #0A1A28 the logo is sand.

## Round 9 — the rainbowtlv.com feel (Eliran, 2026-11-09: «העמוד נחיתה נראה עדיין מאוד מיושן. אני רוצה משהו בסגנון הזה https://rainbowtlv.com/», $0)
- **Teardown, read-only:** one session on the home page only (no crawling), headless Chrome. Skills used: `design-system` (browser + HTML path, no Stitch) → `qa-evidence/platform/rainbow-landing-2026-11-08/r9-reference/DESIGN.md`, and `reanimate` (capture → analysis → verify).
  - Evidence: scroll sequences at 1440 and 390 with mid-animation frames (`r9-reference/shots/`, sheets `sheet-ref-*.png`), `probe.json` (tokens, script and font requests, sections, button hover), reanimate captures `r9-reference/reanimate/ref-*`.
  - reanimate ran under Node 24 (type stripping) instead of bun: bun 1.2.21's Playwright pipe launch hangs on Windows. `ffmpeg-static` ships `ffmpeg.exe`, so a hard link `ffmpeg` was added in the skill's ignored `node_modules`.
  - Their stack: jQuery 3.6.3, AOS, nicescroll, jquery.parallax. Fonts: Optima Roman + Rag Sans (both commercial). Palette: white, black, and seven flat accents (DESIGN.md §2).
- **Teardown table** (pattern · how they do it · how we do it):

| # | Pattern | Theirs | Ours |
|---|---|---|---|
| 1 | First and last screen = a field of flat colour blocks with one white card | a picture of blocks; the card holds the wordmark | CSS blocks in our own arrangement of their seven colours; the card holds our film (poster = LCP) and the words + CTA; the closing card holds the CTA |
| 2 | Gallery page | white canvas, black ink, colour only at the edges | the same (`body.rl9` tokens) |
| 3 | Type | Optima caps titles, Rag Sans body | Bellefair (display) + Assistant (text), OFL, full Hebrew, self-hosted (`fonts/SOURCES.md`) |
| 4 | Chapter rows | one 844×556 picture bleeding to its page edge, a 465 px centred text column, sides alternate, 160 px apart | the same geometry: location, architecture, the four experience stops |
| 5 | Picture wipe | `.image-in-out`: window +110 % and scale 1.3→1, inner −131 %, linear 0.9 s | GSAP: the same numbers (`landing-motion.js` `WIPE`) |
| 6 | Text reveal | AOS fade-up / fade-left / fade-right: 100 px, CSS `ease`, ≈ 1 s, once, 120 px offset | GSAP with CustomEase `0.25,0.1,0.25,1`, the same numbers; phones fade up |
| 7 | Order in a row | the text follows the picture ≈ 0.42 s later | triggered 210 px later on the same row (measured +0.38 s) |
| 8 | Bands between sections | full-bleed picture, slower than the page (jquery.parallax) | renders THE-2 and THE-6, GSAP scrub ±7 % |
| 9 | Button | black, 2 px radius, 6×41 px padding; hover → grey 0.3 s ease-in-out | black, 2 px radius, ≥ 46 px tall; hover → their accent blue `#1B36FF`, 0.3 s ease-in-out (grey reads as disabled) |
| 10 | Sticky bottom bar | pink, a rainbow stripe on top, a lead form | pink + stripe, «RAINBOW TEL AVIV» and the one CTA; shown between the hero and the closing screen |
| – | Header | hidden on the first screen, fades in | always visible (it holds the language switch); white, hairline once scrolled |
| – | Smooth scroll | nicescroll | Lenis 1.3.4 on desktop (as before) |
| – | Not taken | their logo, text, pictures, film, lead form, UserWay, English-only titles | — |

- **Build** (`Habait/platform/index.html`, `css/rainbow-landing.css`, `js/landing-motion.js`, `js/home.js`). The round-8 files are relocated to `tools/_unused/*-r8.*`.
  - SplitText is no longer loaded: the reference has no split text. The file stays vendored.
  - Unchanged: real facts only, every badge (`הדמיה · AI-generated` on our film and pictures, `הדמיה` / `Render` on the four renders), the single CTA «לסיור בפרויקט» into the unchanged /hold/ flow, reduced motion = the static page, poster LCP, CLS 0, no horizontal scroll.
- **Who made what** (Eliran, 2026-11-09: «הלוגו הוא של החברה שיצרה את העמוד נחיתה ואת כל הסרטון וההדמיה, אבל יחד עם זאת צריך שיישאר השם של יזם הפרויקט, במקרה הזה ישראל קנדה»).
  - The developer's name comes from project.json `developer` as plain text, never their logo. It appears:
    - on the landing: «יזם: ישראל קנדה» under RAINBOW in the hero card, and in the footer;
    - in the apartment page header, under the project name (also on phones);
    - in /hold/'s clip title, as a third line.
  - Habait = the maker's mark:
    - the header logo;
    - the footer credit «הדמיה ואתר:» + logo (EN "Visualization & site by");
    - the tour place card: «הדמיה ואתר:» + wordmark, desktop only, since the card's brand is hidden on phones. It is carried into the built dist by the generalised `tour360/tools/apply-brand-to-dist.py`.
  - The tour data carries no developer field, so the tour card shows none. Nothing is hard-coded.
- **Measured fidelity** (reanimate, `track.json` per element; `r9-reference/reanimate/clone-*`, `compare-*/sheets`):

| Motion | Reference | Ours |
|---|---|---|
| hero words rise, 1440 | onset 0.81 s, 100 px→0 + opacity, `ease` fit 975 ms (RMSE 0.010) | onset 0.92 s (capture-start jitter between runs ≈ ±0.15 s), `ease` fit 979 ms (RMSE 0.005), same travel |
| hero words rise, 390 | onset 0.89 s, 834 ms | onset 0.89 s, 834 ms |
| picture wipe, 1440 | linear 864 ms, window 110 % + scale 1.3→1, inner 131 %, starts with the picture 12 px into view | linear 867 ms, 110 % + 1.3→1, inner 131 %, starts 31 px into view |
| text after the picture, 1440 | +0.42 s, −100 px, `ease` ≈ 950 ms | +0.38 s, −100 px, `ease` ≈ 940 ms |
| picture wipe, 390 | linear 867 ms, 429 px, 1.3→1 | linear 868 ms, 429 px, 1.3→1 |
| intro fade-up, 1440 | onset 0.90 s, 835 ms | onset 0.90 s, 833 ms |

  - The `compare.ts` pixel numbers (46–72 % mismatch) measure different content by design: our film, copy and pictures. Its activity window on the hero is dominated by our playing film, so it is not a motion metric here; the per-element tracks are.

## Round 10 — the project landing, improved in our own identity (Eliran, 2026-11-09, $0)
- **Round 9 rejected:** «הגזמת לגמרי העתקת ממש את העיצוב ואת הUI … כיוונתי רק לקחת רעיונות מההנפשות ואיך הדברים מוצגים». The page will be shown to Israel Canada, so it must not recall rainbowtlv.com, and it must not recall any other reference either.
  - The round-9 files are relocated to `Habait/platform/tools/_unused/` (`*-r9.*`, `fonts-r9/`).
  - Prod was rolled back to dpl_HoCGVoUP (round 8 + brand).
- **Final scope** (Eliran: «אני רוצה שהדף נחיתה יהיה כללי ואז סיור לפרויקט … מגרסת v2 אפשר לקחת את הצילום מסך בלי טקסט שמשייך לדירה ספציפית … את כל הנראות של habait-flow צריך לשפר גם ברמת המלל וגם ברמת הנראות. תמשיך לחפש באינטרנט דברים דומים ולקבל השראה»).
  - Target: the habait-flow root (`index.html`, `css/rainbow-landing.css`, `js/home.js`, `js/landing-motion.js`), built from the round-8 files of 37bbdd5.
  - Two drafts from this round's earlier briefs are relocated, not shipped: a separate "Landing B" for the test link (`tools/_unused/landing-b-draft/`), and round 8 + roles (`*-r8-roles.*`).
- **Hero:** from v2 (`Habait/platform/v2/`, untouched): the full-bleed tower film, the large serif «Rainbow» + «תל אביב», the developer line, the pause button and the badge.
  - Every apartment line is gone: no 846, no floor 16.
  - The cue reads «המגדל והסביבה».
  - The single CTA «לסיור בפרויקט» → /hold/ (fly-around, bird's eye, the apartment picker), unchanged.
- **Copy** (copywriting + antislop-copywriting; real facts only: project.json `name`, `tagline`, `developer`, the place names printed on THE-1, the flow's four stops; no prices, no amenities):
  - hero «טסים סביב המגדל, בוחרים דירה מתוך הבניין ונכנסים אליה. הכול בהדמיה.»;
  - statement «בין נמל תל אביב למרינה, מול הים הפתוח. המגדל עוד לא קם, וכבר אפשר לטוס סביבו ולהיכנס פנימה.»;
  - a project sheet (יזם · מיקום · הפרויקט · הדמיה ואתר);
  - location lead «מה שמסביב למגדל, כפי שמסומן בהדמיה.»;
  - the rest as in round 8. EN mirrors it.
- **Roles kept:** «יזם: ישראל קנדה» from project.json as plain text (hero, project sheet, footer); «הדמיה ואתר: Habait» (project sheet, footer); badges on every picture.
- **Look:** our direction B (midnight #0A1A28, deep sea #10283B, sand, bronze #C08E5C; Heebo + Frank Ruhl Libre). Its Latin «Rainbow» is the big serif.
- **Inspiration — the ideas taken and from where** (screenshots `qa-evidence/platform/rainbow-landing-2026-11-08/r10-references/` + `r10-mpbavli/`; each read once, read-only):

| Idea, as re-made here | Seen on |
|---|---|
| The full-bleed film with a very large name over its lower start, a short line and a quiet scroll cue | v2 (ours), 53w53.com, centralparktower.com |
| A project sheet of plain facts in hairline cells (developer, location, the project, who made the page) | Rom Tower page (alumeshet.co.il), Arlozorov Tower (ashtromconstruction.co.il) — their fact rows |
| The places as a numbered legend under one wide picture | mpbavli.co.il (a labelled location picture) |
| A picture stage: one picture in front, the neighbours waiting smaller at the sides, moved by the scroll (desktop) or a swipe (phones) | mpbavli.co.il (a wheel-driven carousel with peeking slides) |
| The four stops as a row of drawn marks, then an offset collage with a corner chip on each picture | mpbavli.co.il (an amenity icon row; image tiles with corner labels) |
| Pictures that open like a curtain while settling from a slight zoom, their words following | round 9's motion lesson, re-timed: our curve `lb-glide`, 1.4 s, words +0.18 s |

  - **Not taken from any of them:** palette, fonts, grid, section order, copy, buttons, media. 432parkavenue.com was tried and timed out.
- **Motion** (`js/landing-motion.js`, GSAP 3.13 + ScrollTrigger + CustomEase, Lenis on desktop):
  - the film settles from 1.07, and the name, line and CTA rise after it;
  - words rise once;
  - pictures open with a clip-path curtain plus a 1.08 → 1 settle; chips and lines follow;
  - one desktop pin: the picture stage. Phones swipe natively.
  - Reduced motion or no JS = the static page.
- **Proof:**
  - `qa-evidence/.../r10/`: `sbs-live-vs-r10-1440.png`, `sbs-live-vs-r10-390.png` (live now vs round 10); `check/` and `motion/` PASS on the worktree stage;
  - `r10-references/sheet-references-*.png`;
  - gates on a fresh stage of main after the merge: `r10-main/`.
- **Not deployed.** The coordinator publishes it to the test link first, then to prod on Eliran's word.
