# משימה 26: D4: אדמין קל: סטטוס/מחיר לכל דירה מ-Google Sheet → build של units.json

| שדה | ערך |
|---|---|
| **לוח** | `habait-workplan-2026-11-02` |
| **ערוץ** | D |
| **מקור בתכנית** | חלק ג §2 ערוץ D, שלב D4 ב-`C:\RnD\Projects\Habait\research\product-research-2026-11-02\HABAIT-RESEARCH-2026-11-02.md` |
| **סוכן** | `platform-dev` (`status: live`, `owner-track: habait`, `model: opus`) |
| **Ruling tier** | **T1** |
| **גל (wave)** | 5 |
| **מצב** | TODO |
| **זיכרון** | `memory/agents/` לא קיים בפרויקט הזה; הזיכרון של הסוכן הוא בלוק `## תוצאה` כאן (ראו rails). הסוכן הוא יכולת קבועה (לא one-off persona). |

## מטרה

אלירן משנה סטטוס דירה (פנוי/שמור/נמכר) ומחיר ב-Google Sheet בלי Claude; `build_units.mjs` מושך את הגיליון (CSV publish או Apps Script JSON), ממזג לתוך units.json (bbox/polygons נשארים מ-03/19), מריץ ולידציה, ומעדכן את ה-dist. T1: איזה Sheet (אלירן יוצר; ברירת מחדל: CSV מקומי `_local/units-status.csv` עד אז).

## תלויות

- 03 (units.json), 24 (Apps Script / Sheet של אלירן)

## קלטים (קריאה)

- 03, 19, 21 (מה לא נוגעים בו: bbox, polygons)
- `Habait/platform/contracts/units.schema.json`

## קבצים (הסוכן כותב רק כאן)

- `Habait/platform/build_units.mjs`, `Habait/platform/_local/units-status.csv` (fixture)
- `Habait/platform/test/build_units.test.mjs`
- `Habait/platform/README.md` (סעיף "איך משנים סטטוס" בעברית)

## צעדים

1. מקור: URL של CSV מפורסם או קובץ מקומי; עמודות: unit, status, price, note.
2. מיזוג: רק status/price/note מתעדכנים; שאר השדות נשמרים; ולידציה; גיבוי של הגרסה הקודמת.
3. הוראות בעברית לאלירן: 3 שורות.

## קריטריוני קבלה

- [ ] שינוי בשורת 846 ב-CSV → units.json מעודכן, bbox/polygons ללא שינוי (diff).
- [ ] ערך סטטוס לא חוקי → FAIL ברור בעברית, הקובץ הישן נשמר.
- [ ] ולידציה עוברת.

## Gate

**Check:**
```bash
cd C:/RnD/Projects/Habait/habait-walkaround/Habait/platform && timeout 120 node test/build_units.test.mjs
# צפוי: "846 status updated; bbox unchanged; invalid status rejected", exit 0
```

**Reviewer scope:** אי-פגיעה בשדות הגיאומטריה בלבד.

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

_(מילא platform-dev, סשן מפעיל habait-1d, 2026-11-02 ~18:05 שעון המכונה)_

