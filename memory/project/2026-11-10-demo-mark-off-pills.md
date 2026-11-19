# 2026-11-10 — «נתוני הדגמה» comes off the building's pills (Eliran: option 1)
- **Layer:** project · **Written by:** main session (the simulation-fixes session) · **Second reader:** none
- **Decision (Eliran, ~16:30, answering «1»):** the demo mark is removed from the unit pills on the hold building; it stays on the unit card / phone sheet, the «דירות» drawer, the apartment page and the landing availability. Why: only pills that show their sub-line showed the mark (876, 866, 826 on desktop; none on a phone), so it read as if only three units were demo data, while every unit except 846 is `source: demo`.
- **Change:** `Habait/platform/js/picker.js` markerHTML (no `.demo-mark`), `css/style.css` (rule removed), `test/units-demo-marker.shots.mjs` (asserts 0 marked pills). Worktree `.wt/demo-mark-pills`, commit `eef1a7d`, merged `a761c00`.
- **Checks:** predeploy PASS; `units-demo-marker.shots.mjs` PASS at 390 and 1440 on stage `test-r17`; stage vs `test-r16`: 2 files changed (js/picker.js, css/style.css).
- **Shipped:** test link only — rainbow-v2-test `dpl_AnoNEbHmW14C9gsqUHxTyxCZAQea`; served picker.js and style.css = stage (sha256). habait-flow untouched.
- **Supersedes** the pills part of `runs/2026-11-10-units-demo-marker.md` (the badge elsewhere is unchanged).
