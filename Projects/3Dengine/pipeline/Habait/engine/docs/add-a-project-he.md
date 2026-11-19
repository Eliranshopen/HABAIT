# איך מוסיפים פרויקט למנוע

מהקבצים של היזם עד דף דירה + ZIP: `project.json` → intake (PDF וקטורי קודם, רסטר כ-fallback) → מסך תיקון (A2) → `cli.py run` → פרסום בפלטפורמה. הדוגמה לאורך כל המסמך היא דירה 846; כל פקודה כאן **רצה היום (2026-11-02)**, והזמנים הם מדידות של היום. מה שלא רץ מסומן "לא הורץ עדיין".

**סימונים:** **[אלירן]** = צריך את אלירן (קבצים, החלטה, אישור כסף, תיקון ביד). **[Blender: habait-98]** = רק הסשן שמחזיק את Blender ב-`C:\RnD\Projects\Habait\SESSIONS.md` מריץ. **[Kaggle]** = רץ בחשבון Kaggle `eliranhabait`. **[$]** = עולה כסף: רק עם תקרה כתובה ואישור של אלירן בצ'אט של הסשן שמריץ.

ההקשר המשפטי שבגללו הצינור בנוי כך: צו מכר דירות (טופס של מפרט), 1974 (תיקון 2008), מחייב תכנית דירה ב-1:50 עם מידות כל חדר. לכן המידות המודפסות הן בדיקה אמינה, ו"נאמן לתכנית" = "נאמן לחוזה". "להמחשה בלבד" לא מגן על הבדל מהותי (חוק הגנת הצרכן, סעיפים 2 ו-36). לכן הגאומטריה תמיד מהתכנית, ושערי המידות קיימים.

## 0. סביבה (בכל פתיחה של shell)

```bash
cd C:/RnD/Projects/Habait/habait-walkaround && export PYTHONIOENCODING=utf-8
export HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps
export BLENDER=C:/RnD/Projects/Habait/tools/blender-4.5.10/blender-4.5.10-windows-x64/blender.exe
unset HABAIT_BLENDER_OK HABAIT_ALLOW_SPEND HABAIT_CAP_USD   # לא להשאיר דגלי Blender/כסף מהרצה קודמת
PY=/c/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe
P=Habait/engine/_local/<project>          # תיקיית הפרויקט; לא קיימת לפני שלב 3
```

`PYTHONIOENCODING` (הקונסולה ב-cp1255), `HABAIT_APP_DIR` (`sharp` של export), `BLENDER` (הנתיב שהמנוע מדפיס ומריץ בשלבי scene/clay). שלושת הדגלים המבוטלים מופעלים רק בכוונה, בצעדים 7 ו-8. השעות במסמך הן שעון המכונה כפי שבחותמות הקבצים וב-ledger (‎`+02:00`); `date` של Git Bash יכול להדפיס אזור זמן אחר.

## 1. הקבצים מהפרויקט **[אלירן]**

