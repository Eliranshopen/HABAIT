# משימה 05: A6: gates חדשים: plan_gate (מידות), facade_gate (חזית בריחוף), דוח qa.html

| שדה | ערך |
|---|---|
| **לוח** | `habait-workplan-2026-11-02` |
| **ערוץ** | A |
| **מקור בתכנית** | חלק ג §2 ערוץ A, שלב A6; memory.md §7 (לקח ה-edge-PSNR) ב-`C:\RnD\Projects\Habait\research\product-research-2026-11-02\HABAIT-RESEARCH-2026-11-02.md` |
| **סוכן** | `engine-builder` (`status: live`, `owner-track: habait`, `model: opus`) |
| **Ruling tier** | **T0** |
| **גל (wave)** | 2 |
| **מצב** | TODO |
| **זיכרון** | `memory/agents/` לא קיים בפרויקט הזה; הזיכרון של הסוכן הוא בלוק `## תוצאה

- **מצב:** DONE. שלושת קריטריוני הקבלה עומדים, עם שתי מגבלות שנמדדו ונרשמו למטה ולא הוסתרו. הריצה: סוכן engine-builder, ‏2.11. נקטעה פעם אחת על מגבלת 5 השעות והמשיכה מאותה נקודה.
- **מה נעשה:**
  - **plan_gate.py** (גנרי: plan.json + `--report`/`--dims` + `--intake`). הבדיקה היא לכל חדר בנפרד, וציון התכנית הוא החדר הגרוע ביותר. כך חדר אחד שזז לא מתחבא מאחורי עשרה טובים. ארבע מחלקות:
    - **walls:** דגימות על קצוות החדר שסומנו `wall`. ההיסט החתום מפני הקיר חייב להיות בתוך [‎-2, +7] ס"מ. החציון ב-846 הטוב הוא 3.2 ס"מ (קו המחסום של ה-tracer). דרישה: kept ≥ 0.6.
    - **neighbours:** חדרים לא חופפים. דגימה עמוקה מ-2 ס"מ בתוך חדר אחר נספרת כחפיפה. ב-846 הטוב יש 0 דגימות חופפות ב-11 חדרים. דרישה: kept ≥ 0.9.
    - **area:** a×b המודפס מול שטח הלולאה, עד 6% (שתי צלעות של 3%).
    - **dims:** מיתר מפני קיר לפני קיר, מקביל לקו המידה, עד 3%.
  - **מיפוי 16 המידות** (`fixtures/apt846.dims.json`, נקרא בעין מהגיליון):
    - 9 מידות חדר: 342/275 חדר שינה; 744 מטבח+אוכל+סלון לאורך החזית (בשרשרת עם 344); 344/348 חדר הורים; 212/210 רחצת הורים; 160 ארונות; 270 עומק המרפסת.
    - 7 לא נבדקות, לפי הסוג שלהן בשרטוט: 822 ו-1213 מידות חיצוניות כוללות; 474 פתח חילוץ; 140/99 תא מקלחת; 185 עומק נישת ארון; 530 (הקו מתחיל בקצה המחיצה ולא בקיר).
    - הערכים זהים בדיוק ל-16 שב-`apt846.intake.json`, וה-gate בודק את זה.
  - **הכרעת T0: מחלקת המידות חוסמת רק כשקווי המידה מגיעים מ-report.json של כרטיס 01. עם המפה הידנית היא "לידיעה" בלבד.**
    - נוסו 4 כללי מדידה: (1) התווית כעוגן; (2) תווית + הצמדה לכיוון הקיר; (3) קצוות שנקראו + חציון ±20 ס"מ + הארכה עד פני הקיר; (4) הצד של הקו שרחוק ממרכז החדר.
    - אף כלל לא יציב: בין 3/9 ל-6/9 בתוך 3%, וכל כלל מכשיל חדרים אחרים.
    - **הסיבה (ממצא):** ה-tracer של 846 הכניס את קווי המידה עצמם למסכת המחסום, ולכן הלולאות "חתוכות" בדיוק לאורכם. על הקו עצמו המיתר חריג ב-5 מתוך 6 קווים. בצד אחד של הקו הוא משחזר את המודפס: 342←343, ‏275←280, ‏344←346, ‏160←165, ‏270←270.
    - מחלקת השטח לא תלויה במיקום הקו, והיא עוברת ב-3/3 (‎-1.0%, +1.8%, +0.3%).
  - **ממצא שני:** `Habait/engine/_local/apt846/plan-crop.png` (ה-crop של ה-intake) **לא רשום** ל-plan.json. הלולאות יושבות רק על `tour360/apartments/apt846/_local/plan/plan-crop.png` (‏3750×3900, ‏2.25 px/cm). גם ה-sha256 של אף אחד משני הקבצים לא תואם ל-`plan_meta.source_sha256`.
  - **facade_gate.py** (גנרי: footprint + project.json + מצלמה מ-projectors.json או מ-views.json):
    - מטיל את הפריזמה דרך מצלמת ה-Blender של `project_skin.py` (look-at, ‏sensor fit HORIZONTAL). הפריזמה היא ה-footprint מהקרקע עד הגג. הקומות מגיעות מ-`floor_to_floor_cm`, `floors_total` ו-`ground_floor_index`, וקומה 16 יושבת ב-Z 0.
    - שתי מחלקות: **silhouette** (קו המתאר הצדדי) ו-**slabs** (קווי הרצפה הגלויים, לפי id-buffer בשיטת painter).
    - קצה Canny נספר רק אם הוא בכיוון הנכון (±30°) ובתוך r = f·1.5 m/depth. ה-1.5 מ' נגזר מגלי המסה (1.4 מ').
    - PASS = min(kept) ≥ 0.6 **וגם** שיא יישור: אותן דגימות, כשמזיזים אותן הצידה ב-±20/30/40 px, חייבות לקבל ציון נמוך יותר מאשר במקומן.
    - תנאי השיא נוסף אחרי שה-selftest הראה ש-yaw ‎-2° קיבל 0.604: חזית צפופה מתאימה לקצוות כמעט בכל מקום. זה תנאי מבני ולא סף, ואף מספר לא כוון.
  - **qa_report.py:** אוסף כל JSON שיש בו `gate` בתיקיית ריצה ומפיק `qa.html` בעברית: RTL, טבלה אחת, ירוק/אדום, קישור לקלט, ל-overlay ול-JSON (‏file:///). קלט מתוך `gates/fixtures/` הוא בקרה שלילית, והיא ירוקה כשהיא נכשלת. נבדק ב-Edge headless: ‏8/8 ירוקים, 6/6 תמונות נטענות, 0 שגיאות, dir=rtl.
  - **כוח הבחנה (selftests):**
    - **plan:** הזזה של כל חדר ב-10 ס"מ ב-4 כיוונים. **34/44 נתפסו.** ה-10 שפוספסו הן הזזות בזווית חדה לקירות הדומיננטיים (10 ס"מ ב-x הם כ-3 ס"מ ניצב לקיר של 18°, ברמת הרעש של ה-trace), או חדרים עם מעט קירות (dining והמרפסות).
    - **facade על orig__proj1:** גוון +80°, כהה ×0.7 ורעש σ=6 עוברים. yaw ‏+2° נכשל (0.252, ‏margin ‎-0.639). yaw ‏‎-2° נכשל (0.604, ‏margin ‎-0.292).
    - **שטח מת שנמדד: pitch 2° ו-roll 2° עוברים (0.851 ו-0.759).** פסי הקומות חוזרים כל כמה px והצדדים אנכיים, ולכן הזזה אנכית או הטיה של עד 9 px לא נראות.
    - **זוויות שהוחזקו בצד** (4 זוויות שלא שימשו בתכנון, proj1+proj2): ‏8/8 עוברים, עם margin בין ‏+0.16 ל-+0.36. yaw ±2 נכשל בכולן, עם margin בין ‏‎-0.20 ל-‎-0.64.
    - clay לא מולבש חלש יותר (az+60 clay = 0.235, נכשל). ה-gate מיועד לפריימים מולבשים.
  - `validate-plan.mjs` מחזיר **exit 0 על bad-plan.json**, כלומר החדר שהוזז לא נראה לו. plan_gate מכשיל אותו.
- **פערי ציון (הדרישה: ≥ 0.2):**
  - plan_gate: טוב 0.784 מול רע 0.012, פער **0.772**.
  - facade_gate: טוב 0.889 מול רע 0.252, פער **0.637**.
- **קבצים שנכתבו** (שורש ה-worktree: `C:\RnD\Projects\Habait\habait-walkaround\.claude\worktrees\board-habait-workplan`):
  - `Habait/engine/gates/plan_gate.py`, `facade_gate.py`, `qa_report.py`, `fixtures/apt846.dims.json`.
  - `fixtures/bad-plan.json`: ‏r-bedroom-2 הוזז ב-+10 ס"מ ב-x, דרך `plan_gate.py --make-bad`.
  - `fixtures/bad-facade.png`: ‏orig__proj1 אחרי homography של yaw ‏+2°, דרך `facade_gate.py --make-bad`.
  - דרך ה-junction לעץ הראשי: `Habait/engine/_local/apt846/v1/qa.html` ותיקיית `v1/qa/` (8 קובצי JSON ו-6 overlays). תיקיית המשנה נועדה למנוע התנגשות עם plan.json ו-report.json של כרטיס 01.
  - שום דבר מחוץ לאלה. נבדק שאין `__pycache__` ב-`tools/bench/site846`.
- **פקודת ה-Check המותאמת:** רצה משורש ה-worktree. תכנית ה-GT של 846 נכנסת במקום v1, שעוד לא קיים. ‏`--report` לא קיים ולכן ה-gate נופל למפה. נוסף `--project` בשביל גבהי הקומות.
```
cd C:/RnD/Projects/Habait/habait-walkaround/.claude/worktrees/board-habait-workplan && export PYTHONIOENCODING=utf-8 && PY=/c/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe && $PY Habait/engine/gates/plan_gate.py 360walkaround/tours/apt846/plan.json --report Habait/engine/_local/apt846/v1/report.json; echo good=$?; $PY Habait/engine/gates/plan_gate.py Habait/engine/gates/fixtures/bad-plan.json --report Habait/engine/_local/apt846/v1/report.json; echo bad=$?; $PY Habait/engine/gates/facade_gate.py Habait/flyover/renders/orig__proj1.png --camera Habait/flyover/projectors.json --footprint /c/RnD/Projects/Habait/tools/bench/site846/tower-footprint.json --project Habait/engine/fixtures/rainbow-846.project.json; echo good=$?; $PY Habait/engine/gates/facade_gate.py Habait/engine/gates/fixtures/bad-facade.png --camera Habait/flyover/projectors.json --footprint /c/RnD/Projects/Habait/tools/bench/site846/tower-footprint.json --project Habait/engine/fixtures/rainbow-846.project.json; echo bad=$?
```
- **פלט ה-Check (מילה במילה):**
```
plan_gate: PASS  score=0.784  worst_room=r-bath-guest  worst_dim_dev=41.0%
  ok  r-entrance         score=0.959 walls=0.959 nbrs=1.0 
  ok  r-kitchen          score=1.0 walls=1.0 nbrs=1.0 744->770.9(+3.6%)
  ok  r-dining           score=1.0 walls=- nbrs=1.0 
  ok  r-living           score=1.0 walls=1.0 nbrs=1.0 
  ok  r-terrace-living   score=1.0 walls=1.0 nbrs=1.0 270->268.9(-0.4%)
  ok  r-terrace-bedroom  score=1.0 walls=1.0 nbrs=1.0 
  ok  r-bedroom-main     score=0.931 walls=0.931 nbrs=1.0 area +1.8% 344->355.6(+3.4%) 348->318.0(-8.6%)
  ok  r-wardrobe         score=0.896 walls=0.896 nbrs=1.0 160->148.9(-6.9%)
  ok  r-bath-main        score=0.898 walls=0.898 nbrs=1.0 area +0.3% 212->125.1(-41.0%) 210->214.4(+2.1%)
  ok  r-bedroom-2        score=0.982 walls=0.982 nbrs=1.0 area -1.0% 342->267.2(-21.9%) 275->279.8(+1.7%)
  ok  r-bath-guest       score=0.784 walls=0.784 nbrs=1.0 
  unchecked printed dims: 530:partial, 185:sub_element, 140:sub_element, 99:sub_element, 474:opening, 822:overall, 1213:overall
  printed values match intake: True
