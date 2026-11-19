# תכנית ה-Frontend של מערכת ההדמיות
<!-- 2026-11-08 · main session · research plan: 2026-11-08-frontend-research.md · siblings: 2026-11-08-visualization-stack-architecture.md, 2026-11-08-backend-plan.md -->

**למי:** אלירן, וכל מפתח שיצטרף.
**עמוד לקריאה:** https://claude.ai/artifact/6mZtm2ofVc91JKTQCkb4Wt#frontend (לשונית Frontend בעמוד המאוחד)
**היקף (אלירן, 2026-11-08):** מערכת ההדמיות. קונים צופים באופן אנונימי. אין חיוב. אין התממשקות למערכות של היזם. כלל קבוע: כל מסך עובד ב-390 (טלפון) וב-1440 (דסקטופ).
**עדכון אלירן (2026-11-08):**
- **מאפס:** ארכיטקטורה מאפס.
- **היקף יעד:** 10–100 פרויקטים בחודש.

**ההשלכות:**
- **מסלול F0–F7 (§14) הוא רק הפניה.** אין parity מחייב מול הסיור הקיים. רשימת §6.3 היא רשימת יכולות רצויות, לא דרישת תאימות.
- **ממה מתחילים:** הרכיב `<habait-tour>` נבנה ישר על PSV עם אריחים. Pannellum לא נכנס בכלל.

**מה זה לא:** החלטה, וגם לא עיצוב מסכים. כל מעבר בפועל מחכה ל-board נפרד.

**איך נאסף:** ארבעה סוכנים.
- מיפוי מעמיק של ה-frontend הקיים (Explore).
- מחקר ארכיטקטורת אפליקציה.
- מחקר הסיור, תלת-ממד וביצועים בטלפון.
- סוכן אימות שבדק כ-38 טענות מול מקורות רשמיים, כולל גרסאות מ-npm registry.

**מה לא אומת:** דפי gov.il (חוק הנגישות ותיקון 13) חוסמים גישה אוטומטית, ולכן הסעיפים המשפטיים מבוססים על מקורות משניים בלבד. מה שלא אומת מסומן **(לא מאומת)**.

---

## 0. התשובה הקצרה

| חלק | הבחירה | למה, במשפט |
|---|---|---|
| **Framework** | Next.js 16.4 (App Router, Cache Components) + React 19 + TypeScript | עמודים ציבוריים מהירים עם SSR, ופורטל אפליקטיבי, בקוד אחד |
| **רינדור** | עמודי קונה: shell סטטי + cache לפי tag. עמוד סיור: shell סטטי עם תמונת פתיחה, והסיור נטען בצד הלקוח. פורטל: דינמי | כשדירה נמכרת מתעדכנת רק השורה שלה. ה-canvas לא נספר ב-LCP, אז תמונת הפתיחה היא ה-LCP |
| **הסיור** | `<habait-tour>`: Web Component על PSV 5.15 + three 0.185, עם store פנימי (Zustand vanilla) | רכיב אחד ל-Next.js, לקובץ סטטי ולהטמעה. לא תלוי ב-React |
| **פנורמות** | בסיס 2048×1024 מטושטש, ואריחים עד 4096×2048 (equirect-tiles). ‏WebP. ‏URL לפי hash | בטלפון הזיכרון הוא המגבלה. 4096 בטוח, ו-8192 רק בדסקטופ |
| **בית בובות** | נטען רק כשפותחים אותו, משתף את ה-three של PSV. ‏GLB דחוס (Meshopt) | היום הוא קובץ של 3MB עם הכל בפנים |
| **Data ו-state** | Server Components לקריאה, Server Actions לשינוי. ‏Supabase Realtime להתקדמות jobs | בלי SSE על Vercel. עבודות של 10–40 דקות |
| **טפסים והעלאה** | react-hook-form 7.91 + zod (אותן schemas כמו בשרת). ‏PDF עולה ישר ל-Supabase Storage | ל-function ב-Vercel יש תקרה של 4.5MB לבקשה |
| **עורך תיקוני trace** | react-konva 19.3 (canvas), ובנוסף רשימת קירות ופתחים לעריכה מהמקלדת | דיוק בגרירה. canvas לא נגיש, ולכן יש חלופה |
| **Design system** | חבילת tokens אחת, שממנה נוצרים גם Tailwind v4 `@theme` וגם CSS vars לסיור. ‏shadcn/ui ב-RTL | מקור אחד לצבעים ולגופנים בשני העולמות |
| **שפות** | next-intl 4.14 עם `/he` ו-`/en` (עברית ברירת מחדל). ‏Intl `he-IL`, ‏₪ | קישורים לפי שפה ו-hreflang |
| **נגישות** | בונים ל-WCAG 2.2 AA (מעל IS 5568), עם הצהרת נגישות. בלי וידג'ט overlay | עמידה בחוק נבנית בקוד, לא נקנית |
| **אנליטיקס ושגיאות** | PostHog ב-`cookieless_mode`, ‏Sentry | קונה אנונימי, בלי cookies. היום אין מעקב שגיאות בכלל |
| **בדיקות** | שער 390/1440 הקיים, Vitest, ‏Playwright בערוץ `chromium` (ל-WebGL), ‏Storybook 10, ‏Lighthouse CI, ובדיקה על אייפון אמיתי | שומרים מה שעובד, ומוסיפים מה שחסר |
| **Embed** | iframe כברירת מחדל, עם postMessage API. ‏Web Component כאופציה | בידוד מלא באתר של מישהו אחר. **בהמשך:** ההתממשקות ליזם מחוץ להיקף כרגע |