- תכנית המכר (PDF, 1:50), ואם יש: DXF/DWG/IFC, רנדרים של היזם, מיקום (lat/lon) וצפון.
- תכניות מכר לא מתפרסמות ברשת; הן מגיעות לאלירן באופן פרטי. כל תכנית נרשמת גם במאגר `C:\RnD\Projects\Habait\data\sales-plans\` (`_inbox/`, `index.csv`; ההנחיות ב-`LABELING-GUIDE-he.md`). תכנית היא קלט, אף פעם לא משהו שמייצרים.
- זכויות: `legal.rights_state`, `legal.consent_from_developer`, `legal.publish_allowed` ב-project.json. בלי הסכמת היזם: `publish_allowed: false`, ומיתוג או רפרנסים שיווקיים של היזם לא נכנסים לפריימים (D-WQ-18).

## 2. `project.json`

מעתיקים פיקסטורה וממלאים. `Habait/engine/fixtures/demo-simple.project.json` היא תבנית כללית (3 יחידות מומצאות); `Habait/engine/fixtures/rainbow-846.project.json` היא הפרויקט האמיתי. השדות שהמנוע צורך: `id`; `units[].id`, `number`, `floor`, `plan_scale` (`"1:50"`), `files.plan_pdf` (חובה), `files.plan_json` (רשות: תכנית שנבדקה ביד), `files.intake_json` (רשות: המידות המודפסות שנקראו ביד); `building.floors_total`, `floor_to_floor_cm`, `ceiling_height_cm`, `footprint`; `site.origin`, `site.north_deg`; `legal`. **נתיבים יחסיים הם יחסית לתיקייה של הקובץ.** הסכמה: `Habait/engine/schema/project.schema.json`.

```bash
$PY -B Habait/engine/validate_project.py Habait/engine/fixtures/rainbow-846.project.json Habait/engine/fixtures/demo-simple.project.json --check-files
```

צפוי: `[OK] Habait/engine/fixtures/rainbow-846.project.json`, `[OK] ...demo-simple.project.json` (עם 5 אזהרות `file not found`, כי הקבצים של הדמו מומצאים), exit 0. **זמן:** פחות משנייה. **עלות:** $0.

## 3. יצירת תיקיית הפרויקט

```bash
$PY -B Habait/engine/cli.py init $P --from Habait/engine/fixtures/rainbow-846.project.json
```

צפוי: `init: Habait/engine/_local/<project>  project rainbow-tlv  from Habait/engine/fixtures/rainbow-846.project.json  (1 unit(s))`, exit 0. אם התיקייה כבר קיימת: exit 2 ("exists (use --force to overwrite)"). `init` מתרגם את הנתיבים היחסיים לתיקייה החדשה ויוצר את תיקיות השלבים. **זמן:** פחות משנייה.

## 4. intake: PDF וקטורי קודם

### 4א. קורא וקטורי (כרטיס 06)

```bash
$PY -I Habait/engine/intake/intake_pdf_vector.py "דירה 846- 16.pdf" --out $P/intake-vector/apt846 --apartment-id apt846 \
    --known-dims Habait/studio/fixtures/apt846.intake.json --ground-truth 360walkaround/tours/apt846/plan.json \
    --tour-crop-box-px "[1750,380,5500,4280]"
```

- צפוי ב-846: השורה הראשונה `6667 primitives after clipping (8636 drawings, 46 OCG layers, 0 text spans)`, אחר כך `rooms: 10 (10 named, 0 unnamed), 6 virtual zone cuts` ו-`fitted **2.2681 px/cm**`; exit 0. פלט: `plan.json`, `report.json`, `report.md`, `plan-crop.png`, `overlay.png`.
- בפרויקט אחר: `--known-dims` ו-`--ground-truth` הם רשות (בלעדיהם אין השוואה ל-GT); `--tour-crop-box-px` שייך רק ל-846. שכבות CAD של משרד אדריכלים אחר = קובץ חדש `Habait/engine/intake/layer_maps/<office>.json` (`--layer-map`, לא הורץ עדיין על משרד שני).
- **זמן:** 11 ש' היום (כרטיס 06 מדד ~25 ש'). **עלות:** $0, בלי VLM ובלי רשת.
- **איך יודעים שהגיליון לא וקטורי:** בשורה הראשונה אין drawings או אין שכבות OCG. אז עוברים ל-4ג.

### 4ב. בדיקת הטיוטה ($0)

```bash
node 360walkaround/pipeline/validate-plan.mjs $P/intake-vector/apt846/plan.json; echo "exit=$?"
$PY -B Habait/engine/gates/plan_gate.py $P/intake-vector/apt846/plan.json --report $P/intake-vector/apt846/report.json \
    --intake Habait/studio/fixtures/apt846.intake.json --out $P/intake-vector/apt846/plan_gate.json; echo "exit=$?"
