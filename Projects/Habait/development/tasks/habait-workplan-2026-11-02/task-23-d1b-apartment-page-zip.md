# משימה 23: D1ב: דף מכירה לדירה (סיור / תכנית / תמונות / 3D / אודות, כרטיס סוכן, WhatsApp עם פרויקט+דירה+session) + ZIP להורדה

| שדה | ערך |
|---|---|
| **לוח** | `habait-workplan-2026-11-02` |
| **ערוץ** | D |
| **מקור בתכנית** | חלק ג §2 ערוץ D, שלב D1ב; חלק ב §1, §3 פריטים 3–4 ב-`C:\RnD\Projects\Habait\research\product-research-2026-11-02\HABAIT-RESEARCH-2026-11-02.md` |
| **סוכן** | `platform-dev` (`status: live`, `owner-track: habait`, `model: opus`) |
| **Ruling tier** | **T0** |
| **גל (wave)** | 1 |
| **מצב** | TODO |
| **זיכרון** | `memory/agents/` לא קיים בפרויקט הזה; הזיכרון של הסוכן הוא בלוק `## תוצאה` כאן (ראו rails). הסוכן הוא יכולת קבועה (לא one-off persona). |

## מטרה

דף דירה ש-איש מכירות שולח בוואטסאפ בלי Claude: לשוניות סיור (iframe/קישור ל-dist של 846) / תכנית (PNG) / תמונות (crops מהפנורמות) / 3D (10) / אודות; כרטיס סוכן עם `wa.me/<מספר>?text=<פרויקט>|<דירה>|<session_id>`, טלפון, מייל; כפתור ZIP: פנורמות balanced, סטילס, תכנית, GLB + HTML עצמאי (model-viewer עם GLB base64), README עם הדיסקליימר. white-label מ-`project.json`.

## תלויות

- W1-D0/D1 של habait-ab (`Habait/platform/`: contracts, fixtures, flow.html); 09 (GLB, כשמגיע; עד אז placeholder)
- כיתוב משפטי: `C:\RnD\Projects\Habait\data\sales-plans\legal\disclaimer-he-en.md` (W1-E3)

## קלטים (קריאה)

- `Habait/platform/{flow.html,js/*,css/style.css,fixtures/rainbow/*}` (של ערוץ D; ab סיים את השלד)
- `Habait/tour360/apartments/apt846/dist/` (הסיור; קריאה)
- חלק ב §1 (מה היה ב-ZIP של residence: 14.3 MB)

## קבצים (הסוכן כותב רק כאן)

- `Habait/platform/apartment.html`, `Habait/platform/js/apartment.js`, `Habait/platform/js/zip.js` (JSZip נעוץ מקומית)
- `Habait/platform/build_zip.mjs` (בנייה בצד שרת/CLI של ה-ZIP לכל דירה)
- `Habait/platform/_local/dist/rainbow/846/{index.html,846.zip}`
- `Habait/platform/test/apartment.test.mjs`

## צעדים

1. דף עם 5 לשוניות, RTL, i18n he/en (יש `js/i18n.js`), לוגו/צבע מ-project.json, הכיתוב המשפטי בפוטר של כל לשונית.
2. WhatsApp: הודעה מוכנה בעברית עם פרויקט/דירה/session_id (מ-`js/analytics.js`).
3. build_zip.mjs: אוסף נכסים → ZIP ≤ 25 MB; HTML עצמאי עם GLB base64; README-he.
4. Playwright: iPhone/Pixel/desktop: כל לשונית נטענת, הקישור ל-wa.me נכון, ה-ZIP נפתח ומכיל את הקבצים.

## קריטריוני קבלה

- [ ] הדף עובד ב-3 viewports; אין בקשות לדומיינים חיצוניים (חוץ מ-wa.me בלחיצה).
- [ ] ZIP ≤ 25 MB עם כל הרכיבים; ה-HTML העצמאי נפתח offline ומציג את ה-GLB.
- [ ] הכיתוב המשפטי בכל לשונית; הטסט עובר.

## Gate

