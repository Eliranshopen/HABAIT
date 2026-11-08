# Gate 1 — דוח QA (כרטיס 12): ניסיון הפרכה של כרטיסים 05, 10, 11

מבצע: מבקר QA טרי (Sonnet), לא כתב את מה שנבדק. 2026-11-03. $0, ללא git, ללא קריאת .env.
סביבה: עץ preview בתיקיית ה-scratchpad שלי (`...\scratchpad\gate1\preview\platform`), שנבנה עם `.wt/platform-ui-ux/tools/preview.py` (live לקריאה בלבד + העותקים של הלוח + three מ-apartment-3d). שרת :8852 בלבד, Edge headless, 1440x900 ו-390x844 (DPR 2). סקריפטי הבדיקה שלי: `C:\RnD\.wt\platform-ui-ux\tools\gate1\` (probe.cjs, tokens_pairs.cjs). פלט גולמי: `logs/gate1-*.txt`.
הערה על כלי הבדיקה: הדפדפן רץ עם `--host-resolver-rules=MAP buyer.test 127.0.0.1`, כך ש-`http://buyer.test:8852` הוא מבט הקונה (DEV=false) ו-`127.0.0.1` הוא מבט המפתח.

## פסק דין כולל: **FAIL — הכרטיס חוזר למחבר (כרטיס 11)**
`test/browser.mjs` (שורת Check בכרטיס 12) נופל ב-9 צעדים מול בסיס כרטיס 09 (25 ok, 0 FAIL). הגורם: כרטיס 11 החליף את `index.html` וה-selectors ש-`browser.mjs` תלוי בהם נעלמו. כל שאר הטענות עומדות, חוץ מפער מוצהר אחד (apartment.html) ושתי הערות.

## שורות Check (כרטיס 12)
| # | שורה | תוצאה | ראיה |
|---|---|---|---|
| C1 | `node tools/contrast.mjs --project …rainbow/project.json` | **PASS** exit 0, 0 theme fails, 0 brand fails | `gate1-contrast.txt` |
| C2 | `test/landing.test.mjs` | **PASS** 35/35 (= בסיס) | `gate1-landing.txt` |
| C3 | `test/card-overflow.test.mjs` | **PASS** 18/18 (= בסיס) | `gate1-overflow.txt` |
| C4 | `test/smoke.mjs` (בסיס 09) | **PASS** 12 ok, all green | `gate1-smoke.txt` |
| C5 | `test/browser.mjs http://127.0.0.1:8852` | **FAIL** 16 ok, **9 failure(s)**, exit 1 (בסיס: 25 ok, 0 FAIL) | `gate1-browser.txt` |
| C6 | probes של 05/10/11 על :8852 | ראו להלן | `gate1-styleguide/pages/home/mark/keyboard/edge/flowdev/hero.txt` |

### פירוט הכשל C5 (הפגם)
`test/browser.mjs:49-56` מחכה ל-`.project-card`, ל-`.project-card h2` ול-`.index-title` ב-`index.html`. כרטיס 11 כתב את `index.html` מחדש עם `.home-card` / `.hb-media-card__title` (h3) וללא `.index-title`; `grep project-card|index-title index.html css/home.css js/i18n.js` = 0 תוצאות (נשאר רק ב-`css/style.css`, שדף הבית כבר לא טוען). הצעד הראשון נכשל ב-`waitForSelector` (timeout 30s) ושמונת הצעדים האחרים נופלים בשרשרת (flow נכנס דרך כרטיס הפרויקט). הצעדים שנכשלו: index lists the rainbow project · language toggle · start overlay · time-based hotspot · segments chain · drag rotates · click 846 card · lead form · continue→descend.
המחבר הריץ את `browser.mjs` רק בכרטיס 10 (25 ok); ב-`logs/c11-home.txt` אין הרצה שלו אחרי שכתוב ה-index. התיקון האפשרי: לעדכן את ה-selectors בבדיקה (`test/` עבר לעותקי הלוח) או להוסיף את ה-classes. זה לא נוגע ל-flow עצמו, אבל בלי זה אין ראיה ש-index→flow עדיין עובד מקצה לקצה במבט דפדפן (לא הוכח ולא הופרך שהמסלול עצמו שבור).