good=0
plan_gate: FAIL  score=0.012  worst_room=r-bedroom-2  worst_dim_dev=41.0%
  ok  r-entrance         score=0.959 walls=0.959 nbrs=1.0 
  ok  r-kitchen          score=0.959 walls=1.0 nbrs=0.959 744->770.9(+3.6%)
  ok  r-dining           score=1.0 walls=- nbrs=1.0 
  ok  r-living           score=1.0 walls=1.0 nbrs=1.0 
  ok  r-terrace-living   score=1.0 walls=1.0 nbrs=1.0 270->268.9(-0.4%)
  ok  r-terrace-bedroom  score=1.0 walls=1.0 nbrs=1.0 
  ok  r-bedroom-main     score=0.931 walls=0.931 nbrs=1.0 area +1.8% 344->355.6(+3.4%) 348->318.0(-8.6%)
  ok  r-wardrobe         score=0.896 walls=0.896 nbrs=1.0 160->148.9(-6.9%)
  ok  r-bath-main        score=0.898 walls=0.898 nbrs=1.0 area +0.3% 212->125.1(-41.0%) 210->214.4(+2.1%)
  BAD r-bedroom-2        score=0.012 walls=0.012 nbrs=0.767 area -1.0% 342->273.7(-20.0%) 275->269.6(-1.9%)
  ok  r-bath-guest       score=0.784 walls=0.784 nbrs=1.0 
  unchecked printed dims: 530:partial, 185:sub_element, 140:sub_element, 99:sub_element, 474:opening, 822:overall, 1213:overall
  printed values match intake: True
