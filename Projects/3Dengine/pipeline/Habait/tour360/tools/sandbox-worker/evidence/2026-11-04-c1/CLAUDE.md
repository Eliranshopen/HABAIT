# 2026-11-04-c1/ — context file
<!-- last-updated: 2026-11-04 -->

## Purpose
Ledger row C1: the first Blender render of the project runner in Vercel Sandbox. It rendered apt846 `cp-kitchen` at 1024x512 @ 16 spp (CPU, 4 vCPU / 8 GB).

## Key files
| File | Purpose |
|---|---|
| `spike-report.json` | the run of record (session 3): phase timings, active vCPU-seconds from `/proc/stat`, cost at Pro rates, output hashes, status after stop |
| `spike.log` | the full console of session 3, including render_tour's own output |
| `sysinfo.txt`, `apt.txt`, `blender-download.txt`, `blender-extract.txt`, `python-venv.txt`, `prep-workdir.txt` | each phase's stdout and stderr |
| `attempt1-*`, `attempt2-*` | the two failed sessions (13 s and 17 s). Attempt 1: 8 vCPU refused and blender.org returned 403. Attempt 2: `/vercel/sandbox` was missing |

## Subfolders
| Folder | Purpose |
|---|---|
| `files/` | what came back from the VM: `pano.webp`, `depth.png`, `pano.render.json`, `_render-tour.report.json`, the build and render logs, `scene-full.report.json`, `time-render.txt` (`/usr/bin/time -v`) and `mem.log` (`free -m` every 2 s) |

## Links
Parent: [../CLAUDE.md](../CLAUDE.md)
