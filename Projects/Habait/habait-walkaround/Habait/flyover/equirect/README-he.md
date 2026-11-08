# equirect: טיסת 360 בקטעים (כרטיס 17, ערוץ C3א)

מסלול מצלמה אחד לסרטון 360 (equirect) של Rainbow / דירה 846, בארבעה קטעים עם שמות קבועים, וסקריפט רנדר אחד שמרנדר אותו ב-Blender (מקומית או ב-Kaggle).
**אין כאן מסלול שני ואין renderer שני לסיבוב:** קטע `orbit` לוקח כמו שהן את הפוזות של הסיבוב של habait-ab (`../orbit/camera.json`), והסצנה נבנית בבונה של ab (`../orbit/orbit_clay.py`, `build_scene`, בקריאה בלבד).

## הקטעים (`path.json`)

| קטע | פריימים גלובליים | פריימים | ש' | מה |
|---|---|---|---|---|
| `approach` | 1–192 | 192 | 8.0 | ספירלה יורדת מגובה 230 מ', 520 מ' צפון-מזרחית למגדל (הכיוון של האווירי הרשמי THE-1), עם כיוון השעון, אל פריים 1 של הסיבוב. smoothstep: מסתיים במנוחה כי הסיבוב של ab מתחיל ממנוחה. שיא 87 מ'/ש' (הוכפל מ-96 פריימים לבקשת ab, כדי להתאים לסיבוב החדש שלו, ~102 מ'/ש') |
| `orbit` | 193–432 | 240 | 10.0 | פריימים 1..`end_pose.frames[0]` של `orbit/camera.json`, שנקראים בזמן ריצה (היום 240; ברינדור החדש של ab: 336+72 = 408, ואז המספור הגלובלי זז לבד) (הסיבוב + הספירלה שלו אל node-b-tower). 12 פריימי העצירה שלו מוחלפים ב-hold-facade |
| `hold-facade` | 433–504 | 72 | 3.0 | לופ חלק ב-node-b: יציאה וחזרה של 0.6 מ' ימינה ו-0.3 מ' למעלה, מתחיל ונגמר במנוחה בפוזה של הנוד, כך שאפשר לנגן 1..72 בלופ בזמן שהרוכש בוחר דירה |
| `descend-846` | 505–624 | 120 | 5.0 | Catmull-Rom צנטריפטלי דרך node-b → node-e (45 מ') → node-f (25 מ') → node-c (חזית) → node-d (מחוץ למרפסת) → **1.5 מ' מחוץ ל-o-5** (הסלון → מרפסת הסלון, לא o-13), קומה 16, גובה עיניים 1.6, מבט פנימה לסלון |
| סה"כ | | 624 | 26.0 | 24fps; עם הסיבוב החדש של ab: 792 = 33 ש' |

כל נודי החוץ של `exterior.json` נמצאים על המסלול: node-a על טבעת הסיבוב (r 228, z 90), node-b = סוף הסיבוב, node-c/d/e/f בירידה. הבדיקות רצות בכל `--dry-run` (17 בדיקות: תפרים בין קטעים, זהות לפוזות של ab, הלופ נסגר, נודים על המסלול, נקודת הסיום מול o-5 מתוך plan.json, בתוך box_world של 846 מ-units.json, על מרפסת הסלון, הכניסה למרפסת מעל המעקה (1.1) ומתחת לתקרה (2.9)).

## המצלמה (הכרעות T0)

- **Cycles panoramic equirectangular**, רנדר אחד לפריים: בלי תפרי cube, ורץ על GPU ב-Kaggle (OptiX/CUDA). ל-EEVEE אין מצלמה פנורמית, והמסלול של 6 פאות צריך הקשר OpenGL שלא הוכח ב-Kaggle.
- **המצלמה תמיד מאוזנת** (pitch 0, roll 0): האופק נשאר ב-v 0.5, ו-u 0.5 = כיוון הקטע (`yaw_deg_from_plus_y_cw`). הפריים של הבמאי (למשל pitch −16° של הסיבוב אל המגדל) נשמר לכל פריים ב-`view_hint` (yaw, pitch, u, v), והנגן יכול לכוון אליו את המבט או לנעול את העולם לפי ה-yaw.
- **הכיוון נבדק ברנדר** (`--probe-orientation`, פריים אחד 512x256 של סצנת בדיקה): נקודה ב-bearing ‏yaw+90 יושבת ב-u 0.75, כלומר `u = 0.5 + (bearing − yaw)/360`, עם כיוון השעון מלמעלה = ימינה. זו המוסכמה שכרטיס 19 (הטלת hotspots) צריך.

## קבצים

