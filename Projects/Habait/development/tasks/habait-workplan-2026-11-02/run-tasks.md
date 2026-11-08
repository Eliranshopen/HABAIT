# איך מריצים את הלוח `habait-workplan-2026-11-02`

## לפני גל

1. לקרוא `C:\RnD\Projects\Habait\memory.md` ו-`C:\RnD\Projects\Habait\SESSIONS.md`; לוודא שהסשן המפעיל רשום בלוח הסשנים עם הנתיבים של הכרטיסים שהוא מפעיל (למשל: `Habait/engine/**`, `Habait/platform/**`, `Habait/flyover/**`, `data/sales-plans/**` כפי ש-habait-ab מחזיק היום). כרטיס שנוגע בנתיב של סשן אחר (16, 89) לא מופעל בלי הודעה אליו ותשובה.
2. לבדוק ב-README שהתלויות של הגל DONE (בלוק תוצאה קיים + זיכרון נכתב).
3. לכתוב ב-Key state: "גל N יוצא, כרטיסים …, שעה".
4. לכל כרטיס עם כסף: לבקש מאלירן אישור **בצ'אט הזה** עם הסכום והתקרה; בלי אישור הכרטיס רץ עד הקריאה הראשונה ועוצר.

## הפעלה

לכל כרטיס, קריאת `Agent` אחת (עד 5 במקביל בהודעה אחת):

```
subagent_type: <הסוכן מהכרטיס>      # engine-builder | blender-scene | cloud-render | genai-look | platform-dev | corpus-and-docs | qa-reviewer
prompt: "Work the task file C:\RnD\Projects\Habait\development\tasks\habait-workplan-2026-11-02\task-NN-<slug>.md. Read its Standing rails first. Write only to the paths it lists. Run its Check and paste the output verbatim into the result block. Return: DONE/BLOCKED/PARTIAL, the Check result, money spent, and the one question if the tier stopped you."
```

ה-model כבר נעוץ בהגדרת הסוכן (opus לעבודה, sonnet ל-qa-reviewer); לא להעביר `model:` בקריאה.

## אחרי כל כרטיס (checklist, הסשן המפעיל)

- [ ] בלוק `## תוצאה` קיים בכרטיס ומכיל את פלט ה-Check מילה במילה.
- [ ] ה-Check רץ מחדש על ידי הסשן המפעיל (לא מאמינים לפלט שנכתב) או על ידי `qa-reviewer` אם הכרטיס T2 / שער.
- [ ] שורת `לזיכרון:` הועתקה ל-`C:\RnD\Projects\Habait\memory.md` בעריכה נקודתית (הסעיף המתאים: §4 מצב / §7 פסקים / §8 כסף), ותאריך "עודכן לאחרונה" קודם.
- [ ] "קורא שני" נשלח ב-`SendMessage` לסשן שצוין, והשורה נוספה תחת "העברות" ב-README.
- [ ] מצב הכרטיס בטבלת ה-README עודכן (TODO → DONE / BLOCKED).
- [ ] ledger: אם הוצא כסף, הסכום נרשם גם בטבלת הכסף ב-`SESSIONS.md` (השורה של הסשן המפעיל).
- [ ] T1/T2: השאלה לאלירן נכתבה בצ'אט **בעברית**, עם האפשרויות וברירת המחדל.

## סגירת הלוח (מתי שהוא: אחרי M2 או כשאלירן אומר)

- כל הכרטיסים DONE/CANCELLED עם סיבה; Key state אחרון; דוח לאלירן בעברית (מה נבנה, מה עלה, מה פתוח).
- הסוכנים: כולם יכולות קבועות (status נשאר `live`); אין one-off personas ללוח הזה, אז אין מה לארכב (סקיל שלב 7). אם בעתיד יוחלט לארכב: `status: archived` בקובץ, **לא** להזיז אותו.
- לעדכן `C:\RnD\Projects\Habait\docs\governance\OWED.md` (סגירת החוב על ה-git אם נפתר).
