# Sandbox worker: run the portal's build jobs in Vercel Sandbox, not on the laptop
<!-- filed: 2026-11-04 · session rnd-9d · state: BUILT + PROVEN for the trace stage AND the build stage's mechanics (2026-11-05, fork E; §6): the dispatcher runs on a PREVIEW deploy and boots a sandbox per job; nothing is in production (Eliran's own deploy go) · code + evidence: worktree .wt/sandbox-worker (branch sandbox-worker) -->

## The ask
Eliran, 2026-11-04: "שרת העבודה ירוץ ב-VERCEL", "אני רוצה את זה מוכן"; 2026-11-05: "אתה יכול להמשיך עם הכל". The portal at `habait-flow.vercel.app/studio/` queues build jobs (job.v1 contract: `Habait/studio-web/CLAUDE.md`). Until 2026-11-05 the executor `run-job.mjs` + `run-project.mjs` (branch `project-runner`) ran only on the laptop, by hand — Eliran's own project (`pmw25zqqf4bb478`) sat in the queue until a human ran it.

## 0. As built (2026-11-05, fork E) — what exists and what is proven
| Piece | File (worktree `.wt/sandbox-worker`) | State |
|---|---|---|
| Dispatcher | `Habait/studio-web/api/_dispatch.mjs` — `dispatch(job, path, {stage, store, Sandbox?})`, `needsDispatch`, `stageOf`, `stopFinished`, `sandboxEnv`, `jobCommand`, `STAGES` | **built, proven on a preview deploy** |
| Trigger | `Habait/studio-web/api/studio-projects.mjs` — after `enqueue` in POST build (stage `trace`), POST approveTrace (stage `build`) and POST traceCorrection (stage `trace`); GET `?id` re-dispatches a `queued` job whose sandbox never started or is over, and stops a finished job's idle VM | built; **build trigger proven**, approve/correction triggers coded, not run |
| Executor in the VM | `Habait/tour360/tools/run-job.mjs` — the watchdog (`HABAIT_JOB_DEADLINE_MS`: 3 min before the session cap the job goes back to `queued`, attempt+1, pointer re-added, exit 75) and the sandbox record closed on the job (`sandbox.ended`, `minutes`) | built; watchdog not exercised (no job ran long enough) |
| Snapshot + CLI | `Habait/tour360/tools/sandbox-worker/worker.mjs` — `build-snapshot [--go] [--with-blender]`, `dispatch`, `status`, `vm-log`, `stop`, `test-job` | built; snapshot proven 3× (31–37 s each) |
| Snapshot id | Blob `studio/worker/snapshot.json` (`snap_DXWv2R1bYGj8Q9ItGqBhsfg3UkQc`, key `e3df3be+…+py5`, 147 files / 5.4 MB, no Blender) | live in the store |
| Deploy stage | `scratchpad/deploy-E-1` (stage_flow.py `--edit-api --studio --studio-src <worktree>`; `functions["api/studio-projects.mjs"].maxDuration = 60` added to `stage_flow.py`); preview `habait-flow-omt28skwt-eliran-5390.vercel.app` | **preview deployed**, production NOT |
| Evidence | `Habait/tour360/tools/sandbox-worker/evidence/2026-11-05-snapshot/` — `snapshot.json`, `test-job*-status.json`, `test-job*-vmlog*.txt`, `preview-trigger-response.json`, `preview-trigger-job-card.png`, `preview-trigger-e2e.log`, `preview-job-status.json`, the two proof scripts | on disk, committed |

