# OWED: חובות פתוחים של ה-harness ב-Habait

כלל (מסקיל `plan-to-tasks` שלב 12): לוח שקיים רק בעץ העבודה הוא לוח שאף אחד אחר לא יכול לקרוא. כשאי אפשר לעשות commit, החוב נרשם כאן, עם בעלים ומקור.

| # | נפתח | חוב | בעלים | מקור | נסגר |
|---|---|---|---|---|---|
| 1 | 2026-11-02 | הלוח `development/tasks/habait-workplan-2026-11-02/`, 7 הגדרות הסוכנים ב-`.claude/agents/` ו-`docs/agent-team-org-chart.md` **לא במעקב git**: `C:\RnD\Projects\Habait` אינו ריפו, ו-`habait-walkaround` אסור ב-commit בלי בקשה מפורשת של אלירן (CLAUDE.md כלל 3). פתרון לבחירת אלירן: (א) `cd /c/RnD/Projects/Habait && git init && git add development docs .claude/agents SESSIONS.md memory.md CLAUDE.md && git commit -m "harness: task board, agent team, governance"` (ריפו נפרד לשכבת הניהול; ה-`habait-walkaround` נשאר submodule-free, פשוט תיקייה בתוכו עם `.gitignore` שמחריג אותו, את `tools/` ואת הסרטונים); או (ב) להעביר את `development/`, `docs/` ו-`.claude/agents/` לתוך `habait-walkaround` ולבקש commit. | אלירן | `C:\RnD\Projects\Habait\development\tasks\habait-workplan-2026-11-02\` | |
