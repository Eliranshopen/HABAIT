# Habait/studio-web — the developer portal on habait-flow (/studio)
<!-- last-updated: 2026-11-04 -->
<!-- context file · written 2026-11-04 by session rnd-67 (plan development/plans/2026-11-04-developer-platform.md, P0) -->

## What's here
The hosted developer portal: a developer signs in (Clerk), opens a project, uploads the sales plan and files (private Vercel Blob
store `habait-studio`), and an AI agent (fal `openrouter/router/vision`) reads the sales plan into `spec.json` (the intake schema of
`../studio/pipeline/stages/intake.mjs`), asks the developer to approve it against the sales plan, and answers questions grounded on it.

| File | Purpose |
|---|---|
| `index.html`, `studio.js`, `studio.css` | the page, served at `/studio/` (uses the platform's `/css/tokens.css` + `components.css`) |
| `api/_studio.mjs` | shared server code: Clerk token check, Blob JSON, the per-project ledger (opened before every paid call, root §7), the fal call |
| `api/studio-config.mjs` | GET: the Clerk publishable key and which services are configured (booleans, never secrets) |
| `api/studio-projects.mjs` | GET list / one project; POST create; POST approve the reading |
| `api/studio-upload.mjs` | POST: issues the client-upload token for the developer's own project path only |
| `api/studio-agent.mjs` | POST `op:'read'` (read the sales plan → spec.json; a PDF goes in as its page tiles) and `op:'chat'` |
| `api/studio-file.mjs` | GET: streams one private file of the developer's own project (the trace overlay, result previews) |
| `api/studio-pub.mjs` | GET `/p/<pid>/…` (vercel.json rewrites): the PUBLISHED project, read-only from the private store — only the files the runner's pointer `studio/pub/<pid>.json` lists (tour/, projects.json, fixtures/); the template from the site; the typed bar via `/api/tour-edit` (fork F, 2026-11-05) |
| `package.json` | the functions' dependencies, copied to the deploy root |

## Reading the sales plan
The browser renders every PDF page with pdf.js 6.4.299 (cdnjs) into `files/.pages/<file name>/`: `page-N.jpg` (overview, ≤ 3000 px)
and `page-N-rRcC.jpg` (overlapping tiles, ≤ 2000 px, ~250 dpi, ≤ 20 per page) + `index.json`, the idea of
`../studio/tools/prep_pdf.py`. `op:'read'` sends the overview + tiles as images, each with its note, plus the PDF when ≤ 4 MB.

## Job contract — `habait-studio/job.v1` (the portal ⇄ the project runner, `../tour360/PROJECT-PACKAGE.md`)
The site is a fixed TEMPLATE + one DATA PACKAGE per project (Eliran). The build job turns the approved reading into that package.
- **Where:** `studio/u/<uid>/p/<pid>/job.json` in the private Blob store, plus a queue pointer `studio/queue/<jobId>.json`
  = `{ schema:'habait-studio/queue.v1', job, uid, pid, jobPath, at }`. The runner lists `studio/queue/`, claims a job by setting
  `state:'running'` in job.json and deleting the pointer; the portal re-adds the pointer whenever the developer acts (approval, correction).
- **Written by the portal** (`POST /api/studio-projects { id, build:true, consent:true }`, only after the reading is approved):
  `schema, id, project, owner, name, created, inputs { prefix, spec, files[], pages, trace:null }, consent { version, text, at, by, accepted },
  approvals { spec, trace:null }, corrections[]`, and `state:'queued', stage:'queued', percent:0, log[]`.
- **Written by the runner:** `state` (`queued|running|waiting|done|failed`), `stage` (a portal stage — `trace, trace_approval, fidelity,
  package, publish, done` — or a run-project step — `platform, apartment, cameras, prompts, scenes, furnish, render, sets, markers,
  dollhouse, build, publish-local`), `percent` (0–100), `log[] {at, line}` (Hebrew lines, shown to the developer), `updated`, `error`.
- **The trace gate:** after the auto-trace the runner uploads `trace/overlay.png` (the trace drawn over the sales plan) and
  `trace/plan.json` into the project prefix, then sets `state:'waiting', needs:{ type:'trace_approval', overlay:'trace/overlay.png',
  trace:'trace/plan.json', note }`. The developer approves (→ `approvals.trace`, `inputs.trace`, `needs:null`, `state:'queued'`, pointer
  re-added) or sends a correction (→ `corrections[] {at, by, text}`, `stage:'trace'`, `state:'queued'`). Nothing is built before
  `approvals.trace` (sales-plan fidelity, Eliran 2026-11-04).
- **The automatic check decides, not the developer (Eliran 2026-11-04: "the AI agent checks fidelity automatically; the developer's
  approval is not relied on").** Before asking for approval the runner checks the trace against every printed dimension and puts it in
  `needs.check = { verdict:'PASS'|'FAIL', summary, rows:[{ label, printed_cm, traced_cm, delta_cm, ok }] }` (or `job.check`). Only a
  PASS shows the trace card (the check table above the overlay, then «אישור»); the server refuses `approveTrace` without
  `check.verdict === 'PASS'` (409 `review`). A FAIL sets **`state:'review'`** (stage `review`): the portal shows «ממשיכים לדייק» (autonomous: «המערכת ממשיכה לתקן לבד», Eliran 2026-11-05) with
  no approve button and keeps polling; Habait fixes the trace and puts the job back to `queued` (or `waiting` with a PASS check).
- **Fidelity per room:** `result.fidelity = { verdict, report, rooms:[{ room, verdict:'PASS'|'FAIL'|'PENDING', note }] }` (or
  `job.fidelity` while it runs) — the build card shows one row per room.
- **The result:** `result { package:'out/<pid>/package/', page:'/p/<pid>/', tour:'/p/<pid>/tour/', fidelity:{ verdict, report } }`
  and optional `links[] {label, href}` (site-relative or https only). The page shows «דף הפרויקט» and «סיור 360° בדירה» from `result`.
- **Consent:** the checkbox text is a DRAFT (`version:'draft-2026-11-04'`) for Eliran's wording (root §6); the accepted text and
  version travel in job.json.

## Conventions / gotchas
- Staged by `Projects/Habait/tools/deploy-vercel/stage_flow.py <out> --edit-api --studio` (the files go to `/studio/` and `/api/`).
- Env names (values only in Vercel): `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `BLOB_READ_WRITE_TOKEN`, `FAL_KEY` (SECRETS-LEDGER).
- Sales-plan fidelity (Eliran 2026-11-04) is a hard gate: no build step before the developer approves the reading, and no build
  past the trace before the developer approves the trace.
- Sign-in UI is Hebrew (`@clerk/localizations@3.37.10` heIL, the v3 line matches clerk-js 5). Clerk's bot protection blocks a
  HEADLESS browser from signing up: e2e tests run headed (off-screen window), real visitors are not affected.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md)