**ממצאים מהקוד הקיים:**
- **אין מדידת משקל עמודים בכלל.** זה הצעד הראשון.
- **הפנורמות היום קלות:** 2048×1024 WebP, ‏165–284KB לחדר. אבל הן לא חדות בזום.
- **אין gyroscope בסיור**, ואין מעקב שגיאות.
- **מפתח PostHog ריק**, כך שהאירועים לא נשלחים לשום מקום.
- **שלוש גרסאות three** (0.170, ‏r187, ‏0.185) בשלוש אפליקציות.
- **אפשר להתחיל מהעבודה הקיימת:** נגישות בסיסית (ARIA, מקלדת, reduced motion), RTL (`bdi`, לוגי), ושער רספונסיבי 390/1440.

---

## 1. המשטחים והמסכים

### 1.1 היום (habait-flow.vercel.app)

| כתובת | מה | קבצים |
|---|---|---|
| `/` | בית פרויקטים: hero, כרטיסים, החלפת שפה | `platform/index.html`, ‏`js/config.js`, ‏`i18n.js` |
| `/landing.html` | ניסוי A/B עם טופס לידים | `js/landing.js`, ‏`lead.js` |
| `/apartment.html` | דירה: 5 לשוניות (סיור, תוכנית, תמונות, 3D, אודות) | `js/apartment.js` |
| `/hold/` | flyover של הבניין ב-three.js, עם בחירת דירה | יושב ב-`research/…/flyover3d` (OWED-016) |
| `/tour/` | הסיור: קובץ אחד של 384KB | `tour360/dist/apt846/index.html` (‏`tour.js` 117KB, ‏`edit-live.js` 57KB, ‏`tour.css` 73KB) |
| `/studio/` | פורטל יזם עם Clerk ו-pdf.js | `studio-web/` |
| `/p/<pid>/` | פרויקט שפורסם מהפורטל | `api/studio-pub.mjs` |

### 1.2 היעד

**קונה (ציבורי, אנונימי):**

| מסך | נתיב | תוכן |
|---|---|---|
| עמוד פרויקט | `/[locale]/p/[project]` | hero, הבניין (flyover/orbit), מפת קומות, דירות לפי סטטוס (פנויה/שמורה/נמכרה), שיתוף |
| עמוד דירה | `/[locale]/p/[project]/u/[unit]` | סיור, תוכנית, תמונות, 3D, פרטים. הלשונית נשמרת ב-URL |
| סיור במסך מלא | `/[locale]/t/[tour]` | `<habait-tour>` בלבד: שיתוף, שינוי עיצוב, ריצוף, ריהוט |
| Embed (בהמשך) | `/e/[tour]` | אותו סיור, מותאם ל-iframe |

**יזם (פורטל, Clerk):**

| מסך | נתיב | תוכן |
|---|---|---|
| פרויקטים | `/[locale]/studio` | רשימה, סטטוס, יצירת פרויקט |
| פרויקט | `/studio/[project]` | בניינים, דירות, עבודות פעילות |
| העלאה | `/studio/[project]/upload` | PDF, התקדמות העלאה |
| אישור spec | `/studio/units/[unit]/spec` | מה ה-AI קרא, תיקון ואישור |
| תיקון trace | `/studio/units/[unit]/trace` | העורך (§5), דוח מידות מול המודפס |
| התקדמות | `/studio/units/[unit]/job` | שלבים בזמן אמת, שגיאות, עלות |
| תצוגה מקדימה ופרסום | `/studio/units/[unit]/publish` | הסיור לפני פרסום, בדיקת סימון AI, פרסום |

