# משימה 25: D3: דף נחיתה לפרויקט עם/בלי הסיור (50/50 לפי קישור), אותו טופס, דוח שבועי אוטומטי

| שדה | ערך |
|---|---|
| **לוח** | `habait-workplan-2026-11-02` |
| **ערוץ** | D |
| **מקור בתכנית** | חלק ג §2 ערוץ D, שלב D3; חלק א §6 פריט 2 ב-`C:\RnD\Projects\Habait\research\product-research-2026-11-02\HABAIT-RESEARCH-2026-11-02.md` |
| **סוכן** | `platform-dev` (`status: live`, `owner-track: habait`, `model: opus`) |
| **Ruling tier** | **T0** |
| **גל (wave)** | 4 |
| **מצב** | TODO |
| **זיכרון** | `memory/agents/` לא קיים בפרויקט הזה; הזיכרון של הסוכן הוא בלוק `## תוצאה` כאן (ראו rails). הסוכן הוא יכולת קבועה (לא one-off persona). |

## מטרה

שני וריאנטים של דף נחיתה לפרויקט: A = הדמיות סטטיות + טופס; B = הסיור (טיסה → דירה) + אותו טופס; הקצאה 50/50 לפי `?v=` או hash של session; כל אירוע מתויג variant; סקריפט דוח שבועי (JSONL/PostHog → Markdown בעברית: ביקור→ליד, ליד→פגישה לכל וריאנט).

## תלויות

- 24 (אירועים + לידים)

## קלטים (קריאה)

- 24
- `Habait/platform/flow.html` (וריאנט B משתמש בו)
- חלק א §6 פריט 5 (סף הוכחה: ~1,000 ביקורים/חודש, 6–8 שבועות)

## קבצים (הסוכן כותב רק כאן)

- `Habait/platform/landing.html`, `Habait/platform/js/landing.js`
- `Habait/platform/report_weekly.mjs`
- `Habait/platform/test/landing.test.mjs`
- `Habait/platform/_local/reports/weekly-<date>.md`

## צעדים

1. הקצאה דטרמיניסטית (hash של session_id → A/B) עם override `?v=a|b`; variant בכל אירוע.
2. שני הדפים חולקים טופס/WhatsApp אחד (24).
3. report_weekly.mjs: קורא אירועים → משפך לכל וריאנט + מספרים גולמיים; Markdown בעברית.
4. טסט: 200 sessions מדומים → ~50/50; הדוח מופק.

## קריטריוני קבלה

- [ ] הקצאה 50/50 ±5% על 200 sessions מדומים; override עובד.
- [ ] דוח שבועי מופק מה-JSONL עם משפך לכל וריאנט.
- [ ] שני הדפים ב-3 viewports.

## Gate

**Check:**
```bash
cd C:/RnD/Projects/Habait/habait-walkaround/Habait/platform && export HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps && timeout 300 node test/landing.test.mjs && node report_weekly.mjs --from _local/events.jsonl --out _local/reports && ls _local/reports | tail -1
# צפוי: "split 200 sessions: A=95..105 B=95..105", דוח weekly-*.md נוצר, exit 0
```

**Reviewer scope:** נכונות ההקצאה והמשפך בלבד.

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

_(platform-dev, 2026-11-02 ~16:55–17:30 שעון המכונה; הופעל על ידי habait-4b; העץ הראשי `C:\RnD\Projects\Habait\habait-walkaround\Habait\platform`; ריצה אחת נקטעה על מגבלת המנוי (429) והמשיכה מהקבצים שעל הדיסק)_

