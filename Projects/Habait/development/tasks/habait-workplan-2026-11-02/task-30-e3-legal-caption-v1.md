# משימה 30: E3: נוסח כיתוב אחיד סופי (עברית/אנגלית) + חבילת שאלות לעו"ד עם מקורות מאומתים

| שדה | ערך |
|---|---|
| **לוח** | `habait-workplan-2026-11-02` |
| **ערוץ** | E |
| **מקור בתכנית** | חלק ג §2 ערוץ E, שלב E3; חלק א §3.5–3.6 ב-`C:\RnD\Projects\Habait\research\product-research-2026-11-02\HABAIT-RESEARCH-2026-11-02.md` |
| **סוכן** | `corpus-and-docs` (`status: live`, `owner-track: habait`, `model: opus`) |
| **Ruling tier** | **T1** |
| **גל (wave)** | 5 |
| **מצב** | TODO |
| **זיכרון** | `memory/agents/` לא קיים בפרויקט הזה; הזיכרון של הסוכן הוא בלוק `## תוצאה` כאן (ראו rails). הסוכן הוא יכולת קבועה (לא one-off persona). |

## מטרה

להפוך את הטיוטה של ab לנוסח אחד שנכנס לכל פלט (וידאו, פנורמה, דף, ZIP): "הדמיה להמחשה בלבד; נוצרה בסיוע AI מתכנית המכר מיום X; המחייב: המפרט והתכנית" + גילוי AI; גרסה קצרה (שורה) וארוכה (פסקה); ולהכין לעו"ד חבילה: 10 שאלות ממוספרות, המקורות (חוק הגנת הצרכן ס' 2 ו-36, צו מכר דירות, התקדים מ-2017 מסומן "לאמת בנבו"), ומה המוצר עושה בפועל (gates מתועדים). לא ייעוץ משפטי: טיוטה לעו"ד.

## תלויות

- W1-E3 של habait-ab (`legal/disclaimer-he-en.md`, `lawyer-checklist-he.md`, `sources.md`, 11:38); **[אלירן] שם עו"ד** (T1)

## קלטים (קריאה)

- `C:\RnD\Projects\Habait\data\sales-plans\legal\*` (הטיוטה של ab)
- חלק א §3.5, §3.6
- איפה הכיתוב מוצג: 23 (דף), 10 (3D), 14 (ריל), הסיור (16)

## קבצים (הסוכן כותב רק כאן)

- `C:\RnD\Projects\Habait\data\sales-plans\legal\caption-v1.json` (he/en, short/long, placeholders: project, plan_date)
- `C:\RnD\Projects\Habait\data\sales-plans\legal\lawyer-package-he.md`
- `C:\RnD\Projects\Habait\data\sales-plans\legal\sources.md` (מעודכן: כל מקור עם תאריך גישה ומה אומת)

## צעדים

1. לקרוא את הטיוטה; לאמת כל מקור ב-sources.md (WebFetch): קיים/לא, מה בדיוק כתוב; לסמן מה לא אומת.
2. caption-v1.json: 4 וריאנטים (he/en × short/long) עם placeholders; כלל שימוש: איפה כל וריאנט.
3. lawyer-package-he.md: רקע המוצר (עמוד), 10 שאלות, המקורות, הנוסח המוצע.
4. T1 לאלירן: שם עו"ד + אישור לשלוח; ברירת מחדל: החבילה מוכנה, לא נשלחת.

## קריטריוני קבלה

- [ ] caption-v1.json נטען על ידי 23 (platform) בלי שינוי (JSON תקין, 4 וריאנטים).
- [ ] כל מקור ב-sources.md מסומן אומת/לא אומת עם תאריך.
- [ ] החבילה לעו"ד ≤ 3 עמודים, בעברית.

## Gate

**Check:**
```bash
cd /c/RnD/Projects/Habait/data/sales-plans/legal && node -e "const c=require('./caption-v1.json');const ok=['he','en'].every(l=>c[l]&&c[l].short&&c[l].long);process.exit(ok?0:1)" && grep -c "אומת\|לא אומת" sources.md
# צפוי: exit 0; מספר הסימונים = מספר המקורות
```

**Reviewer scope:** עובדתיות בלבד: כל ציטוט חוק/פסיקה תואם למקור שנפתח, והתקדים מסומן לאימות.

הבודק (אם נדרש) הוא `qa-reviewer` בהקשר נקי, לא הסשן שביצע.

## כסף

$0 (שכ"ט עו"ד = אלירן)

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

