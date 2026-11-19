# fix-846-fidelity-2026-11-08-menus — the tool menus, the walkthrough's first visit, the voice cut, the disclosure line
<!-- last-updated: 2026-11-10 -->
<!-- context file · 2026-11-08 · fork A fix-846-fidelity -->
## What's here
One round of four of Eliran's asks (2026-11-08), $0, in the shared viewer:
1. «כלי עזר» (מדידה · סיור קולי) and «סגנונות צפייה» (360° · תוכנית · תלת-ממד) as menus beside «שינוי עיצוב»; the bottom view switch is gone.
2. The walkthrough opens on the first visit through every entry path (key v2; it waits for a hidden frame / the intro video instead of giving up).
3. The guide no longer mentions the number of rooms: the entrance clip's sentence cut with ffmpeg (no re-voicing), the caption likewise.
4. The disclosure line without its brown band: white text with a soft shadow on the picture, contrast measured in every room/look/floor.

| File / folder | What |
|---|---|
| `qa-menus.json`, `menus-*.png` | 3 contexts × 1440/390: openers, menus anchored / sheets above the action bar, one at a time, Esc / outside tap, keyboard, the lit «כלי עזר», 3D from #t-plan-btn, the walkthrough walking into the menus |
| `entry/` | the walkthrough's auto-open per entry path on a stage from live (fresh context each): timeline, never open while its frame is hidden, the open card shot |
| `voice-cut/` | the cut's frame strip and waveform at the join (the alignment and the levels are in `Habait/tour360/apartments/apt846/guide/he/01-entrance.cut.json`) |
| `disclose/` | worst-pixel contrast of the AI line and the look note around their letters, 11 rooms × 2 looks × 3 floors × 1440/390, and the brightest / darkest rooms shot whole |
| `gate/` | the responsive gate |

Images are gitignored; the JSON reports are tracked.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md)
