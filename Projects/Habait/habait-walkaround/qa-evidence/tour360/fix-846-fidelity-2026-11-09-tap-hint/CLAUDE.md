# fix-846-fidelity-2026-11-09-tap-hint — the phone tap hint above the AI line
<!-- last-updated: 2026-11-10 -->
<!-- context file · 2026-11-09 · fork A fix-846-fidelity -->
## What's here
Eliran (2026-11-09): «כשמגיעים להדמיה של הדירה אני רוצה איזה משפט חיווי קטן… "להסתרת הכפתורים לחץ על המסך"… "להצגת הכפתורים לחץ על המסך".
שגם החיווי הזה לא יסתיר את המסך אלא יופיע למטה בעיצוב זכוכית חום בהיר מעל המשפט "תמונות שנוצרו בבינה מלאכותית"». $0.

| File / folder | What |
|---|---|
| `taps/qa-taphint.json`, `taps/*-shown.png`, `taps/*-hidden.png` | Pixel 7 and iPhone 14 descriptor, portrait and landscape: real taps flip the words; the pill against the AI line, the action bar, the room pill and the markers; EN/FR/HE words; busy states (menus, design panel, walkthrough, ruler, plan/3D) hide it in place without moving the action bar; cross-fade time; ink against the worst glass pixel in 11 rooms × both states; desktop 1440 against the previous build (every [id] box, the pixels) |
| `taps/qa-taphint-coach.json`, `taps/pixel7-walkthrough-open.png` | the walkthrough at load: the hint hidden behind it, back after «דלג» |
| `coach-full/qa-coach-full.json` | the whole walkthrough re-run on the new build (the phone action bar sits ~30 px higher): counts unchanged, no card out of view or over its lit control |
| `gate/verdict.json` | the responsive gate (static serve, `--ignore-api`) |

## Links
Parent: [../CLAUDE.md](../CLAUDE.md)
