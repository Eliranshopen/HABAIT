# משימה 28: E1: סט הערכה: 10 תכניות מתויגות ידנית (דרך A2) = ground truth; eval_intake.py על כולן

| שדה | ערך |
|---|---|
| **לוח** | `habait-workplan-2026-11-02` |
| **ערוץ** | E |
| **מקור בתכנית** | חלק ג §2 ערוץ E, שלב E1 ב-`C:\RnD\Projects\Habait\research\product-research-2026-11-02\HABAIT-RESEARCH-2026-11-02.md` |
| **סוכן** | `corpus-and-docs` (`status: live`, `owner-track: habait`, `model: opus`) |
| **Ruling tier** | **T0** |
| **גל (wave)** | 5 |
| **מצב** | TODO |
| **זיכרון** | `memory/agents/` לא קיים בפרויקט הזה; הזיכרון של הסוכן הוא בלוק `## תוצאה` כאן (ראו rails). הסוכן הוא יכולת קבועה (לא one-off persona). |

## מטרה

להפוך את ה-intake ממדידה על תכנית אחת למדידה על 10: לכל תכנית ב-`_inbox` → תיקייה לפי המבנה, meta.json, plan.json מתויג (דרך A2, הסוכן מתייג; אלירן מאשר), ו-`eval_intake.py` רץ על 10 עם דוח אחד (מידות, חדרים, פתחים, edit-cost). עד שיש 10: לעבוד עם מה שיש (846 + הדירות האחרות ב-PDF של Rainbow, אם יש) ולרשום את הפער.

## תלויות

- W1-E0 של habait-ab (`data/sales-plans/`: index.csv, LABELING-GUIDE-he.md, tools/eval_intake.py); 02 (מסך התיקון לתיוג); **[אלירן] מביא תכניות ל-`_inbox`** (יש היום: Rainbow בלבד)

## קלטים (קריאה)

- `C:\RnD\Projects\Habait\data\sales-plans\{README.md,LABELING-GUIDE-he.md,index.csv,templates/meta.template.json,tools/eval_intake.py,eval/README.md}`
- 01 (intake_raster), 02 (correct/)

## קבצים (הסוכן כותב רק כאן)

- `C:\RnD\Projects\Habait\data\sales-plans\<developer>\<project>\<unit>\{meta.json,plan.json,source.pdf}`
- `C:\RnD\Projects\Habait\data\sales-plans\index.csv` (שורות)
- `C:\RnD\Projects\Habait\data\sales-plans\eval\2026-11-xx\{report.md,*.json}`
- `C:\RnD\Projects\Habait\data\sales-plans\tools\run_eval_all.py` (חדש: לולאה על index.csv)

## צעדים

1. לקטלג כל תכנית ב-_inbox לפי המדריך; meta.json (יזם, פרויקט, טיפוס, קנ"מ, רסטר/וקטור, ממ"ד, מראה/הפוכה).
2. תיוג: intake_raster → A2 → plan.json מתוקן + corrections.json (נשמר: זה edit-cost).
3. run_eval_all.py: לכל יחידה עם plan.json: eval_intake על פלט ה-intake הגולמי מול המתויג → דוח מאוחד.
4. לרשום כמה תכניות יש מול 10, ולכתוב לאלירן רשימה של מה חסר (לא לפנות ליזמים).

## קריטריוני קבלה

- [ ] כל תכנית ב-_inbox מקוטלגת (index.csv) עם meta.json.
- [ ] דוח הערכה מאוחד על כל היחידות המתויגות (N/10 מצוין בכותרת).
- [ ] edit-cost ממוצע מדווח.

## Gate

**Check:**
```bash
cd /c/RnD/Projects/Habait/data/sales-plans && export PYTHONIOENCODING=utf-8 && PY=/c/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe && timeout 900 $PY tools/run_eval_all.py --index index.csv --out eval/latest && head -5 eval/latest/report.md
# צפוי: כותרת "N/10 תכניות מתויגות", טבלה עם dims/rooms/openings/edit-cost לכל יחידה, exit 0
```

**Reviewer scope:** עקביות בלבד: כל plan.json מתויג עובר validate-plan, ו-meta.json תואם לתבנית.

הבודק (אם נדרש) הוא `qa-reviewer` בהקשר נקי, לא הסשן שביצע.

## כסף

$0

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
