# צוות הסוכנים של Habait: ארגונית, תקן הכותרת, חוזה הזיכרון

**נכתב:** 2026-11-02, סשן habait-4b (`/plan-to-tasks` על `research/product-research-2026-11-02/HABAIT-RESEARCH-2026-11-02.md`). **ההגדרות:** `C:\RnD\Projects\Habait\.claude\agents\*.md`. **הלוח הראשון שמשתמש בהן:** `C:\RnD\Projects\Habait\development\tasks\habait-workplan-2026-11-02\`.

> הסקיל `plan-to-tasks` הועתק מה-harness של המעבדה (Slava, `RealEstateTeam`) ומפנה לקבצים שלא קיימים כאן (`.claude/agents/CLAUDE.md`, `_MEMORY_PREAMBLE.md`, `memory/HOT.md`, `development/tasks/CLAUDE.md`). המסמך הזה הוא הגרסה של Habait לשלושתם הראשונים: §1 תקן הכותרת, §2 הצוות, §3 חוזה הזיכרון (הטקסט שמודבק מילה במילה בכל הגדרה). טבלת הלוחות (§4) ממלאת את תפקיד `development/tasks/CLAUDE.md`.

## 1. תקן הכותרת (תשעה מפתחות, כולם)

```
---
name: <kebab-case, זהה לשם הקובץ>
description: "תמיד במרכאות כפולות. סקלר לא-מצוטט עם ': ' מפיל את כל ההגדרה; ' #' חותך אותה בשקט. זה פרומפט: כלי Agent בוחר לפיו."
model: sonnet | opus          # לעולם לא inherit על worker (שלב 14)
tools: Read, Write, Edit, Bash, Glob, Grep   # לעולם לא Agent (עומק אחד בלבד)
color: <כלשהו>
status: live | dormant | archived
owner-track: habait | visualizer | agency | harness-ops | research
charter: "שורה אחת: בשביל מה הסוכן."
boundary: "שורה אחת: מה הוא לא עושה, ומי כן."
---
```

כללים שנלמדו בכאב (2026-08-27 במעבדה; כאן אומתו ב-2026-11-02): **backslash של Windows בתוך מרכאות כפולות ב-YAML הוא escape לא חוקי** ומפיל את ההגדרה (קרה עם `C:\RnD\Projects\Habait\tools\bench` ב-`engine-builder`; תוקן ל-`C:/…`). בדיקה: `python -c "import yaml; yaml.safe_load(open(f).read().split('---')[1])"` על כל קובץ. הגדרה שלא נטענת לא קיימת ל-`Agent`.

## 2. הצוות (2026-11-02)

| סוכן | model | status | track | charter | boundary (בקצרה) |
|---|---|---|---|---|---|
| `engine-builder` | opus | live | habait | קוד המנוע ב-`Habait/engine`: סכמה, intake, בניין/units, CLI, gates חדשים | לא Blender, לא קריאות בתשלום, לא UI; לא נוגע ב-`tools/bench` ו-`Habait/studio` (של 16) |
| `blender-scene` | opus | live | habait | סקריפטי Blender headless: ריהוט, GLB, projection mapping, חיים, מסלולים, equirect, הטלת bbox, turntable | לא מריץ Blender אלא אם הסשן המפעיל מחזיק אותו (16); רנדרים ארוכים ל-cloud-render |
| `cloud-render` | opus | live | habait | GPU מרוחק: Kaggle/Modal, notebooks, push/pull, מכסות, באצ'ים | לא כותב סצנות; אף סוד ב-notebook; לא פותח חשבונות (ידו של אלירן) |
| `genai-look` | opus | live | habait | קריאות גנרטיביות בתשלום: skins, LoRA, A/B, upscale, bench; עם ledger ו-gates | לא מוציא בלי תקרה בכרטיס + אישור אלירן בצ'אט המפעיל; לא נוגע בגאומטריה |
| `platform-dev` | opus | live | habait | צד הדפדפן: הפלואו, viewer, דפים, אנליטיקס, לידים, אדמין, מסך תיקון | לא מנוע/Blender/gen-AI; לא פותח חשבון, לא מפרסם URL, לא שולח PII בלי T1/T2 |
| `corpus-and-docs` | opus | live | habait | מאגר תכניות המכר, ground truth, טיוטת כיתוב משפטי, תיעוד המנוע | לא פונה ליזמים; טיוטה ≠ ייעוץ משפטי; לא כותב קוד מנוע/UI |
| `qa-reviewer` | sonnet | live | harness-ops | מריץ את ה-Check, מונה פגמים, מנסה להפריך; לעולם לא המחבר | לא עורך כלום; לא בודק עבודה מסשן שחולק איתו הקשר |

**למה שבעה ולא חמישה-עשר:** התכנית (חלק ג §4) מונה 13 תתי-סוכנים בשמות ("intake-vlm", "kaggle-farm", "marble-splat"…). כל אחד מהם הוא *משימה* של אחד משבעת הסוכנים האלה, לא יכולת חדשה; הגדרה לכל משימה היא בדיוק ה-27 פרסונות חד-פעמיות שהמעבדה נאלצה לארכב. כלל 5 של הסקיל: ליצור בשמרנות.

**מודלים:** Opus לכל מי שמנסח, בונה או שופט; Sonnet לקורא/מאמת/מפריך (`qa-reviewer`). אף `inherit`. שינוי pin נרשם כאן (אין `docs/governance/MODEL-PINS.md` נפרד בפרויקט הזה).

**מחזור חיים:** `live` = ניתן להקצאה. `dormant` = הערוץ שקט, הסוכן עובד (אין כאלה היום). `archived` = לא מקצים; מסמנים בקובץ, **לא מזיזים את הקובץ** (סקילים קוראים להגדרות בשם). אין כאן `memory/agents/`: הזיכרון של סוכן הוא בלוק `## תוצאה` בכרטיס שלו (§3), כך שאין מה לגנוז בפרישה.

