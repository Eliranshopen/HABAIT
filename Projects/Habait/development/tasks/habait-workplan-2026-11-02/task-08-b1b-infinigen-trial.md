# משימה 08: B1ב: ניסוי Infinigen Indoors על חדר אחד (פוליגון קבוע משלנו) ב-Kaggle

| שדה | ערך |
|---|---|
| **לוח** | `habait-workplan-2026-11-02` |
| **ערוץ** | B |
| **מקור בתכנית** | חלק ג §2 ערוץ B, שלב B1 (סוכן); חלק א §11.3 ב-`C:\RnD\Projects\Habait\research\product-research-2026-11-02\HABAIT-RESEARCH-2026-11-02.md` |
| **סוכן** | `cloud-render` (`status: live`, `owner-track: habait`, `model: opus`) |
| **Ruling tier** | **T0** |
| **גל (wave)** | 6 |
| **מצב** | TODO |
| **זיכרון** | `memory/agents/` לא קיים בפרויקט הזה; הזיכרון של הסוכן הוא בלוק `## תוצאה` כאן (ראו rails). הסוכן הוא יכולת קבועה (לא one-off persona). |

## מטרה

לבדוק אם Infinigen Indoors (Princeton, BSD-3, 2.0.0a3) מקבל פוליגון חדר קבוע משלנו ומרהט רק אותו, ומה איכות הפלט מול ה-templates. הפלט המבוקש: placements (או .blend) לחדר אחד של 846 + דוח עמוד אחד: כן/לא, זמן, מגבלות, האם להכניס ל-S2.

## תלויות

- 07 (פורמט placements.json שהתוצאה צריכה להתאים לו)

## קלטים (קריאה)

- Infinigen: github princeton-vl/infinigen (לקרוא את ה-solver של הפנים ואת ה-API של room constraints בקוד, לא רק בדפים)
- `360walkaround/tours/apt846/plan.json` → חדר cp-living כפוליגון
- Kaggle notebook (Linux; Windows "ניסיוני")

## קבצים (הסוכן כותב רק כאן)

- `Habait/engine/experiments/infinigen/{notebook.ipynb,run.py,REPORT-he.md}`
- `Habait/engine/_local/experiments/infinigen/**` (פלטים)

## צעדים

1. להתקין Infinigen ב-notebook ב-Kaggle (CPU מספיק להרצת ה-solver; GPU לרנדר בדיקה).
2. להזין פוליגון חדר קבוע; אם ה-API לא תומך: לתעד את הנקודה בקוד שבה אפשר להזריק אותו.
3. להוציא placements בפורמט של 07 או .blend; רנדר בדיקה אחד.
4. דוח עברית: עובד/לא, שעות מכסה, גודל, מגבלות רישיון (BSD-3 → בסדר).

## קריטריוני קבלה

- [ ] תשובה חד-משמעית: Infinigen מקבל/לא מקבל פוליגון קבוע, עם הראיה בקוד.
- [ ] אם כן: חדר אחד של 846 מרוהט ופלט placements/blend נשמר.
- [ ] דוח ≤ עמוד + המלצה ל-S2.

## Gate

**Check:**
```bash
cd C:/RnD/Projects/Habait/habait-walkaround && test -s Habait/engine/experiments/infinigen/REPORT-he.md && grep -E "^(מסקנה|Verdict):" Habait/engine/experiments/infinigen/REPORT-he.md
# צפוי: שורת מסקנה אחת: "מקבל פוליגון קבוע: כן|לא" + שעות Kaggle שנוצלו
```

**Reviewer scope:** עובדתיות בלבד: הטענה על ה-API מגובה בקובץ ושורה בקוד של Infinigen.

הבודק (אם נדרש) הוא `qa-reviewer` בהקשר נקי, לא הסשן שביצע.

## כסף

$0 (Kaggle)

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
