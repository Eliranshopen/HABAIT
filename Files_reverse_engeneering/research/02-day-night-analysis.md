# 02 — Day/Night feature: technical analysis and options (Phase 2)

Evidence base: `01-video-forensics.md` §5 (measured). Tool facts: `03-tools-research.md` (sourced).

## The mechanism in the reference (MEASURED)
- Clock 06:00–22:00 (ticks Morning · Day · Sunset · Night), continuous slider, live HH:MM.
- Per room node: a few **discrete, pixel-aligned lighting keyframes** (day 14:00, sunset ~17:30, night 22:00 seen; morning UNKNOWN).
- Picture(h) = (1−t)·K_i + t·K_{i+1}, t linear in the clock between the two bracketing keyframes. At most two keyframes active.
- Side effect visible in the reference: during a fade, two sun patches show at half strength (a "double shadow"); this is the price of a pure image cross-fade.

## What changes between keyframes (OBSERVED)
| Element | Day | Sunset | Night |
|---|---|---|---|
| Sun | high, sharp patch on floor | low, warm streak on upper walls/cabinets | none |
| Sky / view | hazy bright | warm, lower contrast | blue hour, lit windows across the marina |
| Interior lights | off (pendant faintly lit) | pendant on | cove slot, under-cabinet, toe-kick, pendant on |
| Exposure | interior darker than window | similar | interior lifted; window darker than interior |
| Glass | transmits, no reflection | same | faint interior reflections |

## Options compared (score 1–5, 5 best; for a sales-plan-faithful platform)
| Criterion | A Real-time 3D (three.js/Babylon, lightmaps) | B Pre-rendered panos + cross-fade | C Hybrid: B + live tweaks (exposure, emissive mask, sun-patch mask) | D AI relight of one render |
|---|---|---|---|---|
| Photorealism | 2–3 on phones (baked GI ok, dynamic sun weak) | **5** (Cycles) | **5** | 4 (looks good, drifts) |
| Plan fidelity | 5 | **5** (same scene, same camera) | 5 | **2** (objects change — seen in the reference) |
| Browser/mobile perf | 2–3 (heavy scene, GPU) | **5** (two textures, one shader) | 4 | 5 |
| Transition smoothness | 5 (truly continuous sun) | 3 (double shadow mid-fade) | **4** (more keyframes or masked sun) | 3 |
| Complexity | high | **low** | medium | low |
| Cost per room | build time high, runtime $0 | **4 Cycles renders, $0 cash**, CPU/GPU minutes | +a few renders | $0.04–0.10 per variant (fal, `03`) + QA |
| Scalability | per-apartment real-time asset work | **fully scripted** from our pipeline | scripted | scripted but needs a human or gate per image |
| Fits Habait rules (add-only, fidelity, disclosure) | yes | **yes** | yes | only as an AI-badged extra with a diff gate |

## Recommendation
**B now, C next, D never as the base.**
1. **B** — for each viewpoint render N lighting keyframes from the *same* .blend, camera, seed and resolution: morning, noon, sunset, blue-hour/night. Same geometry by construction, so no drift; the cross-fade is exactly what the reference does.
2. **C** — fix the double-shadow at mid-fade without real-time 3D: add more keyframes on the sun's path (every 1–2 h; renders are cheap at pano resolution) and/or render a separate **"lights only" pass** (interior emitters, sun off) so the viewer can fade the lamps independently of the daylight (a second slider or automatic by clock). Exposure is a uniform in the shader.
3. **D** — only as an optional shortcut for an already-approved render, under an AI badge, behind a pixel-diff gate against the base render (the reference shows why: jars changed). Eliran's call (cost, disclosure).
Real-time 3D (A) is rejected for this feature: on a phone it cannot reach the reference look, and the reference itself does not use it.

## UI notes for our version
- Slider + clock + tick buttons that animate to the hour (reference behaviour); a ▶ "play the day" button; works by touch (≥ 32 px targets), keyboard and mouse.
- Preload every keyframe of the current node before showing it (the reference never stalls mid-fade).
- Keep the hour when changing room (the reference keeps it: OBSERVED at 15–22 s, the balcony stays at 14:28).
- Hebrew first, numbers isolated LTR.
