# batch: כל דירות המגדל, descend לכל דירה + enter-846, בבאצ' על Kaggle (כרטיס 22, ערוץ C6ב)

מטרה: `descend-<unit>` לכל דירה ב-`units.json` בלי לרנדר מסלול לכל דירה. מסלול descend אחד לכל קבוצה (טיפוס × אזימוט חזית × טביעת רגל), ומוסטים אותו בגובה לפי הקומה. `enter` יש רק ל-846, כי הוא צריך את הפנורמות של הדירה (הסצנה הארוזה של כרטיס 20). הכול רץ בחוות Kaggle החינמית של כרטיס 18, עם resume ודוח התקדמות. $0.

## קבצים

| קובץ | מה |
|---|---|
| `batch_units.py` | דה-דופליקציה, מסלולים, בדיקות, תור, הרצה (Kaggle או runner מזויף), `batch-progress.json`, selftest |
| `render_cameras.py` | מרנדר equirect מכל `camera.json` על סצנת ה-clay של `site.glb`, עם אותן פונקציות של `render_segments.py` (exec לקריאה בלבד, כמו ב-enter.py): `build_glb_scene`, `setup_cycles`, `blender_camera`, `level_matrix`, `render_still`. תהליך Blender אחד מרנדר כמה דירות |
| `_local/batch-progress.json` | המצב: יחידות (`done`), עבודות, סשנים של Kaggle (מכשיר, ש'/פריים, שעות מכסה), תחזית לכל המגדל |
| `_local/last-session-spec.json`, `_local/kaggle-cams/` | מה נשלח בסשן האחרון (שורות מצלמה מינימליות, מוטמעות ב-kernel) |
| `_local/run-session*.out` | הפלט של כל הרצה |

הפלטים (מיקום כרטיס 17, `Habait/flyover/equirect/_local/segments/`):
- `descend-<unit>/camera.json` + `frames/frame_0001..0120.png` (2048×1024, 128 spp)
- `enter-846/frames/frame_0001..0096.png` (1024×512, 16 spp; ה-`camera.json` של כרטיס 20 בקריאה בלבד). **עוד לא רונדר**, ראו "Kaggle מבטל". כשיחזור, שלושת פריימי הבדיקה של כרטיס 20 (512×256) יוזזו ל-`enter-846/frames-512x256/` ולא יידרסו
- `descend-846/tail-enter-scene/frames/frame_0097..0120.png` (1024×512, 16 spp): זנב ה-descend על הסצנה של enter, לתפר descend→enter (בקשת כרטיס 20). **עוד לא רונדר**

שינויים מחוץ לתיקייה (additive בלבד):
- `../equirect/path.json`: מפתח חדש `descend_template` (הבסיס, משתנה הגובה, כלל הסיום, מפתח הקבוצה). ארבעת הקטעים לא השתנו; `render_segments.py --dry-run` עדיין 17/17.
- `../kaggle/push_pull.py`: מצב batch (`--batch-spec`, ‏`--script/--blend/--script-args`, ‏`run_batch`, ‏`unpack_batch`, ‏dataset נוסף, kernel נפרד `habait-batch-render`). מסלול ברירת המחדל לא השתנה.
- `../kaggle/kernel_driver.py`: ענף `run_batch_mode()` שרץ רק כש-`JOB.mode == "batch"`, ואז `SystemExit(0)`. הקוד הקיים לא השתנה.

## הדה-דופליקציה (הכרעת T0)

מפתח הקבוצה: (טיפוס, אזימוט החזית בעיגול ל-0.5°, מלבן טביעת הרגל של `box_world` בעיגול ל-5 ס"מ). שתי דירות מאותו טיפוס באזימוטים שונים, או באותו אזימוט בטביעות רגל שונות, לא מתאחדות (נבדק ב-selftest עם דירת L מדומה על החזית המערבית). דירות מאותה קבוצה שונות רק ב-`dz = (floor − 16) × 3.2`, שחייב להיות שווה ל-z0 של ה-box שלהן.

**12 דירות → 4 מסלולים:**

| קבוצה | כלל הסיום | חזית (true) | דירות (קומה) |
|---|---|---|---|
| `L@164.5` | traced: o-5 של 846 מתוך plan.json, 1.5 מ' החוצה על מרפסת הסלון | 164.3° | 846 (16), 836 (15), 856 (17), 826 (14), 866 (18) |
| `K@169` | stacked-approx: קצה פלטה 17, 1.5 מ' מחוץ לחזית | 169.1° | 845 (16), 835 (15), 855 (17) |
| `M@91.5` | stacked-approx: קצה פלטה 20 (החזית המזרחית) | 91.3° | 847 (16), 837 (15), 857 (17) |
| `PH@162.5` | stacked-approx: קצה פלטה 15 | 162.5° | 876 (19) |

- **הבסיס הוא descend-846 עצמו:** התבנית ב-(L, קומה 16) משחזרת את 120 הפוזות של `render_segments.build_path` בסטייה 0.0 מ' / 0.0° (נבדק בכל ריצה).
- **ההתחלה** תמיד node-b-tower (פוזת ה-hold) ולא זזה: כל descend מתפצל מלופ ההמתנה.
- **traced** (טיפוס L, טביעת הרגל של 846 בדיוק, bay 0 ב-stack_units): העוגנים של descend-846 + dz.
- **stacked-approx** (K/M/PH): טביעות הרגל והפתחים שלהם לא ידועים עד שמשרטטים את התכניות. החזית = קצה פלטת הקומה (`units-geometry.json building.plate_en`) שקרן מ-מרכז ה-box בכיוון הנורמל החיצוני שלו פוגעת בו ראשונה; "הפתח" = נקודת הפגיעה; הסיום = 1.5 מ' החוצה לאורך הנורמל, בגובה עיניים 1.6, במבט פנימה. העוגנים node-e/f/c/d של descend-846 מוצבים מחדש במסגרת הסיום הזו (סיבוב סביב z + הזזה), ואז + dz.
- למה לא פשוט הזזת ה-o-5 של 846 בהסטת ה-stack: ל-M ההסטה היא 8.25 מ' פנימה, ואז ה-o-5 המוזז נמצא 10.7 מ' בתוך הפלטה, כלומר בתוך המגדל. ה-box של M נשען על הקצה הצפון-מזרחי (קצה 20), ולכן החזית שלו מזרחית.
- בדיקות לכל דירה (84 בסך הכול): dz = z0, סיום בגובה עיניים ובמבט פנימה, סיום ליד ה-box ובקומה שלו, התחלה ב-node-b, אף פריים לא בתוך הפלטה (ל-L: רק 5 הפריימים האחרונים על המרפסת, ≤ 0.27 מ' מהקצה, כניסה בגובה 1.62 מעל הרצפה, בין המעקה לתקרה), מעל הקרקע. בנוסף נבדק שאף פריים לא בתוך bbox של בניין שכן או של הפודיום ב-site.glb (156 קופסאות, 0 פגיעות).

## התור

1. `descend-846` ← 2. `enter-846` (סצנה ארוזה, 1024×512, 16 spp) ← 3. `tail-846` (descend-846 פריימים 97–120 על סצנת enter) ← 4–5. `descend-836`, `descend-856` (L בקומות אחרות) ← השאר: L (826, 866), K, M, PH, הקומה הקרובה קודם.

`--limit N` = N עבודות בסשן GPU אחד. כל ה-descend של סשן רצים בתהליך Blender אחד (הסצנה נבנית פעם אחת). enter ו-tail הם תהליך לכל אחד על `enter846.packed.blend`.

**Resume:** פריים קיים ברזולוציה של העבודה (לפי IHDR של ה-PNG) ובגודל ≥ 2 KB נחשב גמור. עבודה נשלחת רק עם הפריימים החסרים שלה, כך שסשן שנקטע או נכשל ממשיך ממה שנחת. פריים מקומי ברזולוציה אחרת מוזז הצידה ל-`frames-<w>x<h>/` לפני שנכתב החדש. קובץ ההתקדמות נכתב מחדש אחרי כל pull, ותמיד מכסה את כל 12 הדירות, גם עם `--only`.

## פקודות (Git Bash)

```bash
cd /c/RnD/Projects/Habait/habait-walkaround && export PYTHONIOENCODING=utf-8
PY=/c/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe

$PY Habait/flyover/batch/batch_units.py --units Habait/engine/_local/rainbow/units.json --dry-run      # דה-דופליקציה + בדיקות + תור; לא כותב כלום
$PY Habait/flyover/batch/batch_units.py --units Habait/engine/_local/rainbow/units.json --run --limit 5 --stage   # בונה kernel + dataset, בלי רשת
$PY Habait/flyover/batch/batch_units.py --units Habait/engine/_local/rainbow/units.json --run --limit 9   # סשן Kaggle אחד
$PY Habait/flyover/batch/batch_units.py --units Habait/engine/_local/rainbow/units.json --rescan          # progress מהדיסק
$PY Habait/flyover/batch/batch_units.py --selftest                                                        # runner מזויף, בלי רשת ובלי Blender
```

ה-Check של הכרטיס, בנתיבים המותאמים:

```bash
cd C:/RnD/Projects/Habait/habait-walkaround && export PYTHONIOENCODING=utf-8 && PY=/c/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe && $PY Habait/flyover/batch/batch_units.py --units Habait/engine/_local/rainbow/units.json --dry-run && $PY -c "import json;p=json.load(open('Habait/flyover/batch/_local/batch-progress.json'));d=[u for u in p['units'] if u['done']];print('done',len(d));exit(0 if len(d)>=3 else 1)"
```

## Kaggle

- kernel נפרד: `eliranhabait/habait-batch-render` (ה-kernel של כרטיס 18, `habait-equirect-render`, לא נגעתי בו).
- datasets: `habait-equirect-inputs` של כרטיס 18, ממוחזר כמו שהוא כל עוד הקבצים שהבאצ' קורא לא השתנו (site.glb, nodes.json, orbit_clay.py, HDRI, orthophoto). בנוסף `eliranhabait/habait-batch-scenes` (פרטי): `enter846.packed.blend` (134 MB, כרטיס 20) ו-`scene.blend` (0.86 MB, תאורת התקרה של 846, בקריאה בלבד מה-Studio).
- ל-descend הבאצ' מעלה (כברירת מחדל) את `scene.blend`, כך שתאורת התקרה של 846 נדלקת, וזה היה אמור לסגור את פגם 1 של כרטיס 18. בפועל Kaggle ביטל כל ריצה עם ה-dataset הזה (ראו למטה), ולכן הפריימים שנמצאים על הדיסק רונדרו עם `--no-scene-dataset`, בלי התאורה.
- D-WQ-18: אין מיתוג ואין רפרנסים שיווקיים של היזם. הסצנה הארוזה מכילה את פנורמות ה-GPT של הסיור ואת הסקינים האפויים של כרטיס 15, כמו שהם בפלואו החי. בלי לוגו ובלי טקסט.
- סודות: אותה סריקת בייטים של push_pull לפני כל push (0 פגיעות). המפתח נקרא על ידי ה-CLI מ-`~/.kaggle/kaggle.json` ולא מודפס.

## נמדד (2.11.2026)

- **הסשן שהצליח** (kernel `habait-batch-render` v4, 18:32–19:25 שעון המכונה): descend-846/836/856, ‏360/360 פריימים ב-2048×1024, ‏128 spp, ‏OptiX על 2×T4, ‏OIDN על GPU. **8.5 ש'/פריים** (טווח 5.6–27 ש'; הכבדים ליד החזית), פריים ראשון 15.5 ש', ‏import 4.6 ש', הורדת Blender 26.6 ש'. kernel wall 3104 ש' = **0.862 שעות מכסה** (מכסת החשבון זזה מ-5.79 ל-6.65 ש'). כ-272 MB לדירה.
- זה פי 2 מה-approach של כרטיס 18 (4.15 ש'/פריים): ה-descend קרוב למגדל, עם זכוכית ומעקות בכל המבט.
- **תחזית:** כל המגדל = 1440 פריימי descend = **3.4 ש' GPU** ב-2K. נשארו 9 דירות = 2.55 ש' + ~4 דק', סשן אחד. final ב-4096×2048 ≈ 13.6 ש' (שני סשנים).
- המכסה (`kaggle quota`): ‏6.67 מתוך 30 ש' בשבוע, מתאפסת ב-7.11 00:00 UTC. הכרטיס הזה השתמש בכ-1.0 ש', מהן 0.86 ש' בסשן המועיל.
- הסשן שהצליח רץ עם `--no-scene-dataset`, כלומר `--scene-blend ''`, ולכן **בלי תאורת התקרה של 846**, כמו ה-approach של כרטיס 18 (ראו למטה). `batch-progress.json` רושם לכל דירה `scene_blend`.

## Kaggle מבטל כל ריצה שמחברת את `habait-batch-scenes`

- **4 מתוך 4** ריצות שחיברו את ה-dataset (kernel v1–v3 עם 5 עבודות, ו-v5 עם enter+tail בלבד, 90 kB) קיבלו `CANCEL_ACKNOWLEDGED` 25–90 ש' אחרי RUNNING, בלי `failureMessage`.
- **2 מתוך 2** ריצות בלי ה-dataset הושלמו: probe ‏`habait-batch-probe` (Blender שישן 150 ש', ‏176 ש'), וה-descend של 51 דק'.
- מה נשלל: המכסה תקינה, אין תהליך מקומי שנוגע ב-Kaggle, וגודל ה-kernel לא הגורם (82 מול 90 kB). ב-dataset עצמו (`kaggle datasets files`) שני הקבצים רשומים ומצבו ready.
- לכן **enter-846 וזנב 97–120 לא רונדרו.** שלושת הפריימים של כרטיס 20 ב-512×256 נשארו במקומם.
- הצעד הבא, כשיוחלט: לבדוק בדף ה-dataset ב-kaggle.com אם יש סימון או אזהרה (רק בדפדפן של אלירן), או לשאול אם מישהו מבטל ידנית. אפשרות אחרת: להעלות מחדש ב-slug אחר, כ-zip, או רק את `enter846.packed.blend`. כל ניסיון עולה 0.02–0.09 ש' מכסה.
- הרצה בלי ה-dataset: `--no-scene-dataset` מדלג לבד על enter/tail. ל-9 הדירות שנשארו:
  `$PY Habait/flyover/batch/batch_units.py --units Habait/engine/_local/rainbow/units.json --run --limit 9 --no-scene-dataset` (בערך 2.6 ש').

## פתוח

- **M מהיר:** המסלול של M מסתובב אל החזית המזרחית, 131 מ' ב-120 פריימים, שיא 39 מ'/ש' (ב-L/K/PH השיא כ-21 מ'/ש'). הכרעת T0: נשארים על 120 פריימים, כדי שלכל הדירות יהיה אותו תזמון. אם זה מרגיש מהיר מדי ב-360, אפשר ~226 פריימים ל-M (בערך +20 דק' GPU לשלוש הדירות).
- **K/M/PH הם stacked-approx:** החזיתות והפתחים הם הערכה מהפלטה, לא מתכנית. כשהתכניות שלהם ישורטטו, מחליפים את כלל הסיום ל-traced ומרנדרים מחדש רק את הקבוצות האלה.
- **תפר descend→enter:** descend ב-AgX על clay, enter ב-emission ב-Standard. הזנב 97–120 על סצנת enter מאפשר לבחור נקודת חיתוך או crossfade. זו הכרעה של הנגן (98), לא של הבאצ'.
