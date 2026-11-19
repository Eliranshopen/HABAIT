# מחקר סטאק וארכיטקטורה לפרויקט הדמיות — תכנית

## Context
אלירן רוצה לעבור מ"משחק" לתשתית רצינית: מחקר שמסיים בהמלצה מנומקת על הסטאק והארכיטקטורה הנכונים לפרויקט הדמיות כמו Habait (תוכנית מכר → מודל → פנורמות/רינדור → סיור 360 → קונה), עם הסבר "למה" לכל בחירה, ומסלול מעבר מהקיים.
היקף שנבחר: **ארכיטקטורת יעד + מסלול מעבר**. לקוחות: **יזמים (B2B portal) וגם קונים (B2C viewer)**. פלט: **עמוד HTML + קובץ MD ב-development/plans**.

## המצב הקיים (נאסף, Explore 2026-11-08)
- **Frontend:** אין framework. HTML + ES modules; three 0.170 (platform) ו-0.185 (engine) — שתי גרסאות; Pannellum 2.5.6 inlined; Photo Sphere Viewer 5.15 דרך Vite+TS כ-`--engine`; פורטל `studio-web/` ב-JS נקי + Clerk + pdf.js; CSS tokens, RTL ידני.
- **Backend:** פונקציות Vercel `.mjs` (`studio-web/api/`, `tour360/server/handler.mjs`); Python ל-pipeline (`engine/`, `tour360/tools/auto_*.py`).
- **Compute:** Blender 4.5 headless (`360walkaround/pipeline/build_scene.py`, `render_pano.py`), CPU בלבד מקומית; Vercel Sandbox כ-worker (תקרת 45 דק', 4 vCPU, Hobby); Kaggle ל-flyover.
- **Jobs:** תור = קבצי JSON באחסון (`studio/queue/<job>.json`, `job.v1`), dispatch ב-`studio-web/api/_dispatch.mjs`.
- **Data:** אין DB. הכל JSON (`plan.json`, `apartment.json`, `scenes.json`); אחסון דרך adapter אחד `studio-web/api/_store.mjs` → Supabase Storage (Blob הושעה 2026-11-05).
- **AI:** fal.ai (תמונה), OpenRouter (Claude Sonnet 5.5 vision, Gemini).
- **כאבים:** מגבלות Hobby, אין GPU, אין DB/multi-tenant, אין תור עמיד, drift בתלויות, כמה pipelines בלי סימון מי עדכני (OWED-020), deploy ידני דרך `stage_flow.py`.

## השערות עבודה (ייבדקו במחקר, לא מסקנות)
| שכבה | השערה | הנימוק שייבדק |
|---|---|---|
| Frontend app | **Next.js (App Router) + React + TypeScript** | SSR/SEO לעמודי פרויקט ושיתוף לקונה; פורטל app-like (auth, טפסים, state); אקוסיסטם 3D של React (R3F/drei) הכי חזק; Vercel native. מול Angular (כבד, אקוסיסטם 3D חלש) ומול Vanilla (המצב היום — לא מחזיק פורטל רב-משתמשים) |
| Viewer | **חבילת viewer עצמאית, framework-agnostic** (PSV/three, נבנית ב-Vite כ-Web Component) | אותו viewer נטען ב-Next, ב-embed באתר יזם, ובקובץ סטטי; מתעדכן בנפרד מהאפליקציה |
| Backend web/API | **TypeScript** (Next route handlers / שירות Hono) | שפה אחת עם ה-frontend, טיפוסים משותפים, zod |
| Backend compute | **Python** | bpy של Blender, pymupdf, ezdxf, OpenCV — הכל Python-native; לא לכפות שפה אחת |
| חוזה בין השניים | **JSON Schema כמקור אמת** → zod + pydantic | `plan.json`/`job.v1` כבר קיימים; להפוך לחוזה מוקלד |
| Jobs | **תור עמיד + workflow** (Vercel Workflow/Queues מול Inngest/Trigger.dev מול תור ב-Postgres) | retries, idempotency, ריצות ארוכות, checkpoint (§5) |
| GPU render | **worker בקונטיינר Docker על GPU לפי דרישה** (Modal / RunPod / אחר) | Blender Cycles על GPU, בלי תקרת 45 דק' |
| DB | **Postgres (Supabase)** | orgs/יזמים, פרויקטים, דירות, jobs, משתמשים, אנליטיקס; כבר משתמשים ב-Supabase Storage |
| Assets | **Object storage + CDN** (Supabase Storage מול Cloudflare R2) | פנורמות כבדות; עלות egress |
| Auth | **Clerk (Organizations)** | כבר בשימוש, multi-tenant ליזמים |
| Repo | **Monorepo: pnpm + Turborepo** (apps/web, packages/viewer, packages/schemas) + `services/pipeline` (Python, uv) | גבולות ברורים, גרסה אחת של three |

## שלבי ביצוע (אחרי אישור)
0. **שם קובץ התכנית** — לשנות את שם הקובץ הזה ל-`2026-11-08-visualization-stack-research.md` ולהוסיף שורה לטבלה ב-`development/plans/CLAUDE.md` (§8.8).
1. **מחקר רשת** — 2 סוכנים במקביל (sonnet, read-only + WebSearch), עם brief שאוסר פתיחת `.env`:
   - A: Frontend + Viewer — Next.js מול Angular מול React SPA (Vite) מול Vanilla; ספריות 360 (PSV, Pannellum, Marzipano, three/R3F), Gaussian Splatting כאופציה עתידית, embed, RTL, ביצועים במובייל.
   - B: Backend + Compute + Infra — שפת backend (TS/Python/Go), תורים/workflows, ספקי GPU ל-Blender (מחיר לשעה, cold start, Docker), Postgres/Supabase, R2 מול Supabase Storage, מגבלות Vercel Hobby מול Pro.
   - כל טענה עם מקור עדכני ותאריך; מה שלא אומת מסומן "לא מאומת".
2. **מטריצת החלטה** לכל שכבה: קריטריונים משוקללים (התאמה לתלת-ממד/360, SEO, מהירות פיתוח עם AI, גיוס בישראל, עלות, lock-in, התאמה לקוד הקיים) → בחירה + "למה" + "מה ויתרנו".
3. **מסמך MD** `development/plans/2026-11-08-visualization-stack-architecture.md` + שורה בטבלה ב-`development/plans/CLAUDE.md` (§8.8). מבנה:
   - תקציר החלטות (טבלה אחת)
   - דיאגרמת ארכיטקטורה (Upload → API → Queue → Python/GPU workers → Storage/CDN → Viewer/Portal)
   - פרק לכל שכבה: האפשרויות, הבחירה, למה, מה ויתרנו
   - מודל נתונים בסיסי (Org, Project, Building, Unit, Plan, Job, Asset, Tour)
   - עלויות משוערות בחודש (קטן / בינוני)
   - **מסלול מעבר** בשלבים (strangler): schemas → Postgres → monorepo+viewer package → Next.js לפורטל → תור+GPU worker → buyer site; מה נשאר, מה מוחלף, סדר וסיכונים
   - שאלות פתוחות להחלטת אלירן (עלות, ספקים בתשלום — §6/§7)
4. **עמוד HTML** — `Artifact` quickstart (`intent: other`), טעינת `artifact-design`, עברית RTL, דיאגרמת SVG, טבלאות השוואה, מובייל 390 + דסקטופ; פרסום פרטי ושליחת קישור.
5. **זיכרון (§0)** — רשומה ב-`memory/project/` + שורת pointer ב-`memory/INDEX.md` (רק השורה שלי), ו-HOT.md אם רלוונטי. קורא שני: אין (מחקר, לא החלטה).

## מה לא נעשה
- אין שינוי קוד, אין worktree (מסמך מחקר, לא שינוי פרויקט — §8.7), אין קריאה בתשלום, אין deploy.
- ההמלצות הן הצעה; כל בחירה בספק בתשלום או מעבר בפועל = החלטה של אלירן ו-board נפרד.

## אימות
- כל טענה במסמך עם מקור (קישור + תאריך) או נתיב קובץ בריפו.
- עמוד ה-HTML נבדק ב-390 וב-1440, RTL תקין, בלי גלילה אופקית.
- `generate-cards.py --check` נקי אחרי הוספת הקבצים; שורת plans/CLAUDE.md קיימת.