```

צפוי ב-846: validate exit 0 (שורה אחרונה `note rooms 10 (indoor clear floor 91.75 m2, outdoor 24.16 m2) · walls 9 pieces · openings 14 · panes 8 · cameras 10`); plan_gate `FAIL  score=0.500  worst_room=r-guest-bathroom`, **exit 1**: האמבטיה הכללית 199 נמדדת 205.5 (‎+3.3%) בחוט של השער שעובר בשקע הדלת. זה צפוי: זו טיוטה, והיא הולכת למסך התיקון. 9/10 חדרים עוברים.

### 4ג. fallback רסטרי דרך ה-CLI (גיליון סרוק)

שלב `intake` של ה-CLI מריץ את `intake_raster.py` (כרטיס 01): rasterize → crop → VLM (Opus דרך `claude -p`, מנוי) → trace → כיול. בלי תשובות שמורות הוא קורא ל-`claude -p --model opus` פעמיים (60–100 ש' כל קריאה; $0 כסף, אבל צורך ממכסת 5 השעות של המנוי). תשובות שמורות הופכות את הריצה לדטרמיניסטית ($0, בלי קריאה):

```bash
cp Habait/engine/_local/apt846-project/intake/apt846.vlm-reply.txt Habait/engine/_local/apt846-project/intake/apt846.assign-reply.txt $P/intake/
timeout 900 $PY -B Habait/engine/cli.py run $P --stage intake --quiet
```

צפוי: `-> ok  exit 0  gate FAIL (advisory)  $0.00  <N> s  | draft plan.json written; draft gate FAIL (advisory); report: rooms_total <a>, rooms_named <b>, dims_read <c>, dims_total <d>, max_dev_pct <e>`; exit 0. **המספרים יכולים להשתנות; מה שקובע הוא exit 0, `-> ok`, וחמשת השדות בדוח.** ב-846 היום: `rooms_total 10, rooms_named 8, dims_total 16, max_dev_pct 105.9`, ו-`dims_read` ‏14 מול הפיקסטורה הישנה (99) או 15 אחרי התיקון ל-199 (18:23), כי הוא נספר מול `--known-dims`. ה-FAIL הוא advisory ולא עוצר. **זמן:** 60–146 ש' היום עם תשובות שמורות (94–117 ש' בכרטיס 04). דרך ה-CLI רץ היום רק עם תשובות שמורות; ה-VLM החי רץ היום ישירות ב-`intake_raster.py` (כרטיס 01, 14/16 מידות).

### 4ד. DXF / IFC (כשיש קובץ CAD)

```bash
$PY -I Habait/engine/intake/intake_dwg.py Habait/engine/intake/fixtures/sample.dxf --out <dir>      # 5 ש', total_edits: 0
$PY -I Habait/engine/intake/intake_ifc.py Habait/engine/intake/fixtures/sample.ifc --out <dir>/ifc  # 12 ש'
```

רצו היום על הדגימות הסינתטיות בלבד (exit 0, 11/11 חדרים, 37/37 קירות). DWG צריך ODA File Converter, שלא מותקן: **לא הורץ עדיין**. layer map: `<stem>.layers.json` ליד הקובץ.

## 5. מסך התיקון (A2) **[אלירן]**

אדם (היום: אלירן) מתקן את הטיוטה בלחיצות, בלי מקלדת ובלי CAD: גרירת פינות עם הצמדה לקירות, שם חדר מרשימה, הוספה/מחיקה של דלת או חלון, ואז "אשר ושמור". השרת מריץ `validate-plan.mjs` ושומר `plan.json` רק אם הבדיקה עוברת.

```bash
node Habait/engine/correct/serve.mjs --plan $P/intake-vector/apt846/plan.json --out $P/plan/apt846/corrected
# פותחים http://127.0.0.1:8870/  →  1 מה לבדוק  →  2 תיקון  →  3 "אשר ושמור"
```

- צפוי בהפעלה: `תיקון תכנית: http://127.0.0.1:8870/` ואחריה שורות `plan`, `report`, `image`, `out`. המסך מוצא לבד את `report.json` ואת `plan-crop.png` ליד התכנית.
- מה נשמר ב-`--out`: `plan.json` (רק כשהבדיקה עוברת; אחרת `plan.draft.json` עם הסבר בעברית), `corrections.json` (תמיד), `session.json` (כולל `elapsed_s` = זמן העבודה). **`corrections.json` הוא נתוני אימון ל-intake: לא מוחקים אותו.**
- `--out $P/plan/<unit>/corrected` הוא הנתיב שהמנוע מחפש בשלב `plan` (מקור מספר 2). בלי `--out` המסך שומר ל-`Habait/engine/correct/_local/<unit>/`, שגם אותו המנוע מוצא (מקור 3).
- בדיקת החוזה ב-$0, בלי אדם:

  ```bash
  timeout 60 node Habait/engine/correct/serve.mjs --plan $P/intake-vector/apt846/plan.json --selftest
  ```

  צפוי: 16 שורות `ok` ו-`selftest OK`, exit 0, שנייה אחת. ה-selftest כותב לתיקייה זמנית ולא נוגע בקלט.
