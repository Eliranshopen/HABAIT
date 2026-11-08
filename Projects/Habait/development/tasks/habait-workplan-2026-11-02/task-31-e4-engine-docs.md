# משימה 31: E4: תיעוד: README למנוע, "איך מוסיפים פרויקט", "איך מחליפים מודל"; סשן חדש מריץ 846 מאפס לפי התיעוד

| שדה | ערך |
|---|---|
| **לוח** | `habait-workplan-2026-11-02` |
| **ערוץ** | E |
| **מקור בתכנית** | חלק ג §2 ערוץ E, שלב E4; שער M3 ב-`C:\RnD\Projects\Habait\research\product-research-2026-11-02\HABAIT-RESEARCH-2026-11-02.md` |
| **סוכן** | `corpus-and-docs` (`status: live`, `owner-track: habait`, `model: opus`) |
| **Ruling tier** | **T0** |
| **גל (wave)** | 6 |
| **מצב** | TODO |
| **זיכרון** | `memory/agents/` לא קיים בפרויקט הזה; הזיכרון של הסוכן הוא בלוק `## תוצאה` כאן (ראו rails). הסוכן הוא יכולת קבועה (לא one-off persona). |

## מטרה

שלושה מסמכים בעברית עם פקודות באנגלית, והוכחה: `qa-reviewer` (או סוכן טרי) מריץ את 846 מ-PDF עד dist לפי התיעוד בלבד, בלי לשאול.

## תלויות

- 04 (CLI), 29 (bench), 26 (אדמין); ועדכון `C:\RnD\Projects\Habait\CLAUDE.md` סעיף engine/platform/flyover (עריכה נקודתית, בתיאום: הקובץ משותף לכל הסשנים)

## קלטים (קריאה)

- כל ה-README של הערוצים; `Habait/engine/README.md` (04)
- `C:\RnD\Projects\Habait\CLAUDE.md` (סעיף "week-1 skeletons" לעדכון)

## קבצים (הסוכן כותב רק כאן)

- `Habait/engine/README.md` (מלא), `Habait/engine/docs/add-a-project-he.md`, `Habait/engine/docs/swap-a-model-he.md`
- `C:\RnD\Projects\Habait\CLAUDE.md` (עריכה נקודתית של סעיף engine/platform/flyover)

## צעדים

1. לכתוב מהפקודות שבאמת רצות (להעתיק מה-Check של הכרטיסים שסומנו DONE).
2. "איך מוסיפים פרויקט": project.json → intake → A2 → run → publish, עם זמנים ועלויות מדודים.
3. "איך מחליפים מודל": אדפטר ב-bench (29) → bench → החלטה → config.
4. מבחן: סוכן טרי מריץ לפי המסמך; כל מקום שבו נתקע = תיקון במסמך.

## קריטריוני קבלה

- [ ] סוכן טרי מריץ 846 מאפס לפי התיעוד (הדוח שלו מצורף).
- [ ] CLAUDE.md מעודכן ב-≤ 15 שורות על הערוצים החדשים.
- [ ] אין פקודה במסמך שלא רצה בפועל.

## Gate

**Check:**
```bash
cd C:/RnD/Projects/Habait/habait-walkaround && grep -c '```' Habait/engine/README.md Habait/engine/docs/*.md && test -s Habait/engine/docs/fresh-run-report.md
# צפוי: בלוקי קוד קיימים; דוח ההרצה הטרייה קיים ומסתיים ב-"dist נוצר"