- `path.json`: עוגנים, זמנים ו-easing בלבד. העוגנים `orbit:first` / `orbit:end` / `orbit:aim` נקראים בזמן ריצה מ-`orbit/camera.json`, כך ששינוי בסיבוב של ab נכנס לבד.
- `render_segments.py`: אותו קובץ רץ ב-Python רגיל (`--dry-run`, `--plan-only`, `--selftest`) וב-Blender (רנדר).
- פלט: `_local/segments/<segment>/frames/frame_####.png` (ממוספר מקומית בקטע, מ-1) + `_local/segments/<segment>/camera.json` (כל פריימי הקטע, בצורה `{"frames":[…]}` של ה-Studio, עם `pos`, `look`, `matrix_world`, `rotation_euler_deg`, `hfov 360 / vfov 180`, `pos_glb`, `view_hint`, `global_frame`) + `_local/segments/render_log.json`.
- idempotent: פריים קיים (≥ 2 KB) מדולג; `--force` מרנדר מחדש; כל פריים נכתב לשם זמני ומשנה שם בסוף, כך שריצה שנקטעה לא משאירה קובץ חלקי.

## פקודות (Git Bash)

```bash
cd /c/RnD/Projects/Habait/habait-walkaround/.claude/worktrees/board-habait-workplan
export BLENDER=/c/RnD/Projects/Habait/tools/blender-4.5.10/blender-4.5.10-windows-x64/blender.exe PYTHONIOENCODING=utf-8
PY=/c/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe

$PY Habait/flyover/equirect/render_segments.py --dry-run          # טבלת הקטעים + 17 בדיקות, בלי Blender
$PY Habait/flyover/equirect/render_segments.py --plan-only --res 1024x512   # camera.json לכל קטע (לכרטיס 19)

# דראפט מקומי (habait-98 בלבד, מי שמחזיק Blender): 48 פריימים ראשונים של approach, 1024x512, CPU
timeout 5400 "$BLENDER" -b --factory-startup -P Habait/flyover/equirect/render_segments.py -- \
  --glb C:/RnD/Projects/Habait/habait-walkaround/Habait/studio/_local/projects/apt846-rainbow-tlv/renders/site3d/site.glb \
  --hdri C:/RnD/Projects/Habait/habait-walkaround/360walkaround/pipeline/probe/probe-assets/hdri/qwantani_noon_puresky_4k.hdr \
  --path "$(pwd)/Habait/flyover/equirect/path.json" --frames approach:1-48 --res 1024x512 --samples 16 --device CPU
```

`--hdri` חובה ב-worktree: `probe-assets` לא מקושר ב-junction, וברירת המחדל של orbit_clay מצביעה לתוך ה-worktree.
אפשר גם לרנדר את הסצנה שפתוחה ב-Blender (בלי `--glb`), למשל `-b Habait/flyover/project_skin.blend` (הסצנה המוטלת של כרטיס 15).

בחירת פריימים: `--frames 1-96,200` = מספור גלובלי (לחלוקה בין סשנים של Kaggle), `--frames approach:1-48` = מספור מקומי בקטע; `--segments orbit,descend-846` מסנן קטעים.

## Kaggle (כרטיס 18)

הסקריפט נקרא כמו `orbit_render.py` במסלול A (`-- --glb <site.glb> --out <dir> ...`), והשורות שלו מתחילות ב-`[dev]` / `[frame]` / `[done]`, ו-`render_log.json` נושא את אותם מפתחות (`compute`, `devices`, `denoiser`, `first_frame_s`, `steady_s_per_frame`, `import_s`, `total_s`), כך ש-`render()` של `kernel_a_driver.py` עובד עליו בלי שינוי חוץ מהחלפת הסקריפט ב-BPY_B64. ב-dataset צריך להוסיף: `path.json`, `orbit/camera.json`, `orbit/orbit_clay.py`; את ה-HDRI להוריד ב-notebook (Poly Haven CC0, `qwantani_noon_puresky_4k.hdr`).

```bash
# בתוך ה-notebook, אחרי ההורדה של Blender (BL) וה-HDRI
$BL -b --factory-startup -P /tmp/habait_a/render_segments.py -- --glb "$GLB" --out /kaggle/working/segments \
  --path "$IN/path.json" --orbit-camera "$IN/camera.json" --orbit-clay "$IN/orbit_clay.py" \
  --hdri /tmp/habait_a/qwantani_noon_puresky_4k.hdr --scene-blend '' \
  --res 4096x2048 --samples 128 --fmt JPEG --frames 1-312        # סשן שני: --frames 313-624 (לפי הסה"כ ב-dry-run)
```

## מה לא נבדק עדיין

- רנדר אמיתי של הסצנה (site.glb דרך `build_scene` של ab) ב-equirect לא רץ כאן: Blender המקומי שייך ל-habait-98 והריצה הארוכה ל-Kaggle. נבדקו: הטעינה של הבונה של ab דרך ה-wrapper, ה-API של המצלמה ב-Blender 4.5.10, והכיוון ברנדר בדיקה.
- הזכוכית: הכלל של orbit_clay (alpha 0.12, BLENDED) נכתב ל-EEVEE; ב-Cycles ה-alpha עובד, את המראה צריך לראות בעין בדראפט.
- המהירויות: הסיבוב של ab מגיע ל-~222 מ'/ש' בשיא (1.8 ק"מ ב-10 ש'), ה-approach ל-~87 מ'/ש' (אחרי ההכפלה ל-192). ab מרנדר מחדש את הסיבוב ב-`--orbit-frames 336` (~102 מ'/ש'). מאריכים את `frames` ב-path.json אם עדיין מהיר.