- **זמן:** לא נמדד בדקות. על תכנית 3 השגיאות (`correct/fixtures/apt846-3errors.plan.json`) התיקון לקח 14 הקשות וגרירה אחת (כרטיס 02). מבחן 20 הדקות של אלירן: שאלת T1 פתוחה של כרטיס 02. **עלות:** $0.
- היום השרת הופעל על הטיוטה הווקטורית של 846 והגיש את הדף (`GET /` 200, `dir="rtl"`) בלי שמירה: **שמירה אמיתית של תיקון ל-846 לא הורצה עדיין.** `--port` אחר (כש-8870 תפוס): לא הורץ עדיין.

## 6. `cli.py run`: plan ו-building

לפני ריצה אמיתית, בודקים מה ירוץ ומאיזה מקור תבוא תכנית הרשומה:

```bash
timeout 600 $PY -B Habait/engine/cli.py run $P --stage all --dry-run
```

צפוי בפרויקט חדש של 846 (אחרי 4ג): intake `SKIP` או `RUN`, plan `RUN`, building `RUN`, scene `DEFER`, clay `DRYRUN`, skin `REFUSE`, video `REFUSE`, export `RUN`; exit 0. שורת `note  source ...` מתחת ל-plan אומרת מאיפה תבוא התכנית.

```bash
timeout 900 $PY -B Habait/engine/cli.py run $P --stage plan,building --keep-going --quiet
```

