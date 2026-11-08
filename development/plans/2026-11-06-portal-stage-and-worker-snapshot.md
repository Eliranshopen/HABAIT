# Portal stage with the runner's code, and the worker snapshot rebuild
<!-- 2026-11-06 · fork F of the main session · for the coordinator, who asks Eliran for the deploy go -->

**Ask (the coordinator, 2026-11-06).** Prepare, without deploying, a habait-flow portal stage that carries the project runner's code, plus a plan for the Vercel Sandbox worker snapshot: what has to be rebuilt and what it costs in sandbox time. The coordinator asks Eliran for the deploy go.

## 1. The stage, built and gated
- **Branch `portal-stage`** (worktree `.wt/portal-stage`), started from `studio-supabase` (the portal with the Supabase store). It merges:
  - `project-runner` (commit f18afe5): auto-trace T1–T17, the runner steps and parity rows 1–29, R25–R32 taken from fork A.
  - `sandbox-worker` (commit 4920324): fork E's dispatcher and `worker.mjs`.
  - Conflicts resolved: `fidelity-gate` keeps the runner's wrap-edge depth maps and adds a guard for fork E's `--cg-only` mode (no picture depth). `run-job` keeps the portal's Supabase store (`openShared`, `findJobPath`) and also records `store_ops`. Parity: 29 rows PASS.
- **Stage `C:\RnD\.wt\deploy-P-2`** = `stage_flow.py --studio --studio-src <portal-stage>/Habait/studio-web --gate-root <portal-stage>`, plus the portal-stage overlay. The overlay brings in the runner's platform CSS and JS diffs and the tour's `tour.css`, because stage_flow stages the platform and tour from live main.
  - **Predeploy gate: PASS 32/32 page × size** (390 + 1440). Evidence: `C:\RnD\.wt\deploy-P-2.predeploy`.
  - Functions: `/api/studio-*` plus `_dispatch.mjs` and `_store.mjs`; `package.json` pins `@clerk/backend` 3.26.1, `@vercel/blob` 2.8.2, `@vercel/sandbox` 3.8.0.
  - Also on disk: `C:\RnD\.wt\deploy-P-1`, the raw stage_flow output without the overlay. It FAILS the gate (27/32, tour language and tool buttons under 44 px). It is the input of P-2 and is not for deploy. Deleting it is Eliran's act.
- **Env names the deploy needs** (names only, values in the console): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEY`), the Clerk keys, `FAL_KEY`, `OPENROUTER_API_KEY` (for the judges). `BLOB_READ_WRITE_TOKEN` is only needed if `STORE=blob`. The sandbox SDK uses the function's OIDC.

## 2. The worker snapshot: what has to be rebuilt
The portal starts one Vercel Sandbox per job stage from the snapshot named at `studio/worker/snapshot.json` **in the store**. With the Supabase store that pointer does not exist yet: fork E's pointer was written to the Blob store, which is suspended. So:

1. **Full rebuild, once:** `vercel env run -e preview -- node worker.mjs build-snapshot --with-blender --vcpus 2 --go`, run from portal-stage. It installs:
   - the python venv (numpy, opencv, pymupdf, shapely, scikit-image);
   - appdeps (sharp + playwright-core) and `@vercel/blob`;
   - the tour360 + pipeline code at this checkout: the runner, auto-trace, casework_symbols, image-models, hotspot tools, floor_composite;
   - Blender 4.5.10 and the render assets;
   - Chromium for the qa step (Playwright's Ubuntu 24.04 build with the platform override, fork E's b558741).
   It then snapshots the VM and writes the id to the store's `studio/worker/snapshot.json`, which with `STORE=supabase` goes to Supabase.
   - Prerequisite: `npm i` in `tools/sandbox-worker/` (the `@vercel/sandbox` SDK). That is an install, so it is Eliran's act, or done by the session on his word.
2. **Each code release after that:** `worker.mjs refresh-snapshot --go` boots from the current snapshot, re-uploads the code and takes a new snapshot. No venv or Blender reinstall.

## 3. Sandbox time and cost
Prices are Pro rates, the upper bound ($0.128 per vCPU-hour + $0.0212 per GB-hour at 2 GB per vCPU, `_dispatch.mjs` PRICE). Hobby's included hours bill $0.

| Item | vCPU × time | Upper bound | Source |
|---|---|---|---|
| Full snapshot build (with Blender) | 2 × ≈ 10 min (session cap 40) | ≈ $0.06 (cap $0.23) | fork E: code-only snapshot 31–37 s; Blender download + unpack is most of it |
| Snapshot refresh (code release) | 2 × ≈ 2 min | ≈ $0.01 | boot + upload of the code files + snapshot |
| Trace stage per job | 2 × ≈ 3 min | ≈ $0.02 | auto-trace on 846 took 117–190 s on the laptop |
| Build stage per apartment (11 rooms) | 4 × ≈ 46 min, in 2 Hobby sessions | ≈ $0.52 | fork E's proof 2026-11-05: 2048 @ 16 spp ≈ 250 s per point on 4 vCPU, ≈ 3 CPU-hours |
| Snapshot storage | — | Vercel's snapshot storage rate | one live snapshot; old ones deleted on refresh |

On Hobby, the 5 included CPU-hours a month cover about one full apartment build. Pro or Hobby is Eliran's call (fork E's open item).

fal is separate from sandbox time. For one apartment: the skin regenerations and repairs (gpt25-high, $0.60 each) plus the finishes (nano-banana-2, $0.08 each) plus the judges. On apt846-auto, step (1) cost $18.97, a ceiling case with many repairs.

## 4. What the deploy go covers, and the QA after it
- Eliran's go for a **preview** deploy of `deploy-P-2`. Then:
  - the snapshot build (§2.1);
  - one test job end to end on the preview: the trace stage, then waiting/review, with no hand step;
  - the deployed-site QA at 390 + 1440.
- The production promote is a separate go (root §9).
- Not covered: a paid skin run on a new project. The coordinator asks Eliran first.

## 5. Risks
- The Blob store is still suspended, so the stage must run with `STORE=supabase` (the default when the Supabase names are set).
- A fresh vision reading can vary. auto-trace on main 19cae62 passes 846 on all three readings (85/85 each, through the runner's trace step at $0). Other drawings may still queue for review (exit 5), and that is the designed path.
- The tour `/tour/` comes from live main plus the overlay. Main lacks the runner's tour.css until project-runner merges into main. After that merge, `deploy-P` needs no overlay.

## 6. Render setting of the cloud build and its cost (added 2026-11-08, the coordinator's ruling)
- The cloud build renders at **2048×1024 @ 16 spp** (parity row 40, `studio-web/api/_dispatch.mjs` STAGES.build.render). It used to be the 1024×512 draft.
  - Why: the auto-traced 846 failed its entrance at 1.88 % at 1024 and passes at 0.96 % at 2048. A local re-render at 1024 reproduced the cloud's number exactly. Proof: `memory/runs/2026-11-05-project-runner-fork-f.md`, entry 2026-11-08 later.
- Cost: **one 2048 build ≈ 40–45 min of rendering on 4 vCPU ≈ 3 CPU-h ≈ most of Hobby's monthly 5 CPU-h**. On Hobby that is about one cloud build a month. More builds need Pro (Eliran's cost call).
- The render resumes per point (render_tour's manifest skip), so a build chunks across the persistent sandbox's 44-min sessions.
- The 2048 setting is proven locally (10/10, packaged). It was not re-run in the cloud, to save the month's Hobby CPU-hours (the coordinator, 2026-11-08).
