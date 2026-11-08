# משימה 22: C6ב: כל המגדל: descend/enter לכל טיפוס×קומה (דה-דופליקציה: אותו מסלול, גובה שונה) בבאצ' על Kaggle

| שדה | ערך |
|---|---|
| **לוח** | `habait-workplan-2026-11-02` |
| **ערוץ** | C |
| **מקור בתכנית** | חלק ג §2 ערוץ C, שלב C6; שער M2 ב-`C:\RnD\Projects\Habait\research\product-research-2026-11-02\HABAIT-RESEARCH-2026-11-02.md` |
| **סוכן** | `cloud-render` (`status: live`, `owner-track: habait`, `model: opus`) |
| **Ruling tier** | **T0** |
| **גל (wave)** | 6 |
| **מצב** | TODO |
| **זיכרון** | `memory/agents/` לא קיים בפרויקט הזה; הזיכרון של הסוכן הוא בלוק `## תוצאה` כאן (ראו rails). הסוכן הוא יכולת קבועה (לא one-off persona). |

## מטרה

להפיק `descend-<unit>` לכל דירה ב-units.json בלי לרנדר 480 פעמים: מסלול descend אחד לכל טיפוס×אזימוט, מוסט בגובה לפי הקומה (פרמטריזציה ב-path.json), ו-`enter-<type>` אחד לכל טיפוס. תור ב-Kaggle עם resume (פריימים קיימים מדולגים), דוח התקדמות.

## תלויות

- 17, 18, 20 (המסלולים והנוטבוק), 03 (רשימת הדירות)

## קלטים (קריאה)

- 17: path.json (להוסיף `descend_template` עם משתנה גובה)
- 18: push_pull.py
- 03: units.json

## קבצים (הסוכן כותב רק כאן)

- `Habait/flyover/batch_units.py` (חדש: מייצר רשימת עבודות + מריץ דרך push_pull)
- `Habait/flyover/_local/segments/descend-<unit>/**`, `enter-<type>/**`
- `Habait/flyover/_local/batch-progress.json`

## צעדים

1. דה-דופליקציה: קיבוץ דירות לפי (טיפוס, אזימוט חזית); לכל קבוצה מסלול אחד + הסטת גובה לכל קומה.
2. תור: עבודות בסדר (846 קודם, אחר כך טיפוס 846 בקומות אחרות, אחר כך השאר); `--limit N` לסשן אחד של Kaggle.
3. resume: עבודה שנכשלה (OOM/זמן) ממשיכה מהפריים האחרון.
4. דוח: כמה דירות הושלמו, שעות מכסה, ש'/פריים.

## קריטריוני קבלה

- [ ] `--dry-run` מפרט את כל העבודות ואת הדה-דופליקציה (מספר מסלולים ייחודיים ≪ מספר הדירות).
- [ ] לפחות 3 דירות (846 + 2 מאותו טיפוס בקומות אחרות) רונדרו בדראפט 2048×1024.
- [ ] batch-progress.json מעודכן; ריצה חוזרת לא מרנדרת שוב.

## Gate

**Check:**
```bash
cd C:/RnD/Projects/Habait/habait-walkaround && export PYTHONIOENCODING=utf-8 && PY=/c/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe && $PY Habait/flyover/batch_units.py --units Habait/engine/_local/rainbow/units.json --dry-run && $PY -c "import json;p=json.load(open('Habait/flyover/_local/batch-progress.json'));d=[u for u in p['units'] if u['done']];print('done',len(d));exit(0 if len(d)>=3 else 1)"
# צפוי: dry-run מראה N דירות → M מסלולים ייחודיים (M<N); done ≥ 3
```

**Reviewer scope:** דה-דופליקציה נכונה בלבד: דירות מאותו טיפוס באזימוטים שונים לא מאוחדות בטעות.

הבודק (אם נדרש) הוא `qa-reviewer` בהקשר נקי, לא הסשן שביצע.

## כסף