## כרטיס 05 — tokens, fonts, components, styleguide
| שורת קבלה | תוצאה | ראיה |
|---|---|---|
| 05-1: פריימים 1440/390, 0 console errors, 0 h-scroll ב-390 | **PASS** — 4 ריצות (2 גדלים × 2 העדפות תנועה): errors 0, scrollWidth=clientWidth (1440/1440, 390/390), אין אלמנט שחורג מה-viewport; עמודות side-by-side ב-1440 ומוערמות ב-390 | `gate1-styleguide.txt`; פריימים של המחבר ב-`after/c05/` קיימים |
| 05-2: `fonts.check` Heebo + Frank Ruhl, woff2 200 same-origin, 0 Google | **PASS** — check1/check2 true; ושלא נסתפק בבדיקה ריקה (check מחזיר true גם כשאין @font-face): 7 FontFace מוצהרים, כולם `loaded` (Heebo 100-900 ×3, Frank 500/700 ×4); 7 woff2 כולם `200 http://127.0.0.1:8852`; google=0; תגובות ≥400 = 0 | `gate1-styleguide.txt`. תקציב first paint: 12,036+30,116+6,864 = 49,016 B ≤ 120 KB (מאומת בגודל קבצים) |
| 05-3: `contrast.mjs` exit 0, טקסט ≥4.5, UI ≥3, שני themes | **PASS** — חישבתי בעצמי (דפדפן + נוסחת WCAG, לא הכלי) 18 זוגות: light text/surface 15.67, text-muted/surface 5.89, line-strong/surface 4.09 (≥3), focus 7.10, sold-ink/bg 5.89, reserved 5.27, available 5.98, brand 7.26; dark 16.59 / 9.35 / 4.27 / 8.81 / 6.06 / 7.21 / 6.86 / 7.26. כולם תואמים לכלי. ניסיון הפרכה: project.json עם brand.primary `#f2f200` — הכלי תפס 4 זוגות כושלים וכתב fallback rule לכל אחד (exit 0 בכוונה), כלומר הכלי באמת בודק ולא מחזיר PASS קבוע | `gate1-contrast-own.txt`, `gate1-contrast-badbrand.txt` |
| 05-4: grep פיזי left/right ב-tokens.css/components.css | **PASS** — grep של הכרטיס מחזיר כלום (exit 1); גם grep רחב יותר (border-left/right, float, translate) ללא פגם | `gate1-logical-grep.txt` |
| 05-5: reduced-motion → `transition-duration: 0s` בכפתור | **PASS** — בכל 22 כפתורי `.hb-btn` 0s; ובנוסף סרקתי את כל האלמנטים בדף: max transition 0 ו-max animation 0 תחת reduce (ו-0.4s/2s בלי reduce, כלומר ה-media query באמת פועל) | `gate1-styleguide.txt` |

## כרטיס 10 — Phase 0 על הדפים
| שורת קבלה | תוצאה | ראיה |
|---|---|---|
| 10-1: מבט קונה (390, בלי `?dev`): 0 אלמנטים עם "תצוגת פיתוח"/"placeholders" ב-home, landing, flow; עם `?dev=1` מופיעים | **PASS (בהסתייגות)** — בקונה: visible=0 בשלושת הדפים בשני הגדלים (גם 1440). ב-DOM נשאר אלמנט מוסתר אחד עם הטקסט (`#fixtureNote` ב-flow, `#fixtureBadge` ב-landing, אחד ב-home), כלומר "0 elements" ברמת DOM מילולית לא מתקיים אלא ברמת מה שנראה; אני קורא את הקבלה כ"נראה". עם `?dev=1`: home ו-landing מציגים (visible=1). flow לא יכול להציג (flow.js מסתיר את ה-overlay; מוצהר בלוג של המחבר): אימתתי את השער בכפייה — buyer: display none גם אחרי הסרת `hidden`; dev: block | `gate1-pages.txt`, `gate1-flowdev.txt` |
| 10-2: בכל דף `fonts.check('16px Heebo')` true, 0 בקשות Google | **PASS לשלושה דפים / CANNOT-VERIFY→פער מוצהר ל-apartment.html** — home/landing/flow: Heebo FontFaces `loaded`, `CSS.getPlatformFontsForNode` מראה Heebo/Frank כ-custom font, google=0. ב-**apartment.html** אין `<link>` ל-tokens.css (הדף מוחזק; מוצהר ב-`c10-phase0.txt` ונדחה לכרטיס 16): `fonts.check` מחזיר true **ריק** (0 FontFace של Heebo), והפונט שמצויר בפועל הוא Times New Roman. כלומר "בכל דף" לא מתקיים עד כרטיס 16; ההצהרה כנה | `gate1-pages.txt` (שורות apartment) |
| 10-3: ניגוד סימן המפתח ≥3:1, נמדד עם קואורדינטות | **PASS** — מדידת פיקסלים עצמאית על הסימן כפי שהוא מצויר עכשיו בדף הבית (`.hb-media-card__mark`, אחרי שכתוב כרטיס 11), light+dark × desk+phone: הריבוע הכחול 6.57/6.65:1, ה-wordmark השחור 19.4/19.6:1 מול הלוח. הקשת הענבר 2.67/1.88:1 היא עיטור בתוך הריבוע (מוצהר גם אצל המחבר). **הערה:** ה-plate שהכרטיס 10 הוסיף (`.project-logo` ב-style.css, `#fffcf9`) כבר לא בשימוש בשום דף (אין `project-logo` ב-html/js); המדידה של כרטיס 10 נעשתה על מרכיב שכרטיס 11 החליף, ועכשיו ה-plate הוא `rgb(255 255 255 / .94)` ב-components.css. התוצאה עדיין עומדת | `gate1-mark.txt` |
| 10-4: landing.test ו-card-overflow.test ≥ בסיס | **PASS** — 35/35 ו-18/18 | C2, C3 |

