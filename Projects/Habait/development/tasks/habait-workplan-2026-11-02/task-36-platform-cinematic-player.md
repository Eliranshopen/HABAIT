# משימה 36: נגן cinematic בפלטפורמה: טיסה כסרטון פוטוריאלי שטוח → עצירה נגררת (טבעת וידאו) עם תוויות דירות לפי פריים → ירידה → כניסה → סיור; לפחות כמו habait-flow

| שדה | ערך |
|---|---|
| **לוח** | `habait-workplan-2026-11-02` |
| **ערוץ** | D (platform) |
| **מקור בתכנית** | נפתח ב-3.11 09:40 שעון המכונה על ידי habait-1d אחרי המשוב של אלירן: "התוצאה ב-habait-platform ממש פחות טובה מ-habait-flow"; "תעשה מה שצריך כדי שיראה טוב". הטיסה של כרטיס 34 היא equirect clay לבן; הדמו של 98 הוא סרטון Kling פוטוריאלי + עצירה נגררת. |
| **סוכן** | `platform-dev` (`status: live`, `owner-track: habait`, `model: opus`) |
| **Ruling tier** | **T0** |
| **גל (wave)** | 8 |
| **מצב** | TODO |
| **זיכרון** | בלוק `## תוצאה` בסוף הכרטיס. |

## מטרה

רוכש פותח `flow.html?project=rainbow` בטלפון ורואה **אותה רמת ריאליזם כמו https://habait-flow.vercel.app** (פתח אותו בעצמך באמולציה וצלם, זו רמת הייחוס), בתוך המוצר של הפלטפורמה: טיסה = סרטון פוטוריאלי שטוח (cover-fit, בלי גרירה), נוחת בפוזת העצירה → **עצירה = טבעת וידאו פוטוריאלית שגוררים** (גרירה = סיבוב סביב המגדל, אינרציה, ריחוף איטי במנוחה) עם תוויות הדירות מוטלות לכל פריים מקופסאות `units.json` דרך `camera.json` של הפריים → קליק על דירה → כרטיס הדירה (הקיים, כולל ליד, וכיתוב) → "המשיכו" → חזרה לפריים המנוחה → קליפ הירידה לדירה → כניסה → הסיור (iframe, `room=living&yaw=…` כמו בכרטיס 34). כיתוב v1 בכל מסך, בלי מסכי טעינה (preload מאחור), בלי מיתוג יזם בתוך הפריימים.

## קלטים

- **החוזה של כרטיס 35:** `Habait/engine/_local/apt846-project/video/manifest.json` (`habait-engine/video.v1`: segments עם role `orbit | hold-ring | hold-arc | descend-<unit> | enter-<unit>`, `src`, `poster`, `last`, `camera` (מטריצת עולם + fov לכל פריים של הסרטון האמיתי), `frames`/`frames_lo` JPEG לגרירה, `loop`, `rest_frame`). 35 רץ במקביל. עד שה-manifest קיים: לבנות מול manifest זמני ב-`Habait/platform/_local/segments/rainbow-cine/manifest.dev.json` שמצביע על הקבצים הקיימים (`Habait/flyover/orbit/orbit_real.mp4` + `camera.json`; לקריאה בלבד מ-98: `C:\RnD\Projects\Habait\research\fal-bench-2026-11-02\flyover3d\data\{holdring,holdarc,video\descent-846.mp4}`), ולעבור ל-manifest של המנוע ברגע שהוא נכתב (הבנייה קוראת נתיב אחד).
- **איך הדמו עושה את זה (קריאה בלבד, לא להעתיק קוד בלי להבין):** `research/fal-bench-2026-11-02/flyover3d/{holdarc.js, app.js, index.html}` (canvas cover-fit, גרירה, אינרציה, ריחוף, הטלת תוויות לפי matrix_world, `goCentre`/`toHoldPose` לפני הירידה, שכבות lo/hi, `loop`), `HANDOFF.md`. ב-memory.md §7: "עצירה חיה" ו"העצירה v8".
- הפלטפורמה: `js/flow.js` (כרטיס 34: preload, כיתוב, מסירה ל-living, `?real=0`), `js/picker.js` (נטען חי ב-:8899 של 98: לא לשנות; אם חייב, תוספת בלבד ולהגיד), `css/flow-real.css`, `tools/build_segments.mjs`, `fixtures/rainbow/{flow.real.json,units.json,project.json}`, `test/{flow-real,card-overflow,browser}.test.mjs`.
- סאונד (כלל אלירן: ציוץ ציפורים + גלים מהפריים הראשון, דליל): `research/fal-bench-2026-11-02/flyover3d/data/audio/{ambience.m4a,README.md}`; מותר להעתיק לפלטפורמה עם ה-README (רישיון).

## קבצים (הסוכן כותב רק כאן)

