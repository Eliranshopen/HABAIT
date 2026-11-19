# 06 — PoC QA and visual comparison (Phases 6–7)

**What was built:** a working Day/Night panorama viewer: **panorama-based (Option B)**, real Cycles renders, real WebGL cross-fade. Not a mock-up, not real-time 3D. Source: `../poc/` (setup in `../poc/README.md`).

## Evidence
| Claim | Evidence | Result |
|---|---|---|
| 6 lighting keyframes from one scene | `poc/out/final/manifest.json` (relight + render rows, seconds, $0) | 6/6 rendered, 1 640 s CPU total |
| Geometry identical across keyframes | same `depth_sha16` = `beac324afc9c7d6f` in all 6 rows | PASS |
| Idempotent re-run | `build_keyframes.py … --run` again → 6 × "SKIP (done)" | PASS |
| The viewer blends exactly two keyframes linearly | `poc/qa/shots/qa-result.json`: 16:00 = 0.5·15:00 + 0.5·17:00 (fitted weight 0.496–0.501, error 0.25–0.83/255 across two runs); 20:00 = 0.5·18:30 + 0.5·21:30 (0.502, 0.25/255) | PASS |
| Real browser paints it | Chrome (Playwright, SwiftShader WebGL), real HTTP server: 11 screenshots, no console errors, no horizontal overflow (both edges, RTL) | PASS (exit 0) |
| Desktop 1440×900 and phone 390×844 | `poc/qa/shots/desk_*.png`, `phone_*.png`, `sheet_final_ui.jpg` | PASS |
| Defects found and fixed during QA | error banner visible over a working canvas (`[hidden]` overridden by CSS), favicon 404, "100 % · 0 %" label at an exact keyframe | fixed, re-run PASS |
Not tested: real touch hardware (only emulated touch viewport), iOS Safari, a real GPU in the browser (SwiftShader only), memory on a low-end phone.

## Against the reference (`07-compare-reference-vs-poc.jpg`)
| Aspect | Reference | PoC | Gap |
|---|---|---|---|
| Slider mechanism | 2-keyframe linear cross-fade | the same, proven | none |
| Geometry stability across states | objects drift (AI edit) | identical by construction | **PoC better** |
| Number of states | 3 seen (+ morning likely) | 6 | PoC more |
| Lighting realism by day | warm GI, crisp sun patches | sun patch present but washed out; walls near-white | large |
| Night atmosphere | coves, pendant, under-cabinet, city lights, blue sky | ceiling discs only; dark plain exterior | large |
| Materials | travertine, veneer, fabric | flat white/beige draft materials | large |
| Resolution / sharpness | sharp at 1440 | 2048 panorama → soft at 1440 | large, easy |
| Reflections | faint on glass at night | almost none | medium |
| Navigation | drag, tabs (yaw tweens), hotspots, plan modal, 2 nodes | drag, inertia, pinch, keys, tabs; 1 node; no plan modal | small |
| Transition smoothness | double sun patch mid-fade | the same artefact (same mechanism) | equal |
**The reference's quality is NOT matched.** The feature is.

## Improvements by impact ÷ effort
1. **Resolution** 2048 → 8192 (4096 on phones): `--res 8192x4096 --samples 128+` on the GPU box. Impact high, effort trivial, compute only.
2. **Decorative night lighting**: cove LED strips, a pendant over the table, under-cabinet strips as emitters scaled by `interior`. Impact high on night, effort medium (`build_scene.py` fixture kit).
3. **Materials**: textured stone/wood/fabric from the style lock (or the developer's finish list). Impact high, effort medium. **Eliran's call** (house look vs developer look, open on Kedma).
4. **Day contrast**: lower day exposure (1.0–1.5), keep the window bloom, add a light portal on the balcony opening to cut noise. Impact medium, effort low.
5. **Exterior**: a non-locating backplate per keyframe (day/dusk/night with lit windows). Impact medium-high; **Eliran's call** (the view outside, legal/disclosure).
6. **Mid-fade double shadow**: hourly keyframes 14–18 or a separate lamps-only pass. Impact medium, effort low (compute).
7. **Real sun path** from latitude/date + the plan's north arrow (the PoC assumed plan-up = north). Impact on truthfulness, effort low.
