## 2026-11-04 · fork D of rnd-67 · developer portal /studio — reading accuracy, Hebrew, phone, build job + automatic-check UI
- **Did:**
  - **Reading:** the browser renders PDF pages with pdf.js 6.4.299: overviews of up to 16 pages at upload, a paid survey to find the
    plan pages, then overlapping ~250-dpi tiles of those pages only. The agent reads every apartment type (`spec.units[]`).
  - **UI:** Hebrew Clerk sign-in. Phone layout: `minmax(0,1fr)` grid, and rooms shown as cards.
  - **Build job:** the job contract `habait-studio/job.v1` is written in `Habait/studio-web/CLAUDE.md`. «בנו את ההדמיה» queues the job after approval and a
    consent checkbox whose text is a DRAFT. The trace card appears only when the automatic check passed; a failed check shows
    «בבדיקה אצל Habait» (state `review`). The server refuses `approveTrace` without a passed check. Fidelity results are shown per room.
  - **Commits:** worktree `.wt/studio-portal`, `8722e24`, `ae3e047`, `deae7cd` and `a413c05`. Not merged, not deployed to production.
- **Evidence:**
  - Previews (protected): 4 `habait-flow-lmckg65p7`, 5 `pkbizeyme` (brochure), 7 `m2l0teapk` (check UI), 8 `fas5re21n` (final 846),
    9 `a9oimb011` (final code; served files hash-equal to the stage).
  - Screenshots and readings: rnd-67 scratchpad `studio-d/` (`pmw2a3keg6f663a-*` for 846, `pmw28yq6b52b7ed-*` for the brochure,
    `pmw29hqpy97b0cc-*` for the check states), `cardtest/phone-cards.png`.
- **Learned:**
  - **846 reading, before vs after tiles:**
    - entrance missing → found (10 spaces);
    - area 108.72 → 106.72, as printed;
    - 14.34 was a "partly legible" label → read as «חלקה המקורה»;
    - 474 was the terrace width → «פתח חילוץ» is named, but 270×474 is still listed as the terrace size. Partial fix.
  - **Brochure (42 MB, 16 pages):** the survey found the plans on pages 4, 6, 7, 9 and 10. It read Shor 5 rooms / 158 m², Yarkon
    6 rooms / 160 m² and Yarden 5 rooms / 165 m², 12 rooms each.
  - **Output budget:** a 3-type brochure needs more than 12k output tokens; 32k works.
  - **Clerk sign-up:** the instance's bot protection blocks headless sign-up. Test with a headed, minimized window; after the
    machine restart an off-screen window gets closed.
  - **Protected previews:** pass the `x-vercel-trusted-oidc-idp-token` header for the preview origin only, from `vc env run`.
- **Owed / open:**
  - **Production deploy of `/studio`:** Eliran's own go, after merging studio-portal.
  - **Consent wording:** Eliran's call; the version id is `draft-2026-11-04`.
  - **Fork C's `run-job.mjs`:** must skip `state:'review'`; today it falls into the claim branch. It must also write `needs.check`
    and `result.fidelity.rooms`.
  - **Brochure job still queued for the executor:** `jmw296xof74ed6e` in project `pmw28yq6b52b7ed`.
  - **Spend:** ≈ $1.50 in fal reads; the project ledgers sit in Blob.
  - **FAL_KEY:** now also in the Preview env (SECRETS-LEDGER row).
- **Second reader:** `habait-deploy-qa`, because the production deploy needs `stage_flow.py --edit-api --studio` from merged main.
