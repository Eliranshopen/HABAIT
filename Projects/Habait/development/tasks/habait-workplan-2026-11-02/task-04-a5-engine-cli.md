# משימה 04: A5: habait-engine CLI: שלבים idempotent עם ledger ו-gates

| שדה | ערך |
|---|---|
| **לוח** | `habait-workplan-2026-11-02` |
| **ערוץ** | A |
| **מקור בתכנית** | חלק ג §2 ערוץ A, שלב A5 ב-`C:\RnD\Projects\Habait\research\product-research-2026-11-02\HABAIT-RESEARCH-2026-11-02.md` |
| **סוכן** | `engine-builder` (`status: live`, `owner-track: habait`, `model: opus`) |
| **Ruling tier** | **T0** |
| **גל (wave)** | 3 |
| **מצב** | TODO |
| **זיכרון** | `memory/agents/` לא קיים בפרויקט הזה; הזיכרון של הסוכן הוא בלוק `## תוצאה` כאן (ראו rails). הסוכן הוא יכולת קבועה (לא one-off persona). |

## מטרה

פקודה אחת: `habait-engine run <project-dir> --stage intake|scene|clay|skin|video|export`. כל שלב מדלג על פלט קיים, כותב ledger, מריץ את ה-gate שלו, ומפיק `qa.html` (05). ריצה מלאה על 846 מ-PDF עד dist בלי יד אדם חוץ מ-A2. ה-Studio של habait-16 (`Habait/studio/`) נשאר כמו שהוא: ה-CLI קורא לסקריפטים שלו כתהליכים חיצוניים, לא מייבא אותם.

## תלויות

- 01 (intake), 03 (building), 05 (gates); שלבי scene/clay/skin מופעלים דרך סקריפטים קיימים של ערוצים B/C

## קלטים (קריאה)

- `Habait/studio/README.md` (חוזי השלבים, טבלת env: `HABAIT_ALLOW_SPEND`, `HABAIT_CAP_USD`, `HABAIT_PY`, `BLENDER`)
- 01, 03, 05
- `360walkaround/pipeline/render_tour.mjs` (clay), `Habait/tour360/tools/build-tour.mjs` (export)

## קבצים (הסוכן כותב רק כאן)

- `Habait/engine/cli.py` (חדש) + `Habait/engine/stages/*.py` (עטיפות)
- `Habait/engine/README.md` (שימוש)
- `Habait/engine/_local/<project>/ledger.json`, `qa.html`

## צעדים

1. להגדיר `project-dir` תקני: `project.json`, `intake/`, `plan/`, `scene/`, `clay/`, `skin/`, `video/`, `dist/`, `ledger.json`.
2. כל שלב: תנאי דילוג (hash של הקלטים), פקודה חיצונית עם `--blender "$BLENDER"` כשצריך, רישום ledger, gate אחרי.
3. `--dry-run` מדפיס מה היה רץ ומה מדולג (זה ה-Check).
4. ריצת intake+plan על 846 אמיתית; scene/clay רק dry-run (Blender של habait-16; הריצה האמיתית מתואמת איתו).

## קריטריוני קבלה

- [ ] `--dry-run` על 846 מדפיס את ששת השלבים עם מצב skip/run נכון.
- [ ] שלב intake רץ באמת ומפיק plan.json זהה לזה של 01 (hash).
- [ ] שום שלב בתשלום לא רץ בלי `HABAIT_ALLOW_SPEND=1` (נבדק: בלי המשתנה, skin מדפיס REFUSED).
- [ ] ledger.json נכתב גם לשלבי $0 (עם cost 0).

## Gate

**Check:**
```bash
cd C:/RnD/Projects/Habait/habait-walkaround && export PYTHONIOENCODING=utf-8 && PY=/c/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe && timeout 600 $PY Habait/engine/cli.py run Habait/engine/_local/apt846-project --stage all --dry-run && timeout 900 $PY Habait/engine/cli.py run Habait/engine/_local/apt846-project --stage intake && $PY Habait/engine/cli.py run Habait/engine/_local/apt846-project --stage skin
# צפוי: dry-run מפרט 6 שלבים; intake exit 0 ו-plan.json נוצר; skin מדפיס "REFUSED: HABAIT_ALLOW_SPEND" ו-exit 3
```

**Reviewer scope:** בטיחות כסף בלבד: אף שלב בתשלום לא מתבצע בלי הדגל והתקרה; ה-ledger נכתב לפני ואחרי כל קריאה.

הבודק (אם נדרש) הוא `qa-reviewer` בהקשר נקי, לא הסשן שביצע.

## כסף

$0 (ה-CLI עצמו לא קורא למודלים; שלבי skin/video רצים רק עם `HABAIT_ALLOW_SPEND=1` ותקרה, כמו ב-Studio)

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

_(engine-builder, ‏2.11, ‏15:00–16:00 בשעון המכונה. הופעל על ידי habait-ab מהעץ הראשי `C:\RnD\Projects\Habait\habait-walkaround` (main `506f63d`). דרגה T0, לא הועלתה)_

- **מצב:** DONE. ארבעת קריטריוני הקבלה עומדים. לפני שמסמנים, צריך לקרוא את פגם 1 (README שנדרס).
- **מה נעשה:**
  - **`Habait/engine/cli.py`** (‏`habait-engine`). שלוש פקודות:
    - `init <dir> --from <project.json>`: מעתיק את project.json ומתרגם את כל הנתיבים היחסיים (`../`) לתיקייה החדשה.
    - `run <dir> --stage all|<s>[,<s>] [--dry-run] [--force] [--unit] [--plan] [--vlm/--assign] [--platform-project] [--keep-going] [--quiet]`.
    - `status <dir>`: מציג את ה-ledger ואת ה-stamps.
  - **שמונה שלבים:** intake (שם נרדף: intake-raster), plan, building, scene, clay, skin, video, export. הכרטיס ביקש שישה; plan ו-building נוספו לפי ההוראה של ab.
    - כל כלי רץ כתהליך חיצוני. שום דבר מה-Studio, מ-tour360 או מ-intake לא מיובא.
    - Python רץ עם `-B`, כדי שלא ייכתב `__pycache__` לתיקיות של אחרים. נבדק.
  - **‏`Habait/engine/stages/`:** ‏`common.py` מכיל את התשתית: hash קלטים, stamp, ‏ledger והרצה חיצונית עם לוג. לצידו מודול עטיפה לכל שלב: `intake.py`, `plan.py`, `building.py`, `scene.py` (‏scene ו-clay), `paid.py` (‏skin ו-video), `export.py`.
  - **לפני כל ריצה:** `validate_project.py --check-files`.
  - **אחרי כל ריצה אמיתית:** `gates/qa_report.py` בונה את `<project>/qa.html`.
  - **‏`Habait/engine/README.md`** בעברית: שימוש, מבנה התיקייה, השלבים וה-gates, כסף ו-Blender, קודי יציאה. כרטיס 31 ירחיב אותו.
  - **פרויקט הבדיקה** `Habait/engine/_local/apt846-project/`:
    - project.json הועתק מ-`fixtures/rainbow-846.project.json` דרך `init`, והנתיבים תורגמו.
    - תשובות ה-VLM וה-assign השמורות של כרטיס 01 הועתקו ל-`intake/apt846.{vlm,assign}-reply.txt`. כך ה-intake דטרמיניסטי וב-$0, בלי קריאה חוזרת ל-Opus.
