# מהעלאה לקישור: מפת פערים "מעלים קבצים של היזם, הפלטפורמה בונה את כל הפלואו"

כרטיס 37 בלוח `habait-workplan-2026-11-02` (engine-builder, T0, גל 8). נכתב 2026-11-03 ~11:40 שעון המכונה. **דוח בלבד:** שום קוד מוצר לא השתנה, $0. הקלט: הקוד והקבצים בדיסק (המנוע, הפלטפורמה, ערוץ C, Studio, tour360, flyover3d, `tools/deploy-vercel`), `memory.md`, הכרטיסים 01–36, ו-dry-run חי (למטה).

השאלה של אלירן (3.11 ~09:30): "בסוף אני רוצה יכולת בפלטפורמה ... להעלות קבצים של היזם והפלטפורמה כבר תדע לבנות את כל הפלואו של הסרטון והדמיות".

## השורה התחתונה

1. **הדמו היפה (habait-flow) לא יצא מהמנוע.** כל מה שרואים בו נוצר בסקריפטים שסשנים הריצו ביד (Blender clay, Kling v2v, עורות GPT, פנורמות tour360, `stage_flow.py`), עם קבועים ונתיבים של Rainbow בתוך הקוד. אף צעד שם אינו "אוטומטי".
2. **המנוע (`cli.py`) מריץ לבד היום רק את החצי ה"יבש":** intake רסטרי → plan → building → (scene/clay רק אצל בעל ה-Blender) → export. שלבי הכסף (skin, video) מסורבים או "NOT WIRED". אין במנוע שלב אתר, מסלול טיסה, clay שטוח, סיור, flow או פריסה.
3. **dry-run חי:** על עותק של Rainbow `run 4 · defer 1 · dry-run-only 1 · refuse 2`; על אותו פרויקט עם id חדש, export נופל ל-`N/A no platform project for this engine project`. פרויקט שני נעצר כבר בייצוא, לפני כל הצעדים שלא קיימים.
4. **הפער הגדול הוא לא המודלים** (המתכון עובד: clay שטוח → Kling 4.0 v2v לחוץ, GPT Image 2.5 לפנים) **אלא הגאומטריה של הפרויקט:** טבלת דירות ומיקום בקומה (11 מתוך 12 הדירות של Rainbow מומצאות), אתר/צפון/מסת מגדל, ומסלולי מצלמה שנכתבו ביד.
5. **פרויקט חדש של 12 דירות ב-4 סוגים:** ~$130–230 בגימור רצפה אחד. היום: 5–8 ימי עבודה של סשנים + ~3 שעות של אלירן. אחרי 13 הכרטיסים המוצעים: אותו כסף, ~יום אחד, ו-~1.5–2 שעות של אלירן (אישור התכנית במסך A2 לכל סוג, תקרת כסף, עין על המראה, הסכמת היזם).

## איך לקרוא את הטבלה

- **אוטומטי** = שלב של `cli.py` שרץ על כל `project.json` בלי שסשן כותב קוד או פרמטרים (גם אם הוא עוצר בשער כסף או Blender).
- **ידני-סשן** = סשן Claude או סוכן שלו הריץ סקריפט או פקודה ביד, לרוב עם קבועים של Rainbow בקוד. **כל מה שבדמו habait-flow נמצא בקטגוריה הזו.** "כלי גנרי" בסוגריים = הכלי עצמו לא תלוי ב-Rainbow, אבל אף אחד לא מריץ אותו אוטומטית.
- **אדם** = אלירן. **לא קיים** = אין כלי.
- **בתהליך, גל 8** = כרטיס 35 (שלב `video` במנוע: Kling v2v, אימוץ הקליפים הקיימים ב-$0, manifest `habait-engine/video.v1` עם camera לכל פריים של הסרטון האמיתי) או כרטיס 36 (נגן cinematic בפלטפורמה שקורא את ה-manifest). שניהם רצים עכשיו; העמודה "מה חסר" אומרת מה ייסגר כשהם נגמרים ומה לא.
- **זמן ו-$:** "נמדד" עם המקור; כל השאר אומדן. **עבודה:** S = עד חצי יום סוכן, M = 1–2 ימי סוכן, L = 3–5 ימי סוכן.

## הטבלה: כל צעד מהעלאה עד קישור

