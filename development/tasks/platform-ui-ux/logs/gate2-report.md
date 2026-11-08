# Gate 2 — דוח QA (כרטיס 17): ניסיון הפרכה של כרטיסים 13–16

מבצע: מבקר QA טרי (Sonnet), לא כתב את מה שנבדק. 2026-11-03. $0, ללא git, בלי לפתוח .env.
סביבה: שני עצי preview בתיקיית ה-scratchpad (`...\scratchpad\gate2\preview` = עץ הלוח; `...\gate2\base\preview` = `--base-only`, קו בסיס לפני הלוח), :8852 בלבד (+ fixture API על :8853 לפריימי Studio), Edge headless, מבט קונה דרך `buyer.test`. סקריפטי הבדיקה שלי: `C:\RnD\.wt\platform-ui-ux\tools\gate2\` (probe14, probe16, cap2, cap_studio2, cmp_layout, price, tiles; layout.cjs/anchor.cjs הם עותקים של הסקריפטים של המחבר, הורצו על שני העצים). פלט גולמי: `logs/gate2-*.txt`. פריימים: `.wt\platform-ui-ux\after\gate2\after\` (11 דפי shell + 3 דפי Studio, ב-1440 · 390 · 1280x720).

## פסק דין: **FAIL (פגם קטן אחד, כרטיס 14)** — הכרטיס חוזר למחבר
כל שורות ה-Check ירוקות ושווות לבסיס; כל שורות הקבלה של 13, 15, 16 עומדות; בכרטיס 14 הטקסט המשפטי זהה בבתים, אבל **מחיר הדירה המוצגת בדף הנחיתה נשבר לשתי שורות ב-390 וב-360** (ראו F1). לפי ההנחיה, שלב Phase 4 (כרטיס 18) לא הורץ.

## שורות Check (כרטיס 17)
| # | שורה | תוצאה | ראיה |
|---|---|---|---|
| C1 | `npm test` (contracts + smoke) | **PASS** exit 0, "all green" (בסיס smoke 12) | `gate2-npmtest.txt` |
| C2 | `landing.test.mjs` | **PASS** 35/35 (=בסיס) | `gate2-landing.txt` |
| C3 | `apartment.test.mjs` | **PASS** 36/36 (=בסיס) | `gate2-apartment.txt` |
| C4 | `card-overflow.test.mjs` | **PASS** 18/18 (=בסיס) | `gate2-card-overflow.txt` |
| C5 | `flow-real.test.mjs` | **PASS** 38/38 (=בסיס) | `gate2-flow-real.txt` |
| C5b | `flow-cine.test.mjs` | **PASS** 43/43 (=בסיס, ריצה ראשונה, בלי הפלייק) | `gate2-flow-cine.txt` |
| C6 | `tokens-sync.test.mjs` (מהעותק) | **PASS** "all copies equal their source" | `gate2-tokens-sync.txt` |
| C7 | `browser.mjs` (:8852) | **PASS** 25 ok, 0 FAIL (=בסיס) | `gate2-browser.txt` |
| C8 | `contrast.mjs --project …rainbow` | **PASS** exit 0, 0 theme fails, 0 brand fails | `gate2-contrast.txt` |
| C9 | Studio `run.mjs` | **13/14, כצפוי** — הכשל היחיד: ENOENT על `tour360/apartments/apt846/plan.general.json` שלא בעותק. **הסבר אומת:** העתקתי את `studio/` + הקובץ הזה מהחי לתיקיית scratchpad → 14/14 | `gate2-studio-run.txt`, `gate2-studio-run-withplan.txt` |
| C10 | ה-repo החי | **PASS** — 168 רשומות: 134 sha זהה, 30 חדשות (null) ואף אחת לא קיימת חי, 4 סטיות = בדיוק 4 קבצי CLAUDE.md מוכרים (platform, css, js, tools) וגרסאות העבודה שלהם שוות ל-`sha256_at_open`. `build_zip.mjs` במפתח `released`. בעותק אין קובץ מחוץ לטווח ששונה (apartment-3d.js, cine/transition.css, flow/viewer360/cine.js, Studio server/pipeline, /hold, tour360) | `gate2-live.txt`, `gate2-wc-changes.txt` |

## כרטיס 13 — CSS על ה-tokens
| שורת קבלה | תוצאה | ראיה |
|---|---|---|
| grep של הכרטיס = 0 פגיעות | **PASS בהסתייגות** — הפקודה המילולית מחזירה 9 פגיעות, כולן **שם המאפיין** `font-family: var(--…)`; 0 ערכי hex/rgb/hsl/border-radius, 0 צבעים בשם. אותה הסתייגות שהמחבר הצהיר | `gate2-literals.txt` |
| לא כל ה-literals הוחלפו | **הערה N1** — נשארו 57 `font-size` ב-px/rem (למשל landing.css:34,90 `12px`/`10px`; apartment.css:102,105). הכרטיס ביקש גם font-size; המחבר הצהיר שהשאיר אותם בכוונה ("layout"). לא בגבולות הקבלה (ה-grep לא כולל font-size) | `gate2-literals.txt` |
| layout ±2px | **PASS** על דפים שלא עוצבו מחדש: dashboard 0px (14/14 landmarks, 2 גדלים); flow max 7px = `picker-legend` 204→197 רוחב, 30→32 גובה = מטריקות הפונט (Heebo), יתר 12 landmarks 0px. landing ו-apartment עוצבו מחדש בכוונה בכרטיסים 14/16, לכן מבחן ±2px עליהם לא רלוונטי (נבדקים בקבלה של 14/16) | `gate2-layout.txt` |
| פיזי left/right בשורות שנגעו | **PASS בהסתייגות** — אין `margin/padding/border-left|right`, `text-align:left|right`, `float`. נשארים 7 מופעים ב-style.css (`left:0;right:0` סימטרי; `left:50%` + translateX למרכוז; hotspot שמיקומו נקבע ב-JS) ו-flow-real.css (אותו דבר): שורות שנגעו בהן רק בערך צבע, מיקום סימטרי/מרכוז שלא תלוי כיוון. apartment.css/landing.css/home.css: 0 | `gate2-physical.txt`, `gate2-physical-diff.txt` |
| תוכן 3D ב-apartment.css | **PASS** — ה-diff על כללי `.apt-frame-3d`, `.apt-minimap*`: רק צבע/רדיוס (`#000`→`--chrome-bg`, `rgba(...)`→`color-mix` על tokens); גבהים/רוחבים/מיקומים זהים | `gate2-apt3d-css-diff.txt` |
| 4 הבדיקות ירוקות כבסיס | **PASS** | C2–C6 |

