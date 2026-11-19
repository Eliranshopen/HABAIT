# fix-846-fidelity-2026-11-08-coach-music — background music under the button walkthrough
<!-- last-updated: 2026-11-10 -->
<!-- context file · 2026-11-08 · fork A fix-846-fidelity -->
## What's here
Eliran (2026-11-08): «שבשלב ההסבר על הכפתורים כשנכנסים להדמיה יהיה כמו מוזיקה רקע עם קצב משהו נעים ... שקט לא נותן תחושה נעימה». The music
is made in the browser (Web Audio, `viewer/tour.js` musicBar/musicStart/musicStop/musicRender): a fixed score, no file, no licence. $0.

| File | What |
|---|---|
| `qa-music.json` | 3 contexts × 1440/390 with the browser's real autoplay rule: no AudioContext before a gesture; "running" after a tap; kept on «הבא»; suspended after «דלג» and the 1.5 s fade; (?) plays again; mute persists across a reload; a hidden tab suspends; the walkthrough's end suspends; the voice tour stops it; the sync (v2: each auto step change on the music's bar line, its accent played; «הבא» by hand plays one on the next beat); then every `[id]` box outside the card, old build vs new (nothing moved); the preview's peak and determinism |
| `coach-music-preview-v2.wav` | **v2 (Eliran: «…קצת יותר קצב שמותאמת לקצב מעבר ההסבר… לא מוזיקה מרדימה»)**: 27.5 s, light house at 108 BPM, one walkthrough step = 3 bars = 6.667 s, step changes at 6.77 / 13.43 / 20.10 / 26.77 s each with its accent (chime + shimmer) — the same musicBar()/musicAccent() as the page (untracked media) |
| `coach-music-preview.wav` | v1, superseded: | 24 s, 44.1 kHz stereo, 16-bit: the same score rendered with OfflineAudioContext — for Eliran to hear before a deploy (untracked: media stays out of git) |
| `music-*.png`, `ui-*.png` | the card's first and second step with the toggle; the chrome old vs new (gitignored images) |
| `gate/verdict.json` | the responsive gate on the build |

The script lives in the session scratchpad (`qa-music.cjs`).

## Links
Parent: [../CLAUDE.md](../CLAUDE.md) · Direction C: [../fix-846-fidelity-2026-11-08-direction-c/CLAUDE.md](../fix-846-fidelity-2026-11-08-direction-c/CLAUDE.md)