**Check:**
```bash
cd C:/RnD/Projects/Habait/habait-walkaround/Habait/platform && export HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps && timeout 300 node build_zip.mjs fixtures/rainbow 846 --out _local/dist/rainbow/846 && timeout 300 node test/apartment.test.mjs
# צפוי: "zip: N files, X MB (<=25)", "tabs 5/5 ok on 3 viewports", "wa.me link contains rainbow|846|", exit 0
```

**Reviewer scope:** שלמות ה-ZIP והכיתוב המשפטי בלבד.

הבודק (אם נדרש) הוא `qa-reviewer` בהקשר נקי, לא הסשן שביצע.

## כסף

$0

## דרגת הכרעה

**T0:** הסוכן מכריע ורושם את ההכרעה בבלוק התוצאה. אין שאלה לאלירן.

---

## Standing rails (זהה בכל כרטיס; המקור: `docs/agent-team-org-chart.md` §3, שהוא גם החוזה שבכל הגדרת סוכן)

1. **קריאה תחומה קודם:** `C:\RnD\Projects\Habait\CLAUDE.md`, אחר כך `C:\RnD\Projects\Habait\SESSIONS.md` (כולו), אחר כך `C:\RnD\Projects\Habait\memory.md` סעיפים 1, 4, 6, 7 (את השאר grep לפי מילת מפתח). אחר כך הכרטיס הזה, ה-`README.md` של הלוח (Standing rails, Key state, הכרעות פתוחות), ואם הכרטיס מציין פרויקט: ה-`project.json` / `plan.json` שלו.
2. **כותבים אחרון, פעם אחת:** הסוכן לא עורך `memory.md` ולא `SESSIONS.md`. הכתיבה היחידה שלו לזיכרון היא בלוק `## תוצאה` בסוף הכרטיס הזה (מה נעשה, קבצים, פלט ה-Check מילה במילה, כסף ו-ledger, פגמים פתוחים, שורת `לזיכרון:` ≤ 400 תווים). הסשן שהפעיל אותו מעתיק את השורה ל-`memory.md` בעריכה נקודתית.
3. **קורא שני:** באותו בלוק: איזה סשן אחר (habait-16 / habait-89 / habait-ab / סשן ערוץ) חייב לדעת את זה ולמה זה מחייב אותו, או "אין". אותה שורה נוספת תחת "העברות" ב-README של הלוח; הסשן המפעיל שולח אותה ב-`SendMessage`.
4. **פעולה לא נגמרה עד שהזיכרון שלה נכתב.** הכרטיס DONE רק כשיש בלוק תוצאה **וגם** `memory.md` עודכן **וגם** סומן "זיכרון נכתב" ב-Key state של הלוח.
5. **דרגת הכרעה (ruling tier):** כל כרטיס נושא T0 / T1 / T2 משלו (למטה). T0: הסוכן מכריע ורושם. T1: שאלה אחת לאלירן, עם אפשרויות וברירת מחדל, וממשיכים בכל מה שלא תלוי בה. T2: השאלה + בדיקה עצמאית של `qa-reviewer` בהקשר נקי שמנסה להפריך. מעלים דרגה באמצע משימה ורושמים; לא מורידים בשקט.

**הערת התאמה:** זה הנוסח של Habait לכללי `plan-to-tasks` שלבים 8–9. העץ `memory/` של המעבדה (HOT.md, INDEX.md, `_TEMPLATE.md`) לא קיים כאן; תפקידו ממולא על ידי `memory.md` + `SESSIONS.md` + בלוק התוצאה בכרטיס.

---

## תוצאה

_(platform-dev, 2026-11-02 ~12:35–13:10 שעון המכונה; הופעל על ידי habait-4b)_

