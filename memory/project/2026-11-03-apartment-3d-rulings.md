## 2026-11-03 · main session (rnd-23) · apartment-3d board — Eliran's calls c, d and review cadence
- **Did:** Eliran ruled via AskUserQuestion: (c) rnd-23 takes Blender for ONE bounded local Cycles bake (card 07); (d) the 3D-tab disclosure caption stays word for word; review cadence = both phases run straight through with fresh-reviewer gates, he looks once at the A/B before copy-back.
- **Evidence:** `development/tasks/apartment-3d/task-02-eliran-calls.md` §Answers.
- **Learned:** card 10 copy-back still needs his explicit "good"; deploy remains a separate go (root §9).
- **Owed / open:** none from these calls.
- **Second reader:** none (habait-da is informed through the SESSIONS.md rnd-23 row when Blender is taken).

## 2026-11-03 · main session (rnd-fd) · dollhouse inside the 360 tour — Eliran's direction
- **Did:** Eliran asked how to bring the dollhouse (`dollhouse.html`) into the existing 360 tour; four options were explained in Hebrew (1 a 3D button/overlay inside the tour with "you are here" + tap-room-to-360; 2 a mini-dollhouse replacing the 2D plan; 3 a continuous Matterport-style rise-out-of-the-pano transition; recommendation 1 then 3). He chose **"1 ואחריו 3"**.
- **Evidence:** this session's AskUserQuestion answers, 2026-11-03 ~16:30; tour viewer `Habait/tour360/viewer/tour.js` (Pannellum; minimap bridge at :1120); GLB metres = plan cm, pano points within 20 cm (card 10 of board walkaround, minimap.test).
- **Learned:** it is a NEW board, filed as a plan in `development/plans/` only after apartment-3d closes; option 3 starts as a spike.
- **Owed / open:** the plan file + board (main session, after apartment-3d card 10).
- **Second reader:** none.

## 2026-11-03 · main session (rnd-fd) · apartment-3d — Eliran: realistic dollhouse via the tour's panoramas
- **Did:** after the quick before/after, Eliran: "אני רוצה שזה יראה כמשהו ריאליסטי". Probe showed scene.blend is mostly flat colours (the tour's realism is AI-skinned panoramas). He chose: project the tour panoramas onto the dollhouse (spike one room first, shown to him), on THIS board; copy-back of everything only after his "good" on the realistic look.
- **Evidence:** AskUserQuestion answers ~17:15; `development/tasks/apartment-3d/logs/probe-blend-materials.json`, `probe-blend-cameras.json` (one camera, CAM_cp-living); gate 2 `logs/gate2-report.md`.
- **Learned:** the light-only bake is the fallback layer under the projection, not the look.
- **Owed / open:** card 08b spike → his look → the full projection → gate → his "good" → card 10.
- **Second reader:** none.

## 2026-11-03 · main session (rnd-fd) · apartment-3d — realistic floors from the tour, Eliran's go to the final gate
- **Did:** the pano-projection spike proved the alignment exact but the AI skins redrew the furniture (smears). Eliran chose "רצפה אמיתית בלי מריחות": floors wear a clean tile of the tour's own floor (rectified from the pano per finish, de-lit, tileable) under the baked light; then "כן, לבדיקה הסופית".
- **Evidence:** `development/tasks/apartment-3d/after/phase3/` (via `.wt/apartment-3d/after/phase3/closeups_clean_vs_floortex.png`), board README Key state 18:20.
- **Learned:** AI-skinned panoramas keep architecture but not furniture: project them onto architecture only, or take materials (not pictures) from them.
- **Owed / open:** gate 3 → his "good" → card 10. Walls/furniture realism = a later board if he wants it.
- **Second reader:** none.