- **מצב:** DONE, עם סטייה אחת מקריטריון הקבלה שמתועדת כאן ולא מוסתרת: **הפיצול על 200 sessions יצא A=89 B=111, מחוץ ל-95..105 שבכרטיס.** ה-seed (25) נקבע לפני הריצה הראשונה ולא הוחלף. הרצועה ±5 על 200 sessions לא ניתנת להבטחה: לכל hash הוגן של 50/50 ההסתברות ליפול בתוך 95..105 היא 0.563 (סטיית תקן 7.1). **ההכרעה (T0):** הטסט מדפיס את הפיצול כפי שהוא, אומר במפורש שרצועת הכרטיס "NOT met", ובודק את הפיצול מול רצועת ה-99.9% הבינומית (77..123). השער הסטטיסטי האמיתי: 100,000 sessions → A=50.11% (סף ±0.5%), chi² על 100 דליים 108.5 (סף 148), ו-ids רציפים 49.5%. אם הלוח מתעקש על ±5 ב-n=200 מילולית, אין דרך כנה עם hash של session_id. האפשרות היחידה היא הקצאה מאוזנת בצד השרת (מונה), וזה סותר את ה-hash ולא עובד באתר סטטי.
- **מה נעשה (הכרעות T0):**
  - **`landing.html?project=<id>[&unit=][&v=a|b][&src=][&lang=]`:** דף אחד לשני הווריאנטים. **A** = הדמיה חוץ (`cover-aerial-skinned.jpg`) + 11 הסטילס של 846. הסטילס נטענים מ-`_local/dist/<p>/<unit>/apartment.json` של כרטיס 23 כשהוא קיים, אחרת מהפוסטרים/סטילס של `flow.json` בפיקסטורה. לחיצה על תמונה פותחת lightbox ושולחת `room_view` עם dwell. **B** = `flow.html` ב-iframe מאותו origin (fullscreen/gyroscope/autoplay מותרים) + קישור "פתיחה במסך מלא". **בשני הווריאנטים אותו דבר:** כותרת, כרטיס עובדות של הדירה המוצגת (846), אותו `renderLeadBlock` של `js/lead.js` (וואטסאפ + טופס עם הסכמה), כיתוב קצר ליד המדיה וכיתוב מלא ב-footer. בדף אין לוגו ואין טקסט שיווקי של היזם (D-WQ-18), רק צבעי white-label.
  - **הקצאה (`js/landing.js`):** `?v=a|b` (קישור הקמפיין) > הווריאנט שכבר נרשם בלשונית > `hash32(session_id) % 100 < 50`. ה-hash הוא FNV-1a + finaliser של murmur3 (הביט התחתון של FNV לבדו הוא רק זוגיות הקלט). ב-`project_open {page:'landing', via: link|session|hash}`.
  - **`variant` בכל אירוע:** תוספת additive ל-`js/analytics.js`: `setVariant()`/`variant()` שומרים את הווריאנט ב-sessionStorage (`habait.variant`, רק `a`|`b`), ו-`capture()` מוסיף אותו לכל אירוע. כך גם האירועים ש-`flow.html` שולח מתוך ה-iframe (אותו sessionStorage, אותו session_id ו-src; נבדק) וגם `apartment.html` אחרי המסירה נושאים אותו. `variant` נכנס ל-`RECORD_FIELDS`/`TEXT_FIELDS` ול-`OUTBOUND_FIELDS` של `js/posthog-adapter.js`. **קוד המסנן (`sanitizeRecord`) לא השתנה.** הערך עובר דרך `safeToken` כמו כל שדה טקסט. **לא נוסף שם אירוע:** EVENTS נשאר 14, ו-smoke לא שונה. ביקור = `project_open` עם `page:'landing'`.
  - **`report_weekly.mjs`:** קורא JSONL של ה-sink או export של PostHog באותו אוצר מילים (מערך JSON או JSONL עם `properties`), ו-`--from` יכול לחזור. הווריאנט של session = ה-`variant` הראשון שלו לפי זמן. כותב Markdown בעברית: טווח השבוע (UTC; `--end`, `--days`), משפך לכל וריאנט בסשנים ייחודיים (ביקור → unit_enter → lead_click → lead_submitted → פגישה), ליד = טופס או וואטסאפ (`lead_click` בערוץ `zip` לא נספר), ביקור→ליד, ליד→פגישה (`meeting_booked`/`meeting` אם יגיעו מה-Sheet/CRM; אחרת "אין נתוני פגישות"), z-test של שתי פרופורציות, מספרים גולמיים לפי אירוע/ערוץ/src, וסף ההוכחה מהמחקר (~1,000 ביקורים בחודש, 6–8 שבועות ≈ 1,380–1,840 ביקורים, ~690–920 לכל וריאנט) מול המצטבר. אירועי `test:true` מוצאים מהדוח (אפשר להכליל עם `--include-test`). קלט חסר או ריק → דוח של אפסים שאומר את זה, exit 0. שגיאת שימוש → exit 2.
  - **`test/landing.test.mjs`:** הקצאה (200, 100k, override, לשונית), דוח על JSONL סינתטי של 400 sessions עם משפך ידוע (כל מספר חוזר זהה; test, מחוץ לשבוע ו-no-variant מוצאים), export בצורת PostHog, קלט חסר, השוואת עותק הכיתוב שב-`landing.html` ל-`disclaimer-he-en.md` (נכשל אם הנוסח זז), ודפדפן ב-3 viewports (iPhone 390 / Android 412 / desktop 1366) × 2 וריאנטים + נתיב ה-hash בלי `?v` + מתג שפה. הטסט מרים שרת משלו עם sink לקובץ `_local/landing-test/browser-events.jsonl` ובודק ש-`_local/events.jsonl` האמיתי לא נגע. צילומים: `_local/landing-test/shots/{iphone,android,desktop}-{a,b}.png`.
  - **באג שנמצא ותוקן בדרך:** בטלפון שורת שם/טלפון של הטופס הרחיבה את ה-layout viewport ל-473 px במסך של 390 (min-width אינטרינזי של input). הבדיקה הראשונה שלי לא תפסה את זה כי השוותה ל-innerWidth המורחב. התיקון ב-`css/landing.css`, והבדיקה משווה עכשיו לרוחב המכשיר. גם `.facts`/`.unit-facts` התנגשו בקלאסים של `style.css` ושונו ל-`landing-*`.