- **מצב:** DONE (סוכן). הכרטיס נסגר סופית רק אחרי ש-4b מעדכן את `memory.md` ומסמן "זיכרון נכתב".
- **מה נעשה:**
  - **דף הדירה** `apartment.html?project=rainbow&unit=846[&sid=&lang=en&tab=plan&return=<url>]`: חמש לשוניות (סיור 360° / תכנית / תמונות / תלת-ממד / אודות), RTL קודם ו-EN בכפתור, צבע/לוגו/שם מ-`project.json`. **הכרעת 12:05 של אלירן:** הלשוניות הן הסטריפ של שכבת הדירה בלבד; הסיור נטען ב-iframe עם `scope=apartment` (רק 11 חדרי הדירה); כפתור **"חזרה לבניין"** בכותרת מוביל לרמת הפרויקט: `exterior.url` + `exterior.params` + `project` + `room=tower` (נוד ה-hold של הסיור, הבניין עם הדירות הקליקביליות, בלי לנגן שוב את הסיבוב).
  - **כרטיס סוכן + לידים:** WhatsApp `wa.me/972500000000?text=<הודעה בעברית>\nrainbow|846|<session_id>` (session מ-`analytics.js`; `?sid=` מהטיסה נשמר ועובר גם ל-WhatsApp וגם לסיור), טלפון (`tel:`), מייל (מוצג רק כשיש). בטלפון סרגל WhatsApp/התקשרו קבוע בתחתית. אירועים: `unit_enter` בפתיחה, `room_view {tab}` בכל לשונית, `lead_click {channel: whatsapp|phone|email|zip}`.
  - **הכיתוב המשפטי:** אין עדיין JSON, אז הבונה קורא את `C:\RnD\Projects\Habait\data\sales-plans\legal\disclaimer-he-en.md` (§1 קצר, §2 מלא, he+en) וממלא משתנים: {PROJECT}=Rainbow תל אביב, {UNIT}=846, {PLAN_DATE}=15.10.2025 ו-{ARCHITECT}=DBLK Architects מ-`plan.general.json`/`apartment.json`, {DEVELOPER}="השם מוסתר עד אישור", {GEN_DATE}, {VERSION}. הגרסה הקצרה מופיעה בתחתית כל לשונית ושרופה בשולי כל תמונה ובתחתית התכנית (העברית ב-RLE כדי ש-librsvg ישמור על הסדר). הגרסה המלאה מופיעה ב"אודות", בפוטר (נפתח בלחיצה), ב-README וב-dollhouse.html. ה-EXIF של הסטילס כולל גילוי AI. הסטטוס "DRAFT v0, ממתין לעו״ד" מוצג ב"אודות".
  - **`tools/build_zip.mjs`** (לפי עדכון הגבולות של ab: תחת `tools/`, לא בשורש): פנורמות balanced של 11 החדרים (בלי נודי החוץ); 11 סטילס 1600×1000 בהקרנה ישרה מה-master של 3840 כשיש (זווית = הכי הרבה פרטים, עם העדפה קלה למרכז); תכנית PNG; GLB; `dollhouse.html` עצמאי: three 0.170 + GLTFLoader/OrbitControls/DRACOLoader + הוויואר כ-modules מסוג data:, ה-GLB וה-decoder של Draco ב-base64. הקובץ נפתח offline מ-file:// ובלי שום בקשת רשת. בנוסף README-he-en.txt, unit.json, דף dist עצמאי ו-`846.zip`. הבנייה נכשלת אם ה-ZIP עובר 25 MB.
  - **GLB:** הבונה לוקח אוטומטית את `Habait/engine/_local/apt846/dollhouse/apt846.glb` כשהקובץ קיים. **הוא הגיע באמצע הריצה (12:43) ונלקח** ("glb card-09"). הוא דחוס ב-Draco, אז ה-decoder של Draco הוטמע בקובץ. אם הקובץ חסר, הבונה מייצר placeholder: קירות ורצפות שמוקמו (extrude) מ-`plan.general.json`, עם התווית "מודל זמני" (נבדק, 101 KB).
  - **JSZip 3.10.2 נעוץ מקומית** (`js/vendor/jszip-3.10.2.min.js`, ה-integrity תואם ל-npm, MIT). הוא משמש את הבונה, את הטסט ואת הדף: כשאין חבילה בנויה, הכפתור בונה ZIP קטן (README + פרטים) בדפדפן. נבדק על דירה 857.
  - **הכרעות T0:** (1) הוויואר של ה-3D הוא three.js 0.170.0, שכבר נעוץ בפלטפורמה, ולא model-viewer. התוצאה זהה (GLB עם orbit), בלי תלות חדשה, ועם Draco. (2) לשונית התלת-ממד בדף היא iframe של אותו `dollhouse.html` שב-ZIP, כך שיש קוד אחד שנבדק offline. (3) הורדת ZIP נספרת כ-`lead_click {channel:'zip'}`, כי `EVENTS` של analytics.js לא בבעלותי. (4) הסיור בדף הדירה נפתח בסלון (`tour_url` של הדירה). המסירה מהטיסה נשארת במרפסת.