---

## 2. רינדור (Next.js 16)

- **Cache Components** (`cacheComponents: true`, ברירת המחדל ב-`create-next-app`):
  - PPR הוא מודל הרינדור.
  - `"use cache"` עם `cacheLife` ו-`cacheTag`.
  - מה שלא ב-cache עטוף ב-`<Suspense>` ומגיע אחרי ה-shell (nextjs.org/docs, ‏2026-10-06).
- **עמודי קונה:**
  - ה-shell ונתוני הפרויקט ב-cache עם `cacheTag('project:<id>')`.
  - סטטוס הדירות בתוך `<Suspense>`.
  - כשיזם משנה סטטוס בפורטל, Server Action קורא ל-`updateTag`. ‏`updateTag` עובד **רק** מתוך Server Actions (nextjs.org, ‏2026-08-18).
  - כשסיור מתפרסם מה-worker, הרענון עובר דרך route handler (revalidate לפי tag).
- **עמוד סיור:**
  - shell סטטי ו-`<img>` של החדר הראשון (WebP, ‏`fetchpriority="high"`) כ-LCP.
  - ה-viewer נטען ב-`next/dynamic({ ssr:false })` **מתוך Client Component**. ב-Server Component זה אסור (nextjs.org, ‏2026-03-10).
  - ה-canvas נכנס מעל התמונה אחרי שהאריח הראשון צויר. ‏`<canvas>` לא נספר כ-LCP (web.dev).
- **פורטל:** דינמי מלא, מאחורי Clerk.
- **תצוגה מקדימה לשיתוף (OG):** נוצרת **בצעד ה-package של ה-pipeline** כ-PNG קבוע.
  - למה לא `next/og`: ל-Satori יש RTL חלקי, ו"reordering text with inline elements" לא נתמך (README). מספרים ומחירים בתוך עברית עלולים להתהפך.
  - כך התמונה גם דטרמיניסטית, כמו כל צעד אחר.
- **מה ויתרנו:** Cache Components הוא מודל חדש, וצריך ללמוד את כללי ה-blocking routes. ה-cache תקף לכל deploy בנפרד.

---

## 3. Data ו-state

| צורך | הבחירה | הערה |
|---|---|---|
| קריאה בפורטל | Server Components | ישר מ-Postgres עם RLS |
| שינוי | Server Actions + zod | אותן schemas כמו ב-API (`packages/schemas`) |
| רשימות שמתעדכנות | TanStack Query, רק שם | polling ועדכון אופטימי (לא מאומת) |
| התקדמות job | Supabase Realtime על `job_steps`, ו-polling כל 5 שניות כגיבוי | עובד עם RLS. ב-Pro: ‏500 חיבורים ו-500 הודעות בשנייה (docs, אומת). מספיק לפורטל |
| state של הסיור | store ב-`zustand/vanilla` בתוך `packages/viewer` | עובד בלי React (README, אומת) |
| URL של הסיור | אותם פרמטרים כמו היום: `room, yaw, floor, look, lang…` | ב-Next.js: ‏nuqs 2.10 עם `limitUrlUpdates: throttle(100)`. ‏`throttleMs` הוצא משימוש |

**למה לא SSE:** בעבודה של 40 דקות, מגבלות זמן של function שוברות stream ארוך.

---

## 4. טפסים והעלאה

- **טפסים:**
  - react-hook-form ‏7.91 + ‏@hookform/resolvers ‏7.0, שתומך ב-zod v4 (npm, אומת).
  - רכיב `Form` של shadcn.
  - submit דרך Server Action.
- **העלאת PDF:**
  - ישר מהדפדפן ל-Supabase Storage עם `createSignedUploadUrl`, שתקף לשעתיים.
  - לקבצים גדולים: TUS resumable עם chunks של 6MB (docs, אומת).
  - **לא דרך function ב-Vercel**, שיש לו תקרה של 4.5MB (‏413 `FUNCTION_PAYLOAD_TOO_LARGE`, ‏docs 2026-08-24).
  - גודל קובץ מקסימלי ב-Pro: לא מאומת.