## כרטיס 11 — דף הבית
| שורת קבלה | תוצאה | ראיה |
|---|---|---|
| 11-1: 8 פריימים + empty; 0 console errors; 0 h-scroll ב-390 | **PASS** — 8 ריצות שלי (light/dark × desk/phone × he/en, מבט קונה): errors 0, h-scroll 0 (1440/1440, 390/390), תמונות שבורות 0, אין טקסט dev גלוי, theme/bg נכון (light `rgb(255,252,249)`, dark `rgb(26,23,19)`). פריימי המחבר קיימים ב-`after/c11/` (4 + full + empty ×2 + focus). empty state: איקון + כותרת + טקסט + כפתור "לנסות שוב", גם כשה-projects.json ריק וגם כשהוא נכשל (abort) | `gate1-home.txt`, `gate1-edge.txt` |
| 11-2: סיכום הסטטוס = הנתונים | **PASS** — חישבתי מ-`fixtures/rainbow/units.json`: 12 יחידות, 7 `for-sale` → "12 דירות · 7 פנויות" (עברית) / "12 apartments · 7 available" (אנגלית), זהה בכל 8 הריצות. הכנסת קלט שובר (mock של units.json): יחידה אחת sold → "1 דירות · 0 פנויות" (חישוב נכון, ראו הערה N1); 404 → הסיכום נעלם (נכון) | `gate1-home.txt`, `gate1-edge.txt` |
| 11-3: grep ל-literals של צבע/רדיוס/font-family ב-`home.css` = 0 | **PASS** — grep שלי: 0 פגיעות אמיתיות (הפגיעה היחידה, שורה 14, היא `font-family: var(--font-display)` — אותו false-positive של regex שהמחבר ציין); אין hex/rgb/hsl/radius מספרי; יש `color-mix`/`linear-gradient` על tokens בלבד; אין style="…" עם צבע בתוך index.html | `gate1-homecss-grep.txt` |
| 11-4: סדר מקלדת (toggle → cards → CTA → footer) עם focus rings נראים | **PASS (בהסתייגות מוצהרת)** — 8 ריצות (light/dark × desk/phone × dev/קונה): Tab 1 = `a.home-brand`, 2 = `#langToggle`, 3 = `a.home-card__link` (ה-CTA הוא אותו קישור, stretched), ב-dev: 4 = `a.home-card__alt`, ואז יציאה מהדף. לכל עצור outline `solid 2px` (light `rgb(0,93,131)`, dark `rgb(128,190,224)`; על הכרטיס ה-ring הוא `::after`). הסדר שונה מהכרטיס בכך שה-brand נכנס ראשון, ו-footer לא ניתן להתמקד (אין עדיין קישור נגישות — מוצהר; נוסח הקישור של אלירן) | `gate1-keyboard.txt` |
| 11-5 (מה-What to do): `?theme=` מכוון, לא נשמר; ברירת מחדל light | **PASS** — dark/light נקבעים מה-URL בלבד; בלי פרמטר `data-theme="light"` | `gate1-home.txt` |

## שורת repo חי
| שורה | תוצאה | ראיה |
|---|---|---|
| ה-repo החי לא נגע: כל רשומה ב-`manifest.json` — sha256 חי = `sha256_at_open`; רשומות null אסור שיהיו חיות | **PASS** — 129 רשומות: 100 עם hash (0 drift, 0 חסרים) ו-29 חדשות (null), אף אחת לא קיימת חי. `wt.py status` מדווח "changed" רק על העותקים (כצפוי) ו-"unchanged" על שאר הרשומות. חיפוש קבצים חדשים מ-16:00 תחת `platform/`, `studio/`, `tools/deploy-vercel/` ב-Projects\Habait: אין | `gate1-live.txt`, `gate1-wtstatus.txt` |
| פורט :8852 חופשי בסיום | **PASS** — אין מאזין ב-885x (שרת ה-serve.mjs שלי פג בתוך ה-timeout 540; אומת ב-netstat) | netstat |

