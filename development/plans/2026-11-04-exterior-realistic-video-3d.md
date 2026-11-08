# Plan — the "הדמיית הבניין והסביבה" button: realistic video, then a free 3D view
<!-- filed: 2026-11-04 · main session rnd-23 · state: APPROVED 2026-11-04 (Eliran delegated the three answers: A yes ≤ $10 · B spike yes ≤ $15 · stills chain out) — board `development/tasks/exterior-film/` -->

## The ask (Eliran, 2026-11-04)
- "כל התוכן שקיים בלחיצה על כפתור הדמיית הבניין והסביבה לא רלוונטי כתמונות. בסוף אני רוצה את זה כהדמייה ריאליסטית ברזולוציה טובה ולא כרצף תמונות שאני יכול לזוז."
- His answer to "what instead": **"Video + free 3D"**: first a video that plays by itself, then a button to move freely in 3D.
- Standing ruling (2026-11-02 ~18:30): "ריאליזם מההתחלה עד הסוף". Because of it, no real-time 3D of the tower is in the buyer flow today. The free 3D is allowed only if it looks real.

## What exists (measured)
- The button (board `hold-building-tour`, rnd-1f, deployed 2026-11-04 dpl_3avVrzv8…). It opens the tour's exterior chain: aerial → orbit1…5 → tower → descent → facade, as **360° stills**. This is what Eliran rejects.
- The realistic clips: `_local/segments/rainbow-cine/` (orbit 17 s, descent, enter).
  - They come from one Kling 4.0 v2v call over the Blender clay flight. The tower stays stable ($3.20 / 17 s, `research/fal-bench-2026-11-02/README.md`).
  - **1280×720**: "good resolution" means at least 1080p.
- The 3D scene: `flyover3d/data/site.glb` (50 MB) and `site_baked.glb` (44 MB).
  - Geometry only, not photoreal: this is why it was taken out of the buyer flow on 2026-11-02.
  - The Blender clay scene and camera paths exist (habait-16).
- Research 2026-11-02 (`research/product-research-2026-11-02/SUMMARY-he.md`):
  - Google Photorealistic 3D Tiles: **Israel not approved**, so the real surroundings cannot come from Google.
  - Realistic free 3D in 2026 = **Gaussian splat**: posed RGB-D views → splat. Marble `posedImages2Splats` costs ≈ $5 for 8–16 views; open alternatives are AnySplat / own training on free Kaggle GPU.
  - Browser viewing: Spark 2.0 (MIT), 0.5–2.5 M splats on phones.
  - The market ships video + hotspots, not real-time 3D.

## Phase A — the video (first, low risk)
1. **Resolution:**
   - A1: upscale the existing approved clips (orbit + descent) to 1080p, or 4K for desktop, with a fal video upscaler. The look Eliran already saw stays the same.
   - A2, only if A1 looks soft: re-run Kling 4.0 v2v at 1080p on the same clay flight.
   - Dry-run first, then one paid call per clip, ledgered.
2. **Length and route:** one continuous exterior film: approach → around the tower → the surroundings (sea, street) → the facade.
   - Built only from clips that exist or are re-rendered on the same Blender camera path.
   - No invented buildings: §6 add-only, and every frame keeps the disclosure badge.
3. **In the button:** the overlay plays the film full-screen (muted autoplay, play/pause, "דלג").
   - Two hotspots: the apartments (back to the picker) and "לתלת-ממד" (Phase B, hidden until it exists).
   - The 360 stills chain leaves the button.
   - Through rnd-1f's board files (`flyover3d/index.html`, `app.js`), in its working folder or a new one opened for this plan.
4. **Checks:**
   - 1080p (or better) is served, and the first frame is under 2.5 s on 4G;
   - no black frame;
   - the AI badge is present;
   - a fresh reviewer refutes, then deployed QA.

## Phase B — free 3D (after A, a spike first)
1. **Spike (≤ $15):** 12–16 posed views of the tower and the block from the Blender scene (RGB + depth, Cycles, $0 on the laptop or Kaggle).
   - Each view gets a photoreal skin with geometry locked: FLUX Depth / the Kling look as reference.
   - Then splat them (Marble posedImages2Splats ≈ $5, or AnySplat $0).
   - View in Spark in the browser; measure size, FPS on iPhone 13 / Pixel 7, and multi-view consistency.
2. **The gate is Eliran's eye:** frames and a live link of the spike. If it does not look real, it does not ship (the 2026-11-02 ruling), and the button stays video-only.
3. **If it passes:** the "לתלת-ממד" hotspot opens the splat viewer (orbit/zoom limits around the tower, the units' pills on it), lazy-loaded.

## Budget (Eliran's call, root §7)
| Step | Estimate | Cap |
|---|---|---|
| A1 upscale (orbit + descent, ~22 s) | ≈ $1–4 | soft $10 / hard $20 (per video, D-VID-2) |
| A2 re-render at 1080p (only if needed) | ≈ $4–8 | same cap |
| B spike (skins + splat) | ≈ $5–15 | soft $10 / hard $15 (render batch) |
Every call is ledgered before it runs; dry-run first; prices re-verified at step 1 (the 2026-11-02 numbers are 2 days old).

## Questions for Eliran
1. Go on Phase A, budget ≤ $10, then show the film before it goes into the button?
2. Go on the Phase B spike (≤ $15) in parallel, judged by your eye before anything ships?
3. The 360 stills chain: remove it from the button (recommended), or keep it as a third option?

## Risks
- **Upscaling cannot add real detail:** a soft source stays soft. Mitigation: A2.
- **Multi-view AI skins disagree:** the splat smears. This is the main risk of B, and the reason for the spike.
- **Vendor churn** (Marble's World API is "selective access"; World Labs → AMD). Fallback: AnySplat / own splat training.

## Done when
- A: the button plays a ≥ 1080p realistic exterior film with hotspots, deployed on Eliran's go, and deployed QA passes.
- B: Eliran says the spike looks real, and the 3D opens from the film; or he rules it out and the plan closes on A.
