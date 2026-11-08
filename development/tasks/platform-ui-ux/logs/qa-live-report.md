# QA 21 — בדיקת הריפו החי אחרי ההעתקה חזרה
סוקר: qa-reviewer (הקשר טרי) · 2026-11-03 · עלות $0 · לא נערך אף קובץ מוצר · ראיות: `logs/qa-live-*.txt`, סקריפטים: `.wt/platform-ui-ux/tools/qa21/`

**פסק דין: PASS** (שורה אחת CANNOT-RUN שאינה כשל של הלוח: Studio חי)

## 1. גיבובים (`qa-live-hashes.txt`)
- PASS — 161/164 קבצים עם `sha256_at_close` שווים לחי.
- PASS (צפוי) — 3 אי-התאמות, כולן קובצי הקשר שנוצרו מחדש ב-`generate-cards --apply` ב-23:16:39 (אחרי הסגירה): `platform/test/CLAUDE.md` (ספירת קבצים 11→12, נוספו browser.mjs גודל ו-tokens-sync.test.mjs), `studio/CLAUDE.md`, `studio/dashboard/CLAUDE.md`. אין שינוי קוד.

## 2. שום דבר אחר לא השתנה
- PASS — `js/apartment-3d.js` ו-`tools/build_zip.mjs` אינם ב-`files[]` של המניפסט; רק ב-`released` (sha256_at_open בלבד, אין close). הם שונים מהגיבוב הפתוח בחי כי rnd-fd שינה אותם — לא הלוח הזה.
- PASS — `flow.js`, `viewer360.js`, `cine.js`: open == close בדיוק בכל שלושה.
- PASS — אף קובץ שרת/API של Studio לא שונה (ב-`files[]` רק `pipeline/*` ו-CLAUDE.md; אף אחד מהם לא שרת וה-API לא ברשימה). בדיקת שינוי: אין שורת CHANGED לאף נתיב מחוץ לתחום.
- הערה: 4 קובצי CLAUDE.md ב-`released` — החי חדש יותר, נשמר החי (בהתאם).

## 3. תצוגה חיה (:8852, Edge headless, 1440×900 ו-390×844; `qa-live-preview.txt`)
בבית, `landing.html?project=rainbow`, `apartment.html?project=rainbow&unit=846`, בשתי המארחות (127.0.0.1 ו-buyer.test):
- PASS — 0 שגיאות קונסולה/pageerror בכל 12 הצירופים (×2 מארחים).
- PASS — 0 תגובות 4xx/5xx.
- PASS — גופנים נטענו (Heebo + Frank Ruhl Libre, `document.fonts.check('Heebo')`=true; body font-family=Heebo); 0 בקשות ל-Google Fonts.
- PASS — 0 תוויות DEV בתצוגת קונה (buyer.test); ב-127.0.0.1 מופיעות בעיצוב (בית: "TODO (dev only)", landing: `index-foot`) — כצפוי.
- PASS — ערכת נושא ברירת מחדל `data-theme="light"` בשלושת הדפים.
- PASS — אין גלישה אופקית (scrollWidth == innerWidth ב-1440 וב-390).

## 4. ה-Check (פקודה אחת בכל פעם)
| פקודה | תוצאה |
|---|---|
| smoke.mjs | PASS exit 0, all green (בסיס 12) |
| landing.test.mjs | PASS 35/35 |
| apartment.test.mjs | PASS all green (36) |
| card-overflow.test.mjs | PASS 18/18 |
| flow-real.test.mjs | PASS 38/38 |
| flow-cine.test.mjs | PASS 43/43 (ללא ריצה חוזרת, לא נדרש) |
| tokens-sync.test.mjs | PASS, כל ההעתקים שווים למקור |
| browser.mjs (שרת :8852) | PASS 25 ok, 0 כשלים |
| tools/contrast.mjs --project fixtures/rainbow/project.json | PASS 0 זוגות נכשלים בנושא, 0 צריכי fallback |
| Studio `test/run.mjs` (חי) | CANNOT-RUN — `ERR_MODULE_NOT_FOUND`: ל-`studio/` החי אין node_modules (zod). כרטיס 08 התקין רק בעותק העבודה; לא שינוי של הלוח הזה. |

## 5. סביבה
- :8852 ו-:8853 פנויים בסיום (שרת נהרג לפי PID, netstat ריק).
- הערות שוליים: landing.test כותב צילומים ל-`platform/_local/landing-test/shots` ו-apartment.test ל-Temp (פלט מקומי של הבדיקות עצמן, לא קבצי מוצר). נבדקו shots ב-scratchpad לשאר.

## רשימת ליקויים
אין FAIL. CANNOT-RUN אחד: Studio חי (תלות חסרה, OWED דומה ל-OWED-023 — דורש `npm ci` ב-studio החי בהוראת אלירן).
