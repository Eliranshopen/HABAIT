## 2026-11-10 · sub-agent (coordinator's delegation) · apartment journey round 4: one flight into the 360 tour
- **Did:** Eliran (after the test link) loves everything up to choosing the apartment, then wants ONE flight with no scrolling: «משלב לחיצה על "המשיכו אל הדירה" יש את הריחוף עם האנימציה של הקומות ואז זה ממשיך לסיור 360».
  - **The sequence:** from 846's «כניסה לדירה» / «המשיכו אל הדירה», the journey plays in a frame over /hold/, starting on the hold's own frame box (`?fr=`).
    - Floors: the counter to «16», floor 16 glowing, «דירה 846» + 3 · 106.72 · 26.15.
    - Glide: the isolated floor, then one push toward the terrace.
    - Landing: the living room, drawn as the tour opens it, a canvas reprojection of `panos-parquet/04-living.webp` with the tour's own maths (yaw −40, pitch −2, `fitHfov`).
    - Hand-off: the hold cross-fades to its own `#tourFrame` (room=living), so the walkthrough music keeps the AudioContext of the visitor's tap.
  - **Controls:** «דלג לסיור» skips; reduced motion goes to the tour at once; back = the tour's return to the hold at the stop.
  - **Archived:** the round-3 scroll page + its media moved to `Habait/platform/tools/_unused/apartment-journey-r3/` (nothing deleted, never deployed).
  - $0. Branch `journey-r4` `6e8dc2d`, merged into main **`a8f0ddd`**. **NOT deployed** (the coordinator publishes to the test link).
- **Evidence:** `Projects/Habait/habait-walkaround/qa-evidence/platform/apartment-journey-r4-2026-11-10/`. On a fresh stage of main `a8f0ddd`:
  - predeploy PASS 34/34;
  - new `test/apartment-journey.check.mjs` PASS at 375/390/430/1440 (tap → tour 9.02–9.08 s, skip ≈ 1.5–1.6 s, reduced motion ≈ 1.0 s with no journey);
  - hold-phone, hold-chrome and rainbow-flow PASS;
  - `sequence-*.jpg` (on disk only).

  Plan §9.
- **Learned:**
  - The tour opens a deep-linked room at `?yaw=`, pitch −2, hfov = `fitHfov()` (85° vertical, clamped 60–118° horizontal), from `panos-parquet` when `floor=parquet`. A page can draw that exact first view itself and cross-fade into the tour with no cut.
  - Keeping the tour frame in the hold (not in the journey) is what preserves the iOS sound unlock across an animation with no tap of its own.
- **Owed / open:**
  - a real-iPhone check (music after the flight, the blur);
  - the deploy to habait-flow is Eliran's go;
  - worktree `.wt/journey-r4` removal is Eliran's act;
  - `/sync-context`.
- **Second reader:** `habait-deploy-qa`. In this main, /hold/'s 846 action plays the journey over the hold and then shows the tour at room=living. `test/apartment-journey.check.mjs` is the gate for it, beside hold-phone, hold-chrome and rainbow-flow.
