# sandbox-worker/ — context file
<!-- last-updated: 2026-11-05 -->

## Purpose
The spike that proves the project runner's Blender step runs in **Vercel Sandbox** (rnd-9d, 2026-11-04). It is the
first step toward running the portal's build jobs (`run-job.mjs`) in Vercel instead of on Eliran's laptop. The design
for production is `C:\RnD\development\plans\2026-11-04-sandbox-worker.md`.

## Key files
| File | Purpose |
|---|---|
| `spike.mjs` | dry-run by default. `vercel env run -- node spike.mjs --go` from a folder linked to habait-flow boots ONE sandbox (4 vCPU / 8 GB, `persistent:false`), installs the apt libs, Blender 4.5.10 (sha256-verified) and a Python venv, uploads the code and apt846 inputs (built by rule, no secrets), renders one draft pano, downloads the evidence, then stops the sandbox and checks that it stopped |
| `worker.mjs` | the laptop side of the queue worker (fork E, 2026-11-05): `build-snapshot [--go] [--with-blender]` installs the executor's runtime in a sandbox and writes the snapshot id to Blob `studio/worker/snapshot.json`; `dispatch`, `status`, `vm-log`, `stop`, `test-job` drive `studio-web/api/_dispatch.mjs` by hand. Run as `vercel env run -e preview -- node worker.mjs …` from the linked stage folder with `HABAIT_BLOB_DIR` set |
| `build-proof.mjs` | the BUILD stage in a persistent sandbox without the Blob store (2026-11-05, while the store was suspended): `start / resume / status / fetch / delete`; phases with `.done` markers so a resumed session continues; evidence in `evidence/2026-11-05-build/` |
| `package.json` | `@vercel/sandbox` pinned to 3.8.0 (2026-10-13) |
| `evidence/` | `2026-11-04-c1/` the spike's report, logs and outputs; `2026-11-05-snapshot/` the worker's proof: snapshot record, the three laptop test jobs, the preview-trigger run (`preview-job-status.json`: trace 6.4 min in the VM → review) |

## Conventions / gotchas
- Auth comes only from `VERCEL_OIDC_TOKEN`, which `vercel env run` injects into the process. No token file is written, and process.env is never forwarded into the VM.
- Measured on 2026-11-04:
  - `/vercel/sandbox` does not exist in the image; the script creates it with sudo.
  - download.blender.org answers 403; the OCF Berkeley mirror served the file.
  - The team caps vCPUs at 4.
- The gitignored assets (catalog models, HDRI, textures) are read from the live tree (`HABAIT_ASSETS_ROOT`, default `C:/RnD/Projects/Habait/habait-walkaround`). Code is read from this worktree.
- Spend: `360walkaround/pipeline/RENDER-LEDGER.md` §2 row C1 was opened before boot; the worker's proof rows are in `development/tasks/studio-agent-fal/logs/spend-ledger.txt` (2026-11-05 12:20–13:08).
- Blob operations are a quota (the store was suspended 2026-11-05 on Hobby's operations limit): never poll with `list()`; `worker.mjs` finds a job by its address `studio/jobs/<id>.json`.
- The dispatcher itself lives in `Habait/studio-web/api/_dispatch.mjs` (shared with the portal's functions); `sudo poweroff` inside a VM does not end its session — `stop` / the portal's page load does.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md)
