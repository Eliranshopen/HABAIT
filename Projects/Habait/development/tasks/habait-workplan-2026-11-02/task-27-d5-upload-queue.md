# משימה 27: D5 (אחרי M2): העלאה (PDF/DWG/תמונות) → project.json → תור עבודות (Railway) → A5 → A2 בדפדפן → publish

| שדה | ערך |
|---|---|
| **לוח** | `habait-workplan-2026-11-02` |
| **ערוץ** | D |
| **מקור בתכנית** | חלק ג §2 ערוץ D, שלב D5; שער M4 ב-`C:\RnD\Projects\Habait\research\product-research-2026-11-02\HABAIT-RESEARCH-2026-11-02.md` |
| **סוכן** | `platform-dev` (`status: live`, `owner-track: habait`, `model: opus`) |
| **Ruling tier** | **T2** |
| **גל (wave)** | 7 |
| **מצב** | TODO |
| **זיכרון** | `memory/agents/` לא קיים בפרויקט הזה; הזיכרון של הסוכן הוא בלוק `## תוצאה` כאן (ראו rails). הסוכן הוא יכולת קבועה (לא one-off persona). |

## מטרה

ה-UI של אלירן: שלושה צעדים (העלאה → יצירה → תוצאות), הכול אחר תחת "הגדרות מתקדמות". העלאה יוצרת project-dir + project.json, תור (Railway worker) מריץ `habait-engine run` שלב-שלב, עוצר ב-A2 (מסך התיקון) ומחכה לאישור, ואז ממשיך ומפרסם. נבנה רק אחרי שהמנוע הוכיח איכות סטודיו על בניין שלם.

## תלויות

- **שער M2 עבר** (אלירן), 04 (CLI), 02 (מסך תיקון כבר בדפדפן), 26
- T2: Railway (כבר בחשבון), auth, אחסון קבצי יזמים = החלטות של אלירן + בדיקת qa-reviewer

## קלטים (קריאה)

- 04 (CLI), 02, 26; Railway skills זמינים בסשן
- חלק א §5 M8

## קבצים (הסוכן כותב רק כאן)

- `Habait/platform/server/**` (API: upload, jobs, status), `Habait/platform/worker/**`
- `Habait/platform/upload.html`, `js/upload.js`
- `Habait/platform/railway.json` / Dockerfile
- `Habait/platform/test/upload.test.mjs`

## צעדים

1. API מקומי קודם (Node, קבצים ב-`_local/projects/`); תור = SQLite/JSON; worker = תהליך שמריץ את ה-CLI.
2. מסך 3 צעדים; A2 משובץ כצעד "תיקון".
3. Railway: רק אחרי שהכול עובד מקומית ואלירן אישר (T2).
4. qa-reviewer: אין נתיב שמריץ שלב בתשלום בלי תקרה; קבצי יזמים לא נגישים ללא auth.

## קריטריוני קבלה

- [ ] פרויקט fixture שני עובר דרך ה-UI מקצה לקצה מקומית.
- [ ] אין קריאה בתשלום בלי תקרה לפרויקט (טסט).
- [ ] פריסה ל-Railway רק עם אישור T2 מתועד.

## Gate

**Check:**
```bash
cd C:/RnD/Projects/Habait/habait-walkaround/Habait/platform && timeout 600 node test/upload.test.mjs
# צפוי: "upload→project.json ok; queue runs intake; stops at correction; resume→publish ok; paid stage refused without cap", exit 0
```

**Reviewer scope:** בטיחות בלבד: auth על קבצי יזמים, ואי-הוצאה ללא תקרה.

הבודק (אם נדרש) הוא `qa-reviewer` בהקשר נקי, לא הסשן שביצע.

## כסף

₪ Railway קטן (לפי אישור אלירן); אין קריאות גנרטיביות מהתור בלי `HABAIT_ALLOW_SPEND` ותקרה לפרויקט

## דרגת הכרעה

**T2:** השאלה לאלירן **וגם** בדיקה עצמאית של `qa-reviewer` (הקשר נקי, מנסה להפריך) לפני שהצעד הבלתי-הפיך (מפתח אמיתי / פריסה / שליחת מידע החוצה) מתבצע.

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
