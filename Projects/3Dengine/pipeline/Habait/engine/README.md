# Habait engine: המנוע (ערוץ A) ו-`cli.py` (habait-engine)

המנוע לוקח את הקבצים של פרויקט (תכנית מכר PDF, ובהמשך DXF/IFC ורנדרים) ומוציא את החוזים שכל שאר הערוצים צורכים: `plan.json` (גאומטריה בס"מ), `units.json` (קופסה תלת-ממדית לכל דירה), סצנת clay ופנורמות, ודף דירה + ZIP. **הגאומטריה תמיד מהתכנית; מודלים גנרטיביים רק צובעים** (D-WQ-10/17). שום דבר כאן לא נקרא על שם פרויקט או דירה, חוץ מהפיקסטורות.

`cli.py` היא פקודה אחת שמריצה את שלבי המנוע על **תיקיית פרויקט**, מכל `project.json` (אף פעם לא שם של דירה). כל כלי רץ כתהליך חיצוני (intake, gates, building, Blender, build_zip); שום דבר מה-Studio לא מיובא. כרטיס 04 בלוח `habait-workplan-2026-11-02` כתב אותה; כרטיס 31 הרחיב את התיעוד.

נכון ל-**2026-11-02 18:05 שעון המכונה** (כרטיס 31; כל התוכן של כרטיס 04 נשמר למטה). **כל פקודה במסמך הזה רצה היום**, בכרטיס שמצוין לידה או מחדש בכרטיס 31. פקודה שלא רצה מסומנת "לא הורץ עדיין". פקודה שצריכה Blender, Kaggle, כסף או את אלירן מסומנת כך.

## המסמכים

| מסמך | מה |
|---|---|
| `README.md` (זה) | מה המנוע, הערוצים, תיקיית פרויקט, השלבים, הזמנים, השערים, החוזים, מה לא מחווט |
| [`docs/add-a-project-he.md`](docs/add-a-project-he.md) | איך מוסיפים פרויקט: project.json → intake → מסך תיקון → `cli.py run` → פרסום |
| [`docs/swap-a-model-he.md`](docs/swap-a-model-he.md) | איך מחליפים מודל: registry + adapter → `--dry-run` → ריצה מאושרת → דף → הכרעה → איפה מוגדר מודל הרשומה |
| [`docs/fresh-run-checklist-he.md`](docs/fresh-run-checklist-he.md) | רשימת הפקודות המדויקת לסוכן טרי: 846 מ-PDF עד dist, עם שורת הפלט הצפויה לכל צעד |
| `docs/fresh-run-report.md` | הדוח של ההרצה הטרייה. נכתב על ידי ה-`qa-reviewer` שהסשן הראשי מפעיל; עד אז הוא לא קיים |
| [`intake/README.md`](intake/README.md) | שלושת מסלולי ה-intake (רסטר + VLM, PDF וקטורי, DXF/IFC), פורמט report.json, תוצאות 846 |
| [`correct/README-he.md`](correct/README-he.md) | מסך התיקון (A2) וחוזה `report.json` |
| [`bench/README-he.md`](bench/README-he.md) | הבנצ'מרק החי למודלים חדשים |
| `experiments/look-lock/REPORT-he.md` | LoRA + A/B של הלוק (כרטיס 12) |

## הערוצים: מה יש היום ואצל מי

| ערוץ | תיקייה | מה עובד היום | README | בעלים |
|---|---|---|---|---|
| **A מנוע** | `Habait/engine/` | intake (רסטר, PDF וקטורי, DXF, IFC), מסך תיקון A2, gates (plan / facade / qa.html), `building.py` (units.json), `cli.py` (8 שלבים), bench | זה + `intake/`, `correct/`, `bench/` | habait-1d |
| **B לוק** | `Habait/engine/experiments/`, `360walkaround/pipeline/furnish_from_plan.py` (קובץ חדש), `Habait/platform/js/transition360.js` | פנורמות זולות (Seedream + close-seam v2, $0.30), LoRA + A/B (מודל הרשומה נשאר GPT 2.5), ריהוט מהתכנית, מעבר 360→360 | `experiments/look-lock/REPORT-he.md` | habait-1d (הקבצים של 98 בקריאה בלבד) |
| **C ריחוף** | `Habait/flyover/` | מסלול טיסה בקטעים (`equirect/`), חוות Kaggle (`kaggle/`), שכבות חיים (`life/`), פוליגוני דירות לכל פריים (`hotspots/`), ספינר זמינות 72 פריימים (`turntable/`), כניסה לדירה (`enter.py`), אפיית v5 (`renders/baked-v5/`) | `Habait/flyover/*/README-he.md`, `REPORT.md`, `REPORT-C5-he.md` | habait-1d; **Blender = habait-98**; Kaggle = החשבון `eliranhabait` |
| **D פלטפורמה** | `Habait/platform/` | `flow.html` (טיסה → עצירה → בוחר דירות), `apartment.html` (5 לשוניות + ZIP), `landing.html` (A/B), analytics + sink מקומי, `tools/build_zip.mjs`, `serve.mjs` ב-:8850 | `Habait/platform/README.md` | habait-1d (`js/picker.js` נטען חי גם ב-:8899 של 98: הודעה ל-98 לפני שינוי) |
| **E מאגר ותיעוד** | `C:\RnD\Projects\Habait\data\sales-plans\`, `Habait/engine/docs/` | מאגר תכניות מכר + כיתוב משפטי (`legal/disclaimer-he-en.md`), התיעוד הזה | `C:\RnD\Projects\Habait\data\sales-plans\LABELING-GUIDE-he.md` | habait-1d |

מחוץ למנוע ושייך ל-**habait-98**: `Habait/tour360/**` (הסיור, `gen-pano.mjs`, skins), `Habait/studio/**`, `360walkaround/**` (חוץ מהקובץ החדש של כרטיס 07), `C:\RnD\Projects\Habait\tools\bench\**` (kf_check, openings_gate), Vercel `habait-flow`. המנוע קורא מהם כתהליך חיצוני ולא עורך אותם.

## התחלה מהירה

```bash
cd C:/RnD/Projects/Habait/habait-walkaround && export PYTHONIOENCODING=utf-8
export HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps       # sharp ל-build_zip (שלב export)
PY=/c/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe
$PY Habait/engine/cli.py init   Habait/engine/_local/<project> --from Habait/engine/fixtures/<x>.project.json
$PY Habait/engine/cli.py run    Habait/engine/_local/<project> --stage all --dry-run    # מה ירוץ, מה ידולג, מה יסורב
$PY Habait/engine/cli.py run    Habait/engine/_local/<project> --stage intake,plan,building,export
$PY Habait/engine/cli.py status Habait/engine/_local/<project>                          # ledger + stamps
```

`init` מעתיק את `project.json` ומתרגם נתיבים יחסיים (`../`) לתיקייה החדשה. בדיקה של 846: `Habait/engine/_local/apt846-project/`, הפרויקט האמיתי שרץ היום intake → plan → building → scene → clay → export. הדרך המלאה לפרויקט חדש: [`docs/add-a-project-he.md`](docs/add-a-project-he.md).

## זמנים ועלויות מדודים (846, 2026-11-02)

| צעד | זמן מדוד | עלות | מי מריץ | מקור |
|---|---|---|---|---|
| `validate_project.py --check-files` | פחות משנייה | $0 | כל סשן | כרטיס 31 |
| `cli.py init` | פחות משנייה | $0 | כל סשן | כרטיס 31 |
| intake וקטורי (`intake_pdf_vector.py`) | 11–15 ש' (כרטיס 31), ~25 ש' (כרטיס 06) | $0, בלי VLM | כל סשן | כרטיסים 06, 31 |
| intake רסטר (שלב `intake`, עם תשובות VLM שמורות) | 60.1–145.5 ש' (כרטיס 31 וההרצה הטרייה), 94.2–116.7 ש' (כרטיס 04) | $0 | כל סשן | ledger |
| intake רסטר עם VLM חי (`claude -p --model opus`) | עוד 2 קריאות × 60–100 ש' | $0 כסף; צורך ממכסת 5 השעות של המנוי | כל סשן | כרטיס 01 |
| מסך תיקון A2 | לא נמדד בדקות; 14 הקשות + גרירה אחת על תכנית 3 השגיאות | $0 | **אלירן** | כרטיס 02 |
| שלב `plan` (validate + plan_gate + בקרה שלילית) | 1.5–7 ש' | $0 | כל סשן | ledger |
| שלב `building` | 14–55 ש' (תלוי בעומס) | $0 | כל סשן | ledger |
| שלב `scene` (build_scene ב-Blender) | 20.3 ש' | $0 | **בעל ה-Blender (habait-98)** | ledger, ריצה 2 |
| שלב `clay` (11 נקודות, 1024×512 @16spp, CPU) | 699.4 ש' | $0 | **בעל ה-Blender (habait-98)** | ledger, ריצה 2 |
| שלב `skin` | לא מחווט | אומדן $26.40 (11 × $2.40) | **אלירן** (אישור + תקרה) | כרטיס 04 |
| שלב `video` (אימוץ 5 קטעים של Rainbow) | כ-1.5 דק' (העתקה, חיתוך ffmpeg, חילוץ JPEG, ORB) | $0 באימוץ; קריאה חדשה = $0.094 לשנייה של קלט+פלט ב-720p (7 ש' = $1.32, 17 ש' = $3.20) | כל סשן לאימוץ; קריאה בתשלום: **אלירן** (אישור + תקרה) | כרטיס 35 |
| שלב `export` (build_zip) | 6.4–7.9 ש', ZIP 4.47 MB | $0 | כל סשן | ledger |
| Kaggle, קטע approach, 48 פריימים 2048×1024 128spp | 4.15 ש'/פריים על 2×T4; כל הטיסה (792 פר') ב-4K ≈ 3.7 ש' GPU (אומדן) | $0 (מכסה) | **Kaggle** (`push_pull.py`) | כרטיס 18 |

כל הריצה של 846 עד היום: **$0** (`ledger.json` של הפרויקט, 21 שורות, `spent_usd 0.0`).

**שעון:** כל השעות כאן הן שעון המכונה כפי שבחותמות הקבצים, ב-`ledger.json` וב-`.stage.json` (‎`+02:00`). `date` של Git Bash יכול להדפיס אזור זמן אחר; משווים לפי החותמות. הזמנים משתנים עם העומס על המכונה: מה שקובע הוא exit והשדות בפלט, לא השניות.

## תיקיית פרויקט

| נתיב | מה |
|---|---|
| `project.json` | הקלט (סכמה: `schema/project.schema.json`; נבדק ב-`validate_project.py --check-files` לפני כל ריצה) |
| `intake/<unit>/` | פלט `intake/intake_raster.py` (כרטיס 01); `v1/plan.json` = **טיוטה** |
| `intake/<unit>.vlm-reply.txt`, `.assign-reply.txt` | (רשות) תשובת VLM שמורה: ריצה דטרמיניסטית ב-$0 בלי לקרוא שוב ל-Opus |
| `intake-vector/<unit>/` | (מוסכמה של התיעוד, לא של ה-CLI) פלט `intake/intake_pdf_vector.py`: `plan.json`, `report.json`, `report.md`, `plan-crop.png`, `overlay.png`. נכנס לשלב `plan` רק דרך מסך התיקון (`--out <project>/plan/<unit>/corrected`) או `--plan` |
| `plan/<unit>/plan.json` | תכנית הרשומה + `qa/` (gates) + `source.json` (מאיפה) |
| `plan/<unit>/corrected/plan.json` | (רשות) פלט מסך התיקון A2 (`correct/serve.mjs --out` לכאן) |
| `building/` | פלט `building.py` (כרטיס 03): `units.json` + `box_world`, `units-geometry.json` |
| `scene/<unit>/` | תיקיית ה-tour של `render_tour.mjs`: `plan.json`, `scene-full.blend`, `renders/<cp>/{pano.webp,depth.png}` (שלב clay מרנדר לכאן) |
| `clay/<unit>/`, `skin/<unit>/` | stamps ולוגים |
| `video/segments.json` | (קלט, רשות) רשימת הקטעים של הפרויקט; בלעדיה נגזרת ברירת מחדל מ-project.json (סעיף "שלב video" למטה) |
| `video/<seg>/`, `video/manifest.json`, `video/_cache/` | פלט שלב video: `real.mp4`, `camera.json` (לכל פריים אמיתי), `first.jpg`/`last.jpg`, `jpg/`+`jpg_lo/` (קטעי עצירה), `segment.json`, `qa/`; המניפסט שהפלטפורמה קוראת; מטמון Kling לפי hash |
| `dist/<unit>/` | דף הדירה + ZIP (`platform/tools/build_zip.mjs`, כרטיס 23): `index.html`, `apartment.json`, `<number>.zip`, `media/`, `assets/` |
| `ledger.json` | שורה לכל ניסיון של שלב, נכתבת **לפני** הקריאה החיצונית (`started`) ונסגרת **אחריה**; `cost_usd` = 0 בשלבי $0 |
| `qa.html` | `gates/qa_report.py` (כרטיס 05) על כל תוצאות ה-gates, נבנה מחדש בסוף כל ריצה אמיתית |

## השלבים

| שלב | כלי חיצוני | gate | חוסם? |
|---|---|---|---|
| `intake` (גם `intake-raster`) | `intake/intake_raster.py` (אם קיים; אחרת "not available yet (card 01)") | `plan_gate.py` על הטיוטה עם `report.json` | **לא**: FAIL נרשם ב-qa.html והריצה ממשיכה (התיקון האנושי A2 בא אחריו) |
| `plan` | העתקה + `validate-plan.mjs` + `plan_gate.py` | validate exit 0 + plan_gate PASS + **בקרה שלילית**: החדר עם הכי הרבה קירות מוזז (10, 10) ס"מ וחייב להיכשל | כן |
| `building` | `building.py` | exit 0 + `units.json` מול `platform/contracts` units.v0 (`--selftest-building` מריץ גם את הבקרות השליליות של כרטיס 03) | כן |
| `scene` | Blender `build_scene.py --door-style zero-line --skirting off --material-board none` | הבדיקות של build_scene | כן |
| `clay` | `render_tour.mjs --mode draft --blender "$BLENDER"` | ההוכחה של render_tour (פענוח עומק, nadir) | כן |
| `skin` | **בתשלום** (v0: אין backend מחווט) | kf_check לפני כל הוצאה | סירוב = exit 3 |
| `video` | העתקה/חיתוך של קליפ קיים ($0), או `video/kling_v2v.py` (Kling 4.0 v2v על fal, **בתשלום**) | `rest_anchor` (ORB מול הפריים האחרון של הקטע הקודם; advisory) + אימות המניפסט (חוסם) | סירוב = exit 3; חסר clay = exit 2 (`need`) |
| `export` | `platform/tools/build_zip.mjs` | ZIP ≤ 25 MB + index.html + apartment.json (מבני) | כן |

מקור תכנית הרשומה בשלב `plan`, הראשון שקיים: `--plan <file>` → `plan/<unit>/corrected/plan.json` → `correct/_local/<unit>/plan.json` → `units[].files.plan_json` → טיוטת ה-intake. ב-846 היום נבחרת `units[].files.plan_json` = `360walkaround/tours/apt846/plan.json` (תכנית שנבדקה ביד), כי אין עדיין פלט A2.

**דילוג (idempotent):** כל צעד מחשב hash של הקלטים שלו (קבצים, הסקריפטים החיצוניים, הפרמטרים) ומדלג כשה-stamp (`<stage>/<unit>/.stage.json`) זהה והפלטים קיימים. `--force` מריץ מחדש. נבדק בכרטיס 31: ריצה שנייה של `intake,plan,building,scene,clay,export` → `skip 4 · defer 1 · dry-run-only 1`, שנייה אחת.

## כסף ו-Blender

- קריאות בתשלום של `skin` / `video` רצות רק עם `HABAIT_ALLOW_SPEND=1` **וגם** `HABAIT_CAP_USD=<usd>` בסביבת התהליך (לא מ-`.env`), ורק אם הוצאות ה-ledger + האומדן ≤ התקרה. אחרת `REFUSED: ...`, exit 3, ושורת ledger עם cost 0. גם כשמותר, `skin` עוצר ב-exit 4 (`NOT WIRED`) בלי לקרוא לשום מודל. `video` מחווט (כרטיס 35): אימוץ קליפ קיים או פגיעה במטמון רצים ב-$0 גם בלי הדגלים; קריאה חדשה רק עם שניהם. חיווט backend = כרטיס נפרד עם תקרה ואישור של אלירן בצ'אט שהפעיל אותו.
- Blender שייך לסשן אחד (SESSIONS.md; היום habait-98). בלי `HABAIT_BLENDER_OK=1`: `scene` מכין את plan.json ומדפיס את הפקודה (`deferred`), `clay` מריץ את `render_tour.mjs --dry-run` (`dry-run-only`); שניהם בלי stamp, כך שהריצה האמיתית לא תדולג.
- **מי מריץ Blender:** רק הסשן שמחזיק את Blender ב-SESSIONS.md (היום habait-98), ריצה כבדה אחת בכל רגע. הפקודה שרצה היום ב-17:15–17:27 (exit 0, scene 20.3 ש', clay 699.4 ש'), **בעל ה-Blender בלבד:**

  ```bash
  HABAIT_BLENDER_OK=1 $PY Habait/engine/cli.py run Habait/engine/_local/apt846-project --stage scene,clay --clay-res 1024x512 --clay-samples 16
  ```

  הלוג המלא: `Habait/engine/_local/apt846-project/card04_scene_clay_by98.log`. סשן אחר משתמש בפנורמות שכבר בדיסק: `Habait/engine/_local/apt846-project/scene/apt846/renders/<cp>/pano.webp` (11 נקודות). ברירת המחדל של render_tour (4096x2048@64) כבדה מדי ל-CPU.
- **סוכן שרץ לבד** (בלי סשן, למשל לפי `docs/fresh-run-checklist-he.md`): לא קורא את SESSIONS.md ולא פונה לאף סשן. השורה `Blender is owned by another session (SESSIONS.md: habait-98)` בפלט אומרת לו רק ש-Blender לא שלו; הוא ממשיך עם הפנורמות שבדיסק ורושם זאת.
- **Kaggle** (רנדרי ריחוף על GPU, $0 מתוך מכסה שבועית, 2 סשני GPU במקביל לחשבון): `Habait/flyover/kaggle/README-he.md`. הפקודה שרצה היום (כרטיס 18): `$PY Habait/flyover/kaggle/push_pull.py --seg approach --frames 1-48 --res 2048x1024`. המפתח ב-`C:\Users\elira\.kaggle\kaggle.json` (לא ב-`.env`).

## קודי יציאה

`0` תקין (dry-run תמיד 0 חוץ משגיאת שימוש) · `1` צעד או gate חוסם נכשל (הריצה נעצרת; `--keep-going` ממשיך) · `2` שימוש · `3` שלב בתשלום סורב · `4` שלב בתשלום מותר אבל לא מחווט ב-v0.

## דגלים

`--unit <id>[,<id>]` · `--plan <file>` (יחידה אחת) · `--vlm` / `--assign claude|none|file:<reply>` · `--platform-project <dir>` (אחרת התאמת id, ואז היוריסטיקת prefix: `rainbow-tlv` → `rainbow`) · `--plain-mass` · `--clay-res WxH --clay-samples N --points a,b` · `--timeout <s>` · `--quiet` (הפלט של הכלים נשאר ב-`<stage>/logs/`).

## ה-intake (כרטיס 01) כפי שהמנוע קורא לו

שלושת מסלולי ה-intake (רסטר + VLM, PDF וקטורי, DXF/IFC), פורמט report.json ואיך מריצים על 846: [`intake/README.md`](intake/README.md).

המקור המלא: ה-docstring ו-`--help` של `intake/intake_raster.py` (כרטיס 01). השלב `intake` מריץ:

```bash
$PY -B Habait/engine/intake/intake_raster.py <plan.pdf> --out <project>/intake/<unit> --vlm <claude|none|file:x> \
    --assign <claude|none|file:x> --model opus --apartment-id <unit> --publish v1 [--scale 50] \
    [--rights-state ...] [--rights-note ...] [--known-dims <intake.json>] [--ground-truth <plan.json>]
```

שלבים פנימיים (נשמרים ב-cache בתיקיית `--out`; `--force` מריץ מחדש): rasterize (pymupdf 288 dpi) → crop → VLM (Opus דרך `claude -p`, מנוי, $0) → trace A (tracer_cv) → assign (ה-VLM נותן שמות לאזורים) → trace B → כיול px→cm מהמידות המודפסות → `plan.json` + `report.json` + `report.md`, ו-`--publish v1` מעתיק אותם (+ `plan-crop.png`) ל-`v1/` שמסך התיקון קורא. המנוע מעביר `--force` רק כשה-PDF השתנה או עם `--force` של המנוע.

### PDF וקטורי קודם (כרטיס 06), רסטר רק לסריקות

ה-PDF של 846 הוא CAD וקטורי (46 שכבות OCG, הטקסט outlined). הקורא הווקטורי מחליף את רסטר + VLM + CV בגיליון כזה: 11 ש', בלי VLM, 16/16 מידות נקראו, סקייל 2.2681 px/cm, edit-cost 16 (מול 30 ברסטר). **הוא לא שלב של ה-CLI** (שלב `intake` מריץ רק את הרסטר); מריצים אותו ישירות (רץ היום בכרטיס 31, exit 0):

```bash
$PY -I Habait/engine/intake/intake_pdf_vector.py "דירה 846- 16.pdf" --out <project>/intake-vector/apt846 --apartment-id apt846 \
    --known-dims Habait/studio/fixtures/apt846.intake.json --ground-truth 360walkaround/tours/apt846/plan.json \
    --tour-crop-box-px "[1750,380,5500,4280]"
```

איך יודעים איזה מסלול: השורה הראשונה של הקורא הווקטורי מדפיסה `N primitives after clipping (D drawings, L OCG layers, T text spans)`. בגיליון סרוק אין drawings ואין שכבות, ואז חוזרים לשלב `intake` של ה-CLI. DXF / IFC: `intake/intake_dwg.py` / `intake/intake_ifc.py` (רצו היום על הדגימות הסינתטיות, exit 0, `total_edits: 0`).

## השערים ($0)

| שער | מה בודק | פקודה (רצה היום) | 846 היום |
|---|---|---|---|
| `360walkaround/pipeline/validate-plan.mjs` | סכמה ועקביות של plan.json (לא רואה חדר שזז) | `node 360walkaround/pipeline/validate-plan.mjs <plan.json>` | exit 0 על הווקטורי ועל ה-GT |
| `gates/plan_gate.py` | לכל חדר: קירות (‎−2..+7 ס"מ, kept ≥ 0.6), חפיפה, שטח (6%), מידות מודפסות (3%; חוסמות רק עם `--report` של ה-intake). ציון = החדר הגרוע. בנוסף: הערכים המודפסים במפת המידות (`--report`, או בלעדיו המפה שנקראה ביד `gates/fixtures/<unit>.dims.json`) חייבים להיות שווים ל-`printed_dimensions_cm` של `--intake`; אחרת FAIL (`printed values match intake: False`) גם כשכל החדרים עוברים | `$PY -B Habait/engine/gates/plan_gate.py <plan.json> --report <report.json> --intake <intake.json> [--out <json>]` | GT: PASS 0.784 (מ-18:29:16; בין 18:23 ל-18:29 FAIL 0.784, כי הפיקסטורה כבר אמרה 199 והמפה עוד 99); וקטורי עם `--report`: FAIL 0.500 (רק האמבטיה הכללית: 199 → 205.5, ‎+3.3%); `gates/fixtures/bad-plan.json`: FAIL 0.012, exit 1 |
| `gates/facade_gate.py` | קו מתאר וקומות של המגדל מוטלים על פריים חוץ מולבש, + שיא יישור | `$PY -B Habait/engine/gates/facade_gate.py Habait/flyover/renders/orig__proj1.png --camera Habait/flyover/projectors.json --footprint /c/RnD/Projects/Habait/tools/bench/site846/tower-footprint.json --project Habait/engine/fixtures/rainbow-846.project.json` | PASS 0.889, exit 0; `gates/fixtures/bad-facade.png`: FAIL 0.252, exit 1; עיוור ל-pitch/roll של 2° |
| `gates/qa_report.py` | אוסף כל JSON עם `gate` בתיקייה אחת → `qa.html` בעברית | `$PY -B Habait/engine/gates/qa_report.py <project> --out <project>/qa.html` | 4/5 ירוק (האדום = טיוטת ה-intake, advisory); exit 1 כשלא הכול ירוק |
| `correct/serve.mjs --selftest` | החוזה של מסך התיקון על plan + report + plan-crop | `node Habait/engine/correct/serve.mjs --plan <plan.json> --selftest` | `selftest OK` על הטיוטה הווקטורית ועל הרסטרית |
| `C:\RnD\Projects\Habait\tools\bench\kf_check.py`, `openings_gate.py` (של habait-98) | נעילת מצלמה לפי מחלקה; פתחי התכנית על פריים מולבש | דרך `bench/habait_bench.py` (ראו [`docs/swap-a-model-he.md`](docs/swap-a-model-he.md)) | `openings_gate` לא תפס סיבוב של 3° בפנורמה (כרטיס 29) |

## החוזים

| חוזה | איפה מוגדר | מי כותב → מי קורא |
|---|---|---|
| `project.json` (0.1.0) | `schema/project.schema.json`, `validate_project.py` | אדם / `init` → כל השלבים |
| `plan.json` (`geometry: general`, ס"מ, ‎+y למטה) | `360walkaround/pipeline/SCHEMA.md`, `GENERAL-POLYGONS.md` (של 98) | intake / A2 → plan → scene. בפלט ה-intake ה-origin הוא הפינה השמאלית-עליונה של `plan-crop.png`; ב-GT זו הפינה הצפון-מערבית החיצונית |
| `report.json` (`habait.intake-report/0.1`: `raster.cm_to_px`, `dimensions[]`, `frames`, `summary`) | `correct/README-he.md`, `intake/README.md` | intake → מסך התיקון, plan_gate |
| `corrections.json` (`[{type, target, before, after, t}]`) | `correct/README-he.md` | מסך התיקון → **נתוני אימון ל-intake: לא מוחקים** |
| `units.json` (units.v0; `box_world` במטרים, קומה 16 = z 0, צעד קומה 3.2 מ', תקרה 2.9) | `Habait/platform/contracts/units.schema.json` | building → פלטפורמה, hotspots, turntable |
| `apartment.json` (מניפסט הדף) | `Habait/platform/tools/build_zip.mjs` | export → `apartment.html`, `landing.html` |
| `ledger.json` (שורה לפני ואחרי כל קריאה) | `stages/common.py` | כל שלב → `cli.py status` |
| `registry.json` (`habait.bench-registry/0.1`) | `bench/registry.json` | אדם → `habait_bench.py` |

## איפה דברים נוחתים

| מה | נתיב |
|---|---|
| הפרויקט האמיתי של 846 (intake → clay → export) | `Habait/engine/_local/apt846-project/` (`ledger.json`, `qa.html`, `card04_scene_clay_by98.log`) |
| פנורמות ה-clay של 846 (11) | `Habait/engine/_local/apt846-project/scene/apt846/renders/<cp>/{pano.webp,depth.png}` |
| דף הדירה + ZIP של פרויקט | `<project>/dist/<unit>/{index.html,apartment.json,<number>.zip}` |
| הדף שהפלטפורמה החיה קוראת | `Habait/platform/_local/dist/<p>/<unit>/apartment.json`; הבונה (בעלים: הפלטפורמה): `node tools/build_zip.mjs fixtures/<p> <unit> --out _local/dist/<p>/<unit>` מתוך `Habait/platform` |
| intake וקטורי מכרטיס 06 / DXF / IFC | `Habait/engine/_local/apt846/vector/`, `Habait/engine/_local/dwg-sample/` |
| units.json של המגדל | `Habait/engine/_local/rainbow/units.json` |
| GLB בית-בובות (build_zip לוקח אותו אוטומטית) | `Habait/engine/_local/apt846/dollhouse/apt846.glb` |
| דף הבנצ'מרק + ה-ledger שלו | `Habait/engine/_local/bench/page.html`, `Habait/engine/_local/ledger-E2.json` |
| ledgers של כרטיסים בתשלום | `Habait/engine/_local/ledger-B2.json` ($4.32 מתוך $40), `ledger-B3.json` ($0.90 מתוך $5), `ledger-E2.json` ($0, תקרה $10 לריצה) |
| נתוני הריחוף | `Habait/flyover/equirect/_local/segments/<seg>/`, `Habait/flyover/turntable/_local/`, `Habait/flyover/renders/baked-v5/` |

## שלב video (כרטיס 35, 2026-11-03)

המתכון של הדמו כשלב של המנוע, לכל פרויקט: Blender מרנדר סרטון **clay שטוח** (16:9) עם הגיאומטריה האמיתית ו-`camera.json` לכל פריים → קריאה אחת ל-`kling/v4/video-to-video/edit` (@Video1 = ה-clay, @Image1.. = ייחוסים) → סרטון פוטוריאלי שהמצלמה שלו היא מצלמת ה-clay, ממופה לפריימי האמת.

```bash
$PY Habait/engine/cli.py run Habait/engine/_local/apt846-project --stage video --dry-run   # adopt / call ($) / need לכל קטע
$PY Habait/engine/cli.py run Habait/engine/_local/apt846-project --stage video             # אימוץ ב-$0 (בלי דגלי כסף)
HABAIT_ALLOW_SPEND=1 HABAIT_CAP_USD=<usd> $PY Habait/engine/cli.py run <project> --stage video   # רק כשיש קטע CALL
$PY Habait/engine/test/test_video_stage.py                                                   # fal מזויף, $0
$PY Habait/engine/video/manifest.py <project>/video/manifest.json                            # אימות המניפסט
$PY Habait/engine/video/rest_anchor.py <prev.mp4> <hold.mp4> --expect <frame>                # היכן פוזת העצירה בקטע
```

| קובץ | מה |
|---|---|
| `stages/video.py` | השלב: לכל קטע SKIP / ADOPT / NEED / CALL, ואחריו צעד `manifest` |
| `video/spec.py` | `video/segments.json` (`habait-engine/video-segments.v1`), או ברירת מחדל מ-project.json: orbit, hold-arc, ולכל דירה descend-<מספר>, enter-<מספר>, עם clay צפוי ב-`<project>/clay/video/<seg>/{clay.mp4,camera.json}` |
| `video/kling_v2v.py` | הקריאה: מגבלות Kling, אומדן, מטמון לפי sha256(clay, refs, prompt, רזולוציה, משך), תבנית פרומפט לכל תפקיד (המילים מ-`look` של הפרויקט + project.json; אין מחרוזת של פרויקט בקוד), backend של fal (`FAL_KEY` מ-`.env` בשם בלבד) |
| `video/camera_map.py` | `camera.json` לפריימי האמת (מטריצת עולם + fov לכל פריים, אותו פורמט כמו `Habait/flyover/orbit/camera.json`) |
| `video/rest_anchor.py` | שער $0: ORB + RANSAC בין הפריים האחרון של הקטע הקודם לכל פריים בקטע העצירה |
| `video/manifest.py` | בנייה ואימות של `video/manifest.json` (`habait-engine/video.v1`) |

**מגבלות Kling 4.0 v2v (סכמת fal):** קליפ מקור 3–30.05 ש', 23.9–60 fps, כל צלע 700–4553 px, יחס 0.4–2.5, עד 300 MB; פלט 3–30 ש'; `resolution` 720p|1080p (ברירת המחדל של fal היא 1080p: תמיד מעבירים 720p, שעוקב אחרי ה-clay טוב יותר); הפלט N+1 פריימים לקליפ של N; בלי ריפוד.

**מיפוי המצלמה:** ברירת המחדל = מיפוי זמן ליניארי עם קצוות תואמים (פריים אמיתי 1 ↔ פריים ה-clay הראשון שהסרטון מכסה, האחרון ↔ האחרון). זה **מודל**: Kling עוקב אחרי סוג התנועה ולא תמיד אחרי התזמון. בקטעי עצירה השלב מודד את פוזת העצירה מול הפריים האחרון של הקטע הקודם (שניהם פוטוריאליים, ORB עובד; clay מול אמיתי לא: F-score של קצוות ו-NCC של גרדיאנט לא הבחינו בין קשת טובה לטבעת שנכשלה), ואם היא רחוקה יותר מ-3 פריימים מהמיפוי, המצלמה עוברת דרכה (piecewise-linear) ו-`rest_frame` = הנמדד. `camera_trust` בכל קטע אומר מה נמדד ומה הונח.

**כסף:** אימוץ ופגיעה במטמון = $0 ובלי דגלים. CALL = ההגנה של `paid.py` (`spend_refusal`): בלי `HABAIT_ALLOW_SPEND=1` + `HABAIT_CAP_USD`, או אם ledger + אומדן > תקרה → exit 3 בלי קריאה. שורת ה-ledger נכתבת `started` לפני הקריאה, מקבלת `request_id` ברגע ש-fal קיבל את העבודה, ונסגרת עם העלות; עבודה שנשלחה ונכשלה נרשמת באומדן עד שהחשבונית של fal אומרת אחרת. `kf_check` רץ לפני קריאה אם לקטע יש `kf_check` ב-spec.

**Rainbow (`_local/apt846-project/video/`, 3.11):** 5 קטעים מאומצים ב-$0 (orbit = `orbit_real.mp4` של ab, $3.30; hold-arc = `arc_real.mp4` של ba, $1.50, ברירת המחדל; hold-ring = `ring_real.mp4`, $1.88, **preview בלבד**: נכשל כמוצר; descend-846 = פריימים 96–201 של הטיסה המלאה, $3.20; enter-846 = פריימים 202–409 של אותה טיסה, נגמר ב-cp-living). העתקים, לא קישורים: שינוי של ba ב-ring/arc/descent → ריצה חוזרת של השלב.

## מה לא מחווט / פגמים ידועים (2026-11-02)

1. **skin לא מחווט** (exit 4 גם כשמותר; `video` מחווט מ-3.11, כרטיס 35). פקודות skin הן תבנית בלבד: `gen-pano.mjs` מקבל שמות סצנות של tour360, והמנוע מכניס `cp-*`. האומדן במנוע הוא $2.40 לפנורמה כמו `gen-pano.mjs gpt25x` (4096×2048), 11 נקודות = $26.40 (תוקן 2.11 אחרי M1; `paid.py` מדפיס PRICE DRIFT אם המחיר ב-gen-pano ישתנה).
2. **intake וקטורי הוא לא שלב של ה-CLI.** מריצים אותו ישירות ומכניסים את הפלט דרך A2 או `--plan`.
3. **שלב `plan` עם `--plan` לא מעביר את `report.json` ל-plan_gate.** הטיוטה הווקטורית של 846 עוברת שם ב-1.000 (המידות לא נבדקות), בזמן ש-`plan_gate.py --report` ישיר נותן FAIL 0.500. עד שזה מתוקן: מריצים את plan_gate הישיר עם `--report` לפני שמעבירים טיוטה, ועוברים דרך A2.
4. **export אורז את פנורמות הסיור הקיים** (`Habait/tour360/apartments/apt<unit>/panos/balanced`, מולבשות) ולא את ה-clay של הריצה. חיבור clay/skin → dist לא קיים.
5. **פרסום לפרויקט חדש: לא הורץ עדיין.** build_zip צריך תיקיית פלטפורמה (`Habait/platform/fixtures/<p>/` עם project.json, units.json, flow.json); היום יש רק `rainbow`. מזהי הפיקסטורות שונים (`rainbow-tlv/apt846` במנוע מול `rainbow/846` בפלטפורמה) ומחוברים בהיוריסטיקת prefix.
6. **99 → 199 תוקן בשני קבצים, ברצף:** `Habait/studio/fixtures/apt846.intake.json` (של 98) ב-18:23:13 (`printed_dimensions_cm` ושורת החדר), ו-`Habait/engine/gates/fixtures/apt846.dims.json` (מפת המידות של plan_gate) ב-18:29:16. בין השניים שלב `plan` נכשל (`printed values match intake: False`). עכשיו: הקורא הווקטורי `recall 16/16`, ה-intake הרסטרי `dims_read 15`, ו-plan PASS 0.784. כל תיקון של מידה מודפסת בעתיד: בשני הקבצים יחד. התכנית `360walkaround/tours/apt846/plan.json` לא השתנתה ולא צריכה.
7. **ה-GT של 846 בסקייל 2.25 px/cm**, האמיתי 2.2681: אורכי ה-GT ארוכים ב-0.8%. התיקון = בנייה מחדש של הסצנה והפנורמות (98).
8. מסך התיקון לא מוסיף/מוחק פינות או חדרים ולא עורך קירות. זמן תיקון אנושי לא נמדד בדקות (שאלת ה-T1 של כרטיס 02).
9. ל-`plan_gate.py` יש ברירת מחדל קשיחה `--intake` = 846: בפרויקט אחר תמיד מעבירים `--intake` (המנוע עושה את זה).
10. **export לא תלוי ב-plan או ב-building** (הוא אורז את פיקסטורת הפלטפורמה): dist נוצר גם כש-plan נכשל. מי שבודק "הריצה עברה" בודק גם את ה-stamp של plan ו-building (`<project>/plan/<unit>/.stage.json`, `<project>/building/.stage.json`).