- **הכרעות T0:**
  1. **‏intake טיוטה, לא חוסם (לפי ההודעה של ab):** ‏plan_gate רץ על `v1/plan.json` יחד עם ה-report.json של ה-intake. התוצאה ב-846: ‏FAIL, ציון 0.000, החדר הגרוע r-bedroom. ה-FAIL נרשם אדום ב-qa.html וב-ledger, השלב מסתיים ok והריצה ממשיכה.
  2. **מקור התכנית בשלב plan** (הראשון שקיים):
     - `--plan`
     - `plan/<unit>/corrected/plan.json`
     - `correct/_local/<unit>/plan.json` (ברירת המחדל של מסך A2)
     - `units[].files.plan_json`
     - טיוטת ה-intake

     ב-846 נבחרה ה-ground truth (`360walkaround/tours/apt846/plan.json`), כי עדיין אין פלט של A2.
  3. **הגייט של plan חוסם, ויש לו בקרה שלילית בכל ריצה:**
     - validate-plan exit 0, וגם plan_gate PASS.
     - בנוסף, החדר עם הכי הרבה קירות מוזז ב-(10, 10) ס"מ (`plan_gate.py --make-bad`), והגייט חייב להיכשל עליו.
     - ב-846: ‏PASS 0.784 מול known-bad ‏(r-living) FAIL 0.1.
     - תוצאת הבקרה מסומנת `known_bad: true`, וכך qa_report מציג אותה ירוק כשהיא נכשלת.
  4. **כסף:**
     - skin ו-video רצים רק עם `HABAIT_ALLOW_SPEND=1` **וגם** `HABAIT_CAP_USD` חיובי, שניהם מהסביבה ולא מ-`.env`. בנוסף, הסכום ששולם לפי ה-ledger ועוד האומדן חייבים להיות ≤ התקרה.
     - אחרת יוצא `REFUSED: ...` עם exit 3, ונכתבת שורת ledger עם cost 0.
     - גם כשמותר, ב-v0 אין backend מחווט: ‏exit 4 ‏(`NOT WIRED`), בלי שום קריאה.
     - נבדקו ארבעה מצבים: בלי הדגל → 3, בלי תקרה → 3, תקרה $5 מול אומדן $13.20 → 3, מותר → 4.
  5. **Blender (של habait-98):**
     - בלי `HABAIT_BLENDER_OK=1`, שלב scene רק מכין את plan.json ומדפיס את פקודת build_scene, עם `--door-style zero-line --skirting off --material-board none` (סטטוס `deferred`).
     - שלב clay מריץ `render_tour.mjs --dry-run --blender "$BLENDER"` (סטטוס `dry-run-only`, ‏exit 0, ‏11 נקודות).
     - שני השלבים לא כותבים stamp.
  6. **"plan.json זהה לזה של 01 (hash)":**
     - ה-hash של הבייטים שונה. ההבדל רק ב-`plan_meta`: נתיב ה-PDF, נתיב תשובת ה-VLM ו-rights_note.
     - ה-hash הקנוני (כל הקובץ חוץ מ-`plan_meta`) **זהה**: `8ded2c68…49ab6`.
     - בדרך התגלה ש-`--ceiling-cm 290` מפורש הופך את 290 ל-290.0 ב-17 קירות. לכן המנוע מעביר את הדגל רק כשהערך שונה מברירת המחדל של הכלי.
  7. **‏export:** ‏build_zip.mjs רץ באמת ($0, כותב רק ל-`dist/apt846/`), עם gate מבני: ZIP של 4.47 MB, פחות מ-25 MB.
     - פרויקט הפלטפורמה נמצא בהיוריסטיקת prefix: ‏`rainbow-tlv` → `rainbow`. ההתאמה מודפסת, ו-`--platform-project` גובר עליה.
  8. **‏idempotent:** ריצה חוזרת דילגה על intake, plan, building ו-export. השינוי של ab ב-`platform/fixtures/rainbow/project.json` זוהה כ-"inputs changed: platform_project".
- **קבצים שנכתבו:**
  - `C:\RnD\Projects\Habait\habait-walkaround\Habait\engine\cli.py`
  - `C:\RnD\Projects\Habait\habait-walkaround\Habait\engine\stages\{__init__,common,intake,plan,building,scene,paid,export}.py`
  - `C:\RnD\Projects\Habait\habait-walkaround\Habait\engine\README.md`. ראו פגם 1.
  - `C:\RnD\Projects\Habait\habait-walkaround\Habait\engine\_local\apt846-project\`:
    - project.json, project.source.json, ledger.json (17 שורות, $0), qa.html (4/5 ירוק)
    - ‏intake/apt846/** (טיוטה + qa/plan_gate.draft.json)
    - ‏plan/apt846/** (plan.json + qa/ עם הבקרה השלילית)
    - ‏building/** (units.json ‏+ box_world)
    - ‏scene/apt846/plan.json
    - ‏clay/apt846/logs
    - ‏dist/apt846/** (846.zip, index.html, apartment.json)
- **הריצה האמיתית של intake (15:48, לפני ה-Check; ב-Check עצמו השלב דולג כי הקלטים לא השתנו):**
```
[1/1] intake [apt846]      RUN    inputs changed: args
        gate  plan_gate: FAIL  score=0.000  worst_room=r-bedroom  worst_dim_dev=24.4%  (advisory)
        -> ok  exit 0  gate FAIL (advisory)  $0.00  94.2 s  | draft plan.json written; draft gate FAIL (advisory); report: rooms_total 10, rooms_named 8, dims_read 14, dims_total 16, max_dev_pct 105.9
summary   run 1 · ledger Habait/engine/_local/apt846-project/ledger.json $0.00
qa        qa_report: 0/1 green -> C:\RnD\Projects\Habait\habait-walkaround\Habait\engine\_local\apt846-project\qa.html
exit=0
$ python planhash.py apt846/v1/plan.json apt846-project/intake/apt846/v1/plan.json   # sha256 של plan.json בלי plan_meta
card01  8ded2c689bb069c52bac5cbce7e9c3677fb78657f6840021ed5d3b32b1a49ab6
engine  8ded2c689bb069c52bac5cbce7e9c3677fb78657f6840021ed5d3b32b1a49ab6
GEOMETRY-HASH IDENTICAL
```
- **שלבי $0 האחרים, ריצה אמיתית (15:50):**
```
[1/5] plan [apt846]        RUN    no stamp: never completed here
        validate-plan.mjs exit 0
        plan_gate: PASS  score=0.784  worst_room=r-bath-guest  worst_dim_dev=41.0%
        negative control (r-living moved 10,10 cm): FAIL (as it must)  score=0.1
        -> ok  exit 0  gate PASS  $0.00  1.8 s  | plan of record from project.json units[].files.plan_json (hand-checked)
[2/5] building             RUN    no stamp: never completed here
        building.py exit 0; units.json: OK against units.v0
        -> ok  exit 0  gate PASS  $0.00  14.8 s  | 1 unit box(es) in units.json
[3/5] scene [apt846]       DEFER  Blender is owned by another session (SESSIONS.md: habait-98); set HABAIT_BLENDER_OK=1 only in the session that owns it
        -> deferred  exit 0  $0.00  | plan staged; Blender build deferred to the Blender owner
[4/5] clay [apt846]        DRYRUN render_tour.mjs --dry-run only (Blender owned by habait-98; HABAIT_BLENDER_OK != 1)
        -> dry-run-only  exit 0  $0.00  0.2 s  | render_tour.mjs --dry-run exit 0 (nothing rendered)
[5/5] export [apt846]      RUN    no stamp: never completed here
        -> ok  exit 0  gate PASS  $0.00  7.9 s  | build_zip exit 0, zip 4.47 MB