- **קבצים שנכתבו:** חדשים: `Habait/platform/landing.html`, `Habait/platform/js/landing.js`, `Habait/platform/css/landing.css`, `Habait/platform/report_weekly.mjs`, `Habait/platform/test/landing.test.mjs`, `Habait/platform/_local/reports/weekly-2026-11-02.md`, `Habait/platform/_local/landing-test/**` (JSONL סינתטי, export, דוחות טסט, צילומים). עריכה additive: `Habait/platform/js/analytics.js` (setVariant/variant + `variant` ב-allowlist; המסנן עצמו לא שונה), `Habait/platform/js/posthog-adapter.js` (`variant` ב-OUTBOUND_FIELDS; שני הקבצים באישור הסשן המפעיל, שמחזיק את platform). לא נגעתי ב-`picker.js`, `serve.mjs`, `lead.js`, `flow.*`, הפיקסטורות או `smoke.mjs`. אין צורך ב-restart של :8850: `landing.html` נטען כקובץ סטטי (200).
- **פלט ה-Check (מילה במילה, exit 0):**
```
$ cd C:/RnD/Projects/Habait/habait-walkaround/Habait/platform && export HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps && timeout 300 node test/landing.test.mjs && node report_weekly.mjs --from _local/events.jsonl --out _local/reports && ls _local/reports | tail -1; echo "EXIT $?"
split 200 sessions: A=89 B=111
     card band 95..105: NOT met (P(95..105) = 0.563 for any fair 50/50 hash at n=200); 99.9% band 77..123
ok   assignment: 200 simulated sessions (fixed seed) inside the 99.9% binomial band; card band reported  (seed 25)
ok   assignment: deterministic (same id -> same arm) and unbiased on 100,000 sessions  (A=50.11%, chi2(99)=108.5, sequential A=49.5%)
ok   assignment: ?v=a|b overrides the hash; bad values fall back; the tab keeps its arm
ok   report: the funnel per arm from the synthetic JSONL equals what was generated  (A visit=191 enter=0 click=25 submit=10 lead=22 meeting=8 | B visit=209 enter=84 click=53 submit=16 lead=46 meeting=16)
ok   report: a PostHog-export file (properties envelope) reads like the JSONL
ok   report CLI: missing input -> report with zeros that says so, exit 0  (report 2026-10-27..2026-11-02: A visits=0 leads=0 | B visits=0 leads=0 | used=0 test-excluded=0 -> C:/RnD/Projects/Habait/habait-walkaround/Habait/platform/_local/landing-test/reports/weekly-empty.md)
ok   landing.html: the caption template equals disclaimer-he-en.md sections 1 + 2 (he + en)
ok   browser iphone 390x844 arm A: RTL, only arm A on the page, facts + caption  (media=live, stills=11)
ok   browser iphone 390x844 arm A: renders load; a tile opens the lightbox -> room_view with dwell + variant  (11 tiles)
ok   browser iphone 390x844 arm A: the same lead form: WhatsApp tag + form submit -> lead_click/lead_submitted with variant
ok   browser iphone 390x844 arm A: no page errors
ok   browser iphone 390x844 arm B: RTL, only arm B on the page, facts + caption  (media=live, stills=11)
ok   browser iphone 390x844 arm B: flow.html runs in the frame and its events carry variant b
ok   browser iphone 390x844 arm B: the same lead form: WhatsApp tag + form submit -> lead_click/lead_submitted with variant
ok   browser iphone 390x844 arm B: no page errors
ok   browser android 412x915 arm A: RTL, only arm A on the page, facts + caption  (media=live, stills=11)
ok   browser android 412x915 arm A: renders load; a tile opens the lightbox -> room_view with dwell + variant  (11 tiles)
ok   browser android 412x915 arm A: the same lead form: WhatsApp tag + form submit -> lead_click/lead_submitted with variant
ok   browser android 412x915 arm A: no page errors
ok   browser android 412x915 arm B: RTL, only arm B on the page, facts + caption  (media=live, stills=11)
ok   browser android 412x915 arm B: flow.html runs in the frame and its events carry variant b
ok   browser android 412x915 arm B: the same lead form: WhatsApp tag + form submit -> lead_click/lead_submitted with variant
ok   browser android 412x915 arm B: no page errors
ok   browser desktop 1366x800 arm A: RTL, only arm A on the page, facts + caption  (media=live, stills=11)
ok   browser desktop 1366x800 arm A: renders load; a tile opens the lightbox -> room_view with dwell + variant  (11 tiles)
ok   browser desktop 1366x800 arm A: the same lead form: WhatsApp tag + form submit -> lead_click/lead_submitted with variant
ok   browser desktop 1366x800 arm A: no page errors
ok   browser desktop 1366x800 arm B: RTL, only arm B on the page, facts + caption  (media=live, stills=11)
ok   browser desktop 1366x800 arm B: flow.html runs in the frame and its events carry variant b
ok   browser desktop 1366x800 arm B: the same lead form: WhatsApp tag + form submit -> lead_click/lead_submitted with variant
ok   browser desktop 1366x800 arm B: no page errors
ok   browser desktop, no ?v: session 9d9b4167 -> arm A by hash (Node and browser agree)
ok   browser desktop: language toggle -> English LTR, caption in English
ok   browser desktop, no ?v: session 1f6d635e -> arm B by hash (Node and browser agree)
ok   sink: the browser events went to the test file only, all test:true, every landing/frame event with variant  (29 events; report --include-test: A visits=4 leads=3, B visits=4 leads=3)
landing test: 35/35 ok  (shots: C:/RnD/Projects/Habait/habait-walkaround/Habait/platform/_local/landing-test/shots)
report 2026-10-27..2026-11-02: A visits=0 leads=0 | B visits=0 leads=0 | used=0 test-excluded=20 -> _local/reports/weekly-2026-11-02.md
weekly-2026-11-02.md
EXIT 0
```
  - `npm test`: `all green`, NPM EXIT 0 (smoke נועץ EVENTS=14, ללא שינוי). `node test/analytics.test.mjs`: `all green`, EXIT 0. `node test/browser.mjs` מול :8850: 25 ok / 0 FAIL, `all green`, BROWSER EXIT 0.
