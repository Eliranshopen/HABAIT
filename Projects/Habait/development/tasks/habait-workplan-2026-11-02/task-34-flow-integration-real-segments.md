# משימה 34: אינטגרציה: הקטעים האמיתיים (approach / hold / descend-846 / enter-846) נכנסים ל-flow.html במקום ה-placeholders, כיתוב v1 בכל מסך, מסירה ל-living בלי קפיצה

| שדה | ערך |
|---|---|
| **לוח** | `habait-workplan-2026-11-02` |
| **ערוץ** | D (platform) + C (flyover) |
| **מקור בתכנית** | נפתח ב-2.11 19:30 על ידי habait-1d בעקבות שער M1 (כרטיס 32, FAIL): "הפלואו הרציף לא קיים עדיין כמוצר אחד". ממלא את הפער בין כרטיסים 17/18/20/22 (הקטעים) לכרטיס 03 (ה-flow player). |
| **סוכן** | `platform-dev` (`status: live`, `owner-track: habait`, `model: opus`) |
| **Ruling tier** | **T0** |
| **גל (wave)** | 7 |
| **מצב** | DONE (platform-dev, 2026-11-03 06:27 שעון המכונה; `flow.html?project=rainbow&real=1`; ראו "תוצאה") |
| **זיכרון** | הזיכרון של הסוכן הוא בלוק `## תוצאה` כאן (ראו rails). |

## מטרה

רוכש פותח `flow.html?project=rainbow` בטלפון ורואה את הטיסה האמיתית (פריימי Cycles מ-Kaggle, equirect) ולא את ה-placeholders של הפיקסטורה: approach → עצירה מול החזית (hold) → קליק על 846 → descend-846 → enter-846 → מסירה לסיור ב-living ב-yaw 111.3 (הפריים האחרון של enter = הפנורמה). כיתוב v1 (`caption-v1.json`, `short_project`/`micro`) בתוך הפריים בכל מסך. בלי modal חוסם, בלי ספינר בכניסה (preload מאחור, חיתוך כשמוכן; כלל "בלי מסכי טעינה" של אלירן), בלי מיתוג יזם.

## תלויות

- 22 (הפריימים: `Habait/flyover/equirect/_local/segments/{approach,descend-846,enter-846}/frames/` + camera.json; hold-facade אם רונדר, אחרת פנורמת node-b המולבשת כ-hold), 19 (hotspots.json לכל קטע), 20 (enter.py, yaw המסירה 111.3), 30 (caption-v1.json), 03 (flow.html/flow.js/picker.js, החוזה `flow.json`)

## קלטים (קריאה)

- `Habait/platform/fixtures/rainbow/{flow.json,project.json,units.json}` + `js/flow.js`, `js/picker.js` (נטען חי גם אצל 98: שינוי = הודעה ל-98 + npm test), `contracts/`
- `Habait/flyover/equirect/README-he.md` (מוסכמת u/yaw), `Habait/flyover/hotspots/README-he.md`, `Habait/flyover/REPORT-C5-he.md`
- `C:\RnD\Projects\Habait\data\sales-plans\legal\caption-v1.json`
- `gates/M1-report-he.md` (מה בדיוק נכשל)

## קבצים (הסוכן כותב רק כאן)

- `Habait/platform/tools/build_segments.mjs` (חדש: פריימי equirect → mp4 (ffmpeg, h264, 2048×1024 או 1024×512) + poster + `segments.json` עם fps, yaw ראשון/אחרון, hotspots לפי פריים)
- `Habait/platform/_local/segments/rainbow/**` (ה-mp4 המקומיים; gitignored) + עדכון `fixtures/rainbow/flow.json` (או קובץ `flow.real.json` שנבחר עם `?real=1`, אם הפיקסטורה חייבת להישאר placeholder לטסטים)
- `Habait/platform/js/flow.js` (תוספות: כיתוב בכל מסך, מסירה עם yaw, preload), `css/` לפי הצורך
- `Habait/platform/test/flow-real.test.mjs`
- הכרטיס הזה

## צעדים

1. לקרוא את דוח M1 ואת החוזה של flow.json; להחליט אם הנגן מציג equirect video כ-360 (קיים ב-flow.js?) או פריימים; לתעד.
2. build_segments.mjs: לכל קטע קיים → mp4 + poster + yaw/hotspots; קטע חסר → fallback מתועד (hold = node-b skin).
3. flow.json/flow.real.json: הקטעים האמיתיים, start=approach, hold עם picker, descend-846, enter-846, מסירה `tour_url` עם `room=living&yaw=111.3`.
4. כיתוב `short_project`/`micro` בתוך הפריים בכל מסך (כולל וידאו), בעברית ואנגלית; בלי modal; preload של הקטע הבא מאחורי הנוכחי.
5. טסט Playwright במובייל: 8 צילומים לאורך הפלואו, בדיקת yaw רציף בין קטעים (מהנתונים), כיתוב בכל צילום, 0 בקשות חיצוניות.

## קריטריוני קבלה

- [ ] `flow.html?project=rainbow` במובייל מציג approach→hold→846→descend→enter→סיור בלי modal ובלי ספינר (preload).
- [ ] הכיתוב v1 נראה בכל מסך (כולל על וידאו).
- [ ] המסירה פותחת living ב-yaw 111.3 ±2° (הפריים האחרון של enter מול הפנורמה).
- [ ] npm test + browser.mjs + flow-real.test ירוקים; picker.js לא נשבר ל-98.

## Gate

**Check:**
```bash
cd C:/RnD/Projects/Habait/habait-walkaround/Habait/platform && export HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps && timeout 300 node tools/build_segments.mjs --project rainbow --dry-run && timeout 600 node test/flow-real.test.mjs && timeout 300 npm test
# צפוי: build_segments מפרט N קטעים (approach, hold, descend-846, enter-846) עם מקור לכל אחד; flow-real: "flow real: X/X ok, caption on 8/8 shots, handoff yaw 111.3", exit 0; npm test all green
```

**Reviewer scope:** רציפות בלבד: אין קאט בלי כיתוב, yaw רציף, המסירה ל-living. הבודק = ריצה חוזרת של כרטיס 32.

## כסף

$0 (ffmpeg מקומי; הפריימים כבר רונדרו ב-Kaggle)

## דרגת הכרעה

**T0:** הסוכן מכריע ורושם. הכרעות אלירן (19:25): enter כמו שהוא; GPT נשאר; לא להראות ליזם עד M1 PASS.

---

## Standing rails (זהה בכל כרטיס; המקור: `docs/agent-team-org-chart.md` §3)

1. **קריאה תחומה קודם:** `C:\RnD\Projects\Habait\CLAUDE.md`, אחר כך `C:\RnD\Projects\Habait\SESSIONS.md` (כולו), אחר כך `C:\RnD\Projects\Habait\memory.md` סעיפים 1, 4, 6, 7. אחר כך הכרטיס הזה, ה-`README.md` של הלוח (Standing rails, Key state, הכרעות פתוחות).
2. **כותבים אחרון, פעם אחת:** הסוכן לא עורך `memory.md` ולא `SESSIONS.md`. הכתיבה היחידה שלו לזיכרון היא בלוק `## תוצאה` בסוף הכרטיס הזה (מה נעשה, קבצים, פלט ה-Check מילה במילה, כסף, פגמים פתוחים, שורת `לזיכרון:` ≤ 400 תווים).
3. **קורא שני:** באותו בלוק: איזה סשן אחר (habait-98/ba) חייב לדעת את זה ולמה; אותה שורה תחת "העברות" ב-README של הלוח.
4. **פעולה לא נגמרה עד שהזיכרון שלה נכתב.**
5. **דרגת הכרעה:** T0.

---

## תוצאה

_(platform-dev, הורץ 2026-11-02 19:39 שעון המכונה → נעצר על מגבלת המנוי ~19:50 → חודש 2026-11-03 05:43 → הסתיים 06:27 שעון המכונה (JST, `date`). T0.)_