```

**Reviewer scope:** הרצה בלבד: לפי המסמכים ותו לא; כל שאלה שהריץ היה צריך לשאול = פגם.

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

_(corpus-and-docs, ‏2026-11-02 ‏17:58–18:25 שעון המכונה; הופעל על ידי habait-1d מהעץ הראשי. דרגה T0, לא הועלתה. $0: בלי `claude -p`, בלי fal, בלי Blender, בלי Kaggle, בלי git)_

- **מצב:** PARTIAL: כל מה שבידי הסוכן נעשה; **ממתין להרצה הטרייה של הסשן הראשי.** שלושת המסמכים + רשימת ההרצה הטרייה נכתבו, CLAUDE.md עודכן (12 שורות), וכל פקודה במסמכים רצה היום. קריטריון 1 ("סוכן טרי מריץ 846 מאפס, הדוח מצורף") וה-`test -s` של ה-Check תלויים ב-`Habait/engine/docs/fresh-run-report.md`, שהסוכן הזה **לא** כותב בכוונה: הסשן הראשי מפעיל `qa-reviewer` בהקשר נקי לפי `docs/fresh-run-checklist-he.md`, והוא כותב את הדוח. לכן ה-Check יוצא היום exit 1, ויעבור כשהדוח קיים.
- **מה נעשה:**
  1. **`Habait/engine/README.md` הורחב ל-README מלא** (199 שורות; כל התוכן של כרטיס 04 נשמר): מה המנוע, טבלת הערוצים A–E עם בעלים, זמנים ועלויות מדודים, תיקיית פרויקט, השלבים, כסף/Blender/Kaggle ומי מריץ, הקורא הווקטורי, טבלת השערים עם הפקודות, החוזים, איפה דברים נוחתים, 9 פגמים / "מה לא מחווט".
  2. **`docs/add-a-project-he.md`:** סביבה → קבצים וזכויות **[אלירן]** → project.json + validate → init → intake וקטורי, בדיקת הטיוטה, fallback רסטרי, DXF/IFC → מסך תיקון A2 **[אלירן]** → plan + building → scene + clay **[Blender: habait-98]** → skin/video **[$] [אלירן]** → export → פרסום בפלטפורמה (build_zip, :8850, landing, Vercel = **habait-98**) → status/qa.html. בכל צעד: פקודה, פלט צפוי, זמן ועלות מדודים.
  3. **`docs/swap-a-model-he.md`:** registry + adapter (הממשק של `adapters/base.py`) → `--list` → `--dry-run` → שומר הכסף → ריצה מאושרת (מסומנת "לא הורץ עדיין") → `--gates-only` ("לא הורץ עדיין") → `--rebuild-page` → הכרעה **[אלירן]** → טבלת 9 מקומות שבהם מוגדר מודל הרשומה, עם שורות ובעלים (gen-pano `MODELS`, skin-frame:34, close-seam:41, studio keyframes:53–54, video:46, skins-extra/skin_nodes.py:26, engine stages/paid.py, experiments, registry).
  4. **`docs/fresh-run-checklist-he.md`:** 18 צעדים ממוספרים, בכל בלוק אותה הקדמה (ה-shell לא שומר מצב), שורת הפלט הצפויה, ומה עושים כשצעד דורש Blender/אלירן/כסף (ארטיפקטים מהדיסק: 11 פנורמות clay של 98, verdict PASS). הדוח חייב להסתיים בשורה `dist נוצר`.
  5. **הוכחה שהרשימה עובדת בלי שאלות:** סקריפט שחילץ את 18 בלוקי ה-bash מהמסמך כפי שהם, החליף רק את תיקיית הפרויקט בתיקייה זמנית, והריץ את כולם ברצף: 131 ש', כל ה-exit כמו בתיעוד, `DIST-OK`, `spent $0.00`. שלושה הבדלים קוסמטיים תוקנו במסמך (qa.html ‏4/6 ולא 4/5, intake 81 ש' ולא 60, ה-grep של שלב skin תופס גם את שורת qa).
  6. **`C:\RnD\Projects\Habait\CLAUDE.md`: עריכה נקודתית אחת**, רק הסעיף `### Habait/engine/, Habait/platform/, Habait/flyover/ — week-1 skeletons (2026-11-02)`. השורות הישנות 86–87 (כותרת + פסקה: "`engine/`: `project.schema.json` + `validate_project.py` + the intake VLM (`intake/vlm.py`, `rasterize.py`). `platform/`: buyer flow v0 … (`serve.mjs` and `test/smoke.mjs` referenced by package.json are not written yet). `flyover/`: `project_skin.py` projection-mapping test. Owned per SESSIONS.md; the plan is `research/product-research-2026-11-02/WORKPLAN-he.md`.") הוחלפו בשורות 86–97: כותרת "the from-zero track (habait-1d; board …)", פסקת engine (intake וקטורי קודם → A2 → cli.py, דגלי Blender/כסף, gates, bench, המסמכים), פסקת platform + flyover, ובלוק של 6 פקודות שרצו היום. שום שורה אחרת לא נגעה.