bad=1
facade_gate: PASS  score=0.889  silhouette=0.889 (866)  slabs=0.967 (2730)  peak_margin=+0.278  camera=approach
good=0
facade_gate: FAIL  score=0.252  silhouette=0.252 (866)  slabs=0.808 (2730)  peak_margin=-0.639  camera=approach
bad=1
```
  - מידות בשורות "ok" עם סטייה מעל 3% הן במצב "לידיעה", כפי שהוכרע למעלה. הן לא חוסמות עד ש-report.json יספק קווי מידה.
  - qa_report: ‏`qa_report: 8/8 green -> Habait/engine/_local/apt846/v1\qa.html` (exit 0).
- **כסף:** $0. אין קריאות בתשלום ואין ledger. Blender לא הורץ.
- **פגמים פתוחים:**
  1. מחלקת המידות לא חוסמת עד ש-report.json (כרטיס 01) יכיל `dimensions[]` עם `value_cm, kind, rooms, a_cm, b_cm` ב-frame של plan.json, ועד שה-tracer יוציא את קווי המידה ממסכת המחסום.
  2. facade_gate עיוור ל-pitch ול-roll של 2° (הזזה אנכית או הטיה). התיקון: מחלקת "ראש המגדל", שדורשת גובה גג או כתר ב-project.json. היום אין שדה כזה: הכתר של 3 מ' קיים רק ב-tower_mass.py. הוצע לבעלים.
  3. plan_gate תופס 34/44 הזזות של 10 ס"מ. הזזה של 5 ס"מ או פחות ניצב לקיר נמצאת מתחת לרצפת הרעש של ה-trace.
  4. `camera.json` של כרטיס 15 לא קיים. projectors.json ו-views.json מספקים את כל מה שצריך (pos, look, lens_mm, sensor_mm). camera.json בפורמט `{"frames":[…]}` עדיין לא נתמך.
  5. `validate-plan.mjs` לא רואה חדר שהוזז (exit 0 על bad-plan.json).
- **קורא שני:** habait-ab, הבעלים של `Habait/engine/**`, של הסכמה ושל כרטיס 01:
  - (א) report.json של כרטיס 01 צריך `dimensions[]` בפורמט של `gates/fixtures/apt846.dims.json`. אחרת מחלקת המידות נשארת "לידיעה".
  - (ב) ה-tracer חייב להוציא את קווי המידה ממסכת המחסום. ב-846 הם חותכים את הלולאות.
  - (ג) ה-crop של ה-intake לא רשום ל-plan.json.
  - (ד) הצעה לסכמה: `building.roof_top_cm` (או גובה כתר), כדי לסגור את העיוורון ל-pitch.
  - (ה) `validate-plan.mjs` לא תופס חדר שזז.
- **לזיכרון:** כרטיס 05 DONE ($0): ‏plan_gate (קירות/חפיפה/שטח לכל חדר) ו-facade_gate (קו מתאר וקומות מוטלים + שיא יישור אופקי) נכשלים על קלט רע ידוע, בפערים 0.772 ו-0.637. המידות המודפסות "לידיעה" עד ש-report.json יספק קווי מידה: ה-tracer של 846 חתך את הלולאות לאורך קווי המידה. עיוור ל-pitch/roll של 2°. qa.html ב-engine/_local/apt846/v1.