- **כסף:** $0 (אין קריאות בתשלום, אין `claude -p`).
- **פגמים פתוחים:**
  1. רצועת ה-±5 של הכרטיס על 200 sessions לא מתקיימת (A=89), ראו "מצב". הקריטריון כפי שנוסח לא ניתן להבטחה עם hash.
  2. **D-WQ-18 ב-B:** `flow.html` (לא שלי) מציג בתוך ה-iframe את `fixtures/rainbow/logo.svg` ("RAINBOW", לוגו placeholder שלנו עם שם הפרויקט, לא הלוגו של היזם). אם זה נחשב מיתוג של היזם, צריך להסתיר אותו ב-flow.
  3. בפריסה בלי `_local` (Vercel) וריאנט A נופל לסטילס של הפיקסטורה, שהם clay, וזה לא הוגן כלפי A. בשביל A/B אמיתי צריך לפרוס גם את `apartment.json` + `media/stills` של 846. יש גם 404 אחד בקונסול על ה-manifest. ב-Vercel אין sink, כלומר אין מדידה עד שיש `posthog_key`.
  4. ה-session הוא לשונית: אותו אדם בלשונית חדשה יכול לקבל וריאנט אחר. לכן בקמפיין צריך שני קישורים (`?v=a`, `?v=b`).
  5. מספר הוואטסאפ בפיקסטורה הוא placeholder, וה-Sheet לא מוגדר (הכרעה 4). בלי אירוע `meeting_booked`, ליד→פגישה ריק.
  6. `node test/browser.mjs` (של כרטיס 24) עדיין כותב את אירועי הבדיקה שלו ל-`_local/events.jsonl` האמיתי: 80 שורות, כולן `test:true`, והדוח מוציא אותן.
- **קורא שני:** habait-98: בפריסה הבאה של habait-flow לכלול את `landing.html`, `js/landing.js`, `css/landing.css` (+ ה-js/css הקיימים) ואת `apartment.json` + `media/stills` של 846, אחרת A מציג clay. **לא** לכלול את `_local/reports`, `_local/landing-test`, `_local/events.jsonl`, `report_weekly.mjs` ו-`dashboard.html`. קישורי הקמפיין: `/landing.html?project=rainbow&v=a|b&src=<campaign>`.
- **לזיכרון:** כרטיס 25: landing.html?project=&v=a|b = A (סטילס 846 + טופס) / B (flow.html ב-iframe + אותו טופס); variant נרשם פעם אחת (analytics.setVariant, sessionStorage) ועובר גם לאירועי ה-iframe; report_weekly.mjs → _local/reports/weekly-<date>.md (משפך לכל וריאנט, סף ~1,000 ביקורים/חודש × 6–8 שב'). פיצול 200 = 89/111: ±5 לא בר-הבטחה (P=0.56); 100k = 50.11%. $0.