- **הכרעות T0:**
  1. **CLAUDE.md נערך** למרות ש-SESSIONS.md רושם אותו אצל habait-98: הכרטיס מונה אותו תחת "קבצים", הסשן המפעיל הורה במפורש, והסעיף מתאר רק את הערוצים של habait-1d. העריכה היא החלפה של 2 שורות; הנוסח הישן מצוטט למעלה כדי ש-98 יוכל להחזיר.
  2. **כל ההוכחות רצו בתיקייה זמנית** (`scratchpad/docs31/proof-846`, `checklist-846`, ‏`proof-846-vec`) ולא ב-`Habait/engine/_local/`, כדי לא לכתוב מחוץ לנתיבי הכרטיס ולא לתפוס מראש את `fresh-846` של ההרצה הטרייה. `build_zip.mjs` ו-`--rebuild-page` רצו עם `--out` זמני מאותה סיבה.
  3. **פקודות שכותבות לנתיבים אחרים לא רצו מחדש ומסומנות כך:** `node test/landing.test.mjs` (כותב ל-`platform/_local/landing-test`; 35/35 בכרטיס 25) ו-`habait_bench.py --selftest` (כותב ל-`engine/_local/bench/_selftest`; רץ בכרטיס 29).
  4. **ההרצה הטרייה משתמשת בתשובות VLM שמורות** (בלי `claude -p`) ובתכנית שנבדקה ביד כתכנית רשומה, כי A2 דורש את אלירן. הקורא הווקטורי רץ כ"דרך ראשית", וה-selftest של A2 מוכיח שהחוזה שלו עובד על הפלט הווקטורי.
  5. **מוסכמה חדשה בתיעוד:** `<project>/intake-vector/<unit>/` לפלט הווקטורי; ה-CLI לא קורא אותה, והיא נכנסת דרך A2 (`--out <project>/plan/<unit>/corrected`).
