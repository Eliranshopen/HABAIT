# A — live walk of https://habait-flow.vercel.app (2026-11-04)

Read-only walk of production as a buyer and as a developer. Headless Chrome 1440×900 (desktop) and 390×844 (phone, touch, iPhone UA), SwiftShader GL, `he-IL`. The shots are in `shots/` as `<NN>-<screen>-<desktop|phone>.png`. The scripts and per-page logs (console errors and failed requests) are in the session scratchpad `…/scratchpad/walk/` (`s1`–`s9`, `logs/*.jsonl`). No paid call, no deploy, no product file touched. The Studio was started locally on :8861 with **no `.env` read** (`HABAIT_DOTENV` pointed at a missing file, keys empty, `HABAIT_MOCK_LLM=1`, spend off). Only navigation was clicked, and it was killed by PID afterwards.

Every row below cites a shot or a log line. Anything a shot does not prove is in "Not proven" at the end.

## 1. Screen map (the real link graph)

| # | Screen | URL | Main buttons → where they go | Shots |
|---|---|---|---|---|
| S1 | Home (projects) | `/` | `EN`/`עב` toggle (works, flips dir) · hero CTA **לסיור בפרויקט** and the Rainbow card → S2 | 01, 01b, 02 |
| S2 | Orbit clip (step 1 of the hold) | `/hold/?tour=…&from=platform&project=rainbow&orbit=…/fixtures/rainbow/orbit_real.mp4` | plays `orbit_real.mp4` (17.0 s) · **דלג** → S3 · 🔊 sound | 03, 04 |
| S3 | Hold: "מול החזית · בחרו דירה" (interactive facade, pills per unit) | same URL as S2 | drag/zoom · unit pill → S4 · **▤ דירות** → S3a drawer · **הדמיית הבניין והסביבה** → S5 · 🔊 | 05, 06, 07 |
| S3a | Units drawer | same | row → S4 (card) · × | 07 |
| S4 | Unit card (846) | same | **המשיכו אל הדירה** → S6 · **לסיור 360°** → `/tour/?scope=apartment&room=terraceLiving…&return=/hold/…` · **עמוד הדירה** → S8 · **וואטסאפ** → `wa.me/972500000000…` · **השאירו פרטים** (form) · ☆ favourite · × | 08, 08b |
| S5 | Building overlay ("הדמיית הבניין והסביבה"): tour project scope in an iframe over the hold | iframe `/tour/?floor=parquet&video=0&from=hold&ui=min`; address stays `/hold/` | auto-guide runs the stops · ‹ › · strip of 11 stops · in-pano hotspot · **דלג** · ✕ → back to S3 at the same state | 10–15 |
| S6 | Descent (clip) → apartment tour in an iframe on `/hold/` | iframe `/tour/?scope=apartment&room=terraceLiving&floor=parquet&video=0&from=flight&ui=min&return=…` | **חזרה לבניין** → S3 · room strip (11) · ‹ › · finish switch פרקט/בטון/שיש · lang · ruler · guide | 16, 17, 18 |
| S7 | Tour, full chrome (direct link, "לסיור 360°", the apartment page's full-screen button) | `/tour/?scope=apartment&room=…` | as S6 plus tool column: **3D** → S7a · **תוכנית הדירה** → plan sheet · zoom ± · rotate · reset · full screen · מעוצב/מקור look switch | 20, 21-room-*, 27–30 |
| S7a | Dollhouse (3D rises out of the 360) | layer over S7 (`/tour/3d/dollhouse.html`) | תלת-ממד / מלמעלה / מבחוץ · room label → card **צפו ב-360°** → that room · ✕ → S7 | 22–26 |
| S8 | Apartment page | `/apartment.html?project=rainbow&unit=846&sid=…&from=flight` | tabs סיור 360° / תכנית / תמונות / תלת-ממד / אודות · embedded tour · **פתיחה במסך מלא** → S7 · וואטסאפ · התקשרו (`tel:+972500000000`) · ZIP (`/_local/dist/rainbow/846/846.zip`, 4.9 MB) · **חזרה לבניין** / brand → S2 | 40, 41 |
| S9 | Landing (not linked from S1) | `/landing.html?project=rainbow` | embedded cine flight · פתיחה במסך מלא → S10 · availability rows → S8 per unit · WhatsApp · lead form | 45 |
| S10 | flow.html cine flight (not linked from S1) | `/flow.html?project=rainbow` | auto-plays "סביב המגדל" · **אל החזית · בחירת דירה** · ▤ units · EN · 🔊 | 42 |
| S11 | intro.html (not linked from S1) | `/intro.html?project=rainbow` | plays the orbit clip · דלג | 46 |
| S12 | Design-system page (public) | `/styleguide.html` | internal tokens/components | 47 |
| S13 | Studio (developer platform): **not on production** (`/studio/` → 404). Local only | `http://127.0.0.1:8861/#/`, `#/p/apt846-rainbow-tlv` | פרויקט חדש · project → 4 steps העלאה / מה המערכת הבינה / יצירה / התוצאות · "צור את ההדמיה · כ-$4.05" (not clicked) | 50, 51 |

Other URL checks (curl status, which only proves the file is served, not that it paints): `/demo-transition.html` 404, `/dashboard.html` 404, `/js/CLAUDE.md` 404 (good). `/tour/3d/dollhouse.html` is 200 (2.29 MB).

Buyer path: S1 → S2 → S3 → S4 → S6 → tour rooms. Side branches: S3 → S5 → ✕ back, and S4 → S8 / S7.

## 2. Fix list

Tracks: `1-platform` = the developer Studio (upload → generate) · `2-film:<segment>` = the bird's-eye surroundings film and the hold · `3-apartment:<room>` = the apartment simulation · `shell` = shared chrome, navigation, i18n and legal.

| ID | Screen | Sev | What the shot shows | What it should be | Likely source | Track |
|---|---|---|---|---|---|---|
| F01 | S5, S6 (every scene reached through the buyer flow) | **blocker** (compliance, root §6; the wording is Eliran's call) | In the buyer flow the tour badge **הדמיה**, the concept line and the AI note are not rendered: `.ui-min #tour-badge, #tour-concept, #tour-ai-note {display:none !important}`. Measured `tour-badge none/0` in `logs/tourmin-*.jsonl`. Only the small "(הדמיה)" in the subtitle remains. `18-tour-first-room-desktop.png`, `18-tour-first-room-phone.png`, `12-building-first-scene-desktop.png`, `14-building-*-desktop.png` | The bilingual *הדמיה · AI-generated* badge is visible on every AI scene in every mode (the full-chrome tour `20-tour-terraceLiving-first-desktop.png` shows it) | `tour360/viewer` CSS, the ui-min rule (built into `tour360/dist/apt846/index.html` ~l.1020) | shell (hits 2-film:exterior stops + 3-apartment:all rooms) |
| F02 | S2, S3, S7a, S9, S10, S8 page chrome | major | None of the orbit clip, the hold, the dollhouse, landing or flow shows the bilingual badge. They show only Hebrew legal text (`הדמיה להמחשה בלבד…`; the dollhouse shows `הדמיה להמחשה בלבד.`). Home and Studio do show `הדמיה · AI-generated`. `03-hold-orbit-1s-desktop.png`, `05-hold-picker-desktop.png`, `24-tour-dollhouse-9s-desktop.png`, `42-flow-start-desktop.png` vs `01-home-desktop.png` | One badge component on every AI surface | `research/fal-bench-2026-11-02/flyover3d/index.html` (hold, staged to `/hold/`), `tour360/apartments/apt846/dollhouse`, `platform/flow.html`, `landing.html` | shell (2-film:orbit-clip, 2-film:hold, 3-apartment:dollhouse) |
| F03 | S6 | major | The 3D/dollhouse button and the plan button cannot be reached in the buyer flow. ui-min hides `#t-tools` (`t-tools none/0`). The dollhouse only exists on the direct `/tour/` link or the apartment page tab. `18-tour-first-room-desktop.png` vs `20-tour-terraceLiving-first-desktop.png` | The 3D "rise" is reachable from the room the buyer lands in (the shipped transition-rise feature) | `tour360/viewer` ui-min CSS (same rule as F01) | 3-apartment:all rooms |
| F04 | S3 phone | major | At 390 px the hold's top chrome stacks on itself. The legend covers the title "מול החזית · בחרו דירה", the **דירות** button covers "לחצו על דירה", the drag hint sits on top, and the legal line runs white-on-facade and cannot be read. `05-hold-picker-phone.png`, `08-hold-card-846-phone.png`, `15-building-closed-phone.png` | One clear stack: title, legend, units button; legal text on a scrim or at the bottom | `platform/js/picker.js` + `platform/css/style.css` (`.picker-chrome`), `flyover3d/index.html` (`#buildingBtn`, `#clipLegal`, `#dragHint`) | 2-film:hold |
| F05 | S6 landing, S7 | major | The apartment opens on **מרפסת שמש** with half the frame a blank wall, on both desktop and phone. The descent clip ends looking at the living-room sofa and then dissolves into this wall-facing view, so the landing does not match the clip. `16-descent-5s-desktop.png`, `16-descent-9s-desktop.png`, `18-tour-first-room-phone.png`, `20-tour-terraceLiving-first-desktop.png` | The landing yaw continues the clip's last frame (or the scene's best view), with no wall in frame | `tour360/apartments/apt846/cameras.json` / `scenes.json` (terraceLiving heading), hold `tourUrl()` room in `flyover3d/app.js` | 3-apartment:terraceLiving (+ 2-film:descent) |
| F06 | S6/S7/S8 phone | major | On phone the tour's language switch is pushed off the left edge (header row overflows), so EN/FR cannot be reached on a phone. `18-tour-first-room-phone.png` (no switch), `27-tour-plan-phone.png` ("עב" clipped at x=0), `40-apartment-page-phone.png` | The language switch is visible at 390 px (wrap or collapse the row) | `tour360/viewer` top-bar CSS (`#t-lang`, `.t-head`) | shell |
| F07 | S3 desktop | minor | After a drag the pills collide: 856/847 and 837/846 overlap, and pill 876 is cut by the card. `06-hold-dragged-desktop.png`, `07-hold-units-drawer-desktop.png`, `08-hold-card-846-desktop.png` | Pills de-overlap after every view change; the card does not cover a pill | `platform/js/picker.js` `resolveOverlaps` (plus the staged patch in `tools/deploy-vercel/stage_flow.py`) | 2-film:hold |
| F08 | S3a | minor | Bidi bug. "L · 4 חדרים · 118 מ״ר" renders as "4 · L חדרים · 118", which reads as "4 · L rooms". "PH · 6 חדרים ·" wraps with "210 מ״ר" orphaned on the next line. `07-hold-units-drawer-desktop.png` (zoomed crop checked) | Isolate the type and the numbers (`<bdi>`); keep one row on one line | `platform/js/picker.js` drawer row template | 2-film:hold |
| F09 | S3a desktop | minor | The 🔊 sound button sits on top of the drawer heading "דירות". `07-hold-units-drawer-desktop.png` | The drawer covers or moves the sound button | `flyover3d/index.html` `#soundBtn` z-index | 2-film:hold |
| F10 | S2/S3 | minor | The production tab title is "הדמיית ריחוף אינטראקטיבית — Rainbow TLV (טיוטה)" ("draft"). The legal line names the project "Rainbow תל אביב" on the clip but "Rainbow Tel Aviv" inside the Hebrew line on the hold. `logs/hold-desktop.jsonl`, `04-hold-orbit-5s-desktop.png` vs `05-hold-picker-desktop.png` | A buyer-facing title ("Rainbow תל אביב · Habait"); one project name per language | `flyover3d/index.html` l.7 `<title>`, `#clipLegal` / `app.js` legal text | 2-film:hold |
| F11 | S5 | minor | In the building overlay, ‹ › after the last stop **מחוץ למרפסת** wraps back to **מעוף ציפור** (`14-building-05-terraceOut-desktop.png` → `14-building-06-aerial-desktop.png`). The strip holds only the 11 exterior stops. Getting into the apartment needs the in-pano hotspot "מרפסת שמש" | "Next" from the last stop goes into the apartment, or the strip ends with a clear "into the apartment" step | `tour360/viewer/tour.js` next/prev in project scope | 2-film:terraceOut |
| F12 | S5 | polish | The orbit stops are labelled "סיבוב · 2" … "סיבוב · 6". There is no "סיבוב · 1" (orbit1 is called 2). `12-building-first-scene-desktop.png` strip | Stop 1 of the orbit is "סיבוב · 1" (or name the stops by view) | `tour360/apartments/apt846/exterior.json` names | 2-film:orbit1–5 |
| F13 | S5 | minor | The exterior panoramas show a bowl-shaped curved sea horizon at the default view. While the guide advances, the crossfade shows a double-exposed frame. `14-building-06-aerial-desktop.png`, `14-building-01-tower-desktop.png`, `14-building-02-approach45-desktop.png`, `10-building-open-2s-desktop.png` | A straight horizon (narrower hfov or pitch at 0); a shorter/cleaner crossfade | `tour360/apartments/apt846/exterior.json` (hfov/pitch per stop), viewer crossfade | 2-film:aerial, orbit1–5, tower, approach45 |
| F14 | S5 phone | minor | The loading toast "פותחים את סיבוב · 4…" sits on the room title, and ✕ crowds the title block. `11-building-open-8s-phone.png` | The toast does not cover the title | `tour360/viewer` `#t-loading` position; `flyover3d/index.html` `#buildingClose` | 2-film:orbit3 |
| F15 | S3/S5 | minor | Analytics drops `building_open` and `building_close` (`[analytics] unknown event building_open`), so the building overlay is not measured. `logs/building-desktop.jsonl` | Add both events to the known list | `platform/js/analytics.js` `EVENTS` vs `flyover3d/app.js` `track()` | shell |
| F16 | S8 | minor | Embedded tour on the apartment page: the mini-dollhouse thumbnail covers the tool column (3D/ruler), the hotspot labels overlap ‹ and the counter, and on phone the concept line is cut and the tab row loses "אודות" (the button sits at L −55). `41-apartment-page-full-desktop.png`, `40-apartment-page-phone.png`, `logs/apartment-phone.jsonl` | The embed uses the quiet chrome without collisions; the tabs scroll visibly | `platform/apartment.html`, `platform/js/apartment.js`, tour embed params | 3-apartment:terraceLiving (embed) |
| F17 | S8 | polish | The legal paragraph is printed twice, and on desktop the contact card floats in an otherwise empty left column. `41-apartment-page-full-desktop.png` | One legal block; a balanced 2-column layout | `platform/apartment.html` / `css` | shell |
| F18 | S9 | minor | On landing the legal box sits over the middle of the hero video (on the tower) and the same line repeats under it. `45-landing-desktop.png`. Landing, flow.html and intro.html are not linked from the home page, which goes straight to `/hold/` | Legal text at the edge, once. Decide whether these pages are live or retired | `platform/landing.html`, `platform/js/landing.js` | shell |
| F19 | S1 desktop | polish | One project card fills half the grid, leaving the left half empty. The hero is a stitched panorama with visibly bent buildings at the bottom. `01b-home-full-desktop.png` | Card grid centred or full width for one project; a hero frame without stitch warping | `platform/css/home.css`, hero media | shell |
| F20 | S4, S8, S9 | major | The live contact buttons use placeholder numbers: `wa.me/972500000000…` and `tel:+972500000000` (`logs/hold-desktop.jsonl` card links, `logs/apartment-desktop.jsonl`). A buyer who taps them reaches nobody. `08-hold-card-846-desktop.png`, `40-apartment-page-desktop.png` | The developer's real sales number (Eliran's call), or hide the buttons until set | `platform/fixtures/rainbow/project.json` (contact) | shell |
| F21 | S12 | polish | `/styleguide.html` is public on production and shows an internal "צור את הפרויקט · כ-$7.56" button. `47-styleguide-public-desktop.png` | Not staged, like `dashboard.html` / `demo-transition.html` | `tools/deploy-vercel/stage_flow.py` exclude list | shell |
| F22 | S7 phone | minor | The whole tour UI slid about 95 px sideways (title, badge and language switch cut) after the last strip card was scrolled into view. `21-room-10-bathguest-phone.png`. Triggered by `scrollIntoView`, which keyboard focus also does; not shown for a finger swipe | The root never scrolls sideways (`overflow: clip` on the root, strip scroll contained) | `tour360/viewer` root/strip CSS (`.t-card` row reaches R617 at 390 px, `logs/tools-phone.jsonl`) | 3-apartment:bathguest (all rooms) |
| F23 | S7 | polish | The hotspot label reads "כניסה אל כניסה" ("entry into entrance") on kitchen and bathguest. `logs/rooms-desktop.jsonl`, `21-room-10-bathguest-desktop.png` | "אל הכניסה" | `tour360/apartments/apt846/scenes.json` labels / door-label template | 3-apartment:kitchen, bathguest |
| F24 | S7a | minor | In the dollhouse both terraces render as a white melted blob. On phone the model fills about a quarter of the screen and the labels crowd the walls. `24-tour-dollhouse-9s-desktop.png`, `24-tour-dollhouse-9s-phone.png` | Clean terrace geometry; the model fits the phone viewport | `tour360/apartments/apt846/dollhouse/` | 3-apartment:terraceLiving, terraceBedroom (dollhouse) |
| F25 | S13 | minor (gap) | The developer platform has no production presence (`/studio/` 404). It runs only on a laptop at :8861. The local project shows "צריך אותך", 10 items to review, results 0 of 3, spend $128.54. `50-studio-home-desktop.png`, `51-studio-project-desktop.png` | A decision on where track 1 lives (Eliran's call: cost and keys) | `Habait/studio/` | 1-platform |
| F26 | S13 | minor | The Studio project's uploaded developer files include `CLAUDE.md` (a context file), listed with role "אחר". `51-studio-project-desktop.png` | Uploads list only the developer's files; the context-file rule skips `_local/projects/*/uploads` | `studio/_local/projects/apt846-rainbow-tlv/`, `.claude/skills/sync-context/generate-cards.py` | 1-platform |

**Counts:** 26 in total. By severity: blocker 1, major 6, minor 14, polish 5. By track: shell 9 · 2-film 9 · 3-apartment 6 · 1-platform 2.

## 3. What the product actually has (observed)

### Apartment rooms (tour strip, 11, apartment 846)
| # | Room (he) | scene id | Shots |
|---|---|---|---|
| 01 | כניסה | entrance | 21-room-00 |
| 02 | מטבח | kitchen | 21-room-01 |
| 03 | פינת אוכל | dining | 21-room-02 |
| 04 | סלון | living | 21-room-03 |
| 05 | מרפסת שמש (the buyer-flow landing room) | terraceLiving | 21-room-04, 18, 20 |
| 06 | מרפסת · קצה החדרים | terraceBedroom | 21-room-05 |
| 07 | חדר שינה הורים | bedroomMain | 21-room-06 |
| 08 | פינת ארונות | wardrobe | 21-room-07 |
| 09 | חדר רחצה הורים | bathMain | 21-room-08 |
| 10 | חדר שינה | bedroom2 | 21-room-09 |
| 11 | חדר רחצה כללי | bathguest | 21-room-10 |

Features that cut across every room: floor finish פרקט/בטון/שיש (`28`), look מעוצב/מקור (clay model, `29`), plan sheet with 11 numbered points (`27`), dollhouse with the 11 rooms and their areas (6/10/9/31/16/3/12/5/4/9/3 m²) and 3D/top/outside views (`24`, `25`), ruler, guide, and he/en/fr (`30`).

### Film segments and stops (as seen, in buyer order)
1. **Home hero still**: a stitched aerial panorama of the tower on the coast (`01`).
2. **Orbit clip** `orbit_real.mp4`, 17.0 s: one clockwise orbit around the tower with the sea and the Reading chimney, ending on the tower pose. It has skip and sound (`03`, `04`).
3. **The stop in front of the building (hold)**, "מול החזית · בחרו דירה": the interactive facade (node-b-tower) with birds, 9 unit pills on desktop and 8 on phone, the legend, the drawer and the card (`05`–`08`).
4. **Descent clip** after "המשיכו אל הדירה": from the floor-16 facade into the apartment, then a crossfade into the tour (`16`).
5. **Building overlay "הדמיית הבניין והסביבה"**, 11 panorama stops with an auto-guide: 01 מעוף ציפור (aerial) · 02–06 סיבוב · 2…6 (orbit1–orbit5) · 07 מול המגדל (tower) · 08 בדרך לדירה · 45 מ' (approach45) · 09 בדרך לדירה · 25 מ' (approach25) · 10 מול החזית · קומה 16 (facade) · 11 מחוץ למרפסת (terraceOut) → hotspot "מרפסת שמש" into the apartment (`10`–`14`).
6. Off the home path: the **flow.html cine flight** ("סביב המגדל" → "אל החזית · בחירת דירה", `42`), the **landing** embed of the same flight (`45`), and **intro.html** (the orbit clip alone, `46`).

## 4. Not proven / notes
- Desktop pills appeared 42.7 s after the home CTA and phone pills after 18.8 s (the clip is 17.0 s). Under SwiftShader software GL this is not a real-device measurement, so it is not listed as a fix.
- `ambience.m4a` net::ERR_ABORTED on hold, flow and landing, and `orbit.first.jpg` aborted on landing, are media/range aborts. No 4xx was seen. intro.html logged one 404 once and did not repeat on a second load, so it is dropped.
- The Studio was walked with a mock LLM and no keys. Its "2 חסרים" state reflects that, not production.
- No console `pageerror` on any page in any viewport (`logs/*.jsonl`).