- צפוי ב-846 (המצב מ-18:29:16): `plan_gate: PASS  score=0.784`, `negative control (r-living moved 10,10 cm): FAIL (as it must)  score=0.1`, `-> ok  exit 0  gate PASS  $0.00  <N> s  | plan of record from project.json units[].files.plan_json (hand-checked)`; ואחריו `building.py exit 0; units.json: OK against units.v0`, `-> ok  exit 0  gate PASS  $0.00  <N> s`. exit 0.
- **מצב שהיה עד 18:29 (וההרצה הטרייה הראשונה נתקלה בו):** `plan_gate: FAIL  score=0.784`, `-> failed  exit 1`, ובלוג `plan/<unit>/logs/plan_gate.log` השורה `printed values match intake: False`. הסיבה: `plan_gate.py` משווה את המידות המודפסות במפה שנקראה ביד, `Habait/engine/gates/fixtures/apt846.dims.json`, מול `printed_dimensions_cm` של `Habait/studio/fixtures/apt846.intake.json`. ה-intake תוקן מ-99 ל-199 ב-18:23 והמפה ב-18:29; בין שני התיקונים השער נכשל אף שכל החדרים עברו. התכנית `360walkaround/tours/apt846/plan.json` לא אומרת 99 ולא השתנתה. **לקח:** כשמתקנים מידה מודפסת, מתקנים גם את מפת השער של אותה דירה (`gates/fixtures/<unit>.dims.json`, אם יש).
- **`--keep-going`:** בלעדיו, כש-plan נכשל, building לא רץ (`not run: an earlier step failed (use --keep-going)`) ו-exit 1. איתו building רץ בכל מקרה, וה-exit נשאר 1 אם plan נכשל.
- **מה עושים כש-plan נכשל:**
  1. מריצים שוב עם `--keep-going` (כמו למעלה), כדי לראות גם את שאר השלבים.
  2. קוראים את דוח השער `$P/plan/<unit>/qa/plan_gate.json` (שדות `pass`, `intake_note`, ולכל חדר `rooms[].pass`, `dims`, `walls`) ואת `report.json` של ה-intake (מודפס מול נמדד לכל חדר):

     ```bash
     $PY -c "import json,sys;g=json.load(open(sys.argv[1],encoding='utf-8'));print('pass',g['pass'],'| intake_note',g.get('intake_note','-')[:90]);print('BAD rooms:',[r['id'] for r in g['rooms'] if not r['pass']])" $P/plan/apt846/qa/plan_gate.json
     ```

     (רץ היום: במצב הנוכחי `pass True | intake_note -`, `BAD rooms: []`; במצב של עד 18:29 `pass False | intake_note map [99, 140, 160, ...] != in...`, `BAD rooms: []`.)
  3. **`BAD rooms: []` + `intake_note`:** התכנית בסדר והפער בין קובצי העזר (מפת השער מול הפיקסטורה). מתקנים את קובץ העזר (בעליו) ומריצים שוב; לא נוגעים בתכנית.
  4. **חדר ב-`BAD rooms`:** התכנית שגויה בחדר הזה. פותחים את מסך התיקון A2 (צעד 5) על הטיוטה, עם `--out $P/plan/<unit>/corrected`, ואדם (אלירן) מתקן ומאשר. אחר כך `--stage plan,building` שוב: שלב plan לוקח את התכנית המתוקנת לבד. סוכן שרץ בלי אדם לא מפעיל את השרת האינטראקטיבי (הוא לא מסתיים); הוא רושם "צריך A2 על <החדר>".
- **מקור התכנית:** הראשון שקיים מבין `--plan` → `plan/<unit>/corrected/plan.json` (פלט A2) → `Habait/engine/correct/_local/<unit>/plan.json` → `units[].files.plan_json` → טיוטת ה-intake. ב-846 היום אין פלט A2, ולכן נבחרת התכנית שנבדקה ביד (`360walkaround/tours/apt846/plan.json`). ריצה עם תכנית מתוקנת מ-A2 כמקור: **לא הורץ עדיין.**
- **אזהרה:** `--plan <טיוטה>` עוקף את A2, ושלב `plan` לא מעביר את `report.json` ל-plan_gate. הטיוטה הווקטורית של 846 עוברת שם ב-1.000 בלי בדיקת מידות, אף ש-4ב נתן FAIL 0.500. לא מעבירים טיוטה בלי A2.
- **בדיקה ש-plan ו-building באמת עברו** (stamp נכתב רק כשהשלב הסתיים `ok`): `for s in plan/apt846 building; do test -s $P/$s/.stage.json && echo "STAMP-OK $s" || echo "NO-STAMP $s"; done`.
- **זמן:** plan 1.5–7 ש', building 14–55 ש' (תלוי בעומס). **עלות:** $0.

## 7. scene + clay **[Blender: habait-98]**

```bash
HABAIT_BLENDER_OK=1 $PY Habait/engine/cli.py run $P --stage scene,clay --clay-res 1024x512 --clay-samples 16   # בעל ה-Blender בלבד
```