- **קבצים שנכתבו** (כולם חדשים; לא נגעתי ב-index/flow/style.css/i18n.js/fixtures/units.json):
  - `Habait/platform/apartment.html`
  - `Habait/platform/js/apartment.js`, `Habait/platform/js/apartment-3d.js`, `Habait/platform/js/zip.js`, `Habait/platform/js/vendor/jszip-3.10.2.min.js`
  - `Habait/platform/css/apartment.css`
  - `Habait/platform/tools/build_zip.mjs`
  - `Habait/platform/test/apartment.test.mjs`
  - `Habait/platform/_local/dist/rainbow/846/**`: index.html, apartment.json, 846.zip (4.48 MB, 27 קבצים), media/, assets/
- **Check מעודכן** (הבונה עבר ל-`tools/`):
```bash
cd C:/RnD/Projects/Habait/habait-walkaround/Habait/platform && export HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps && timeout 300 node tools/build_zip.mjs fixtures/rainbow 846 --out _local/dist/rainbow/846 && timeout 300 node test/apartment.test.mjs
```
- **פלט ה-Check (מילה במילה):**
```
panos 11, stills 11, plan yes, glb card-09 (173 KB)
zip: 27 files, 4.48 MB (<=25) -> C:/RnD/Projects/Habait/habait-walkaround/Habait/platform/_local/dist/rainbow/846/846.zip
page: C:/RnD/Projects/Habait/habait-walkaround/Habait/platform/_local/dist/rainbow/846/index.html  (8.1 s)
ok   zip: <= 25 MB with panos, stills, plan, GLB, offline HTML, README  (zip: 27 files, 4.48 MB (<=25))
zip: 27 files, 4.48 MB (<=25)
ok   zip: README carries the full legal text (he + en), variables filled, plan date
ok   iphone: Hebrew RTL, title, price, status, white-label colour
ok   iphone: tab tour
ok   iphone: tab plan
ok   iphone: tab photos
ok   iphone: tab 3d
ok   iphone: tab about
ok   iphone: WhatsApp link = wa.me/<number>?text=<he message>\nrainbow|846|<session>
ok   iphone: "חזרה לבניין" goes to the project level (hold node), not inside the apartment strip
ok   iphone: no requests outside 127.0.0.1 before any tap on WhatsApp  (23 requests, all local)
ok   iphone: no page errors
ok   pixel: Hebrew RTL, title, price, status, white-label colour
ok   pixel: tab tour
ok   pixel: tab plan
ok   pixel: tab photos
ok   pixel: tab 3d
ok   pixel: tab about
ok   pixel: WhatsApp link = wa.me/<number>?text=<he message>\nrainbow|846|<session>
ok   pixel: "חזרה לבניין" goes to the project level (hold node), not inside the apartment strip
ok   pixel: no requests outside 127.0.0.1 before any tap on WhatsApp  (23 requests, all local)
ok   pixel: no page errors
ok   desktop: Hebrew RTL, title, price, status, white-label colour
ok   desktop: tab tour
ok   desktop: tab plan
ok   desktop: tab photos
ok   desktop: tab 3d
ok   desktop: tab about
ok   desktop: WhatsApp link = wa.me/<number>?text=<he message>\nrainbow|846|<session>
ok   desktop: "חזרה לבניין" goes to the project level (hold node), not inside the apartment strip
ok   desktop: no requests outside 127.0.0.1 before any tap on WhatsApp  (23 requests, all local)
ok   desktop: English LTR toggle re-renders tabs and caption
ok   desktop: tapping WhatsApp is the only way out (wa.me, new tab)
ok   desktop: no page errors
tabs 5/5 ok on 3 viewports
wa.me link contains rainbow|846|b20234d2-cc1b-4405-aa7c-76fabcfd0e07
ok   dist page (self-contained build): opens on #photos, carries the flight sid into WhatsApp and the tour
ok   zip: 3d/dollhouse.html opens offline from file:// and shows the GLB  (28820 triangles, 67 meshes, 310 colours, 0 network requests)

all green; screenshots in C:\Users\elira\AppData\Local\Temp\habait-apartment-shots
EXIT=0
```
- **שום דבר לא נשבר:** `npm test` לפני ואחרי: 9/9 all green. `node test/browser.mjs` לפני ואחרי: 13/13 all green. ריצה אחת באמצע החזירה 7 כשלים, בזמן ש-ab ערך את `css/style.css` ו-`js/i18n.js` (12:54). הריצה שאחריה ירוקה. גם כשל flaky אחד בטסט שלי (לחיצה מיד אחרי סגירת popup) תוקן בשינוי סדר הצעדים.
- **כסף:** $0. אין קריאות בתשלום ואין ledger. רשת: רק `npm pack jszip@3.10.2` מה-registry.
- **פגמים פתוחים:**
  1. ב-`dist/apt846/index.html` של הסיור, הקישור `#t-return` ("חזרה לבניין") בלי `target="_top"`. כשהסיור רץ בתוך ה-iframe של דף הדירה, הלחיצה טוענת את הבניין בתוך ה-iframe ולא בדף. התיקון ב-`build-tour` (של habait-98, לשעבר 16): `target="_top"` כש-`window.self !== window.top`.
  2. בכרטיס הסוכן אין שם, מייל או תמונה אמיתיים, כי ל-`project.json` אין שדה כזה. הדף קורא שדה אופציונלי `leads.agent {name{he,en}, role, phone, email, whatsapp}` אם ab יוסיף אותו. עד אז יוצג "צוות המכירות" + המספר של WhatsApp.
  3. `analytics.js` עדיין רק כותב ל-console. sink מקומי של JSONL (לפי הכלל עד שיהיו מפתחות PostHog) עוד לא קיים, וזה בבעלות ab.
  4. הכיתוב המשפטי הוא DRAFT v0 עד חוות דעת עו״ד. ה-sha256 ב-README הוא של חיתוך התכנית (`plan_meta.source_sha256`), לא של ה-PDF עצמו.
  5. הסטילס נחתכים אוטומטית, זווית אחת לחדר. בחדר "כניסה" רואים בעיקר את הסלון. בחירת זווית ידנית או LLM לכל חדר תשפר.
  6. בדף ה-dist הסיור עדיין מצביע ל-`127.0.0.1:8848` (`tour_url` של הפיקסטורה). בפרסום אמיתי צריך URL ציבורי של הסיור.
