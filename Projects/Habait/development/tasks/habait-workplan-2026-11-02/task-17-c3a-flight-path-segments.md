# משימה 17: C3א: מסלול טיסה + סקריפט רנדר equirect בקטעים (approach / orbit / hold-facade / descend-846)

| שדה | ערך |
|---|---|
| **לוח** | `habait-workplan-2026-11-02` |
| **ערוץ** | C |
| **מקור בתכנית** | חלק ג §2 ערוץ C, שלב C3 ב-`C:\RnD\Projects\Habait\research\product-research-2026-11-02\HABAIT-RESEARCH-2026-11-02.md` |
| **סוכן** | `blender-scene` (`status: live`, `owner-track: habait`, `model: opus`) |
| **Ruling tier** | **T0** |
| **גל (wave)** | 2 |
| **מצב** | TODO |
| **זיכרון** | `memory/agents/` לא קיים בפרויקט הזה; הזיכרון של הסוכן הוא בלוק `## תוצאה` כאן (ראו rails). הסוכן הוא יכולת קבועה (לא one-off persona). |

## מטרה

מסלול מצלמה אחד: מעל שדה דב → סביב המגדל → עצירה מול החזית (לופ קצר) → ירידה אל המרפסת של 846; מוגדר ב-`path.json` (נקודות + זמנים, easing), ו-`render_segments.py` שמרנדר equirect 4096×2048 (או 2048×1024 לדראפט) 24 fps בקטעים עם שמות קבועים, idempotent (מדלג על פריימים קיימים), ומייצא `camera.json` לכל פריים (להטלת ה-hotspots ב-19).

## תלויות

- 15 (הסצנה המוטלת); 03 (bbox של 846 לנקודת הירידה); `exterior.json` של 16 (4 הנודים = נקודות העצירה)

## קלטים (קריאה)

- `Habait/tour360/apartments/apt846/exterior.json` (4 נודים: מיקומים)
- 03: bbox של 846
- `Habait/flyover/project_skin.blend` (15) + `life.py` (16)

## קבצים (הסוכן כותב רק כאן)

- `Habait/flyover/path.json`, `Habait/flyover/render_segments.py` (חדש)
- `Habait/flyover/_local/segments/<seg>/{frames/,camera.json}` (פלט; דראפט מקומי 48 פריימים ב-1024×512)

> **Blender:** לפי SESSIONS.md כלל 4, רק habait-16 מריץ Blender מקומית. הסוכן כותב את הסקריפט, מריץ `--dry-run`/selftest בלי Blender אם אפשר, ומבקש מהסשן המפעיל להעביר את ההרצה ל-16 (SendMessage) או ל-Kaggle (כרטיס 18). ההרצה בפועל של ה-Check נרשמת בבלוק התוצאה עם מי הריץ.

## צעדים

1. מסלול: 4 הנודים כעוגנים; Bezier בין עוגנים; `hold-facade` = לופ 3 ש' עם תנועה קלה; `descend-846` מסתיים 1.5 מ' מחוץ ל-o-5 (המרפסת של 846) בגובה קומה 16.
2. equirect camera (Cycles panoramic equirectangular, או EEVEE עם 6 cube faces + `equi2faces.py` הפוך) לפי מה שמהיר יותר על Kaggle; לרשום.
3. `--dry-run` מדפיס כמה פריימים לכל קטע וכמה קיימים; `--frames a-b` לרנדר חלקי.
4. דראפט מקומי קצר (דרך 16): 48 פריימים של approach ב-1024×512, EEVEE.

## קריטריוני קבלה

- [ ] path.json עם 4 קטעים בשמות קבועים; סה"כ ~20 ש' @24fps = ~480 פריימים.
- [ ] `render_segments.py --dry-run` נכון; ריצה חוזרת מדלגת על קיימים.
- [ ] camera.json לכל פריים (מיקום, rotation, fov) בפורמט `{"frames":[…]}` כמו ב-Studio.
- [ ] 48 פריימי דראפט קיימים; ה-descend מסתיים מול o-5.

## Gate