- רץ היום על 846 אצל habait-98 (17:15–17:27): exit 0, scene 20.3 ש' (`scene-full.blend`, checks_failed 0), clay 699.4 ש' (11/11 נקודות, depth 3/3 בכל נקודה), $0. הסצנה נבנית במראה zero-line (בלי משקופים, בלי פנלים).
- **סשן שלא מחזיק את Blender:** מריץ את אותה פקודה **בלי** `HABAIT_BLENDER_OK=1`. אז scene רק מכין את `plan.json` ומדפיס את הפקודה (`DEFER`), ו-clay מריץ `render_tour.mjs --dry-run` (`DRYRUN`); exit 0, שנייה אחת, בלי stamp. סשן מבקש את הריצה האמיתית מבעל ה-Blender (`SendMessage`). **סוכן שרץ לבד** (בלי סשן, כמו ההרצה הטרייה) לא פונה לאף אחד: ממשיך עם הפנורמות של 846 שכבר בדיסק, `Habait/engine/_local/apt846-project/scene/apt846/renders/<cp>/pano.webp` (11, verdict PASS), ורושם זאת. השורה `(SESSIONS.md: habait-98)` בפלט אומרת לו רק ש-Blender לא שלו.
- clay של פנורמות דירה ב-Kaggle: **לא הורץ עדיין** (Kaggle רנדר היום רק את טיסת החוץ, כרטיס 18).

## 8. skin + video **[$] [אלירן]**

```bash
$PY -B Habait/engine/cli.py run $P --stage skin --quiet; echo "exit=$?"
```

צפוי: `REFUSED: HABAIT_ALLOW_SPEND=1 is not set (and HABAIT_CAP_USD=<usd> is required too); estimate $26.40, nothing was called`, exit 3. גם עם `HABAIT_ALLOW_SPEND=1` ותקרה, v0 עוצר ב-exit 4 (`NOT WIRED`) בלי לקרוא לשום מודל. היום ה-skins נעשים מחוץ למנוע, ב-tour360 של habait-98 (`gen-pano.mjs`, `skin-frame.mjs`, GPT Image 2.5, בתשלום ובאישור). לפני כל הוצאה על keyframe מריצים `C:\RnD\Projects\Habait\tools\bench\kf_check.py` ($0). video: אין וידאו במוצר (פיבוט 2.11).

## 9. export: dist

```bash
timeout 600 $PY -B Habait/engine/cli.py run $P --stage export --quiet
ls $P/dist/apt846
```

- צפוי: `-> ok  exit 0  gate PASS  $0.00  6.4 s  | build_zip exit 0, zip 4.47 MB`, exit 0; בתיקייה: `846.zip  apartment.json  assets  index.html  logs  media`.
- מה בפנים: דף דירה עצמאי (5 לשוניות), 11 פנורמות, 11 סטילס, תכנית, GLB בית-בובות + `dollhouse.html` שנפתח offline, README עם הכיתוב המשפטי המלא (עברית + אנגלית). ה-ZIP חייב להיות ≤ 25 MB.
- **שימו לב:** export אורז את הפנורמות המולבשות של הסיור הקיים (`Habait/tour360/apartments/apt<unit>/panos/balanced`) ואת הפיקסטורה של הפלטפורמה (`Habait/platform/fixtures/rainbow`, נמצאת בהיוריסטיקת prefix `rainbow-tlv` → `rainbow`), לא את ה-clay, התכנית או ה-units.json של הריצה הזו.
- **export לא תלוי ב-plan או ב-building:** הוא עובר גם כשהם נכשלו, ולכן dist שנוצר לא מוכיח שהם עברו. את זה בודקים בשורות ה-stamp של צעד 6.
- **זמן:** 6.4–7.9 ש'. **עלות:** $0.

## 10. פרסום בפלטפורמה

