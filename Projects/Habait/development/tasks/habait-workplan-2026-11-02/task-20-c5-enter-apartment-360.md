# משימה 20: C5: כניסה לדירה ב-360: projection של פנורמות הדירה על גאומטריית החדרים → וידאו 360 קצר enter-846 (מרפסת → סלון) ללא קפיצה

| שדה | ערך |
|---|---|
| **לוח** | `habait-workplan-2026-11-02` |
| **ערוץ** | C |
| **מקור בתכנית** | חלק ג §2 ערוץ C, שלב C5; memory.md §4 ("הכל הדמייה רציפה אחת") ב-`C:\RnD\Projects\Habait\research\product-research-2026-11-02\HABAIT-RESEARCH-2026-11-02.md` |
| **סוכן** | `blender-scene` (`status: live`, `owner-track: habait`, `model: opus`) |
| **Ruling tier** | **T1** |
| **גל (wave)** | 4 |
| **מצב** | TODO |
| **זיכרון** | `memory/agents/` לא קיים בפרויקט הזה; הזיכרון של הסוכן הוא בלוק `## תוצאה` כאן (ראו rails). הסוכן הוא יכולת קבועה (לא one-off persona). |

## מטרה

אותו עיקרון כמו בחוץ, בפנים: הפנורמות המולבשות של GPT (terraceLiving, living) מוטלות חזרה על גאומטריית החדרים (קירות, רצפה, ריהוט מה-plan), ומצלמת equirect יורדת מהנקודה שבה descend-846 נגמר, דרך o-5, אל cp-living (`enter-846`, ~4 ש'). הפריים האחרון = המבט של פנורמת living באותו yaw → המסירה לסיור (13/10) בלי קפיצה. אלירן: "אין קפיצה בין החוץ לפנים: אותו לוק, אותה גאומטריה".

## תלויות

- 15 PASS, 17 (descend-846 מסתיים מול o-5), הפנורמות המולבשות של 846 (balanced; של 16), הסצנה המרוהטת (07 או apt846-furnished)

## קלטים (קריאה)

- `Habait/tour360/apartments/apt846/panos/balanced/{cp-terraceLiving,cp-living}*.jpg` + `cameras.json` (מיקומים בס"מ)
- הסצנה המרוהטת + depth
- 17: נקודת הסיום של descend-846; o-5 = הפתח סלון-מרפסת (לא o-13)

## קבצים (הסוכן כותב רק כאן)

- `Habait/flyover/enter.py` (חדש: projection פנים + מסלול enter)
- `Habait/flyover/_local/segments/enter-846/{frames/,camera.json}` (דראפט 1024×512)
- `Habait/flyover/REPORT-C5-he.md` + 3 פריימים (חוץ-אחרון, סף, פנים-אחרון)

> **Blender:** לפי SESSIONS.md כלל 4, רק habait-16 מריץ Blender מקומית. הסוכן כותב את הסקריפט, מריץ `--dry-run`/selftest בלי Blender אם אפשר, ומבקש מהסשן המפעיל להעביר את ההרצה ל-16 (SendMessage) או ל-Kaggle (כרטיס 18). ההרצה בפועל של ה-Check נרשמת בבלוק התוצאה עם מי הריץ.

## צעדים

1. הטלת שתי הפנורמות כ-projectors ממיקומי cameras.json על גאומטריית הדירה; blend לפי זווית; החוץ (דרך הזיגוג) = הסצנה של 15.
2. מסלול: מנקודת הסיום של descend (1.5 מ' מחוץ ל-o-5) דרך הפתח אל cp-living; easing; yaw סופי = yaw ברירת המחדל של פנורמת living.
3. דראפט 96 פריימים ב-1024×512; פריים אחרון מול הפנורמה האמיתית: kf_check per-class (זה המדד של "בלי קפיצה").
4. T1: 3 פריימים לאלירן: "אין קפיצה?" ברירת מחדל: ממשיכים לרנדר מלא על Kaggle.

## קריטריוני קבלה

- [ ] enter-846 דראפט קיים; הפריים האחרון מול פנורמת living: kf_check קירות/זיגוג/דלתות ≥ 0.9.
- [ ] ה-yaw של הפריים האחרון = yaw ברירת המחדל של הסיור (±2°).
- [ ] המעבר דרך o-5 (לא דרך קיר/זכוכית).

## Gate

**Check:**
```bash
cd C:/RnD/Projects/Habait/habait-walkaround && export PYTHONIOENCODING=utf-8 && PY=/c/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe && LAST=$(ls Habait/flyover/_local/segments/enter-846/frames/*.png | tail -1) && timeout 300 $PY /c/RnD/Projects/Habait/tools/bench/kf_check.py --ref Habait/tour360/apartments/apt846/panos/balanced/cp-living.jpg --test "$LAST" --per-class --yaw-from Habait/tour360/apartments/apt846/scenes.json
# צפוי: walls>=0.9 glazing>=0.9 doors>=0.9, PASS (הארגומנטים המדויקים של kf_check: לקרוא את ה---help שלו, לא להמציא)
```

**Reviewer scope:** רציפות בלבד: הפריים האחרון של enter מול הפנורמה, per-class, ואותו yaw.

הבודק (אם נדרש) הוא `qa-reviewer` בהקשר נקי, לא הסשן שביצע.

## כסף

$0 (רנדר על Kaggle דרך 18)

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

_(סוכן `blender-scene` עבור habait-4b, 2026-11-02, 16:00–17:05 שעון המכונה; הריצה נקטעה פעם אחת על מגבלת המנוי (429) והמשיכה מהעבודה השמורה)_

- **מצב:** **PARTIAL.**
  - **מוכן:** הסקריפט, הסצנה, המסלול, camera.json ו-3 פריימי smoke ב-512x256. ה-Check (מותאם) עבר: exit 0, PASS.
  - **חסר:**
    - הדראפט של 96 פריימים ב-1024x512 לא רונדר מקומית (לפי ההוראה); הוא ל-Kaggle, כרטיס 18.
    - קריטריון "קירות ≥ 0.9" לא הושג ב-512x256: 0.595, מסיבת רזולוציה. נמדד שוב אחרי Kaggle.
    - `REPORT-C5-he.md` לא נכתב: ה-harness חוסם כתיבת קבצי דו"ח מתת-סוכן. הנוסח המלא נמסר לסשן המפעיל בהודעת המסירה, והוא כותב אותו ל-`Habait/flyover/REPORT-C5-he.md`.
- **מה נעשה:**
  - **`Habait/flyover/enter.py` (חדש):**
    - **projection mapping פנימי:**
      - שתי פנורמות balanced של הסיור (`04-living`, `05-terrace-living`) הן projectors של equirect.
      - המיקומים: `cameras.json`, ‏px/2.25. מול `camera_points` של plan.json ההפרש 0.03 / 0.06 ס"מ. גובה עין 1.6. ה-yaw הוא `centreBearingDeg`.
      - כל משטח בסצנת ה-zero-line (`Habait/studio/.../renders/scene.blend`, בקריאה בלבד) מקבל shader אחד של emission.
      - המשקל של כל projector: `vis × (max(0,cos)^8 + 0.001)`.
      - `vis` מגיע מ-**shadow map**: מפת עומק equirect ‏1024x512 לכל projector, ray cast בבנייה, packed float.
      - מקום שאף projector לא רואה ממולא בממוצע זוויתי, במשקל 1e-6.
    - **החוץ דרך הזיגוג:** הסצנה האפויה של כרטיס 15 (`renders/baked/baked.blend`). הוסרו `BK_apt` ו-`BK_tower_hidden`, ונמחקו 325 פאות של המגדל ופרטיו בתוך `box_world` של 846.
    - **o-5:** דלת הזזה פתוחה. הזכוכית בטווח שלה נחתכה ל-`PORTAL_o-5_GLASS_facade-3`, שקוף עד ה-lock. o-13 לא נגע.
    - **lock (מסירה):** smoothstep בפריימים 67–96. ה-projector של המרפסת יוצא, והזכוכית והפורטל נושאים את פנורמת הסלון. **הפריים האחרון = הפנורמה עצמה.**
  - **המסלול:**
    - מהפוזה האחרונה של descend-846, שנקראת בזמן ריצה מ-path.json דרך `build_path` של `render_segments.py` (exec בקריאה בלבד): ‏(11.746, −11.629, 1.6), yaw 288.72, במנוחה.
    - Catmull-Rom דרך מרכז o-5 אל cp-living ‏(6.853, −9.351, 1.6). smoothstep על אורך הקשת.
    - 96 פריימים = 4.0 ש', גלובליים 793–888 (descend מסתיים ב-792 עם הסיבוב החדש). 5.41 מ', שיא 2.03 מ'/ש'.
    - הסף בפריימים 33→34: ב-0.527 מרוחב הפתח (1.88 מ'), מרווח 0.89 מ'.
    - yaw: 288.72 בהליכה, ואז +182.6° עם כיוון השעון (tau 0.40–1.0, שיא 114°/ש') אל **111.30** = `heading 0 + centreBearingDeg` של living ב-scenes.json.
    - BVH של הסצנה: 0 פגיעות לאורך המסלול, מרווח מינימלי 0.66 מ'.
  - **הכרעות T0:**
    1. visibility ב-shadow map ולא per-vertex. העידון של הרשת ל-0.2 מ' (917 אלף vertices) תקע את ה-sync של Cycles מעל 2 דק'.
    2. o-5 פתוח, ופורטל שקוף שנכנס עם ה-lock.
    3. emission ב-Standard, כמו ב-render_check של כרטיס 15: ה-sRGB של הפנורמה חוזר כמו שהוא.
    4. כיוון הסיבוב עם כיוון השעון, דרך פינת האוכל.
    5. ה-Check מותאם לממשק האמיתי של kf_check (ראו למטה).
  - **בדיקות:** `--selftest` 11/11 PASS (exit 0):
    - תפר descend→enter;
    - מהירות וקצב yaw;
    - מעבר דרך o-5 (לא o-13);
    - אין קיר ואין זיגוג מחוץ ל-o-5 לפי plan.json;
    - סיום ב-cp-living (0.0 ס"מ);
    - yaw אחרון 111.30 (הפרש 0.00);
    - 2 projectors;
    - lock;
    - `level_matrix` זהה לזה של כרטיס 17.
  - **אבחון:**
    - אותה פוזה אחרונה ברנדר perspective מול חיתוך הפנורמה: MAE ‏0.25/255. kf_check 1.0 בכל המחלקות, exit 0.
    - registration (clay של התכנית מול הפנורמה): 0.579 / 0.534, הזזה 6.21°, exit 1. **GPT צייר זיגוג מעוגל ורחב מהתכנית. זה הגבול של האמצע, לא של המסירה.**
- **קבצים שנכתבו:**
  - `Habait/flyover/enter.py`
  - `Habait/flyover/enter/_local/{enter846.blend (90 MB), enter846.packed.blend (134 MB, עצמאי ל-Kaggle), build_report.json}`
  - `Habait/flyover/equirect/_local/segments/enter-846/{camera.json (96 פריימים, 1024x512, צורת {frames:[…]} של camera_doc + lock + בלוק enter), frames/frame_0001,0034,0096.png (512x256), render_log.json}`
  - `Habait/flyover/equirect/_local/segments/enter-846/check/{three_frames.jpg, handoff/…, registration/…}`
  - **סטייה מהכרטיס:** הנתיב `equirect/_local/segments/enter-846` ולא `flyover/_local/segments/enter-846`, לפי ההוראה, כמו כרטיס 17.
- **פלט ה-Check (מילה במילה).** ה-Check המותאם:
  - ל-kf_check אין `--ref/--test/--per-class/--yaw-from`. הממשק האמיתי: `--plan --shot-dir --keyframe`.
  - ה-shot-dir הוא חיתוך 90° של פנורמת הסלון ב-yaw 111.3 (REF), עם id ו-depth של הסצנה באותה פוזה.
  - ה-keyframe הוא אותו חיתוך מהפריים האחרון של ה-equirect (TEST).
  - הפקודה:
  `cd C:/RnD/Projects/Habait/habait-walkaround && export PYTHONIOENCODING=utf-8 && PY=/c/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe && D=Habait/flyover/equirect/_local/segments/enter-846 && LAST=$(ls $D/frames/frame_*.png | tail -1) && $PY Habait/flyover/enter.py --check-prep --last "$LAST" && timeout 300 $PY /c/RnD/Projects/Habait/tools/bench/kf_check.py --plan Habait/studio/_local/projects/apt846-rainbow-tlv/derived/plan.json --shot-dir $D/check/handoff --keyframe $D/check/handoff/test_last.png --json $D/check/handoff/kf_last.json --sheet $D/check/handoff/sheet_last.png; echo "exit $?"`
```
[check-prep] {"ref": "C:\\Habait\\habait-walkaround\\Habait\\flyover\\equirect\\_local\\segments\\enter-846\\check\\handoff\\frame_0001.png", "pano": "C:\\Habait\\habait-walkaround\\Habait\\tour360\\apartments\\apt846\\panos\\balanced\\04-living.webp", "yaw": 111.3, "test_last": "C:\\Habait\\habait-walkaround\\Habait\\flyover\\equirect\\_local\\segments\\enter-846\\check\\handoff\\test_last.png", "last_equirect": "C:\\Habait\\habait-walkaround\\Habait\\flyover\\equirect\\_local\\segments\\enter-846\\frames\\frame_0096.png", "last_equirect_res": [512, 256], "sheet": "C:\\Habait\\habait-walkaround\\Habait\\flyover\\equirect\\_local\\segments\\enter-846\\check\\three_frames.jpg"}
[kf-check] PASS  clay edges in keyframe 0.862  keyframe edges in clay 0.997  best shift 0.0 deg (0,0 px)  openings judged 5 failed 0
   by class: {'walls': 0.595, 'glazing': 0.946, 'furniture': 0.921, 'floors_ceilings': 0.641}
exit 0
```
  - **קריאה של הפלט:**
    - זיגוג 0.946 ≥ 0.9.
    - קירות 0.595 < 0.9.
    - דלתות: אין דלת במבט המסירה (פחות מ-1% מהפריים), ולכן לא נמדדו.
    - yaw אחרון 111.30 מול 111.3 (±2° ✓).
    - המעבר דרך o-5 ✓.
  - **למה הקירות נמוכים:** 90° מתוך equirect ‏512x256 הם 128 פיקסלים שמוגדלים פי 4, וקצוות הטקסטורה של הקירות והוילונות נמחקים. MAE של החיתוך 8.09 מול 0.25 ברנדר perspective באותה פוזה, שבו קירות = 1.0. בדראפט 1024x512 (256 פיקסלים ל-90°) ובסופי 4096x2048 (1024 פיקסלים) אותה פקודה אמורה לעלות. **לא נמדד.**
- **הרצות Blender מקומיות (כולן CPU; הבדיקה `tasklist` לפני כל אחת):**
  1. 16:24, בדיקת אובייקטים בלי רנדר, 14 ש'. **הפרה:** blender.exe של סשן אחר (PID 2592) כבר רץ. שרשרתי את הבדיקה וההרצה בפקודה אחת. מכאן כל הרצה נבדקה בנפרד.
  2. 16:25, build v1, 34 ש', בלי רנדר.
  3. 16:26, render 3 פריימים ב-512x256. **נעצר ב-timeout אחרי 121 ש'** (sync תקוע מהעידון).
  4. 16:28, בדיקה בלי רנדר, 2 ש'.
  5. 16:29:11, render ‏64x32 ‏1spp, timeout אחרי 132 ש'. **חפף** ל-`bake_skins.py` של סשן אחר שעלה ב-16:29:10: מרוץ בין הבדיקה להרצה.
  6. 16:42, render ‏64x32, timeout אחרי 91 ש'.
  7. 16:44, render ‏64x32 עם `--debug-cycles`, timeout אחרי 51 ש'.
  8. 16:46, build v2, 29 ש'.
  9. 16:56, render 3 פריימים ב-512x256, 4 ש'.
  10. 16:58, build v3 (9 ש') ו-render 3 פריימים ב-512x256 (4 ש').
  11. 16:59, אבחון נראות בלי רנדר, 1 ש'.
  12. 17:00–17:01, בדיקת זכוכית: 3 רנדרים ב-256x128, ‏2+3 ש'.
  13. 17:02, build (9 ש'), render 3 פריימים ב-512x256 (4 ש') ו-check (3 ש', נכשל על KeyError).
  14. 17:03, build (10 ש') ו-check ‏perspective + clay ב-512x256 (4 ש').
  15. 17:04, build + pack, 10 ש'.
  - אף רנדר לא חרג מ-512x256. שלוש הרצות עברו את 2 הדקות ונהרגו ב-timeout.
- **מה נשאר ל-Kaggle (כרטיס 18):**
  - **ב-dataset:** `enter846.packed.blend`, `enter.py`, `camera.json` של enter-846.
  - **דראפט:**
    `$BL -b "$IN/enter846.packed.blend" -P "$IN/enter.py" -- --render --camera-json "$IN/camera.json" --out /kaggle/working/segments --res 1024x512 --samples 16 --device auto --fmt PNG --frames 1-96`
  - **סופי:** אותה פקודה עם `--res 4096x2048 --samples 64 --fmt JPEG`.
  - **זנב descend על אותה סצנה ואותו מראה** (בלי זה התפר descend→enter יקפוץ):
    `... -- --render --segment descend-846 --camera-json "$IN/descend-846.camera.json" --out /kaggle/working/segments --res 1024x512 --samples 16 --frames 97-120`
  - `push_pull.py` מטמיע היום רק את `render_segments.py`, וצריך לקבל בחירת סקריפט ו-blend. השורות `[dev]` / `[frame]` / `[done]` ומפתחות `render_log.json` זהים.
  - **אחרי הרנדר:** להריץ שוב את ה-Check שלמעלה.
  - **זמנים מקומיים:** 0.5–1.0 ש' לפריים ב-512x256 על CPU.
- **כסף:** $0. אין ledger: לא הייתה קריאה בתשלום.
- **פגמים פתוחים:**
  1. קירות 0.595 ב-512x256 (ראו למעלה). לבדוק על הדראפט.
  2. **מריחות באמצע הקטע** (פריים 34):
     - הריהוט של GPT, שלא קיים בגאומטריה, נמרח על הרצפה.
     - המשקוף השחור מפנורמת המרפסת נמתח על התקרה.
     - registration ‏0.58 / 0.53.
  3. הצד הדרומי של העמוד במרפסת לא נראה באף פנורמה. ממולא בממוצע זוויתי.
  4. **סיבוב של 182.6° ב-2.4 ש'.** ה-yaw של הסיור לסלון פונה אל המרפסת. החלופה: 98 פותח את living ב-yaw ‏−177.4 כשמגיעים מ-enter, ואז לא צריך לסובב.
  5. **תפר descend→enter:** כרטיס 17 מרנדר את descend על clay של site.glb ב-AgX Punchy, ו-enter הוא emission ב-Standard. הפתרון הוא זנב descend דרך `enter.py --segment descend-846`.
  6. `REPORT-C5-he.md` חסום ל-subagent (ראו "מצב").
- **שאלה לאלירן (T1):**
  > "אין קפיצה?"
  >
  > `Habait/flyover/equirect/_local/segments/enter-846/check/three_frames.jpg`: פריים 1 בחוץ, פריים 34 בסף o-5, פריים 96 במסירה, ופנורמת הסיור.
  >
  > הפריים האחרון זהה לפנורמת הסלון, ולכן אין קפיצה בכניסה לסיור. באמצע הקטע יש מריחות של ריהוט ושל המשקוף.
  >
  > **א. (ברירת מחדל)** ממשיכים לרנדר מלא ב-Kaggle (דראפט 1024x512 ואז 4K) כמו שזה. $0.
  >
  > **ב.** קודם מורידים את המריחות: פנורמה שלישית בסף o-5 (skin אחד של GPT 2.5, כ-$1.20), ואז Kaggle.
  >
  > **ג.** מקצרים את הקטע: חיתוך רך בסף במקום הליכה דרך החדר.
  - כל השאר לא תלוי בתשובה ובוצע.
- **קורא שני:** **habait-98**.
  - **למה זה מחייב אותו:**
    - enter-846 נגמר בדיוק על `panos/balanced/04-living.webp`, ב-yaw 111.3 (`heading 0 + centreBearingDeg` ב-scenes.json). זו נקודת המסירה לסיור שלו.
    - הסצנה מטילה גם את `05-terrace-living`.
    - כל שינוי מחייב `--build` מחדש ורנדר מחדש, אחרת תהיה קפיצה. זה כולל: skin חדש, החלפת רצפה (parquet/concrete/marble), close-seam, או שינוי של `centreBearingDeg`/`heading`/`cameras.json` לסלון או למרפסת.
    - **הצעה:** לפתוח את living ב-yaw ‏−177.4 כשמגיעים מ-enter, במקום הסיבוב של 182.6°.
  - **בנוסף, ל-habait-4b (בעלים של 17/18):**
    - זנב descend-846 צריך לרוץ על `enter846.packed.blend` דרך `enter.py --segment descend-846`, אחרת יש קפיצת מראה בתפר.
    - `push_pull.py` צריך בחירת סקריפט ו-blend.
- **לזיכרון:** C5 (כרטיס 20): `Habait/flyover/enter.py`. enter-846 = ‏96 פר' (4 ש', גלובליים 793–888) מסוף descend דרך o-5 (פתוח) אל cp-living, yaw סופי 111.3. projection של 04-living + 05-terrace-living עם shadow maps על scene.blend + baked.blend של 15; lock בסוף ⇒ הפריים האחרון = הפנורמה (perspective: MAE 0.25). Check ‏512x256: PASS, קירות 0.595 (רזולוציה), זיגוג 0.946. דראפט ל-Kaggle. $0.

## תיקון אחרי M1 v2 (שעון המכונה 2026-11-03 07:09)

_(סוכן `blender-scene` עבור habait-1d. קוד בלבד: **Blender לא הורץ**, כי ה-Blender של המחשב אצל habait-98. ‏$0, בלי קריאות בתשלום, בלי git.)_

- **הקלט:** שער M1 v2 (כרטיס 32) מצא שני פגמים בדראפט של 98 (96 פריימים, 1024×512, 16 spp): (1) הריהוט נראה כקוביות לבנות; (2) מלבן צף עם נוף עיר בסביבות 2.7 ש'. לפי האבחון של 98 זו בעיית סצנה ותזמון ב-enter.py, לא בעיה של sample count.
- **ממצא שמתקן את האבחון של 98:** בסצנה הזו `BK_*` ו-`STUDIO_*` הם **האתר**, לא הריהוט:
  - ה-`BK_*` של כרטיס 15: ‏`BK_tower`, ‏`BK_podium`, ‏`BK_nb`, ‏`BK_ground`, ‏`BK_ground_far`, ‏`BK_detail_*`.
  - ה-`STUDIO_ortho` של הסטודיו.
  - שניהם במחלקה 5 (site) של kf_check. הסתרה שלהם הייתה מוחקת את המגדל ואת העיר שמאחורי הזכוכית.
  - **הריהוט עצמו:** ‏38 ה-empties מסוג `FURN_<room>_<slot>` ש-build_scene/general_furnish יוצר, והילדים שלהם (מודלי Kenney מסוג "(Clone)" ושלושה מודלים של Poly Haven). המקור: `renders/scene.report.json`, שמונה מטבח 10, אוכל 4, סלון 6, שינה 6+6, אמבטיות 3+3.
- **תיקון 1, "קוביות לבנות" (הכרעת T0: אפשרות א', להסיר את הריהוט):**
  - ב-`--render` וב-`--check`, הפונקציה `m1v2_prepare` מסתירה מהרנדר (`hide_render`) כל `FURN_*` וכל הצאצאים שלו.
  - **מפות העומק `depth_L` ו-`depth_T` נבנות מחדש (re-cast) בזיכרון בלי הריהוט.** קבוצת החוסמים זהה לזו של ה-build: רשתות APT846, בלי זכוכית ובלי הריהוט. כך הרצפה והקירות שמאחורי הספה "רואים" את ה-projector ונושאים את הספה המצוירת של הפנורמה.
  - **למה צריך re-cast:** בלעדיו `vis_L=0` מאחורי הריהוט שהוסר, ובפריימים 85–95 ה-projector של המרפסת שולט שם. התוצאה: הספה "מופיעה" בזמן הנעילה של כרטיס 34.
  - **שמירה (guard):** הסרת חוסמים יכולה רק להרחיק עומק. אם המפה החדשה קרובה יותר מהבנויה ביותר מ-0.5% מהטקסלים, נשארים עם המפה הבנויה ונכתבת `WARNING` בלוג.
  - **למה לא אפשרות ב'** (דגימה בלי vis gate לפאות הריהוט): צורות הקופסה של Kenney היו נשארות, והיא לא עוזרת אם הלבן לא בא מה-vis gate.
  - **אפשרות א' לא שוברת את הפריים האחרון:** ב-lock 1 כל פיקסל דוגם את `04-living` בכיוון של המצלמה עצמה, בלי קשר לגאומטריה. הסטייה המקסימלית היא 0.1% מהפרש הצבעים, אפילו בטקסל שה-projector לא רואה.
- **תיקון 2, "מלבן צף":**
  - לזכוכית ול-portal של o-5 יש עכשיו lock משלהם (`lock_glass`, צומת Value חדש ב-`ENTER_proj` שמחובר ל-Lock של `ENTER_glass`).
  - **0 עד פריים 84** (הזכוכית שקופה ורואים דרכה את העיר האפויה). **smoothstep על פריימים 85–96**, אותם פריימים ואותו משקל כמו `LOCK_FRAMES=12` של `build_segments.mjs` בכרטיס 34. **1 בפריים 96.**
  - בפריים 85 המצלמה במרחק 0.197 מ' ממרכז הסלון, ובפריים 90 במרחק 0.061 מ'. ה-parallax של העיר המצוירת קטן מ-3° ויורד ל-0.
  - ה-lock של המשטחים האטומים לא השתנה (tau ‏0.70–1.0).
  - **למה לא "שקוף עד הסוף":** אז פריים 96 לא היה שווה ל-`04-living` בזיגוג (העיר האפויה שונה מהעיר של GPT), והנעילה של כרטיס 34 מניחה שהוא שווה.
- **איך זה מיושם:**
  - בזיכרון בלבד, ב-`--render`/`--check`. אין `--build`, אין דגלים חדשים, הנתיבים ושמות הפריימים לא השתנו, ו-`enter846.packed.blend` לא נכתב.
  - `camera.json` לא נכתב מחדש. בשורות בלי `lock_glass` מחושב אותו לוח זמנים לפי מספר הפריים; מעכשיו `--plan-only`/`--build` כותבים גם `lock_glass`.
  - ב-`render_log.json` נוספו `m1v2` ו-`lock_glass` לכל פריים.
  - בשורת `[frame]` נוסף `glass x`. מי שקורא את השורה (push_pull, kernel_driver) בודק רק `startswith`.
  - כל שינוי מסומן `# M1 v2 fix 2026-11-03`.
- **בדיקות ($0, בלי Blender):**
  - `py_compile`:
```
py_compile exit 0
```
  - `--selftest`: ‏12/12. נוספה בדיקה אחת:
```
  [PASS] M1 v2: glass clear through frame 84, glass lock 1 on the last frame: glass lock frame 84 0.0, frame 85 0.019676, frame 90 0.5, frame 96 1.0 (opaque lock at frame 84: 0.623843)
checks: 12/12 pass
selftest exit 0
```
  - `--plan-only --out <scratch>` (לא לנתיב המוצר): המסלול זהה ל-camera.json הקיים (dpos 0.0 מ', ‏dyaw 0.0, ‏dlock 0.0). לוח הזמנים של הזכוכית בשורות הישנות זהה לשדה החדש (4e-7).
  - **mock של bpy/mathutils** (בסקראצ'פד, `mock_m1v2_test.py`): ‏20/20. נבדקו:
    - הצומת והקישור;
    - הסתרת `FURN_*` וילדיו, בלי לגעת ב-`BK_tower`/`STUDIO_ortho`/קירות/זכוכית;
    - re-cast שמרחיק רק את טקסלי הספה;
    - guard כשה-projector לא תואם;
    - idempotent;
    - דילוג על פריים קיים;
    - lock_glass לכל פריים (67/84 = 0, ‏85 = 0.0197, ‏90 = 0.5, ‏96 = 1);
    - זנב descend = 0.
  - **בסיס להשוואה על הדראפט הנוכחי:** ה-Check המותאם של הכרטיס הורץ על פריים 96 ב-1024×512, בתיקייה בסקראצ'פד ולא ב-`check/` של המוצר:
```
[kf-check] PASS  clay edges in keyframe 0.988  keyframe edges in clay 1.0  best shift 0.0 deg (0,0 px)  openings judged 5 failed 0
   by class: {'walls': 0.956, 'glazing': 0.997, 'furniture': 0.983, 'floors_ceilings': 0.975}
exit 0
```
    - "קירות 0.595" מהריצה הקודמת היה בגלל רזולוציה (512×256): ב-1024×512 זה 0.956.
    - פריים 96 מול `04-living` ב-equirect: ‏MAE ‏0.07/255.
    - אחרי הרנדר מחדש מצפים לאותם מספרים.
- **שתי הפקודות ל-habait-98 (Git Bash):**
  - **למה מעבירים קודם:** `enter.py` מדלג על כל פריים קיים (≥ 2 KB). לכן מעבירים את הדראפט הקיים הצידה (נשמר להשוואה לפני/אחרי).
  - **החלופה:** להוסיף `--force` לפקודה השנייה בלי הפקודה הראשונה. הפריימים נדרסים במקום, אחד-אחד דרך tmp+rename.
```
cd /c/RnD/Projects/Habait/habait-walkaround && D=Habait/flyover/equirect/_local/segments/enter-846 && mkdir -p $D/frames-m1v1-draft && mv $D/frames/frame_*.png $D/render_log.json $D/frames-m1v1-draft/
timeout 1800 "$BLENDER" -b Habait/flyover/enter/_local/enter846.packed.blend --factory-startup -P Habait/flyover/enter.py -- --render --res 1024x512 --samples 16 --frames 1-96
```
  - **מה לבדוק בלוג:**
    - שורה אחת `[enter] [m1v2] {...}` עם `"groups": 38`.
    - `depth.L` / `depth.T` עם `not_nearer` ≥ 0.995 ו-`readback_max_err` ≈ 0.
    - **בלי `WARNING`.** אם יש WARNING: הריהוט מוסתר אבל המפה הבנויה נשארה (חורים מאחורי הריהוט); לעצור ולהודיע ל-1d.
    - שורות `[frame] ... glass 0.0000` עד פריים 84, ו-`glass 1.0000` בפריים 96.
  - **זמן משוער:** כ-2.1 ש' לפריים (הריצה של 98 ב-06:05), כלומר כ-3.5 דק', ועוד כ-10 ש' ל-re-cast.
- **אחרי הרנדר (1d, ‏venv, ‏$0):**
  - ה-Check המותאם של הכרטיס (הפקודה בבלוק התוצאה למעלה, `--check-prep --last` ואחר כך `kf_check`). מצפים ל-PASS כמו בבסיס.
  - הרצה חוזרת של `build_segments.mjs` של כרטיס 34, שקולט את 96 הפריימים החדשים.
  - בעין: פריימים 60–84 (אין מלבן), 30–70 (הספה מצוירת על הרצפה), 85–96 (הנעילה).
  - `--check` של Blender (test_persp/id בלי ריהוט) הוא אופציונלי.
- **סיכון לפריים האחרון:**
  - **פריים 96 לא משתנה מבחינה מתמטית:** ב-lock 1 ו-lock_glass 1 המשקל של המרפסת 0, וכל משטח וזכוכית דוגמים את `04-living` בכיוון של קרן המצלמה.
  - בטקסל שה-projector לא רואה (אם ה-guard השאיר את המפה הבנויה) הסטייה ≤ 0.1% מהפרש הצבעים, כלומר ≤ 0.26/255.
  - בפריימים 85–95 הזגוגית עוברת מהעיר האפויה לעיר של GPT, באותו משקל כמו הנעילה של כרטיס 34.
  - **הסיכון האמיתי: הקוד לא הורץ ב-Blender.** הוא נבדק ב-mock בלבד. שתי ההנחות שלא אומתו:
    1. Cycles קורא את פיקסלי מפת העומק ששונו בזיכרון ב-`pixels.foreach_set` (תמונה float ארוזה).
    2. `links.new` מחליף את הקישור `lock → Lock`.
  - אם אחת מהן נכשלת, השורה `[m1v2]` או הפריימים יראו את זה מיד: זכוכית שאטומה לפני פריים 85, או חורים מאחורי הריהוט.
- **פגמים שנשארים:**
  1. registration של 0.58: GPT צייר זיגוג רחב מהתכנית, ולכן ליד הזכוכית האמיתית יש "פס עיר מצויר" על הקיר. זה קיים מפריים 1 ולא קשור לתיקון.
  2. הספה המצוירת על הרצפה מתעוותת באמצע ההליכה, כפי שאפשרות א' מקבלת.
  3. `REPORT-C5-he.md` ו"העברות" ב-README של הלוח לא עודכנו, לפי ההוראה. הסשן המפעיל מעביר.
- **כסף:** $0, בלי ledger.
- **קורא שני:** **habait-98 (habait-ba).**
  - **מה עליו לעשות:** להריץ את שתי הפקודות למעלה. בלי `--build`, וה-packed.blend לא משתנה. לבדוק בלוג את השורה `[m1v2]` בלי WARNING.
  - **למה זה מחייב אותו:** ה-Blender אצלו, ובלי ההעברה הצידה (או `--force`) כל 96 הפריימים הקיימים ידולגו ולא יירונדר כלום.
  - **תיקון לאבחון שלו:** `BK_*` / `STUDIO_*` הם האתר ולא ריהוט.
- **לזיכרון:** enter.py, תיקון M1 v2 (3.11): ב-render הריהוט FURN_* מוסתר ומפות העומק נבנות מחדש בלעדיו (BK_/STUDIO_ = האתר, לא ריהוט). הזכוכית שקופה עד פריים 84 וננעלת רק ב-12 האחרונים, כמו נעילת כרטיס 34. פריים 96 נשאר 04-living. בלי build; ‏98 מרנדר מחדש. $0.