## הערות (לא הפרכות, לשיקול המחבר / אלירן)
- **N1** (תוכן, דף הבית): "1 דירות" ו-"0 דירות · 0 פנויות" כשהנתונים ריקים או `units: null` (הכרטיס אומר "0 דירות" במקום להשמיט את הסיכום). לא מתרחש בנתוני rainbow; עברית ללא צורת יחיד.
- **N2** (קריאות טקסט מעל תמונה, לא מכוסה ע"י contrast.mjs): כותרת/תת-כותרת ה-hero יושבות על ה-cover. מדדתי פיקסלים מאחורי כל שורה (טקסט מוסתר, צילום מסך): בערך ממוצע ≥4.5 כמעט בכל השורות, אבל ב-light/desk שורת התת-כותרת התחתונה 4.48:1 ובפיקסלים הבהירים ביותר 2.5–3.1:1 (האפקט מבוסס scrim + text-shadow). לא חלק מקבלת 05/10/11; מוזכר כי "כל זוג טקסט ≥4.5" ב-05 לא מכסה טקסט על תמונה. ראו `gate1-hero.txt`.
- **N3**: ב-flow.html ה-`#fixtureNote` מוצג ב-dev רק בכפייה (מוצהר). ב-apartment.html שגיאת רשת `127.0.0.1:8848` = שרת הסיור לא רץ (סביבה, לא פגם).
- **N4**: ה-DEV helper (`js/dev.js`) מוגדר רק במקום אחד, כנדרש ("אחד"); הוא גם מציב `data-dev="1"` על `<html>`, ועל זה נשען ה-CSS של flow. אין סטייה.

## סיכום
- PASS: 05 (5/5), 10 (3/4 + 1 פער מוצהר), 11 (5/5), repo חי, C1–C4.
- **FAIL: C5 `browser.mjs` — 9 צעדים (regression של כרטיס 11).**
- CANNOT-VERIFY / פער מוצהר: 10-2 ב-apartment.html (הדף מוחזק; לכרטיס 16).
- לפני בחירת ה-theme ע"י אלירן: לתקן את ה-selectors/ה-classes ולהריץ מחדש את `browser.mjs` (צפוי 25 ok), ואז לחזור על C5 בלבד.

## בדיקה חוזרת (אחרי תיקוני המחבר)
עץ preview נבנה מחדש; :8852 בלבד, נסגר לפי PID ואומת חופשי.

| # | פריט | תוצאה | ראיה |
|---|---|---|---|
| R1 | C5 `browser.mjs` | **PASS** — 25 ok, 0 FAIL, exit 0 (= בסיס 09) | `gate1-browser-rerun.txt` |
| R2 | האם הבדיקה נחלשה? | **PASS** — צעד 1 עדיין מאמת: כרטיס הפרויקט מוצג, `html[dir]=rtl`, כותרת הכרטיס מכילה Rainbow; צעד 2: הכפתור הופך ל-`dir=ltr` וכותרת הגלריה (`#galleryTitle`) תואמת /Projects/ (תחליף ל-/Choose a project/ — אותה כוונה: טקסט אנגלי של כותרת הדף); חזרה לעברית. רק ה-selectors הוחלפו, אף assertion לא הוסר | `test/browser.mjs` שורות 45-62 |
| R3 | index→flow: לחיצה על כרטיס הבית במבט קונה (buyer.test, 390 tap ו-1440 click) | **PASS** — נווט אל ה-hold החיצוני `http://127.0.0.1:8899/?tour=…&from=platform&project=rainbow&orbit=…/fixtures/rainbow/orbit_real.mp4`, ובדיוק לוגיקת היעד של ה-index החי v0 (`extUrl` + `orbit` inline, שורות 50-52). (ה-hold הוחלף ב-stub כי אינו רץ אצלי.) | `gate1-cardclick.txt` |
| R4 | יחיד/אפס בעברית | **PASS** — יחידה אחת sold → "דירה אחת · 0 פנויות"; total 0 / units null / 404 → אין סיכום; 12/7 עדיין "12 דירות · 7 פנויות" (עברית) ו-"12 apartments · 7 available"; 8 ריצות, 0 errors. הערה: "פנויה אחת" לא נבדקה בפועל (הדמיית יחידה אחת for-sale לא הורצה), רק הקיום של המפתחות ב-i18n | `gate1-edge2.txt`, `gate1-home2.txt` |
| R5 | ניגוד תת-כותרת ה-hero, light/desk, על הפיקסלים הבהירים ביותר | **PASS** — השורה התחתונה: ממוצע 9.63, p90 7.86, בהיר ביותר 7.68 (היה 4.48 / 3.1); כל שורות h1/p בכל 4 הצירופים light ≥5.09:1 גם בנקודה הבהירה ביותר | `gate1-hero2.txt` |

**פסק דין מעודכן: PASS.** כל שורות Check ירוקות (25/0 ב-browser.mjs), ה-FAIL של Gate 1 תוקן, הנותר: פער apartment.html המוצהר (כרטיס 16).
