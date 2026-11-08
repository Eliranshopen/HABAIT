# משימה 15: C1: projection mapping v1: 4–6 skins מוטלים על המסה + קרקע + שכנים, blend לפי זווית, רנדר מ-3 זוויות חדשות (הבדיקה שמכריעה את ערוץ C)

| שדה | ערך |
|---|---|
| **לוח** | `habait-workplan-2026-11-02` |
| **ערוץ** | C |
| **מקור בתכנית** | חלק ג §2 ערוץ C, שלב C1; חלק א §4 פריט 2 ב-`C:\RnD\Projects\Habait\research\product-research-2026-11-02\HABAIT-RESEARCH-2026-11-02.md` |
| **סוכן** | `blender-scene` (`status: live`, `owner-track: habait`, `model: opus`) |
| **Ruling tier** | **T1** |
| **גל (wave)** | 1 |
| **מצב** | EXECUTING (תת-סוכן `blender-scene` של habait-ab מ-12:20; כותב רק ל-`Habait/flyover`; אפיון בפועל: bake של ה-skins על site.glb עם ray-cast visibility, 6 זוויות חדשות, REPORT עם אחוז חורים) |
| **זיכרון** | `memory/agents/` לא קיים בפרויקט הזה; הזיכרון של הסוכן הוא בלוק `## תוצאה` כאן (ראו rails). הסוכן הוא יכולת קבועה (לא one-off persona). |

## מטרה

להרחיב את מבחן ההטלה של ab מ-skin אחד לכמה: כל skin (אווירי, 3–4 אזימוטים, קרוב לחזית) מוטל כמצלמת UV-project על מסת המגדל + קרקע (אורתופוטו) + שכנים (OSM) עם blend לפי זווית בין המצלמה המקורית לנורמל; ים/שמיים HDRI. רנדר מ-3 זוויות שלא "נראו" באף skin. אם מזוויות חדשות המגדל נראה כמו ה-skin ולא כמו clay ובלי מריחות בקצוות, ערוץ C חי; אם לא, עוברים ל-C7. זה הכרטיס שאלירן צריך לראות ראשון.

## תלויות

- W1-C1 של habait-ab (`Habait/flyover/project_skin.py`, רנדרי `renders/*__proj*.png`, 11:46)
- C0 של habait-16 (skins ב-GPT 2.5 של 4 הנודים; ~$8.40, רץ); עד שמגיעים: הפנורמות ב-`Habait/flyover/panos/`
- הרצת Blender דרך habait-16 (מקומי, EEVEE קצר) או דרך 17ב (Kaggle)

## קלטים (קריאה)

- `Habait/flyover/{project_skin.py,projectors.json,projectors-panos.json,equi2faces.py,contact_sheet.py}` (של ab; הסוכן ממשיך בתוכם)
- `Habait/flyover/renders/*` (orig/az±30/az+60/low × clay/proj1/proj2/cov) = התוצאה של skin אחד
- `Habait/tour360/apartments/apt846/exterior.json` + skins של C0 (כשמגיעים)
- `C:\RnD\Projects\Habait\tools\bench\site846\` (מסה, מיקום, צפון)

## קבצים (הסוכן כותב רק כאן)

- `Habait/flyover/project_skin.py` (הרחבה: N projectors, blend by angle, coverage mask)
- `Habait/flyover/renders-v1/**` (3 זוויות חדשות × clay/proj/coverage)
- `Habait/flyover/REPORT-C1-he.md` + `compare.html`

> **Blender:** לפי SESSIONS.md כלל 4, רק habait-16 מריץ Blender מקומית. הסוכן כותב את הסקריפט, מריץ `--dry-run`/selftest בלי Blender אם אפשר, ומבקש מהסשן המפעיל להעביר את ההרצה ל-16 (SendMessage) או ל-Kaggle (כרטיס 18). ההרצה בפועל של ה-Check נרשמת בבלוק התוצאה עם מי הריץ.

## צעדים

1. לקרוא את הדוח/פלטים של ab: איפה המריחות, מה ה-coverage. לא להתחיל מאפס.
2. N projectors מ-exterior.json/projectors.json; לכל פיקסל: משקל = cos(זווית מצלמה-נורמל)^k, נרמול; פיקסל בלי כיסוי = clay + סימון במפת coverage.
3. 3 זוויות חדשות (למשל az+135 נמוך, az-90 גובה קומה 16, אווירי הפוך) ברזולוציה 960×540 EEVEE.
4. דף השוואה: clay / proj / coverage לכל זווית; דוח: אחוז פיקסלים מכוסים, מריחות (gradient בקצוות), המלצה.
5. T1: שאלה לאלירן: "מזוויות חדשות המגדל נראה כמו ההדמיה?" ברירת מחדל: ממשיכים ל-C2/C3 רק אם כן; אחרת C7.

## קריטריוני קבלה

- [ ] 3 זוויות חדשות רונדרו; coverage ≥ 85% על המגדל בכל אחת.
- [ ] ללא מריחות גלויות בקצוות (gradient-based seam metric ≤ של ה-clay × 1.5).
- [ ] `facade_gate` (05) PASS על 3 הפריימים.
- [ ] דף השוואה + שאלת T1 נוסחה; דוח בעברית.

## Gate

**Check:**
```bash
cd C:/RnD/Projects/Habait/habait-walkaround && export BLENDER=/c/RnD/Projects/Habait/tools/blender-4.5.10/blender-4.5.10-windows-x64/blender.exe && timeout 1800 "$BLENDER" -b Habait/flyover/project_skin.blend --factory-startup -P Habait/flyover/project_skin.py -- --projectors Habait/flyover/projectors-v1.json --views new1,new2,new3 --variants clay,proj,cov --out Habait/flyover/renders-v1 && ls Habait/flyover/renders-v1 | wc -l
# צפוי: 9 קבצים (3 זוויות × 3 וריאנטים); דוח coverage ≥ 0.85 לכל זווית (ההרצה דרך habait-16 או Kaggle)
```

**Reviewer scope:** עין + מדד: האם הזוויות החדשות באמת לא נראו באף skin (לבדוק מול projectors-v1.json), והאם ה-coverage חושב על מסכת המגדל בלבד.

הבודק (אם נדרש) הוא `qa-reviewer` בהקשר נקי, לא הסשן שביצע.

## כסף

$0 (אין קריאות גנרטיביות; skins מגיעים מ-C0 של 16)

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

_(ממלא הסוכן בסוף הריצה; ריק = הכרטיס לא התחיל)_

- **מצב:** DONE / BLOCKED / PARTIAL
- **מה נעשה:**
- **קבצים שנכתבו:**
- **פלט ה-Check (מילה במילה):**
```
```
- **כסף:** $0 / סכום + נתיב ה-ledger
- **פגמים פתוחים / שאלה לאלירן (אם T1/T2):**
- **קורא שני:** אין / <סשן>: <למה זה מחייב אותו>
- **לזיכרון:** <עד 400 תווים>
