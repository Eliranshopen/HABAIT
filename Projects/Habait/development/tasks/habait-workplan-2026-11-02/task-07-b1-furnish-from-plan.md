# משימה 07: B1: ריהוט מהתכנית: fixtures מ-plan.json + templates לפי סוג חדר, בלי placements ידניים

| שדה | ערך |
|---|---|
| **לוח** | `habait-workplan-2026-11-02` |
| **ערוץ** | B |
| **מקור בתכנית** | חלק ג §2 ערוץ B, שלב B1; חלק א §11.3 ב-`C:\RnD\Projects\Habait\research\product-research-2026-11-02\HABAIT-RESEARCH-2026-11-02.md` |
| **סוכן** | `blender-scene` (`status: live`, `owner-track: habait`, `model: opus`) |
| **Ruling tier** | **T0** |
| **גל (wave)** | 4 |
| **מצב** | TODO |
| **זיכרון** | `memory/agents/` לא קיים בפרויקט הזה; הזיכרון של הסוכן הוא בלוק `## תוצאה` כאן (ראו rails). הסוכן הוא יכולת קבועה (לא one-off persona). |

## מטרה

חמישה חדרים של 846 מרוהטים אוטומטית: מה שמצויר בתכנית המכר (מטבח, אי, מיטות, ארונות, כלים סניטריים) נקרא מ-`plan.json` כ-fixtures ומוצב; מה שלא מצויר בא מ-templates לפי סוג חדר (`placement_templates.py` הקיים, 53 placements). בלי placements ידניים לדירה. ה-clay "נראה נכון" בעין, עם כללי העיצוב של אלירן (zero-line, בלי פנלים, בלי פוגות).

## תלויות

- 01 (plan.json עם fixtures מהתכנית); תיאום עם habait-16 (הוא מחזיק `build_scene.py`, `general_furnish.py` עם שינויים לא-committed, ואת Blender)

## קלטים (קריאה)

- `360walkaround/pipeline/{build_scene.py,general_furnish.py,placement_templates.py,SCHEMA.md,GENERAL-POLYGONS.md}` (קריאה; לא לערוך את שני הראשונים בלי אישור 16 בכתב)
- `360walkaround/tours/apt846/plan.json` (19 fixtures)
- קטלוג CC0: `360walkaround/catalog/` (57 רהיטים)
- פלט 01

## קבצים (הסוכן כותב רק כאן)

- `360walkaround/pipeline/furnish_from_plan.py` (מודול חדש; נקרא מ-build_scene דרך דגל שהסוכן מציע ל-16, לא מוסיף בעצמו)
- `Habait/engine/_local/apt846/furnish/{placements.json,preview-*.png}`

> **Blender:** לפי SESSIONS.md כלל 4, רק habait-16 מריץ Blender מקומית. הסוכן כותב את הסקריפט, מריץ `--dry-run`/selftest בלי Blender אם אפשר, ומבקש מהסשן המפעיל להעביר את ההרצה ל-16 (SendMessage) או ל-Kaggle (כרטיס 18). ההרצה בפועל של ה-Check נרשמת בבלוק התוצאה עם מי הריץ.

## צעדים

1. למפות כל `fixture` בסכמה → נכס בקטלוג (או פרימיטיב בגודל נכון אם אין), עם כיוון מהקיר הקרוב.
2. חדרים בלי fixtures: templates לפי סוג חדר, עם בדיקת חפיפה לפתחים (דלת לא חסומה) ולמסלול הליכה.
3. להפיק placements.json שאפשר להזין ל-build_scene הקיים (אותו פורמט של 53 ה-placements), ו-preview PNG מלמעלה לכל חדר (matplotlib, בלי Blender).
4. למסור ל-habait-16 בקשה לרנדר EEVEE draft של cp-living ו-cp-kitchen (הוא מריץ Blender); לצרף את הפריימים לתוצאה.

## קריטריוני קבלה

- [ ] 5 חדרים (סלון, מטבח, שינה ראשי, שינה 2, אמבטיה) מרוהטים מ-placements.json בלי עריכה ידנית.
- [ ] אף רהיט לא חוסם פתח (נבדק גיאומטרית ב-selftest).
- [ ] פריימי ה-draft (מ-16) נראים "נכון" לעין; פגמים נרשמים ברשימה.
- [ ] `build_scene.py` ו-`general_furnish.py` לא נערכו על ידי הסוכן.