## כרטיס 14 — דף הנחיתה
| שורת קבלה | תוצאה | ראיה |
|---|---|---|
| `textContent` משפטי מורחב = הדף לפני | **PASS** — 16/16 שילובים (desk/phone × arm a/b × he/en × עם/בלי stills): מחרוזות זהות **בבתים** (למשל he 1917 B, en 1576 B) מול עץ הבסיס; בלוק `<template id=legalTemplate>` זהה בדיפ. הסיכום = משפט ראשון קיים "הדמיה להמחשה בלבד."; לחיצה אמיתית על `summary` פותחת in place, "סגירה" מוצג, Enter סוגר | `gate2-legal-bytes.txt`, `gate2-p14-*.txt` |
| 0 תמונות clay/`fixtures/` עם stills | **PASS בהסתייגות** — ספירה מילולית של `fixtures/`: תמונה אחת (**ה-cover** `fixtures/rainbow/cover-aerial-skinned.jpg`, נכס הפרויקט עצמו, קיים גם בבסיס, נושא תג AI). 0 תמונות `clay`, 0 פוסטרי `node-/approach/descend`, 0 אריחי גלריה מ-fixtures. המחבר צמצם את ה-regex; מקובל כי כל נכסי rainbow חיים תחת `fixtures/rainbow/` (הקבלה המילולית לא ניתנת לקיום). **בלי stills** (חסימת `_local/dist`): גלריה מוסתרת (0 אריחים) בכל 8 הצירופים; בבסיס היו 4–5 תמונות clay | `gate2-p14-after.txt`, `gate2-p14-base.txt` |
| כל פרסום AI נושא תג | **PASS** — 11 אריחים = 11 תגי `הדמיה · AI-generated` באריחים, + תג על ה-hero (12 גלויים); בבסיס 0 תגים | `gate2-p14-after.txt` |
| כל שורת זמינות: סטטוס בטקסט + קישור 200 | **PASS** — 12 שורות (הספירה "24" בלוג היא כפל selector שלי): chip עם טקסט (למכירה/נמכרה/שמורה), 4 `<bdi>`, `href` ל-apartment.html?...unit=N, כולם fetch 200 | `gate2-p14-after.txt` |
| landing.test + card-overflow ≥ בסיס; 0 שגיאות קונסול | **PASS** — 35/35, 18/18; שגיאות קונסול 0 (השגיאה היחידה, ריצות "בלי stills", היא ה-404 שהחדרתי בכוונה) | C2, C4 |
| **F1 (פגם)** מחיר שנשבר | **FAIL (קטן)** — בכרטיס "דירה 846" (ספק עובדות של 3 עמודות) המחיר `‏7,950,000 ‏₪` תופס **שתי שורות** ב-390 (תא 77px) וב-360 (תא 67px): "7,950,00" / "0 ₪" — המספר מתפצל באמצע ספרות. ב-1440 שורה אחת. אין overflow, ולכן לא נתפס בבדיקות. תיקון מוצע: `white-space: nowrap` על ה-`dd` של המחיר, או פריסה של עמודה אחת/שתיים ב-≤420px | `gate2-price.txt`; מסך `after/gate2/after/phone_03_landing_a_full.png` (ליד "מחיר") |
| הצהרה: highlights לא נבנו | **PASS (הצהרה כנה)** — אין שדה ב-project.json; מוצהר ב-CHANGES וב-c14 | `c14-landing.txt` |
| N2 הערה | `.tile-legal` ב-landing.css:90 הוא `font-size:10px` ונושא משפט משפטי על התמונה; מתחת לגודל קריא. לא במסגרת הקבלה, מוזכר לאלירן (§6, נוסח/תצוגה משפטית שלו) | `gate2-literals.txt` |

