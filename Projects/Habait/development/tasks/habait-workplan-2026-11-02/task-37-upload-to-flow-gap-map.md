# משימה 37: מפת פערים "מעלים קבצים של יזם → הפלטפורמה בונה את כל הפלואו": מה אוטומטי היום, מה ידני, מה צריך אדם, ותכנית לסגירה

| שדה | ערך |
|---|---|
| **לוח** | `habait-workplan-2026-11-02` |
| **ערוץ** | A (engine) + D (platform) |
| **מקור בתכנית** | אלירן, 3.11 ~09:30 שעון המכונה: "בסוף אני רוצה יכולת בפלטפורמה שיצרת שיהיה לי יכולת להעלות קבצים של היזם והפלטפורמה כבר תדע לבנות את כל הפלואו של הסרטון והדמיות". ממשיך את כרטיס 27 (D5 העלאה + תור) ואת M3 (פרויקט שני בלי שינוי קוד). |
| **סוכן** | `engine-builder` (`status: live`, `owner-track: habait`, `model: opus`) |
| **Ruling tier** | **T0** (דוח + תכנית; בלי שינוי קוד מוצר) |
| **גל (wave)** | 8 |
| **מצב** | TODO |
| **זיכרון** | בלוק `## תוצאה` בסוף הכרטיס. |

## מטרה

תשובה מדויקת לשאלה: אם מחר מגיע יזם עם תיק קבצים (תכנית מכר PDF של דירה/קומה, הדמיות חוץ ופנים, אולי DWG/IFC, כתובת/גוש-חלקה), **מה קורה מהעלאה ועד קישור פלואו מוכן** (טיסה פוטוריאלית, עצירה נגררת עם תוויות, כרטיס דירה, ירידה, כניסה, סיור 360 בכל דירה, ZIP), ואיפה זה נעצר היום. לכל צעד: מי עושה אותו היום (שלב מנוע / סקריפט ידני של סשן / אדם), קלט, פלט, זמן, עלות, ומה צריך כדי שירוץ לבד.

## מה לבדוק (קריאה בלבד; להריץ רק dry-run / selftest)

- המנוע: `Habait/engine/{README.md, cli.py, stages/, intake/, correct/, gates/, bench/, docs/*-he.md}`; כרטיסים 01–06, 31 (ריצה טרייה), 04 (שלבים), 35 (video, רץ במקביל).
- האתר והמגדל: מאיפה בא `site.glb` (הסטודיו: `Habait/studio/` שלב site; קריאה בלבד), `nodes.json`, האורתופוטו, ה-HDRI; `Habait/flyover/equirect/path.json` (כרטיס 17: האם נגזר אוטומטית מ-units/site או נכתב ביד?), `Habait/flyover/orbit/orbit_clay.py` (ab; ה-ring/arc של 98: `Habait/studio/tools/hold_*_clay.py`).
- הדירות: `units.json` (כרטיס 03, box_world), קופסאות "stacked-approx" לסוגים שלא תוחקרו (כרטיס 22), התכנית של 846 בלבד מתוחקרת.
- הסיור: `Habait/tour360/` (של 98, קריאה בלבד): `cameras.json`, `scenes.json`, `prompts.json`, panos (GPT 2.5, $2.40 לפנורמה), build-tour; מה מתוך זה המנוע יודע לייצר לדירה חדשה.
- הרינדור: Blender מקומי CPU (סשן אחד), Kaggle (כרטיס 18/22: עובד ל-site.glb + סקריפט; מבטל kernel שפותח .blend מה-mount), Kling ($), GPT ($).
- הפלטפורמה: `build_units.mjs`, `build_zip.mjs`, `build_segments.mjs`, `flow.html`, פריסה (`tools/deploy-vercel/stage_platform.py` של 98), כרטיס 27.

## תוצר

1. `Habait/engine/docs/upload-to-flow-gap-he.md`: טבלה אחת, שורה לכל צעד מהעלאה לקישור (≥ 20 שורות: intake תכנית, מסך תיקון A2, building/units, site/אתר, מסלול טיסה, clay שטוח לכל קטע, Kling לכל קטע, עור GPT לנודים, טבעת עצירה, ירידה לכל דירה, כניסה לכל סוג דירה, פנורמות פנים לכל סוג, build-tour, units/סטטוס, ZIP, flow, פריסה, אנליטיקה/ליד), עם עמודות: היום (אוטומטי / ידני-סשן / אדם / לא קיים), קובץ/פקודה, זמן, $, מה חסר לאוטומציה, הערכת עבודה. בסוף: **עלות וזמן לפרויקט חדש** (12 דירות, 4 סוגים) לפי המתכון של Rainbow, ומה מינימום אדם (A2 = אישור התכנית).
2. **רשימת כרטיסים מוצעת** (כותרת, סוכן, תלות, Check) לסגירת הפערים, בסדר, כולל עדכון כרטיס 27 (דף העלאה + תור עבודות שמריץ את `cli.py` ומציג סטטוס לכל שלב, עוצר במסך A2 ובשערי כסף).
3. **dry-run חי:** `cli.py init` לפרויקט "דמה" מתוך `fixtures/rainbow-846.project.json` עם שם אחר ב-`Habait/engine/_local/gap-dryrun/` ואז `--stage all --dry-run`: לצטט אילו שלבים אומרים need/refuse/not-wired.

