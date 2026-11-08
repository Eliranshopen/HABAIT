# שכבות חיים לריחוף (כרטיס 16, ערוץ C2)

ציפורים, מכוניות, אנשים, עצים ברוח, ובמקרה הצורך ים. כולן שכבות מונפשות ב-Blender שמתווספות **מעל** הסצנה האפויה של כרטיס 15. הגאומטריה הסטטית לא זזה, ולא נוצר כאן שום דבר במודל וידאו. $0.

## נתיבים (מחליפים את מה שכתוב בכרטיס)

| בכרטיס | בפועל |
|---|---|
| `Habait/flyover/life.py`, `life.json` | `Habait/flyover/life/life.py`, `Habait/flyover/life/life.json` |
| `Habait/flyover/assets/LICENSES.md` | `Habait/flyover/life/assets/LICENSES.md` |
| `Habait/flyover/renders-life/preview-{morning,evening}.mp4` | `Habait/flyover/life/_local/<preset>/preview-<preset>.mp4` (+ `frames/`, `tower-mask.png`, `matte_first.png`, `matte_last.png`, `preview.json`) |
| `Habait/flyover/check_static.py`, מסכה `renders-v1/tower-mask.png` | `Habait/flyover/life/check_static.py`; המסכה מרונדרת בכל preview (`_local/<preset>/tower-mask.png`) |
| `project_skin.blend` | `Habait/flyover/renders/baked/baked.blend` (סצנת התיעוד של כרטיס 15, **קריאה בלבד**) |

## הסצנה (קריאה בלבד)

`life.py` נטען מעל `baked.blend` של habait-ab. הוא לא שומר את הקובץ ולא נוגע באף אובייקט `BK_*` / `STUDIO_*`: אין להם modifiers, constraints או drivers חדשים, וה-selftest מוודא את זה וגם משווה sha256 של הקובץ לפני ואחרי. כל מה שנוסף יושב ב-collection `LIFE`, בשמות `LIFE_*`.

שמות שהסקריפט מניח (`life.json` → `scene`):
* מגדל: `BK_tower`, `BK_tower_hidden`, `BK_apt`, `BK_detail_handrail`, `BK_detail_mullions`, `BK_detail_planters`, `BK_detail_bushes`, `BK_detail_small`.
* קרקע: `BK_ground`, `BK_ground_far`, `STUDIO_ortho`.
* גגות פודיום: `BK_podium`.
* מרכז המגדל (-5.9, -13.0, 14.0). קרקע ב-z ‎-52.35. הצירים של plan-world (X ימינה, Y למעלה בתכנית, Z למעלה, מטרים).

## השכבות

| שכבה | איך | הערות |
|---|---|---|
| ציפורים | particle system מסוג **boids** (Goal → Separate → Flock), instance = billboard צלב של שחף עם אטלס 4 פריימי משק כנפיים, phase אקראי לכל ציפור | נקודת ה-goal נודדת לאט. ה-cache נאפה בזיכרון בלבד, אף פעם לא לדיסק ליד הסצנה. 120 פריימי pre-warm, ולכן חלון הרנדר הוא 121..360 |
| מכוניות | 3 דגמי קופסאות low-poly על **כבישי OSM** (35 דרכים מ-`site.json`, הומרו ל-plan-world עם צפון 304.4). Follow Path + driver: נסיעה בימין, מהירות קבועה לכל נתיב, מרווח מינימלי | בערב פנסים דולקים. צל מגע = blob שקוף, כי הקרקע emission ולא מקבלת צל |
| אנשים | billboards (Locked Track למצלמה) עם אטלס הליכה של 8 פריימים × 6 וריאנטי ביגוד, מראה לפי כיוון התנועה במסך. על המדרכות של OSM, על גגות הפודיום ("גג הבוטיק", ray cast) ובכיכר שלמרגלות המגדל | ב-480x270 אדם הוא ~3 פיקסלים (נקודות זזות). ל-review אמיתי: `--res 960x540` |
| עצים | עצים פרוצדורליים לאורך הכבישים, רק על הקרקע (ray cast). רוח = Displace עם Clouds שזורמת (empty `LIFE_wind`) + נדנוד קל של הגזע | **השיחים האפויים של המגדל (`BK_detail_bushes`) לא מונפשים בכוונה**: הם חלק מהמגדל, ותזוזה שלהם הייתה שוברת את ה-skin ואת בדיקת 0 הפיקסלים |
| ים | shader waves (Noise 4D + bump) **רק אם בסצנה יש מישור ים**. ב-`baked.blend` אין כזה (`STUDIO_sea` לא נאפה), ולכן כבוי בשני הפריסטים | אופציה: `--sea-mode osm-coast` בונה מישור מקו החוף של OSM (סדר ה-way נשמר) במרחק 717 מ'. נבדק ב-selftest, לא מופעל כברירת מחדל |