- **אחרי ההעלאה:** הצגה מקדימה ב-pdf.js (קיים), בחירת עמוד התוכנית, ושליחה.

---

## 5. עורך תיקוני ה-trace

- **מנוע:** react-konva ‏19.3 + konva ‏10.9. דורש React 19.3 ומעלה (npm, אומת).
- **מודל:** קירות ופתחים כ-JSON ב-zod, נפרד מהציור. העורך רק מצייר ומשנה את המודל, ולכן אפשר לבדוק אותו.
- **פעולות:** גרירת קצה קיר, הזזת פתח, שינוי רוחב, snap לקירות, undo/redo, ותצוגת מידה מול המידה המודפסת עם הדוח הקיים של `trace_check`.
- **RTL:**
  - ה-canvas ב-`dir=ltr`, כי קואורדינטות לא מתהפכות.
  - סרגל הכלים והפאנלים ב-RTL.
  - שדות מספר ב-`dir="ltr"`.
- **נגישות:** טבלת קירות ופתחים לעריכה מהמקלדת, כחלופה ל-canvas.
- **שימוש חוזר:** הלוגיקה של מסך התיקון הקיים, `engine/correct/serve.mjs`.
- **מה ויתרנו:** SVG נקי פשוט ונגיש יותר, אבל כבד בתוכניות גדולות. ‏Fabric.js פחות מתאים ל-React. ‏tldraw הוא מוצר שלם עם רישוי.

---

## 6. הסיור: `<habait-tour>`

### 6.1 מנוע
- **ליבה:** PSV ‏5.15.1 עם three ‏^0.185.1 (npm, אומת).
- **פלאגינים:**
  - **virtual-tour:** חדרים, קישורים, מעברים, `preload` לחדרים סמוכים. ‏`renderMode` ‏3d.
  - **markers:** טבעות ריהוט, נקודות מידע.
  - **equirectangular-tiles:** אריחים עד 1024 לפי ההמלצה בתיעוד, ובסיס מטושטש בזמן טעינה.
  - **gyroscope:** חדש, כי אין היום בסיור. HTTPS בלבד. באייפון ההרשאה ניתנת רק מלחיצה. ב-iframe צריך `allow="accelerometer; gyroscope"`.
  - **gallery / plan:** רשימת חדרים ומפה קטנה.
- **סיכון ידוע:** issue ‏#1303 ב-iOS ("Unable to detect system capabilities"). לא אומת שתוקן ב-5.15.1. בודקים על אייפון אמיתי.

### 6.2 ה-API של הרכיב
- **Attributes:** `tour-src`, ‏`lang`, ‏`room`, ‏`look`, ‏`floor`, ‏`ui`
- **Methods:** `goto(room)`, ‏`setLook(id)`, ‏`setFloor(id)`, ‏`openDollhouse()`
- **Events** (CustomEvent, ‏bubbling + composed):
  - `ready`
  - `roomchange {from,to}`
  - `lookchange {yaw,pitch,fov}`, עד 5 בשנייה
  - `designchange`
  - `error`
- **ב-iframe:** אותם שמות דרך postMessage `{source:'habait-tour', type, …}`, עם בדיקת `origin` בשני הכיוונים.
- **React 19:** מעביר props כ-properties כשיש property כזה ברכיב (react.dev, אומת). התמיכה ב-custom events לא מאומתת, אז עוטפים ב-hook קטן.

### 6.3 מה עובר מהסיור הקיים (רשימת parity)
- **ניווט:** חדרים, חיצי דלתות שפונים לכיוון ההליכה, fade של 650ms, ‏walk-in, hfov ‏40–130.
- **«שינוי עיצוב»:** פאנל בדסקטופ ו-bottom sheet בטלפון, עם look (מעוצב/מקורי), ריצוף (פרקט/בטון/שיש) ושורת הקלדה.
- **ריהוט:** החלפת רהיטים עם טבעות וקטלוג.
- **בית בובות:** כולל מעבר rise/dive.
- **שכבות נוספות:** coach marks, מדריך, סרגל, וידאו.
- **שפות:** he, ‏en ו-fr (קיים ב-`tour360-copy.json`).
- **נגישות:** ARIA, ‏Enter/Space על hotspots, ‏Escape, ו-reduced motion. כל אלה קיימים היום.