- **קורא שני:**
  - **habait-ab** (בעלים של `Habait/platform`): את הקישור מכרטיס הדירה לדף הזה מוסיף ab, בצורה `apartment.html?project=<id>&unit=<id>&sid=<session>&from=flight`. הבנייה ל-dist: `node tools/build_zip.mjs fixtures/<p> <unit> --out _local/dist/<p>/<unit>`, והדף החי קורא את `_local/dist/<p>/<unit>/apartment.json`. שדה אופציונלי `leads.agent`. כדאי להוסיף ל-`EVENTS` את `apartment_tab` ו-`zip_download`. מזהי הפיקסטורה rainbow/846 לא תואמים ל-engine (rainbow-tlv/apt846).
  - **habait-98** (מחזיק את tour360 ואת ה-GLB של 09): צריך `target="_top"` על `#t-return` כשהסיור מוטמע ב-iframe. כל GLB חדש ב-`Habait/engine/_local/apt846/dollhouse/apt846.glb` (Draco בסדר) נכנס לדף ול-ZIP בבנייה הבאה, בלי שינוי קוד.
- **לזיכרון:** D1ב חי: `Habait/platform/apartment.html?project=rainbow&unit=846`. חמש לשוניות (סיור scope=apartment, תכנית, תמונות, 3D, אודות), כפתור "חזרה לבניין" אל room=tower, WhatsApp עם rainbow|846|sid. `tools/build_zip.mjs` בונה את `_local/dist/rainbow/846` + ZIP של 4.5 MB עם `dollhouse.html` שנפתח offline (three + Draco מוטמעים) ולוקח את ה-GLB של 09 אוטומטית. הכיתוב המשפטי בכל לשונית ושרוף בסטילס. $0.
