# משימה 02: A2: מסך תיקון intake (HTML מקומי, בעברית, בלי CAD)

| שדה | ערך |
|---|---|
| **לוח** | `habait-workplan-2026-11-02` |
| **ערוץ** | A |
| **מקור בתכנית** | חלק ג §2 ערוץ A, שלב A2 ב-`C:\RnD\Projects\Habait\research\product-research-2026-11-02\HABAIT-RESEARCH-2026-11-02.md` |
| **סוכן** | `platform-dev` (`status: live`, `owner-track: habait`, `model: opus`) |
| **Ruling tier** | **T1** |
| **גל (wave)** | 2 |
| **מצב** | TODO |
| **זיכרון** | `memory/agents/` לא קיים בפרויקט הזה; הזיכרון של הסוכן הוא בלוק `## תוצאה` כאן (ראו rails). הסוכן הוא יכולת קבועה (לא one-off persona). |

## מטרה

דף HTML מקומי אחד: התכנית (PNG) ומעליה הפוליגונים של `plan.json`; גרירת קודקוד, שינוי שם/סוג חדר, הוספה/מחיקה של פתח, כפתור "אשר". שומר `plan.json` מתוקן + `corrections.json` (כל תיקון = דאטה לאימון). אלירן הוא המתקן: שלושה צעדים, עברית, בלי מושגים של CAD.

## תלויות

- 01 (plan.json + report.json מה-intake)

## קלטים (קריאה)