- **מצב:** DONE. הכלי, הטסט, ה-CSV וה-README מוכנים. T1: השאלה לאלירן למטה. ברירת המחדל (ג) כבר עובדת, ושום דבר לא מחכה לתשובה חוץ מה-URL.
- **מה נעשה:**
  - `build_units.mjs --source <csv | https published-CSV | Apps Script JSON | .json> --units <units.json> [--out] [--dist] [--dry-run]`: ממזג **רק** status/price/note לכל דירה. הקובץ לא נכתב מחדש: שלושת טווחי הערכים מוחלפים בתוך הטקסט המקורי, וכל בייט אחר נשאר (box_world, outline_world, hotspots/polygons, סדר מפתחות, indent 1 של Python, CRLF, ‏`\u` escapes). לפני כתיבה יש ולידציה עם `contracts/validate.mjs` (סכמת units.v0, ועוד cross-check מול flow.json כשהוא יושב ליד הקובץ). אחר כך גיבוי `<file>.bak-YYYYMMDD-HHMMSS` (נשמרים 10 אחרונים) וכתיבה אטומית (tmp + rename).
  - כל השגיאות מדווחות יחד, בעברית, עם מספר שורה ודירה: סטטוס לא מוכר, מחיר לא מספר או שלילי, דירה כפולה, אין כותרת, הגיליון לא פורסם (HTML), HTTP, רשת, https בלבד. במקרה כזה exit 1 והקובץ לא נוגע. דירה שלא קיימת = אזהרה ו-exit 0. שימוש שגוי = exit 2. ‏`--dist` מעדכן רק `unit.status`/`unit.price` ב-`apartment.json` (אחד, או בכל תיקיית משנה), בלי גיבוי בתוך ה-dist כדי ש-.bak לא ייפרס.
  - **הכרעות (T0 בתוך הכרטיס):**
    1. **אין שינוי סכמה.** ב-units.v0 כבר יש enum ל-status ‏(`for-sale|sold|reserved|unknown`). לכן `available`/`פנוי`/`פנויה`/`למכירה` → `for-sale`; ‏`reserved`/`שמור`/`שמורה` → reserved; ‏`sold`/`נמכר`/`נמכרה` → sold. ניקוד ורישיות לא משנים.
    2. **מחיר:** מספר שלם בשקלים. ‏`₪7,950,000.00` → 7950000; ‏`לפי בקשה` → 0.
    3. **תאים ריקים והערה:** תא ריק = בלי שינוי, ו-`-` מוחק הערה. משפט `box_source: …;` של המנוע בתחילת הערה נשמר כשהגיליון מחליף אותה.
    4. **מזהים:** ‏`846` בגיליון תואם גם ל-`apt846` (קובץ המנוע), אם אין התאמה מדויקת.
    5. **קידוד:** קובץ ASCII נשאר ASCII (עברית נכתבת כ-`\u`).
    6. **עמודות:** מזוהות לפי שם (גם `דירה/סטטוס/מחיר/הערה`), בכל סדר. עמודות נוספות ושורת כותרת-על מעל הכותרת מותרות.
  - **הקובץ החי `fixtures/rainbow/units.json` לא שונה.** ה-CSV שסופק משקף אותו בדיוק, כך שהרצה עליו לא משנה כלום (נבדק ב-dry-run, כולל `--dist _local/dist/rainbow`).
