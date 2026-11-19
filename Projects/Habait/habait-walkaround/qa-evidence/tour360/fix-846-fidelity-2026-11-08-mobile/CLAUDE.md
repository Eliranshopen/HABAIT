# fix-846-fidelity-2026-11-08-mobile — the phone round: music, (?), immersive mode, the design panel in the walkthrough
<!-- last-updated: 2026-11-10 -->
<!-- context file · 2026-11-08 · fork A fix-846-fidelity -->
## What's here
Eliran (2026-11-08, iPhone): «במובייל המוזיקה של ההסבר על הכפתורים לא עובדת», «הכפתור הזה של הסבר על הכפתורים לא מופיע במובייל», «בלחיצה על
המסך יופיעו הכפתורים ובלחיצה נוספת הם ייעלמו», «ההסבר על הכפתורים צריך להסביר גם על כל דבר בתוך כפתור ה"שינוי עיצוב"». $0.

| File / folder | What |
|---|---|
| `qa-mobile.json` | Pixel 7 (Chromium rule stand-in) and iPhone 14 descriptor (WebKit-rule stand-in, Chromium engine — no WebKit build installed): the music on the direct link and via /hold/ (state at open, after the first tap, the silent `<audio>` on iOS, «דלג», (?) replay, the end, «מוזיקה» as the first tap), (?) in portrait and landscape (elementFromPoint, a tap replays), the immersive mode (tap hides / shows, drag / pinch / double tap / a menu-closing tap do not, a door tap walks, hidden controls take no taps, badge + AI line stay), desktop 1440 no toggle |
| `help/qa-help-phone-prod.json` | live prod before the fix: (?) present and tappable at 360/390/430 portrait + landscape on the tour / apartment / hold paths once the walkthrough is closed |
| `coach-full/qa-coach-full.json`, `coach-full/*.png` | the whole walkthrough step by step on 1440, Pixel 7 and iPhone 14, visitor and unlocked: the design panel's controls in order, the card inside the viewport and off the lit control |
| `immersive-*.png`, `help-*.png` | shown / hidden at portrait and landscape; (?) on the phone (gitignored images) |
| `regress/qa-menus.json`, `gate/verdict.json` | the menus and the walkthrough 3 contexts × 1440/390; the responsive gate |

Scripts in the session scratchpad: `qa-mobile.mjs`, `qa-help-phone.mjs`, `qa-coach-full.cjs`.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md)