### 6.4 מה מתווסף
- **השוואה לפני/אחרי** (slider) בשינוי עיצוב.
- **הודעת שגיאה ברורה** כשספק AI נופל. היום חסימת fal (403) מוצגת לקונה כ«השינוי לא נטען».
- **gyroscope.**
- **רשימת חדרים ומפה קטנה.**
- **טיפול באובדן WebGL context:** `webglcontextlost` ו-`webglcontextrestored`, עם כפתור "טען מחדש".
- **טלמטריה:** אירועי `room_view` ו-`designchange` מהסיור עצמו. היום הוא רק שולח `habait:view` להורה.

### 6.5 מעברים
- **ברירת מחדל:** fade עם סיבוב לכיוון הקישור.
- **rise/dive:** נבנה מחדש עם `viewer.animate()` על FOV ו-pitch, ואחריו fade.
- **60fps בטלפון:**
  - החדר היוצא בבסיס הנמוך.
  - בלי אריחים בזמן המעבר.
  - DPR עד 2.

---

## 7. ביצועים בטלפון

### 7.1 מגבלות
- **WebGL:** ‏`MAX_TEXTURE_SIZE` של 4096 דווח גם על Pixel 4a וגם על iPad Pro.
- **זיכרון:** הקריסות קשורות לזיכרון כולל ("Total canvas memory use exceeds the maximum limit (256mb)").
- **החשבון:**
  - 4096×2048 RGBA הם 32MB, ו-~43MB עם mips.
  - 8192×4096 הם ~170MB.
  - שתי פנורמות במעבר מכפילות את זה.

### 7.2 תקציב (המלצה. מודדים לפני שקובעים)

| פריט | תקציב | היום |
|---|---|---|
| תמונת פתיחה (LCP) | ≤ 100KB WebP | אין |
| JS של עמוד הסיור | ≤ ~250KB gzip (PSV + three) **(לא מאומת, למדוד)** | 384KB inlined עם Pannellum |
| חדר ראשון | ≤ 600KB | 165–284KB (2048 בלבד) |
| פנורמה בטלפון | עד 4096×2048 באריחים. 8192 רק בדסקטופ | 2048×1024 |
| פנורמות בזיכרון | עד 2, ופינוי מיד | לא מנוהל |
| זיכרון GPU | ~100MB | לא נמדד |
| בית בובות | ≤ 2MB גיאומטריה, טקסטורות ≤ 2048 | ‏`dollhouse.html` ‏3.03MB inlined |
| וידאו flyover | MP4 H.264 ‏720–1080p, ‏3–8MB, ‏poster, ‏`muted playsinline` | ‏guide ‏57MB בתיקייה |

### 7.3 פורמטים ומשלוח
- **אריחים:** WebP באיכות 80–85, ‏JPEG כגיבוי.
- **AVIF:** לא לאריחים, כי ה-decode בטלפון כבד יותר (לא מאומת).
- **JPEG XL:** בהמשך. ‏Safari 17+ ו-Chrome 155 (2026-10-06) תומכים, אבל עדיין לא כפורמט יחיד.
- **KTX2:** לבית הבובות בלבד. על שמיים ומשטחים חלקים יש artifacts.
- **חיתוך אריחים:** `vips dzsave` (דטרמיניסטי), עטוף ב-`tileUrl`.
- **Cache:** ‏`Cache-Control: public, max-age=31536000, immutable` על URL לפי hash.
- **preload לחדרים סמוכים:** רק אם `saveData` כבוי. ‏Safari לא חושף `navigator.connection`.
- **בית בובות:** נטען ב-`import()` רק כשפותחים, ו-preload כשהדפדפן פנוי.
  - כיווץ: ‏`gltf-transform optimize --compress meshopt --texture-compress webp`.
  - three אחד, משותף עם PSV.
- **וידאו:** MP4 על CDN. ‏Cloudflare Stream ($5 ל-1,000 דקות אחסון ו-$1 ל-1,000 דקות צפייה) רק לסרטונים ארוכים.

### 7.4 Core Web Vitals
- **LCP:** תמונת הפתיחה.
- **CLS:** `aspect-ratio` שמור מראש.
- **INP:** בלי עבודת WebGL בתוך handlers. ‏`lookchange` מוגבל בקצב.
- **מעקב:** Lighthouse CI עם תקציבים על העמודים הציבוריים.

---

## 8. Design system

