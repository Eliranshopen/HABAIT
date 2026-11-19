# חבילת העברה למחשב אחר — C:\RnD, מצב 19.11.2026

החבילה מכילה את מה שצריך כדי להמשיך את העבודה על המנוע (`Projects\3Dengine`) במחשב אחר, מהנקודה שבה נעצרה.

## מה עושים — שלוש פעולות

1. **במחשב האחר מורידים קובץ אחד מ-GitHub:** נכנסים ל-`https://github.com/Eliranshopen/RnD/releases`, ומורידים את `RnD-engine-restore.zip` (כ-1.5GB). לוחצים עליו לחיצה ימנית ← «חלץ הכל» (Extract All), ובתיקייה שנוצרה לוחצים לחיצה כפולה על **`RESTORE.cmd`**.
   אם Windows מציג חלון כחול «Windows protected your PC»: לוחצים «More info» ואז «Run anyway».
   הקובץ מתקין את הכלים החסרים, משחזר את `C:\RnD` ובודק שהמנוע מוכן. זה לוקח בערך רבע שעה וצריך חיבור לאינטרנט. Windows עשוי לבקש אישור להתקנות.
   (אותה תיקייה קיימת גם במחשב הראשון, `C:\RnD-carry-2026-11-19`, למי שמעדיף להעתיק בדיסק נייד.)