- פלט 01: `Habait/engine/_local/apt846/v1/{plan.json,report.json,plan-crop.png}`
- הסכמה: `360walkaround/pipeline/SCHEMA.md` (ס"מ, origin NW, +y למטה)
- כלל ה-UI של אלירן: 3 צעדים, השאר תחת "הגדרות מתקדמות" (memory.md §1)

## קבצים (הסוכן כותב רק כאן)

- `Habait/engine/correct/index.html`, `Habait/engine/correct/correct.js`, `Habait/engine/correct/correct.css` (חדש)
- `Habait/engine/correct/serve.mjs` (שרת מקומי קטן: טוען/שומר plan.json ו-corrections.json)
- `Habait/engine/correct/README-he.md`

## צעדים

1. לטעון plan.json + PNG; להציג חדרים כפוליגונים, פתחים כקטעים על קירות, מידות מודפסות (מהדוח) ליד כל חדר עם סימון ירוק/אדום לפי הסטייה.
2. אינטראקציה: גרירת קודקוד עם snap לקירות; לחיצה על חדר → שם/סוג; לחיצה על קיר → הוסף פתח (דלת/חלון/פתח); מחיקה.
3. "אשר" שומר plan.json (עובר validate-plan) ו-corrections.json: `[{type, target, before, after, t}]`.
4. RTL, עברית, מקלדת לא נדרשת; עובד ב-Chrome דסקטופ (אלירן) ובטאבלט.
5. לנסות על 846 עם שלוש שגיאות מכוונות ולמדוד זמן תיקון.

## קריטריוני קבלה

- [ ] אלירן מתקן תכנית בלי הדרכה ב-< 20 דקות (T1: השאלה לאלירן היא לבצע את הניסוי; ברירת מחדל: הסוכן מודד על עצמו ומדווח).
- [ ] plan.json שנשמר עובר `validate-plan.mjs`.
- [ ] corrections.json נכתב ומכיל כל פעולה.
- [ ] אין תלות ברשת (קבצים מקומיים בלבד).

## Gate

**Check:**
```bash
cd C:/RnD/Projects/Habait/habait-walkaround && timeout 60 node Habait/engine/correct/serve.mjs --plan Habait/engine/_local/apt846/v1/plan.json --selftest
# צפוי: selftest טוען, מזיז קודקוד אחד דרך ה-API, שומר, ומריץ validate-plan → "selftest OK", exit 0
```

**Reviewer scope:** שלמות הסכמה בלבד: שום שדה של plan.json לא נמחק או משתנה צורה בשמירה; corrections.json משקף כל פעולה.

הבודק (אם נדרש) הוא `qa-reviewer` בהקשר נקי, לא הסשן שביצע.

## כסף

$0

## דרגת הכרעה

**T1:** שאלה אחת לאלירן (מנוסחת בבלוק התוצאה, עם האפשרויות וברירת מחדל). הסוכן ממשיך בכל מה שלא תלוי בתשובה.

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

_(platform-dev, 2026-11-02 ~14:25 שעון המכונה, מה-worktree `habait-walkaround/.claude/worktrees/board-habait-workplan`; ריצה אחת שנקטעה על מגבלת המנוי והמשיכה מאותה נקודה)_

- **מצב:** DONE לכל מה שלא תלוי באלירן. פתוח: (א) ניסוי ה-20 דקות של אלירן (שאלת T1 למטה); (ב) הרצת ה-Check על הפלט האמיתי של כרטיס 01, שעוד לא קיים (`Habait/engine/_local/apt846/v1/` חסר).
- **מה נעשה:**
  - מסך תיקון מקומי בעברית RTL, שלושה צעדים: **1 מה לבדוק** (רשימה חיה: מידה מול השרטוט ירוק/אדום לפי 3%, שם שלא מתאים לתווית בשרטוט, חדר שאי אפשר להגיע אליו כי חסרה דלת; לחיצה על שורה מקרבת לחדר) → **2 תיקון** (לחיצה על חדר: גרירת פינות עם הצמדה לקירות + בחירת שם מרשימה; לחיצה על קיר או על רווח בקיר: דלת / חלון / פתח; לחיצה על פתח: סוג, "צר/רחב יותר", מחיקה; "ביטול פעולה אחרונה") → **3 אישור** ("אשר ושמור"). השאר תחת "הגדרות מתקדמות". בלי מקלדת ובלי מילים של CAD. זום בכפתורים, בגלגלת ובצביטה. עבודה שלא נשמרה חוזרת אחרי רענון (localStorage).
  - `serve.mjs`: הנתיבים מגיעים כארגומנטים: `--plan`, `--report`, `--image`, `--out`, `--port` (ברירת מחדל 8870), `--validator`, `--selftest`. הוא מחפש לבד את `report.json` ואת `plan-crop.png` ליד התכנית, כך שהפלט של 01 נכנס בלי שינוי. ב"אשר": מחשב מחדש רק את השדות שנגזרים מהצורה (area/bbox/clear_dims בחדר שהשתנה; centre/width/angle בפתח שהשתנה), בודק שאף שדה לא נמחק ולא שינה צורה (`shapeDiff`) ומריץ את `validate-plan.mjs`. `plan.json` נכתב רק כשהכול עובר; אחרת נכתב `plan.draft.json` עם הסבר בעברית. `corrections.json` נכתב תמיד. הקלט לא נדרס אף פעם.
  - `corrections.json` = `[{type, target, before, after, t}]`: גרירה אחת היא רשומה אחת, פעולה שבוטלה נשארת עם `undone: true`, ו-`auto_move_camera` נרשם כשנקודת צילום יוצאת מחדר שהוקטן. ה-selftest מוכיח שהרצת הקובץ על הקלט נותנת את התכנית השמורה, ושהרצה הפוכה מחזירה את הקלט.
  - **פורמט `report.json` הוגדר כאן** לפי צעד 5 של כרטיס 01 (לכל חדר: מודפס / נמדד / סטייה / סטטוס / פתחים / תווית בשרטוט; פתחים; mismatches; summary עם edit_cost; ו-`raster.cm_to_px` למיפוי). המפרט המלא ב-`README-he.md`.
  - **מיפוי ס"מ → פיקסלים, נמדד ולא הונח:** אמת המידה מצוירת בחיתוך של tour360 ב-2.25 px/cm. החיתוך של engine הוא אותו קנה מידה, מוזז ב-(-167, +297) פיקסלים (template match, ציון 1.000 בארבעה מקומות). לכן `cm_to_px = [2.25,0,-167,0,2.25,297]`.
  - **הכרעות T0 שלי:** סף ירוק/אדום 3% (לפי הקבלה של 01). "נמדד" = מידות החדר לאורך הקירות שלו ולא ה-bbox, כי התכנית מוטה. `printed_scope: "part"` מוצג באפור ולא באדום, והוא סומן לסלון, לחדר ההורים ולפינת הארונות, כי הגבולות שלהם בתכנית הם קווים וירטואליים שהונחו ביד. הפלט נשמר ב-`Habait/engine/correct/_local/<id>/` (gitignored), כי שאר הנתיבים שייכים לכרטיס 01 או ל-360walkaround.
- **קבצים שנכתבו** (רק תחת `Habait/engine/correct/`): `index.html`, `correct.js` (הליבה המשותפת ל-Node ולדפדפן + ה-UI), `correct.css`, `serve.mjs`, `README-he.md`, `fixtures/apt846.report.json`, `fixtures/apt846-3errors.plan.json`, `fixtures/apt846-3errors.report.json`, `fixtures/make-fixtures.mjs` (בונה את הפיקסטורות ומאמת אותן עם `--verify`), `fixtures/ui-run.mjs` (בדיקה בדפדפן אמיתי, Playwright מ-appdeps, דסקטופ 1440x900 + טאבלט 820x1180 עם מגע). צילומי מסך נשמרים ב-`_local/shots/` (gitignored). לא נגעתי ב-`intake_*.py`, ב-`Habait/engine/intake/` או בשום נתיב אחר.
- **פלט ה-Check (מילה במילה).** **שינוי בנתיבים:** הורץ בשורש ה-worktree ולא ב-`C:/RnD/Projects/Habait/habait-walkaround`. במקום `Habait/engine/_local/apt846/v1/plan.json` (כרטיס 01 עוד לא רץ) הורץ על אמת המידה עם הדוח שבפיקסטורה:
```
$ timeout 60 node Habait/engine/correct/serve.mjs --plan 360walkaround/tours/apt846/plan.json --report Habait/engine/correct/fixtures/apt846.report.json --selftest
ok   session loads: apt846, 11 rooms, 13 openings, report 11 rooms, image 3156x4257
ok   index.html is Hebrew RTL
ok   no network dependency (external refs: 0)
ok   plan image served
ok   every room corner maps inside the image (cm->px 2.25,0,-167,0,2.25,297)
ok   move corner r-entrance/loop/0 (559.1,492.9) -> (560.6,494.4); snap candidate corner
ok   delete door o-6 (r-living|r-wardrobe), re-add by tapping its wall -> o-6 door r-living|r-wardrobe width 90.1
ok   live checks: 1 before, 2 after the edits
ok   save through the API: ok=true, validator fails 0, warns 27, shape problems 0
ok   plan.json + corrections.json written to --out
ok   validate-plan on the saved plan.json: exit 0, 0 fail, 27 warn
ok   corrections.json: 5 entries [move_vertex, set_room, delete_opening, add_opening, set_opening], each {type,target,before,after,t}
ok   schema integrity: no field deleted or reshaped (0 problems)
ok   replaying corrections.json on the input reproduces the saved rooms + openings
ok   undoing corrections.json in reverse restores the input
ok   input plan untouched (sha256 unchanged)
selftest OK
exit 0
$ timeout 60 node Habait/engine/correct/serve.mjs --plan <scratch>/v1sim/plan.json --selftest   # card-01 layout: plan.json + report.json + plan-crop.png
ok   input plan untouched (sha256 unchanged)
selftest OK
exit 0
```
  (הריצה השנייה מדמה בדיוק את הצורה של ה-Check בכרטיס: רק `--plan`, ו-`report.json` + `plan-crop.png` באותה תיקייה.) 27 ה-warns הם ה-warns של אמת המידה עצמה (V8/V9/V10/V13), ואותם 27 מופיעים כשמריצים את הבודק על הקלט.
  בדיקות נוספות: `make-fixtures.mjs --verify` → `verify OK` (4 דברים לבדוק → 1, ה-plan המתוקן עובר validate exit 0). `ui-run.mjs` → `ui-run OK`: 4 שורות בצעד 1; שלוש השגיאות תוקנו בדפדפן אמיתי ב-**14 הקשות + גרירה אחת, 0 הקשות מקלדת** (ריצה מתוסרטת 1.8–7.4 ש'); נשמר; 6 בקשות, כולן ל-127.0.0.1; 0 שגיאות בדף; בטאבלט הקשת מגע בוחרת חדר, הפאנל יורד מתחת לתכנית, כל כפתור בגובה 40 px לפחות.
- **כסף:** $0. אין ledger.
- **פגמים פתוחים:**
  1. **זמן תיקון אנושי לא נמדד.** מה שנמדד הוא מספר הפעולות (15) ולא דקות של אדם. ההערכה שלי, שאינה מדידה: 3 עד 6 דקות למי שפותח את המסך בפעם הראשונה.
  2. במסך אי אפשר להוסיף או למחוק פינות או חדרים, ואי אפשר לערוך קירות, זיגוג או ריהוט. הזזת פינה של חדר לא מזיזה את הקיר.
  3. ההצמדה בחרה פינת קיר שנמצאת 6 ס"מ מהפינה המצוירת (851.1,267.1 מול 847.6,262.2). המידה חזרה לירוק.
  4. דלת חדשה נוצרת ברוחב ברירת מחדל: 90 ס"מ לדלת, 120 לחלון, 150 לפתח. בניסוי צריך "צר יותר" פעמיים.
  5. אמת המידה עצמה מסומנת באדום בחדר הרחצה של ההורים: 218×218 בתכנית מול 212×210 בשרטוט, סטייה 3.6%. ייתכן שזה קנה המידה 2.25 שבו היא צוירה, מול 2.2677 הנומינלי של 288dpi (הפרש של 0.8%).
  6. בלי `report.raster` המסך נופל למיפוי שב-`plan_meta`, שנכון רק לחיתוך שעליו נעשה ה-trace. ה-selftest תופס את זה ונכשל, כפי שצריך.
- **שאלה לאלירן (T1):** "תוכל לבדוק בעצמך, בלי הדרכה, אם מתקנים תכנית בפחות מ-20 דקות? מריצים `node Habait/engine/correct/serve.mjs --plan Habait/engine/correct/fixtures/apt846-3errors.plan.json --report Habait/engine/correct/fixtures/apt846-3errors.report.json`, פותחים http://127.0.0.1:8870/ ומתקנים. בתכנית יש שלוש טעויות מכוונות. הזמן נרשם לבד ב-`session.json` (`elapsed_s`)." אפשרויות: (א) אלירן בודק עכשיו על תכנית שלוש הטעויות; (ב) אלירן בודק אחרי כרטיס 01, על פלט intake אמיתי; (ג) לא בודק. **ברירת מחדל: (ב).** עד אז הנתון שמדווח הוא המדידה שלי: 14 הקשות וגרירה אחת, 0 הקשות מקלדת.
- **קורא שני:** habait-ab (מחזיק את ערוץ A ואת כרטיס 01). כרטיס 01 חייב לכתוב ב-`v1/` את `report.json` בפורמט שב-`Habait/engine/correct/README-he.md`, כולל `raster.cm_to_px` (או `px_per_cm`/`origin_px`) שממפה את ס"מ ה-plan אל `v1/plan-crop.png`, ולכל חדר את `printed_dims_cm`, `printed_scope` ו-`label_he`. בלי זה המסך מצייר את החדרים במקום הלא נכון וה-Check של 02 נכשל.
- **לזיכרון:** מסך תיקון intake (כרטיס 02) ב-`Habait/engine/correct/`: `node serve.mjs --plan <plan.json> [--report] [--out]` → :8870, עברית RTL, 3 צעדים, בלי מקלדת; שומר plan.json (רק אם validate עובר) + corrections.json `[{type,target,before,after,t}]`. פורמט report.json (כולל raster.cm_to_px) מוגדר ב-README-he.md; 01 חייב לכתוב אותו. 3 שגיאות על 846 תוקנו ב-14 הקשות + גרירה. $0.