פריסטים (`life.json` → `presets`):
* **morning:** שמש מהמזרח (אזימוט אמיתי 110°, גובה 22°).
* **evening:** שמש 250°, גובה 6°, כתומה. העולם מוחלש ×0.8, יש grade חם (Color Balance) על כל הפריים, יותר מכוניות ואנשים, פנסים דולקים.

ה-skins האפויים נושאים את תאורת הבוקר של GPT. ה-grade של הערב הוא צביעה אחידה וסטטית, לא relight אמיתי.

מצלמת ה-preview נעולה: (260, -140, -7), עדשה 26 מ"מ, plan bearing ~116°, בין נוד a לנוד b, היכן שה-skins מכסים. המגדל כולו בפריים, והכביש חוצה את הפריים בערך 140 מ' מהמצלמה.

## הרצה

```bash
export BLENDER="/c/RnD/Projects/Habait/tools/blender-4.5.10/blender-4.5.10-windows-x64/blender.exe"; export PYTHONIOENCODING=utf-8
PY=/c/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe; cd /c/RnD/Projects/Habait/habait-walkaround
# בלי Blender
$PY Habait/flyover/life/life.py --make-roads        # OSM -> life.json (כבר בוצע)
$PY Habait/flyover/life/life.py --print-commands
$PY Habait/flyover/life/check_static.py --selftest
# selftest: טוען את הסצנה ובונה הכול בזיכרון. בלי רנדר ובלי שמירה, ~30 ש'
timeout 180 "$BLENDER" -b Habait/flyover/renders/baked/baked.blend -P Habait/flyover/life/life.py -- --selftest --preset morning,evening
# ה-preview (habait-98 מקומית או Kaggle): 240 פריימים 480x270 EEVEE, ואחר כך מסכה, matte ו-mp4
timeout 3600 "$BLENDER" -b Habait/flyover/renders/baked/baked.blend -P Habait/flyover/life/life.py -- --preset morning --pass preview
$PY Habait/flyover/life/check_static.py Habait/flyover/life/_local/morning/frames --mask Habait/flyover/life/_local/morning/tower-mask.png --matte Habait/flyover/life/_local/morning/matte_first.png,Habait/flyover/life/_local/morning/matte_last.png
# אותו דבר עם evening
```

דגלים: `--res 960x540`, `--engine cycles` (fallback, seed קבוע), `--frames a..b`, `--out <dir>`, `--sea-mode existing-only|osm-coast|off`. קידוד בלבד: `"$BLENDER" -b --factory-startup -P life.py -- --encode-only <frames> --mp4 <file>`.

## בדיקת היציבות

`check_static.py` משווה את הפריים הראשון לאחרון בתוך מסכת המגדל (רנדר של המגדל בלבד, כל השאר holdout). פיקסלים שאובייקט חיים מכסה באחד משני הפריימים (matte, הרחבה של 2 פיקסלים) לא נספרים, וכל השאר חייב להיות זהה ביט-לביט. ההשוואה רצה על ה-PNG. ה-mp4 (H.264) נועד לעין: הוא lossy בין I-frame ל-P-frame, ולכן עליו המספר לא יהיה 0 (נבדק על פריימים סינתטיים).

## Kaggle

ב-`baked.blend` נתיבי התמונות אבסולוטיים (`C:\RnD\Projects\Habait\...`). לפני הרצה ב-Kaggle צריך remap של הנתיבים או pack. זה שייך לכרטיס 18. `life.py` ו-`life.json` עצמאיים: הכבישים בתוך ה-JSON והספרייטים נוצרים בזמן ריצה.