qa        qa_report: 4/5 green -> ...\apt846-project\qa.html      (האדום = טיוטת ה-intake, advisory)
```
- **פלט ה-Check (מילה במילה).** הפקודה היא בדיוק השורה שבכרטיס, בלי שינוי, כי שמות הקבצים תואמים. העטיפה `(...; echo "exit=$?") > check.txt 2>&1` נוספה רק כדי ללכוד את הפלט:
```
habait-engine run  project=rainbow-tlv  dir=Habait/engine/_local/apt846-project  stages=intake,plan,building,scene,clay,skin,video,export  DRY-RUN (nothing executed, nothing written)
preflight  validate_project.py --check-files: OK
[1/8] intake [apt846]      SKIP   inputs unchanged since 2026-11-02T15:49:46+02:00
        cmd   C:\RnD\Projects\Habait\tools\habait-venv\Scripts\python.exe -B Habait/engine/intake/intake_raster.py "דירה 846- 16.pdf" --out Habait/engine/_local/apt846-project/intake/apt846 --vlm file:C:\RnD\Projects\Habait\habait-walkaround\Habait\engine\_local\apt846-project\intake\apt846.vlm-reply.txt --assign file:C:\RnD\Projects\Habait\habait-walkaround\Habait\engine\_local\apt846-project\intake\apt846.assign-reply.txt --model opus --apartment-id apt846 --publish v1 --scale 50 --rights-state partner-supplied --rights-note "the developer's sales plan held by Slava; a private pitch only until Israel Canada consents (D-WQ-18, OWED-658)" --known-dims Habait/studio/fixtures/apt846.intake.json --ground-truth 360walkaround/tours/apt846/plan.json
        cmd   C:\RnD\Projects\Habait\tools\habait-venv\Scripts\python.exe -B Habait/engine/gates/plan_gate.py Habait/engine/_local/apt846-project/intake/apt846/v1/plan.json --report Habait/engine/_local/apt846-project/intake/apt846/v1/report.json --intake Habait/studio/fixtures/apt846.intake.json --out Habait/engine/_local/apt846-project/intake/apt846/qa/plan_gate.draft.json
        gate  plan_gate.py on the DRAFT with the intake's report.json (dims gate on); ADVISORY: a FAIL is recorded in qa.html and the run goes on to A2 correction / the plan stage
        note  vlm backend file:Habait/engine/_local/apt846-project/intake/apt846.vlm-reply.txt, assign file:Habait/engine/_local/apt846-project/intake/apt846.assign-reply.txt ($0: subscription CLI or seeded reply)
        cost  $0.00 estimate ($0 stage)
[2/8] plan [apt846]        SKIP   inputs unchanged since 2026-11-02T15:50:12+02:00
        cmd   copy 360walkaround/tours/apt846/plan.json Habait/engine/_local/apt846-project/plan/apt846/plan.json
        cmd   "C:\Program Files\nodejs\node.EXE" 360walkaround/pipeline/validate-plan.mjs Habait/engine/_local/apt846-project/plan/apt846/plan.json --json
        cmd   C:\RnD\Projects\Habait\tools\habait-venv\Scripts\python.exe -B Habait/engine/gates/plan_gate.py Habait/engine/_local/apt846-project/plan/apt846/plan.json --intake Habait/studio/fixtures/apt846.intake.json --out Habait/engine/_local/apt846-project/plan/apt846/qa/plan_gate.json
        cmd   C:\RnD\Projects\Habait\tools\habait-venv\Scripts\python.exe -B Habait/engine/gates/plan_gate.py --make-bad Habait/engine/_local/apt846-project/plan/apt846/plan.json --room "<most-walled room>" --dx 10.0 --dy 10.0 --out Habait/engine/_local/apt846-project/plan/apt846/qa/known-bad.plan.json
        cmd   C:\RnD\Projects\Habait\tools\habait-venv\Scripts\python.exe -B Habait/engine/gates/plan_gate.py Habait/engine/_local/apt846-project/plan/apt846/qa/known-bad.plan.json --intake Habait/studio/fixtures/apt846.intake.json --out Habait/engine/_local/apt846-project/plan/apt846/qa/plan_gate.known-bad.json
        gate  validate-plan.mjs exit 0 + plan_gate.py PASS (BLOCKING) + negative control: the most-walled room moved (10, 10) cm must FAIL
        note  source 360walkaround/tours/apt846/plan.json  (project.json units[].files.plan_json (hand-checked))
        cost  $0.00 estimate ($0 stage)
[3/8] building             SKIP   inputs unchanged since 2026-11-02T15:50:27+02:00
        cmd   C:\RnD\Projects\Habait\tools\habait-venv\Scripts\python.exe -B Habait/engine/building.py --project Habait/engine/_local/apt846-project/project.json --out Habait/engine/_local/apt846-project/building
        cmd   "C:\Program Files\nodejs\node.EXE" --input-type=module -e "<validate units.json against units.v0>"
        gate  building.py exit 0 (placement, >= 95 % inside the plate) + units.json valid against units.v0 (BLOCKING)
        cost  $0.00 estimate ($0 stage)
[4/8] scene [apt846]       DEFER  Blender is owned by another session (SESSIONS.md: habait-98); set HABAIT_BLENDER_OK=1 only in the session that owns it
        cmd   copy Habait/engine/_local/apt846-project/plan/apt846/plan.json Habait/engine/_local/apt846-project/scene/apt846/plan.json
        cmd   C:/RnD/Projects/Habait/tools/blender-4.5.10/blender-4.5.10-windows-x64/blender.exe -b --factory-startup -P 360walkaround/pipeline/build_scene.py -- Habait/engine/_local/apt846-project/scene/apt846/plan.json --out Habait/engine/_local/apt846-project/scene/apt846/scene-full.blend --door-style zero-line --skirting off --material-board none
        gate  build_scene.py's own checks (scene-full.report.json checks_failed == 0)
        cost  $0.00 estimate ($0 stage)
[5/8] clay [apt846]        DRYRUN render_tour.mjs --dry-run only (Blender owned by habait-98; HABAIT_BLENDER_OK != 1)
        cmd   "C:\Program Files\nodejs\node.EXE" 360walkaround/pipeline/render_tour.mjs Habait/engine/_local/apt846-project/scene/apt846 --mode draft --blender C:/RnD/Projects/Habait/tools/blender-4.5.10/blender-4.5.10-windows-x64/blender.exe --dry-run
        gate  render_tour.mjs proof: every pano + depth decoded, nadir depth vs camera height (exit 0)
        cost  $0.00 estimate ($0 stage)
[6/8] skin [apt846]        REFUSE REFUSED: HABAIT_ALLOW_SPEND=1 is not set (and HABAIT_CAP_USD=<usd> is required too); estimate $13.20, nothing was called
        cmd   "C:\Program Files\nodejs\node.EXE" Habait/tour360/tools/gen-pano.mjs apt846 cp-entrance gpt25x --cap $HABAIT_CAP_USD
        cmd   "C:\Program Files\nodejs\node.EXE" Habait/tour360/tools/gen-pano.mjs apt846 cp-kitchen gpt25x --cap $HABAIT_CAP_USD
        cmd   "C:\Program Files\nodejs\node.EXE" Habait/tour360/tools/gen-pano.mjs apt846 cp-dining gpt25x --cap $HABAIT_CAP_USD
        cmd   "C:\Program Files\nodejs\node.EXE" Habait/tour360/tools/gen-pano.mjs apt846 cp-living gpt25x --cap $HABAIT_CAP_USD
        cmd   "C:\Program Files\nodejs\node.EXE" Habait/tour360/tools/gen-pano.mjs apt846 cp-terraceLiving gpt25x --cap $HABAIT_CAP_USD
        cmd   "C:\Program Files\nodejs\node.EXE" Habait/tour360/tools/gen-pano.mjs apt846 cp-terraceBedroom gpt25x --cap $HABAIT_CAP_USD
        cmd   "C:\Program Files\nodejs\node.EXE" Habait/tour360/tools/gen-pano.mjs apt846 cp-bedroomMain gpt25x --cap $HABAIT_CAP_USD
        cmd   "C:\Program Files\nodejs\node.EXE" Habait/tour360/tools/gen-pano.mjs apt846 cp-wardrobe gpt25x --cap $HABAIT_CAP_USD
        cmd   "C:\Program Files\nodejs\node.EXE" Habait/tour360/tools/gen-pano.mjs apt846 cp-bathMain gpt25x --cap $HABAIT_CAP_USD
        cmd   "C:\Program Files\nodejs\node.EXE" Habait/tour360/tools/gen-pano.mjs apt846 cp-bedroom2 gpt25x --cap $HABAIT_CAP_USD
        cmd   "C:\Program Files\nodejs\node.EXE" Habait/tour360/tools/gen-pano.mjs apt846 cp-bathguest gpt25x --cap $HABAIT_CAP_USD
        gate  kf_check.py ($0) before any keyframe spend; openings / per-class gates on the skinned panos
        note  11 camera point(s) x $1.20 (GPT Image 2.5 pano)
        cost  $13.20 estimate (PAID stage)