2. **מעתיקים בעצמך את קובץ המפתחות** (`.env` שבשורש `C:\RnD` במחשב הזה) אל `C:\RnD\` במחשב האחר, ולוחצים שוב לחיצה כפולה על `RESTORE.cmd`.
   בסוף הריצה הראשונה כתוב `ALMOST DONE - only the keys are missing`; אחרי העתקת הקובץ והריצה השנייה כתוב `DONE - the computer is ready`.
3. **פותחים את Claude Code בתיקייה `C:\RnD` וכותבים:** «תמשיך מאיפה שעצרת».
   Claude יקרא את `memory/HOT.md` ואת `development/tasks/3dengine/m2.1/README.md`, ששם כתובה נקודת ההמשך.

**אם `RESTORE.cmd` נעצר:** כתוב בשורה האדומה מה חסר. מתקנים ומפעילים שוב — שלב שכבר בוצע מדולג, ושום דבר לא נדרס. אפשר גם לפתוח את Claude Code בתיקיית החבילה ולכתוב «תסיים את השחזור לפי README-HE.md».

## מה יש בחבילה

| פריט | מה זה | גודל |
|---|---|---|
| `RESTORE.cmd`, `restore.ps1` | קובץ השחזור (לחיצה כפולה על הראשון) | קטן |
| `rnd-repo.bundle` | כל המאגר של `C:\RnD` בקובץ אחד: כל הענפים, כל ההיסטוריה, וכל הקבצים ש-git שומר (כולל המדיה וקובצי ה-PDF של הבדיקות, שלא נמצאים ב-GitHub) | כ-780MB |
| `not-in-git\Projects\3Dengine\` | מה ש-git לא שומר והמנוע צריך: 57 מודלי הריהוט, תמונת השמיים, וקובץ ההגדרות המקומי של המנוע | כ-310MB |
| `not-in-git\.wt\deploy-P-7\` | אתר ההדגמה (סיור 846) שהמנוע מציג במצב הדגמה ושבדיקת הקצה-לקצה פותחת | כ-430MB |
| `agent-side\` | צד הסוכן (ממשק הסוכן ומעטפת Pi), שבדיקת הקצה-לקצה של המנוע צריכה. בחבילה המקומית: שני מאגרים קטנים. בהורדה מ-GitHub התיקייה לא בקובץ; `RESTORE.cmd` מוריד אותה בעצמו אם היא פורסמה | קטן |
| `claude-memory\` | הפתקים של Claude עליך ועל הפרויקטים (העדפות, כללים, מצב) | קטן |

קובץ המאגר נבנה ב-19.11.2026 ונבדק (`git bundle verify`: תקין). הוא מכיל 32 ענפים; `main` ו-`3dengine` עומדים על אותה נקודה, כולל העבודה שבאמצע אבן דרך 2.1.
הפתקים של Claude נמצאים גם ב-GitHub וגם בתוך המאגר, בתיקייה `docs\claude-memory-export\`.

**מה אין בחבילה:** קובץ המפתחות. אותו אתה מעתיק בעצמך (פעולה 2). Claude לא נוגע בקובץ הזה: ההגדרות של המאגר חוסמות אותו בכוונה.

## מה `RESTORE.cmd` עושה, לפי הסדר

1. בודק את הכלים ומתקין את מה שחסר: Git, ‏Node.js 24.22.1, ‏Python 3.13, ‏Blender 4.5.10 (הגרסה המדויקת שהמנוע דורש), Chrome ו-Claude Code.
2. משחזר את המאגר אל `C:\RnD` מתוך `rnd-repo.bundle`, עם כל הענפים, ומגדיר את GitHub בשם `github`.
3. יוצר את תיקיית הפיתוח של המנוע: `C:\RnD\.wt\3dengine` (הענף `3dengine`).
4. מעתיק את מה ש-git לא שומר: לתיקיית הפרויקט, לתיקיית הפיתוח, ואת אתר ההדגמה אל `C:\RnD\.wt\deploy-P-7`.
5. מעתיק את הפתקים של Claude אל `%USERPROFILE%\.claude\projects\c--RnD\memory\` (רק אם אין שם פתקים).
6. משחזר את צד הסוכן: `C:\HABAIT-Agent-UI` ו-`C:\pi-main\habait`, ומתקין את שורת הפקודה של Pi (גרסה 1.5.2).
7. בונה את סביבת המנוע (ספריות Python ו-Node) ומריץ את בדיקת המוכנות בשתי התיקיות. התוצאה הרצויה: `READY`.

הקובץ לא דורס דבר: אם `C:\RnD` כבר קיים ואינו המאגר הזה, הוא נעצר ואומר זאת.

## אותם שלבים ביד (רק אם צריך)

פותחים חלון Git Bash, ובכל מקום שכתוב `D:\carry` כותבים את המקום שבו שמת את החבילה.

```
git clone "D:/carry/rnd-repo.bundle" C:/RnD
cd C:/RnD
git config user.name "Eliran Shopen"
git config user.email "eliran@habait.ai"
for b in $(git branch -r | grep -v HEAD | sed 's#^ *origin/##'); do git branch -q "$b" "origin/$b" 2>/dev/null; done
git remote remove origin
git remote add github https://github.com/Eliranshopen/HABAIT.git
mkdir -p C:/RnD/.wt
git -C C:/RnD worktree add C:/RnD/.wt/3dengine 3dengine
cp -r "D:/carry/not-in-git/Projects/3Dengine/." C:/RnD/Projects/3Dengine/
cp -r "D:/carry/not-in-git/Projects/3Dengine/." C:/RnD/.wt/3dengine/Projects/3Dengine/
cp -r "D:/carry/not-in-git/.wt/deploy-P-7" C:/RnD/.wt/
mkdir -p "$USERPROFILE/.claude/projects/c--RnD/memory"
cp "D:/carry/claude-memory/"*.md "$USERPROFILE/.claude/projects/c--RnD/memory/"
cd C:/RnD/.wt/3dengine/Projects/3Dengine
node engine/cli.mjs setup-env --go
node engine/cli.mjs doctor
```
השורה האחרונה צריכה להיות `READY`. אותן שתי פקודות אחרונות גם ב-`C:/RnD/Projects/3Dengine`.

## איפה העבודה נעצרה

אבן דרך 2.1 (רינדור כשלב במנוע), באמצע. 7 מתוך 27 אבני דרך סגורות.
- הוכחה ביד וחוזה: בוצעו.
- שלב הבנייה ושלב הרינדור: כתובים, ומבחני היחידה שלהם עוברים (458 מתוך 458 בסוויטה המהירה).
- מבחן הסגירה על Blender אמיתי: כתוב. בריצה הראשונה השלבים עבדו; המבחן עצמו תוקן ועוד לא רץ שוב עד הסוף.
- נשאר: להריץ את מבחן הסגירה, החובות שהועברו לאבן הדרך, השער, סוקר חדש, וסגירה.

## כשחוזרים למחשב הזה

העבודה שתיעשה במחשב האחר נשמרת שם. כדי להחזיר אותה לכאן: במחשב האחר יוצרים קובץ מאגר חדש (`git bundle create rnd-repo.bundle --all`), מביאים אותו לכאן ומושכים ממנו (`git pull <הקובץ> main`). GitHub לבדו לא מספיק לזה: יש בו קוד וטקסט בלבד, בלי היסטוריה.

## לדעת

- החבילה היא של פרויקט המנוע. היא מכילה גם את שאר המאגר כפי שנשמר ב-git, אבל לא קבצים של פרויקטים אחרים שלא נשמרו ב-git (שינויים שלא נשמרו של סשנים אחרים, תיקיות עבודה שמוחרגות).
- מנעול ה-Blender של המכונה הוא הקובץ `C:\RnD\.wt\_blender.lock`. לכן צריך שהתיקייה `C:\RnD\.wt` תהיה קיימת (השחזור יוצר אותה).
- צד הסוכן משוחזר רק כדי שבדיקות המנוע ירוצו. חיבור המנוע לסוכן האמיתי שלך (Pi) במחשב האחר הוא צעד נפרד: `python C:\pi-main\habait\install-global.py`, והוא נעשה רק כשתרצה.