| צעד | פקודה (רצה היום) | מי | מצב |
|---|---|---|---|
| תיקיית פלטפורמה לפרויקט | `Habait/platform/fixtures/<p>/` עם `project.json`, `units.json`, `flow.json`, ושורה ב-`Habait/platform/projects.json` | habait-1d (בעל הפלטפורמה) | יש רק `rainbow`; **לפרויקט שני לא הורץ עדיין** |
| בדיקת החוזים | `cd Habait/platform && node contracts/validate.mjs fixtures/rainbow` | כל סשן ($0, קריאה בלבד) | `fixtures/rainbow: OK - 12 units, 5 segments, 11 warning(s)`, exit 0 |
| הדף שהפלטפורמה החיה קוראת | `cd Habait/platform && node tools/build_zip.mjs fixtures/rainbow 846 --out _local/dist/rainbow/846` | habait-1d (כותב ל-`platform/_local`) | `zip: 27 files, 4.47 MB (<=25)`, 5.3 ש' (נבדק היום ל-`--out` זמני) |
| שרת מקומי :8850 | `cd Habait/platform && nohup node serve.mjs > _local_serve.log 2>&1 &` | habait-1d | רץ; `landing.html`, `apartment.html`, `flow.html` מחזירים 200 |
| דף נחיתה A/B | `http://127.0.0.1:8850/landing.html?project=rainbow&v=a` (או `v=b`, `&src=<campaign>`) | כל סשן (צפייה) | 200 |
| דף הדירה | `http://127.0.0.1:8850/apartment.html?project=rainbow&unit=846` | כל סשן (צפייה) | 200 |
| בדיקת הדף | `cd Habait/platform && timeout 300 node test/landing.test.mjs` | habait-1d (כותב ל-`platform/_local/landing-test`) | 35/35 בכרטיס 25; לא הורץ מחדש בכרטיס 31 |
| פריסה ציבורית (Vercel `habait-flow`) | `C:\RnD\Projects\Habait\tools\deploy-vercel\README.md` (`stage_flow.py`) | **habait-98 בלבד** | הדף והסטילס של 846 עוד לא נפרסו |

לפני פרסום מחוץ לחברה **[אלירן]**: `legal.publish_allowed` חייב להיות true (הסכמת היזם), והכיתוב המשפטי (`C:\RnD\Projects\Habait\data\sales-plans\legal\disclaimer-he-en.md`) הוא טיוטה עד חוות דעת של עורך דין. פסק הדין מ-2017 על מעקות זכוכית (בית משפט השלום בתל אביב) מצוטט היום רק חלקית: לאמת ב-Nevo לפני שמישהו נשען עליו.

## 11. מצב, ledger ו-qa.html

```bash
$PY -B Habait/engine/cli.py status $P
```

צפוי: `ledger ...  project rainbow-tlv  spent $0.00  entries N`, שורה לכל ניסיון, ו-`stamp` לכל שלב שהסתיים. `qa.html` בתיקיית הפרויקט מציג את כל השערים בעברית: ב-`apt846-project` ‏4/5 ירוק (האדום = טיוטת ה-intake הרסטרית, advisory); בפרויקט שבו גם 4ב כתב את השער של הטיוטה הווקטורית לתוך התיקייה, 4/6 (שני האדומים = שתי הטיוטות). ריצה חוזרת של אותם שלבים מדלגת על כל מה שלא השתנה (`skip 4 · defer 1 · dry-run-only 1`, שנייה אחת).

## סיכום: זמן, עלות, מי

| צעד | זמן מדוד | עלות | מי |
|---|---|---|---|
| 1 קבצים + זכויות | לא נמדד | $0 | **[אלירן]** |
| 2 project.json + validate | ידני + פחות משנייה | $0 | כל סשן |
| 3 init | פחות משנייה | $0 | כל סשן |
| 4א intake וקטורי | 11–25 ש' | $0 | כל סשן |
| 4ג intake רסטר | 60–146 ש' (תשובות שמורות); עוד 2 × 60–100 ש' עם VLM חי | $0 (מנוי) | כל סשן |
| 5 מסך תיקון | לא נמדד בדקות | $0 | **[אלירן]** |
| 6 plan + building | 16–62 ש' | $0 | כל סשן |
| 7 scene + clay | 20 ש' + 699 ש' | $0 | **[Blender: habait-98]** |
| 8 skin / video | לא מחווט | אומדן $26.40 / $3.20 | **[$] [אלירן]** |
| 9 export | 6–8 ש' | $0 | כל סשן |
| 10 פרסום | 5 ש' (build_zip) | $0 | habait-1d; Vercel = **habait-98**; הסכמה = **[אלירן]** |

בלי הצעדים של אלירן ושל Blender, כל המכונה רצה ב-~2 דקות ו-$0. רשימת הפקודות המדויקת להרצה טרייה של 846: [`fresh-run-checklist-he.md`](fresh-run-checklist-he.md).