[7/8] video [apt846]       REFUSE REFUSED: HABAIT_ALLOW_SPEND=1 is not set (and HABAIT_CAP_USD=<usd> is required too); estimate $3.20, nothing was called
        cmd   "<no backend: video parked by the 2026-11-02 no-video pivot; Kling 4.0 v2v, one flight>"
        gate  geometry lock vs the clay flight (render-to-real limits, memory.md section 7)
        cost  $3.20 estimate (PAID stage)
[8/8] export [apt846]      RUN    inputs changed: platform_project
        cmd   "C:\Program Files\nodejs\node.EXE" Habait/platform/tools/build_zip.mjs Habait/platform/fixtures/rainbow 846 --out Habait/engine/_local/apt846-project/dist/apt846 --max-mb 25
        gate  structural: 846.zip <= 25 MB + index.html + apartment.json
        note  platform project Habait/platform/fixtures/rainbow (HEURISTIC id prefix (rainbow-tlv -> rainbow))
        cost  $0.00 estimate ($0 stage)
summary   skip 3 · defer 1 · dry-run-only 1 · refuse 2 · run 1 · ledger Habait/engine/_local/apt846-project/ledger.json $0.00
habait-engine run  project=rainbow-tlv  dir=Habait/engine/_local/apt846-project  stages=intake
preflight  validate_project.py --check-files: OK
[1/1] intake [apt846]      SKIP   inputs unchanged since 2026-11-02T15:49:46+02:00
summary   skip 1 · ledger Habait/engine/_local/apt846-project/ledger.json $0.00
qa        qa_report: 4/5 green -> C:\RnD\Projects\Habait\habait-walkaround\Habait\engine\_local\apt846-project\qa.html
habait-engine run  project=rainbow-tlv  dir=Habait/engine/_local/apt846-project  stages=skin
preflight  validate_project.py --check-files: OK
[1/1] skin [apt846]        REFUSE REFUSED: HABAIT_ALLOW_SPEND=1 is not set (and HABAIT_CAP_USD=<usd> is required too); estimate $13.20, nothing was called
        REFUSED: HABAIT_ALLOW_SPEND=1 is not set (and HABAIT_CAP_USD=<usd> is required too); estimate $13.20, nothing was called
        -> refused  exit 3  $0.00  | REFUSED: HABAIT_ALLOW_SPEND=1 is not set (and HABAIT_CAP_USD=<usd> is required too); estimate $13.20, nothing was called