- **מקור אחד:** `packages/tokens`.
  - בנוי מ-`platform/css/tokens.css` הקיים: צבעים ב-LCH, ‏`--brand-*` ל-white-label, ‏`--chrome-*` לפקדים מעל מדיה, ו-motion שמתאפס ב-reduced motion.
  - יוצאים ממנו שני קבצים: `theme.css` ל-Tailwind v4 (`@theme`) ו-`vars.css` לסיור.
  - בתיעוד של Tailwind מופיע `oklch`, לא `lch`. ההמרה מ-LCH ל-OKLCH בסקריפט דטרמיניסטי (קיים: `lch_ramp.py`).
- **מצב כהה:** `@custom-variant dark` על `data-theme`.
  - הפלטפורמה בהירה כברירת מחדל.
  - הסיור כהה בלבד, וכך נשאר.
- **רכיבים:** shadcn/ui עם `rtl: true` ב-`components.json`, או `--rtl` ב-init.
  - shadcn ממליץ על `DirectionProvider` של ה-framework (docs, אומת).
  - ה-migration לא idempotent: מריצים פעם אחת ועושים commit מיד.
- **גופנים:** `next/font/google`.
  - Heebo (‏`hebrew`, ‏`latin`) ו-Frank Ruhl Libre (‏`hebrew`, ‏`latin`) אומתו.
  - הסיור משתמש היום ב-Heebo + Assistant. מאחדים ל-Heebo.
- **מה ויתרנו:** בלי עבודה על tokens, הפורטל ייראה כמו shadcn דיפולטי.

---

## 9. שפות ו-RTL

- **ספרייה:** next-intl ‏4.14.9, עם peer ל-next ^16 ו-react ^19 (npm, אומת).
- **מבנה URL:** segment ‏`[locale]` (‏`/he`, ‏`/en`), עברית ברירת מחדל, ‏`<html lang dir>` לפי השפה, ‏hreflang.
- **רינדור סטטי:** `setRequestLocale` מוגדר עכשיו כ-legacy. ‏`next/root-params` הוא הדרך המומלצת.
- **פורמטים:** `Intl` עם `he-IL` / `en-IL`, ‏`currency: 'ILS'`, תאריך dd.mm.yyyy.
- **הסיור:** ממשיך לקרוא מ-`tour360-copy.json` (‏he/en/fr).
- **bidi:** הכללים הקיימים נשמרים: `<bdi>` למספרים וללטינית, ‏`dir="auto"` בשדות, הפנורמה ב-`dir="ltr"`, ‏CSS לוגי בלבד.
- **בדיקה:** גלישה ב-RTL נבדקת בשני הצדדים. ה-overflow script בסקיל מפספס RTL (HOT).

---

## 10. נגישות

- **החוק** (מקורות משניים, כי gov.il חסום לגישה אוטומטית):
  - תקנות שוויון זכויות לאנשים עם מוגבלות (2013) מפנות ל-IS 5568, שמבוסס על WCAG 2.0 ברמה AA. כך כתוב בהצהרות הנגישות של משרדי ממשלה.
  - חובת הצהרת נגישות וספי פטור: **לא מאומת**. שאלה לעורך דין.
- **ההמלצה:** בונים ל-**WCAG 2.2 AA**, שמכיל את 2.0 AA, ומפרסמים הצהרת נגישות עם רכז ופרטי קשר. טיוטה קיימת: `development/tasks/platform-ui-ux/accessibility-statement-draft-he.md` (OWED-024).
- **בלי וידג'ט overlay.** הוא לא הופך אתר לנגיש (לא מאומת בסבב הזה).
- **נגישות הסיור:**
  - מקלדת: חצים לסיבוב, ‏+/- לזום, focus גלוי.
  - רשימת חדרים כטקסט, כחלופה.
  - בלי autoplay ו-autorotate ב-reduced motion.
  - כפתור עצירה.
  - חלופת גלריה בלי 3D.
- **מה כבר קיים:** ARIA, ‏Enter/Space על hotspots, ‏Escape, ‏reduced motion בסיור, ו-roving tabindex עם חצים ב-RTL בעמוד הדירה.

---

## 11. אנליטיקס, פרטיות ושגיאות

- **PostHog:**
  - `cookieless_mode: 'always'`: בלי cookies ובלי storage (docs, אומת).
  - צריך להפעיל אותו גם בהגדרות הפרויקט ב-PostHog, אחרת האירועים נזרקים.
  - היום יש 14 אירועים מוגדרים (`platform/js/analytics.js`), אבל המפתח ריק.
