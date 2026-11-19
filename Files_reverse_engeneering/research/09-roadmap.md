# 09 — Implementation roadmap (Phase 9)

Each step names its tools. Decisions marked **Eliran** are not taken here.

| # | Step | Tools | Done when | Cost |
|---|---|---|---|---|
| 1 | Decide: adopt "explore the light" in the product? which hours (4 or 6 keyframes)? | — | **Eliran** | — |
| 2 | Night fixtures in the scene kit: cove strips, pendant, under-cabinet LEDs, tagged as `interior` emitters | `build_scene.py`, style lock | a night render of one room shows them; fidelity gate still passes | $0 |
| 3 | Real sun path from latitude/date + the plan's north arrow → presets generated, not hand-written | small Python (solar position), `plan_meta` | presets file is an output of the plan | $0 |
| 4 | Look pass on ONE room: day contrast, materials, exterior plate | Blender, previews 1024/16 | Eliran picks from two real pictures of his room (house look vs developer look; view outside) | $0 |
| 5 | Final keyframes at 8192 (+4096 for phones) for that room on the GPU box | `build_keyframes.py`, `render_pano.py` | manifest: depth hashes equal | $0, ~2–3 h GPU |
| 6 | Port the mix shader into the tour engine (PSV/three `tour360/engine`) as a keyframe layer + slider; keep `setLook()` | TypeScript, PSV 5.15 | tour opens with the slider; existing tests pass | $0 |
| 7 | Lamps-only pass + a lights on/off toggle (removes the double shadow) | Blender render layers | QA shows no double patch at mid-fade | $0 |
| 8 | Engine stage: "light keyframes" after "render" in `Projects/3Dengine` (one milestone, Eliran's gate) | engine stages, MCP | the agent can ask for a night view | $0 |
| 9 | QA cards: live result, then the deployed site (after his own deploy go) | `run_qa.sh` → habait-deploy-qa | 1440 + 390, Chrome + Edge | — |
| opt | AI relight shortcut (fal edit) behind a pixel-diff gate + AI badge | fal.ai ($0.04/image, `03`) | — | **Eliran** (spend, disclosure) |
