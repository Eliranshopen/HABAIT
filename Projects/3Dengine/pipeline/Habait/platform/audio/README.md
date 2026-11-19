# audio/ — background sound of the cinematic flight (card 36, 2026-11-03)

`ambience.m4a` is a byte copy of habait-98's `research/fal-bench-2026-11-02/flyover3d/data/audio/ambience.m4a` (v4, the one live on
habait-flow since deploy 17), copied for the platform's cinematic player (`js/cine.js`) with the source note below, which carries the
licences. Eliran's rule (memory.md §1): light, sparse bird chirps from the first frame, no crickets, no trills, no loops of one phrase;
browsers refuse sound without a touch, so it starts on the first tap (speaker button in the HUD) and fades out at the tour.

---- source README (verbatim) ----

# ambience.m4a — background sound for the orbit video and the hold
v4 (2.11 ~18:50, Eliran on the live v2: "לא רוצה צרצרים רוצה ציוץ ציפורים קליל"): composed, not a raw recording. Twelve sparse
house-sparrow chirp groups (Wikimedia Commons "House Sparrows chirping.ogg", QWerk, CC BY-SA 3.0; pitch ±6 %, random gain/pan, gaps
2.5–7 s) + three distant goldfinch tinkles ("Carduelis carduelis - Spring call.oga", Ewithu, CC BY 4.0, −13 dB) over a faint air bed
(pink noise 250–2500 Hz at −52 dBFS, so the gaps are not digital silence). highpass 300 / lowpass 9k, loudnorm −28 LUFS, NO compression,
2 s fades, 60 s loop with the seam in a gap. volumedetect: mean −39.8 dB, max −12.0 dB (v2 was −30.1 / −9.6).
Composer: session scratchpad amb4/compose.py (seed 846). Attribution for the two Commons clips is required (BY / BY-SA) — keep this note.
History: v1 birds+surf (synth waves, rejected); v2 Reggelirigók blackbird (the SOURCE has a steady ~4.8 kHz cricket band → "צרצרים");
v3 "Birds singing in garden" (the file is one 12 s trill phrase looped 4×; dense trills, risky) — never deployed. v1–v3 in scratchpad audio_src/.
