# fix-846-fidelity-2026-11-08-every-visit — the walkthrough on every visit, its music as early as allowed, the wide-window clip
<!-- last-updated: 2026-11-10 -->
<!-- context file · 2026-11-08 · fork A fix-846-fidelity -->
## What's here
Eliran (2026-11-08): «אני רוצה שכל פעם שאכנס ללינק מחדש יתחיל לי ההסבר על הכפתורים», «ושהמוזיקה של ההסבר על הכפתורים תופעל», and his
1741 px screenshot of /hold/ → the tour with the place card cut at the right edge. $0, the shared viewer.

| File / folder | What |
|---|---|
| `paths/qa-music-paths.json` | what plays when, per path × 1440/390: probes by CDP `userGesture:false`, real taps, and a labelled autoplay-policy STAND-IN (this Chrome does not enforce the Web Audio rule under automation and Playwright's evaluate counts as a gesture — see the header of `qa-music-paths2.mjs` in the session scratchpad) |
| `paths/paths-*.png` | the first card with the music invite; the walkthrough open after /hold/ and after the landing |
| `wide/forced-scroll.txt`, `wide/forced-scroll-*.png` | the clip's mechanism: a scroll offset forced on the tour root — the old build (overflow:hidden) shifts 400 px and cuts the place card, the new one (overflow:clip) does not move |
| `wide/qa-wide-*.json`, `wide/*.png` | 1280 / 1366 / 1536 / 1741 / 1920 and zoom 90 / 110 %: no scroll offset, nothing past the viewport, before and after |
| `regress/qa-menus.json` | the menus and the walkthrough, 3 contexts × 1440/390, on the new build |
| `gate/verdict.json` | the responsive gate |

## Links
Parent: [../CLAUDE.md](../CLAUDE.md) · The menus round: [../fix-846-fidelity-2026-11-08-menus/CLAUDE.md](../fix-846-fidelity-2026-11-08-menus/CLAUDE.md)