- **תיקון 13 לחוק הפרטיות** (בתוקף מאוגוסט 2025):
  - הנחיה רשמית על cookies ואנליטיקס: **לא נמצאה**.
  - בלי cookies אין צורך בבאנר (לא מאומת). זו שאלה משפטית.
- **אירועים חדשים מהסיור:** `room_view`, ‏`designchange`, ‏`dollhouse_open`, ‏`share`, ‏`gyro_on`.
- **Sentry:** תומך ב-Next.js 14 ומעלה ודורש Node 20.19 (docs, אומת). היום אין מעקב שגיאות בכלל.

---

## 12. בדיקות

| שכבה | כלי | הערה |
|---|---|---|
| שער רספונסיבי | `tools/qa/responsive-gate.mjs` (קיים) | 1440 ו-390: שגיאות, 4xx, גלישה בשני הצדדים, יעדי 44px, פקדים שמכסים יותר מ-15% מהפנורמה |
| Unit / רכיבים | Vitest + Testing Library | העורך, ה-store של הסיור, הפורמטים |
| e2e | Playwright, ‏`devices['iPhone 13']` | WebGL נבדק בערוץ `chromium`, לא ב-headless shell, שמרנדר אחרת (docs, אומת) |
| הסיור | דרך ה-API והאירועים, וצילומים נבחרים | לא pixel diff על כל canvas |
| רכיבים ויזואליים | Storybook ‏10.6 (`nextjs-vite`) | ל-`packages/ui` ולפקדי הסיור |
| ביצועים | Lighthouse CI | תקציבי LCP ו-CLS |
| מכשיר אמיתי | אייפון עם 3–4GB ואנדרואיד חלש, לפני כל גרסת viewer | ‏BrowserStack אופציונלי (מחיר לא מאומת) |
| שערים קיימים | `smoke.mjs`, ‏`paint-proof.mjs`, ‏`live-check.mjs` | נשארים. ‏`qa_chain.cjs` לא עובד (OWED-026) |

---

## 13. מבנה הקוד

```
apps/web/
  app/[locale]/(public)/p/[project]/…      עמודי קונה
  app/[locale]/(public)/t/[tour]/           סיור במסך מלא
  app/[locale]/(portal)/studio/…            פורטל (Clerk)
  app/e/[tour]/                             embed (בהמשך)
  app/api/…                                 ה-API (תכנית ה-backend)
packages/
  tokens/     מקור אחד → theme.css (Tailwind) + vars.css (סיור)
  ui/         shadcn RTL
  viewer/     <habait-tour>: Vite library mode → ESM + IIFE
  schemas/    zod/JSON Schema משותף עם ה-backend
```

---

## 14. מסלול המעבר של ה-frontend

| שלב | מה | נשאר / מוחלף |
|---|---|---|
| **F0 · מדידה** | baseline של משקל וזמן ל-`/`, ‏`/hold/`, ‏`/tour/`, ‏`/studio/` ב-390 וב-1440. ‏Pannellum 2.5.7. גרסה אחת של three | הכל נשאר |
| **F1 · tokens** | `packages/tokens` מתוך `tokens.css`, עם שני קבצי פלט | `tokens.css` נוצר מהחבילה |
| **F2 · viewer** | `<habait-tour>` על PSV עם רשימת parity (§6.3). רץ מאחורי `?engine=psv` בסיור הקיים. בדיקה על אייפון אמיתי | Pannellum נשאר עד שה-parity עובר |
| **F3 · משלוח** | אריחים 4096, בסיס מטושטש, תמונת פתיחה כ-LCP, פיצול בית הבובות ו-Meshopt | — |
| **F4 · שלד Next.js** | `apps/web` עם next-intl, ‏shadcn RTL ו-Sentry. מסכי הפורטל עוברים מ-`studio-web/` אחד-אחד דרך rewrites | ‏`studio-web` נסגר בסוף |
| **F5 · עורך** | עורך תיקוני ה-trace ב-react-konva | מחליף את `engine/correct/serve.mjs` |
| **F6 · אתר קונה** | עמודי פרויקט ודירה ב-Next.js, ‏OG מה-pipeline, ‏PostHog cookieless. ‏`/hold/` יוצא מ-`research/` (OWED-016) | `platform/` מוחלף |
| **F7 · embed** | `/e/[tour]` + postMessage + רשימת origins | בהמשך, כשההתממשקות ליזם תחזור להיקף |