summary   refuse 1 · ledger Habait/engine/_local/apt846-project/ledger.json $0.00
qa        qa_report: 4/5 green -> C:\RnD\Projects\Habait\habait-walkaround\Habait\engine\_local\apt846-project\qa.html
exit=3
```
  (צפוי: ה-dry-run מפרט את כל השלבים ויוצא ב-0; intake יוצא ב-0 ו-plan.json קיים; skin מדפיס "REFUSED: HABAIT_ALLOW_SPEND" ויוצא ב-3. התקבל כך.)
- **כסף:** ‏$0. אין קריאות בתשלום. ה-VLM נקרא מתשובה שמורה ולא דרך `claude -p`. ה-ledger: `Habait/engine/_local/apt846-project/ledger.json`, ‏17 שורות, ‏spent_usd 0.0, אף שורה לא נשארה בסטטוס `started`. Blender לא הורץ.
- **פגמים פתוחים:**
  1. **‏`Habait/engine/README.md` נדרס (אשמתי).**
     - ב-14:50 הקובץ לא היה קיים. כשכתבתי אותו (~15:55), הכלי דיווח "updated", כלומר מישהו יצר אותו בינתיים.
     - בלוק התוצאה של כרטיס 01 מציין README.md בתוך `Habait/engine/intake/`, אבל `intake/README.md` לא קיים. לכן סביר שה-README של ה-intake נכתב ל-`Habait/engine/README.md` ונדרס על ידי.
     - אין לו גיבוי: הוא לא ב-git ולא ב-file-history.
     - מה שכן הצלתי: הוספתי ל-README שלי פרק "ה-intake (כרטיס 01)" עם ה-CLI, מתוך ה-docstring של `intake_raster.py`.
     - **‏ab:** לבקש מהסוכן של כרטיס 01 לכתוב אותו מחדש ל-`Habait/engine/intake/README.md`. ‏`Habait/engine/README.md` שייך לכרטיס 04 ול-31.
  2. **‏render_tour.mjs בונה scene בלי דגלי zero-line.** כשה-scene stale, ה-dry-run מראה שהוא היה בונה בעצמו בלי `--door-style zero-line --skirting off --material-board none`. לכן בריצה אמיתית חייבים להריץ את שלב scene של המנוע **לפני** clay. ה-`--stage scene,clay` עושה את זה לפי הסדר.
  3. **פקודות skin הן תבנית בלבד.** ‏gen-pano.mjs מקבל שמות סצנות של tour360, והמנוע מכניס במקומם את מזהי ה-camera_points (`cp-*`). זה יתוקן כשיחווט backend בתשלום (כרטיס נפרד, עם תקרה ואישור).
  4. **מזהי הפיקסטורות לא תואמים.** ‏`rainbow-tlv/apt846` ב-engine מול `rainbow/846` ב-platform (זה גם פגם 3 של כרטיס 03). ה-export משתמש בהיוריסטיקת prefix, שמודפסת בפלט.
  5. **ל-`plan_gate.py` יש ברירת מחדל קשיחה:** ‏`--intake` = apt846. המנוע תמיד מעביר `--intake` במפורש (ריק כשאין), אבל קריאה ישירה לכלי בפרויקט אחר תיפול על הקובץ של 846.
  6. **הגייטים של building ו-export הם בדיקות מבנה/חוזה, לא gates של נאמנות.** הבקרות השליליות של building רצות רק עם `--selftest-building`, כלומר ה-selftest של כרטיס 03.
  7. **הריצה המלאה מ-PDF עד dist בלי יד אדם** לא הוכחה. חסרים לה Blender (98) ו-backend בתשלום, ומסך A2 עוד לא כתב plan מתוקן ל-846.
- **קורא שני:**
  - **habait-98** (הבעלים של Blender ו-tour360): המנוע מוכן להריץ scene ו-clay על 846 כשהמכונה פנויה, בפקודה `HABAIT_BLENDER_OK=1 $PY Habait/engine/cli.py run Habait/engine/_local/apt846-project --stage scene,clay --clay-res 1024x512 --clay-samples 16`. ברירת המחדל (draft 4096x2048@64) כבדה ל-CPU. הדגל מוצב רק בסשן שמחזיק את Blender. ה-scene נבנה עם zero-line ובלי פנלים, והפלט כולו בתוך תיקיית הפרויקט.
  - **habait-ab:** פגם 1 (ה-README של כרטיס 01 אבד). מסך A2 צריך לכתוב ל-`<project>/plan/<unit>/corrected/plan.json` או ל-`correct/_local/<unit>/plan.json`, ושם המנוע מוצא אותו. מזהי הפיקסטורות (פגם 4). כרטיס 31 מרחיב את `Habait/engine/README.md`.
- **לזיכרון:** כרטיס 04 DONE ($0). `Habait/engine/cli.py run <dir> --stage all|intake|plan|building|scene|clay|skin|video|export [--dry-run]`: כל שלב idempotent לפי hash, ‏ledger לפני ואחרי, gate אחרי, ‏qa.html בסוף. טיוטת intake = FAIL advisory. ‏plan חוסם, עם בקרה שלילית (846: ‏0.784 מול 0.1). ‏skin/video: ‏REFUSED, exit 3 בלי ALLOW_SPEND+CAP. ‏Blender רק עם HABAIT_BLENDER_OK=1. ‏README של intake נדרס.

## תוצאה (המשך: scene+clay של 846, הריץ habait-98, 17:28 שעון המכונה)

- **מי הריץ:** habait-98 (בעל ה-Blender), לפי שורת ההעברה 04→98: `HABAIT_BLENDER_OK=1 $PY Habait/engine/cli.py run Habait/engine/_local/apt846-project --stage scene,clay --clay-res 1024x512 --clay-samples 16` (timeout שעה). **exit 0.**
- **scene:** build_scene exit 0, checks_failed 0, gate PASS, 20.3 ש' → `scene/apt846/scene-full.blend` (855,714 B) + manifest.json.
- **clay:** render_tour exit 0, gate PASS, 699.4 ש', 11/11 נקודות ב-1024×512 @16spp, 0 skipped, verdict PASS; depth check 3/3 בכל נקודה (worst 0.00 ס"מ), no_hole בכולן; valid 100% ברוב החדרים, terraceLiving 88.25%, terraceBedroom 92.57%, bedroomMain 99.41% (שמיים/חוץ); nadir 1.6 מ'. הפנורמות: `scene/apt846/renders/<cp>/{pano.webp,depth.png}` (ה-stage clay מרנדר לתוך תיקיית הסצנה; `clay/apt846/` מכיל רק logs). top view SKIPPED (תכנית general; `render_pano --top-view` קורא קירות rect).
- **ledger:** `_local/apt846-project/ledger.json` run 2, $0.00. **qa.html:** 4/5 ירוק; האדום = שער התכנית על טיוטת ה-intake (advisory, ידוע) + הבקרה השלילית known-bad (חייבת להיכשל); 4b בדק.
- **לוג מלא (683 שורות):** `Habait/engine/_local/apt846-project/card04_scene_clay_by98.log` (הועתק מה-scratchpad של 98). הערה: שורה 116 NOTE על קובץ HDRI נוסף ב-`pipeline/probe/probe-assets/hdri` שמתעלמים ממנו by design.
- **מה זה סוגר:** פגם 7 של הכרטיס ("ריצה מלאה PDF→dist בלי אדם לא הוכחה") מתקדם: intake→plan→building→scene→clay→export רצו, חסר רק skin/video (אין backend בתשלום ב-v0) ותכנית מתוקנת ממסך התיקון.

## תיקונים אחרי M1 (18:55)

_(engine-builder, 2.11, ~18:55–19:10 שעון המכונה. הופעל על ידי habait-1d לפי דוח M1 (`gates/M1-report-he.md`), הריצה הטרייה (`Habait/engine/docs/fresh-run-report.md`) ובלוק התוצאה של 31. דרגה T0, לא הועלתה. $0: בלי Blender, בלי קריאה בתשלום, בלי `claude -p`, בלי git.)_

- **מצב:** 6/6 פריטים תוקנו או אומתו. ה-Check של 04 מתנהג כצפוי (0 / 0 / 3), ה-Check של 10 חזר ל-exit 0, ו-`npm test` של הפלטפורמה ירוק. לפריט 5 לא היה צריך Blender, אבל התיקון יימחק בבנייה הבאה של build_zip (פגם פתוח 1).
- **לוגים מלאים:** `Habait/engine/_local/fix-846/logs-m1fix/` (check04.txt, dry-all.txt, card10-before.txt, card10-after.txt, selftest.txt, npmtest.txt, pg846.json, fix_top.mjs, apartment.json.dist846.before-top-fix).

### 1. אומדן skin: $2.40 לפנורמה (`stages/paid.py`)
- `PANO_USD = 2.40` הוא הקבוע היחיד של המחיר. ההערה שלידו מפנה למקור: `Habait/tour360/tools/gen-pano.mjs`, `MODELS.gpt25x.usd = 2.40`, הסכום שנרשם בכל קריאה ב-ledger של tour360 (memory.md §7). זה לא מחיר ה-$1.20 של keyframe ב-GPT 2.5. מפתח המודל בתבנית הוא קבוע אחד, `SKIN_MODEL_KEY = "gpt25x"`.
- **תוספת:** ה-dry-run קורא את המחיר של `gpt25x` מתוך gen-pano.mjs כטקסט (לא מייבא). אם המחיר שם שונה מ-PANO_USD, מודפסת שורת `PRICE DRIFT`.
- **הוכחה (verbatim):**
```
$ cli.py run Habait/engine/_local/apt846-project --stage skin --dry-run
[1/1] skin [apt846]        REFUSE REFUSED: HABAIT_ALLOW_SPEND=1 is not set (and HABAIT_CAP_USD=<usd> is required too); estimate $26.40, nothing was called
        cmd   "C:\Program Files\nodejs\node.EXE" Habait/tour360/tools/gen-pano.mjs apt846 cp-entrance gpt25x --cap $HABAIT_CAP_USD
        (... 10 more cmd lines, one per camera point ...)
        gate  kf_check.py ($0) before any keyframe spend; openings / per-class gates on the skinned panos
        note  11 camera point(s) x $2.40 (gen-pano.mjs gpt25x = GPT Image 2.5 4096x2048 pano, booked per call)
        cost  $26.40 estimate (PAID stage)
summary   refuse 1 · ledger Habait/engine/_local/apt846-project/ledger.json $0.00
exit=0
$ cli.py run Habait/engine/_local/apt846-project --stage skin
[1/1] skin [apt846]        REFUSE REFUSED: HABAIT_ALLOW_SPEND=1 is not set (and HABAIT_CAP_USD=<usd> is required too); estimate $26.40, nothing was called
        REFUSED: HABAIT_ALLOW_SPEND=1 is not set (and HABAIT_CAP_USD=<usd> is required too); estimate $26.40, nothing was called
        -> refused  exit 3  $0.00  | REFUSED: HABAIT_ALLOW_SPEND=1 is not set (and HABAIT_CAP_USD=<usd> is required too); estimate $26.40, nothing was called