**The proof (root §3, hand-proved before any wrapping):**
1. `worker.mjs build-snapshot --go` under `vercel env run`: a 2-vCPU sandbox installs the python venv (numpy, opencv-headless, pymupdf, shapely, scikit-image), `@vercel/blob` (run-job's store), `appdeps` (sharp + playwright-core — `app-require.mjs` resolves `$HABAIT_APP_DIR` by the presence of playwright-core), uploads 147 code files (`tour360/{tools,server,viewer,catalog,copy}`, `engine/intake`, `360walkaround/pipeline`, the catalog JSONs), smoke-loads auto-trace's module graph and the python trace modules, snapshots. 31–37 s.
2. Three laptop-dispatched test jobs (`forke-test` prefix, the 846 PDF, the apt846-auto spec) found three runtime gaps, each fixed in the snapshot: sharp/appdeps (job 1), `engine/intake/rasterize.py` (job 2), and `FAL_KEY` — the laptop's `vercel env run` pulls the *development* env, which has no FAL_KEY (job 3: the VM rasterised page 1 and stopped at the first vision call). The CLI now documents `-e preview`.
3. **The real trigger:** `studio-e2e-build.cjs` signs up a Clerk test user on prod, creates a project, uploads the 846 PDF, runs the reading, approves, then POSTs `{build:true, consent:true}` with the page's own session token to the **preview's** `/api/studio-projects` (deployment protection passed with `x-vercel-trusted-oidc-idp-token` under `vercel env run`; `vercel curl` replaced the Authorization header and the app answered `login`). Result: HTTP 200, `job jmw3feujnf27718` queued **and** `הבנייה הופעלה בשרת (שרטוט ובדיקה, ניסיון 1)`; 5 s later the prod page's job card read `הורדו 1 קבצים והקריאה המאושרת` — the VM had claimed the job and downloaded its inputs. The trace stage's outcome is in `preview-job-status.json`.
4. `sudo poweroff` inside the VM does **not** end the session (probe `sbx-poweroff-probe.mjs`): a finished job's VM would idle to its cap and count against Hobby's 10 concurrent sandboxes. Hence `stopFinished` on the next page load and before any re-dispatch, and `worker.mjs stop`.

**Spend of the proof (ledger `development/tasks/studio-agent-fal/logs/spend-ledger.txt`, rows 12:20–13:08):** four portal readings ≈ $0.20, the preview job's auto-trace (≤ $1 cap, ≈ $0.10–0.15 expected), sandbox minutes inside Hobby's included hours (estimates ledgered as upper bounds at Pro rates). Eliran's go: «יש לך אישור חופשי לתקציב» (cap $10, report at $7).

**Not proven / out of scope here:** the build stage in a sandbox (Blender + assets; `build-snapshot --with-blender` is coded on the spike's recipe, not run — the spike proved the render itself); the approve and correction triggers (same code path as build); the watchdog at the cap; `/p/<id>` publishing (fork F's publish route in `studio-web/api` — the worker calls run-job for every stage and never publishes itself).

## 1. What the spike proved (2026-11-04; evidence, not a summary)
Evidence: `.wt/sandbox-worker/Projects/Habait/habait-walkaround/Habait/tour360/tools/sandbox-worker/evidence/2026-11-04-c1/spike-report.json`, `spike.log` and `files/`. Ledger: `360walkaround/pipeline/RENDER-LEDGER.md` §2, row C1.

**Yes: Blender 4.5.10 LTS renders the real pipeline in Vercel Sandbox.** `render_tour.mjs` (build_scene.py + render_pano.py) on apt846 `cp-kitchen` at the draft setting (1024x512 @ 16 spp): PASS (nadir 0 cm, depth 3/3 within 2 cm, scene 192/0 checks, 38 catalog pieces); Cycles on CPU (no GPU). 4 vCPU / 8 GB: apt 10.5 s, Blender download 12.1 s (OCF mirror; download.blender.org answers 403), extract 16 s, venv 17 s, upload of 294 MB of assets 144 s, scene build 11.1 s, **render 87.5 s**, session 307 s. Blender max RSS 1.84 GB; VM peak 2.05 of 8.4 GB. The team refused 8 vCPU (`resources.vcpus should be <= 4`) → Hobby: 45-minute sessions, cron once a day. Spike cost $0.031 at Pro rates, $0 inside Hobby's quota. Pricing (read 2026-11-04): Pro $0.128 per active vCPU-hour + $0.0212 per GB-hour; Hobby includes 5 active-CPU hours and 420 GB-hours a month, then creation pauses.

## 2. Cost and time per 11-room apartment (from the measurements)
| Setting | Render (4 vCPU) | At Pro rates | On Hobby |
|---|---|---|---|
| draft 1024x512 @ 16 spp (`--draft`, the build stage's setting) | 11 × ~88 s + 11 s ≈ 16.5 min (the laptop GPU: 713 s) | ≈ $0.20 per apartment | free; ≈ 4 apartments a month before the quota pauses creation |
| production 2048x1024 @ 32 spp (extrapolated ×8, not measured) | ≈ 2.1 h on 4 vCPU | ≈ $1.50 per apartment | does not fit a 45-min session: chunked resumable sessions or Pro |

Plus the fal legs that already run today (auto-trace ≤ $1 cap, markers ≈ $0.02): I/O waits, little active CPU.

## 3. The design, as built
```
portal POST build / approveTrace / traceCorrection   (api/studio-projects.mjs)
   writes job.json + studio/queue/<jobId>.json (as before), then in the SAME request:
   _dispatch.dispatch(job, jobPath, { stage })
     1. reads studio/worker/snapshot.json (the id of the worker snapshot — a release writes a new one, no env change)
     2. stops the previous attempt's sandbox if it is still up
     3. Sandbox.create({ name: `job-<id>-<attempt>` (unique, immutable = the atomic claim per attempt), source: snapshot,
                         resources: { vcpus }, timeout: stage cap, persistent: false, env: sandboxEnv(), tags })
        STAGES: trace = 30 min / 2 vCPU · build = 40 min / 4 vCPU, --draft (inside Hobby's 45)
     4. runCommand(detached): run-job.mjs --sweep-only --stale-min 50 ; run-job.mjs --once --job <id> [--draft]  (log: /vercel/sandbox/job.log)
     5. writes job.sandbox { name, stage, vcpus, timeoutMin, started, snapshot, estUsd } + dispatches, log «הבנייה הופעלה בשרת», returns
   a dispatch failure (no snapshot, quota paused, SDK error) → log «השרת לא הופעל … ממתינה בתור»; the job stays queued
portal GET ?id (every page load of the project)
   needsDispatch(job): queued + (no sandbox | sandbox session over) → dispatch(stageOf(job))      ← the retry, no cron
   else a finished job with an unstopped sandbox → stopFinished (Sandbox.get(name).stop())       ← no idle VMs
inside the VM (run-job.mjs, unchanged contract): claim → download → trace (auto-trace + trace-check + judge) → waiting/review,
   or build (apartment … package → store) → done; heartbeat every 60 s; the watchdog at cap−3 min → queued, attempt+1, exit 75;
   the sandbox record closed on the job (ended, minutes)
```
- **Trigger choice:** Hobby cron runs once a day, so the portal's own request is the trigger and the developer's page load is the retry. A Vercel Queue topic remains the durable upgrade (retries, at-least-once) once Queues is confirmed on this plan.
- **Secrets by name:** `sandboxEnv()` copies `BLOB_READ_WRITE_TOKEN`, `FAL_KEY` (and `OPENROUTER_API_KEY` if set) from the function's env into the VM's env — never a file, never printed. `file-ledger.mjs loadEnv()` reads `process.env` first; the VM has no `.env`. The SDK authenticates with the deployment's OIDC token (automatic on Vercel). **Phase 2 hardening (not built):** inject the fal `Authorization` at the sandbox firewall (`networkPolicy.allow[].transform`) so FAL_KEY never enters the VM, and allow-list egress (fal, Blob) — developer PDFs are untrusted input.
- **Runner paths in the VM** (`sandboxEnv`): `HABAIT_PY=/vercel/sandbox/venv/bin/python`, `HABAIT_BLOB_DIR=/vercel/sandbox/blobdeps`, `HABAIT_APP_DIR=/vercel/sandbox/appdeps`, `HABAIT_ENV_ROOT=/vercel/sandbox/hw`, `BLENDER=/vercel/sandbox/blender/blender`, `HABAIT_BLENDER_LOCK=/tmp/blender.lock`. Every Windows default in run-job / run-project / auto-trace / render_tour is env-overridable (checked 2026-11-05).
- **The snapshot** (`worker.mjs build-snapshot`): key = git HEAD + file-list hash + python deps (+ Blender version); the id in Blob `studio/worker/snapshot.json`; `--with-blender` adds the apt libs, Blender 4.5.10 (sha256-verified, mirror list) and the 294 MB of render assets on the spike's recipe. A code or style release = a new snapshot (one command, ~35 s without Blender).
- **Time limits:** trace 30 min, build 40 min (draft). A production-setting render does not fit Hobby's 45 min: the watchdog + `queued` + the renders' skip-if-clean make a resumed attempt continue; after Pro the caps can rise.
- **On timeout:** run-job's watchdog (above). A `running` job with no heartbeat for 50 min (a killed VM) is swept by the next sandbox's `--sweep-only --stale-min 50`: first time back to `queued`, second time `failed`. A gate refusal stays `review`.

## 4. Owed before this ships to production
1. **Eliran's deploy go** for the stage `deploy-E-1` (content: live main + the worktree's studio-web: `_dispatch.mjs`, `studio-projects.mjs`, `package.json` with `@vercel/sandbox`) — and Hobby vs Pro remains his cost call (§1–2).
2. **The build stage in a sandbox:** `build-snapshot --with-blender --go` (≈ 4 min, 300 MB upload), then one approved trace through `approveTrace` on the preview; expect ≈ 21 min at the draft setting. Needs a PASS trace first (fork B's auto-trace; 846 passed round-check on the laptop runs, the real Maale Efraim job is in review).
3. **Merge order:** `project-runner` (fork F: skin + gate, finishes, rings, film, the `/p/<id>` publish route) is merged into this branch at the end of fork E; re-merge before main so the worker calls the latest run-job for every stage.
4. **The QA cards (root §8.9):** a real portal job end-to-end in a sandbox on the deployed site, after the deploy go.
5. **Optional env:** `HABAIT_WORKER_VCPUS` is not read yet (STAGES is a constant); `CRON_SECRET` only if a sweep cron is ever added (none today).

## 5. Blob operations: the store was suspended on 2026-11-05, and what a portal job costs in operations (fork E)
**What happened.** At 11:40:40Z the private store `habait-studio` went `limits-exceeded-suspended` (Vercel API `/v1/storage/stores`: billingState `suspended`, usageQuotaExceeded `true`) at 246 MB / 612 objects — the Hobby **operations** quota, not storage. `list()` and `put()` (and `del`) are *advanced* operations; a read with `useCache:false` is a *simple* one. Hobby's monthly Blob allowance, as Vercel publishes it (confirm in the dashboard's Usage tab): **1 GB storage, 10,000 simple and 2,000 advanced operations, 10 GB transfer**; a store over it is suspended until the month resets. Pro (as published): 5 GB, 100,000 simple and 10,000 advanced included, then usage-priced (on the order of $0.40 per million simple and $5 per million advanced operations) — check the current price page before deciding.

**The biggest consumers before the fix (code as it was):**
| Path | Operations | Rate |
|---|---|---|
| the project page's poll while a job is active (`studio.js`, every 5 s → `GET ?id` → `files()` = a `list()` + 5 reads) | 1 advanced + 5 simple a tick | **12 advanced a minute per open tab** — one tab open for 3 hours during a trace/review ≈ 2,160 advanced, the whole Hobby month |
| `run-job --watch` (laptop) | a `list()` of the queue every 30 s + the sweep's `list()` of `studio/u/` every pass | ≈ 240 advanced an hour, idle or not |
| `run-job --show/--requeue`, `worker.mjs status` (each poll) | a `list()` of `studio/u/` + a read of **every** job.json | 1+ advanced + N simple per call |
| run-job's heartbeat | one `put` of job.json a minute | 40 advanced per 40-min build |

**After the fix (branch `sandbox-worker`, commit `e8c9c38`):** project list and project files from index documents (`projects.json`, `files.json`, rebuilt once per upload batch), job addresses `studio/jobs/<id>.json` (a job by id = 1 read), the page polls **only job.json** with a 10/20/60-s backoff (5 min in `review`) and never while the tab is hidden, run-job's heartbeat every 5 min, `--job` reads its queue pointer by path, the sweep at most every 30 min, `--watch` every 120 s; every job carries `blob_ops` and every portal response an `x-blob-ops` header, so the next estimate is a measurement.

**Estimate per portal project, from the code paths (advanced operations; simple in brackets):**
| Step | Advanced | Note |
|---|---|---|
| create the project | 2 [1] | meta + the projects index |
| upload one sales-plan PDF | 3–5 [1] | the file, the page overview(s), the pages index, the files index (one `list()` + one `put`) |
| upload a 16-page brochure | ≈ 20 + tiles [≈ 20] | 16 overviews + index; tiles (≤ 20 a page) only for the pages the reading asks for — **the largest upload cost** |
| the agent's reading | ≈ 6 [≈ 10–40] | survey, meta ×2, spec, debug text, the paid-call ledger (open + close); the page images read as simple ops |
| one chat message | ≈ 3 [≈ 5] | chat + the ledger |
| approve the reading | 1 [2] | |
| build (trace stage) | ≈ 25 [≈ 15] | enqueue + job address + dispatch (5), the executor: sweep `list`, claim, stage saves, the trace outputs (≈ 6–10 per floor), 1–2 heartbeats |
| trace approval → build stage | ≈ 4 + **≈ 150** [≈ 20] | the build's saves (≈ 13 steps), heartbeats (≈ 8 for 40 min), the qa screenshots (≈ 10), and **the package: 119 files = 119 `put`s** (apt846-auto's package) + the publish pointer |
| the developer watching it run | 0 [≈ 100–200] | the job-only poll over ~50 minutes |
| **one project end to end** | **≈ 200–250** | **Hobby's 2,000 a month = about 8–10 projects**, with nothing else running |
| a buyer's view of a published tour (`/p/<id>/tour/`, fork F's `studio-pub.mjs`) | 0 [≈ 20–40] | every file read with `useCache:false` = a simple op per file per view; **Hobby's 10,000 = ≈ 300 tour views a month** |