**סיכונים:**
- **iOS:** issue ‏#1303 והרשאת gyroscope בתוך iframe.
- **גרסאות:** react-konva דורש React 19.3.
- **מודל חדש:** Cache Components.
- **אפליקציות במקביל:** שתי אפליקציות רצות יחד בזמן המעבר. לכן כל שלב הוא board משלו, עם worktree ו-QA cards (§8.7, §8.9).

---

## 15. שאלות פתוחות (לשלב ההחלטה)

1. **משפטי:** ספי פטור וחובת הצהרת נגישות. האם PostHog בלי cookies פטור מבאנר לפי תיקון 13?
2. **צרפתית בסיור:** קיימת היום. להמשיך לתחזק אותה?
3. **הסיור כהה והפלטפורמה בהירה:** להשאיר את הפיצול?
4. **מכשירי בדיקה:** אייפון ישן ואנדרואיד חלש פיזיים, או BrowserStack?
5. **Embed:** מתי הוא חוזר להיקף?

---

## מקורות (נבדקו ב-2026-11-08)
- **Next.js:**
  - https://nextjs.org/docs/app/getting-started/caching (2026-10-06)
  - https://nextjs.org/docs/app/api-reference/functions/updateTag (2026-08-18)
  - https://nextjs.org/docs/app/guides/lazy-loading (2026-03-10)
- **i18n, טפסים, state:**
  - https://next-intl.dev/docs/routing/setup
  - https://nuqs.dev/docs/options
  - https://react.dev/blog/2024/12/05/react-19
  - https://github.com/pmndrs/zustand
  - גרסאות מ-registry.npmjs.org: next 16.4.5, ‏next-intl 4.14.9, ‏nuqs 2.10.2, ‏react-hook-form 7.91.0, ‏@hookform/resolvers 7.0.3, ‏react-konva 19.3.2, ‏konva 10.9.1, ‏storybook 10.6.6, ‏@photo-sphere-viewer/core 5.15.1
- **OG:** https://github.com/vercel/satori (RTL חלקי)
- **Vercel:** https://vercel.com/docs/functions/limitations (2026-08-24)
- **Supabase:**
  - https://supabase.com/docs/guides/storage/uploads/resumable-uploads
  - https://supabase.com/docs/guides/realtime/postgres-changes
  - https://supabase.com/docs/guides/realtime/quotas
- **עיצוב:**
  - https://tailwindcss.com/docs/theme
  - https://tailwindcss.com/docs/dark-mode
  - https://ui.shadcn.com/docs/changelog/2026-01-rtl
  - https://ui.shadcn.com/docs/rtl
- **ניטור ובדיקות:**
  - https://docs.sentry.io/platforms/javascript/guides/nextjs/
  - https://posthog.com/docs/libraries/js/config
  - https://playwright.dev/docs/emulation
  - https://playwright.dev/docs/browsers
  - https://storybook.js.org/docs/get-started/frameworks/nextjs-vite
- **הסיור:**
  - https://photo-sphere-viewer.js.org/plugins/virtual-tour.html
  - https://photo-sphere-viewer.js.org/guide/adapters/equirectangular-tiles.html
  - https://photo-sphere-viewer.js.org/plugins/gyroscope.html
  - https://www.github.com/mistic100/Photo-Sphere-Viewer/issues/1303
- **WebGL וזיכרון:**
  - https://forum.babylonjs.com/t/ios-cannot-open-an-app-on-ios-browsers-memory-limit/40698
  - https://forum.babylonjs.com/t/loading-a-large-texture-in-the-background/36474
- **פורמטים, LCP ו-embed:**
  - https://developer.chrome.com/blog/jpeg-xl-in-chrome
  - https://web.dev/articles/lcp
  - https://gltf-transform.dev/cli
  - https://caniuse.com/mdn-api_element_requestfullscreen
  - https://bugs.webkit.org/show_bug.cgi?id=206854
  - https://kuula.co/help/embed-integration
  - https://developers.cloudflare.com/stream/pricing/

**ראיות מהריפו** (תחת `Projects/Habait/habait-walkaround/Habait/`):
- **אתר ופורטל:** `platform/` (‏`index.html`, ‏`js/*.js`, ‏`css/tokens.css`), ‏`studio-web/`.
- **הסיור:** `tour360/dist/apt846/` (משקלים שנמדדו), ‏`tour360/viewer/`, ‏`tour360/engine/package.json`.
- **בדיקות ו-deploy:** `tools/qa/responsive-gate.mjs`, ‏`tools/deploy-vercel/stage_flow.py`.