summary   refuse 1 · ledger Habait/engine/_local/apt846-project/ledger.json $0.00
qa        qa_report: 4/5 green -> C:\RnD\Projects\Habait\habait-walkaround\Habait\engine\_local\apt846-project\qa.html
exit=3
$ HABAIT_ALLOW_SPEND=1 HABAIT_CAP_USD=20 cli.py run ... --stage skin --dry-run      (תקרה ש-$13.20 הישן היה עובר)
[1/1] skin [apt846]        REFUSE REFUSED: over the cap: ledger paid $0.00 + estimate $26.40 > HABAIT_CAP_USD $20.00; nothing was called
exit=0
```

### 2. `plan` מעביר את ה-report.json התואם (`stages/plan.py`)
- **הכלל:** פונקציה חדשה, `matching_report(plan)`. היא מחפשת `report.json` ליד התכנית. אם אין, היא לוקחת את ה-`report` מתוך `session.json` שליד התכנית (זה מה שמסך A2, `correct/serve.mjs`, כותב ליד ה-plan.json המתוקן). אחרי זה, ל-A2 ולטיוטה, היא נופלת לטיוטת ה-intake הרסטרית. דוח נבחר רק אם ה-`apartment_id` שלו שווה לזה של התכנית.
- **איפה הכלל חל:** על `--plan`, על שני מסלולי A2 ועל טיוטת ה-intake. **מסלול ה-ground truth** (`units[].files.plan_json`) **לא השתנה**: בלי report, והמפתחות של ה-input hash זהים.
- **הדפסה:** ב-dry-run מודפסת שורת `note  report ...`. בריצה אמיתית מודפסת שורת `plan_gate --report ...` או `plan_gate without a report.json (dims advisory)`.
- **פרויקט scratch:** `Habait/engine/_local/fix-846/` (‏`cli.py init --from _local/apt846-project/project.json`). הטיוטה הווקטורית הופקה לתוכו בפקודה של ה-checklist (`intake_pdf_vector.py`, exit 0). ‏`apt846-project` ו-`fresh-846` לא שונו בפריט הזה.
- **הוכחה (verbatim):**
```
$ plan_gate.py $P/intake-vector/apt846/plan.json --report $P/intake-vector/apt846/report.json      (ישיר)
plan_gate: FAIL  score=0.500  worst_room=r-guest-bathroom  worst_dim_dev=3.3%
exit=1
$ cli.py run $P --stage plan --plan $P/intake-vector/apt846/plan.json      (לפני התיקון: PASS 1.000)
[1/1] plan [apt846]        RUN    inputs changed: report, source, source_kind
        validate-plan.mjs exit 0
        plan_gate --report Habait/engine/_local/fix-846/intake-vector/apt846/report.json (printed dimension lines gate)
        plan_gate: FAIL  score=0.500  worst_room=r-guest-bathroom  worst_dim_dev=3.3%
        negative control (r-entrance moved 10,10 cm): FAIL (as it must)  score=0.122
        -> failed  exit 1  gate FAIL  $0.00  3.1 s  | plan of record from --plan override: plan_gate FAIL (worst room r-guest-bathroom)
exit=1
$ (plan/apt846/corrected/plan.json + session.json בצורה ש-A2 שומר, בלי report.json לידו) cli.py run $P --stage plan
        plan_gate --report Habait/engine/_local/fix-846/intake-vector/apt846/report.json (printed dimension lines gate)
        plan_gate: FAIL  score=0.500  worst_room=r-guest-bathroom  worst_dim_dev=3.3%
        -> failed  exit 1  gate FAIL  $0.00  3.3 s  | plan of record from A2 correction (project): plan_gate FAIL (worst room r-guest-bathroom)
exit=1      (תיקיית corrected/ נמחקה אחרי הריצה)
$ cli.py run $P --stage plan      (ground truth, ללא שינוי)
[1/1] plan [apt846]        RUN    no stamp: never completed here
        validate-plan.mjs exit 0
        plan_gate without a report.json (dims advisory)
        plan_gate: PASS  score=0.784  worst_room=r-bath-guest  worst_dim_dev=41.0%
        negative control (r-living moved 10,10 cm): FAIL (as it must)  score=0.1
        -> ok  exit 0  gate PASS  $0.00  1.3 s  | plan of record from project.json units[].files.plan_json (hand-checked)
exit=0
```
  - בדיקת יחידה של `matching_report`: דוח של `apt846` ליד תכנית `apt999` → None; אותו id → הדוח; בלי דוח → None.

### 3. export תלוי ב-plan וב-building (`stages/export.py`, `cli.py`)
- **התנאי:** `export` רץ, או מדלג, רק כשה-stamp של plan ליחידה וה-stamp של building קיימים **וגם** תואמים לקלטים הנוכחיים של השלבים שלהם, כלומר כשהשלבים האלה היו מדלגים עכשיו.
- **כשהתנאי לא מתקיים:** מודפסת שורת `BLOCKED ... / חסום: ...` עם שורת `need` לכל שלב חסר. נכתבת שורת ledger בסטטוס `blocked`, היציאה היא 2 ושום דבר לא נבנה. `--allow-stale-export` עוקף, ומדפיס את מה שעקף.
- **ב-dry-run:** כש-plan/building נמצאים באותה רשימת שלבים, התנאי מודפס כ-`need` ולא חוסם, כי בריצה האמיתית הם רצים קודם.
- **חיזוק נלווה (חובה כדי שהתנאי יחזיק):** שלבי plan, building ו-export מוחקים את ה-stamp שלהם (`common.invalidate_stamp`) לפני שהם דורסים את הפלט. בלי זה, ריצת `--plan` שנכשלה השאירה את ה-stamp הישן של ה-GT כשה-plan.json כבר מוחלף בטיוטה, וריצת GT הבאה הייתה מדלגת עליו.
- **הוכחה (verbatim):**
```
$ cli.py run $P --stage export      (מיד אחרי ריצת --plan שנכשלה = התרחיש של הריצה הטרייה)
[1/1] export [apt846]      BLOCK  BLOCKED: export needs a passing, current plan and building stamp / חסום: הייצוא דורש חותמת plan ו-building שעברו ועדכניות
        need  plan [apt846]: no stamp (never passed here, or its last run failed)
        hint  run --stage plan,building,export first (or pass --allow-stale-export to export anyway); nothing was built
        -> blocked  exit 2  $0.00  | plan [apt846]: no stamp (never passed here, or its last run failed)
summary   blocked 1 · ledger Habait/engine/_local/fix-846/ledger.json $0.00
exit=2
$ rm $P/building/.stage.json && cli.py run $P --stage export
[1/1] export [apt846]      BLOCK  BLOCKED: export needs a passing, current plan and building stamp / חסום: הייצוא דורש חותמת plan ו-building שעברו ועדכניות
        need  building: no stamp (never passed here, or its last run failed)
        hint  run --stage plan,building,export first (or pass --allow-stale-export to export anyway); nothing was built
        -> blocked  exit 2  $0.00  | building: no stamp (never passed here, or its last run failed)
exit=2
$ cli.py run $P --stage export --dry-run --allow-stale-export
[1/1] export [apt846]      SKIP   inputs unchanged since 2026-11-02T18:41:37+02:00
        need  --allow-stale-export: going on without building: no stamp (never passed here, or its last run failed)
exit=0
$ cli.py run $P --stage plan,building,export
[1/3] plan [apt846]        SKIP   inputs unchanged since 2026-11-02T18:42:16+02:00
[2/3] building             RUN    no stamp: never completed here
        building.py exit 0; units.json: OK against units.v0
        -> ok  exit 0  gate PASS  $0.00  8.9 s  | 1 unit box(es) in units.json
