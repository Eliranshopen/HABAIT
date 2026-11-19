# fix-846-fidelity-2026-11-08-direction-c — the tour UI, direction C implemented
<!-- last-updated: 2026-11-10 -->
<!-- context file · 2026-11-08 · fork A fix-846-fidelity -->
## What's here
Eliran's picks (2026-11-08): direction C (the place card plus three labelled clusters), the house warm-stone palette, the walkthrough
on the first visit only. The proof of the build in the shared viewer (`Habait/tour360/viewer/`), apt846 `--catalog=ai`, $0.

| File | What |
|---|---|
| `qa-c.json` | 3 contexts (tour · apartment · hold) × 1440/390: layout (cluster overlaps, targets < 44, AI line on screen), measured contrast of the concept / AI / apartment / room lines (text hidden → the pixels behind it → WCAG ratio, worst pixel), the design panel (anchored on desktop, above the AI line on phone), the language, the strip, the view switch (plan sheet, 3D with the rise), the ruler, the guide, the rings; the walkthrough (first visit, reload, (?) replay, transform glide, tooltips) |
| `qa-c-walk.json` | a door marker walks, a ring tap (static build: no pick bar without the live API, as before), the new controls' tooltips, the keyboard language list, reduced motion |
| `gate/verdict.json` | the responsive gate on the build (3 contexts × 1440/390) |
| `c-*.png`, `walk-*.png`, `gate/*.png` | the screenshots looked at by eye (gitignored images) |

The scripts live in the session scratchpad (`qa-c.cjs`, `qa-c-walk.cjs`, `qa-c-sum.py`).

## Links
Parent: [../CLAUDE.md](../CLAUDE.md) · The research and the three directions: [../fix-846-fidelity-2026-11-08-redesign/CLAUDE.md](../fix-846-fidelity-2026-11-08-redesign/CLAUDE.md)
