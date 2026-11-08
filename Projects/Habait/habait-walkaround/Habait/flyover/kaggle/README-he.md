# kaggle: חוות הרנדר החינמית לטיסת ה-360 (כרטיס 18, ערוץ C3ב)

פקודה אחת מרנדרת פריימים של קטע אחד מ-`../equirect/path.json` עם `../equirect/render_segments.py` (כרטיס 17): ב-Kaggle על GPU (T4×2 / P100, OptiX ואם אין אז CUDA), או מקומית ב-CPU לבדיקה.

## קבצים

| קובץ | מה |
|---|---|
| `push_pull.py` | מכין את ה-dataset הפרטי, דוחף אותו (create או גרסה חדשה, רק אם משהו השתנה), בונה ודוחף את ה-kernel, מחכה, מושך את הפלט, פורס את הפריימים ל-`../equirect/_local/segments/<seg>/frames/` ורושם שורה ב-`_local/kaggle-log.jsonl` |
| `kernel_driver.py` | התבנית של ה-kernel (סקריפט Kaggle, לא ipynb). `push_pull.py` מטמיע בה את `render_segments.py` ב-base64 ואת ה-job ב-JSON → `_local/kernel/kernel_equirect.py` |
| `_local/dataset/` | מה שעולה ל-Kaggle, ורק זה: `site.glb`, `nodes.json`, `path.json`, `camera.json` + `orbit_clay.py` של ab (קריאה בלבד), ה-HDRI ‏`qwantani_noon_puresky_4k.hdr` (CC0), `orthophoto-far.png(.json)` (Esri, הקרקע הרחוקה של ה-clay). בלי מיתוג ובלי רפרנסים שיווקיים של היזם (D-WQ-18) |
| `_local/runs/<run>/` | הפלט הגולמי של כל ריצה (tar של הפריימים, `summary_eq.json`, `render_log.json`, הלוג של ה-kernel) |
| `_local/kaggle-log.jsonl` | שורה לכל ריצה: מכשיר, פריימים, ש'/פריים, שעות מכסה, הערכה ל-480 ול-792 פריימים ב-4K, איפה הפריימים נחתו, hash של הקלטים |

המבנה לקוח מ-`../cloud/A-blender-cycles/kernel_a_driver.py` של ab (אותו tarball של Blender 4.5.10, אותו הדהוד חי של שורות `[dev]/[frame]/[done]`, כי ריצה שבוטלה לא משאירה ב-Kaggle פלט, רק לוג). **שם לא נגעתי.** `render()` שם לא עובד כמו שהוא עם `render_segments.py`, כי הוא מעביר `--camera-json` ו-`--sun_elev/--sun_az/--look`, ש-`render_segments.py` לא מקבל. לכן יש כאן דרייבר משלי.

## פקודות (Git Bash)

```bash
cd /c/RnD/Projects/Habait/habait-walkaround && export PYTHONIOENCODING=utf-8
PY=/c/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe

$PY Habait/flyover/kaggle/push_pull.py --seg approach --frames 1-48 --dry-run            # הכנה בלבד, בלי רשת
$PY Habait/flyover/kaggle/push_pull.py --seg approach --frames 1-48 --res 2048x1024      # Kaggle (ברירת מחדל 128spp)
$PY Habait/flyover/kaggle/push_pull.py --seg approach --frames 1-48 --pull-only         # למשוך שוב אחרי timeout
timeout 600 $PY Habait/flyover/kaggle/push_pull.py --seg approach --frames 0-3 --local   # CPU מקומי, 512x256, 16spp
$PY Habait/flyover/kaggle/push_pull.py --scan-secrets                                   # סריקת בייטים לערכי המפתחות האמיתיים
```

- `--frames A-B` הוא מספור מקומי בקטע. טווח שמתחיל ב-0 נקרא 0-based (`0-3` = פריימים 1..4).
- `--local` לא מריץ Blender אם `blender.exe` כבר רץ (Blender שייך ל-habait-98, ריצה כבדה אחת בכל רגע). במקרה כזה הוא עושה `--dry-run` של המסלול ורושם את זה בלוג. הפלט המקומי נכתב ל-`_local/local-test/segments/`, כדי שפריימי בדיקה ב-512x256 לא יתערבבו עם פריימי Kaggle באותה תיקייה (`render_segments.py` מדלג על פריים קיים).
- הסצנה: `site.glb` נבנה ב-`build_scene` של `orbit_clay.py` (אותו מראה clay של הסיבוב), עם `--scene-blend ''` (בלי האורות של הדירה, ראו פגם 1 למטה).

## סודות

- ה-CLI של Kaggle קורא לבד את `%USERPROFILE%\.kaggle\kaggle.json` (החשבון `eliranhabait`). אם יש `KAGGLE_USERNAME`/`KAGGLE_KEY` ב-`habait-walkaround/.env`, הם עוברים ל-CLI רק דרך הסביבה של תהליך הבן.
- שום דבר כאן לא מדפיס, רושם או כותב מפתח. ה-dataset וה-kernel פרטיים ומכילים רק קלטים וקוד.
- `push_pull.py` סורק את ה-dataset ואת ה-kernel לפני כל push, בבייטים, מול ערכי המפתחות האמיתיים של המכונה, ועוצר אם יש פגיעה. הסריקה מדפיסה רק ספירות.

## מכסת Kaggle (נבדק 2.11.2026)

- דף התיעוד של Kaggle (`kaggle.com/docs/notebooks`, `/docs/efficient-gpu-usage`) מרונדר בצד הלקוח, ולכן לא הצלחתי לצטט ממנו ישירות.
- לפי סקירה מ-21.9.2026 שקראה את התיעוד:
  - "12 hours execution time for CPU and GPU notebook sessions" (ל-TPU: 9 שעות).
  - "The size of the weekly GPU quota is not in Kaggle's docs": המכסה מופיעה בהגדרות החשבון ו"צפה". המספר המקובל ~30 ש'/שבוע.
  - ההאצה: T4 ו-P100.
- המספר האמיתי לחשבון: Settings → Quotas ב-kaggle.com.

## אם אין מפתח (המדריך לאלירן)

1. נכנסים ל-kaggle.com, ונרשמים או מתחברים (החשבון `eliranhabait` כבר קיים ומאומת).
2. אימות טלפון (Settings → Phone verification), אחרת אין GPU.
3. Settings → API → "Create New Token", ונשמר קובץ `kaggle.json`.
4. שמים אותו ב-`C:\Users\elira\.kaggle\kaggle.json`, או מוסיפים ל-`C:\RnD\Projects\Habait\habait-walkaround\.env` שתי שורות: `KAGGLE_USERNAME=…` ו-`KAGGLE_KEY=…`.
5. לא שולחים את המפתח בצ'אט.

## פגמים ידועים (לא שלי לתקן)

1. `render_segments.py` (כרטיס 17, `equirect/`): `build_glb_scene` מעביר ל-`orbit_clay.build_scene` אובייקט בלי `unit_light_shadows`. כשקיים `scene.blend`, למשל ברירת המחדל המקומית, ייפול `AttributeError`. עקיפה: `--scene-blend ''` (בלי אורות התקרה של 846). התיקון: להוסיף `unit_light_shadows=False` ל-`SimpleNamespace`.
2. ה-approach נגזר מ-`orbit/camera.json` של ab: `ring.centre_xy` ופריים 1. שינוי שם = פריימים אחרים, ולכן ה-hash של כל קלט נרשם בלוג.