[3/3] export [apt846]      SKIP   inputs unchanged since 2026-11-02T18:41:37+02:00
summary   skip 2 · run 1 · ledger Habait/engine/_local/fix-846/ledger.json $0.00
qa        qa_report: 4/4 green -> C:\RnD\Projects\Habait\habait-walkaround\Habait\engine\_local\fix-846\qa.html
exit=0
```
  - **ה-baseline לפני כל אלה:** `--stage plan,building,export` על הפרויקט הריק הסתיים ב-`run 3`, ‏plan PASS 0.784, ‏zip 4.47 MB, ‏exit 0.
  - **ה-ledger של fix-846:** 11 שורות, $0: ‏ok 5, ‏failed 2, ‏blocked 2, ‏skipped 2. אין שורה בסטטוס `started`.

### 4. הודעת הסירוב של bench (`bench/habait_bench.py`)
- "the habait-4b chat" הוחלף ב-"the board session's chat (habait-1d today; see SESSIONS.md)" בארבעה מקומות: הסירוב, שורת ה-dry-run, ה-help של `--i-approve`, וטקסט ה-approval של ledger חדש.
```
$ habait_bench.py fal-ai/nano-banana-2/edit --tracks keyframe --cap 1
REFUSED (exit 3, nothing sent, ledger untouched): no --i-approve (Eliran's approval for THIS run, given in the board session's chat (habait-1d today; see SESSIONS.md))
exit=3
```

### 5. Check של כרטיס 10 (מיני-מפה)
- **אבחנה: אף קובץ לא stale.**
  - **ה-GLBs:** ה-GLBs של 98 מ-18:42 זהים בבייטים לעותקים של כרטיס 09 ב-`Habait/engine/_local/apt846/dollhouse/` (sha256: parquet `1259daf0b254…` = apt846.glb, concrete `450c9af0ca33…`, marble `d827075886a2…`).
  - **בלוק `top`:** ב-report.json של 98 ובזה של 09 הערכים זהים: `ortho_scale_m 16.5922`, `centre_world_m [7.611, -8.2045]`.
  - **top.png:** לשני ה-top.png יש אותו alpha bbox ‏(175,57,1872,1990) ואותה סטייה של 0.96 px מנוסחת ה-GLB. כלומר, אותה מצלמה.
  - **הגורם:** `export_dollhouse.py` (שורה 835) כותב `round(span, 4)`. ‏build_zip מעדיף את בלוק `top` של report.json (מאז ש-98 שחזר אותו ב-14:42), והטסט דורש שה-manifest יהיה שווה לנוסחת ה-GLB עד 1e-6. ההפרש ב-`s` הוא 1.98e-5 m, כלומר 0.0012 px בקצה התמונה. נכשל רק `manifest top.s`.
- **לא נדרש Blender.** חישבתי מחדש את בלוק `minimap` ב-`Habait/platform/_local/dist/rainbow/846/apartment.json` מגבולות ה-GLB בנוסחה של `render_top` (מרכז, ו-span ×1.06), בלי עיגול. בלוקי crop, img ו-size לא השתנו, והנקודות זזו ב-0.0000 px.
  - הסקריפט: `logs-m1fix/fix_top.mjs`. הגיבוי: `apartment.json.dist846.before-top-fix`.
  - ה-diff: ‏affine, ‏top והתווית `source.top`.
  - ה-zip ‏`846.zip` לא נבנה מחדש, ולכן ה-apartment.json שבתוכו נשאר עם הערך המעוגל (0.0012 px).
- **לא העתקתי את קבצי 98 מ-18:42 לתיקייה של 09, אף שהמתאם הציע.** ההצעה הותנתה ב"אם בלוק ה-top stale", וזה לא המצב:
  - ה-GLBs זהים, כך שהעתקה שלהם לא משנה כלום.
  - בלוק ה-top זהה, כך שגם הוא לא מתקן.
  - ה-top.png של 98 הוא רינדור **השיש**: כל ריצת רצפה דורסת את top.png והאחרונה היא marble. ממוצע RGB של המודל ‏204/205/207, מול 188/173/157 בעותק של 09 שהוא פרקט. העתקה הייתה הופכת את המיני-מפה לשיש, כשרצפת ברירת המחדל היא פרקט.
- **Check 10 (verbatim, השורה מהכרטיס):** לפני התיקון `FAIL frame: top.png camera (GLB bounds, exporter formula) = top.png alpha bbox / manifest top.s`, ‏EXIT=1. אחרי:
```
ok   manifest: minimap block with a point per interior scene  (11 scenes, 564x640 px, top from: GLB bounds + export_dollhouse.py render_top formula, unrounded (= report.json top to 2e-5 m; the report rounds to 4 dp))
ok   frame: top.png camera (GLB bounds, exporter formula) = top.png alpha bbox  (0.96 px off (1 px = 0.81 cm))
(... 22 more ok lines, see logs-m1fix/card10-after.txt ...)
minimap: 3/3 scenes positioned within 20cm (all 11 scenes on 2 phones; worst 0.0 cm)
3d tab (three.js + Draco, not model-viewer) loaded in 152ms (4G) after the tap; cold #3d deep link 1723/1783ms on serve.mjs (no gzip), 1839/1825ms gzip-served

all green; screenshots in C:\Users\elira\AppData\Local\Temp\habait-minimap-shots
EXIT=0
```

### 6. הפיקסטורה של המידות (99→199) ו-plan_gate
- `gates/fixtures/apt846.dims.json`: השינוי היחיד מול `.bak-99` הוא הרשומה של r-bath-guest: ‏`value_cm` 99→199, והתווית שלה (ה-diff מלא כי השתנה סוף השורה). ‏`apt846.intake.json` שורה 30 כבר נושא 199, כך שממצא 3 של 31 נסגר אצל 98.
```
$ plan_gate.py 360walkaround/tours/apt846/plan.json --intake Habait/studio/fixtures/apt846.intake.json --json
exit=0   {'gate': 'plan_gate', 'pass': True, 'score': 0.784, 'worst_room': 'r-bath-guest', 'intake_dims_match': True, 'dims_gating': False, 'dims_source': 'map:Habait\\engine\\gates\\fixtures\\apt846.dims.json', 'intake_note': None}
$ plan_gate.py --selftest 360walkaround/tours/apt846/plan.json --intake Habait/studio/fixtures/apt846.intake.json
plan_gate: PASS  score=0.784  worst_room=r-bath-guest  worst_dim_dev=41.0%
  printed values match intake: True
  (10 MISSED lines: r-dining x2, r-living, r-terrace-living, r-terrace-bedroom x2, r-bedroom-main x2, r-wardrobe x2)
selftest: base PASS 0.784; 10 cm moves caught 34/44; moved-room score drop min 0.000 median 0.462
exit=1      (בתכנון: exit 0 רק כשכל 44 נתפסות; 34/44 = המספר שכרטיס 05 רשם)
$ Check של 05 (השורה המותאמת מבלוק התוצאה של 05, מהעץ הראשי כי ה-worktree הוסר)
plan_gate: PASS  score=0.784  worst_room=r-bath-guest  worst_dim_dev=0.0%
good=0
plan_gate: FAIL  score=0.012  worst_room=r-bedroom-2  worst_dim_dev=0.0%
bad=1
facade_gate: PASS  score=0.889  silhouette=0.889 (866)  slabs=0.967 (2730)  peak_margin=+0.278  camera=approach
good=0
facade_gate: FAIL  score=0.252  silhouette=0.252 (866)  slabs=0.808 (2730)  peak_margin=-0.639  camera=approach
bad=1
```

### רגרסיה מלאה
```
$ cli.py run Habait/engine/_local/apt846-project --stage all --dry-run
[1/8] intake RUN (inputs changed: intake_code) · [2/8] plan RUN (inputs changed: intake_json; report none, GT) · [3/8] building SKIP · [4/8] scene SKIP · [5/8] clay DRYRUN · [6/8] skin REFUSE $26.40 · [7/8] video REFUSE $3.20 · [8/8] export RUN + "need  now plan [apt846]: inputs changed: intake_json / this run's plan/building stage(s) run first"
summary   run 3 · skip 2 · dry-run-only 1 · refuse 2 · ledger Habait/engine/_local/apt846-project/ledger.json $0.00
exit=0
$ Check של 04 (השורה מהכרטיס, בלי שינוי)
summary   run 3 · skip 2 · dry-run-only 1 · refuse 2 · ledger Habait/engine/_local/apt846-project/ledger.json $0.00
[1/1] intake [apt846]      RUN    inputs changed: intake_code
        gate  plan_gate: FAIL  score=0.000  worst_room=r-bedroom  worst_dim_dev=24.4%  (advisory)
        -> ok  exit 0  gate FAIL (advisory)  $0.00  46.6 s  | draft plan.json written; draft gate FAIL (advisory); report: rooms_total 10, rooms_named 8, dims_read 15, dims_total 16, max_dev_pct 105.9
[1/1] skin [apt846]        REFUSE REFUSED: HABAIT_ALLOW_SPEND=1 is not set (and HABAIT_CAP_USD=<usd> is required too); estimate $26.40, nothing was called
        -> refused  exit 3  $0.00  | REFUSED: HABAIT_ALLOW_SPEND=1 is not set (and HABAIT_CAP_USD=<usd> is required too); estimate $26.40, nothing was called