**מה הסוכנים לא מכסים (וזה בכוונה):** הרצת Blender מקומית (habait-16), ה-Studio (16), הריחוף האינטראקטיבי ב-three.js (habait-89, `research/fal-bench-2026-11-02/flyover3d`), התיאום (habait-ab). סוכן שצריך משהו משם כותב בקשה בבלוק התוצאה והסשן המפעיל שולח `SendMessage`.

## 3. חוזה הזיכרון (מודבק מילה במילה בסוף כל הגדרה)

```
## Memory contract (Habait, paste verbatim; source: C:\RnD\Projects\Habait\docs\agent-team-org-chart.md §3)
```

הנוסח המלא: `C:\RnD\Projects\Habait\docs\_memory_preamble.txt` (9 סעיפים: קריאה תחומה, בעלות על נתיבים, כתיבה אחת בבלוק התוצאה, קורא שני, "לא נגמר עד שנכתב", כסף, המכונה, שפה, דרגת הכרעה). כשמשנים אותו: לעדכן את הקובץ ולהריץ מחדש את הגנרטור (`make_agents.py` בסקרצ'פד של habait-4b נכתב לשם כך; אם אבד: החלפת הבלוק בכל 7 הקבצים ידנית, ובדיקת YAML אחרי).

## 4. טבלת הלוחות (ספירת WIP: שלושה בביצוע לכל היותר)

| לוח | נפתח | מקור | מתאם | State | הערה |
|---|---|---|---|---|---|
| `habait-workplan-2026-11-02` | 2026-11-02 | `HABAIT-RESEARCH-2026-11-02.md` חלק ג | habait-ab | FILED | 33 כרטיסים, 7 גלים; אף כרטיס לא הופעל; לא ב-git (OWED #1) |

אוצר המילים של State: FILED → EXECUTING → BLOCKED → CLOSED (או CANCELLED). ספירה לפני פתיחת לוח חדש: `grep -c "EXECUTING\|IN-PROGRESS\|LIVE"` על העמודה הזו, בקריאת שורות ולא התאמות.