## כרטיס 15 — chrome מעל ההדמיה
| שורת קבלה | תוצאה | ראיה |
|---|---|---|
| שורות שנגעו ב-`picker.js` הן ערכי סגנון | **PASS** — `diff` בין עץ הבסיס לעץ הלוח: `picker.js` **זהה לחלוטין** (0 שורות). flow.js, cine.js, viewer360.js, apartment-3d.js, config.js, lead.js, cine.css, transition.css — זהים | `gate2-flowreal-diff.txt` |
| עוגנים ±1px | **PASS** — הרצת אותו סקריפט anchors על שני העצים: כל ההפרשים בין הבסיס ללוח נובעים מהפונט (Heebo; כרטיס +24 גובה, pills 1px) — המחבר מדד 0px מול מצב לפני-הכרטיס; הדיפ של flow-real.css מראה שהשורות שנגעו בהן הן ערכי צבע/רדיוס בלבד | `gate2-flowreal-diff.txt`, anchors ב-scratchpad |
| **הערה N3 (חריג מוצהר)** | ב-flow-real.css שורה 6→10: `.has-legal { --caption-h:30px }` הועבר ל-`:root` (תיקון רגרסיה של כרטיס 10, "ניווט 10"). זו שורה שאינה צבע/גופן/רדיוס, ומשפיעה על מיקום רק כשה-band נשבר לשתי שורות. מוצהר, מוסבר, ולא פגם; מצוין כדי שאלירן ידע | `gate2-flowreal-diff.txt` |
| flow-real ו-flow-cine ≥ בסיס | **PASS** 38 / 43 | C5, C5b |