qa        qa_report: 4/5 green -> C:\RnD\Projects\Habait\habait-walkaround\Habait\engine\_local\apt846-project\qa.html
exit=3      (צפוי: dry-run 0, intake 0, skin 3; הלוג המלא ב-logs-m1fix/check04.txt)
$ cd Habait/platform && npm test
... ok   server: events sink mounted (card 24): announced, Origin required, empty batch writes nothing
all green
exit=0
```
- **שינויים ב-apt846-project:**
  - ה-intake רץ מחדש בתוך ה-Check, כי קוד ה-intake השתנה מאז ה-stamp: 15/16 מידות, 46.6 ש'.
  - נוספו שתי שורות refused ב-ledger. ה-ledger כולל 24 שורות, $0, ואף אחת בסטטוס `started`.
  - שלב plan שם מסומן עכשיו "inputs changed: intake_json" בגלל תיקון הפיקסטורה של 98, וירוץ בריצה האמיתית הבאה.

### הכרעות T0
1. **`matching_report`:** הסדר הוא report.json ליד התכנית, אחר כך session.json של A2, אחר כך טיוטת ה-intake. נדרש אותו `apartment_id`. ה-GT בלי report, כמו קודם.
2. **מחיקת stamp לפני דריסת פלט** ב-plan, ב-building וב-export. בשביל זה נגעתי גם ב-`stages/building.py` (שורה אחת), מעבר לקבצים שפורטו, כי התנאי של פריט 3 לא מחזיק בלי זה. ב-scene/clay לא נגעתי: שם השלב שנדחה לא בונה כלום, ומחיקה הייתה מוחקת את ה-stamp של 98 בלי לבנות מחדש.
3. **החסימה של export היא על "עדכני", לא רק על "קיים":** ‏`decide()` חייב להחזיר skip ל-plan ול-building. היא חלה גם כש-export עצמו היה מדלג. exit 2 = ‏`EXIT_USAGE` (תועד ב-docstring של cli.py).
4. **כרטיס 10:** תיקון ה-manifest ולא העתקת הקבצים של 98 (נימוקים בסעיף 5).

### פגמים פתוחים
1. **התיקון של כרטיס 10 שביר.** כל ריצה של `build_zip.mjs` שבונה את `_local/dist/rainbow/846`, ובכללה ריצה חוזרת של M1 ו-`apartment.test.mjs`, תחזיר את הערך המעוגל, ו-Check 10 ייכשל שוב. תיקון קבוע, אחד מאלה:
   - **(א)** `360walkaround/pipeline/export_dollhouse.py:835`: לכתוב את `span`, ‏`cx`, ‏`cy` בלי `round(…, 4)`. הבעלים: כרטיס 09 / 98. ייכנס לתוקף רק בייצוא הבא.
   - **(ב)** `Habait/platform/tools/build_zip.mjs` ~שורה 578: כש-`top` של report תואם לנוסחת ה-GLB עד 1e-3 m, להשתמש בנוסחה הלא-מעוגלת. הבעלים: 1d, בלי Blender. **מומלץ.**
   - **(ג)** `test/minimap.test.mjs:106`: להחליף את 1e-6 ב-1e-3 m (‏0.12 px), בהתאם לדיוק של הדוח.
   - אפשר להחיל שוב את `logs-m1fix/fix_top.mjs` עד שאחד מהם נכנס.
2. **plan_gate משמיט בשקט מידות room_clear שהחדרים שלהן לא קיימים בתכנית.** הרשומה מקבלת `why="room(s) missing"` אבל לא מוצמדת לאף חדר. לכן ה-Check של 05 עם `--report _local/apt846/v1/report.json` על ה-GT בודק 0 מידות: ל-7 מידות ה-room_clear יש ids רסטריים (`r-living-room`, `r-sun-terrace`…) שלא קיימים ב-GT. ה-PASS 0.784 שם הוא רק walls/neighbours.
   - הצעה: מידה שהחדר שלה חסר נספרת כנכשלת, או FAIL מפורש של "report לא תואם לתכנית".
   - לא שיניתי: זו הסמנטיקה של כרטיס 05, והשינוי יהפוך את ה-Check שלו ל-good=1.
3. **מסמכים שעדיין אומרים $13.20:**
   - `Habait/engine/README.md:63,191`
   - `docs/add-a-project-he.md:162,212`
   - `docs/fresh-run-checklist-he.md:113,203`
   - `docs/swap-a-model-he.md:113` (אומר `PANO_USD = 1.20`)
   - בנוסף, `bench/README-he.md:34` אומר "בצ'אט של habait-4b".
   - הסוכן 31-docfix או 1d. לא בקבצים שלי.
4. **`--plan` ותנאי ה-export:** אחרי `--stage plan --plan X`, ריצת `--stage export` בלי `--plan` רואה את plan כ-"inputs changed" ונחסמת. צריך להעביר אותו `--plan`, או `--allow-stale-export`. זה בכוונה, ושורת ה-hint אומרת את זה.
5. **ללא שינוי:** export אורז את הפנורמות של tour360 ולא את ה-clay של הריצה (ממצא 4 של 31).

### קבצים שנכתבו
- `Habait/engine/stages/paid.py`, `stages/plan.py`, `stages/export.py`, `stages/common.py` (`invalidate_stamp`, ‏`Step.requires/requires_stages/blocked_line`), `stages/building.py` (שורה אחת), `cli.py` (`--allow-stale-export`, סטטוס `blocked`, docstring), `bench/habait_bench.py` (4 מחרוזות).
- `Habait/platform/_local/dist/rainbow/846/apartment.json` (בלוק `minimap` בלבד, פריט 5).
- `Habait/engine/_local/fix-846/**` (פרויקט scratch + `logs-m1fix/`).
- **גיבויים של הקבצים לפני העריכה:** בתיקיית ה-scratchpad של הסוכן (זמנית). ה-diff המלא שווה לשינויים שמתוארים כאן.

### כסף
$0. אין קריאה בתשלום, אין `claude -p` (ה-intake קרא את תשובות ה-VLM השמורות) ואין Blender. ה-ledgers: `fix-846/ledger.json` $0, ו-`apt846-project/ledger.json` $0.

### קורא שני
- **habait-ba (=98):**
  - (א) הבנייה הבאה שלו של `_local/dist/rainbow/846`, או פריסה דרך build_zip, תחזיר את Check 10 לאדום עד תיקון (א) או (ב) בפגם 1. (א) הוא בקובץ ש-98 מריץ.
  - (ב) ה-top.png בתיקייה שלו הוא רינדור השיש. אם יעתיק אותו לתיקייה של 09, המיני-מפה תהפוך לשיש.
  - (ג) אומדן skin של 846 הוא עכשיו $26.40 ולא $13.20. זה מחייב כל תקרה שהוא מבקש מאלירן ל-skins דרך המנוע.
- **31-docfix / 1d:** פגם 3, שורות התיעוד.
- **1d:** פגם 2, החלטה על plan_gate.
- **לזיכרון:** תיקוני M1 במנוע (2.11 ~19:00, $0): skin = 11×$2.40 = $26.40 (קבוע PANO_USD, מקור gen-pano gpt25x). plan מעביר report.json תואם (--plan, A2, טיוטה), כך שטיוטה וקטורית מקבלת 0.500 FAIL כמו בקריאה ישירה; ה-GT נשאר 0.784. export נחסם ב-exit 2 בלי stamps עדכניים של plan+building (עקיפה: `--allow-stale-export`). Check 10 ירוק אחרי חישוב top מה-GLB (ה-report מעגל ל-4 ספרות); ייעלם בבנייה הבאה.