## Gate

**Check:**
```bash
cd C:/RnD/Projects/Habait/habait-walkaround && test -s Habait/engine/docs/upload-to-flow-gap-he.md && grep -c "^|" Habait/engine/docs/upload-to-flow-gap-he.md && grep -n "עלות וזמן לפרויקט חדש" Habait/engine/docs/upload-to-flow-gap-he.md
# צפוי: הקובץ קיים, ≥ 22 שורות טבלה, הסעיף קיים
```

**Reviewer scope:** האם כל צעד ידני מסומן ככזה (בלי "אוטומטי" לצעד שסשן עשה ביד).

## כסף

$0.

## Standing rails

1. **קריאה תחומה קודם:** `C:\RnD\Projects\Habait\CLAUDE.md`, `C:\RnD\Projects\Habait\SESSIONS.md` (כולו), `C:\RnD\Projects\Habait\memory.md` (כולו מותר: זה מחקר). אחר כך הכרטיס הזה, 27, 35, 36.
2. **כותבים אחרון, פעם אחת:** כותבים רק את הדוח, את `_local/gap-dryrun/` ואת בלוק `## תוצאה`. לא עורכים קוד מוצר, `memory.md`, `SESSIONS.md` או README של הלוח.
3. **קורא שני:** habait-98 (ba): אילו מהצעדים הידניים הם הסקריפטים שלו.
4. **פעולה לא נגמרה עד שהזיכרון שלה נכתב.**
5. **בלי git, בלי Blender, בלי קריאות בתשלום.**

---

## תוצאה

_(engine-builder, 2026-11-03 ~11:45 שעון המכונה; הרצה ראשונה של הכרטיס, אין ריצה קודמת להמשיך ממנה)_

- **מצב:** DONE (דוח + dry-run חי; שום קוד מוצר לא השתנה; בלי git, בלי Blender, בלי קריאות בתשלום).
- **מה נמצא (5 שורות):**
  1. habait-flow כולו **ידני-סשן**: clay ב-Blender (`orbit_clay.py`, `hold_arc_clay.py`), Kling v2v עם `kling_args.json` כתוב ביד, `descent-846.mp4` = פריימים 95–200 של הטיסה המלאה שנחתכו ב-ffmpeg, סיור tour360 עם cameras ופרומפטים ביד, `stage_flow.py` + `vercel deploy` ביד. אף צעד שם לא יצא מהמנוע.
  2. המנוע מריץ לבד רק intake רסטרי → plan → building → export (+ scene/clay רק אצל בעל Blender). skin/video: REFUSE בלי תקרה, NOWIRE עם תקרה. אין שלב site, מסלול, clay שטוח, סיור, flow, פריסה.
  3. dry-run חי: עותק Rainbow `run 4 · defer 1 · dry-run-only 1 · refuse 2`; אותם קבצים עם id חדש → `export N/A no platform project for this engine project`: פרויקט שני נעצר כבר בייצוא.
  4. הפער המרכזי הוא הגאומטריה של הפרויקט, לא המודלים: 11/12 דירות מומצאות (`stack_units.py`), צפון/אתר/מסה נעשו ביד (site846), מסלולי המצלמה קבועים בקוד (RING_R 228, RING_Z 90, END_LOOK_XY). מתוך 32 צעדים: 5 אוטומטיים, 2 חלקית, 2 אדם, 1 לא קיים, 22 ידני-סשן (5 מהם בתהליך בגל 8: 35/36).
  5. פרויקט 12 דירות / 4 סוגים: מינימום ~$127, צפוי ~$170–230 (גימור אחד; 3 גימורים ~$390–490); היום 5–8 ימי עבודה של סשנים + ~3 ש' אלירן; אחרי הכרטיסים המוצעים ~יום אחד + ~1.5–2 ש' אלירן (A2 לכל סוג, תקרה, עין, הסכמת יזם).