_(מילא הסוכן `corpus-and-docs` עבור habait-1d, 2026-11-02 18:30 שעון המכונה)_

- **מצב:** **DONE.** החבילה לעו"ד מוכנה ולא נשלחה (ברירת המחדל של T1). שלושת קריטריוני הקבלה עומדים, וה-Check עבר (פירוט למטה).
- **מה נעשה:**
  1. **אימות מקורות.** כל 16 המקורות נפתחו מחדש, או שכתוב במפורש שלא נפתחו. החוקים והצו נקראו מהטקסט הגולמי של ויקיטקסט (`action=raw`). ה-PDF של gov.il חולץ ב-pymupdf. שני קטעי הפסיקה הורדו ב-curl וצוטטו מילה במילה. התוצאה: **9 אומתו, 5 אומתו חלקית, 2 לא אומתו.**
  2. **פס"ד המעקות 2017 לא נמצא בציבור** (3 חיפושים; פס"ד "כץ נ' אשדר" שעלה בחיפוש נפתח, והוא לא התיק). מסומן "לא אומת · לאמת בנבו". הקטע המשני (dinrega) הועתק מילה במילה. ממנו עולה ש"לצורך המחשה בלבד" הופיע ב"מסמך עקרי המפרט" ולא במפרט, וש"מזוגג ו/או בנוי" נזכר בעדות. הסכומים ₪297,500 ו-₪25,000 תואמים. שם העד הושמט.
  3. **שלושה תיקונים לעובדות שבזיכרון ובמחקר:**
     - (א) צו מכר דירות (טופס של מפרט) תוקן ב-2008 (ק"ת 6649, 24.2.2008), אבל גם בתשע"ה ובתשפ"ב.
     - (ב) דף המועצה לצרכנות **לא** מזכיר את ס' 36. ס' 36 בא מהחוק עצמו.
     - (ג) נמצא מקור חדש וחשוב: בר"ע (מחוזי י-ם) 1043/05 (השופט אוקון), "אין לייחס לקורא ידיעה על הסתייגויות או שינויים שאינם מופיעים בפרסום". ממנו נגזר הכלל: הכיתוב חייב להופיע בתוך הפריים או המסך עצמו, לא רק בפוטר.
  4. **`caption-v1.json` (ההחלטות):**
     - נבנה מ-`disclaimer-he-en.md` דרך `parseDisclaimerMd` של `tools/build_zip.mjs` (import לקריאה בלבד). לכן `he/en.short` ו-`he/en.long` זהים בייט-לבייט לנוסח שהפלטפורמה מצמידה, ו-`disclaimer-he-en.md` **לא שונה**.
     - נוספו שני וריאנטים חדשים שאף טסט עוד לא מצמיד: `short_project` (חוץ ורמת הפרויקט, בלי דירה; "על בסיס תכניות הפרויקט ... ומקורות ציבוריים") ו-`micro` (שורה קבועה בווידאו, בריל ובסימן המים של ה-equirect; לעולם לא לבד).
     - נוסף `ai_disclosure` (המשפט החותם של הנוסח הארוך, מילה במילה, ועוד הצעה ל-IPTC digitalSourceType).
     - נוספו `usage` ל-11 פלטים, `rules` (6 כללים) ו-`inventory_2026_11_02` (איפה נמצא היום כל נוסח, ומי הבעלים).
     - הקובץ נושא שתי צורות: `he/en.{short,long}` בשביל ה-Check, ו-`short/full.{he,en}` + `status` בשביל ה-loader של build_zip.
  5. **הוכחה ש-23 טוען את הקובץ בלי שינוי בקוד:** `node tools/build_zip.mjs fixtures/rainbow 846 --out <scratchpad>/zip-v1 --legal C:/RnD/Projects/Habait/data/sales-plans/legal/caption-v1.json` הסתיים ב-exit 0 (ZIP של 4.47 MB, 9.4 ש'). ב-`apartment.json` שנבנה: `legal.source` = caption-v1.json ו-status = "DRAFT v1 (2026-11-02), ממתין לחוות דעת עו״ד". ארבעת הטקסטים (short/full × he/en) זהים לבנייה החיה ב-`_local/dist/rainbow/846` (exit 0).
  6. **`lawyer-package-he.md`:** עמוד אחד על מה המוצר עושה ועל 6 ה-gates בשמם, מה כל אחד מודד והתוצאה שלו על 846. אחריו 10 שאלות ממוספרות, המקורות והנוסח המוצע, וגם 3 שינויים שאנחנו מציעים לבחון אבל לא ביצענו: "אך ורק" משמיט את חוזה המכר; "אינה מהווה הצעה" ספק אם מועיל לאור ס' 36; "מידות מקורבות" מול טענת הנאמנות. **נמדד: 3 עמודי A4** (Chrome PDF, Arial 11pt, שוליים 18/16 מ"מ; העמוד השלישי מלא בכ-67%).
  7. **החלטות T0:**
     - placeholders באותיות גדולות (`{PROJECT}`, `{PLAN_DATE}`, `{DEVELOPER}`, ובנוסף `{UNIT}` וכו'), ולא `{project}` שבכרטיס. הסיבה: `fillVars` מחליף רק `[A-Z_]`, והטקסט המוצמד כתוב באותיות גדולות. המיפוי כתוב בקובץ.
     - `id` = `ai-visualization-v1` (מחליף את `he-ai-visualization-v0` שבסכמת המנוע).
     - הנוסח הקצר והארוך לא שונו לפני חוות דעת עו"ד.
- **קבצים שנכתבו:**
  - `C:\RnD\Projects\Habait\data\sales-plans\legal\caption-v1.json` (חדש, 17.8 KB)
  - `C:\RnD\Projects\Habait\data\sales-plans\legal\lawyer-package-he.md` (חדש)
  - `C:\RnD\Projects\Habait\data\sales-plans\legal\sources.md` (נכתב מחדש: 16 מקורות, לכל אחד שורת סטטוס אחת עם תאריך, שיטה וציטוט)
  - שורה אחת תחת "העברות" ב-README של הלוח
  - הבלוק הזה
  - **לא נגעו:** `disclaimer-he-en.md`, `lawyer-checklist-he.md` (החבילה מחליפה אותו ואומרת זאת בכותרת), `Habait/**`, SESSIONS.md, memory.md.
  - **עזרים ב-scratchpad (לא תוצרים):** `scripts/make_caption_v1.mjs` (מחולל ה-JSON מה-md; להריץ מחדש אם ה-md משתנה), `scripts/md_pages.mjs` (מונה עמודים), `zip-v1/` (בניית ההוכחה), `lawyer-package-he.pdf`.
- **פלט ה-Check (מילה במילה):**
```
$ cd /c/RnD/Projects/Habait/data/sales-plans/legal && node -e "const c=require('./caption-v1.json');const ok=['he','en'].every(l=>c[l]&&c[l].short&&c[l].long);process.exit(ok?0:1)" && grep -c "אומת\|לא אומת" sources.md; echo "exit $?"
16
exit 0
# מספר המקורות: grep -c '^### S' sources.md = 16  (16 סימונים = 16 מקורות)
```
  זהות מול ה-md המוצמד (`parseDisclaimerMd`):
```
he short==md§1 true long==md§2 true build_zip view true
en short==md§1 true long==md§2 true build_zip view true
placeholders used: {UNIT} {PROJECT} {PLAN_DATE} {DEVELOPER} {ARCHITECT} {GEN_DATE} {VERSION}
exit 0
```
  הטסטים של הפלטפורמה שמצמידים את הכיתוב (`HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps`), שניהם ירוקים:
```
$ node test/landing.test.mjs          -> exit 0
ok   landing.html: the caption template equals disclaimer-he-en.md sections 1 + 2 (he + en)
...
landing test: 35/35 ok  (shots: C:/RnD/Projects/Habait/habait-walkaround/Habait/platform/_local/landing-test/shots)

$ node test/apartment.test.mjs <scratchpad>/apt-shots   -> exit 0   (36 ok, 0 FAIL)
ok   zip: README carries the full legal text (he + en), variables filled, plan date
ok   desktop: tab 3d
ok   desktop: English LTR toggle re-renders tabs and caption
ok   zip: 3d/dollhouse.html opens offline from file:// and shows the GLB  (28820 triangles, 66 meshes, 249 colours, 0 network requests)
all green; screenshots in C:/Users/elira/AppData/Local/Temp/claude/C--RnD/ab1c1ddb-4eb7-4f30-b08b-cc28a1d08a55/scratchpad/apt-shots
```
- **כסף:** $0. אין ledger. WebFetch ו-WebSearch בלבד, בלי API בתשלום ובלי `claude -p`.
- **פגמים פתוחים (לא בבעלות הכרטיס הזה, לבעלים):**
  1. **habait-1d, platform.** `Habait/platform/fixtures/rainbow/project.json` → `disclaimer` הוא כמעט מילה במילה הנוסח של residence.tech ("השטחים לפי תכניות היזם ואינם מאומתים"), והוא סותר את טענת הנאמנות.
     - הוא מוצג ב-`js/picker.js` (`.picker-disclaimer` וכרטיס הדירה, כלומר ב-flow.html ובעצירה) וב-fallback של `apartment.js`.
     - להחליף ב-`he/en.short_project` של caption-v1. `browser.mjs` בודק רק `/להמחשה בלבד/`, ולכן ההחלפה לא תשבור אותו.
  2. **habait-1d, engine.** `Habait/engine/fixtures/rainbow-846.project.json`: `legal.disclaimer_id` = `he-ai-visualization-v0`, ו-`disclaimer_he` בנוסח שלישי. להעביר ל-`ai-visualization-v1`.
  3. **habait-1d, platform.** `tools/build_zip.mjs` → `loadLegal`:
     - הקבצים שהוא מחפש לבד הם `caption.json` / `disclaimer-he-en.json` / `disclaimer.json` / `disclaimer-he-en.md`. לכן היום הוא ממשיך לקרוא את ה-md (טקסט זהה; הסטטוס נשאר "DRAFT v0"). כדי לעבור לקובץ החדש: `--legal …/caption-v1.json`, או להוסיף את השם לרשימה.
     - `fillVars` משאיר בטקסט טוקן ריק או חסר. ה-fallbacks של DEVELOPER/ARCHITECT ב-caption-v1 עוד לא ממומשים.
  4. **habait-ba (= 98).** `tour360-copy.json` (optionLine/aiNote) ו-`studio/styles/presets.json` מציגים נוסח אחר. ב-flyover3d (העצירה) לא נמצא כיתוב בכלל. מועבר כקורא שני.
  5. **לעו"ד, לא שונה:** "אך ורק" (חוזה המכר מושמט); "מידות מקורבות" מול הנאמנות; סף השטח של `plan_gate.py` (6%) מול הסטייה הקבילה בצו (2%).
  6. **תופעת לוואי:** `landing.test.mjs` כתב, כמו בכל ריצה, את התוצרים שלו (shots ו-sink של test) ל-`Habait/platform/_local/landing-test/`. לא נגעתי בקבצי מקור.
- **שאלה לאלירן (T1):** חבילת השאלות לעו"ד מוכנה: `C:\RnD\Projects\Habait\data\sales-plans\legal\lawyer-package-he.md` (3 עמודים, 10 שאלות), ולצרף אליה את `caption-v1.json` ו-`sources.md`. **למי לשלוח, ומתי?**
  - (א) אתה נותן שם עו"ד ומאשר שליחה. הסשן מכין PDF ונוסח מייל, **ואתה שולח בעצמך**.
  - (ב) רק שם עו"ד, והשליחה אחרי שער M1.
  - (ג) לא עכשיו.
  - **ברירת מחדל: החבילה מוכנה ולא נשלחת, ואף אחד לא פונה לאף אחד.** עד אז הכיתוב נשאר DRAFT, והלינקים פרטיים בלבד.
- **קורא שני:** **habait-ba (= habait-98).** הסיור שלו, הפתיחה (הסיבוב האווירי), מסך העצירה ב-:8899 והפריסה ב-Vercel מציגים היום נוסח אחר, או שאין בהם כיתוב בכלל. הנוסח המחייב לכל פלט נמצא מעכשיו ב-`C:\RnD\Projects\Habait\data\sales-plans\legal\caption-v1.json` → `usage`:
  - `short`: בפנורמות הדירה.
  - `short_project`: בסיבוב, בעצירה ובנודי החוץ.
  - בווידאו: כרטיס פתיחה של 3 ש' לפחות, ו-`micro` כשורה קבועה.
  - השורה נוספה תחת "העברות" ב-README.
- **לזיכרון:** כרטיס 30 (E3) DONE: `C:\RnD\Projects\Habait\data\sales-plans\legal\caption-v1.json` = הכיתוב האחיד v1 (קצר/ארוך זהים ל-v0 שהפלטפורמה מצמידה; חדש: short_project לחוץ, micro לשורה קבועה; usage לכל פלט; build_zip טוען בלי שינוי). `lawyer-package-he.md` (3 עמ' A4, 10 שאלות) מוכן ולא נשלח. sources: 16 (9 אומתו, 5 חלקית, 2 לא; פס"ד המעקות 2017: לאמת בנבו). $0.