`Habait/platform/js/cine.js` (חדש: נגן הסרטון השטוח + העצירה הנגררת), `js/flow.js` (תוספות: מצב cinematic כברירת מחדל כשיש manifest של המנוע; מצב 360 של 34 נשאר כ-fallback ו-`?mode=360`), `css/flow-real.css` / `css/cine.css`, `tools/build_segments.mjs` (קורא גם את video/manifest.json → `fixtures/rainbow/flow.cine.json` + `_local/segments/rainbow-cine/`), `test/flow-cine.test.mjs` (חדש), `_local/segments/rainbow-cine/**`, `audio/` אם מועתק, הכרטיס הזה.

## צעדים

1. לצלם את habait-flow באמולציית iPhone 13 (פתיחה, אמצע הסיבוב, עצירה + גרירה, כרטיס, ירידה, כניסה, סיור) = ייחוס; ואת habait-platform היום = "לפני".
2. `cine.js`: נגן סרטון שטוח (cover-fit, יחס 16:9 בטלפון לאורך: חיתוך מרכז מכוון לפי camera, לא מתיחה); עצירה נגררת מפריימי JPEG (lo מיד, hi ברקע) עם תוויות מוטלות לפי פריים (מקופסאות `units.json`, צבע סטטוס, 846 ניתנת להקשה, בלי חפיפה), ריחוף במנוחה, חזרה לפריים המנוחה לפני הירידה.
3. רצף: orbit → hold-ring (או hold-arc אם אין ring) → כרטיס → descend-<unit> → enter (ה-360 של 34 או קליפ שטוח אם 35 נתן `enter-<unit>`; המעבר בלי קפיצה: crossfade קצר אם המבטים לא תואמים, T0, לתעד) → סיור. דירה בלי קליפ ירידה: הירידה של 846 עם הערה, כמו היום.
4. `flow.cine.json` נבנה מה-manifest; `flow.html?project=rainbow` = cinematic כברירת מחדל, `?mode=360` = הנגן של 34, `?real=0` = placeholder.
5. `test/flow-cine.test.mjs`: iPhone 13 + Pixel 7 בעברית: הסרטון מתנגן ומתקדם, הגעה לעצירה, גרירה מזיזה פריים ותוויות זזות איתו (846 נשארת על המגדל ±12px מההטלה), הקשה על 846 → כרטיס, המשך → ירידה מפריים המנוחה, כניסה, סיור ב-living; כיתוב בכל צילום; 0 בקשות חוץ; 0 שגיאות.
6. **השוואת מראה:** צילומי "אחרי" לצד habait-flow באותם רגעים, ושורת פסק בכרטיס: שווה / טוב יותר / פחות טוב, ולמה. בלי זה הכרטיס לא DONE.

## Gate

**Check:**
```bash
cd C:/RnD/Projects/Habait/habait-walkaround/Habait/platform && export HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps && timeout 300 node tools/build_segments.mjs --project rainbow --dry-run && timeout 900 node test/flow-cine.test.mjs && timeout 900 node test/flow-real.test.mjs && timeout 600 node test/card-overflow.test.mjs && timeout 600 node test/browser.mjs && timeout 300 npm test
# צפוי: build מפרט קטעי cinematic מה-manifest; flow-cine X/X ok, caption on N/N, drag moves labels, handoff living; כל השאר ירוקים
```

**Reviewer scope:** מראה מול habait-flow + רציפות (אין קאט שמזיז את המבט בלי כיתוב/מעבר) + תוויות על המגדל בזמן גרירה.

## כסף

$0 (קליפים קיימים / של כרטיס 35).

## Standing rails

1. **קריאה תחומה קודם:** `C:\RnD\Projects\Habait\CLAUDE.md`, `C:\RnD\Projects\Habait\SESSIONS.md` (כולו), `C:\RnD\Projects\Habait\memory.md` סעיפים 1, 4, 6, 7 (העצירה של 98, כרטיס 34, M1 v3). אחר כך הכרטיס הזה וכרטיס 35.
2. **כותבים אחרון, פעם אחת:** לא עורכים `memory.md`/`SESSIONS.md`/README של הלוח. בלוק `## תוצאה` בסוף הכרטיס.
3. **קורא שני:** habait-98 (ba): אם picker.js / style.css נגעו; אם הנגן משתמש בנכסים שלו (עותקים).
4. **פעולה לא נגמרה עד שהזיכרון שלה נכתב.**
5. **בלי git, בלי Blender, בלי קריאות בתשלום; שרת משלך על פורט אחר, לא :8850.**

---

## תוצאה

_(ממלא הסוכן)_

- **מצב:**
- **מה נעשה:**
- **קבצים שנכתבו:**
- **פלט ה-Check (מילה במילה):**
```
```
- **השוואת מראה מול habait-flow:**
- **כסף:** $0
- **פגמים פתוחים:**
- **קורא שני:**
- **לזיכרון:**
