# משימה 01: A1: intake רסטר v1 על 846 (VLM frontier + tracer + כיול מידות)

| שדה | ערך |
|---|---|
| **לוח** | `habait-workplan-2026-11-02` |
| **ערוץ** | A |
| **מקור בתכנית** | חלק ג §2 ערוץ A, שלב A1; חלק א §11.1 ב-`C:\RnD\Projects\Habait\research\product-research-2026-11-02\HABAIT-RESEARCH-2026-11-02.md` |
| **סוכן** | `engine-builder` (`status: live`, `owner-track: habait`, `model: opus`) |
| **Ruling tier** | **T0** |
| **גל (wave)** | 1 |
| **מצב** | TODO |
| **זיכרון** | `memory/agents/` לא קיים בפרויקט הזה; הזיכרון של הסוכן הוא בלוק `## תוצאה` כאן (ראו rails). הסוכן הוא יכולת קבועה (לא one-off persona). |

## מטרה

לסגור את צינור ה-intake לרסטר מקצה לקצה על `דירה 846- 16.pdf`: crop אוטומטי של הדירה → VLM frontier (שמות חדרים, מידות מודפסות, טבלת שטחים, הערות) → tracer CV (קירות / זיגוג / דלתות) → כיול px/cm מהמידות המודפסות → `plan.json` תקין + דוח התאמה לכל חדר (נמדד מול מודפס). זה השלב שמכריע אם ה-intake של S1 אפשרי בלי יד אדם חוץ ממסך התיקון.

## תלויות

- W1-A0/A1 של habait-ab (שלד ה-intake: `engine/intake/{rasterize,vlm,tracer_cv}.py`)

## קלטים (קריאה)

- `C:/RnD/Projects/Habait/habait-walkaround/דירה 846- 16.pdf` (PDF רסטרי, 4 תמונות)
- אמת מידה: `360walkaround/tours/apt846/plan.json` (11 חדרים, 13 פתחים, 37 קירות) ו-`Habait/studio/fixtures/apt846.intake.json` (16 מידות מודפסות)
- מה שכבר נוסה: `Habait/engine/_local/apt846/vlm-run1`, `trace/` (ריצה של habait-ab, 11:38–11:45)
- `Habait/studio/tools/prep_pdf.py` (אריחי עמוד ב-300dpi; Opus קרא 16/16 כך)
- `360walkaround/pipeline/SCHEMA.md` + `validate-plan.mjs`

## קבצים (הסוכן כותב רק כאן)

- `Habait/engine/intake/intake_raster.py` (חדש: הפקודה האחת)
- `Habait/engine/intake/calibrate.py` (חדש: px/cm מהמידות, בדיקת חדר-חדר)
- `Habait/engine/intake/report.py` (חדש: דוח התאמה JSON + Markdown)
- `Habait/engine/_local/apt846/v1/**` (פלטים)
- אין נגיעה ב-`Habait/studio/**`, `360walkaround/pipeline/**`, `C:\RnD\Projects\Habait\tools\bench\**`

## צעדים

1. לקרוא את מה ש-habait-ab כבר כתב ב-`engine/intake/` ולהריץ אותו כמו שהוא; לרשום מה עובד ומה לא (לא לשכתב).
2. לחבר את שלושת השלבים לפקודה אחת `intake_raster.py <pdf> --out <dir> [--truth plan.json]`, idempotent (מדלגת על פלט קיים).
3. כיול: המידות המודפסות שה-VLM קרא מותאמות לקירות שה-tracer מצא → px/cm; כל חדר נבדק רוחב/עומק נמדד מול מודפס; שטח פנים + קירות ≈ שטח במפרט.
4. להוציא `plan.json` בס"מ (origin NW חיצוני, +y למטה) ולהעביר אותו ב-`validate-plan.mjs`.
5. דוח: `report.json` + `report.md` (בעברית): לכל חדר שם/סוג/מידות נמדד-מודפס-סטייה, רשימת פתחים, ומה "לא מתאים" (עולה למסך התיקון A2).
6. אם מידות או חדרים חסרים: לנסות אריחים (prep_pdf) לפני שמוותרים; לתעד כל ניסיון.

## קריטריוני קבלה

- [ ] על 846: 16/16 מידות מודפסות נכונות, 11/11 חדרים בשם ובסוג, סטיית מידה מקסימלית ≤ 3% בכל חדר שיש לו מידה מודפסת.
- [ ] `plan.json` עובר `validate-plan.mjs` ב-exit 0.
- [ ] ריצה חוזרת על אותו PDF לא קוראת שוב ל-VLM (cache לפי hash).
- [ ] edit-cost (מספר התיקונים שהיו נדרשים מול אמת המידה) מדווח במספר אחד בדוח.
- [ ] הדוח בעברית, קריא לאלירן, ללא CAD.

## Gate