**Check:**
```bash
cd C:/RnD/Projects/Habait/habait-walkaround && export BLENDER=/c/RnD/Projects/Habait/tools/blender-4.5.10/blender-4.5.10-windows-x64/blender.exe && timeout 60 "$BLENDER" -b Habait/flyover/project_skin.blend --factory-startup -P Habait/flyover/render_segments.py -- --path Habait/flyover/path.json --dry-run && ls Habait/flyover/_local/segments/approach/frames | wc -l
# צפוי: dry-run מפרט 4 קטעים עם ספירת פריימים; 48 פריימי דראפט
```

**Reviewer scope:** נכונות המסלול בלבד: נקודת הסיום של descend-846 מול o-5 בקומה 16 (נבדק מול bbox של 03).

הבודק (אם נדרש) הוא `qa-reviewer` בהקשר נקי, לא הסשן שביצע.

## כסף

$0 (הרנדר המלא ב-17ב על Kaggle)

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

_(סוכן `blender-scene`, 2026-11-02, מה-worktree `board/habait-workplan`; הריצה נקטעה פעם אחת על מגבלת המנוי והמשיכה מהעבודה השמורה)_

- **מצב:** **PARTIAL.** המסלול, הסקריפט, ה-dry-run ו-camera.json לכל קטע מוכנים ונבדקו. קריטריון "48 פריימי דראפט" **נדחה ל-habait-98 / Kaggle (כרטיס 18)** כי לא רונדרו כאן: Blender המקומי שייך ל-98, ושני תהליכי Blender של ab רצו באותו זמן. הנתיבים לפי הגבולות שסוכמו עם habait-ab: הכול תחת `Habait/flyover/equirect/` ולא `Habait/flyover/path.json`.
- **עדכון (בקשת ab דרך הסשן המפעיל, אחרי הריצה הראשונה):** (1) טווח ה-orbit כבר נקרא בזמן ריצה, כפריימים 1..`end_pose.frames[0]` מ-camera.json (`orbit_take()`); אין בקוד 240 קבוע. הוכחה: dry-run עם `--orbit-camera` שמצביע על חלופה סינתטית בת 420 פריימים (הסיבוב הנוכחי, מתוח לפריסה החדשה של ab, 336+72+12 עם סוף ב-408; נשמרה ב-scratchpad, לא נוגעת בקובץ של ab). ה-dry-run הרים 408 פוזות, orbit בגלובליים 193–600, סה"כ 792 = 33 ש', 17/17 PASS, בלי שינוי קוד. (2) approach הוכפל מ-96 ל-192 פריימים (8 ש'): השיא ירד מ-174.6 ל-87.3 מ'/ש', ותפר approach→orbit השתפר (קפיצה 0.031 מ' מול צעדים של 0.152). camera.json לכל קטע נכתב מחדש. כשהקובץ החדש של ab יגיע, אותה פקודה תיתן את הספירה החדשה.
- **מה נעשה:**
  - `path.json` עם 4 קטעים בשמות קבועים: approach 192 + orbit 240 (היום; נקרא מ-camera.json) + hold-facade 72 + descend-846 ‏120 = **624 פריימים = 26.0 ש' @24fps**. עם הסיבוב החדש של ab (408): 792 = 33 ש'. היעד בכרטיס היה ~20 ש'; הסיבוב לבדו ארוך מזה.
  - **orbit לא הוגדר מחדש:** פריימים 1..`end_pose.frames[0]` (=240) של `Habait/flyover/orbit/camera.json` נלקחים כמו שהם (סטייה 0.00 מ'). העוגנים `orbit:first/end/aim` נקראים בזמן ריצה, כך ששינוי בסיבוב של ab נכנס לבד.
  - **approach** (192 פריימים, שיא 87 מ'/ש'): ספירלה יורדת מ-520 מ' צפון-מזרחית למגדל (כיוון THE-1), בגובה z 230, אל פריים 1 של הסיבוב. הספירלה מסתיימת במנוחה כי הסיבוב של ab מתחיל ממנוחה.
  - **hold-facade:** לופ חלק של 3 ש' ב-node-b (יציאה וחזרה של 0.6 מ' ימינה ו-0.3 מ' למעלה). הלופ נסגר בדיוק על הנוד.
  - **descend-846:** Catmull-Rom צנטריפטלי דרך b → e → f → c → d → **1.5 מ' מחוץ ל-o-5** (מרכז o-5 מ-plan.json ‏(10.325, −11.148), נורמל חוצה SSE 164.3° אמיתי). נקודת הסיום (11.746, −11.629, 1.6), מבט פנימה לסלון (yaw 288.7).
  - **הכרעות T0:**
    1. **Cycles panoramic equirectangular**, רנדר אחד לפריים, GPU ב-Kaggle. ל-EEVEE אין מצלמה פנורמית, ו-6 פאות דורשות OpenGL שלא הוכח ב-Kaggle.
    2. **מצלמה מאוזנת תמיד** (pitch 0, roll 0; האופק ב-v 0.5, ו-u 0.5 = כיוון הקטע). ה-pitch של הבמאי נשמר ב-`view_hint` לכל פריים.
    3. ה-hold של ab (12 פריימים סטטיים) מוחלף בלופ hold-facade.
    4. הסצנה ב-`--glb` נבנית ב-`build_scene` של `orbit/orbit_clay.py` של ab (exec בקריאה בלבד, בלי ה-`main()` האחרון), כדי שהמראה יהיה זהה ל-clay של הסיבוב. בלי `--glb` מרונדרת הסצנה שפתוחה ב-Blender (למשל `project_skin.blend`).
  - **17 בדיקות במסלול, כולן PASS:**
    - תפרים בין הקטעים;
    - זהות לפוזות של ab;
    - 6 נודי החוץ על המסלול;
    - o-5 מול plan.json;
    - הסיום על r-terrace-living ובתוך box_world של 846 (כרטיס 03, קומה 16);
    - הכניסה למרפסת ב-z 1.64, מעל המעקה (1.1) ומתחת לתקרה (2.9);
    - המבט נכנס דרך o-5.
  - **פריים בדיקה אחד ב-512x256** (`--probe-orientation`, סצנת צעצוע: 4 קוביות, 3.0 ש' ב-CPU) מאשר את המוסכמה `u = 0.5 + (bearing − yaw)/360`: עם כיוון השעון מלמעלה = ימינה בתמונה. זה מה שכרטיס 19 צריך כדי להטיל hotspots.
  - smoke של 3 שניות (`hello-render.py`): OK.
- **קבצים שנכתבו** (שורש = ה-worktree):
  - `Habait/flyover/equirect/path.json`
  - `Habait/flyover/equirect/render_segments.py`
  - `Habait/flyover/equirect/README-he.md`
  - `Habait/flyover/equirect/_local/segments/{approach,orbit,hold-facade,descend-846}/camera.json` (נכתבו ב-`--plan-only --res 1024x512`; gitignored)
  - `Habait/flyover/equirect/_local/probe/orientation_512x256.png`
- **פלט ה-Check (מילה במילה)**, אחרי ההתאמה לנתיבי `Habait/flyover/equirect/`: `cd <worktree> && export BLENDER=… && timeout 60 "$BLENDER" -b Habait/flyover/project_skin.blend --factory-startup -P Habait/flyover/equirect/render_segments.py -- --path Habait/flyover/equirect/path.json --dry-run && ls Habait/flyover/equirect/_local/segments/approach/frames | wc -l`
```
[segments] path C:\RnD\Projects\Habait\habait-walkaround\.claude\worktrees\board-habait-workplan\Habait\flyover\equirect\path.json; orbit poses from C:\RnD\Projects\Habait\habait-walkaround\.claude\worktrees\board-habait-workplan\Habait\flyover\orbit\camera.json; out C:\RnD\Projects\Habait\habait-walkaround\.claude\worktrees\board-habait-workplan\Habait\flyover\equirect\_local\segments
segment           global  frames    sec  exist  todo    len m  max m/s  start -> end
approach         1-192       192   8.00      0   192    459.0     87.3  [-89.2, 502.9, 230.0] -> [148.77, 169.98, 90.01]
orbit          193-432       240  10.00      0   240   1789.0    221.8  [148.8, 170.0, 90.0] -> [68.45, -47.26, 17.79]
hold-facade    433-504        72   3.00      0    72      1.3      0.7  [68.4, -47.3, 17.8] -> [68.45, -47.26, 17.79]
descend-846    505-624       120   5.00      0   120     69.3     20.8  [68.4, -47.3, 17.8] -> [11.75, -11.63, 1.6]
total                        624  26.00   @ 24 fps, 2048x1024 equirect
  [PASS] seam approach->orbit: jump 0.031 m (steps around 0.152 m), yaw jump 0.00 deg
  [PASS] seam orbit->hold-facade: jump 0.001 m (steps around 0.290 m), yaw jump 0.00 deg
  [PASS] seam hold-facade->descend-846: jump 0.014 m (steps around 0.071 m), yaw jump 0.00 deg
  [PASS] orbit = orbit/camera.json: 240 poses, frames 1..240, max deviation 0.00e+00 m
  [PASS] hold-facade loop closes at node-b: last frame = node-b-tower [68.4477, -47.2597, 17.7875]
  [PASS] node node-a-aerial on the path: nearest global frame 242 (3.59 m; local step 9.24 m)
  [PASS] node node-b-tower on the path: nearest global frame 432 (0.00 m; local step 0.10 m)
  [PASS] node node-e-approach45 on the path: nearest global frame 552 (0.05 m; local step 0.83 m)
  [PASS] node node-f-approach25 on the path: nearest global frame 576 (0.22 m; local step 0.83 m)
  [PASS] node node-c-facade on the path: nearest global frame 588 (0.06 m; local step 0.73 m)
  [PASS] node node-d-terrace on the path: nearest global frame 606 (0.21 m; local step 0.45 m)
  [PASS] end 1.5 m outside o-5: offset 1.500 m on the normal, lateral 0.000 m, z 1.6
  [PASS] o-5 matches plan.json: plan o-5 centre [10.325, -11.148], rooms ['r-living', 'r-terrace-living']
  [PASS] end on terrace r-terrace-living: end xy [11.746, -11.629]
  [PASS] terrace entry clears railing and slab: enters the terrace at frame 115 z 1.64 (railing 1.1, ceiling 2.9)
  [PASS] end inside 846 box_world (floor 16): box [0.738, -16.031, 0.0, 14.431, -0.378, 2.9], floor 16
  [PASS] end looks in through o-5: yaw 288.72 vs inward 288.72
checks: 17/17 pass
[segments] Blender 4.5.10 LTS: equirect camera OK via camera.panorama_type (not rendered); open file: C:\RnD\Projects\Habait\habait-walkaround\.claude\worktrees\board-habait-workplan\Habait\flyover\project_skin.blend
Blender 4.5.10 LTS (hash 6dc0b208d1b5 built 2026-05-19 01:33:42)
Read blend: "C:\RnD\Projects\Habait\habait-walkaround\.claude\worktrees\board-habait-workplan\Habait\flyover\project_skin.blend"

Blender quit
0
```
  ה-0 בסוף = אין עדיין פריימי דראפט (צפוי 48 → PARTIAL). פריים הבדיקה: `[probe] red u 0.501 want 0.500 / green 0.751 want 0.750 / blue 0.001 want 0.000 / yellow 0.251 want 0.250 … orientation PASS`.
- **הפקודה ל-habait-98** (48 פריימי הדראפט, CPU, 1024x512; זמן הריצה לא נמדד, ההערכה 20–50 דק'):
```bash
cd /c/RnD/Projects/Habait/habait-walkaround/.claude/worktrees/board-habait-workplan && export BLENDER=/c/RnD/Projects/Habait/tools/blender-4.5.10/blender-4.5.10-windows-x64/blender.exe PYTHONIOENCODING=utf-8
timeout 5400 "$BLENDER" -b --factory-startup -P Habait/flyover/equirect/render_segments.py -- --glb C:/RnD/Projects/Habait/habait-walkaround/Habait/studio/_local/projects/apt846-rainbow-tlv/renders/site3d/site.glb --hdri C:/RnD/Projects/Habait/habait-walkaround/360walkaround/pipeline/probe/probe-assets/hdri/qwantani_noon_puresky_4k.hdr --path "$(pwd)/Habait/flyover/equirect/path.json" --frames approach:1-48 --res 1024x512 --samples 16 --device CPU
```
- **הפקודה ל-notebook של Kaggle** (כרטיס 18): `render()` של `kernel_a_driver.py` עובד כמו שהוא, אם מחליפים את `orbit_render.py` ב-`render_segments.py` (אותו `-- --glb … --out …`, אותן שורות `[dev]/[frame]/[done]` ואותם מפתחות ב-`render_log.json`).
  - ל-dataset מוסיפים: `path.json`, `orbit/camera.json`, `orbit/orbit_clay.py`.
  - את ה-HDRI מורידים מ-Poly Haven (CC0).
  - הפקודה:
    `$BL -b --factory-startup -P /tmp/habait_a/render_segments.py -- --glb "$GLB" --out /kaggle/working/segments --path "$IN/path.json" --orbit-camera "$IN/camera.json" --orbit-clay "$IN/orbit_clay.py" --hdri /tmp/habait_a/qwantani_noon_puresky_4k.hdr --scene-blend '' --res 4096x2048 --samples 128 --fmt JPEG --frames 1-312`
  - הסשן השני: `--frames 313-624` (או לפי הסה"כ ב-dry-run אחרי שהסיבוב החדש של ab נוחת).
- **כסף:** $0. אין ledger: לא הייתה אף קריאה בתשלום.
- **פגמים פתוחים:**
  1. רנדר אמיתי של site.glb ב-equirect עוד לא רץ. נבדקו: טעינת הבונה של ab דרך ה-wrapper, ה-API של המצלמה ב-4.5.10, והכיוון ברנדר בדיקה. מראה הזכוכית ב-Cycles (alpha 0.12 של orbit_clay נכתב ל-EEVEE) נבדק רק בעין בדראפט.
  2. ב-worktree אין `360walkaround/pipeline/probe/probe-assets` (לא מקושר ב-junction), לכן `--hdri` חובה.
  3. מהירויות: ה-approach ירד ל-87 מ'/ש'. הסיבוב הנוכחי של ab מגיע ל-222 מ'/ש', וב-camera.json החדש שלו (336 פריימים) ל-~102.
  4. סה"כ 26 ש' (33 עם הסיבוב החדש) במקום ~20.
  5. הכרעה 1 בלוח (17/18/20/22 מוחזקים עד ההשוואה 8848/8899) עדיין פתוחה. הכרטיס בוצע לפי הוראת הסשן המפעיל.
- **קורא שני:**
  - **habait-ab:** קטע `orbit` צורך את `Habait/flyover/orbit/camera.json` שלו בזמן ריצה: פריימים 1..`end_pose.frames[0]`, ו-`ring.centre_xy`, `aim.point`, `end_pose` כעוגנים. הוא צורך גם את `build_scene` של `orbit_clay.py` דרך exec, בהנחה שהשורה האחרונה בקובץ היא `main()`. שינוי בסכמה של camera.json, בשמות האלה או בשורה האחרונה ישבור את equirect, ולכן צריך להודיע.
  - **habait-98:** פקודת הדראפט של 48 הפריימים למעלה (הוא מחזיק את Blender). `--hdri` חובה ב-worktree.
  - **כרטיס 19:** המוסכמה `u = 0.5 + (bearing − yaw)/360` נבדקה ברנדר.
- **לזיכרון:** C3א (כרטיס 17): `Habait/flyover/equirect/` = path.json: approach 192 (8 ש', שיא 87 מ'/ש') / orbit = פריימים 1..end_pose של orbit/camera.json של ab, נקרא בזמן ריצה (היום 240, אחרי הרינדור החדש 408) / hold-facade 72 לופ ב-node-b / descend-846 ‏120 עד 1.5 מ' מחוץ ל-o-5, קומה 16. render_segments.py: Cycles equirect מאוזן, u=0.5+(bearing−yaw)/360, idempotent, תואם ל-Kaggle. 17/17. דראפט: 98/Kaggle.