- **קבצים שנכתבו:** `Habait/platform/build_units.mjs` (חדש), `Habait/platform/_local/units-status.csv` (חדש, UTF-8 עם BOM כדי שהעברית תיפתח נכון ב-Excel, 12 שורות בסטטוסים בעברית), `Habait/platform/test/build_units.test.mjs` (חדש), `Habait/platform/README.md` (נוסף בסוף רק הסעיף "איך משנים סטטוס": 3 שורות לאלירן + 4 הערות טכניות), שורה אחת תחת "העברות" ב-README של הלוח. הסכמה, `validate.mjs`, הפיקסטורה, ה-dist, המנוע וה-flyover לא נגעו (קבצי המנוע וה-dist הועתקו לתיקייה זמנית בלבד, וה-mtime שלהם לא השתנה).
- **פלט ה-Check (מילה במילה):**
```
$ cd C:/RnD/Projects/Habait/habait-walkaround/Habait/platform && timeout 120 node test/build_units.test.mjs; echo "exit=$?"
ok   status aliases: English + Hebrew -> the units.v0 enum; anything else -> null  (17 aliases)
ok   prices: integer ILS from sheet formats; bad values rejected  (9 formats)
ok   CSV: BOM, CRLF, quotes, commas/newlines inside quotes, Hebrew headers, title row, extra columns  (title row skipped, columns by name)
ok   JSON (Apps Script) shapes: rows[], values[][], bare array; ok:false is an error
ok   note: the machine "box_source: ...;" clause is recognised
ok   the shipped CSV fixture parses: 12 rows, Hebrew statuses, in sync with fixtures/rainbow/units.json  (פנוי/נמכר/שמור)
ok   846 row changed in the CSV -> engine units.json copy: status/price/note updated, geometry byte-for-byte  (box_world 12/12 identical, 3 lines differ, backup units.json.bak-20261102-180528)
ok   a sheet note keeps the machine box_source clause of a stacked unit
ok   geometry-rich units.json (box_world, outline_world, polygons): replace + insert + clear a note, deep diff 0, validate.mjs OK  (12 outlines + 26 polygons identical; validate.mjs 12 units, 5 segments, 0 errors)
ok   invalid status -> Hebrew FAIL, exit 1, units.json bytes unchanged, no backup  (FAIL: סטטוס לא מוכר "maybe-later" בשורה 2 (דירה 846). מותר: פנוי / שמור / נמכר, או available / reserved / sold.)
ok   all bad cells are reported at once (status + price), nothing written
ok   duplicate unit row / no header / missing source -> FAIL exit 1; no --units -> usage exit 2
ok   an invalid units.json (fails the schema before the merge) is refused, not written
ok   unknown unit id in the sheet -> warning, exit 0, the other rows applied
ok   Apps Script JSON source (local .json mock) -> applied
ok   URL sources through an injected fetch (no network): published CSV, Apps Script JSON, unpublished HTML, http, network error  (dry-run; 0 real requests)
ok   --dist: apartment.json gets unit.status + unit.price only (note, legal, everything else unchanged)  (copy of _local/dist/rainbow/846; 2 lines differ)
ok   no-op: the shipped CSV against a fixture copy -> exit 0, "אין שינוי", no backup, bytes unchanged
ok   --out writes elsewhere (input untouched); --dry-run writes nothing
ok   backups: one per write, named <file>.bak-<YYYYMMDD-HHMMSS>, the newest 10 kept  (10 kept)
build_units test: 20/20 ok
846 status updated; bbox unchanged; invalid status rejected
exit=0
```
  ובנוסף `npm test` (הזנב, exit 0; ‏validate: `fixtures/rainbow: OK - 12 units, 5 segments, 11 warning(s)`, smoke 12/12):
```
ok   picker: module loads in node and exports createPicker
ok   server: index, flow, three.js module, json
ok   server: CORS * on .js/.css/.json (habait-89 imports js/picker.js from another origin)
ok   server: Range -> 206 with Content-Range
ok   server: 404 and traversal
ok   server: events sink mounted (card 24): announced, Origin required, empty batch writes nothing

all green
npm_test_exit=0
```
- **כסף:** $0. אין ledger, אין קריאות רשת: בטסט `globalThis.fetch` מוחלף ב-stub שזורק, וה-URL נבדק דרך fetch מוזרק.
- **פגמים פתוחים:**
  1. **עותקים של הסטטוס שלא מתעדכנים לבד:**
     - `Habait/flyover/turntable/_local/turntable.json` (כרטיס 21) אופה `status` לכל hotspot ב-72 פריימים מתוך units.json של המנוע. צריך להריץ מחדש את `turntable.py`, או שהצרכן יקרא status מ-units.json לפי unit.
     - ה-`unit.json` שבתוך ה-ZIP של ה-dist נשאר ישן עד `tools/build_zip.mjs`.
     - העותק ב-Vercel (98) סטטי, ולכן צריך פריסה מחדש.
  2. **אי-התאמה בין המנוע לפיקסטורה:** ב-`Habait/engine/_local/rainbow/units.json` המחיר של `apt846` הוא 0, ובפיקסטורה ובגיליון 7,950,000 (מחיר מומצא). dry-run של ה-CSV על קובץ המנוע מראה שינוי אחד (מחיר 0 → 7,950,000). לכן יעד ההרצה הרגיל הוא `fixtures/rainbow/units.json`, ועל קובץ המנוע מריצים רק בכוונה.
  3. **גיבויים ב-git:** הגיבויים `units.json.bak-*` נכתבים ליד הקובץ. ב-`fixtures/rainbow/` הם יופיעו כקבצים לא-מנוטרים, כי אין להם שורה ב-.gitignore (הקובץ לא שלי). מוצע: `Habait/platform/fixtures/**/*.bak-*`.
  4. **אפשרות (ב) דורשת עבודה נוספת:** צריך ענף `doGet` ב-`apps-script/lead-to-sheet.gs` שקורא לשונית Units. זה שובר את ההבטחה של כרטיס 24 ("הסקריפט לא קורא כלום מהגיליון") ודורש deploy מחדש. לא נעשה.
  5. **עיכוב ב-Google:** CSV מפורסם של Google מתעדכן בעיכוב של כ-5 דקות.
  6. **אין טריגר אוטומטי:** מישהו צריך להריץ פקודה אחת (או משימה מתוזמנת בעתיד). ב-README, בסעיף "Known gaps (v0)", עדיין כתוב "no admin (D4)". רק הוספתי בסוף ולא נגעתי בזה, ו-1d יכול למחוק.
  7. **לא רלוונטי לכרטיס הזה:** בדיקות viewport לטלפון וכיתוב משפטי. אין כאן UI, רק קובץ נתונים. `test/browser.mjs` לא הורץ כי שום קוד דפדפן לא השתנה.
