# Phase 4 — דוח QA (כרטיס 18): בדיקות, ה-after set, ביקורת 30 הפריטים

מבצע: מבקר QA טרי (Sonnet), לא כתב את מה שנבדק. 2026-11-03. $0, ללא git, בלי לפתוח .env.
הקדמה: Gate 2 נסגר ב-PASS אחרי תיקון F1/N2 (ראו `gate2-report.md`, "בדיקה חוזרת"). עץ preview נבנה מחדש מהעותק (כולל תיקון `landing.css`).
סקריפטים: `C:\RnD\.wt\platform-ui-ux\tools\gate2\` (p4.cjs, overimg.cjs, studio_dom.cjs, devlabels.cjs, extra.cjs, clssrc.cjs, cap2.cjs, cap_studio2.cjs). גולמי: `logs/phase4-*.txt`.

## פסק דין כולל: **FAIL — 4 פגמים לתיקון (A1–A4) + חריגים מוצהרים**
כל שורות ה-Check ירוקות; ה-after set נשמר; ה-repo החי נקי. בביקורת 30 הפריטים: 4 פריטים נכשלים בפגמים שאפשר לתקן בתוך הלוח, ו-8 פריטים הם חריגים בעלי שם (מחוץ לתחום הלוח או בהמתנה לנוסח של אלירן). הכרטיס חוזר למחבר ל-A1–A4; כל השאר מוכן לכרטיס 19.

## שורות Check (כרטיס 18)
| שורה | תוצאה | ראיה |
|---|---|---|
| `npm test` | **PASS** "all green" | `phase4-npmtest.txt` |
| `landing.test.mjs` | **PASS** 35/35 | `phase4-landing.txt` |
| `apartment.test.mjs` | **PASS** 36/36 | `phase4-apartment.txt` |
| `card-overflow.test.mjs` | **PASS** 18/18 | `phase4-card-overflow.txt` |
| `tokens-sync.test.mjs` (עותק) | **PASS** | `phase4-tokens-sync.txt` |
| `browser.mjs` | **PASS** 25 ok, 0 FAIL | `phase4-browser.txt` |
| `flow-real.test.mjs` (נוסף) | **PASS** (ירוק, = Gate 2) | `phase4-flow-real.txt` |
| `contrast.mjs --project rainbow` | **PASS** exit 0, 0 theme fails | `phase4-contrast.txt` |
| Studio `run.mjs` | **13/14, כצפוי** — כשל יחיד = `plan.general.json` חסר בעותק; הוכח ב-Gate 2 (14/14 עם הקובץ) | `phase4-studio-run.txt`, `gate2-studio-run-withplan.txt` |
| בדיקת העתק המוכן של כרטיס 03 (0 × 4xx על `_local/dist/`) | **PASS** — `stage_flow.py` (עותק scratch שמצביע ל-three מעץ ה-preview, בגלל OWED-023) מ-live ל-scratch: 29 קבצי dist (11.1 MB); מעבר headless ב-390 ו-1440 על 7 דפים: **0 תשובות ≥400 על `_local/dist/`**, 0 שגיאות עמוד. (404 על `_local/segments/rainbow-cine/*` ועל `/styleguide.html` הם של האתר החי ללא הלוח, לא של dist) | `phase4-stage.txt` |
| ה-repo החי | **PASS** — 168 רשומות: 134 זהות, 30 חדשות (null, לא קיימות חי), 4 סטיות = בדיוק 4 קבצי CLAUDE.md המוכרים (עותקיהם ללא שינוי). `released`: `apartment-3d.js` זהה ל-open; `build_zip.mjs` שונה חי (rnd-fd, שוחרר בכוונה) — לא סטייה. 0 קבצים מחוץ לתחום ששונו בעותק. `studio/_local/projects/ui-check/` = שאריות כרטיס 08 מוכרות | `phase4-live.txt` |

## ה-after set
`C:\RnD\Projects\Habait\research\platform-ui-ux-2026-11-03\after\` — 11 דפי shell (שמות כמו `current\`, + `07b_apartment_photos`, `07c_apartment_3d`) × {desk 1440, phone 390, hd 1280x720} (+ `_full`) + Studio `10_studio_empty`, `11_studio_project`, `12_studio_new` × 3 גדלים; `capture-report.json`; כל הצילומים 0 שגיאות, 0 4xx, 0 Google Fonts (`phase4-capture-*.txt`). ה-`CLAUDE.md` נוצר ב-`generate-cards.py --apply` (הפקודה כתבה 9 קבצי הקשר בסך הכל: ראו הערה בסוף).

## ביקורת 30 הפריטים (`raw-B-patterns.md`)
| # | פריט | תוצאה | ראיה |
|---|---|---|---|
| 1 | ≤3 שלבים ראשיים בבית; לא יותר מכפתור ראשי אחד במסך | **FAIL (A1)** — בית הפלטפורמה 1, Studio רשימה 1, Studio "חדש" 1; **Studio דף פרויקט: 2 כפתורי primary גלויים** ("אישור והמשך ליצירה" + "צור את ההדמיה · כ-$4.05") | `phase4-studio-dom.txt`, `phase4-misc.txt` |
| 2 | כל השאר תחת "מתקדם", רמה אחת | **PASS** — `details#adv` סגור, 24 פקדים בפנים | `phase4-studio-dom.txt` |
| 3 | רשימת שלבים גלויה, נוכחי מודגש, כפתורים בשם השלב הבא | **PASS בהסתייגות** — stepnav של 4 שלבים עם ספירות; ציר הזמן מדגיש running/"צריך אותך"; ה-stepnav עצמו ללא סימון "נוכחי" (aria-current רק בניווט העליון) | `phase4-studio-dom.txt`, `after\desk_11_studio_project.png` |
| 4 | אפשר לצאת באמצע ולחזור | **PASS** — מצב נשמר בשרת, "אפשר לסגור את הדף" (index.html:121), ניתוב ב-hash | `index.html:121`, `phase4-studio-dom.txt` |
| 5 | מצבי ריק: מה, מלמד, כפתור; בלי "אין פריטים" בזמן טעינה | **PASS** — `projects-empty` עם הסבר + כפתור; `projects-loading` נפרד | `phase4-studio-dom.txt` |
| 6 | העלאה: אזור גרירה + כפתור + מגבלות לפני | **PASS** — drop zone (role=button, Enter) + כפתור "בחירת קבצים" + סוגים ו-200MB גלויים | `after\desk_11_studio_project.png` |
| 7 | שורת קובץ: שם, גודל, התקדמות, chip תפקיד, הסרה, ניסיון חוזר | **PASS** — שם/גודל/chip (select)/`×`; progressbar בזמן העלאה, retry בשגיאה (app.js:214-266) | `phase4-studio-dom.txt` |
| 8 | שגיאות ספציפיות ושחזור לכל קובץ | **PASS** — סוג/גודל/ריק/נקטעה-רשת, retry לקובץ | `app.js:243-266` |
| 9 | העלאות גדולות ממשיכות אחרי ניתוק | **חריג בעל שם** — XHR רגיל, אין chunk/resume; ניתוק = retry מההתחלה. שרת ה-Studio מחוץ לתחום הלוח. נפתח לאלירן | `app.js:252-266` |
| 10 | משימה ארוכה ברקע; מסלול התראה | **חריג בעל שם** — רקע: כן (שרת מריץ, "אפשר לסגור"); מסלול התראה: אין | `index.html:121` |
| 11 | רשימת שלבים: ממתין/רץ/צריך אותך/הושלם/נכשל + זמן | **PASS** — TL ממפה 5 מצבים, ל-"דולג"; זמן עבר `1:21` ליד כל שלב | `app.js:17`, `phase4-studio-dom.txt` |
| 12 | ETA טווח/מספר שלבים, לא אחוז מומצא | **PASS** — "7 מתוך 9 שלבים", עלות "כ-"; אין `%` בטקסט הדף; progressbar בהעלאה = בתים אמיתיים | `phase4-studio-dom.txt` |
| 13 | ביטול קיים; עלות לפני ואחרי | **חריג בעל שם (ביטול)** — אין כפתור ביטול למשימה (רק ביטול העלאה); עלות לפני (על הכפתור) ואחרי (chip "הוצאה עד כה $128.54") קיימות. endpoint ביטול = שרת, מחוץ לתחום | `phase4-studio-dom.txt` |
| 14 | תוצאות חלקיות מיד כשמוכנות | **PASS** — 3 כרטיסי תוצר: "מוכן" ×2, "עוד לא בשרשרת" ×1 בזמן שהצינור לא סיים | `phase4-studio-dom.txt` |
| 15 | כשל: שם שלב, סיבה, ניסיון חוזר לשלב | **חריג בעל שם** — שם שלב וסיבה מוצגים (ההערה גולמית ובאנגלית מהצינור); אין retry לשלב, רק "צור" מחדש (+ `#force`) | `after\desk_11_studio_project.png` |
| 16 | סקירה: חיתוך מקור ליד הערך; רק ספק נמוך מסומן; אישור המוני | **חריג בעל שם (חיתוך)** — 0 חיתוכי מקור (אין API); סימון רק ל-8 מ-14 שדות; אישור "אישור והמשך ליצירה" קיים | `phase4-studio-dom.txt` |
| 17 | ביטחון: צבע + טקסט/אייקון | **PASS** — chip "לא ודאי"/"צריך אותך" עם נקודה/!/✓, אין אחוזים | `after\desk_11_studio_project.png` |
| 18 | דף קונה: מדיה קודם, וידאו גיבור אחד, בורר + רשימה | **PASS** — landing: מדיה ראשונה (A: cover+play, B: הטיסה), רשימת זמינות של 12 כחלופה לא-חזותית | `gate2-p14-after.txt` |
| 19 | CTA דביק בטלפון; טופס ≤3 שדות; יעדים ≥44px | **FAIL (A3)** — CTA דביק 48px + טאבים 44px ✓; טופס הליד קיים ב-landing. אבל **יעדי כותרת <44px בטלפון**: toggle "EN" 36×52 (home), 36×44 (landing), 40×46 (apartment); קישור ה-brand 35px גובה (home, landing); `a.home-card__link` נמדד 36 | `phase4-targets.txt` |
| 20 | יחס גובה-רוחב שמור; בלי layout shift; בלי loader מלא | **FAIL (A2)** — CLS בדסקטופ בעת הטעינה: landing A **0.509**, landing B **0.477** (מקור: ב-~100ms `landing-body`/footer מצוירים ואז המדיה נחשפת ודוחפת 690px), Studio דף פרויקט **0.194**, apartment 0.061, home 0.016. בטלפון 0. כל התמונות עם קופסה שמורה (noBox 0 ב-landing); 0 loaders במסך מלא | `phase4-cls.txt`, `clssrc` |
| 21 | תג "הדמיה · AI-generated" על כל תמונה/וידאו | **FAIL (A4)** — landing ✓ (11 אריחים + hero), home ✓, Studio ✓. **apartment, טאב "תמונות": 11 תמונות AI, 0 תגים** (גם ב-lightbox ובתכנית); יש רק כיתוב משפטי טקסטואלי בתחתית הפאנל. בבסיס היה זהה (לא נוצר בלוח), אך הפריט נבדק עכשיו ונכשל | `phase4-extra.txt`, `apartment.js:291-300` |
| 22 | `<html dir=rtl lang=he>`; בלי left/right ב-CSS | **PASS** — rtl/he בכל הדפים; ב-CSS ששונה: 0 מאפיינים פיזיים כיווניים; נשארים רק `left:0;right:0` סימטרי, `left:50%`+translateX מרכוז ומיקום hotspot ב-JS (שורות שלא תלויות כיוון) | `phase4-misc.txt`, `gate2-physical*.txt` |
| 23 | ₪, מ"ר, טלפונים, שמות לטיניים ב-bdi | **PASS** — home (12, 7, Rainbow, AI-generated), landing (4 bdi/שורה), apartment (title+summary+spec); המחיר שורה אחת בטלפון | `phase4-extra.txt`, `gate2-price-recheck.txt` |
| 24 | רק אייקונים כיווניים מתהפכים | **PASS** — play לא מתהפך, ‹/› מתהפך עם `[dir=ltr]` (apartment.css:75) | `apartment.css:74-75`, `c14-landing.txt` |
| 25 | רישיון פונטים בקובץ | **PASS** — OFL-Heebo.txt + OFL-FrankRuhlLibre.txt + SOURCES.md עם sha256; 0 בקשות Google (כל 14 הדפים × 3 גדלים), 0 הפניות googleapis/gstatic בקוד | `fonts/SOURCES.md`, `phase4-capture-*.txt`, `phase4-devlabels.txt` |
| 26 | ניגוד 4.5:1 טקסט / 3:1 UI; focus נראה; מקלדת מלאה | **FAIL (A5, קטן) לניגוד על תמונה; שאר PASS** — `contrast.mjs` 0 כשלים; מדידה בדפדפן על דפים (טקסט על רקע אחיד, 2 themes × 2 גדלים): 0 מתחת לסף ב-home/landing B/apartment/Studio. **טקסט על תמונה** (פיקסלים): home ≥6.0; landing 1440 ≥5.86; **landing 390: 3 תוויות אריחים (פינת אוכל 3.91, חדר שינה הורים 4.04, חדר שינה 3.94) מתחת ל-4.5**. מקלדת: home 3 עצירות, landing 29, apartment 9-12, flow 5, Studio 2/36/3, **0 עצירות ללא focus ring** (חריגים: iframe/וידאו עם בקרים נייטיביים) | `phase4-contrast-*.txt`, `phase4-keyboard.txt` |
| 27 | `prefers-reduced-motion` מכובד; וידאו לא מתנגן אוטומטית | **PASS לדפי ה-shell / חריג בעל שם לטיסה** — בכל הדפים תחת reduce: transition/animation ≤0.00001s, 0 offenders. ב-`flow.html` (ובקידום arm B) וידאו הטיסה ממשיך להתנגן תחת reduce: התנהגות `flow.js`/`cine.js`, מחוץ לתחום | `phase4-motion.txt` |
| 28 | הכרזות התקדמות ב-live region מנומס | **PASS** — Studio: `#toast` role=status aria-live=polite, `#blocker` role=alert, `#new-msg` alert; landing 2, apartment 1, flow 1 | `phase4-misc.txt`, `phase4-studio-dom.txt` |
| 29 | הצהרת נגישות וערוץ קשר בפוטר | **חריג בעל שם** — אין קישור כזה באף דף (0 `a` עם "נגישות"); הנוסח של אלירן (§6), מוצהר בגייט 1 | `phase4-misc.txt` |
| 30 | נבדק בטלפון אמיתי ועם קורא מסך עברי | **CANNOT-VERIFY** — אין מכשיר אמיתי/קורא מסך בסביבה; כן: אמולציית טלפון ב-Edge, `<main>`, h1 יחיד, labels. נשאר לאלירן/בדיקת אנוש | — |

## סיכום
- **PASS:** 2, 4, 5, 6, 7, 8, 11, 12, 14, 17, 18, 22, 23, 24, 25, 28 (+3, 27 בהסתייגות).
- **FAIL לתיקון (חוזרים למחבר):**
  - **A1** (פריט 1): Studio דף פרויקט עם 2 כפתורי primary (הפחתה של "אישור והמשך" ל-secondary או הצגה אחד-בכל-פעם).
  - **A2** (פריט 20): CLS 0.51/0.48 ב-landing ב-1440 (לשמור מקום למדיה עד שה-JS חושף אותה, למשל `min-height`/`aspect-ratio` על `.landing-media` ו-`landing-body` מוסתר עד המוכנות), Studio דף פרויקט 0.19.
  - **A3** (פריט 19): יעדי כותרת <44px בטלפון (EN, brand).
  - **A4** (פריט 21): תג AI על 11 התמונות של טאב "תמונות" בדף הדירה ועל ה-lightbox (`apartment.js:291-300`, `apartment.css`).
  - **A5** (פריט 26, קטן): 3 תוויות אריחי גלריה ב-390 מתחת ל-4.5:1 על התמונה (חיזוק scrim).
- **חריגים בעלי שם:** 9, 10, 13, 15, 16, 27 (טיסה), 29 (נוסח אלירן), 30 (CANNOT-VERIFY).
- הערה: `generate-cards.py --apply` כתב 9 קבצי הקשר (6 חסרים + 3 מיושנים); רק אחד מהם הוא של תיקיית `after\`. התוצאה: תיקיות נוספות במערכת קיבלו קובץ הקשר אוטומטי (הפקודה רצה פעם אחת, כמוגדר).

## בדיקה חוזרת (אחרי תיקוני המחבר ל-A1–A5)
עץ preview נבנה מחדש. גולמי: `phase4b-*.txt`.
| פגם | תוצאה | ראיה |
|---|---|---|
| A1 (פריט 1) | **PASS** — דף פרויקט ב-Studio: כפתור primary גלוי אחד ("צור את ההדמיה · כ-$4.05") | `studio_dom` |
| A2 (פריט 20) | **FAIL (נותר)** — Studio דף פרויקט CLS 0.002 ✓; apartment 0.061 ✓; home 0.014 ✓; בטלפון 0 בכל הדפים. **landing בדסקטופ: arm A 0.100 (על הסף "טוב" 0.1, אחרי תיקון מ-0.509), arm B 0.312 (מ-0.477)**. מקור arm B: ב-~71ms `landing-body` יושב ב-y=61 ואז נדחף ל-777 (מדיה נחשפת/נקבעת), ועוד 0.07 כשה-body מתכווץ 123→106 והפוטר/`landing-split` מתחלפים. כלומר ה-body עדיין מצויר לפני שהמדיה של arm B שמרה מקום | `phase4b-cls.txt`, `clssrc.cjs` |
| A3 (פריט 19) | **PASS** — EN ו-brand ≥44px בכל שלושת הדפים (landing, apartment: 0 מתחת ל-44; home: נשאר רק `a.home-card__link` 36px, קישור מתוח על כל הכרטיס, יעד המגע בפועל = הכרטיס) | `phase4b-targets.txt` |
| A4 (פריט 21) | **PASS** — טאב תמונות: 11 תמונות = 11 תגים, ה-lightbox נושא תג (תכנית: אין תג, תמונת תכנית מקור ולא AI — לא נבדק לפסול) | `extra.cjs` |
| A5 (פריט 26) | **PASS** — תוויות האריחים ב-390: 0 מתחת ל-4.5, ממוצע גרוע ביותר 8.49 (היה 3.91) | `phase4b-overimage.txt` |
| בדיקות | **PASS** landing 35/35, apartment 36/36, card-overflow 18/18, browser 25 ok / 0 FAIL | `phase4b-*.txt` |

**פסק דין מעודכן: FAIL — נשאר פגם אחד: A2 (CLS של landing בדסקטופ, בעיקר arm B 0.31; arm A 0.10 גבולי).** שאר A1, A3, A4, A5 נסגרו. חריגים בעלי שם ללא שינוי.

### בדיקה חוזרת 2 (A2, תיקון `visibility:hidden` עד `body.ready`)
- CLS בדסקטופ ובטלפון, landing arm A ו-arm B, 3 ריצות לכל צירוף (גם אחרי גלילה מלאה): **0 בכל 12 הריצות** (`phase4c-cls.txt`). A2 **PASS**.
- נתיב שגיאה (`projects.json` → 404): `#projectName` מציג "לא הצלחנו לטעון את הפרויקט: projects.json: HTTP 404", גלוי בדסקטופ ובטלפון, `body.ready` נקבע. `landing.test.mjs` 35/35.
**פסק דין Phase 4 סופי: PASS** — A1–A5 כולם נסגרו; נשארים רק החריגים בעלי השם (9, 10, 13, 15, 16, 27-טיסה, 29, 30=CANNOT-VERIFY).

## צילום מחדש (אחרי תיקוני כרטיס 19)
- עץ preview נבנה מחדש; כל ה-after set צולם מחדש ל-`research\platform-ui-ux-2026-11-03\after\` (11 דפי shell × desk 1440 / phone 390 / hd 1280x720 + `_full`, ו-Studio 10/11/12 × 3 גדלים), דורס. כל 33 צילומי ה-shell ו-9 צילומי ה-Studio: 0 שגיאות, 0 4xx, 0 Google Fonts (`phase4d-capture-*.txt`).
- F13: לפני כל צילום כל התמונות הוכרחו ל-`loading=eager`, נגללו והמתנו ל-decode; אריחי הגלריה נטענו (אומת ב-`phone_03_landing_a_full.png`). F14: `07_apartment_images` משתמש עכשיו ב-`tab=photos` (טאב התמונות באמת), `07b_apartment_photos` זהה.
- CLS: landing arm A ו-B בדסקטופ 0 (3 ריצות), Studio דף פרויקט 0.002 (דסקטופ) / 0 (טלפון) (`phase4d-cls.txt`).
- `browser.mjs` 25 ok / 0 FAIL; `landing.test.mjs` 35/35. פסק דין Phase 4: **PASS** (ללא שינוי).