**What Pro buys, in these units:** 10,000 advanced ≈ 40–50 projects a month included, and past that ≈ $0.001 per project; 100,000 simple ≈ 3,000 tour views included, then fractions of a cent. **Levers that do not need Pro** (owed, not built here): (1) the publish route reads package files with the cache on and returns long-lived `Cache-Control` for the content-addressed package (repeat views served by the CDN, no operation) — fork F's file; (2) the package published as a few bundles instead of 119 objects (≈ 120 → ≈ 10 advanced per build); (3) the PDF tiles made on demand server-side only for pages the reading uses (already partly so).

## 6. The build stage in Vercel Sandbox — proved 2026-11-05 (fork E), without fal and without the Blob store
Evidence: `.wt/sandbox-worker/…/tools/sandbox-worker/evidence/2026-11-05-build/` (its context file lists every file). Test project `pbuild846` = the hand plan of apt846-auto (fork F's proof apartment); sandbox `proof-build-mw3k9cmc`, 4 vCPU / 8 GB, persistent, from the Blender snapshot `snap_3zqDV281SaPj37nQ9vXndwNOQjuj` (apt libs, Blender 4.5.10, python venv, appdeps, 355 files / 304 MB incl. the render assets from the live tree; built in ≈ 5 min, upload 225 s); deleted after.

**Proven:**
- **Chunking across Hobby's 45-min sessions, state carried on the persistent disk.** Session 1 was capped at 20 min on purpose and stopped mid-render; session 2 resumed the same sandbox, skipped the finished phases (`.done` markers), render_tour skipped the 5 clean points of the rest, re-rendered the interrupted one and finished. The job state in the STORE is the dispatcher's design (§3: watchdog → `queued`, the same named sandbox resumed); with the store suspended this proof kept it on the disk.
- **Blender CG at 2048x1024 @ 16 spp in the cloud:** 3 points in 761.7 s wall = **≈ 250 s and ≈ 990 CPU-s per point** (391 % of 4 vCPU), Blender max RSS 3.98 GB, VM peak 4.2 of 8.4 GB. At 1024x512 @ 16: **≈ 75 s per point**. The renders are the real pipeline's (`proof/renders/`).
- **The CG-vs-plan gate at $0:** `fidelity-gate.mjs --cg-only` (new on branch `sandbox-worker`: Blender's metric depth vs the plan's ray-cast + the trace vs the printed dimensions; no depth-model call) ran in 7 s. Its verdict is the REAL one: **FAIL on 8 of 11 rooms at the 1 % bar** (entrance 57.6 %, kitchen 29.7 %, dining 15.2 %, terraces 12.9 / 5.7 %, living 1.9 %, wardrobe 1.8 %, bedroom 2 1.3 %; main bedroom and both baths PASS) — identical to the laptop renders of the same plan, so it is the plan or the gate's occluder rules, not the cloud. `build-tour` then correctly refused to package. For fork A/F.
- **build / package / qa run on Linux** (DIAGNOSTIC, VM-local raised bar, never shipped): build 2 s, package 8 s (101 files, 7.2 MB), qa 23 s. The responsive gate PASSED the landing page at 1440 and 390 and FAILED the tour on the room-card strip («a control cut by the edge»: cards half outside a horizontal scroller) — a gate rule or template matter for fork F.
- **What the snapshot lacked, fixed in code (rebuild owed):** Chromium (Playwright 1.56 refuses Ubuntu 26.04; its 24.04 build runs there with `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE`, 42 s), `platform/css/tokens.css` (dropped by a too-broad secret-name rule), the legal caption (`build_zip.mjs`'s Windows path → `HABAIT_LEGAL_DIR`), the platform's `three` package.
- **Not run:** the skin (fal locked: "skipped: fal locked"), the markers (fal), the job state in the store for a build (store suspended), publishing.

**Time and cost per 11-room apartment (measured per point, extrapolated to 11):**
| Render setting | Render wall (4 vCPU) | Hobby sessions | Active CPU | Pro rates (CPU + 8 GB memory) | On Hobby (5 active CPU-h a month included) |
|---|---|---|---|---|---|
| 1024x512 @ 16 (draft) | ≈ 14 min | 1 | ≈ 0.9 vCPU-h | ≈ $0.16 | ≈ 5 apartments a month |
| **2048x1024 @ 16** (the laptop proof's setting) | **≈ 46 min** | **2** | **≈ 3.0 vCPU-h** | **≈ $0.52** | **≈ 1 apartment a month** |
| 2048x1024 @ 32 (run-project's default) | ≈ 92 min (×2, extrapolated) | 3 | ≈ 6 vCPU-h | ≈ $1.0 | does not fit the month |

Plus, every job: ≈ 1 min for prep + scenes/sets + gate + build + package + qa, ≈ 10 s per session boot; on Pro, 8 vCPU roughly halves the wall time at the same cost. fal (skin, markers) and Blob operations (§5) come on top.

**Owed:** rebuild the Blender snapshot with the fixes above and write its pointer once the store is back (`worker.mjs build-snapshot --with-blender --go`; `refresh-snapshot` for later code releases); the gate's FAIL rooms (fork A/F); the tour strip vs the responsive gate (fork F); then one real portal build end to end on a preview, after Eliran's Pro-or-wait decision on the store.