- **הכרעות T0 (נרשמות כאן):** (א) המוצר = סרטון שטוח + עצירה נגררת (36); טיסת ה-equirect של Kaggle נשארת fallback (`?mode=360`) ולא מחווטת כשלב. (ב) ברירת מחדל = גימור רצפה אחד; 3 גימורים בתקרה נפרדת. (ג) "אוטומטי" = רק שלב של `cli.py` שרץ על כל project.json; כלי גנרי שמורץ ביד מסומן "ידני-סשן (כלי גנרי)".
- **קבצים שנכתבו:** `C:\RnD\Projects\Habait\habait-walkaround\Habait\engine\docs\upload-to-flow-gap-he.md` (טבלה של 32 צעדים, מי עשה כל חלק של habait-flow, ה-dry-run, מה גל 8 סוגר, עלות וזמן, 13 כרטיסים מוצעים + עדכון 27); `C:\RnD\Projects\Habait\habait-walkaround\Habait\engine\_local\gap-dryrun\` (`rainbow-as-is/` ו-`new-id-demo/` מ-`cli.py init`; ב-`new-id-demo/project.json` ה-id שונה ל-`gap-demo-tower`; לוגים `A-init.log`, `A-dryrun-all.log`, `B-init.log`, `B-dryrun-all.log`, `C-dryrun-paid-allowed.log`); בלוק התוצאה הזה.
- **פלט ה-Check (מילה במילה):**
```
81
120:## עלות וזמן לפרויקט חדש (12 דירות, 4 סוגים, לפי המתכון של Rainbow)
```
  (exit 0; 81 שורות טבלה ≥ 22; הסעיף קיים. נבדק גם שאין שורת טבלה עם `|` עודף: 5 טבלאות, 0 שורות שבורות.)
- **כסף:** $0 (אין ledger; ה-dry-run עם `HABAIT_ALLOW_SPEND=1` היה dry-run בלבד, `ledger ... $0.00`).
- **כרטיסים מוצעים (בסדר):** 38 intake וקטורי כשלב + intake לסוג (engine-builder, T0) → 39 טבלת דירות + placement, הצעת הרחבה ל-project.schema (engine-builder, T1) → 40 שלב site: GIS/OSM/צפון/מסה → site.glb (engine-builder + blender-scene) → 41 מחולל מסלולים בלי קבועי Rainbow (blender-scene) → 42 שלב flight-clay מקומי/Kaggle (cloud-render) → 43 Kling לכל פרויקט: תבנית פרומפט/refs + שער "המצלמה עקבה" (genai-look, T1, אחרי 35) → 44 ריהוט מהתכנית בשלב scene (blender-scene) → 45 backend לשלב skin (genai-look, T1) → 46 מחולל תיקיית tour360 + build + smoke (platform-dev) → 47 מחולל פרויקט פלטפורמה, build_segments בלי rainbow בקוד (platform-dev, אחרי 36) → 27 מעודכן: העלאה + תור שמריץ `cli.py` שלב-שלב, סטטוס לכל שלב, עוצר ב-A2 ובשערי כסף (platform-dev, T2) → 48 publish גנרי + שער T2 (platform-dev) → 49 ליד לכל פרויקט (platform-dev, T2) → M3 פרויקט שני בלי שינוי קוד (qa-reviewer). Check לכל אחד בדוח. ~15–20 ימי סוכן, 3–4 שבועות.
- **פגמים פתוחים שנמצאו (לא תוקנו, דוח בלבד):** (1) export לפרויקט עם id חדש = N/A (מיפוי לפלטפורמה רק לפי prefix); (2) פקודת video ב-dry-run עדיין "parked by the no-video pivot" (35 מחליף); (3) skin שולח `cp-*` ל-`gen-pano.mjs` שמצפה לשמות סצנות tour360; (4) הודעות scene/clay אומרות "habait-98" (היום habait-da); (5) ה-intake מוציא `fixtures: []` ו-`furnish_from_plan.py` לא מחובר לשלב scene; (6) `build_segments.mjs`, `stage_platform.py`, `stage_flow.py`, `enter.py`, `orbit_clay.py` עם rainbow/846 בקוד.
- **קורא שני:** habait-da (יורש של ba/98 ושל 1d, שאינם קיימים): הצעדים הידניים 9, 11, 13, 15, 16, 18, 21–23, 28, 29 בדוח הם הסקריפטים של ba/16/89/ab (`Habait/studio/**`, `Habait/tour360/**`, `research/fal-bench-2026-11-02/flyover3d/**`, `C:\RnD\Projects\Habait\tools\deploy-vercel\**`), שהם עכשיו הנתיבים של da; כרטיסים 40, 42, 46, 48 נוגעים בהם בקריאה או מחליפים אותם, ולכן da מקצה אותם. לפי הוראת da, ההעברה נרשמת כאן בלבד ולא ב"העברות" של README הלוח.
- **לזיכרון:** כרטיס 37 (3.11): habait-flow כולו ידני-סשן (Blender clay, Kling ביד, GPT, tour360, stage_flow.py). המנוע מריץ לבד רק intake→plan→building→export (+scene/clay אצל בעל Blender); id חדש → export N/A. פרויקט 12 דירות/4 סוגים: ~$170–230 בגימור אחד; היום 5–8 ימים ידני, אחרי 13 כרטיסים (38–49, 27, M3) ~יום + ~2 ש' אלירן. `Habait/engine/docs/upload-to-flow-gap-he.md`