## Gate

**Check:**
```bash
cd C:/RnD/Projects/Habait/habait-walkaround && export PYTHONIOENCODING=utf-8 && PY=/c/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe && timeout 300 $PY 360walkaround/pipeline/furnish_from_plan.py --plan 360walkaround/tours/apt846/plan.json --out Habait/engine/_local/apt846/furnish --selftest
# צפוי: "rooms furnished: 5+", "openings blocked: 0", exit 0; preview PNG לכל חדר
```

**Reviewer scope:** גיאומטריה בלבד: רהיטים בתוך פוליגון החדר, לא חוסמים פתחים, גדלים ריאליים (מיטה 160–200 ס"מ).

הבודק (אם נדרש) הוא `qa-reviewer` בהקשר נקי, לא הסשן שביצע.

## כסף

$0 מקומית (רנדרי בדיקה קצרים ב-EEVEE דרך habait-16); Kaggle דרך 17ב אם צריך

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

- **מצב:** PARTIAL: הקוד, ה-Check (exit 0), התצוגות המקדימות ו-smoke build DONE. קריטריון הקבלה השלישי (פריימי EEVEE draft של cp-living ו-cp-kitchen מ-98) עדיין פתוח; יש פריים Cycles זעיר אחד של cp-living, שנראה נכון (פירוט למטה).
- **ריצות Blender (כולן אחרי שהסשן המפעיל הודיע ש-Blender פנוי, ואחרי `tasklist | grep -i blender.exe` נפרד וריק לפני כל אחת; הכול על עותק תחת `Habait/engine/_local/apt846/furnish/scene-test/`: `manifest.json` + `plan.furnished.json` כ-`plan.json`; שום דבר ב-`tours/` לא השתנה):**
  1. `build_scene.py scene-test/plan.json --out scene-test/scene.blend --door-style zero-line --skirting off --material-board none`: exit 0, 11.5 ש'. **192/192 בדיקות גאומטריה**, 57 placements מהקטלוג (24 מודלים), 5 הרכבות פרוצדורליות, 4 דלתות פנים. camera clearance 8/11: אותן 3 נקודות כמו ב-v1.5 הידני (cp-terraceBedroom, cp-bathMain, cp-bathguest), מדווח ולא נכשל. **`build_scene.py` צורך את `plan.furnished.json` בלי שינוי קוד.**
  2. `render_pano.py --point cp-living --res 512x256 --samples 8 --device CPU`: exit 1 תוך 0.7 ש', פעמיים. `--wrap-pad` ברירת מחדל 512 מחוץ לטווח לרוחב 512, וה-footer של הסקריפט בולע את ההודעה.
  3. אותו דבר עם `--wrap-pad 64`: exit 0, 6.2 ש' → `scene-test/cp-living/pano.webp`, ותצוגה מוגדלת `pano-preview-1024.png`.
  - סה"כ כ-19 ש' Blender.
  - **בעין:** ספה מול יחידת TV עם טלוויזיה, שולחן קפה על שטיח, כורסה, מטבח עם ארונות עליונים ומקרר, שולחן אוכל, מנורת רצפה ליד הזכוכית, עציץ, תמונה על הקיר, קונסולה בכניסה. דלתות flush בלי משקוף. לא נראה פריט שחוסם פתח או נכנס לקיר.
- **מה נעשה (habait-4b, 2.11):**
  - מודול חדש `360walkaround/pipeline/furnish_from_plan.py` (v0.1.0): Python טהור בחלק התכנון, כך שהוא רץ גם בתוך Blender. מייבא את `general_furnish` ו-`plan_general` לקריאה בלבד; shapely ו-Pillow משמשים רק ל-audit ולתצוגות.
  - **ממצא שקבע את הצורה:** `build_scene.py` לא קורא קובץ placements. הוא מריץ `general_furnish.plan_furnishing()` על `plan.fixtures[]` ועל ההרחבה `plan.furnishing` (`fixture_hints`, `doors`, `pieces[]`). 53 ה-placements של 846 המרוהטת באו מ-`furnishing` שנקרא ביד מהתכנית (`tours/apt846-furnished/plan.json`), לא מ-`placement_templates.py`. התבניות ב-`placement_templates.py` מלבניות ולא רצות על תכנית general.
  - לכן המודול כותב בדיוק את שני השדות האלה, לפי כלל ובלי אף מיקום ידני:
    1. fixtures מהתכנית עוברים כמו שהם. חדר שחסר לו fixture שהתפקיד שלו דורש מקבל fixture מ-template באותה סכמה (`source: "template:..."`, `rule`), על wall run שנמדד מהקירות: ריצת מטבח + עמודה, מיטה (+ ארון אם אין חדר ארונות צמוד), אסלה, כיור ומקלחת, ספה + TV + שולחן קפה (ובמקרה שאין קיר TV מתאים: ספה עם הגב לקיר הפנוי הארוך), שולחן אוכל. `island` הופך ל-counter שפונה לריצה.
    2. **fit:** כל fixture שנבנה ונכנס לקיר (דגימה צפופה של 1 ס"מ; `general_furnish` דוגם רק פינות ורבעים) מוצב מחדש על המלבן שנבנה, בחיפוש מדויק של הזזה ≤ 25 ס"מ וקיצוץ ≤ 35% לריצות (20% לכיור).
    3. `fixture_hints`: הכיור במרכז הריצה הארוכה; הכיריים במרכז הריצה השנייה; ארונות עליונים רק כשמאחורי הריצה קיר מלא, בלי זכוכית בטווח 25 ס"מ. על 846 זה משחזר בדיוק את ההחלטה הידנית: k-counter עם עליונים, k-counter-2 בלי.
    4. `pieces[]` לפי תפקיד החדר, מעוגנים על התוצאה הפתורה: שטיח מתחת לשולחן הקפה, מנורה בקצה הספה, תמונה, עציץ; בכניסה קונסולה + תמונה + שטיחון; שטיח לרגלי המיטה; שטיחון אמבטיה; במרפסת סט ישיבה + 2 עציצים. כל פריט נבחר כמועמד החוקי הראשון ברשימה מדורגת ודטרמיניסטית, ומסומן `keep:false`, כך ש-`general_furnish` זורק פריט במקום להחזיק אותו בכוח.
  - **audit עצמאי:** פתח חסום = מעבר פנוי קצר מ-min(רוחב−4, 80) ס"מ באזור גישה של 60 ס"מ מכל צד, או כנף דלת שפוגעת ברהיט ב-0–90°. בנוסף נבדקים: פריטים שחותכים קיר או זכוכית (shapely, 1.5 ס"מ; פריט קיר עד 3 ס"מ), פריט מחוץ לחדר שלו, גדלים לא ריאליים, כיסוי רצפה, ושביל של 50 ס"מ מהמצלמה לכל פתח (מדווח בלבד).
  - **selftest:** 5 קבוצות. toy בלי מפתח `fixtures`; שתי ביקורות שליליות שמוכיחות שה-audit יודע לומר לא (ארון מול דלת, ארון בתוך מחיצה); island; התכנית האמיתית עם שערים ודטרמיניזם; ו-846 עם ה-fixtures מחוקים (סובלנות לפלט של כרטיס 01, שהוא היום `fixtures: []`).
- **תוצאה על 846:**
  - 10/11 חדרים מרוהטים. חמשת חדרי היעד (סלון, מטבח, 2 חדרי שינה, אמבטיה) כולם מרוהטים.
  - 62 פריטים: 49 מהתכנית (27 fixtures + 22 נגזרים) ו-13 מ-template.
  - **0 פתחים חסומים מתוך 13, 0 חיתוכי קיר**, 0 פריטים מחוץ לחדר, 0 חריגות גודל. מיטות 180×210 ו-160×200.
  - כיסוי רצפה 27.4%. דטרמיניסטי (hash של בלוק `furnishing` זהה בשתי ריצות).
  - `plan.furnished.json` עובר `validate-plan.mjs` עם exit 0 ואותן 28 אזהרות כמו המקור (אחת השתפרה: bg-shower 3→2 פינות).
  - גרסת "בלי fixtures": 12 fixtures מ-template, 10 חדרים, 45 פריטים, 0 חסומים, 0 קירות.
- **הכרעות T0 (נרשמות כאן):**
  - (א) הפלט הוא `placements.json`, ובו `fixtures` (הרשימה המלאה לשימוש) ו-`furnishing`, שני השדות ש-build_scene צורך היום, ובנוסף `resolved` (תוצאת general_furnish) ו-`fixtures_adjusted`. לצדו `plan.furnished.json` מוכן לבנייה בלי שינוי קוד.
  - (ב) **אין שדה סכמה חדש:** `fixtures[]` כבר קיים (SCHEMA §2, Q02b; enum כולל `island`). כרטיס 01 צריך לפלוט אותו. המפתחות `source`/`rule`/`translated_from` הם תוספת שה-validator ו-general_furnish מתעלמים ממנה.
  - (ג) מותר להציב מחדש fixture מהתכנית, בגבולות שלמעלה, כשהוא חותך קיר. כל שינוי מדווח. ב-846 שונו 4: b2-closet 200→173.5 ס"מ (19.5 ס"מ ממנו היו בקיר החיצוני), w-closet-1 160→144 (כולל הקיצוץ של general_furnish עצמו), bg-shower 140→118, bg-vanity 80→71.5.
  - (ד) בגבול open-plan רחב מותר להכניס פריט template רק אם נשאר מעבר ≥ max(80, 60% מהרוחב). בין שתי מרפסות: 80.
  - (ה) שטיחים נמנעים מגזרת הכנף בפועל (הצד שאליו הדלת נפתחת), לא משני צדי הדלת.
  - (ו) אין הוצאה ואין קריאות גנרטיביות.
- **קבצים שנכתבו:**
  - `C:\RnD\Projects\Habait\habait-walkaround\360walkaround\pipeline\furnish_from_plan.py` (חדש)
  - `C:\RnD\Projects\Habait\habait-walkaround\Habait\engine\_local\apt846\furnish\`: `placements.json`, `plan.furnished.json`, `report.json`, `preview-<room>.png` ×11 + `preview-all.png`, `no-fixtures/preview-all.png`, `scene-test/` (`plan.json`, `manifest.json`, `scene.blend`, `scene.report.json`, `build_scene.log`, `render_cp-living.log`, `cp-living/`)
  - הכרטיס הזה ושורה אחת תחת "העברות" ב-README של הלוח.
  - **לא נגעתי ב-** `build_scene.py`, `general_furnish.py`, `placement_templates.py` ו-`tours/**`.
- **פלט ה-Check (מילה במילה, exit 0; ריצה ב-17:5x שעון המכונה בזמן שה-Blender של 98 רץ. ניסיון קודם נכנס ל-`timeout 300` (exit 124) תחת אותו עומס, ולכן הוספתי raster של הקירות: ריצה אחת ירדה מ-169 ל-20 ש' עם תוצאה זהה):**
```
furnish_from_plan.py v0.1.0 (general_furnish v0.1.1)
plan  C:\RnD\Projects\Habait\habait-walkaround\360walkaround\tours\apt846\plan.json
style C:\RnD\Projects\Habait\habait-walkaround\360walkaround\catalog\style-habait-modern.json
out   C:\RnD\Projects\Habait\habait-walkaround\Habait\engine\_local\apt846\furnish
selftest 1: a toy plan with NO fixtures key (card 01's intake today) is furnished from templates
  [PASS] template fixtures: bed, kitchen run, WC, vanity (['bed', 'counter', 'shower', 'vanity', 'wardrobe', 'wc'])
  [PASS] all 3 toy rooms furnished (['r-bed', 'r-kit', 'r-bath'])
  [PASS] toy: openings blocked [], wall hits []
  [PASS] general_furnish derives nightstands from the template bed
selftest 2: negative controls - the audit can say NO
  [PASS] a cabinet parked in front of door d-1 is caught (['d-1'])
  [PASS] a cabinet straddling a partition is caught as a wall hit
selftest 3: an island (schema enum, no general_furnish rule) becomes a counter fronting the run
  [PASS] island built as a counter facing the run (yaw 0.0)
selftest 4: the real plan C:\RnD\Projects\Habait\habait-walkaround\360walkaround\tours\apt846\plan.json
roles      r-entrance=entrance, r-kitchen=kitchen, r-dining=dining, r-living=living, r-terrace-living=terrace, r-terrace-bedroom=terrace, r-bedroom-main=bedroom, r-wardrobe=wardrobe, r-bath-main=bathroom, r-bedroom-2=bedroom, r-bath-guest=bathroom
phase 1    template fixtures for rooms whose role lacks a drawn one
  (none: every room's role is covered by the plan's own fixtures)
phase 1b   fit: re-seat any built fixture that cuts a wall (dense 1 cm samples)
  fit w-closet-1   [420, 1405] [160, 60] -> [429.42, 1408.35] [144.01, 60.01]: slid +2 cm along its axis (17 cm2 in a wall)
  fit b2-closet    [500, 405] [200, 60] -> [509.98, 403.6] [173.51, 60.01]: trimmed 19.5 cm at -L, 0.0 cm at +L; moved -2 cm across it (743 cm2 in a wall)
  fit bg-shower    [490, 492] [140, 90] -> [479.48, 484.36] [118.0, 90.01]: slid -1 cm along its axis (128 cm2 in a wall); slid -1 cm along its axis (61 cm2 in a wall)
  fit bg-vanity    [395, 642] [80, 50] -> [397.44, 631.41] [71.5, 50.01]: trimmed 0.0 cm at -L, 8.5 cm at +L (136 cm2 in a wall)
phase 2    fixture hints (sink, hob, uppers)
  hint k-counter    {"uppers": true, "sink_at_cm": [731.0, 523.5]} (back probes: 7/7 in a wall, 0/7 within 25 cm of glass; sink: the centre of the longest run)
  hint k-counter-2  {"uppers": false, "hob_at_cm": [895.0, 459.0]} (back probes: 0/7 in a wall, 0/7 within 25 cm of glass; hob: the centre of the second run)
phase 3    template pieces per room role
  piece ffp-entrance-console           tv_unit     at (234,889) yaw 100 - a 120x40x75 console (no console class: the TV cabinet) on the longest legal wall run
  piece ffp-entrance-art               wall_art    at (214,886) yaw 100 - centred on a wall run (166 cm), bottom 120 cm
  piece ffp-entrance-doormat           bath_mat    at (266,724) yaw 103 - inside the entrance door o-12, 32 cm in
  piece ffp-living-rug                 rug         at (763,1011) yaw 200 - 240x170 under the coffee table, along the sofa
  piece ffp-living-lamp                floor_lamp  at (948,929) yaw 200 - beside the sofa, at the end farther from the openings
  piece ffp-living-art                 wall_art    at (560,1114) yaw 19 - centred on a wall run (460 cm), bottom 120 cm
  piece ffp-living-plant               plant       at (348,1042) yaw 0 - a free wall station, farthest from the openings
  piece ffp-terrace-living-set         outdoor_set at (1282,637) yaw 109 - the legal spot farthest from the terrace openings, along the terrace's axis
  piece ffp-terrace-living-plant-1     plant       at (1370,749) yaw 0 - a convex terrace corner, far from the openings
  piece ffp-terrace-living-plant-2     plant       at (1155,1040) yaw 0 - a convex terrace corner, far from the openings
  piece ffp-bedroom-main-rug           rug         at (732,1374) yaw 20 - 240x170 under the lower bed, 40 cm past its foot
  piece ffp-bath-main-mat              bath_mat    at (279,1266) yaw 20 - in front of the shower
  piece ffp-bedroom-2-rug              rug         at (682,313) yaw 126 - 240x170 under the lower bed, 40 cm past its foot
  r-entrance         entrance    6.25 m2  items   3 (plan  0, template  3)  floor   7.3%  walk 4/4
  r-kitchen          kitchen    10.37 m2  items  16 (plan 16, template  0)  floor  25.8%  walk 2/2
  r-dining           dining      8.95 m2  items   4 (plan  4, template  0)  floor  21.3%  walk 1/2 (unreached o-3)
  r-living           living     31.05 m2  items  10 (plan  6, template  4)  floor  17.8%  walk 5/5
  r-terrace-living   terrace    15.71 m2  items   3 (plan  0, template  3)  floor  15.3%  walk -
  r-terrace-bedroom  terrace     2.98 m2  items   0 (plan  0, template  0)  floor   0.0%  walk -
  r-bedroom-main     bedroom    12.19 m2  items   7 (plan  6, template  1)  floor  33.9%  walk 2/2
  r-wardrobe         wardrobe    5.13 m2  items   2 (plan  2, template  0)  floor  32.1%  walk 3/3
  r-bath-main        bathroom    4.47 m2  items   5 (plan  4, template  1)  floor  55.2%  walk 1/1
  r-bedroom-2        bedroom     9.31 m2  items   8 (plan  7, template  1)  floor  48.6%  walk 1/1
  r-bath-guest       bathroom    3.38 m2  items   4 (plan  4, template  0)  floor  45.0%  walk 1/1
  opening o-1   opening        435.9 cm  free  308.0 / need  80.0  swing -           ok  zone: ffp-entrance-console
  opening o-2   opening        219.7 cm  free  202.0 / need  80.0  swing -           ok  zone: k-counter-m6,k-tall
  opening o-3   opening        420.5 cm  free   84.0 / need  80.0  swing -           ok  zone: d-table,d-table-chair-4,k-counter-2-m1,k-counter-2-m2
  opening o-4   opening        251.5 cm  free  114.0 / need  80.0  swing -           ok  zone: d-table
  opening o-5   opening        187.6 cm  free  186.0 / need  80.0  swing -           ok  zone: ffp-terrace-living-plant-2
  opening o-6   door            93.8 cm  free   92.0 / need  80.0  swing clear       ok  zone: -
  opening o-7   opening        179.3 cm  free  178.0 / need  80.0  swing -           ok  zone: -
  opening o-8   opening        161.1 cm  free  132.0 / need  80.0  swing -           ok  zone: w-closet-2
  opening o-9   door            66.6 cm  free   64.0 / need  62.6  swing clear       ok  zone: bm-shower
  opening o-10  door            93.6 cm  free   92.0 / need  80.0  swing clear       ok  zone: -
  opening o-11  door            60.9 cm  free   60.0 / need  56.9  swing clear       ok  zone: -
  opening o-12  entrance_door  110.9 cm  free  110.0 / need  80.0  swing -           ok  zone: -
  opening o-13  door           131.9 cm  free  130.0 / need  80.0  swing -           ok  zone: -
  dropped by general_furnish: d-table-chair-1 (5.6 cm from camera cp-dining (bar 25))
rooms furnished: 10 of 11
items placed: 62 (from plan: 49 = 27 fixtures + 22 derived; from template: 13 = 13 + 0 derived)
openings blocked: 0 of 13
items intersecting walls: 0
items outside their room: 0
size violations: 0
floor coverage: 27.4% of the indoor floor
  [PASS] the five target rooms are furnished: {'living': 1, 'kitchen': 1, 'bedroom': 2, 'bathroom': 2}
  [PASS] rooms furnished: 10 >= 5
  [PASS] openings blocked: 0
  [PASS] items intersecting walls: 0
  [PASS] items outside their room: []
  [PASS] size violations: []
  [PASS] beds realistic: [('bm-bed', 180.0, 210.0), ('b2-bed', 160.0, 200.0)]
  [PASS] every template piece survives general_furnish's own checks (13 pieces, dropped [])
  [PASS] every piece carries its rule (no hand-read position)
  [PASS] a preview PNG per furnished room (10) + preview-all.png
  [PASS] deterministic: two runs give the same furnishing block (9e76f7c0971e)
selftest 5: the same plan with its fixtures REMOVED (tolerance; reported, gated on blocked/walls only)
  no-fixtures variant: 12 template fixtures (t-kitchen-counter, t-dining-table, t-living-sofa, t-bedroom-main-bed, t-wardrobe-closet, t-bath-main-shower, t-bath-main-wc, t-bath-main-vanity, t-bedroom-2-bed, t-bedroom-2-closet, t-bath-guest-wc, t-bath-guest-vanity); rooms furnished 10; items 45; blocked []; wall hits []; floor 18.6%
  [PASS] no-fixtures variant still furnishes 5+ rooms
  [PASS] no-fixtures variant: openings blocked []
  [PASS] no-fixtures variant: wall hits []
selftest: 0 failure(s)
exit 0
```
- **כסף:** $0. אין ledger.
- **פגמים פתוחים:**
  1. פריימי EEVEE draft של cp-living ו-cp-kitchen ברזולוציה אמיתית (קריטריון 3) לא רונדרו; רק פריים Cycles אחד של 512×256. הפקודה בהעברה ל-98 למטה (`scene-test/scene.blend` כבר בנוי).
  1א. **כלל עיצוב:** כנפי דלתות הפנים מרונדרות ב-`wood_oak` (חומר הכנף של general_furnish גם ב-zero-line), לא בקרם של אלירן (§6). הקובץ של 98, ולא נגעתי.
  2. bg-vanity מצויר בתכנית ב-36° מול קיר שנמצא בערך ב-10°, ולכן המראה תעמוד מרוחקת מהקיר בקצה אחד. זו אמת של התכנית, לבדיקה בעין.
  3. המרפסת הקטנה (2.98 מ"ר) נשארה ריקה: אין נקודה חוקית לכורסה שגם משאירה 80 ס"מ ב-o-7 וגם לא נוגעת בזכוכית. באמבטיית האורחים אין שטיחון (כנף o-11 וקירות). בפינת האוכל אין תמונה (אין קיר מגבה). תמונת הסלון יושבת על קיר ה-TV, משמאל ל-TV. כל אלה לבדיקה בעין.
  4. d-table-chair-1 נזרק על ידי general_furnish (5.6 ס"מ מ-cp-dining). בפינת האוכל אין שביל של 50 ס"מ אל o-3 (השולחן וריצת המטבח מהתכנית). שני אלה קיימים גם בגרסה הידנית.
  5. ה-audit בודק מול פוליגוני הקיר. ה-facings של build_scene (שפת הלולאה, 2–5 ס"מ לפני הקיר) לא ממודלים: פריט יכול להיכנס עד 5 ס"מ מאחורי הפנים הנראים של הקיר, כמו ב-general_furnish.
  6. island→counter נבדק רק על toy (ב-846 אין אי). בגרסה בלי fixtures הסלון מקבל ספה בלבד מה-fallback (בלי קיר TV), ולא נבדק בעין.
- **קורא שני:** habait-98. הוא מחזיק את `build_scene.py`, את `render_tour.mjs`, את Blender ואת apt846, והחיבור הוא שלו. ההצעה (לא הוחלה על ידי):
```diff
--- 360walkaround/pipeline/build_scene.py
@@ def build(args, log):
     plan = json.load(open(args.plan, encoding="utf-8"))
+    if args.furnishing:   # card 07: furnish_from_plan.py placements.json (rule-made fixtures + furnishing, no hand placements)
+        _ffp = json.load(open(args.furnishing, encoding="utf-8"))
+        plan["fixtures"], plan["furnishing"] = _ffp["fixtures"], _ffp["furnishing"]
@@ def main(argv):
     ap.add_argument("--general-furnish", choices=["on", "off"], default="on",
+    ap.add_argument("--furnishing", default=None,
+                    help="placements.json from furnish_from_plan.py: replaces plan fixtures[] + furnishing")
```
  - אם הדגל נכנס, `render_tour.mjs` צריך להוסיף את ה-sha256 של קובץ ה-`--furnishing` למפתח הטריות של הסצנה.
  - **בלי שינוי קוד בכלל (נבדק: 192/192):** `build_scene.py Habait/engine/_local/apt846/furnish/plan.furnished.json --out <copy>/scene.blend --door-style zero-line --skirting off --material-board none`. אחר כך EEVEE draft של cp-living ו-cp-kitchen מעותק של תיקיית הסיור, לא ב-`tours/apt846`. ב-`render_pano.py` ברזולוציה נמוכה צריך `--wrap-pad` < רוחב.
  - כנפי הדלתות ב-`wood_oak` ולא בקרם (פגם 1א).
  - זה מחייב אותו כי הוא הבעלים של build_scene ושל Blender; בלי הדגל או הבנייה, כרטיס 07 לא נכנס לסצנה. בנוסף, 4 ה-fixtures שהוצבו מחדש משנים את הגאומטריה של 846 מול ה-scene של 2.11.
- **לזיכרון:** כרטיס 07: `360walkaround/pipeline/furnish_from_plan.py` מרהט תכנית general בלי מיקומים ידניים (fixtures מהתכנית או template, hints וחלקים לפי סוג חדר, דרך general_furnish). ב-846: 10/11 חדרים, 62 פריטים (49 תכנית/13 template), 0 פתחים חסומים, 0 חיתוכי קיר, 4 fixtures הוצבו מחדש. החיבור ל-build_scene (`--furnishing` או `plan.furnished.json`) נבדק: 192/192 בבנייה. הרנדר המלא אצל 98. $0.
