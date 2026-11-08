# Habait/tools/qa/ — the responsive gate
<!-- created: 2026-11-05 · fork F (rnd-9d), project-runner · authority: Eliran («כל דבר שאתה מעדכן חייב להתאים גם לגרסת המובייל בנוסף לגרסת הדסקטופ» — «וזה כלל שחייב להיות בלוגיקה בקוד») -->

| File | Purpose |
|---|---|
| `responsive-gate.mjs` | headless Chrome at 1440×900 and 390×844 (mobile + touch): FAIL on page errors, HTTP 4xx/5xx, horizontal overflow on EITHER side (RTL overflows left), targets under 44×44, a fixed/absolute control over > 15% of the panorama; `verdict.json` + screenshots. CLI and `import { gate, serveStatic }` |

Callers: `tour360/tools/run-project.mjs` step `qa` (a project that fails is not published), `../deploy/predeploy.mjs`.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md)
