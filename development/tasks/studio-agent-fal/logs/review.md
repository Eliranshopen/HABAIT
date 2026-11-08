# סקירת refute-first — studio-agent-fal (תוכנית 2026-11-03-studio-agent-fal)
נסקר: העותק ב-`.wt\studio-agent-fal\files\...\studio\` מול החי. $0, בלי קריאת fal, בלי פתיחת .env. הבדיקות: `.wt\studio-agent-fal\tools\review\ui.mjs`.

## 1 · סודות
- PASS FAL_KEY עובר רק ל-header Authorization ב-`falLLM`; אין log/ledger/chat.json/תגובת API שמכילים אותו (grep + בדיקת קבצי _local).
- PASS `/api/env` מחזיר יכולות בלבד ('ready'/'missing'), לא ערכים. (הערה: חושף נתיב projects_dir, כך גם בחי.)
- PASS `HABAIT_DOTENV` נקרא מ-env של התהליך בלבד, לא מבקשת HTTP, והתוכן עובר ל-`readDotenv` ולא מוחזר.
- PASS הודעות שגיאה של fal נחתכות ל-300 תווים; אין ביטוי של ה-header.

## 2 · כסף
- PASS צ'אט: FAL_KEY + ALLOW_SPEND + בדיקת תקרה לפני הקריאה; ledger אחרי עם usage.cost, גם כשהתשובה נכשלה (usd>0).
- PASS intake: `ctx.spendGate(0.5)` לפני `structured` כש-backend=fal.
- FAIL תקרה ניתנת לעקיפה במקביל: בצ'אט הבדיקה (`ledgerTotal`) והכתיבה (`spend`) מופרדות ב-`await` ואין נעילה לפרויקט, אז N בקשות POST במקביל עוברות כולן את אותה בדיקה (כל אחת ~$0.02-0.05, חסום רק במספר החיבורים). `lib/chat.mjs:62-68`.
- FAIL קריאה ל-fal בלי שער: `pipeline/stages/plan.mjs:60` (וגם `tools/pick_views.mjs:78`) קוראים ל-`structured()` שבו backend=fal, ללא `spendGate`. עם `HABAIT_LLM_BACKEND=fal` ו-ALLOW_SPEND כבוי הקריאה יוצאת (`llm.mjs` לא בודק ALLOW_SPEND ב-backend מפורש), ועם spend דלוק התקרה לא נבדקת. הערכה: גם לפני הקריאה אין שורת ledger מתוכננת.
- NOTE `backendFor` עם LLM_BACKEND מפורש = 'fal' ו-spend כבוי: רק intake חסום (דרך הגייט שלו); כל השאר פתוח.

## 3 · Grounding (§6)
- PASS ה-system מכיל רק נתוני הפרויקט (meta, שמות קבצים, intake.json, שלבים, סכום ledger); המזהה עובר regex ב-`store.dir`, וגם `..%2f` מחזיר שגיאה (500, לא דליפה).
- PASS שאלת המפתח נכנסת ל-prompt ולא ל-system; כללי ה-system נפרדים וחוסמים "ענה רק מהנתונים".
- NOTE הזרקה עקיפה: טקסט שחולץ מקבצי המפתח (intake.json) נכנס ל-system. תוך-פרויקט בלבד, לא חוצה פרויקטים; תכנון מקובל, לא נבדק בקריאה חיה.

## 4 · נכונות
- PASS `llm-fal.test.mjs`: כל 7 הבדיקות עברו.
- PASS `run.mjs`: 13 עברו, 1 נכשל — רק `plan.general.json` חסר ב-tour360 של העותק (ENOENT), כצפוי.
- PASS mock: GET ריק = `{messages:[]}` 200; POST = `(mock) …` 200; היסטוריה נשמרת ומוחזרת; הודעה ריקה = 409 `{error, messages}`; פרויקט חסר = 404.
- FAIL גוף לא תקין: `null` ב-body ו-JSON שבור מחזירים 500 עם הודעת חריגה פנימית במקום 400 (`server.mjs` readJsonBody/`body.message`). קוסמטי (קיים גם ב-PATCH/POST הקיימים).

## 5 · UI (msedge + mock)
- PASS mdLite עושה `esc` לפני עיצוב; `<img onerror>` לא הוזרק (0 img, 0 dialogs), `**bold**` הפך ל-`<b>` בלבד.
- PASS Enter שולח ומנקה את השדה; Shift+Enter מוסיף שורה (`line1\nline2`) ולא שולח.
- PASS RTL (`dir=rtl`), `dir=auto` על הטקסט.
- PASS כפתור primary יחיד בתצוגת הפרויקט (`btn-create`); "שליחה" secondary.
- PASS 405 (fixture): מוצג "השרת הזה במצב תצוגה (קריאה בלבד)", הכפתור חוזר ל"שליחה", ההודעה הממתינה הוסרה.

## פסק דין
**PASS WITH FAILS — לא למיזוג לחי לפני תיקון שני דברים בכסף:** (א) שער `spendGate` ל-`plan.mjs` (ול-pick_views) או חסימת backend=fal ב-`structured()` כשה-spend כבוי / מעל התקרה; (ב) נעילה/מונה "בדרך" לפרויקט בצ'אט נגד POST מקביל. הגוף הלא-תקין (500) הוא מינורי.
