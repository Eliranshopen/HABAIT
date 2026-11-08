# evidence/2026-11-06-snapshot/ — context file
<!-- last-updated: 2026-11-06 -->

## Purpose
The worker snapshot that the portal's sandboxes boot from, built by fork F on 2026-11-06 from branch `portal-stage` at 3f36551:
studio-supabase + project-runner + sandbox-worker. Command: `vercel env run -e preview -- node worker.mjs build-snapshot --with-blender
--vcpus 2 --go`. It used Vercel Sandbox on Hobby's included hours and made no fal or OpenRouter call. Its pointer `studio/worker/snapshot.json` is in the preview's Supabase store.

## Key files
| File | What it is |
|---|---|
| `snapshot.json` | the snapshot id, the code key (head + file-list hash), 377 files / 304.5 MB, Blender 4.5.10, the python packages, Chromium's path, and per-phase seconds (158.9 s in all) |

## Links
Parent: [../CLAUDE.md](../CLAUDE.md)