**Check:**
```bash
cd C:/RnD/Projects/Habait/habait-walkaround && export PYTHONIOENCODING=utf-8 && PY=/c/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe && timeout 1200 $PY Habait/engine/intake/intake_raster.py "דירה 846- 16.pdf" --out Habait/engine/_local/apt846/v1 --truth 360walkaround/tours/apt846/plan.json && node 360walkaround/pipeline/validate-plan.mjs Habait/engine/_local/apt846/v1/plan.json
# צפוי: שורת הסיכום בדוח: dims 16/16, rooms 11/11, max_dev <= 3.0%; שני הפקודות exit 0
```

**Reviewer scope:** נכונות בלבד: המספרים בדוח מחושבים מהקבצים ולא מוצהרים; הכיול לא "מתאים" את התוצאה לאמת המידה.

הבודק (אם נדרש) הוא `qa-reviewer` בהקשר נקי, לא הסשן שביצע.

## כסף

$0 דרך המנוי (`claude -p --model opus`). אם נדרש VLM בתשלום: תקרה $2, ledger `Habait/engine/_local/ledger.json`, אישור אלירן בצ'אט המפעיל.

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

_(נכתב על ידי habait-ab, 2026-11-02 15:05; הודבק על ידי habait-4b 16:40)_

- **מצב:** PARTIAL (הצינור רץ מקצה לקצה; קריטריוני 16/16 ו-≤3% לא הושגו: 14/16 מידות, קומה שגויה, קירות 10/37, פתחים 1/13; edit-cost 30 מול 39 מאפס = עדיין לא חוסך זמן)
- **מה נעשה:** intake v1 ב-`Habait/engine/intake/` (intake_raster.py, rasterize.py, vlm.py + vlm_prompt.md + assign_prompt.md, tracer_cv.py, README.md); פלט `_local/apt846/v1/{plan.json, report.json, report.md, plan-crop.png}`. VLM = Opus דרך `claude -p` (60–100 ש' לקריאה): 14/16 מידות מודפסות (פספס 99, 275), קומה 18 במקום 16, טבלת היחידה נכונה (106.72, 3 חדרים, L); חדרים 11/11 לפי שם, 8/11 מתוחקרים ומשויכים (ארון ואמבט הורים לא תוחקרו, אמבט אורחים מפוצל); סקייל מותאם 2.2494 px/cm (GT 2.25); חדר שינה 342.4×273.6 מול 342×275; קירות 10 רכיבים מול 37 (14.6 מ"ר מול 11.75); פתחים 9 (1/13 זוגות GT); שטח פנים+קירות 112 מול 106.72 (+4.9%), מרפסת 15.1 מול 26.16 (דליפה בקצה הדרומי). סבילות 3%, 4% לחדרים < 5 מ"ר. `report.raster.cm_to_px = [2.249,0,0,0,2.249,0]`; `report.frames`: engine_px = 2.25·gt_cm + (−167, +297). `dimensions[]`: 11/16 ממוקמים, 5 ב-`dimensions_unplaced`. סכמה: `building.roof_top_cm` (אופציונלי) נוסף. `stack_units.py` → `_local/rainbow/units.json` 12 דירות עם box_world (apt846 אמיתי; 11 stacked-approx: L 0, K −9, M +9, PH −18 מ' לאורך החזית, 23.8° מ-plan-up).
- **פלט ה-Check:** `validate-plan.mjs` CLEAN (6 אזהרות); `correct/serve.mjs --selftest` OK 16/16; `gates/plan_gate.py` FAIL 0.000 (צפוי: VLM קרא 280 במקום 225).
- **כסף:** $0 (המנוי).
- **פגמים פתוחים:** מיקומי תוויות VLM לא שמישים (צריך גלאי טקסט עברי); קווי מתאר fixtures מפצלים חדרים; דליפת מרפסת; רוחבי דלתות; `fixtures[]` ריק; VLM טועה בספרות קטנות ובקומה. **ה-PDF וקטורי (8.5k paths) → כרטיס 06 יעקוף את רוב ה-CV.**
- **קורא שני:** habait-4b (בעל הלוח, כרטיסים 02/04/05/06): הפורמט והכיול לשימוש חוזר.
- **לזיכרון:** intake v1 = VLM לסמנטיקה + tracer_cv לגאומטריה + כיול px/cm ממידות מודפסות; על 846 עדיין לא חוסך זמן מול הקלדה (30 תיקונים מול 39); הקפיצה הבאה היא קורא וקטורי (06).

---
_תבנית מקורית:_
- **מצב (תבנית):** DONE / BLOCKED / PARTIAL
- **מה נעשה:**
- **קבצים שנכתבו:**
- **פלט ה-Check (מילה במילה):**
```
```
- **כסף:** $0 / סכום + נתיב ה-ledger
- **פגמים פתוחים / שאלה לאלירן (אם T1/T2):**
- **קורא שני:** אין / <סשן>: <למה זה מחייב אותו>
- **לזיכרון:** <עד 400 תווים>