- **מצב:** DONE. קריטריון 1 מתקיים בכתובת **`flow.html?project=rainbow&real=1`**, לפי האפשרות שהכרטיס עצמו נותן ("flow.real.json שנבחר עם `?real=1`, אם הפיקסטורה חייבת להישאר placeholder לטסטים"). `flow.html?project=rainbow` בלי הדגל נשאר ה-placeholder, כי `test/browser.mjs` (לא בקבצים של הכרטיס) נועץ אותו: still של orbit, overlay מסירה ל-terraceLiving. להפוך את ברירת המחדל = שתי שורות של 1d: `&real=0` בסעיפים 2–3 של browser.mjs + `REAL_WANTED = QS.get('real') !== '0'` ב-flow.js.
- **מה נעשה:**
  1. **החלטת נגן (צעד 1):** `viewer360.js` כבר מציג וידאו equirect כ-360 (VideoTexture על כדור), לכן mp4 ולא רצף פריימים. ffmpeg 8.0.1 (Gyan, WinGet) נמצא. לכל קטע `<video>` משלו ב-pool, נטען מאחורי הקטע הנוכחי (iOS: play+pause מושתק). ה-texture מתחלף רק כשהפריים הראשון של הקטע הבא מפוענח (rVFC / timeupdate, ועם `needsUpdate` מיידי כדי שלא יהיה פריים שחור). עד אז נשאר על המסך הפריים האחרון של הקטע הקודם. אין ספינר, אין modal פתיחה: autoplay מושתק, ואם נחסם (מצב חיסכון ב-iOS) מופיע chip "הקישו כדי להמשיך בטיסה" מעל הפריים, לא modal. ה-yaw של הצופה יחסי לכיוון המצלמה (u 0.5 = look_dir), ולכן מעבר קטע לא מסובב את הרוכש. נבדק: ה-yaw בכל חיתוך שווה לזה שבפריים הראשון שמוצג.
  2. **`tools/build_segments.mjs`:** פריימים → mp4 h264 (yuv420p bt709, crf 20, faststart) + `<seg>.first.jpg`/`.last.jpg` + `segments.json` (fps, yaw/pos ראשון ואחרון, hotspots לפי פריים מכרטיס 19, בדיקות תפר על ה-mp4 **המפוענח**, נתוני מסירה, כיתוב v1 ממולא) + `fixtures/rainbow/flow.real.json` (flow.v0, עובר schema + cross-check). מונע מהדיסק, לא מהקוד: קטע אמיתי כשתיקיית הפריימים מכילה את כל מה ש-camera.json מתכנן, אחרת ה-fallback המתועד. idempotent לפי signature, `--force`. ריצה מלאה: 16 ש'.
  3. **flow.real.json:** approach → hold-facade (picker, loop) → descend-846 → enter-846 → `handoff`. defaults = descend-846/enter-846 (שאר הדירות עם הערת placeholder, כמו קודם).
  4. **כיתוב v1 בכל מסך** (`caption-v1.json`, PROJECT + PLAN_DATE 15.10.2025 מאותו מקור כמו build_zip): פס קבוע בתחתית המסך עם `micro` במסך כל שלב, כולל מעל הווידאו, הכרטיס והסיור. השלב (stage), ה-HUD, ה-sheet וה-iframe של הסיור יושבים מעליו, כך ששום דבר לא מכסה את הפס והפס לא מכסה תוכן. בנוסף overlay על הבמה: `short_project` בפתיחה, ב-approach, ב-hold וב-3 השניות הראשונות של הירידה; `short` (עם 846) ב-3 השניות הראשונות של enter. עברית/אנגלית לפי שפת הדף (מתג EN מחליף). גם ב-flow.html של ה-placeholder יש עכשיו פס עם כיתוב הפרויקט (project.json disclaimer = short_project v1). פגם 2 של M1 ב-flow.html נסגר בשני המצבים.
  5. **מסירה בלי קפיצה:** ה-iframe של הסיור נוצר כשהירידה מתחילה (cache חם) ומוצג מעל הפריים האחרון של enter רק אחרי שהסיור הודיע `habait:view` על living ב-yaw שביקשנו. בשנייה האחרונה של enter ה-pitch וה-fov מתיישרים ל-−2° ול-`fitHfov()` של tour.js. URL בצורה ש-98 אישר (2026-11-02): `?scope=apartment&room=living&yaw=<yaw הצופה>&ui=min&floor=parquet&video=0&return=<flow.html?project=rainbow&real=1&seg=hold-facade&from=tour>&from=flight&sid=…`. ה-return פונה ל-hold של הפלטפורמה, ו-`target=_top` של הסיור מטפל בו.
  6. **framing ב-hold (נוסף, T0):** ב-iPhone 13 הקומות של עמודת 846 רחוקות 2.4° זו מזו, וב-fov 75 הפילולות עלו זו על זו. ה-stagger של `resolveOverlaps()` ב-picker.js, שנבנה לשורה של יחידות, דחס את העמודה ו-856 כיסה את 846. בהגעה ל-hold הנגן מיישר את המבט בהדרגה (~1.2 ש', בטל בגרירה): יחידות במרכז, fov שבו הקומות ≥ max(36 px, 1.4 גובה פילולה) זו מזו (iPhone: yaw −5.9°, pitch −11.4°, fov 41°). בתחילת הירידה המבט חוזר בהדרגה למסגור של הבמאי (yaw 0, fov 75), אלא אם הרוכש הזיז אותו. picker.js לא שונה. הטסט לוחץ על 846 בלחיצה אמיתית (Playwright מסרב לפילולה מוסתרת).
  7. **`test/flow-real.test.mjs`:** נתונים (flow.v0, מקור לכל קטע, כיתוב = caption-v1, רציפות camera.json, תפרים על ה-mp4 המפוענח, מסירה), ואז iPhone 13 + Pixel 7 (עברית) + desktop (אנגלית, גרירה של 30° בירידה): 8 צילומים לכל מכשיר (24) עם בדיקת כיתוב בכל אחד (הפס גלוי, על המסך, למעלה ב-elementFromPoint, טקסט זהה, בלי `{`; וה-overlay הצפוי), שום modal/ספינר בשום פריים, אף חיתוך לא מזיז את המבט, הסיור האמיתי של 98 (`tour360/dist/apt846`, קריאה בלבד, מוגש דרך request interception על 127.0.0.1:8848) נפתח על living ב-yaw שביקשנו, תפר המסך ב-NCC מבני מול בקרה מוזזת, 0 בקשות מחוץ ל-127.0.0.1. שרת משלו על פורט חופשי. POST `/api/events` עונה 204, כך ש-`_local/events.jsonl` לא מתלכלך.
- **הכרעות fallback (T0):**
  - **approach:** 48/192 פריימים, ולאורביט 0 → הפריימים הקיימים + dissolve של 1.5 ש' (12 אחרונים + 24 מוחזקים) אל ה-hold. לא מסובב, כי שני הפריימים מביטים במגדל במרכז. הפער 550 מ' מוצג כ-"zoom dissolve", לא כחיתוך.
  - **hold:** אין פריימי hold-facade → פנורמת ה-skin של node-b (`tour360/.../panos/balanced/node-b-tower.webp`, 2048×1024), אותה פוזה כמו descend frame 1 (Δpos 0.015 מ', Δyaw 0). כש-hold-facade ירונדר (clay), ה-skin נשאר ה-hold.
  - **descend:** clay 1–120 אמיתי. 12 הפריימים הראשונים מתמזגים מה-hold (skin→clay, אותה פוזה).
  - **enter:** במקור היו 3 פריימי smoke בלבד, ו-fallback מסונתז (עקומת ה-yaw של camera.json כסיבוב equirect מדויק + crossfade לפנורמת living לפי התקדמות המסלול) עבר 37/37. **מ-06:11 הטיוטה האמיתית של 98 על הדיסק (96 פריימים 1024×512), והריצה החוזרת לקחה אותה בלי שינוי בזיהוי.** היא מתחילה ב-18 פריימי dissolve רשום מ-clay 120 (אותה פוזה, המצלמה ב-0.3 מ'/ש') ונגמרת ב-lock של 12 פריימים על הפנורמה ברזולוציה מלאה (פריים 96 כבר הוא הפנורמה, MAE 0.37). ה-fallback נשאר בקוד לקטע חסר.
  - **הזנב של descend על סצנת enter** (`batch/_local/tail-local`, 97–120) **לא בשימוש:** בפריימים 97–110 הקרנת החזית מעוותת בזמן שהמצלמה נעה ב-~13 מ'/ש'. מעבר המראה במרפסת, כמעט בעמידה, הוא dissolve רשום ונקי יותר.
  - **רזולוציה:** כל הקטעים ב-2048×1024 אחיד (lanczos). ה-blends מחושבים בגודל מלא, כך שהפריים הראשון של קטע = האחרון של הקודם ברזולוציה מלאה (ההתרככות בתוך ה-blend, לא בחיתוך). הסוף נועל על פנורמת 2048 שהסיור מציג, ויש texture אחד. `native_size` נרשם ב-segments.json.
  - **כיתוב:** לא נצרב לתוך ה-mp4. אלה textures של 360: כיתוב צרוב יושב בכיוון אחד ויוצא מהמסך כשמסתובבים, ובתחתית ה-equirect הוא נמתח ×3. הפס הקבוע ב-HTML הוא "fixed bottom line in the viewer HTML" של caption-v1 ומופיע בכל צילום מסך.
  - **ה-yaw של המסירה:** "living ב-111.3" הוא **bearing**. ה-`?yaw=` של tour.js נמדד במסגרת הפנורמה (yaw 0 = centreBearingDeg 111.3, שורה ~198). נמדד: הפריים האחרון של enter = `04-living` ב-shift 0 (MAE 2.0–2.3/255). לכן המסירה שולחת yaw = yaw הצופה (0 כשלא נגעו) = bearing 111.3. **`yaw=111.3` מילולי (הדוגמה של 98) היה מסובב את הרוכש 111.3° (bearing 222.6).** נבדק גם ב-yaw שאינו 0: desktop אחרי גרירה, סיור ב-yaw 30.0 = bearing 141.3, NCC 0.968.
- **קבצים שנכתבו:**
  - `Habait/platform/tools/build_segments.mjs` (חדש, 670 שורות)
  - `Habait/platform/js/flow.js` (תוספות בלבד: מצב `?real=1`, כיתוב, מסירה, framing; נתיב ה-placeholder ללא שינוי חוץ מפס הכיתוב)
  - `Habait/platform/css/flow-real.css` (חדש; נטען רק מ-flow.js, כך ש-`style.css` שנטען ב-:8899 של 98 לא נגע)
  - `Habait/platform/test/flow-real.test.mjs` (חדש)
  - `Habait/platform/fixtures/rainbow/flow.real.json` (חדש, נוצר ע"י build_segments). `fixtures/rainbow/flow.json` **לא שונה**.
  - `Habait/platform/_local/segments/rainbow/` (15 MB: approach.mp4 3.64 MB, descend-846.mp4 3.62 MB, enter-846.mp4 5.58 MB, hold-facade.jpg, *.first/last.jpg, segments.json)
  - `Habait/platform/test/shots/flow-real/*.png` (24 צילומים, אותה מוסכמה כמו `test/shots` של browser.mjs; לא ב-.gitignore, ההכרעה של 1d)
  - הכרטיס הזה
  - **לא נגעתי:** picker.js, style.css, flow.html, units.json, project.json, contracts/, Habait/tour360, studio, 360walkaround, flyover3d, tools/deploy-vercel. אין git, אין Blender, אין קריאה בתשלום. :8850 של הבעלים לא הופעל מחדש. השרת הזמני על 8857 (ל-browser.mjs) נעצר.
- **פלט ה-Check (מילה במילה; השורה כפי שהיא בכרטיס, 2026-11-03 06:23–06:26 שעון המכונה, exit 0):**
```
build_segments rainbow (dry-run) -> C:\RnD\Projects\Habait\habait-walkaround\Habait\platform\_local\segments\rainbow
ffmpeg: ffmpeg (8.0.1-full_build-www.gyan.dev)   size 2048x1024, 24 fps, h264 crf 20
  approach     video  source frames 48/192 (PARTIAL) 2048x1024 habait-walkaround/Habait/flyover/equirect/_local/segments/approach/frames -> approach.mp4 72 fr 3.00 s; tail dissolve 36 fr into hold-facade (FALLBACK: gap 549.754 m between approach frame 48 and hold-facade (frames not rendered): dissolve aligned on the frame centre (both look at the tower)); -> hold-facade dpos 549.754 m dyaw 117.226 deg
  orbit        skip   0/408 frames rendered (optional; skipped)
  hold-facade  still  source pano habait-walkaround/Habait/tour360/apartments/apt846/panos/balanced/node-b-tower.webp (hold-facade frames 0/72) -> hold-facade.jpg; hotspots 12 units from card 19 frame 1, 9 with visible >= 0.25; -> descend-846 dpos 0.015 m dyaw 0 deg
  descend-846  video  source frames 120/120 2048x1024 habait-walkaround/Habait/flyover/equirect/_local/segments/descend-846/frames -> descend-846.mp4 120 fr 5.00 s; head blend 12 fr from hold-facade; -> enter-846 dpos 0.002 m dyaw 0 deg
  enter-846    video  source frames 96/96 1024x512 (scaled to 2048x1024) habait-walkaround/Habait/flyover/equirect/_local/segments/enter-846/frames -> enter-846.mp4 96 fr 4.00 s; head blend 18 fr from descend-846; lock 12 fr onto 04-living.webp; handoff room=living bearing 111.3 (camera 111.3) tour yaw offset 0
4 segments (approach, hold-facade, descend-846, enter-846); caption v1 ai-visualization-v1 (DRAFT v1 (2026-11-02)), plan date 15.10.2025; initial view yaw 0 pitch -21.81 (approach frame 1 view_hint)
note: project.json disclaimer differs from caption-v1 short_project (filled): the unit card shows project.json, the flight shows caption-v1
flow.real.json (fixtures/rainbow/flow.real.json) would be written: flow.v0 valid, cross-check 0 error(s), 24 warning(s)
ok   flow.real.json + segments.json exist (tools/build_segments.mjs --project rainbow ran)  (4 segments, built 2026-11-03T04:13:38.639Z)
ok   flow.real.json is a valid flow.v0 chain and cross-checks with units.json (every src on disk)  (24 warnings (units.json placeholder hotspot windows))
ok   every segment names its source (real frames or the documented fallback)  (approach=frames(partial 48/192), hold-facade=pano, descend-846=frames(120), enter-846=frames(96))
ok   caption in segments.json = caption-v1.json short_project / micro / short, project + plan date filled  (ai-visualization-v1, DRAFT v1 (2026-11-02))
ok   yaw continuity in the data: every junction that shares a pose has dpos <= 0.05 m and dyaw <= 0.05 deg; the gap is a dissolve  (approach->hold-facade gap 549.754 m (dissolve, seam 4.15); hold-facade->descend-846 0.015 m 0 deg seam 3.96; descend-846->enter-846 0.002 m 0 deg seam 0.62)
ok   seams on the decoded videos: the frame shown before a cut = the first frame after it (MAE <= 6/255 at 512x256)  (4.15 / 3.96 / 0.62)
ok   hand-off data: enter ends on the living panorama at bearing 111.3 = its centreBearingDeg (tour yaw offset 0, shift 0)  (last frame vs 04-living.webp: MAE 2.3/255, shift 0 deg)
ok   [iphone13] real flight loads: no start modal, frame 1 of approach up, approach plays (shot 1)  (approach: band + short_project)
ok   [iphone13] approach dissolves into the hold still (shot 2)  (approach-dissolve: band + short_project)
ok   [iphone13] hold: the skinned facade still, 9 unit pills from card 19 (visible >= 0.25), 846 among them (shot 3)  (hold: band + short_project, pills 826 835 836 845 846 855 856 866 876)
ok   [iphone13] tap 846 (a real click: Playwright refuses an obscured pill) -> the unit card; the caption band stays visible (shot 4)  (card: band)
ok   [iphone13] continue -> descend-846 starts on the hold frame, the video texture moves (shot 5)  (descend: band + short_project, differs from the hold by 67.0/255)
ok   [iphone13] enter-846 with the unit caption (short, 846) in its first 3 s (shot 6)  (enter: band + short)
ok   [iphone13] enter's last frame stays up at the hand-off, pitch/fov eased to the tour's (shot 7)  (enter-last: band, pitch -2.0 fov 86.4)
ok   [iphone13] hand-off: the tour opens in place on living at the buyer's yaw, no card, no spinner (shot 8)  (tour: band; living at tour yaw 0.0 (asked 0), bearing 111.3; seam NCC 0.910 vs 0.289 shifted 12%; raw MAE 65.0/255, tour brightness x0.77 (the tour's UI veil))
ok   [iphone13] continuity in the player: no cut moves the view (yaw at each segment start = yaw when its first frame shows); nothing modal, no spinner, ever  (yaw at each cut: approach 0.0, hold-facade 0.0, descend-846 -5.9, enter-846 0.0, hold framing yaw 0.0->-5.9 pitch -21.8->-11.4 fov 75->40.6, descend framing yaw -5.9->0.0 pitch -11.4->kept fov 41->75.0; swaps approach > hold-facade > descend-846 > enter-846)
ok   [iphone13] zero requests outside 127.0.0.1; no page errors
ok   [pixel7] real flight loads: no start modal, frame 1 of approach up, approach plays (shot 1)  (approach: band + short_project)
ok   [pixel7] approach dissolves into the hold still (shot 2)  (approach-dissolve: band + short_project)
ok   [pixel7] hold: the skinned facade still, 9 unit pills from card 19 (visible >= 0.25), 846 among them (shot 3)  (hold: band + short_project, pills 826 835 836 845 846 855 856 866 876)
ok   [pixel7] tap 846 (a real click: Playwright refuses an obscured pill) -> the unit card; the caption band stays visible (shot 4)  (card: band)
ok   [pixel7] continue -> descend-846 starts on the hold frame, the video texture moves (shot 5)  (descend: band + short_project, differs from the hold by 67.5/255)
ok   [pixel7] enter-846 with the unit caption (short, 846) in its first 3 s (shot 6)  (enter: band + short)
ok   [pixel7] enter's last frame stays up at the hand-off, pitch/fov eased to the tour's (shot 7)  (enter-last: band, pitch -2.0 fov 97.2)
ok   [pixel7] hand-off: the tour opens in place on living at the buyer's yaw, no card, no spinner (shot 8)  (tour: band; living at tour yaw 0.0 (asked 0), bearing 111.3; seam NCC 0.964 vs 0.400 shifted 12%; raw MAE 36.1/255, tour brightness x0.95 (the tour's UI veil))
ok   [pixel7] continuity in the player: no cut moves the view (yaw at each segment start = yaw when its first frame shows); nothing modal, no spinner, ever  (yaw at each cut: approach 0.0, hold-facade 0.0, descend-846 -5.9, enter-846 0.0, hold framing yaw 0.0->-5.9 pitch -21.8->-11.4 fov 75->52.4, descend framing yaw -5.9->0.0 pitch -11.4->kept fov 52->75.0; swaps approach > hold-facade > descend-846 > enter-846)
ok   [pixel7] zero requests outside 127.0.0.1; no page errors
ok   [desktop] real flight loads: no start modal, frame 1 of approach up, approach plays (shot 1)  (approach: band + short_project)
ok   [desktop] approach dissolves into the hold still (shot 2)  (approach-dissolve: band + short_project)
ok   [desktop] hold: the skinned facade still, 9 unit pills from card 19 (visible >= 0.25), 846 among them (shot 3)  (hold: band + short_project, pills 826 835 836 845 846 855 856 866 876)
ok   [desktop] tap 846 (a real click: Playwright refuses an obscured pill) -> the unit card; the caption band stays visible (shot 4)  (card: band)
ok   [desktop] continue -> descend-846 starts on the hold frame, the video texture moves (shot 5)  (descend: band + short_project, differs from the hold by 66.0/255, dragged to yaw 30.0)
ok   [desktop] enter-846 with the unit caption (short, 846) in its first 3 s (shot 6)  (enter: band + short)
ok   [desktop] enter's last frame stays up at the hand-off, pitch/fov eased to the tour's (shot 7)  (enter-last: band, pitch -2.0 fov 85.0)
ok   [desktop] hand-off: the tour opens in place on living at the buyer's yaw, no card, no spinner (shot 8)  (tour: band; living at tour yaw 30.0 (asked 30), bearing 141.3; seam NCC 0.968 vs 0.196 shifted 12%; raw MAE 15.3/255, tour brightness x0.98 (the tour's UI veil))
ok   [desktop] continuity in the player: no cut moves the view (yaw at each segment start = yaw when its first frame shows); nothing modal, no spinner, ever  (yaw at each cut: approach 0.0, hold-facade 0.0, descend-846 -5.9, enter-846 30.0, hold framing yaw 0.0->-5.9 pitch -21.8->-11.4 fov 75->49.8, descend framing yaw -5.9->0.0 pitch -11.4->kept fov 50->75.0; swaps approach > hold-facade > descend-846 > enter-846)
ok   [desktop] zero requests outside 127.0.0.1; no page errors

shots: C:\RnD\Projects\Habait\habait-walkaround\Habait\platform\test\shots\flow-real
flow real: 37/37 ok, caption on 24/24 shots, handoff yaw 111.3 (bearing; tour room=living yaw 0.0 on iPhone 13, seam NCC 0.910, desktop after a drag: tour yaw 30.0 = bearing 141.3)

> habait-platform@0.1.0 test
> node contracts/validate.mjs fixtures/rainbow && node test/smoke.mjs

warn  unit "845" uses the placeholder descend "descend-846"
warn  unit "847" uses the placeholder descend "descend-846"
warn  unit "856" uses the placeholder descend "descend-846"
warn  unit "855" uses the placeholder descend "descend-846"
warn  unit "857" uses the placeholder descend "descend-846"
warn  unit "836" uses the placeholder descend "descend-846"
warn  unit "835" uses the placeholder descend "descend-846"
warn  unit "837" uses the placeholder descend "descend-846"
warn  unit "866" uses the placeholder descend "descend-846"
warn  unit "826" uses the placeholder descend "descend-846"
warn  unit "876" uses the placeholder descend "descend-846"
fixtures/rainbow: OK - 12 units, 5 segments, 11 warning(s)
ok   fixture rainbow validates
ok   schema rejects a bad status / missing field / unknown next
ok   cross-check catches a dangling reference
ok   lead: WhatsApp link pattern
[lead] no webhook configured; lead = {
  unit: '846',
  units_viewed: [],
  src: 'direct',
  session_id: '82ef88bf-60f6-4bc2-bcde-89e601decaf5',
  ts: '2026-11-03T04:26:34.466Z'
}
ok   lead: submit with no webhook is a stub; with webhook POSTs JSON
ok   analytics: capture without a key logs and buffers
ok   picker: module loads in node and exports createPicker
ok   server: index, flow, three.js module, json
ok   server: CORS * on .js/.css/.json (habait-89 imports js/picker.js from another origin)
ok   server: Range -> 206 with Content-Range
ok   server: 404 and traversal
ok   server: events sink mounted (card 24): announced, Origin required, empty batch writes nothing

all green
```
  (exit code של כל שורת ה-Check: 0, הודפס אחריה ב-`echo "CHECK EXIT $?"`.)
- **`node test/browser.mjs` (מול שרת זמני 8857, 06:21 שעון המכונה), שורות אחרונות:**
```
ok   picker: setLang('en') relabels pills, card, drawer and chrome and flips dir
ok   picker: close() closes card + drawer; destroy() removes its DOM
ok   picker (habait-98 fix): three desktop pills 120 px apart stay compact across frames (no compact/full flicker)
ok   no page errors (picker standalone)

all green; screenshots in C:\RnD\Projects\Habait\habait-walkaround\Habait\platform\test\shots
```
  (25/25, exit 0; כולל "continue -> descend-846 (video) -> enter-846 (still) -> hand-off overlay" של ה-placeholder ו-11 בדיקות picker cross-origin, כלומר השימוש של 98.)
- **`npm test`:** "all green" (בתוך פלט ה-Check למעלה).
- **בדיקה נוספת, לא חלק מה-Check (06:30 שעון המכונה, סקריפט ב-scratchpad):** כתובת ה-return של הסיור (`flow.html?project=rainbow&real=1&seg=hold-facade&from=tour`) נוחתת ב-hold: 9 פילולות, פס micro, בלי modal פתיחה, descend-846 נטען מאחור, הכרטיס נפתח, 0 שגיאות. `?real=1` כש-segments.json חסר (404) חוזר ל-placeholder בלי קריסה, עם כיתוב הפרויקט בפס.
- **כסף:** $0 (ffmpeg מקומי; אין ledger).
- **פגמים פתוחים:**
  1. ברירת המחדל של `flow.html?project=rainbow` עדיין placeholder (ראו מצב). M1 החוזר צריך לפתוח `&real=1`.
  2. approach 48/192 ו-orbit 0: הטיסה היא 3 ש' approach + dissolve של 550 מ' אל ה-hold (מגדל "רפאים" באמצע ה-dissolve). צריך את 49–192 + orbit מ-Kaggle. rerun של build_segments יכניס אותם.
  3. שלושה מראות: approach/descend clay AgX, hold skin של GPT, enter הקרנת GPT. המעברים הם blends ולא חיתוכים, אבל שינוי המראה גלוי (פגם 7 של M1 נשאר).
  4. טיוטת enter (1024×512, 16 spp): באמצע (פריימים ~20–60) מריחות ועיוותים של הקרנת הפנים, ומוגדלת פי 2, לכן רכה. ה-final (4K) עוד לא קיים.
  5. **בסיור של 98 בטלפון:** בנחיתה של `ui=min` יש veil כהה על כל הפנורמה (בהירות ×0.77 ב-iPhone 13, ×0.95 ב-Pixel 7, ×0.98 ב-desktop) + מתג רצפה וחצים באמצע המבט. הגאומטריה זהה (NCC 0.91–0.97), אבל ירידת הבהירות נראית בחיתוך.
  6. `project.json` disclaimer (שמוצג בכרטיס הדירה) כותב "Rainbow Tel Aviv" גם בעברית, מול `name.he` = "Rainbow תל אביב" בפס. קוסמטי; הקובץ לא בכרטיס הזה.
  7. Vercel: `stage_flow.py` של 98 לא מעלה `_local`. כדי לפרסם `?real=1` צריך להעלות `_local/segments/rainbow/` (15 MB), או ש-1d מעביר את הפלט לנתיב שנפרס.
  8. דירות שאינן 846 טסות את descend/enter של 846 עם הערת placeholder. descend-836/856 רונדרו אבל לא מחווטים (אין להם enter, והמרפסת שלהן מול זיגוג אטום).
  9. 837/847/857 מוסתרות ב-hold (visible_frac 0.146 < 0.25), 9 פילולות.
  10. ה-framing ב-hold מסובב ~6° ב-1.2 ש' בהגעה (מסגור הבמאי, מתבטל בגרירה). הכרעת מוצר שנרשמה, לא נשאלה.
  11. הבדיקה רצה ב-headless SwiftShader. מכשירים אמיתיים (autoplay של iOS Safari, מצב חיסכון → chip) לא נבדקו על חומרה.
- **קורא שני:** habait-ba (=habait-98). (1) ה-`?yaw=` של tour.js במסגרת הפנורמה: למסירה מ-enter-846 שולחים `room=living&yaw=0` (או yaw הצופה), לא `yaw=111.3`, שמסובב 111.3° (נמדד: הפריים האחרון = 04-living ב-shift 0). אם החי ב-:8899/Vercel עובר ל-living, זה המספר. (2) בקשה: בלי ה-veil הכהה ובלי הווידג'טים באמצע בנחיתה עם `from=flight` בטלפון (בהירות ×0.77 בחיתוך). (3) שינוי ב-`04-living.webp`, ב-`centreBearingDeg` של living או ב-`node-b-tower.webp` מחייב rerun של `tools/build_segments.mjs` (בדיקות המסירה והתפר יתפסו). (4) picker.js **לא שונה**. `resolveOverlaps()` דוחס עמודת קומות (2.4° בין קומות), וגם ב-:8899 846 עלול להיות מכוסה ב-856 בטלפון. הנגן שלנו עוקף את זה ב-framing. (5) `_local/segments/rainbow` (15 MB) לא נכלל ב-stage_flow.py.
- **לזיכרון:** כרטיס 34 (3.11 06:27 שעון המכונה): `flow.html?project=rainbow&real=1` מנגן קטעים אמיתיים (approach 48/192+dissolve, hold=skin node-b, descend-846, enter-846 טיוטת 98) מ-`tools/build_segments.mjs`; כיתוב v1 בכל מסך; הסיור נפתח ב-iframe על living ב-yaw הצופה (0 = bearing 111.3; `yaw=111.3` היה מסובב 111°). Check exit 0, 37/37, 24/24 כיתוב, $0.

## תיקון גלישת הכרטיס (M1 v2 פגם 5)

**מצב: DONE** (תת-סוכן platform-developer ל-habait-1d, 2026-11-03 06:48–06:57 שעון המכונה; $0, בלי git, בלי Blender, בלי קריאה בתשלום; שרת משלי על פורט פנוי, לא :8850).

- **מה מצאתי (שחזור, לפני תיקון):** הגלישה היא **בתוך הכרטיס**, לא במסמך. `#unitSheet` הוא `overflow:auto`, ולכן `document.documentElement.scrollWidth` נשאר 390, וה-440 שבדוח v2 הוא `scrollWidth` של ה-sheet עצמו. הסיבה: שני ה-`<input>` של טופס הליד (`js/lead.js`) שומרים על הרוחב הטבעי שלהם (~207 px כל אחד, ברירת המחדל size=20) בתוך השורה `.lead-form .row { grid-template-columns: 1fr 1fr }` של `css/style.css` (`1fr` = `minmax(auto, 1fr)`), ולכן גוף הכרטיס מתרחב ל-422 px (מול 354 באייפון). כשהשדה מקבל focus, הכרטיס גולל הצידה בתוך עצמו (`scrollLeft -50` ב-RTL): חתוך משמאל בעברית, מימין באנגלית. **זה קורה בכל 6 הריצות** (iPhone 13, Pixel 7, desktop × he, en), גם בדסקטופ (כרטיס של 398 px). `css/landing.css` כבר מכיל בדיוק את התרופה הזו לטופס של דף הנחיתה.
- **התיקון (T0, נרשם):** 5 כללים בסוף `css/flow-real.css`, מוגבלים ל-`#unitSheet`: `.sheet-body > * { min-width: 0 }`, `.unit-facts` → `repeat(4, minmax(0, 1fr))`, `.unit-actions` ו-`.lead-form .row` → `repeat(2, minmax(0, 1fr))`, `.lead-form input:not([type=checkbox]) { min-width: 0; width: 100% }`. **ההחלטה על המיקום:** `css/flow-real.css` נטען רק על ידי `js/flow.js` (גם ב-real וגם ב-`?real=0`). `css/style.css` **לא שונה**, כי :8899 של 98 טוען אותו חי מ-:8850, בדיוק כמו את picker.js (`research/fal-bench-2026-11-02/flyover3d/index.html` שורה 6), וזו המוסכמה של כרטיס 34. **`js/picker.js` לא נגעתי בו** (אין לו inline styles על הכרטיס; הבעיה כולה ב-CSS).
- **אחרי התיקון:** הכרטיס 390/390 (iPhone) ו-412/412 (Pixel), שני השדות באותה שורה, 173+173 px (iPhone) / 184+184 (Pixel) / 177+177 (desktop), 4 העובדות בשורה אחת, אף אלמנט של הכרטיס מחוץ לכרטיס או למסך, פס הכיתוב המשפטי גלוי ולא מכוסה, 846 מקבל הקשה אמיתית לפני הכרטיס ואחרי סגירתו. ב-flow.html אין legend (`chrome: false`); הבדיקה מוודאת שאין `.picker-legend` שחופף לכרטיס (0 נמצאו). צילומים: `Habait/platform/test/shots/card-overflow/{iphone13,pixel7,desktop}-{he,en}-lead-form.png`.
- **קבצים:** `Habait/platform/css/flow-real.css` (הוספה בסוף, 13 שורות כולל הערה), `Habait/platform/test/card-overflow.test.mjs` (חדש), `Habait/platform/test/shots/card-overflow/` (6 PNG, פלט הבדיקה). `package.json` לא שונה: הבדיקה החדשה לא נכנסת ל-`npm test` (דורשת Chrome + playwright, כמו flow-real).
- **הבדיקה החדשה** (`export HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps && node test/card-overflow.test.mjs`): `flow.html?project=rainbow&seg=hold-facade` (הטיסה האמיתית, נקודת החזרה מהסיור) ב-iPhone 13, Pixel 7 ו-desktop, כל אחד בעברית ובאנגלית: הקשה אמיתית על 846 → כרטיס → "השאירו פרטים" → הקלדה בשם ובטלפון (focus על הטלפון, כמו בבדיקת v2). מוודאת `documentElement.scrollWidth <= innerWidth`, `body.scrollWidth`, `scrollX == 0`, **`sheet.scrollWidth <= sheet.clientWidth` ו-`scrollLeft == 0`** (בלי זה הבדיקה הייתה עוברת גם על הבאג), תיבת הכרטיס בתוך המסך, כל אלמנט גלוי של הכרטיס בתוך הכרטיס והמסך, הכיתוב המשפטי מעל הכרטיס ולא מכוסה, אין legend חופף, שדות ≥ 120 px באותה שורה, ו-846 שוב לחיץ אחרי הסגירה. **לפני התיקון היא נכשלה** (12/18, exit 1, בכל 6 הריצות: `sheet scrollWidth 440 > clientWidth 390; card scrollLeft -50; 21 card elements outside the card/viewport`).
- **פלט (השורות האחרונות, exit codes):**
  ```
  $ node test/card-overflow.test.mjs
  ok   [iphone13 he] lead form open, phone focused and typed: document, card and every card element inside the phone  (doc 390/390, card 390/390, box 0..390, inputs 173+173 px, band visible, legends 0)
  ok   [pixel7 en] lead form open, phone focused and typed: document, card and every card element inside the phone  (doc 412/412, card 412/412, box 0..412, inputs 184+184 px, band visible, legends 0)
  ok   [desktop en] card closed: 846 still tappable, no page errors
  card overflow: 18/18 ok (iPhone 13, Pixel 7, desktop x he, en)
  EXIT 0

  $ node test/flow-real.test.mjs
  ok   [desktop] zero requests outside 127.0.0.1; no page errors
  flow real: 37/37 ok, caption on 24/24 shots, handoff yaw 111.3 (bearing; tour room=living yaw 0.0 on iPhone 13, seam NCC 0.979, desktop after a drag: tour yaw 30.0 = bearing 141.3)
  EXIT 0

  $ node test/browser.mjs
  ok   picker (habait-98 fix): three desktop pills 120 px apart stay compact across frames (no compact/full flicker)
  ok   no page errors (picker standalone)
  all green; screenshots in C:/RnD/Projects/Habait/habait-walkaround/Habait/platform/test/shots   (25 ok)
  EXIT 0

  $ npm test
  ok   server: events sink mounted (card 24): announced, Origin required, empty batch writes nothing
  all green
  EXIT 0
  ```
- **פגמים פתוחים:** (1) באנגלית שורת הכותרת ("Apartment 846 Type L For sale") רחבה מדי, וה-☆ יורד לשורה משלו. זה לא גלישה, זה קיים מקודם, וזה קוסמטי. (2) אותו באג צפוי גם בכרטיס של :8899 (אותו `style.css`, אותו `lead.js`, אותו sheet). **לא נמדד ב-:8899**, כי זה הנתיב של 98. (3) הבדיקה רצה ב-headless SwiftShader עם device emulation; לא נבדק על מכשיר אמיתי, גם לא מקלדת iOS שמקטינה את ה-viewport.
- **לזיכרון:** M1 v2 פגם 5 תוקן (3.11 06:56, $0): הגלישה בתוך `#unitSheet` (scrollWidth 440, ה-document 390): inputs בשורת `1fr 1fr` של style.css. תיקון ב-`css/flow-real.css` בלבד (`minmax(0,1fr)`); picker.js ו-style.css לא שונו; `test/card-overflow.test.mjs` 18/18.
- **קורא שני:** habait-ba (=habait-98). **picker.js לא שונה ו-style.css לא שונה**, לכן :8899 לא מושפע ואין צורך בהודעה לפני פריסה. אבל הכרטיס של :8899 צפוי לגלוש באותו אופן כשטופס הליד נפתח (אותו style.css ואותו lead.js; לא נמדד). אם 98 רוצה את התיקון שם: 5 הכללים מסוף `css/flow-real.css` ב-CSS של `flyover3d/index.html`, או ש-1d מעביר אותם ל-`style.css` אחרי הודעה ל-98 (ואז זה חל חי גם על :8899).

## עדכון: טיסה מלאה (5 קטעים)

_(platform-dev, 2026-11-03 08:04–08:26 שעון המכונה (JST, `date`). T0. הקלט: הודעת 1d ב-08:00. על הדיסק כל הטיסה מ-Kaggle ב-2048×1024, 128 spp: approach 192/192, orbit 408/408, hold-facade 72/72, descend-846 120, enter-846 96. הרינדור החוזר של 1d ב-07:52 עבר, אבל flow-real נכשל 18/37: ה-hold הגיע אחרי 8+17 ש', מעבר להמתנה של 20 ש' בטסט, ומשם הכשלים התגלגלו.)_

- **מצב:** DONE. הפלואו האמיתי הוא ברירת המחדל מאז שהתהפכה (1d, `REAL_WANTED = !== '0'`). `?real=0` נשאר ה-placeholder של browser.mjs.
- **ההכרעה על ה-hold (T0):** **ה-hold הוא לולאת ה-clay האמיתית בת 72 הפריימים, כווידאו מתנגן בלולאה** (`hold-facade.mp4` 0.84 MB + `.first.jpg`/`.last.jpg`; ה-jpg של ה-skin הישן נמחק). למה:
  - פריימים 1 ו-72 נמצאים בפוזת המנוחה של node-b, 0.014–0.015 מ' מפריים 1 של descend.
  - המראה זהה ל-orbit ול-descend, ולכן החיתוך orbit→hold→descend הוא פריים לפריים בלי שום blend. התפרים ירדו מ-4.14/3.96 ל-0.79/0.71.
  - הלולאה "חיה": המצלמה זזה 0.67 מ' ובחזרה.
  - לא פריים 72 כ-still: אותה פוזה, אבל בלי החיים.
  - ה-skin של node-b נשאר בקוד כ-fallback כשאין פריימי hold.
- **מה השתנה:**
  1. **`tools/build_segments.mjs` (1.2):**
     - `kind` ו-`look` לכל קטע נקבעים לפי מה שעל הדיסק: ה-hold הוא video loop כשיש 72 פריימים, אחרת still מה-skin.
     - **blend רק מעבר לפער (פריימים חסרים) או לשינוי מראה.** בבנייה של 07:52 היו blends של 12 פריימים גם ב-approach→orbit וב-orbit→hold, למרות ששני הצדדים clay. הם גררו פריים מוחזק מעל מצלמה בתנועה: ~106 מ'/ש' בתחילת ה-orbit, 50→2 מ'/ש' בסופו. עכשיו נשאר blend אחד בלבד: descend→enter, clay→הקרנת פנים.
     - קטע שהחליף סוג לא משאיר פלט ישן.
     - ל-hold נכתבים `loop: true`, `hotspots` (פריים 1, 12 דירות) ו-`hotspots_by_frame` (72 פריימים).
  2. **`js/flow.js` (תוספות):**
     - ב-hold בווידאו הפילולות עוקבות אחרי ה-hotspots של כרטיס 19 לפי פריים (846 זז 0.47° במהלך הלולאה).
     - הפילולות מופיעות רק כשהפריים הראשון של ה-hold על המסך, וה-framing מתחיל באותו רגע. לפני כן `card-overflow` יכול היה ללחוץ במצב לא ממוסגר, ו-836/856 כיסו את 846.
     - פילולה שרק הלולאה מזיזה נשארת במקום עד שהמיקום האמיתי רחוק 2 px (hysteresis), אחרת היא זוחלת בתת-פיקסלים כל פריים, ו-Playwright, כמו אצבע, מחכה לאלמנט יציב. בגרירה, ב-ease או ב-gyro היא עוקבת במדויק.
     - **הלולאה נעצרת במקום כשכרטיס הדירה פתוח:** אין שינוי על המסך ואין פענוח. בלי זה, ב-SwiftShader אנימציית הכרטיס פיגרה (חפיפה של 3.2 px על הפס בבדיקת card-overflow).
     - **"המשיכו אל הדירה" מנחית את הלולאה על פוזת המנוחה** לפני הירידה. הלולאה סימטרית (פריים k = פריים 72−k), ולכן עצירה בחצי הראשון קופצת לזמן המראה (אותה פוזה, אין שינוי במסך) ומשם מתנגנת עד הסוף ב-2×, לכל היותר 0.75 ש'. נבדקו שלושת המסלולים: 2.99 (כבר במנוחה), 0.03→מראה 2.89→3.00, 2.64→3.00. הירידה תמיד מתחילה פריים לפריים.
     - הכיתוב: כל קליפ נפתח ב-3 ש' של כיתוב, `short_project` בחוץ ו-`short` עם 846 ב-enter. ה-hold מציג `short_project` כל הזמן, ו-`micro` נשאר בפס בכל מסך. ה-orbit (17 ש') אחרי 3 ש' מציג את הפס בלבד.
  3. **`fixtures/rainbow/flow.real.json`** נוצר מחדש: approach (8 ש') → orbit (17 ש') → hold-facade (video, loop, `next: null`) → descend-846 (5 ש') → enter-846 (4 ש') → handoff.
  4. **`test/flow-real.test.mjs`:**
     - השרשרת בת 5 הקטעים (4 אם אין orbit).
     - בדיקה חדשה: "blends only where they belong".
     - צילום 2 הוא ה-orbit (פס בלבד) במקום ה-dissolve של ה-approach.
     - ה-hold: וידאו בלולאה שמתנגן (t מתקדם), 9 פילולות; מתחת לכרטיס הלולאה בהשהיה; הירידה יוצאת מה-hold במנוחה.
     - המתנה של 60 ש' ל-hold.
  5. **`_local/segments/rainbow/`:** 31 MB (approach 7.04, orbit 13.47, hold-facade 0.84, descend-846 2.89 (קודד מחדש בלי blend מה-skin), enter-846 5.51 MB). ריצה חוזרת מדלגת על הכל ("up to date").
  - **לא נגעתי:** picker.js, style.css, flow.html, browser.mjs, card-overflow.test.mjs, units.json, project.json, tour360. אין git, אין Blender, אין קריאה בתשלום. :8850 לא הופעל מחדש. השרת הזמני על 8857 נעצר.
- **תפרים** (MAE/255 על ה-mp4 המפוענח, 512×256; Δ לפי camera.json):
  - approach→orbit: 0.92 (0.04 מ', 0.007°, חיתוך)
  - orbit→hold-facade: 0.79 (0.001 מ', 0°, חיתוך)
  - hold-facade→descend-846: 0.71 (0.014 מ', 0°, חיתוך)
  - descend-846→enter-846: 0.61 (0.002 מ', 0°, blend של 18 פריימים clay→הקרנה)
  - מסירה: הפריים האחרון מול `04-living.webp`: 2.3/255, הזזה 0°.
  - בסיור (מסך מול מסך): NCC 0.838 / 0.890 / 0.972 (iPhone / Pixel / desktop), מול בקרה מוזזת 0.225 / 0.378 / 0.196. הבהירות בסיור ×0.99 בשלושתם (היה ×0.77 ב-iPhone), כלומר ה-veil בסיור של 98 כבר לא קיים.
- **פלט ה-Check (מילה במילה; השורה כפי שהיא בכרטיס, 08:23–08:24 שעון המכונה, exit 0):**
```
build_segments rainbow (dry-run) -> C:\RnD\Projects\Habait\habait-walkaround\Habait\platform\_local\segments\rainbow
ffmpeg: ffmpeg (8.0.1-full_build-www.gyan.dev)   size 2048x1024, 24 fps, h264 crf 20
  approach     video  source frames 192/192 2048x1024 habait-walkaround/Habait/flyover/equirect/_local/segments/approach/frames -> approach.mp4 192 fr 8.00 s; -> orbit dpos 0.04 m dyaw 0.007 deg (clay->clay, cut)
  orbit        video  source frames 408/408 2048x1024 habait-walkaround/Habait/flyover/equirect/_local/segments/orbit/frames -> orbit.mp4 408 fr 17.00 s; -> hold-facade dpos 0.001 m dyaw 0 deg (clay->clay, cut)
  hold-facade  video  source frames 72/72 2048x1024 habait-walkaround/Habait/flyover/equirect/_local/segments/hold-facade/frames -> hold-facade.mp4 72 fr 3.00 s; LOOP (hold), pills from card 19 per frame, 9 units with visible >= 0.25 at frame 1; -> descend-846 dpos 0.014 m dyaw 0 deg (clay->clay, cut)
  descend-846  video  source frames 120/120 2048x1024 habait-walkaround/Habait/flyover/equirect/_local/segments/descend-846/frames -> descend-846.mp4 120 fr 5.00 s; -> enter-846 dpos 0.002 m dyaw 0 deg (clay->projected, blend)
  enter-846    video  source frames 96/96 1024x512 (scaled to 2048x1024) habait-walkaround/Habait/flyover/equirect/_local/segments/enter-846/frames -> enter-846.mp4 96 fr 4.00 s; head blend 18 fr from descend-846; lock 12 fr onto 04-living.webp; handoff room=living bearing 111.3 (camera 111.3) tour yaw offset 0
5 segments (approach, orbit, hold-facade, descend-846, enter-846); caption v1 ai-visualization-v1 (DRAFT v1 (2026-11-02)), plan date 15.10.2025; initial view yaw 0 pitch -21.81 (approach frame 1 view_hint)
note: project.json disclaimer differs from caption-v1 short_project (filled): the unit card shows project.json, the flight shows caption-v1
flow.real.json (fixtures/rainbow/flow.real.json) would be written: flow.v0 valid, cross-check 0 error(s), 23 warning(s)
ok   flow.real.json + segments.json exist (tools/build_segments.mjs --project rainbow ran)  (5 segments, built 2026-11-03T06:09:42.540Z)
ok   flow.real.json is a valid flow.v0 chain and cross-checks with units.json (every src on disk)  (approach > orbit > hold-facade > descend-846 > enter-846; hold = video loop; 23 warnings (units.json placeholder hotspot windows))
ok   every segment names its source (real frames or the documented fallback)  (approach=frames(192), orbit=frames(408), hold-facade=frames(72), descend-846=frames(120), enter-846=frames(96))
ok   caption in segments.json = caption-v1.json short_project / micro / short, project + plan date filled  (ai-visualization-v1, DRAFT v1 (2026-11-02))
ok   yaw continuity in the data: every junction that shares a pose has dpos <= 0.05 m and dyaw <= 0.05 deg; the gap is a dissolve  (approach->orbit 0.04 m 0.007 deg seam 0.92; orbit->hold-facade 0.001 m 0 deg seam 0.79; hold-facade->descend-846 0.014 m 0 deg seam 0.71; descend-846->enter-846 0.002 m 0 deg seam 0.61)
ok   blends only where they belong: none across a same-look cut (clay -> clay), one across each look change  (approach->orbit clay->clay cut; orbit->hold-facade clay->clay cut; hold-facade->descend-846 clay->clay cut; descend-846->enter-846 clay->projected blend)
ok   seams on the decoded videos: the frame shown before a cut = the first frame after it (MAE <= 6/255 at 512x256)  (0.92 / 0.79 / 0.71 / 0.61)
ok   hand-off data: enter ends on the living panorama at bearing 111.3 = its centreBearingDeg (tour yaw offset 0, shift 0)  (last frame vs 04-living.webp: MAE 2.3/255, shift 0 deg)
ok   [iphone13] real flight loads: no start modal, frame 1 of approach up, approach plays (shot 1)  (approach: band + short_project)
ok   [iphone13] approach -> orbit, cut frame to frame; the orbit after its opening caption shows the band only (shot 2)  (orbit: band)
ok   [iphone13] hold: the 72-frame clay loop at node-b, 9 unit pills from card 19 (visible >= 0.25), 846 among them (shot 3)  (hold: band + short_project, pills 826 835 836 845 846 855 856 866 876, loop playing (t 1.58 -> 1.99))
ok   [iphone13] tap 846 (a real click: Playwright refuses an obscured pill) -> the unit card; the caption band stays visible (shot 4)  (card: band, loop paused under the card at t 2.80)
ok   [iphone13] continue -> descend-846 starts on the hold frame, the video texture moves (shot 5)  (descend: band + short_project, left the hold at rest (t 3.00; settle from 2.80), differs from the hold by 35.2/255)
ok   [iphone13] enter-846 with the unit caption (short, 846) in its first 3 s (shot 6)  (enter: band + short)
ok   [iphone13] enter's last frame stays up at the hand-off, pitch/fov eased to the tour's (shot 7)  (enter-last: band, pitch -2.0 fov 86.4)
ok   [iphone13] hand-off: the tour opens in place on living at the buyer's yaw, no card, no spinner (shot 8)  (tour: band; living at tour yaw 0.0 (asked 0), bearing 111.3; seam NCC 0.838 vs 0.225 shifted 12%; raw MAE 25.0/255, tour brightness x0.99 (the tour's UI veil))
ok   [iphone13] continuity in the player: no cut moves the view (yaw at each segment start = yaw when its first frame shows); nothing modal, no spinner, ever  (yaw at each cut: approach 0.0, orbit 0.0, hold-facade 0.0, descend-846 -5.9, enter-846 0.0, hold framing yaw 0.0->-5.9 pitch -21.8->-11.4 fov 75->40.8, descend framing yaw -5.9->0.0 pitch -11.4->kept fov 41->75.0; swaps approach > orbit > hold-facade > descend-846 > enter-846)
ok   [iphone13] zero requests outside 127.0.0.1; no page errors
ok   [pixel7] real flight loads: no start modal, frame 1 of approach up, approach plays (shot 1)  (approach: band + short_project)
ok   [pixel7] approach -> orbit, cut frame to frame; the orbit after its opening caption shows the band only (shot 2)  (orbit: band)
ok   [pixel7] hold: the 72-frame clay loop at node-b, 9 unit pills from card 19 (visible >= 0.25), 846 among them (shot 3)  (hold: band + short_project, pills 826 835 836 845 846 855 856 866 876, loop playing (t 1.67 -> 2.09))
ok   [pixel7] tap 846 (a real click: Playwright refuses an obscured pill) -> the unit card; the caption band stays visible (shot 4)  (card: band, loop paused under the card at t 2.93)
ok   [pixel7] continue -> descend-846 starts on the hold frame, the video texture moves (shot 5)  (descend: band + short_project, left the hold at rest (t 3.00; settle from 2.93), differs from the hold by 31.5/255)
ok   [pixel7] enter-846 with the unit caption (short, 846) in its first 3 s (shot 6)  (enter: band + short)
ok   [pixel7] enter's last frame stays up at the hand-off, pitch/fov eased to the tour's (shot 7)  (enter-last: band, pitch -2.0 fov 97.2)
ok   [pixel7] hand-off: the tour opens in place on living at the buyer's yaw, no card, no spinner (shot 8)  (tour: band; living at tour yaw 0.0 (asked 0), bearing 111.3; seam NCC 0.890 vs 0.378 shifted 12%; raw MAE 19.4/255, tour brightness x0.99 (the tour's UI veil))
ok   [pixel7] continuity in the player: no cut moves the view (yaw at each segment start = yaw when its first frame shows); nothing modal, no spinner, ever  (yaw at each cut: approach 0.0, orbit 0.0, hold-facade 0.0, descend-846 -5.9, enter-846 0.0, hold framing yaw 0.0->-5.9 pitch -21.8->-11.4 fov 75->52.0, descend framing yaw -5.9->0.0 pitch -11.4->kept fov 52->75.0; swaps approach > orbit > hold-facade > descend-846 > enter-846)
ok   [pixel7] zero requests outside 127.0.0.1; no page errors
ok   [desktop] real flight loads: no start modal, frame 1 of approach up, approach plays (shot 1)  (approach: band + short_project)
ok   [desktop] approach -> orbit, cut frame to frame; the orbit after its opening caption shows the band only (shot 2)  (orbit: band)
ok   [desktop] hold: the 72-frame clay loop at node-b, 9 unit pills from card 19 (visible >= 0.25), 846 among them (shot 3)  (hold: band + short_project, pills 826 835 836 845 846 855 856 866 876, loop playing (t 1.66 -> 2.06))
ok   [desktop] tap 846 (a real click: Playwright refuses an obscured pill) -> the unit card; the caption band stays visible (shot 4)  (card: band, loop paused under the card at t 2.97)
ok   [desktop] continue -> descend-846 starts on the hold frame, the video texture moves (shot 5)  (descend: band + short_project, left the hold at rest (t 2.97), differs from the hold by 36.5/255, dragged to yaw 30.0)
ok   [desktop] enter-846 with the unit caption (short, 846) in its first 3 s (shot 6)  (enter: band + short)
ok   [desktop] enter's last frame stays up at the hand-off, pitch/fov eased to the tour's (shot 7)  (enter-last: band, pitch -2.0 fov 85.0)
ok   [desktop] hand-off: the tour opens in place on living at the buyer's yaw, no card, no spinner (shot 8)  (tour: band; living at tour yaw 30.0 (asked 30), bearing 141.3; seam NCC 0.972 vs 0.196 shifted 12%; raw MAE 12.9/255, tour brightness x0.99 (the tour's UI veil))
ok   [desktop] continuity in the player: no cut moves the view (yaw at each segment start = yaw when its first frame shows); nothing modal, no spinner, ever  (yaw at each cut: approach 0.0, orbit 0.0, hold-facade 0.0, descend-846 -5.9, enter-846 30.0, hold framing yaw 0.0->-5.9 pitch -21.8->-11.4 fov 75->49.5, descend framing yaw -5.9->0.0 pitch -11.4->kept fov 50->75.0; swaps approach > orbit > hold-facade > descend-846 > enter-846)
ok   [desktop] zero requests outside 127.0.0.1; no page errors

shots: C:\RnD\Projects\Habait\habait-walkaround\Habait\platform\test\shots\flow-real
flow real: 38/38 ok, caption on 24/24 shots, handoff yaw 111.3 (bearing; tour room=living yaw 0.0 on iPhone 13, seam NCC 0.838, desktop after a drag: tour yaw 30.0 = bearing 141.3)

> habait-platform@0.1.0 test
> node contracts/validate.mjs fixtures/rainbow && node test/smoke.mjs

warn  unit "845" uses the placeholder descend "descend-846"
warn  unit "847" uses the placeholder descend "descend-846"
warn  unit "856" uses the placeholder descend "descend-846"
warn  unit "855" uses the placeholder descend "descend-846"
warn  unit "857" uses the placeholder descend "descend-846"
warn  unit "836" uses the placeholder descend "descend-846"
warn  unit "835" uses the placeholder descend "descend-846"
warn  unit "837" uses the placeholder descend "descend-846"
warn  unit "866" uses the placeholder descend "descend-846"
warn  unit "826" uses the placeholder descend "descend-846"
warn  unit "876" uses the placeholder descend "descend-846"
fixtures/rainbow: OK - 12 units, 5 segments, 11 warning(s)
ok   fixture rainbow validates
ok   schema rejects a bad status / missing field / unknown next
ok   cross-check catches a dangling reference
ok   lead: WhatsApp link pattern
[lead] no webhook configured; lead = {
  unit: '846',
  units_viewed: [],
  src: 'direct',
  session_id: 'dfe9ff0b-7cec-4548-9b41-7e37934eecf6',
  ts: '2026-11-03T06:24:49.594Z'
}
ok   lead: submit with no webhook is a stub; with webhook POSTs JSON
ok   analytics: capture without a key logs and buffers
ok   picker: module loads in node and exports createPicker
ok   server: index, flow, three.js module, json
ok   server: CORS * on .js/.css/.json (habait-89 imports js/picker.js from another origin)
ok   server: Range -> 206 with Content-Range
ok   server: 404 and traversal
ok   server: events sink mounted (card 24): announced, Origin required, empty batch writes nothing

all green
```
  (exit code של כל השורה: 0, הודפס אחריה ב-`echo "CHECK EXIT $?"`.)
- **`node test/card-overflow.test.mjs`** (08:16 ושוב 08:20 שעון המכונה, exit 0 בשתיהן): `card overflow: 18/18 ok (iPhone 13, Pixel 7, desktop x he, en)`. לפני תיקון ההשהיה מתחת לכרטיס והפילולות רק אחרי הפריים הראשון: 9/12.
- **`node test/browser.mjs`** (מול שרת זמני 8857, 08:22 שעון המכונה, exit 0): 25 ok, `all green; screenshots in C:\RnD\Projects\Habait\habait-walkaround\Habait\platform\test\shots`.
- **`npm test`:** all green (בתוך פלט ה-Check).
- **כסף:** $0.
- **פגמים פתוחים:**
  1. ה-hold עכשיו clay ולא ה-skin של GPT. כל החוץ אחיד (approach/orbit/hold/descend clay AgX), אבל הריאליזם בעצירה, המקום שבו הרוכש נשאר הכי הרבה זמן, ירד. הצעד הבא לריאליזם הוא pass מולבש לכל הטיסה, לא החזרת ה-skin ל-hold לבד.
  2. שינוי מראה אחד נשאר: במרפסת, clay→הקרנת פנים (blend של 0.75 ש').
  3. טיוטת enter: 1024×512, 16 spp, מוגדלת פי 2, עם מריחות באמצע. ה-final עוד לא קיים.
  4. "המשיכו" יכול לחכות עד 0.75 ש' לנחיתה על פוזת המנוחה (הלולאה ב-2×). פילולות ה-hold זזות בצעדים של עד 2 px עם הלולאה.
  5. ה-framing ב-hold מסובב ~6° בהגעה (כמו קודם).
  6. דירות שאינן 846 טסות את הירידה של 846.
  7. 31 MB ב-`_local` לא נכללים ב-stage_flow.py של Vercel. ה-orbit (13.5 MB) נטען מתחילת ה-approach; ברשת איטית הוא עלול לא להיות מוכן ב-8 ש', ואז מוקפא הפריים האחרון של ה-approach (בכוונה, בלי ספינר). לא נמדד ברשת מואטת.
  8. השם העברי ב-disclaimer של project.json (כמו קודם).
  9. נבדק ב-headless SwiftShader בלבד.
- **קורא שני:** habait-ba (=habait-98): (1) ב-flow של הפלטפורמה ה-hold הוא עכשיו לולאת ה-clay של Kaggle ולא node-b skin. אם ה-hold של :8899/Vercel נשאר על ה-skin, שני המסלולים נראים שונה בעצירה. (2) בסיור נמדדה בהירות ×0.99 בנחיתה (ה-veil שדווח ב-06:27 כבר לא נראה, תודה). (3) picker.js לא שונה.
- **לזיכרון:** כרטיס 34, עדכון (3.11 08:26 שעון המכונה): 5 קטעים approach→orbit→hold→descend-846→enter-846; ה-hold = לולאת clay אמיתית (72 פריימים), חיתוכי clay בלי blend (תפרים ≤0.92/255); הלולאה נעצרת מתחת לכרטיס ונוחתת על פוזת המנוחה לפני הירידה. Check exit 0, 38/38, $0.
- **המשך (2026-11-03 09:05 שעון המכונה, בקשת 1d אחרי M1 v3 PASS): `test/card-overflow.test.mjs` דטרמיניסטי.** הכניסה של הכרטיס היא CSS animation (`sheet-in`, 0.25 ש'), לא transition, ולכן `transitionend` לא מתאים. ההמתנות הקבועות (350/300 ms) לפני שתי המדידות הוחלפו ב-`settle(page)`: מחכה שכל ה-animations הסופיות של `#unitSheet` ו-`#legalBand` יסתיימו (`getAnimations().finished`, שומר 3 ש'), ואז ששתי התיבות זהות 3 פריימים ברצף (שומר 5 ש', אחרת השלב נכשל עם המספרים). כל ה-assertions נשארו כמו שהם; קבצי מוצר לא שונו.
- **שלוש ריצות ברצף (09:00:03 / 09:00:40 / 09:01:14 שעון המכונה), exit 0 בכולן, 0 FAIL:** `card overflow: 18/18 ok (iPhone 13, Pixel 7, desktop x he, en)` ×3.
- **ריצה רביעית תחת עומס** (במקביל ל-`flow-real.test.mjs` המלא, SwiftShader, 09:02 שעון המכונה): `card overflow: 18/18 ok (iPhone 13, Pixel 7, desktop x he, en)`, ובאותו זמן `flow real: 38/38 ok, caption on 24/24 shots, handoff yaw 111.3`.
- **`npm test`** (09:04 שעון המכונה): `all green`, exit 0. $0; אין git, אין Blender, אין קריאה בתשלום; שרתים משלו על פורטים חופשיים (POST /api/events → 204).