## כרטיס 16 — מסגרת הדירה
| שורת קבלה | תוצאה | ראיה |
|---|---|---|
| sha של `apartment-3d.js` = `sha256_at_open` | **PASS** — הקובץ לא ברשימת השינויים של העותק; זהה בבתים בין עץ הבסיס לעץ הלוח | `gate2-wc-changes.txt` |
| ב-390, כל הטאבים: מלבן ה-CTA לא חוצה את המדיה | **PASS** — 5 טאבים × 390x844 / 360x640 / 600x900 / 601x900: חפיפה 0 פיקסלים (המדיה מסתיימת 772, הסרגל מתחיל 775); בתחתית העמוד סרגל לא מכסה את `summary` של הפוטר ולא את כרטיס הסוכן. הסרגל מוצג עד 899px (כמו קודם), לא 600 כפי שכתוב בכרטיס; לא פגם | `gate2-p16.txt` |
| 0 שגיאות קונסול, בלי `Failed to construct 'URL'` | **PASS** — 20 ריצות: errs 0, 4xx 0, h-scroll false (שגיאת ECONNREFUSED יחידה = השרת שלי פג באמצע ריצה, הורצה מחדש נקי) | `gate2-p16.txt`, `gate2-capture-after.txt` |
| apartment.test ≥ בסיס | **PASS** 36/36 | C3 |
| diff של `apartment.js` "page level only" | **PASS** — 27 שורות diff (אחרי נרמול CRLF): כותרת/סיכום עם `<bdi>`, chip סטטוס, spec grid, ו-`zipBtn2` שחולק את ה-handler של `zipBtn`; אין נגיעה בלוגיקת tour/plan/3d | `gate2-apartmentjs-diff.txt` |
| יעדי מגע | טאבים 44px גובה, כפתורי הסרגל 48px | `gate2-p16.txt` |
| פער מוצהר: `apartment.js` מחזיק DEV משלו | **PASS (הצהרה כנה)** | `c16-apartment.txt` |
| פער מוצהר: dist/ZIP של הדירה דורש build_zip | **CANNOT-VERIFY כאן** (מחוץ לתחום הלוח: rnd-fd) | — |

## פריימים
`after/gate2/after/{desk,phone,hd}_{01_home … 09_flow}.png` (+ `_full`, + `07b_apartment_photos`, `07c_apartment_3d`) ו-`{desk,phone,hd}_{10_studio_empty,11_studio_project,12_studio_new}.png`. כל 33+9 הפריימים: 0 שגיאות, 0 4xx, 0 בקשות Google Fonts, אין גלילה אופקית. "לפני" = עץ הבסיס (החי) + `research\…\current\`.

## סיכום פגמים
- **F1 (FAIL, קטן, כרטיס 14):** מחיר נשבר ל-2 שורות/באמצע ספרות ב-≤390 בכרטיס העובדות של הנחיתה. מחזיר את הכרטיס למחבר.
- N1 (font-size literals נשארו), N2 (10px בקריאה משפטית על תמונה), N3 (`:root --caption-h`): הערות, לא פגמים.
- נקי: חיי ה-repo, Studio 14/14 עם הקובץ החסר, הטקסט המשפטי זהה בבתים.

## בדיקה חוזרת (אחרי תיקון המחבר ל-F1 ו-N2)
עץ preview נבנה מחדש מהעותק (106 קבצי overlay). שינויים: `.landing-fact dd { overflow-wrap: normal; word-break: keep-all }`, `.landing-facts` ב-2 עמודות ב-≤520px, `.tile-legal` 11px.
| בדיקה | תוצאה | ראיה |
|---|---|---|
| F1 ב-390 | **PASS** — המחיר `‏7,950,000 ‏₪` בשורה אחת (תא 129px) | `gate2-price-recheck.txt` |
| F1 ב-360 | **PASS** — שורה אחת (תא 114px) | `gate2-price-recheck.txt` |
| 320px: אין גלישה אופקית | **PASS** — scrollWidth=clientWidth=320, 0 ערכי dd מחוץ לגריד או לתא, בעברית ובאנגלית (גם 360) | `gate2-w320.txt` |
| `landing.test.mjs` | **PASS** 35/35 | `gate2-landing-recheck.txt` |
| `card-overflow.test.mjs` | **PASS** 18/18 | `gate2-overflow-recheck.txt` |

**פסק דין מעודכן: Gate 2 PASS** (F1 נסגר; N1 ו-N3 נשארים הערות מוצהרות; N2 תוקן ל-11px).