- **שאלה לאלירן (T1):** "מאיפה לקחת את הסטטוס והמחיר של הדירות?
  **(א) Google Sheet שתיצור ותפרסם כ-CSV (ההמלצה שלי):**
  1. ב-https://sheets.new יוצרים קובץ **נפרד** מהלידים, בשם "Habait סטטוס דירות". שורה ראשונה: `unit, status, price, note`, ושורה לכל דירה. אפשר לייבא את `_local/units-status.csv` דרך קובץ ← ייבוא ← העלאה.
  2. קובץ ← שיתוף ← פרסום באינטרנט. בוחרים את הגיליון עצמו (לא "המסמך כולו") ואת הפורמט "ערכים מופרדים בפסיקים (‎.csv)" ← פרסום.
  3. מעתיקים את הקישור (נגמר ב-`output=csv`) ושולחים בצ'אט של habait-1d.

  **(ב)** אותו גיליון דרך ה-Apps Script של הלידים (JSON). זה דורש שינוי בסקריפט ו-deploy חדש, והסקריפט יתחיל לקרוא מהגיליון.
  **(ג)** להישאר עם הקובץ המקומי `_local/units-status.csv`.

  ברירת מחדל עד שתענה: (ג)."
- **קורא שני:** habait-98 (habait-ba). ה-picker ב-:8899 ופריסת Vercel habait-flow קוראים status/price מ-`Habait/platform/fixtures/rainbow/units.json`, שמעכשיו נכתב על ידי `build_units.mjs`. הערכים נשארים units.v0, ואין שינוי חוזה. מה זה מחייב אותו:
  - אחרי כל עדכון סטטוס צריך פריסה מחדש (העותק סטטי).
  - `turntable.json` (כרטיס 21) לא מתעדכן לבד.
  - השורה נוספה תחת "העברות" ב-README של הלוח.
- **לזיכרון:** כרטיס 26 (D4) DONE: `Habait/platform/build_units.mjs --source <CSV|קישור CSV מפורסם|Apps Script JSON> --units <units.json> [--dist]` משנה רק status/price/note (splice, שאר הבייטים זהים), ולידציה ב-validate.mjs, גיבוי .bak-<ts>, סטטוס לא חוקי = FAIL בעברית exit 1. פנוי/שמור/נמכר → for-sale/reserved/sold, בלי שינוי סכמה. מקור עד הכרעת אלירן: `_local/units-status.csv`. $0.
