# fix-846-fidelity-2026-11-08-host-audio — the walkthrough music hosted by /hold/, the phone start card, no restart on a design change
<!-- last-updated: 2026-11-10 -->
<!-- context file · 2026-11-08 · fork A fix-846-fidelity -->
## What's here
Eliran (2026-11-08, iPhone): «המוזיקת רקע של ההסבר על הכפתורים עדיין לא פועלת אוטומטית במובייל» and «כל פעם שאני משנה עיצוב זה מתחיל מחדש את
הסשן של ההסבר על הכפתורים». $0.

| File / folder | What |
|---|---|
| `qa-host.json` | Pixel 7 (Chromium-rule stand-in), iPhone 14 descriptor (WebKit-rule stand-in, Chromium engine — no WebKit build here), desktop 1440: the /hold/ path (the parent's AudioContext unlocked in «המשיכו אל הדירה», the tour's music on it at the walkthrough's open with zero taps in the tour, the tour never makes its own context; «דלג» quiets the parent), the direct link (the phone start card, its tap starts the autoplay + the music; desktop none), no restart (skip → floor ×3, look ×2, language, room: closed; manual reload / new tab: opens; mid-walkthrough floor: never 1/N) |
| `host-*.png` | the phone start card; the walkthrough open after /hold/ (gitignored images) |
| `regress/qa-menus.json`, `gate/verdict.json` | the menus + walkthrough regression 3 contexts × 1440/390; the responsive gate |

Script in the session scratchpad: `qa-host.mjs`.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md) · The phone round: [../fix-846-fidelity-2026-11-08-mobile/CLAUDE.md](../fix-846-fidelity-2026-11-08-mobile/CLAUDE.md)