$0 Kaggle (הערכה: ~40 ש' מכסה לכל המגדל ב-2K; לפרוס על שבועות או Modal/Vast באישור)

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

_(מילא סוכן `cloud-render` עבור habait-1d, 2.11.2026 18:00–19:40 שעון המכונה)_

- **מצב:** **PARTIAL.**
  - **DONE:** הדה-דופליקציה, התור, ה-resume, ה-Check (exit 0). ‏descend ל-3 דירות (846, 836, 856) רונדר ב-Kaggle ב-2048×1024, ‏128 spp, והפריימים על הדיסק. ריצה חוזרת לא מרנדרת כלום.
  - **לא רץ:** `enter-846` ‏(1024×512) והזנב `descend-846` 97–120 על הסצנה של כרטיס 20. Kaggle ביטל 4 מתוך 4 ריצות שחיברו את ה-dataset החדש `eliranhabait/habait-batch-scenes` (שבו `enter846.packed.blend`), ו-2 מתוך 2 ריצות בלי ה-dataset הושלמו. פירוט למטה.
  - **לא נשלח בכוונה:** 9 הדירות האחרות (826, 866, K, M, PH), כי ה-brief דרש לפחות 3. הפקודה מוכנה (בסוף הבלוק).
- **מה נעשה (הכרעות T0):**
  1. **דה-דופליקציה: 12 דירות → 4 מסלולים.** מפתח הקבוצה = (טיפוס, אזימוט החזית בעיגול ל-0.5°, מלבן טביעת הרגל של box_world בעיגול ל-5 ס"מ).
     - `L@164.5`: ‏846, 836, 856, 826, 866.
     - `K@169`: ‏845, 835, 855.
     - `M@91.5`: ‏847, 837, 857.
     - `PH@162.5`: ‏876.
     - בתוך קבוצה רק הגובה משתנה: dz = (floor−16)×3.2, ונבדק שהוא שווה ל-z0 של ה-box.
     - Reviewer scope: ב-selftest דירת L מדומה על החזית המערבית קיבלה קבוצה משלה (`L@24.5`). דירת L בקומה 21 הצטרפה לקבוצה של 846.
  2. **`descend_template` ב-path.json (additive).**
     - הבסיס הוא descend-846 עצמו. התבנית ב-(L, 16) משחזרת את 120 הפוזות של `render_segments.build_path` בסטייה 0.0 מ' / 0.0°, ו-camera.json זהה לזה של כרטיס 19 (hotspots של 19 תקפים כמו שהם). global ‏673–792.
     - ההתחלה תמיד node-b-tower (פוזת ה-hold).
     - **traced** (L, טביעת הרגל של 846): הסיום של 846 (1.5 מ' מחוץ ל-o-5 על המרפסת) + dz.
     - **stacked-approx** (K/M/PH: טביעת הרגל והפתחים לא ידועים): החזית = קצה הפלטה (`units-geometry.json building.plate_en`) שקרן מ-מרכז ה-box לאורך הנורמל החיצוני שלו פוגעת בו ראשונה; "הפתח" = נקודת הפגיעה; הסיום = 1.5 מ' החוצה, בגובה עיניים 1.6, במבט פנימה. העוגנים node-e/f/c/d מוצבים מחדש במסגרת הזו.
     - למה לא הזזת ה-o-5 של 846 בהסטה של stack_units: ל-M ההסטה היא 8.25 מ' פנימה, ואז הפתח המוזז נמצא 10.7 מ' בתוך המגדל. ה-box של M נשען על הקצה המזרחי (קצה 20, ‏91.3°).
     - 84/84 בדיקות. 0 פריימים בתוך הפלטה (ל-L רק 5 פריימי המרפסת בסוף, ≤ 0.27 מ' מהקצה, כניסה 1.62 מ' מעל הרצפה). 0 פגיעות ב-bbox של 156 בניינים שכנים/פודיום ב-site.glb.
  3. **התור:** descend-846 ← enter-846 ← tail-846 ← descend-836 ← descend-856 ← השאר (L, K, M, PH, הקומה הקרובה קודם). `--limit N` = עבודות בסשן GPU אחד. כל ה-descend של סשן רצים בתהליך Blender אחד.
     - resume: פריים קיים ברזולוציה הנכונה (IHDR של ה-PNG) ובגודל ≥ 2 KB מדולג. עבודה נשלחת רק עם הפריימים החסרים שלה. פריים מקומי ברזולוציה אחרת מוזז ל-`frames-<w>x<h>/` ולא נדרס.
     - selftest עם runner מזויף (בלי רשת ובלי Blender): 14/14. בודק את סדר התור, ריצה 1 (3 דירות + enter/tail), ריצה 2 שלא מרנדרת כלום, resume ששולח בדיוק 5 פריימים חסרים, סשן שנקטע אחרי 10 פריימים ומושלם בסשן הבא, ושה-progress מכסה את כל 12 הדירות גם עם `--only`.
  4. **`render_cameras.py` (חדש):** מרנדר כל camera.json על סצנת ה-clay של site.glb עם הפונקציות של render_segments.py עצמו (exec לקריאה בלבד: build_glb_scene, ‏setup_cycles, ‏level_matrix, ‏render_still). הסיבה: ה-descend של דירות אחרות אינם קטעים ב-path.json, ו-render_segments.py לא נגעתי בו.
  5. **הרחבת push_pull.py / kernel_driver.py (additive בלבד).**
     - ה-diff מול גיבוי לפני העריכה: push_pull ‏+264/−0 שורות, kernel_driver ‏+116/−0. path.json: כל המפתחות הקיימים זהים, נוסף `descend_template`.
     - push_pull: מצב batch (`--batch-spec`, ‏`--script/--blend/--script-args/--job-id/--seg-dir/--kernel-slug/--extra-dataset`, ‏`run_batch`, ‏`pull_batch`/`unpack_batch`, ‏`ensure_base_dataset` שממחזר את ה-dataset של 18 כשהקבצים שהבאצ' קורא לא השתנו, `gpu_quota_used_h` דרך `kaggle quota`).
     - kernel_driver: `run_batch_mode()` (כמה תהליכי Blender בסשן אחד, placeholders מסוג `{IN:x}`/`{FILE:x}`/`{SCRIPT:x}`/`{OUT}`/`{CLAY}`, tar לכל עבודה) שרץ רק כש-`JOB.mode=="batch"`.
     - נבדק שמסלול ברירת המחדל של כרטיס 18 עדיין נבנה (`--seg approach --frames 1-48 --dry-run`, exit 0, ה-kernel עובר parse). `render_segments.py --dry-run` עדיין 17/17.
     - לפני ה-GPU: ה-kernel של הבאצ' הורץ מקומית עם stubs (Blender/wget/Kaggle) ובנה 3 תהליכים ו-5 tar עם מספרי הפריימים הנכונים.
  6. **ריצות Kaggle** (kernel חדש `eliranhabait/habait-batch-render`; ה-kernel של כרטיס 18 לא נגעתי):
     - v1–v3 (18:15/18:19/18:24; 5 עבודות; datasets: `habait-equirect-inputs` + `habait-batch-scenes` החדש, 135 MB): כל אחת `CANCEL_ACKNOWLEDGED` 25–90 ש' אחרי RUNNING, בלי `failureMessage`. ב-v2 פריים 1 כבר רונדר (11.8 ש').
     - probe ‏`habait-batch-probe` (18:27; Blender שישן 150 ש', בלי ה-dataset): COMPLETE, ‏176 ש'.
     - **v4 (18:32–19:25; descend-846/836/856, `--no-scene-dataset`): COMPLETE, 360/360 פריימים.** ‏OptiX על 2×T4, ‏OIDN על GPU, **8.5 ש'/פריים** (5.6–27; פריים ראשון 15.5; import 4.6; Blender 26.6). kernel wall 3104 ש' = **0.862 ש'** (מכסת החשבון 5.79→6.65). כ-272 MB לדירה.
     - v5 (19:27; enter+tail בלבד, kernel של 90 kB, עם ה-dataset): שוב CANCEL, אחרי ≤ 64 ש'.
     - מה נשלל: המכסה (24 ש' פנויות), תהליך מקומי שנוגע ב-Kaggle (אין), גודל ה-kernel (82 kB עבר, 90 kB בוטל). המשותף לכל הביטולים הוא חיבור ה-dataset `habait-batch-scenes`.
     - בעין (`Habait/flyover/batch/_local/contact_descend_846_836_856.jpg`, פריימים 1/60/100/120): ירידה רציפה מ-node-b אל החזית. 846 נגמר על המרפסת שלו מול הסלון דרך o-5. 836/856 נגמרים על המרפסות שלהם מול זיגוג אטום, כי ב-site.glb אין פנים לקומות אחרות.
     - **התחזית: כל המגדל = 1440 פריימי descend = 3.4 ש' GPU ב-2K.** נשארו 9 דירות = 2.55 ש', סשן אחד. final ב-4096×2048 ≈ 13.6 ש' (שני סשנים).
- **קבצים שנכתבו** (נתיבים מותאמים, כמו שה-brief ביקש):
  - חדשים: `Habait/flyover/batch/{batch_units.py, render_cameras.py, README-he.md}`. בנתיב שבכרטיס, `Habait/flyover/batch_units.py`, אין קובץ.
  - `Habait/flyover/batch/_local/`: `batch-progress.json` (במקום `flyover/_local/batch-progress.json`), `last-session-spec.json`, `kaggle-cams/`, `run-session1..5.out`, `contact_descend_846_836_856.jpg`.
  - `Habait/flyover/equirect/_local/segments/descend-<unit>/camera.json` ל-12 הדירות (במקום `flyover/_local/segments`).
  - `descend-{846,836,856}/frames/frame_0001..0120.png` (2048×1024).
  - `enter-846/**` לא שונה: 3 הפריימים של כרטיס 20 ב-512×256 במקומם.
  - additive: `Habait/flyover/equirect/path.json` (`descend_template`), `Habait/flyover/kaggle/push_pull.py`, `Habait/flyover/kaggle/kernel_driver.py`.
  - תוצרי לוואי של החווה: `Habait/flyover/kaggle/_local/{kaggle-log.jsonl (שורות kaggle-batch), runs/batch_*, kernel-habait-batch-render/, kernel-habait-batch-probe/, dataset-habait-batch-scenes/ (hard link ל-packed.blend + עותק scene.blend), dataset-pushed-habait-batch-scenes.json}`.
  - ב-Kaggle (פרטי): ה-dataset ‏`habait-batch-scenes`, וה-kernels ‏`habait-batch-render` ‏(v1–v5) ו-`habait-batch-probe`.
- **פלט ה-Check (מילה במילה, נתיבים מותאמים: `Habait/flyover/batch/batch_units.py`, `Habait/flyover/batch/_local/batch-progress.json`):**
```
$ cd C:/RnD/Projects/Habait/habait-walkaround && export PYTHONIOENCODING=utf-8 && PY=/c/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe && $PY Habait/flyover/batch/batch_units.py --units Habait/engine/_local/rainbow/units.json --dry-run && $PY -c "import json;p=json.load(open('Habait/flyover/batch/_local/batch-progress.json'));d=[u for u in p['units'] if u['done']];print('done',len(d));exit(0 if len(d)>=3 else 1)"; echo "CHECK EXIT $?"
[batch] units Habait/engine/_local/rainbow/units.json: 12 units -> 4 unique descend paths (dedup by type x facade azimuth x footprint; height offset 3.2 m per floor)
group     rule              facade  end xy (floor 16)   units (floor)                                 len m
L@164.5   traced            164.3d  [11.75, -11.63]     846 (16), 836 (15), 856 (17), 826 (14), 866 (18)   68.5
          facade: o-5 of apt846 (plan.json), 1.5 m out on the living terrace
K@169     stacked-approx    169.1d  [10.37, -19.23]     845 (16), 835 (15), 855 (17)                   68.9
          facade: plate edge 17 (8.4 m) 6.25 m from the box centre
M@91.5    stacked-approx     91.3d  [5.08, 2.59]        847 (16), 837 (15), 857 (17)                  130.7
          facade: plate edge 20 (18.2 m) 6.29 m from the box centre
PH@162.5  stacked-approx    162.5d  [7.13, -25.0]       876 (19)                                       69.3
          facade: plate edge 15 (8.9 m) 6.42 m from the box centre
  [PASS] template(L@164.5, floor 16) = descend-846: 120 vs 120 poses, max deviation 0.0e+00 m / 0.0e+00 deg, globals 673-792
  [PASS] group L@164.5 is one path: types ['L'], azimuths [164.5], footprints 1, floors [16, 15, 17, 14, 18] (z0 on the 3.2 m pitch: True)
  [PASS] group K@169 is one path: types ['K'], azimuths [169.0], footprints 1, floors [16, 15, 17] (z0 on the 3.2 m pitch: True)
  [PASS] group M@91.5 is one path: types ['M'], azimuths [91.5], footprints 1, floors [16, 15, 17] (z0 on the 3.2 m pitch: True)
  [PASS] group PH@162.5 is one path: types ['PH'], azimuths [162.5], footprints 1, floors [19] (z0 on the 3.2 m pitch: True)
  [PASS] no two groups share a key: 4 keys
  [PASS] every unit in exactly one group: 12 of 12
  [PASS] per-unit path checks (--verbose for each): 846 7/7, 836 7/7, 856 7/7, 826 7/7, 866 7/7, 845 6/6, 835 6/6, 855 6/6, 847 6/6, 837 6/6, 857 6/6, 876 6/6
checks: 84/84 pass
[batch] queue: 14 jobs (3 done); --limit 5 per Kaggle session; s/frame for estimates 8.5 (measured (card 22))
  # job            kind     unit   floor group     res         spp   frames  on disk  todo  next
  1 descend-846    descend  846       16 L@164.5   2048x1024   128      120      120     0  done
  2 enter-846      enter    846       16 -         1024x512     16       96        0    96  <- session (+3 other res)
  3 tail-846       tail     846       16 -         1024x512     16       24        0    24  <- session
  4 descend-836    descend  836       15 L@164.5   2048x1024   128      120      120     0  done
  5 descend-856    descend  856       17 L@164.5   2048x1024   128      120      120     0  done
  6 descend-826    descend  826       14 L@164.5   2048x1024   128      120        0   120  <- session
  7 descend-866    descend  866       18 L@164.5   2048x1024   128      120        0   120  <- session
  8 descend-845    descend  845       16 K@169     2048x1024   128      120        0   120  <- session
  9 descend-835    descend  835       15 K@169     2048x1024   128      120        0   120  
 10 descend-855    descend  855       17 K@169     2048x1024   128      120        0   120  
 11 descend-847    descend  847       16 M@91.5    2048x1024   128      120        0   120  
 12 descend-837    descend  837       15 M@91.5    2048x1024   128      120        0   120  
 13 descend-857    descend  857       17 M@91.5    2048x1024   128      120        0   120  
 14 descend-876    descend  876       19 PH@162.5  2048x1024   128      120        0   120  
[batch] projection: whole tower 1440 descend frames = 3.4 GPU h at 2048x1024 (left 2.55 h); final 4096x2048 = 13.6 h; + ~4 min per session
[batch] dry-run: the next session would carry 5 jobs: enter-846, tail-846, descend-826, descend-866, descend-845; writes nothing
done 3
CHECK EXIT 0

# ריצה חוזרת על אותן דירות (צפוי: לא מרנדרת כלום)
$ $PY Habait/flyover/batch/batch_units.py --units Habait/engine/_local/rainbow/units.json --run --limit 3 --only descend-846,descend-836,descend-856 --no-scene-dataset
checks: 84/84 pass
[batch] queue: 3 jobs (3 done); --limit 3 per Kaggle session; s/frame for estimates 8.5 (measured (card 22))
  1 descend-846    descend  846       16 L@164.5   2048x1024   128      120      120     0  done
  2 descend-836    descend  836       15 L@164.5   2048x1024   128      120      120     0  done
  3 descend-856    descend  856       17 L@164.5   2048x1024   128      120      120     0  done
[batch] nothing to render: every queued job is on disk (3 jobs); progress -> Habait/flyover/batch/_local/batch-progress.json
SECOND RUN EXIT 0
frames before 360 after 360; content md5 before ee3845afb051 after ee3845afb051

$ $PY Habait/flyover/batch/batch_units.py --selftest   ->   selftest: 14/14 pass (exit 0)
```
- **כסף:** **$0.** ‏Kaggle חינם, בלי ledger. מכסת GPU שבועית: הכרטיס הזה השתמש בכ-1.0 ש' (0.86 בסשן המועיל, 0.05 ב-probe, והשאר בביטולים). החשבון ב-6.67 מתוך 30 ש', מתאפס ב-7.11 00:00 UTC.
- **פגמים פתוחים:**
  1. **enter-846 והזנב 97–120 לא רונדרו.** ‏Kaggle מבטל כל ריצה שמחברת את `habait-batch-scenes` (4/4). כדי להתקדם צריך אחד מאלה:
     - לפתוח את דף ה-dataset ב-kaggle.com (אלירן) ולבדוק אם יש סימון או אזהרה, או לברר אם מישהו מבטל ידנית;
     - להעלות מחדש ב-slug אחר או כ-zip, רק את `enter846.packed.blend`.
     כל ניסיון עולה 0.02–0.09 ש' מכסה. אחרי זה: `--run --limit 2 --only enter-846,tail-846`.
  2. **בלי תאורת התקרה של 846:** ה-descend רונדר עם `--scene-blend ''`, כמו ה-approach של 18. `scene.blend` ישב באותו dataset שבוטל. מסומן ב-progress לכל דירה (`scene_blend: ""`).
  3. **8.5 ש'/פריים, פי 2 מה-approach:** האומדן של הכרטיס ("~40 ש' לכל המגדל ב-2K") היה גבוה מדי. בפועל 3.4 ש'.
  4. **M מהיר:** ‏131 מ' ב-120 פריימים, שיא 39 מ'/ש' (שאר הקבוצות כ-21). הכרעת T0: 120 פריימים לכולן, אותו תזמון. ~226 פריימים יתנו את המהירות של שאר הקבוצות.
  5. **K/M/PH הם stacked-approx** (חזית ופתח מהפלטה, לא מתכנית). כשהתכניות שלהם ישורטטו, מרנדרים מחדש רק את הקבוצה.
  6. ‏836/856 (ובהמשך כל קומה שאינה 16) נגמרים מול זיגוג אטום: ל-site.glb אין פנים לקומות האלה. enter קיים רק ל-846.
  7. השמות `descend-846` (התווית) מול `apt846` (ה-id ב-units.json): ב-progress יש גם `id` וגם `label`.
  8. הנתיבים שבכרטיס (`Habait/flyover/batch_units.py`, `Habait/flyover/_local/...`) הותאמו ל-`Habait/flyover/batch/` ול-`equirect/_local/segments/`, לפי ה-brief.
- **קורא שני:** **habait-98 (habait-ba)**.
  - מה הוא מקבל: `Habait/flyover/equirect/_local/segments/descend-846/frames/` = ‏120 פריימי equirect ב-2048×1024 (clay ב-AgX, בלי תאורת תקרה) ל-:8899 ולפלואו של 846. ה-camera.json זהה לזה של כרטיס 19, ולכן ה-hotspots של 19 חלים עליו כמו שהם (global 673–792). פריים 120 = ‏1.5 מ' מחוץ ל-o-5, ‏yaw 288.72, וזה גם פריים 1 של enter-846 (הפרש 1.7 מ"מ). יש גם descend-836 ו-856.
  - מה מחייב אותו: שינוי ב-`end_pose` של `orbit/camera.json` או ב-descend-846 של path.json משנה את הפוזות ומבטל את הפריימים.
  - **לתפר של כרטיס 20:** הזנב על סצנת enter ו-enter-846 בדראפט לא רונדרו, כך שהתפר AgX/clay מול emission/Standard עדיין פתוח. ההכרעה בנגן (חיתוך או crossfade) מחכה לזנב.
- **הפקודה ל-9 הדירות שנשארו** (בערך 2.6 ש', סשן אחד, בלי ה-dataset): `$PY Habait/flyover/batch/batch_units.py --units Habait/engine/_local/rainbow/units.json --run --limit 9 --no-scene-dataset`
- **לזיכרון:** כרטיס 22 PARTIAL (2.11 19:35): `Habait/flyover/batch/batch_units.py` מאחד 12 דירות ל-4 מסלולי descend (L/K/M/PH, הסטת 3.2 מ' לקומה, `path.json#descend_template`). descend-846/836/856 רונדרו ב-Kaggle ב-2048×1024 128spp: 8.5 ש'/פריים, 0.86 ש' מכסה; כל המגדל ≈ 3.4 ש'. enter-846 וזנב 97–120 לא רונדרו: Kaggle ביטל 4/4 ריצות שחיברו את ה-dataset `habait-batch-scenes`. $0.

## המשך: enter-846 (שעון המכונה)

_(סוכן `cloud-render` עבור habait-1d. התחיל ב-2.11 בערך ב-19:45, נקטע על מגבלת המנוי בערך ב-19:50, והמשיך ב-3.11 בין 05:43 ל-05:58 שעון המכונה. שתי דחיפות kernel, ‏$0, דרגה T0.)_

- **מצב: CANCELLED AGAIN.** ‏enter-846 והזנב 97–120 עדיין לא רונדרו. עצרתי אחרי 2 דחיפות, כמו שה-brief קבע, ולא דחפתי kernel שלישי.
- **מה מצאתי:**
  1. **מצב החשבון לפני הריצות.**
     - כל ה-kernels היו במצב סופי. ‏`habait-batch-render` ו-`habait-route-a-cycles` היו CANCEL_ACKNOWLEDGED. ‏probe, ‏equirect-render, ‏B1, ‏B2 ו-gpu-check היו COMPLETE.
     - שני ה-datasets היו `ready`. לפי `kaggle datasets list -m` יש לחשבון 4 datasets פרטיים, עם מטא-דאטה זהה במבנה (private, ‏license other).
     - גם `kernels_status` המלא של ה-API מחזיר רק status, בלי failureMessage.
  2. **השערה 1: חיבור של שני datasets.**
     - למה היא נראתה סבירה: גם `habait-route-a-cycles` של ab (שני datasets אחרים: `habait-orbit-inputs` ו-`habait-orbit-camera`) בוטל באותה חתימה, והלוג שלו נקטע 29–42 ש' לתוך הריצה. כל ריצה עם dataset אחד הושלמה.
     - **נפרכה בדחיפה 1:** ‏kernel v6 עם `habait-batch-scenes` בלבד בוטל גם הוא.
  3. **השערה 2: ישות ה-dataset או הבייטים הדחוסים.**
     - ממצא חדש: שני הקבצים ב-`habait-batch-scenes` הם ‏.blend דחוסים ב-zstd (magic `28 b5 2f fd`, האפשרות Compress של Blender). לכן gzip נפסל: Blender לא פותח דחיסה כפולה.
     - **נפרכה בדחיפה 2:** dataset חדש, `eliranhabait/habait-enter846-raw`, ובו הסצנה הארוזה בלי דחיסה, בוטל באותו אופן.
     - הקובץ נפרס ב-`zstd -d`: ‏200,890,827 בייט, header ‏`BLENDER-v405`, ‏10,339 בלוקים שמגיעים בדיוק ל-ENDB, ‏38 תמונות.
  4. **מה נשאר משותף.** שני דברים מופיעים בכל 6 הביטולים שלנו (v1–v3, ‏v5–v7) ולא באף אחת מ-3 הריצות שהושלמו (v4, ‏probe, ‏approach):
     - (א) Blender פותח ‏.blend מתוך `/kaggle/input`: ‏scene.blend ב-v1–v3, הסצנה הארוזה ב-v5–v7.
     - (ב) ה-kernel מטמיע את enter.py כ-blob של base64 בגודל כ-70 kB. ה-kernel כולו 90–159 kB, ואילו בריצות שהושלמו הוא עד 82 kB וה-blob עד 44.5 kB.
     - ב-enter.py לא מצאתי שום דבר חשוד (אין רשת ואין subprocess). (א) ו-(ב) מתואמים לגמרי, ואי אפשר להפריד ביניהם בלי עוד דחיפות.
     - הביטולים של route A לא מוסברים באף אחת מההשערות (kernel של 21.6 kB, בלי ‏.blend). הם חפפו לסשנים של B1/B2, וייתכן שבוטלו ידנית.
  5. **התזמון קבוע.** הביטול מגיע תמיד 31–58 ש' לתוך ה-kernel: אחרי הורדת Blender (כ-27 ש'), ותוך 5–25 ש' מהרגע ש-Blender ניגש ל-‏.blend. אין שגיאה ואין failureMessage, ולכן זה כנראה מנגנון בצד של Kaggle (אכיפה אוטומטית או סורק), לא הקוד שלנו.
- **הכרעות T0:**
  - דחיפה 1 בלי העלאה: ל-enter ול-tail אין `base_needed`, ולכן המבחן הזול ביותר הוא kernel שמחבר רק את `habait-batch-scenes`.
  - דחיפה 2 ב-dataset חדש ולא בגרסה חדשה של `habait-equirect-inputs`, כדי לא לסכן את ה-dataset שמסלול ה-descend תלוי בו.
  - 2048×1024 ו-128 spp, לפי ה-brief.
  - timeout לכל תהליך Blender: ‏enter 1500 ש', ‏tail 600 ש'. כך הסשן לא עובר כ-40 דק' GPU, ומה שרונדר לפני ה-timeout עדיין נארז ונמשך.
- **מה הרצתי.**
  - wrapper בסקראצ'פד של הסשן: `C:\Users\elira\AppData\Local\Temp\claude\C--RnD\ab1c1ddb-4eb7-4f30-b08b-cc28a1d08a55\scratchpad\enter_one_dataset.py`. הוא מייבא את `batch_units.py` ואת `push_pull.py` כמו שהם, ומחליף בזיכרון בלבד את `dataset_sources` (בלי ה-dataset הבסיסי כש-`base_needed == []`), את ה-timeouts, ובדחיפה 2 את ה-dataset הנוסף. **אף קובץ קוד בריפו לא נערך.**
  - לפני כל דחיפה: `--stage` בלי רשת, בדיקה ש-`kernel-metadata.json` מכיל dataset אחד ו-`timeout_s` ‏1500/600, ו-`kaggle kernels status` במצב סופי.
```
# דחיפה 1 (kernel v6): dataset אחד = habait-batch-scenes
$PY <scratchpad>/enter_one_dataset.py -- --units Habait/engine/_local/rainbow/units.json --run --limit 2 --only enter-846,tail-846 --enter-res 2048x1024 --enter-samples 128 --wait 3300 --slot-wait 600 > Habait/flyover/batch/_local/run-session6.out
# הכנה לדחיפה 2: הסצנה בלי דחיסה (zstd של anaconda, לא Blender)
/c/Users/elira/anaconda3/Library/bin/zstd -d -f -q Habait/flyover/enter/_local/enter846.packed.blend -o <scratchpad>/enter846raw/enter846.packed.blend
# דחיפה 2 (kernel v7): dataset חדש habait-enter846-raw, ‏dataset אחד
$PY <scratchpad>/enter_one_dataset.py --extra-slug habait-enter846-raw --extra-file <scratchpad>/enter846raw/enter846.packed.blend -- <אותם ארגומנטים> > Habait/flyover/batch/_local/run-session7.out (ניסיון א), run-session7b.out (ניסיון ב)
```
- **ציר זמן (3.11.2026, שעון המכונה):**
  - **05:43:** המשך. מצב החשבון, ה-datasets והמכסה (6.67 מתוך 30 ש').
  - **05:47:17–05:48:22, דחיפה 1 (kernel v6):** ‏RUNNING ב-05:47:40, ‏**CANCEL ב-05:48:22** (59 ש' מהדחיפה).
    - בלוג: הורדת Blender ב-1.4–26.6 ש'.
    - 28.5 ש': ‏`blender -b /kaggle/input/datasets/eliranhabait/habait-batch-scenes/enter846.packed.blend`.
    - 37.0 ש': ‏`[dev] OPTIX ['Tesla T4', 'Tesla T4']`. אחרי זה כלום.
  - **05:51:** נמצא שהסצנה דחוסה ב-zstd. **05:52:48:** ‏`zstd -d` (שנייה אחת) ובדיקת המבנה.
  - **05:53:26, דחיפה 2, ניסיון א:**
    - `datasets create habait-enter846-raw` הצליח (rc 0).
    - `wait_dataset` של push_pull יצא כבר בבדיקת הסטטוס הראשונה, כי ה-CLI החזיר שגיאה ל-dataset שעוד לא היה גלוי. היציאה (exit 1) הייתה **לפני** דחיפת ה-kernel, ולכן לא נצרך GPU.
    - 05:54:09: ה-dataset ‏`ready`.
  - **05:54:26–05:55:51, דחיפה 2, ניסיון ב (kernel v7):** ‏`datasets version` (גרסה 2, אותו קובץ) → ‏ready → ‏kernel v7 ‏→ RUNNING ב-05:55:09 ‏→ **CANCEL ב-05:55:51** (58 ש').
    - בלוג: הורדה ב-1.5–28.7 ש'.
    - 28.9 ש': ‏`blender -b /kaggle/input/habait-enter846-raw/enter846.packed.blend`. זה נתיב mount מהסוג הישן. אחרי זה כלום.
  - **05:57:** ה-Check, ספירות ומכסה.
- **פריימים על הדיסק, לפני → אחרי:**
  - `enter-846/frames`: ‏3 → 3. אלה פריימים 1, 34, 96 ב-512×256 מכרטיס 20, והם לא זזו.
  - `descend-846/tail-enter-scene/frames`: ‏0 → 0 (התיקייה לא קיימת).
  - `descend-846/836/856/frames`: ‏120/120/120 → 120/120/120.
  - ב-`batch-progress.json`: ל-846 ‏`enter_done: false` ו-`tail_done: false`; ‏7 סשנים (cancel×3, ‏complete, ‏cancel×3); ‏`quota_h_used_total` 1.02.
  - `--run` של batch_units כתב מחדש את `descend-*/camera.json` של 12 הדירות (כך הכלי עובד). בדקתי ש-descend-846 זהה למה שנשלח ב-v4: ‏Δpos 0.0, ‏Δyaw 0.0, ‏globals 673–792, פריים 120 ב-yaw 288.715. ה-hotspots של כרטיס 19 עדיין תקפים.
- **מכסה:** לפני 6.67 ש' (23.33 פנויות מתוך 30), אחרי **6.69 ש'** (23.31 פנויות). ההמשך הזה השתמש בכ-0.03 ש': שתי ריצות של כדקה (push_to_complete 59 ו-58 ש'). המכסה מתאפסת ב-7.11 00:00 UTC. **כסף: $0**, בלי ledger.
- **ב-Kaggle עכשיו (הכול פרטי):**
  - dataset חדש `eliranhabait/habait-enter846-raw`: גרסה 2, ‏`enter846.packed.blend` לא דחוס, 201 MB.
  - ה-kernel ‏`habait-batch-render` עד v7.
  - `habait-equirect-inputs` לא נגעתי בו.
- **קבצים שנכתבו** (רק תוצרי הכלים ובלוק זה):
  - `Habait/flyover/batch/_local/`: ‏`run-session6.out`, ‏`run-session7.out`, ‏`run-session7b.out`, ‏`last-session-spec.json`, ‏`batch-progress.json`, ‏`kaggle-cams/cam_{enter,tail}-846.json`.
  - `Habait/flyover/kaggle/_local/`: ‏`kaggle-log.jsonl` (2 שורות kaggle-batch נוספו), ‏`runs/batch_20261103-054719/`, ‏`runs/batch_20261103-055449/`, ‏`kernel-habait-batch-render/` (v7), ‏`dataset-habait-enter846-raw/` (hard link לקובץ של 201 MB), ‏`dataset-pushed-habait-enter846-raw.json`, ועדכוני `dataset-metadata.json` של הכלים.
  - אין פריימים חדשים.
- **פלט ה-Check (מילה במילה; הנתיבים מותאמים כמו בבלוק התוצאה):**
```
$ cd C:/RnD/Projects/Habait/habait-walkaround && export PYTHONIOENCODING=utf-8 && PY=/c/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe && $PY Habait/flyover/batch/batch_units.py --units Habait/engine/_local/rainbow/units.json --dry-run && $PY -c "import json;p=json.load(open('Habait/flyover/batch/_local/batch-progress.json'));d=[u for u in p['units'] if u['done']];print('done',len(d));exit(0 if len(d)>=3 else 1)"
[batch] units Habait/engine/_local/rainbow/units.json: 12 units -> 4 unique descend paths (dedup by type x facade azimuth x footprint; height offset 3.2 m per floor)
group     rule              facade  end xy (floor 16)   units (floor)                                 len m
L@164.5   traced            164.3d  [11.75, -11.63]     846 (16), 836 (15), 856 (17), 826 (14), 866 (18)   68.5
          facade: o-5 of apt846 (plan.json), 1.5 m out on the living terrace
K@169     stacked-approx    169.1d  [10.37, -19.23]     845 (16), 835 (15), 855 (17)                   68.9
          facade: plate edge 17 (8.4 m) 6.25 m from the box centre
M@91.5    stacked-approx     91.3d  [5.08, 2.59]        847 (16), 837 (15), 857 (17)                  130.7
          facade: plate edge 20 (18.2 m) 6.29 m from the box centre
PH@162.5  stacked-approx    162.5d  [7.13, -25.0]       876 (19)                                       69.3
          facade: plate edge 15 (8.9 m) 6.42 m from the box centre
  [PASS] template(L@164.5, floor 16) = descend-846: 120 vs 120 poses, max deviation 0.0e+00 m / 0.0e+00 deg, globals 673-792
  [PASS] group L@164.5 is one path: types ['L'], azimuths [164.5], footprints 1, floors [16, 15, 17, 14, 18] (z0 on the 3.2 m pitch: True)
  [PASS] group K@169 is one path: types ['K'], azimuths [169.0], footprints 1, floors [16, 15, 17] (z0 on the 3.2 m pitch: True)
  [PASS] group M@91.5 is one path: types ['M'], azimuths [91.5], footprints 1, floors [16, 15, 17] (z0 on the 3.2 m pitch: True)
  [PASS] group PH@162.5 is one path: types ['PH'], azimuths [162.5], footprints 1, floors [19] (z0 on the 3.2 m pitch: True)
  [PASS] no two groups share a key: 4 keys
  [PASS] every unit in exactly one group: 12 of 12
  [PASS] per-unit path checks (--verbose for each): 846 7/7, 836 7/7, 856 7/7, 826 7/7, 866 7/7, 845 6/6, 835 6/6, 855 6/6, 847 6/6, 837 6/6, 857 6/6, 876 6/6
checks: 84/84 pass
[batch] queue: 14 jobs (3 done); --limit 5 per Kaggle session; s/frame for estimates 8.5 (measured (card 22))
  # job            kind     unit   floor group     res         spp   frames  on disk  todo  next
  1 descend-846    descend  846       16 L@164.5   2048x1024   128      120      120     0  done
  2 enter-846      enter    846       16 -         1024x512     16       96        0    96  <- session (+3 other res)
  3 tail-846       tail     846       16 -         1024x512     16       24        0    24  <- session
  4 descend-836    descend  836       15 L@164.5   2048x1024   128      120      120     0  done
  5 descend-856    descend  856       17 L@164.5   2048x1024   128      120      120     0  done
  6 descend-826    descend  826       14 L@164.5   2048x1024   128      120        0   120  <- session
  7 descend-866    descend  866       18 L@164.5   2048x1024   128      120        0   120  <- session
  8 descend-845    descend  845       16 K@169     2048x1024   128      120        0   120  <- session
  9 descend-835    descend  835       15 K@169     2048x1024   128      120        0   120  
 10 descend-855    descend  855       17 K@169     2048x1024   128      120        0   120  
 11 descend-847    descend  847       16 M@91.5    2048x1024   128      120        0   120  
 12 descend-837    descend  837       15 M@91.5    2048x1024   128      120        0   120  
 13 descend-857    descend  857       17 M@91.5    2048x1024   128      120        0   120  
 14 descend-876    descend  876       19 PH@162.5  2048x1024   128      120        0   120  
[batch] projection: whole tower 1440 descend frames = 3.4 GPU h at 2048x1024 (left 2.55 h); final 4096x2048 = 13.6 h; + ~4 min per session
[batch] dry-run: the next session would carry 5 jobs: enter-846, tail-846, descend-826, descend-866, descend-845; writes nothing
done 3
CHECK EXIT 0
```
- **פגמים פתוחים** (לבעלים של `batch/` ו-`kaggle/`, ‏habait-1d):
  1. **enter-846 והזנב לא רונדרו ב-Kaggle.** אם רוצים ניסיון נוסף (דחיפה אחת, כ-0.02 ש'): kernel בלי ה-blob של enter.py ובלי פתיחה ישירה של ‏.blend מ-`/kaggle/input`.
     - הדרך: loader קטן מוטמע (כ-15 kB, כמו ה-probe) שמעתיק את הסצנה ל-`/tmp`, וקורא את enter.py ואת קבצי המצלמה מה-dataset `habait-enter846-raw`.
     - זה דורש שינוי ב-`push_pull.py` / `kernel_driver.py`, כי היום הסקריפט חייב להיות מוטמע.
  2. **מסלול שלא תלוי ב-Kaggle.** הסצנה הזו רונדרה ב-CPU מקומי בכרטיס 20, ב-0.77 ש'/פריים ב-512×256 ‏16 spp.
     - דראפט 1024×512 ‏16 spp: כ-3 ש'/פריים, כלומר כ-6 דק' ל-120 פריימים, על ה-Blender של המחשב (של 98).
     - 2048×1024 ‏128 spp מקומית: כ-3.3 ש' CPU.
     - הפקודות בשורת הקורא השני.
  3. **`push_pull.wait_dataset`** יוצא מיד אחרי `datasets create`, כי הבדיקה הראשונה מקבלת שגיאה (ה-dataset עוד לא גלוי) והפונקציה מחזירה False על "error" עם rc≠0. התיקון: לא לצאת על שגיאה בדקה הראשונה.
  4. **ברירת המחדל `--enter-res 1024x512`** ב-batch_units: אם enter ירונדר אי פעם ב-2048×1024, כל `--rescan` או `--run` בלי `--enter-res 2048x1024 --enter-samples 128` יסמן אותו כלא גמור ויזיז את הפריימים הצידה.
  5. **ה-READMEs לא מעודכנים:** `batch/README-he.md` ו-`kaggle/README-he.md` עדיין קושרים את הביטול ל-dataset ‏`habait-batch-scenes`, וזה הופרך ב-v6 וב-v7.
  6. **לא כתבתי ל"העברות" ב-README של הלוח,** כי ה-brief אסר לגעת בו. השורה למטה מיועדת להעברה על ידי הסשן המפעיל.
- **קורא שני: habait-98 (habait-ba).**
  - אין פריימי enter/tail מ-Kaggle, ולא יהיו בלי שינוי ב-kernel. התפר descend→enter נשאר פתוח.
  - הפריים האחרון שקיים הוא descend-846 פריים 120: ‏clay ב-AgX, ‏1.5 מ' מחוץ ל-o-5, ‏yaw 288.72.
  - אם רוצים את הזנב ואת הכניסה עכשיו, זה כ-6 דק' CPU על ה-Blender של 98 (דראפט 1024×512 ‏16 spp), בלי Kaggle. הנתיבים ב-`Habait/flyover` שייכים ל-1d, ולכן 1d מבקש או מאשר:
```
cd /c/RnD/Projects/Habait/habait-walkaround
mkdir -p Habait/flyover/equirect/_local/segments/enter-846/frames-512x256 && mv Habait/flyover/equirect/_local/segments/enter-846/frames/frame_00{01,34,96}.png Habait/flyover/equirect/_local/segments/enter-846/frames-512x256/
timeout 1800 "$BLENDER" -b Habait/flyover/enter/_local/enter846.packed.blend --factory-startup -P Habait/flyover/enter.py -- --render --res 1024x512 --samples 16 --frames 1-96
timeout 900 "$BLENDER" -b Habait/flyover/enter/_local/enter846.packed.blend --factory-startup -P Habait/flyover/enter.py -- --render --camera-json Habait/flyover/equirect/_local/segments/descend-846/camera.json --out Habait/flyover/batch/_local/tail-local --segment descend-846 --res 1024x512 --samples 16 --frames 97-120
# then: move batch/_local/tail-local/descend-846/frames/* to equirect/_local/segments/descend-846/tail-enter-scene/frames/ ; batch_units.py --units ... --rescan
```
  - ה-`--out` הנפרד לזנב חובה. בלעדיו `--segment descend-846` כותב לתיקיית ה-descend של ה-clay (פריימים קיימים מדולגים, ועם `--force` הם נדרסים).
- **לזיכרון:** כרטיס 22, המשך (3.11 05:57): ‏enter-846 והזנב עדיין לא רונדרו. Kaggle ביטל גם kernel עם dataset יחיד (v6) וגם dataset חדש עם ‏.blend לא דחוס (v7), ‏31–58 ש' לתוך הריצה, כש-Blender פותח ‏.blend מ-/kaggle/input, בלי failureMessage. הופרכו: שני datasets, ישות ה-dataset, ‏zstd. נשאר: ‏.blend מה-mount או ה-blob של enter.py ‏(70 kB). מכסה 6.67→6.69 ש', ‏$0. חלופה: דראפט CPU מקומי של כ-6 דק'.