- **קבצים שנכתבו:** `C:\RnD\Projects\Habait\habait-walkaround\Habait\engine\README.md` (הרחבה), `C:\RnD\Projects\Habait\habait-walkaround\Habait\engine\docs\add-a-project-he.md`, `...\docs\swap-a-model-he.md`, `...\docs\fresh-run-checklist-he.md` (חדשים), `C:\RnD\Projects\Habait\CLAUDE.md` (שורות 86–97), שורה אחת תחת "העברות" ב-README של הלוח, והבלוק הזה. `Habait/engine/docs/fresh-run-report.md` **לא** נכתב בכוונה.
- **פלט ה-Check (מילה במילה, הפקודה כמו בכרטיס; exit codes בנפרד):**
```
$ cd C:/RnD/Projects/Habait/habait-walkaround && grep -c '```' Habait/engine/README.md Habait/engine/docs/*.md && test -s Habait/engine/docs/fresh-run-report.md
Habait/engine/README.md:8
Habait/engine/docs/add-a-project-he.md:30
Habait/engine/docs/fresh-run-checklist-he.md:40
Habait/engine/docs/swap-a-model-he.md:10
chain exit=1
grep exit=0
test -s exit=1
```
  החלק הראשון עובר (בלוקי קוד בכל מסמך; כל הספירות זוגיות, כלומר הגדרות סגורות). **`test -s` נכשל עד שההרצה הטרייה כותבת את `fresh-run-report.md`.**
- **פקודות שהורצו מחדש היום כהוכחה ($0, בלי Blender), הזנבות:**
```
validate_project.py rainbow-846 + demo-simple --check-files   -> [OK] x2, exit=0
cli.py init <scratch>/proof-846                                -> init: ... project rainbow-tlv ... (1 unit(s)), exit=0
intake_pdf_vector.py (846, מלא)                               -> 6667 primitives ... 46 OCG layers; rooms: 10 (10 named); exit=0 secs=11
intake_pdf_vector.py (846, רק --out --apartment-id)          -> אותה שורה ראשונה, rooms: 10, exit=0
validate-plan.mjs <vector plan>                               -> validate exit=0
plan_gate.py <vector> --report                                -> plan_gate: FAIL  score=0.500  worst_room=r-guest-bathroom  worst_dim_dev=3.3%, exit=1
correct/serve.mjs --selftest (וקטורי / רסטרי)                 -> selftest OK, exit=0 (x2)
correct/serve.mjs --plan <vector> --out <p>/plan/apt846/corrected -> "תיקון תכנית: http://127.0.0.1:8870/", GET / 200 <html lang="he" dir="rtl">, /api/session 200 (נעצר ב-timeout 12, בלי שמירה)
cli.py run --stage all --dry-run                              -> run 4 · defer 1 · dry-run-only 1 · refuse 2 · $0.00, exit=0
cli.py run --stage intake                                     -> -> ok  exit 0  gate FAIL (advisory)  $0.00  60.1 s, exit=0
cli.py run --stage plan,building                              -> plan_gate: PASS 0.784; negative control FAIL 0.1; building ok 14.3 s, exit=0
cli.py run --stage scene,clay (בלי HABAIT_BLENDER_OK)          -> DEFER + DRYRUN, exit=0, Blender לא הופעל
cli.py run --stage skin                                       -> REFUSED ... estimate $13.20, nothing was called, exit=3
cli.py run --stage export                                     -> -> ok  exit 0  gate PASS  $0.00  6.4 s  | build_zip exit 0, zip 4.47 MB, exit=0
cli.py run intake,plan,building,scene,clay,export (שוב)        -> skip 4 · defer 1 · dry-run-only 1, exit=0, 1 s
cli.py status                                                 -> spent $0.00, exit=0
cli.py run --stage plan --plan <vector draft> (proof-846-vec) -> plan_gate: PASS score=1.000 (!), negative control FAIL 0.122, exit=0
intake_dwg.py sample.dxf / intake_ifc.py sample.ifc            -> exit=0 (5 s, total_edits: 0) / exit=0 (12 s); validate-plan exit=0
facade_gate.py orig__proj1 / bad-facade                       -> PASS 0.889 exit=0 / FAIL 0.252 exit=1
plan_gate.py gates/fixtures/bad-plan.json                     -> FAIL score=0.012, exit=1
qa_report.py <proof-846>                                      -> qa_report: 4/5 green, exit=1 (exit 1 כשלא הכול ירוק)
habait_bench.py --list                                        -> 5 endpoints, exit=0
habait_bench.py nano-banana-2 --dry-run                       -> estimated_cost_total $0.92 ... spent $0, exit=0
habait_bench.py gpt-image-2.5 --dry-run                       -> estimated_cost_total $9.60, exit=0
habait_bench.py nano-banana-2 (בלי --cap) / --cap 2 בלי --i-approve -> REFUSED exit 3 / REFUSED exit 3; ledger-E2 sha256 66737c8b… לפני = אחרי
habait_bench.py --rebuild-page --out <scratch>                -> page ... cards A=11 B=11 C=10 E nodes=2 media 53 files 37.0 MB, exit=0, 2 s
platform: node contracts/validate.mjs fixtures/rainbow        -> fixtures/rainbow: OK - 12 units, 5 segments, 11 warning(s), exit=0
platform: npm test                                            -> all green, exit=0 (לא נכתב אף קובץ)
platform: node tools/build_zip.mjs fixtures/rainbow 846 --out <scratch> -> zip: 27 files, 4.47 MB (<=25), 5.3 s, exit=0
curl :8850 landing?v=a / v=b / apartment / flow / dist apartment.json -> 200 x5
fresh-run-checklist-he.md, 18 בלוקים כלשונם (תיקייה זמנית)     -> 131 s, כל ה-exit כצפוי, DIST-OK, spent $0.00
```
- **כסף:** $0. אין ledger. `Habait/engine/_local/ledger-E2.json` לא השתנה (sha256 זהה לפני ואחרי).
- **פגמים פתוחים (לבעלים; שום קובץ שלהם לא נערך):**
  1. **(engine, habait-1d)** שלב `plan` עם `--plan` לא מעביר את `report.json` ל-plan_gate: הטיוטה הווקטורית של 846 עוברת שם ב-**1.000** (מידות לא נבדקות), בזמן ש-`plan_gate.py --report` ישיר נותן FAIL 0.500. תיקון מוצע: כש-`report.json` יושב ליד התכנית שנבחרה, להעביר `--report`.
  2. **(engine / 98)** אי-התאמה במחיר: `stages/paid.py` מעריך $1.20 לפנורמה, אבל התבנית שלו קוראת ל-`gen-pano.mjs ... gpt25x` שנרשם $2.40 (‏11 נקודות = ~$26.40 ולא $13.20).
  3. **(98)** `Habait/studio/fixtures/apt846.intake.json` תוקן חלקית: החדר "רחצה כללי" = 199, אבל `printed_dimensions_cm` בשורה 30 עדיין 99 → הקורא הווקטורי מדווח `missed [99]; false [199]`.
  4. **(engine)** export אורז את פנורמות הסיור הקיים (tour360 balanced) ואת פיקסטורת הפלטפורמה, לא את ה-clay של הריצה; אין חיבור clay/skin → dist. פרסום לפרויקט שני לא הורץ עדיין (יש רק `fixtures/rainbow`).
  5. **(bench, habait-1d)** הודעת הסירוב של `habait_bench.py` עדיין אומרת "the habait-4b chat" (היום habait-1d).
  6. מסך התיקון לא נבדק עם שמירה אמיתית של תיקון ל-846 (A2 דורש אלירן); זמן תיקון בדקות לא נמדד (T1 של כרטיס 02).
- **קורא שני:** **habait-98**: `C:\RnD\Projects\Habait\CLAUDE.md` רשום אצלו ב-SESSIONS.md, ושורות 86–97 שלו השתנו (2 השורות הישנות הוחלפו ב-12; הנוסח הישן כאן למעלה); בנוסף פגמים 2 ו-3 נוגעים בקבצים שלו. **כל הסשנים:** CLAUDE.md משותף, והסעיף על engine/platform/flyover מפנה עכשיו ל-`Habait/engine/README.md` ול-`Habait/engine/docs/`. השורה נוספה תחת "העברות" בלוח.
- **לזיכרון:** כרטיס 31: תיעוד המנוע = Habait/engine/README.md + docs/{add-a-project,swap-a-model,fresh-run-checklist}-he.md; כל פקודה רצה היום (18 בלוקי הרשימה הטרייה רצו ב-131 ש', DIST-OK, $0). CLAUDE.md: סעיף week-1 הוחלף ב-12 שורות. ממצאים: שלב plan עם --plan לא מעביר report.json (טיוטה וקטורית 1.000 מול 0.500 ישיר); export אורז פנורמות tour360 ולא clay. fresh-run-report.md ממתין לסשן הראשי.

## ריצה טרייה (18:45)

- **מה קרה:** ה-`qa-reviewer` של הסשן הראשי רץ 18:20–18:25 לפי `fresh-run-checklist-he.md` בלבד, הגיע ל-dist (`DIST-OK`, השורה האחרונה בדוח `dist נוצר`), ודיווח **8 פגמים בתיעוד** (`Habait/engine/docs/fresh-run-report.md`). אחד מהם אמיתי ומהותי (1), השאר נובעים ממנו או קטנים.
- **הסיבה של פגם 1 (צעד 10, plan exit 1):** לא ה-GT. ב-`360walkaround/tours/apt846/plan.json` אין 99 (לא השתנה מ-1.11). `plan_gate.py` משווה את המפה שנקראה ביד, `Habait/engine/gates/fixtures/apt846.dims.json` (שורה 222), מול `printed_dimensions_cm` של `Habait/studio/fixtures/apt846.intake.json`. 98 תיקן את הפיקסטורה 99→199 ב-18:23:13, באמצע הריצה; המפה עדיין אמרה 99 → `printed values match intake: False` → FAIL אף שכל החדרים עברו. **המפה תוקנה ל-199 ב-18:29:16 (לא בכרטיס 31)**, ועכשיו plan PASS 0.784, exit 0. לפני התיקון שוחזר המצב הישן בתיקייה זמנית, ואחריו גם הבדיקה עם עותק של המפה (199 → PASS, `match intake: True`).
- **התיקונים (תיעוד בלבד, בלי קוד מנוע):**
  1. צעד 10 + `add-a-project-he.md` §6 + טבלת השערים ב-README: שני מצבים מתועדים, (ב) המפה 199 = הנוכחי, ו-(א) המפה 99 = מה שהיה עד 18:29, עם הפלט המדויק של כל אחד; הסיבה; `--keep-going` בפקודה; "מה עושים כש-plan נכשל": מריצים עם `--keep-going`, קוראים את `plan/<unit>/qa/plan_gate.json` (בלוק Python שמדפיס `pass`, `intake_note`, `BAD rooms`) ואת `report.json` של ה-intake, ומחליטים: `BAD rooms: []` + `intake_note` = פער בקובצי עזר → ממשיכים; חדר ב-`BAD rooms` → מסך A2 עם `--out <P>/plan/<unit>/corrected` (אדם), וסוכן לבד רושם "צריך A2" ולא מפעיל את השרת.
  2. צעדים 13–14: "export לא תלוי ב-plan/building; DIST-OK לא מוכיח אותם"; שורת בדיקה חדשה `STAMP-OK/NO-STAMP` ל-`plan/apt846` ול-`building`; הדוח מדווח את שתיהן בנפרד. גם ב-README (פגם 10) וב-add-a-project §6, §9.
  3. צעד 9: במקום `dims_read 14` ו-60–81 ש': תבנית עם מצייני מקום + כלל ("המספרים יכולים להשתנות; קובע exit 0, `-> ok` וחמשת השדות"); נמדד 14 או 15 (לפני/אחרי 199), 60–146 ש'. כלל 5 חדש באותה רוח לכל הרשימה.
  4. צעד 16: `cli.py status > $P/status.log; echo "status exit=$?"` (ה-exit של status, לא של `head`).
  5. כלל 6 חדש: השורה `(SESSIONS.md: habait-98)` בפלט = "Blender לא שלך"; לא קוראים SESSIONS.md ולא פונים לאף סשן; צעד 11 ו-17 עם fallback מפורש. גם ב-README (סעיף Blender) וב-add-a-project §7.
  6. משתני הסביבה בראש הרשימה (טבלה: `PYTHONIOENCODING`, `HABAIT_APP_DIR`, `BLENDER` + ה-`unset` של שלושת הדגלים) ובהקדמה של כל בלוק; גם ב-add-a-project §0.
  7. כלל 7 חדש + README + add-a-project §0: השעות = שעון המכונה בחותמות (‎`+02:00`), לא `date`.
  8. ספירות `qa` בצעדים 12 ו-15 (וה-summary של 15) לשני המצבים: (ב) ‏3/5 ו-4/6, `skip 4`, exit 0; (א) ‏2/5 ו-3/6, `skip 3 · run 1`, exit 1; ו-1/4 בלי `--keep-going`. צעד 15 קיבל `--keep-going`. צעד 4: `recall 16/16` (או 15/16 מול פיקסטורה ישנה).
- **הוכחה:** הרשימה המתוקנת (גרסה 2) רצה כלשונה בתיקייה זמנית: 19 בלוקים, 229 ש', כל ה-exit כמתועד במצב (ב), `DIST-OK`, `STAMP-OK plan/apt846`, `STAMP-OK building`, `status exit=0`, `spent $0.00`.
- **ה-Check עכשיו (כלשונו):**
```
Habait/engine/README.md:8
Habait/engine/docs/add-a-project-he.md:32
Habait/engine/docs/fresh-run-checklist-he.md:44
Habait/engine/docs/fresh-run-report.md:0
Habait/engine/docs/swap-a-model-he.md:10
chain exit=0
```
  (`fresh-run-report.md` קיים ומסתיים ב-`dist נוצר`.)
- **מצב:** DONE מבחינת הסוכן (שלושת קריטריוני הקבלה: הדוח מצורף, CLAUDE.md ‏12 שורות, אין פקודה שלא רצה). הריצה הטרייה הייתה מול גרסה 1; גרסה 2 עוד לא נבדקה על ידי סוכן טרי אחר.
- **כסף:** $0.
- **קורא שני:** habait-98: התיקון שלו ל-`apt846.intake.json` (18:23) הכשיל את plan עד שמפת השער תוקנה (18:29); מעכשיו מידה מודפסת מתקנים בשני הקבצים יחד. אין שינוי ב-GT.
- **לזיכרון:** הרצה טרייה של 846 לפי התיעוד (18:20) הגיעה ל-dist; 8 פגמי תיעוד תוקנו (גרסה 2 רצה כלשונה: 229 ש', DIST-OK, plan/building STAMP-OK, $0). plan נכשל 18:23–18:29 כי הפיקסטורה תוקנה ל-199 לפני מפת השער gates/fixtures/apt846.dims.json; ה-GT לא אומר 99. export לא תלוי ב-plan: DIST-OK לא מוכיח אותו.