| # | צעד | היום | קובץ / פקודה | זמן | $ | מה חסר כדי שירוץ לבד | עבודה |
|---|---|---|---|---|---|---|---|
| 1 | העלאת קבצים (PDF/DWG/הדמיות/כתובת) | **לא קיים** (אלירן שם קבצים בתיקייה) | `C:\RnD\Projects\Habait\*`, `data/sales-plans/_inbox` | דקות | $0 | דף העלאה + תיקיית פרויקט + תור עבודות (כרטיס 27 מעודכן) | M |
| 2 | `project.json` (פרויקט, מגרש, קומות, דירות) | **ידני-סשן** (סוכן lane A כתב את `fixtures/rainbow-846.project.json` מהקבצים) | `validate_project.py --check-files`, `cli.py init` (אוטומטי, פחות משנייה) | 30–60 דק' סשן | $0 | חילוץ עובדות מה-PDF והמצגת ב-VLM frontier + טופס אישור; `site.origin_plan_cm` ו-`units[].placement` הם הצעות של כרטיס 03 שלא בסכמה | M |
| 3 | intake תכנית (לכל סוג דירה) | **אוטומטי** לרסטר (שלב `intake`); **ידני-סשן (כלי גנרי)** לווקטורי (`intake_pdf_vector.py` לא שלב של ה-CLI) | `cli.py run --stage intake`; `intake_pdf_vector.py` | וקטורי 11–25 ש', רסטר 60–145 ש' + 2 קריאות Opus של 60–100 ש' (נמדד, כרטיסים 01/06/31) | $0 (מנוי) | הקורא הווקטורי כשלב עם בחירת מסלול לבד (drawings/OCG → וקטורי, אחרת רסטר); סוג אחד = intake אחד, `mirrored` לדירות ראי | S |
| 4 | מסך תיקון A2 (אישור התכנית) | **אדם** | `correct/serve.mjs` :8870 → `plan/<unit>/corrected/plan.json` | לא נמדד בדקות (14 הקשות על 3 שגיאות, כרטיס 02) | $0 | נשאר אדם (זה המינימום). חסר: שיבוץ כעצירה בתור; הוספת חדר/קיר/פינה במסך | S |
| 5 | plan (תכנית הרשומה + שערים) | **אוטומטי** | `cli.py run --stage plan` (validate-plan + plan_gate + בקרה שלילית) | 1.5–7 ש' (נמדד) | $0 | כלום; חוסם נכון. הערה: עם `--plan` ה-report לא תמיד עובר לשער (פגם 3 ב-README) | — |
| 6 | טבלת דירות + מיקום בקומה (12 דירות, 4 סוגים) | **ידני-סשן:** 846 אמיתית; 11 דירות "stacked-approx" מומצאות (קומות, סוגים, מחירים) | `stack_units.py`, `platform/fixtures/rainbow/units.json` | שעות סשן | $0 | קריאת מחירון/מפתח קומה → `units[]` (מספר, קומה, סוג, ראי) + קו מתאר אמיתי לכל סוג (`outline_world`) | L |
| 7 | building / `units.json` (קופסה לכל דירה) | **אוטומטי** (שלב `building`) | `building.py` דרך `cli.py` | 14–55 ש' (נמדד) | $0 | רק לדירות עם placement; היום 1/12 אמיתית | תלוי ב-6 |
| 8 | מיקום, צפון, מגרש | **ידני-סשן** (habait-af 1.11: התאמת מגרש 111 ב-GIS, צפון 304.4 גאומטרי) | `C:\RnD\Projects\Habait\tools\bench\site846\fit_plot.py`, `plot-fit.json` | שעות סשן | $0 | שלב `site` במנוע: GIS/OSM → fit גאומטרי + בקרה שלילית (צפון הפוך נכשל) | M |
| 9 | אתר (`site.glb`: OSM, אורתופוטו, מסת המגדל) | **ידני-סשן** (Studio של 98: שלב site + `orthophoto.py`; `tower_mass.py` של site846; `export_site_glb.py` ב-Blender) | `Habait/studio/_local/projects/apt846-rainbow-tlv/renders/site3d/site.glb` | דקות מכונה + שעות סשן | $0 | שלב `site` גנרי שמוציא `site.glb` + nodes; מסת בניין ממפתח הקומה/חזיתות בלי סקריפט של Rainbow (יש `--plain-mass` כ-fallback) | L |
| 10 | מסלול טיסה (approach, orbit, hold, descend) | **ידני-סשן:** קבועים בקוד (`orbit_clay.py`: RING_R 228, RING_Z 90, END_LOOK_XY, GROUND_Z); עוגנים ב-`equirect/path.json`; נודים ב-`shots.pano-nodes.json` של 16 | `Habait/flyover/orbit/orbit_clay.py`, `Habait/flyover/equirect/path.json` | שעות סשן | $0 | מחולל מסלולים מ-site + units: טבעת לפי גובה ורדיוס המגדל, עצירה מול החזית של דירת הדגל, descend לכל דירה, enter לכל סוג | M |
| 11 | clay שטוח 16:9 לכל קטע + `camera.json` לכל פריים | **ידני-סשן:** ab הריץ `orbit_clay.py` (EEVEE Next, 420 פר'); ba הריץ `hold_arc_clay.py` (קשת 181 פר', טבעת 240 פר' עם `--half-arc 180`); clay הירידה = הטיסה המלאה של 16 (`flight.mjs`/`render_shots.py`) | `Habait/studio/tools/hold_arc_clay.py` | EEVEE ~0.6–5 ש'/פריים ב-720p (אומדן: turntable 0.62, memory §2 ~5) | $0 | שלב `flight-clay` במנוע (בעל Blender מקומית או Kaggle), קורא את המסלול של שורה 10 | M |
| 12 | clay equirect 360 (הטיסה של habait-platform) | **ידני-סשן:** סוכנים של 1d הריצו `push_pull.py` ו-`batch_units.py` ב-Kaggle | `Habait/flyover/kaggle/push_pull.py` | 4.15–5.68 ש'/פריים approach/orbit/hold, 8.5 ש'/פריים descend על 2×T4 (נמדד, כרטיסים 18/22) | $0 (מכסה ~30 ש' GPU לשבוע) | חיבור כשלב; Kaggle מבטל kernel שפותח .blend מה-mount (enter-846). **הכרעה T0 כאן:** המוצר = הסרטון השטוח (36); ה-equirect נשאר fallback (`?mode=360`) ולא נחווט עכשיו | M (נדחה) |
| 13 | Kling 4.0 v2v לכל קטע | **ידני-סשן:** `run_kling.sh` / `run_fal.py` עם `kling_args.json` כתוב ביד (פרומפט עם "the Rainbow tower", refs שנבחרו ביד). **בתהליך, גל 8 (35)** | `Habait/flyover/orbit/kling_args.json`, `flyover3d/data/hold*/kling_args.json` | 97–251 ש' לקריאה (נמדד, ledger fal-bench); timeout אחד של 30 דק' | ~$0.19 לשנייה ב-720p (נמדד: 3.30/17.5, 1.50/7.5, 1.88/10, 1.32/7) | **35 סוגר:** שלב video עם cache לפי hash, שומר כסף, ledger, manifest. **נשאר:** תבנית פרומפט ובחירת refs מ-`project.json`; שער "המצלמה עקבה אחרי ה-clay" (ORB נעשה ביד; 1080p נפסל כך); facade_gate על פריימי Kling | M (אחרי 35) |
| 14 | מיפוי `camera.json` לפריימי הסרטון האמיתי | **ידני-סשן** (orbit 420→409 לפי זמן; ring "edge correlation" ביד, וה-ring לא עקב). **בתהליך, גל 8 (35)** | `holdarc.js`, `app.js` של flyover3d; `holdring/manifest.json` | — | $0 | **35 סוגר** למיפוי לפי זמן; קליפ שלא עוקב (ring) צריך שער שפוסל, לא מיפוי | S (אחרי 35) |
| 15 | עור GPT לנודים חיצוניים (refs ל-Kling, fallback 360) | **ידני-סשן** (16: `studio/_local/ext_nodes.mjs`; refs = פריימי Kling + THE-1/2 + אוויריים מ-Commons; node-b הותאם צבע ביד ל-`orbit_last`) | `Habait/studio/_local/ext_nodes.mjs` | ~4 דק' EEVEE לנוד clay + קריאת GPT | $1.20 לנוד (נמדד, 11 נודים $13.20) | שלב `skin` של המנוע מכסה רק פנים; חסר skin לנוד העצירה (ref אחד מספיק ל-Kling) | S |
| 16 | עצירה נגררת (קשת/טבעת וידאו) | **ידני-סשן:** arc_real ($1.50) חי; ring ($1.88) נכשל כמוצר (לא שומר עולם, לא נסגר) → `?hold=ring` בלבד; pull = orbit_real הפוך ($0); pan נפסל ($1.32). **בתהליך, גל 8 (35 manifest, 36 נגן)** | `flyover3d/holdarc.js` v8, `data/holdarc`, `data/holdring` | — | ~$1.50–1.88 | **35+36 סוגרים** את הקשת בפלטפורמה. **נשאר:** 360 מלא אמיתי (4 רבעים עם ref לכל צד, ~$4, לא אושר) | M |
| 17 | תוויות דירות לכל פריים | **ידני-סשן** בדמו (holdarc.js מטיל `box_world` לפי camera.json בזמן ריצה; הקופסאות של 11 דירות מומצאות); בפלטפורמה `project_units.py` (כרטיס 19) על equirect. **בתהליך, גל 8 (36)** | `platform/js/picker.js`, `Habait/flyover/hotspots/project_units.py` | 2–6 ש' לקטע (נמדד, 19) | $0 | **36 סוגר** את ההטלה בנגן; נשאר: קופסאות אמיתיות (שורה 6), `outline_world` במקום מלבן | תלוי ב-6 |
| 18 | ירידה לכל דירה | **ידני-סשן:** רק 846. `descent-846.mp4` = פריימים 95–200 של `kling-4-full-flight.mp4` (89, $3.20) שנחתכו ב-ffmpeg; 836/856 equirect clay בלבד (22); 9 הדירות האחרות נופלות לירידה של 846 | `flyover3d/data/video/descent-846.mp4`, `Habait/flyover/batch/batch_units.py` | clay 120 פר' + Kling ~5 ש' | ~$0.95 לדירה (אומדן לפי $0.19/ש') | מחולל descend (שורה 10) + clay (11) + Kling (13) לכל דירה; 35 לא מכסה דירות נוספות | M |
| 19 | כניסה לכל סוג דירה (מרפסת → סלון) | **ידני-סשן:** `enter.py` (33 אזכורים של 846 בקוד), טיוטה 1024×512 של 98 ב-Blender; Kaggle מבטל את הריצה | `Habait/flyover/enter.py` | ~2.1 ש'/פריים CPU ב-1024×512 (נמדד, 22) | $0 (או Kling ~4 ש' ≈ $0.75) | enter גנרי לכל סוג (פתח הסלון מהתכנית) + מסירה בלי קפיצה לפנורמת הסלון של אותו סוג | M |
| 20 | scene + clay פנים (Blender) | **אוטומטי בתנאי:** שלבי `scene`/`clay` רצים רק בסשן בעל Blender (`HABAIT_BLENDER_OK=1`); רצו פעם אחת (98, 2.11) | `cli.py run --stage scene,clay` | 20 ש' + 699 ש' ל-11 נקודות (נמדד) | $0 | worker בעל Blender בתור; ריהוט: `furnish_from_plan.py` (07) לא מחובר, וה-intake מוציא `fixtures: []` | S |
| 21 | פנורמות פנים לכל סוג (GPT 2.5) | **ידני-סשן:** `gen-pano.mjs` של tour360 עם `cameras.json` שנבחר ביד ו-`prompts.src.mjs` כתוב ביד. שלב `skin` של המנוע = תבנית בלבד (REFUSE / NOWIRE, ids `cp-*` שלא תואמים לסצנות של tour360) | `Habait/tour360/tools/gen-pano.mjs` | ~1 דק' לקריאה (אומדן, לא נמדד) | $2.40 לפנורמה (נמדד) = $26.40 לסוג לגימור | backend לשלב skin: clay pano + refs → GPT "change only the grey" + close-seam + kf_check / openings / תפר; לכל סוג ולכל גימור | L |
| 22 | build-tour (סיור 360 לכל סוג) | **ידני-סשן:** מתכון tour360 (cameras.json ביד, make-refs, make-scenes, prompts, gen-pano, make-sets, build-tour, smoke) | `Habait/tour360/README.md` "Add an apartment" | build עד 9 דק' | $0 | מחולל תיקיית tour360 מפלט המנוע (`camera_points` → cameras.json, `openings` → scenes.json, apartment.json) + build + smoke | M |
| 23 | מדריכה, קריינות, מדידה בסיור | **ידני-סשן** (ba: `guide_make.py` ב-scratchpad, edge-tts; דמות מדברת minimax; depth למדידה מ-`render_pano.py`) | `apartments/apt846/guide/`, `depth/` | — | קריינות $0; דמות ~$16 לסוג (נמדד 846) | תבנית קריינות מ-`plan.json` כשלב (שטחים, כיוון מרפסת, בלי "נוף לים") | S (רשות) |
| 24 | units / סטטוס / מחיר | **ידני-סשן (כלי גנרי):** `build_units.mjs` (26) מ-CSV/Sheet, מורץ ביד; אחרי שינוי צריך פריסה מחדש ביד | `Habait/platform/build_units.mjs` | שניות | $0 | טריגר מהגיליון + פריסה אוטומטית | S |
| 25 | כיתוב משפטי | **אוטומטי חלקית:** `caption-v1.json` נטען ב-build_zip (דרך שלב export) וב-build_segments (מורץ ביד), placeholders ממולאים; בדמו נצרב ביד על סרטון הסיבוב | `C:\RnD\Projects\Habait\data\sales-plans\legal\caption-v1.json` | — | $0 | כיתוב בתוך כל סרטון שטוח (36); אישור עו"ד (DRAFT) | S |
| 26 | דף דירה + ZIP | **אוטומטי** (שלב `export` → `build_zip.mjs`), אבל אורז את פנורמות tour360 (`apt<num>`) ואת פיקסטורת הפלטפורמה; לפרויקט עם id חדש: N/A (dry-run B) | `Habait/platform/tools/build_zip.mjs` | 6.4–7.9 ש' לדירה (נמדד) | $0 | מיפוי דירה → סוג → סיור; תיקיית פלטפורמה שנוצרת מהמנוע | S |
| 27 | flow (מה שהרוכש רואה) | **ידני-סשן:** habait-flow = flyover3d (`index.html`, `app.js`, `holdarc.js`, `picker.js`) + intro + tour; habait-platform = `flow.html` + `build_segments.mjs` (מפת `PROJECTS` עם `rainbow` בקוד). **בתהליך, גל 8 (36)** | `Habait/platform/flow.html`, `tools/build_segments.mjs` | — | $0 | **36 סוגר** נגן cinematic מה-manifest ל-Rainbow. **נשאר:** flow שנבנה מ-manifest + units של כל פרויקט בלי עריכת קוד | M |
| 28 | סאונד ואווירה (ציוץ, ציפורים עפות) | **ידני-סשן** (ba הרכיב `ambience.m4a` v4 מ-Commons; `birds.js`) | `flyover3d/data/audio/` | — | $0 | נכס קבוע לכל פרויקט (העתקה + רישיון); 36 רשאי להעתיק | S |
| 29 | פריסה (קישור) | **ידני-סשן:** `stage_flow.py` / `stage_platform.py` (rainbow ו-846 בקוד) + `vercel deploy --prod` ביד | `C:\RnD\Projects\Habait\tools\deploy-vercel\` | דקות | $0 | publish גנרי לכל פרויקט + שער T2 (`legal.publish_allowed`, הסכמת יזם) | M |
| 30 | אנליטיקה + ליד | **אוטומטי חלקית:** `analytics.js` + sink מקומי (24); ליד: `webhook_url` ריק → "נשמר מקומית", לא נשמר בשום מקום בפרודקשן | `Habait/platform/js/analytics.js`, `apps-script/lead-to-sheet.gs` | — | $0 | webhook לכל פרויקט + מספר WhatsApp/סוכן אמיתי (אדם) | S |
| 31 | שערי QA לפני שליחה | **ידני-סשן:** qa-reviewer (M1 v3, ~30 דק'), סקריפטי `qa_*.cjs` של 98, ORB ביד ל-Kling; העין של אלירן | `development/tasks/.../gates/`, `tools/deploy-vercel/qa/` | 30–60 דק' | $0 | שער אוטומטי לכל פלט ב-`qa.html` (facade, kf_check, תפר, ORB, סגירת לופ); "השוואה מול habait-flow" נשארת אדם | M |
| 32 | אישור כסף | **אדם** (אלירן, בצ'אט של הסשן המפעיל) | `HABAIT_ALLOW_SPEND=1` + `HABAIT_CAP_USD` | — | — | בתור: עצירה "ממתין לאישור $X" במקום exit 3 | S (בכרטיס 27) |

**ספירה:** 5 צעדים אוטומטיים לגמרי או בתנאי (3 לרסטר, 5, 7, 20, 26), 2 אוטומטיים חלקית (25, 30), 2 של אדם (4, 32), צעד אחד לא קיים (1), וכל השאר (22 צעדים) ידני-סשן. 5 מהם (13, 14, 16, 17, 27) בתהליך בגל 8.

## מה זה habait-flow בפועל (מי עשה כל חלק)

| מה רואים | הקובץ | מי ואיך (כולם ידני-סשן) |
|---|---|---|
| סרטון הסיבוב (17 ש') | `Habait/flyover/orbit/orbit_real.mp4` | ab: `orbit_clay.py` ב-EEVEE (420 פר') → `kling_args.json` ביד → `run_kling.sh`, Kling 4.0 v2v, $3.30, 251 ש' |
| העצירה הנגררת | `flyover3d/data/holdarc/` (arc_real, 169 פר'), `holdpull/` | ba: `hold_arc_clay.py` + Kling $1.50 (הניסיון הראשון מת ב-timeout של 30 דק'); 1080p נפסל ($1.97), pan נפסל ($1.32), ring ($1.88) נכשל כמוצר |
| התוויות על המגדל | `platform/js/picker.js` + `holdarc.js` | ba/1d: units מ-`stack_units.py` (846 אמיתית, 11 קופסאות מוערמות); camera.json של Kling מופה ביד |
| קליפ הירידה | `flyover3d/data/video/descent-846.mp4` | 89: פריימים 95–200 של `kling-4-full-flight.mp4` ($3.20, על clay של `flight.mjs` של 16), ffmpeg ביד; קיים רק ל-846 |
| הסיור | `Habait/tour360/dist/apt846` (Pannellum) | 16/0c/de/98: 11 פנורמות GPT 2.5 × 3 רצפות מ-`gen-pano.mjs`, cameras ופרומפטים ביד, תפרים ($21.60); ledger הסיור $129.74 |
| מדריכה, קריינות, מדידה | `apartments/apt846/guide/`, `depth/` | ba: edge-tts ($0), minimax lip-sync (~$16 ל-11 חדרים), depth מ-`render_pano.py` |
| סאונד וציפורים | `flyover3d/data/audio/ambience.m4a`, `birds.js` | ba: הרכבה מ-Commons (v4), אחרי 3 תיקונים של אלירן |
| הכתובת | https://habait-flow.vercel.app | ba: `stage_flow.py` + `vercel deploy --prod` ביד (34 פריסות) |

מה שהמנוע/הפלטפורמה של המסלול "מאפס" תרמו לדמו: `picker.js`, `units.json` (דרך `stack_units.py`) והכיתוב המשפטי. habait-platform.vercel.app (המסלול "מאפס"): `flow.html` עם 5 קטעי equirect clay מ-Kaggle (סוכנים הריצו את `push_pull.py` ביד), `build_segments.mjs` עם `rainbow` בקוד, פריסה ביד של ba; אלירן: "ממש פחות טובה מ-habait-flow", כי אין בה שלב הצביעה (Kling).

**קוד עם קבועים של פרויקט** (ספירת `rainbow` / `apt846` / `846` בקוד, כולל הערות, 2026-11-03): `engine/cli.py` 0, `engine/stages` 5, `engine/building.py` 6, `platform/tools` 29, `flyover/orbit/orbit_clay.py` 5 (+ מספרים קשיחים: RING_R, RING_Z, END_LOOK_XY), `flyover/enter.py` 32, `flyover/batch` 46, `flyover/kaggle` 53, `flyover/turntable` 20, `tools/deploy-vercel` (rainbow ו-846 בנתיבים). המנוע עצמו כמעט נקי; ערוץ C, הפלטפורמה והפריסה לא.

## dry-run חי (2026-11-03 11:14 שעון המכונה, $0)

הלוגים המלאים: `Habait/engine/_local/gap-dryrun/{A-init,A-dryrun-all,B-init,B-dryrun-all,C-dryrun-paid-allowed}.log`. כרטיס 35 עוד לא נגע בקוד המנוע בזמן הריצה (אין `stages/video.py`), כך שזה המנוע v0.

**A. עותק של Rainbow** (`cli.py init Habait/engine/_local/gap-dryrun/rainbow-as-is --from Habait/engine/fixtures/rainbow-846.project.json`, ואז `run ... --stage all --dry-run`, exit 0):

```
preflight  validate_project.py --check-files: OK
[1/8] intake [apt846]      RUN    no stamp: never completed here
[2/8] plan [apt846]        RUN    no stamp: never completed here
[3/8] building             RUN    no stamp: never completed here
[4/8] scene [apt846]       DEFER  Blender is owned by another session (SESSIONS.md: habait-98); set HABAIT_BLENDER_OK=1 only in the session that owns it
[5/8] clay [apt846]        DRYRUN render_tour.mjs --dry-run only (Blender owned by habait-98; HABAIT_BLENDER_OK != 1)
[6/8] skin [apt846]        REFUSE REFUSED: HABAIT_ALLOW_SPEND=1 is not set (and HABAIT_CAP_USD=<usd> is required too); estimate $26.40, nothing was called
[7/8] video [apt846]       REFUSE REFUSED: HABAIT_ALLOW_SPEND=1 is not set (and HABAIT_CAP_USD=<usd> is required too); estimate $3.20, nothing was called
        cmd   "<no backend: video parked by the 2026-11-02 no-video pivot; Kling 4.0 v2v, one flight>"
[8/8] export [apt846]      RUN    no stamp: never completed here
        need  now plan [apt846]: no stamp (never passed here, or its last run failed)
        need  now building: no stamp (never passed here, or its last run failed)
        need  this run's plan/building stage(s) run first; export goes on only if they pass
        note  platform project Habait/platform/fixtures/rainbow (HEURISTIC id prefix (rainbow-tlv -> rainbow))
summary   run 4 · defer 1 · dry-run-only 1 · refuse 2 · ledger Habait/engine/_local/gap-dryrun/rainbow-as-is/ledger.json $0.00
```

**B. אותם קבצים, id חדש** (`gap-demo-tower`, כמו יזם חדש; `new-id-demo/`, exit 0): כל השורות זהות חוץ מ:

```
[8/8] export [apt846]      N/A    no platform project for this engine project (give --platform-project)
summary   run 3 · defer 1 · dry-run-only 1 · refuse 2 · n/a 1 · ledger Habait/engine/_local/gap-dryrun/new-id-demo/ledger.json $0.00
```

**C. שלבי הכסף עם הוצאה מותרת** (עדיין dry-run, שום דבר לא נקרא): `HABAIT_CAP_USD=50` → `skin NOWIRE ... v0 wires no paid backend (estimate $26.40)` ו-`video NOWIRE ... (estimate $3.20)`; `HABAIT_CAP_USD=20` → `skin REFUSE REFUSED: over the cap: ledger paid $0.00 + estimate $26.40 > HABAIT_CAP_USD $20.00` ו-`video NOWIRE`.

**מה ה-dry-run אומר:** need = export (plan + building לפני); refuse = skin, video (בלי תקרה); not-wired = skin, video (גם עם תקרה); defer / dry-run-only = scene, clay (Blender של סשן אחר; השם habait-98 בהודעה כבר לא קיים: היום habait-da); N/A = export לפרויקט חדש. **שלבים שלא מופיעים כלל:** site, מסלול, clay שטוח, Kling לכל קטע, ירידה/כניסה לכל דירה, סיור, flow, פריסה, ליד. שני פגמים קטנים בטקסט: הפקודה של video עדיין אומרת "parked by the no-video pivot" (35 מחליף), ו-skin שולח `cp-*` ל-`gen-pano.mjs` שמצפה לשמות סצנות של tour360 (פגם 1 ב-README).

## מה גל 8 יסגור ומה לא

- **35 (engine-builder, Kling v2v, תקרה $20):** שלב `video` עם cache לפי hash (אימוץ orbit_real / ring_real / arc_real / descent-846 ב-$0), שומר כסף ו-ledger, מיפוי camera לפריימי האמת, `manifest.json` (`habait-engine/video.v1`). סוגר את שורות 13, 14 ואת חלק ה-manifest של 16. **לא סוגר:** clay (הוא מדפיס `need: clay <seg>`), מסלולים, ירידה לדירות אחרות, תבנית פרומפט לכל פרויקט מעבר למה שהכרטיס מבקש, שער "המצלמה עקבה".
- **36 (platform-dev, $0):** נגן cinematic: סרטון שטוח → עצירה נגררת עם תוויות לכל פריים → כרטיס → ירידה → כניסה → סיור, מה-manifest של 35, עם השוואת מראה מול habait-flow. סוגר את שורות 16 (נגן), 17 (הטלה), 27 (ל-Rainbow), 28 (העתקת סאונד). **לא סוגר:** flow לפרויקט אחר בלי עריכת קוד, פריסה.
- **מה שאף אחד לא סוגר היום:** שורות 1, 2, 6, 8, 9, 10, 11, 15, 18, 19, 21, 22, 24, 26 (לפרויקט חדש), 29, 30, 31.

## עלות וזמן לפרויקט חדש (12 דירות, 4 סוגים, לפי המתכון של Rainbow)

הנחות: 4 סוגים × ~11 נקודות מצלמה (כמו 846); 12 דירות בקומות שונות; פרויקט אחד = סיבוב אחד + קשת עצירה אחת; ירידה לכל דירה; כניסה לכל סוג; **גימור רצפה אחד** (Rainbow עשה 3). המודלים לפי פסקי memory §7: GPT Image 2.5 לפנים ולנודים, Kling 4.0 v2v 720p לחוץ.

**כסף (fal):**

| פריט | כמות | מחיר יחידה | סה"כ | מקור |
|---|---|---|---|---|
| פנורמות פנים GPT 2.5 (4096×2048) | 4 × 11 = 44 | $2.40 | $105.60 | נמדד: `gen-pano.mjs gpt25x`, `stages/paid.py` PANO_USD |
| ניסיונות חוזרים בפנים (~25%) | ~11 | $2.40 | ~$26 | אומדן |
| תיקוני תפר/דלתות (close-seam GPT) | 0–44 | $2.40 | $0–106, צפוי ~$40 | 846: $21.60 ל-11 (habait-de) |
| נוד עצירה GPT (ref ל-Kling) | 1–3 | $1.20 | $1.20–3.60 | נמדד 1.11 ($13.20 ל-11 נודים) |
| Kling סיבוב (~17 ש') | 1 | $3.30 | $3.30 | נמדד (ab) |
| Kling קשת עצירה (7.5 ש') | 1 | $1.50 | $1.50 | נמדד (ba) |
| Kling ירידה לכל דירה (~5 ש') | 12 | ~$0.95 | ~$11.40 | אומדן לפי $0.19/ש' (4 קריאות נמדדות) |
| Kling כניסה לכל סוג (~4 ש') | 4 | ~$0.75 | ~$3.00 | אומדן (או $0 בכניסה מוקרנת כמו enter.py) |
| קליפי Kling שנפסלים (בדמו 3 מתוך 6) | — | — | ~$10 | נמדד בדמו (1080p, pan, ring) |
| **סה"כ, גימור אחד** | | | **מינימום ~$127; צפוי ~$170–230** | |
| 3 גימורי רצפה (כמו Rainbow) | +88 פנורמות | $2.40 | +$211 ותיקונים → **~$390–490** | |
| מדריכה מדברת (רשות) | 4 סוגים | ~$16 | +$64 | נמדד ב-846 |
| Blender, Kaggle, Vercel, intake (מנוי) | | | $0 | Kaggle: מכסה ~30 ש' GPU לשבוע |

**זמן:**

| | היום (המתכון של Rainbow, ביד) | אחרי הכרטיסים המוצעים |
|---|---|---|
| אלירן | ~2.5–3 ש': קבצים ועובדות 30 דק'; A2 × 4 (~15 דק' לסוג, לא נמדד) 1 ש'; אישורי כסף 10 דק'; עין ומשוב 30–60 דק'; ליד/סוכן 15 דק' | ~1.5–2 ש': A2 × 4, תקרה אחת, עין על המראה, הסכמת היזם |
| עבודת סשנים ביד | ~25–50 ש': אתר/צפון/מסה 3–6; טבלת דירות 1–3; מסלולים + clay 2–4; Kling (פרומפט, refs, QA, מיפוי) 3–6; 4 סיורים (cameras, prompts, gen-pano, תפרים, build) 8–16; כניסה ל-4 סוגים 4–8; פלטפורמה + פריסה 2–4; QA 1–2 | ~0 (התור מריץ; סשן רק כשמשהו נכשל) |
| מכונה | clay פנים 4 × ~12 דק' CPU; clay שטוח ~2,400 פריימים (orbit 420 + קשת 181 + 12 × 120 + 4 × 96) × 0.6–5 ש' EEVEE = 0.5–3.4 ש'; Kling ~18 קריאות × 1.5–4 דק' = 0.5–1.2 ש' (+timeouts של 30 דק'); GPT 44 × ~1 דק' ≈ 0.75 ש' | אותו דבר במקביל בתור: ~4–8 ש' wall |
| לוח שנה | 5–8 ימי עבודה: Blender אחד, מגבלת 5 השעות של המנוי, 2–3 סוכנים במקביל | ~יום אחד |

**המינימום האנושי** (גם אחרי שהכול אוטומטי):
1. **A2 = אישור התכנית**, פעם אחת לכל סוג דירה (4). אף פלט לא מתחיל לפני האישור (הגאומטריה מהתכנית, D-WQ-10/17).
2. **תקרת כסף לפרויקט**, פעם אחת, בצ'אט של הסשן המפעיל (memory contract 6).
3. **עין על המראה** מול habait-flow לפני כל קישור החוצה (D-WQ-12; הכלל "compare to best demo").
4. **הסכמת היזם** (`legal.publish_allowed`, D-WQ-18) ופרטי ליד/סוכן אמיתיים.

## רשימת כרטיסים מוצעת (בסדר)

הכרעות T0 של הכרטיס הזה, שהרשימה נשענת עליהן: (א) המוצר = הסרטון השטוח + עצירה נגררת (36); טיסת ה-equirect נשארת fallback ולא מחווטת כשלב. (ב) ברירת מחדל = גימור רצפה אחד; 3 גימורים = אפשרות בתקרה נפרדת. (ג) כל כרטיס עם Check שמראה גם קלט רע שנכשל.

| # | כותרת | סוכן | tier | תלות | Check |
|---|---|---|---|---|---|
| 38 | intake וקטורי כשלב של `cli.py` + בחירת מסלול אוטומטית + intake אחד לסוג (ראי) | engine-builder | T0 | 06, 04 | `$PY Habait/engine/test/test_intake_route.py` ירוק (PDF וקטורי → 16/16 מידות; PDF סרוק → רסטר; ראי → אותו plan משוקף) + dry-run מציג `intake_pdf_vector.py` ל-846 |
| 39 | טבלת דירות: מחירון/מפתח קומה → `units[]` + placement (הצעת הרחבה ל-`project.schema` של המנוע; units.v0 של הפלטפורמה רק additive) | engine-builder | T1 (שינוי סכמה) | 03, 38 | `$PY Habait/engine/building.py --selftest` + `test_units_table.py`: 12/12 דירות ממוקמות ≥95% בפלטה, 0 `stacked-approx`; דירה בקומה שגויה או מוזזת נכשלת |
| 40 | שלב `site` במנוע: GIS/OSM + אורתופוטו + צפון גאומטרי + מסה ממפתח הקומה → `site.glb` + nodes (פורט גנרי של שלב site של ה-Studio, `fit_plot.py`, `export_site_glb.py`) | engine-builder + blender-scene | T0 | 39 | `cli.py run <p> --stage site` על Rainbow: צפון 304.4±1°, IoU של ה-footprint ≥0.9 מול `tower-footprint.json`; צפון הפוך → FAIL |
| 41 | מחולל מסלולים: site + units → orbit, עצירה, קשת/טבעת, descend לכל דירה, enter לכל סוג (`paths.json` + camera לכל פריים, בלי קבועים של Rainbow) | blender-scene | T0 | 40 | selftest: על Rainbow פוזת הסיום ≤0.5 מ' / 1° מ-node-b-tower; כל descend נגמר 1.5 מ' מחוץ לפתח הסלון של הדירה; דירה בתוך המגדל → FAIL |
| 42 | שלב `flight-clay`: clay שטוח 16:9 לכל קטע (בעל Blender מקומית או Kaggle דרך `push_pull.py` במצב script) | cloud-render + blender-scene | T0 | 41 | `cli.py run <p> --stage flight-clay --dry-run` מפרט קטעים ופריימים; ריצת Kaggle של קטע אחד מחזירה N פריימים + camera.json זהה לתכנון (diff 0) |
| 43 | Kling לכל פרויקט: תבנית פרומפט ו-refs מ-`project.json` + שער "המצלמה עקבה" (ORB מול ה-clay) + facade_gate על פריימי Kling + סגירת לופ | genai-look | T1 (כסף) | 35, 42 | `$PY Habait/engine/gates/follow_gate.py` PASS על orbit_real ו-arc_real, FAIL על arc_real_1080 ו-pan_real (known-bad); `grep -c Rainbow` בקוד = 0 |
| 44 | ריהוט מהתכנית בשלב scene (`furnish_from_plan.py` לפני build_scene) | blender-scene | T0 | 07 | dry-run של scene מציג furnish; selftest: 0 פתחים חסומים, 0 חיתוכי קיר על ה-plan של ה-intake (`fixtures: []`) |
| 45 | backend לשלב `skin`: clay pano + refs → GPT 2.5 "change only the grey" + close-seam + kf_check / openings / תפר, לכל סוג ולכל גימור | genai-look | T1 (כסף) | 44, 20 | `$PY Habait/engine/test/test_skin_stage.py` (fal מזויף): cache = 0 קריאות, סירוב בלי ALLOW_SPEND, ledger לפני/אחרי; פנורמה מסובבת 3° נכשלת בשער |
| 46 | מחולל תיקיית tour360 מפלט המנוע (cameras.json, scenes.json, apartment.json, sets) + build-tour + smoke לכל סוג | platform-dev | T0 | 45 | `node Habait/tour360/tools/smoke.mjs <id שנוצר>` ירוק על תיקייה שנוצרה ל-846 מפלט המנוע |
| 47 | מחולל פרויקט פלטפורמה: פלט המנוע (units, video manifest, tour per type, dist) → `fixtures/<id>/` + `projects.json`; `build_segments.mjs` ו-flow בלי מפת פרויקטים בקוד; ZIP לפי סוג | platform-dev | T0 | 36, 46 | `node Habait/platform/contracts/validate.mjs Habait/platform/fixtures/gap-demo-tower` נקי, נבנה מ-`_local/gap-dryrun/new-id-demo`; `grep -c rainbow Habait/platform/tools/build_segments.mjs` = 0 |
| 27 (עדכון) | דף העלאה + תור עבודות: מעלים קבצים → project.json → התור מריץ `cli.py` שלב-שלב ומציג סטטוס לכל שלב, עוצר במסך A2 ובשערי כסף ("ממתין לאישור $X"), ממשיך ומפרסם | platform-dev | T2 | 38, 47 (אפשר להתחיל עם mocks אחרי 38) | `timeout 600 node Habait/platform/test/upload.test.mjs`: "upload→project.json ok; queue runs intake; stops at correction; stops at money gate; resume→publish ok; paid stage refused without cap", exit 0 |
| 48 | publish גנרי: stage + Vercel לכל פרויקט (במקום `stage_flow.py` / `stage_platform.py` עם rainbow בקוד) + שער T2 | platform-dev | T2 | 47 | `node Habait/platform/tools/publish.mjs <p> --dry-run` מכין תיקייה לשני פרויקטים; `legal.publish_allowed=false` → exit 3 |
| 49 | ליד לכל פרויקט: webhook/אחסון אמיתי + בדיקה; בלי webhook אין פרסום | platform-dev | T2 | 48 | טסט שולח ליד ל-webhook מזויף ומקבל 200; פרויקט בלי webhook נחסם ב-publish |
| M3 | שער: פרויקט שני מקצה לקצה בלי שינוי קוד | qa-reviewer | T1 | 38–49, 27 | `cli.py run Habait/engine/_local/gap-dryrun/new-id-demo --stage all --dry-run` בלי N/A ובלי NOWIRE + פרויקט שני אמיתי עד קישור, והשוואת מראה מול habait-flow |

**הסדר וההקבצה:** גל 9: 38, 44, ו-27 (UI עם mocks). גל 10: 39, 40. גל 11: 41, 42. גל 12: 43, 45. גל 13: 46, 47. גל 14: 48, 49, ואז M3. 3 סוכנים לכל היותר במקביל (מגבלת המנוי). אומדן: ~15–20 ימי סוכן, 3–4 שבועות לוח שנה.

**כרטיס 27 מעודכן, מה משתנה מול הנוסח הקיים:** (1) התור מריץ את `cli.py` עם כל השלבים החדשים (site, paths, flight-clay, video, skin, tour, platform, publish), לא רק intake → A2 → publish; (2) עצירה גם בשער כסף, עם האומדן מה-dry-run ("ממתין לאישור $X") ולא exit 3; (3) מסך סטטוס לכל שלב שמציג את שורות ה-dry-run (RUN / SKIP / DEFER / REFUSE / need); (4) worker אחד שמחזיק את Blender (scene, clay, flight-clay) ו-Kaggle לשאר; (5) 3 צעדים לאלירן (העלאה → אישור תכנית → תוצאות), השאר תחת "הגדרות מתקדמות"; (6) Railway רק אחרי שהכול רץ מקומית (T2).
