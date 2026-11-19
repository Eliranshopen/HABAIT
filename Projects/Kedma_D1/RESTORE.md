# Restoring Kedma D/1 on another computer
<!-- 2026-11-19, written by the session that built the tour -->

1. Get the repo: `git clone https://github.com/Eliranshopen/HABAIT C:\RnD` (or `git pull` in an existing C:\RnD). It holds the code, the
   memory and `Projects/Kedma_D1` text files. No media.
2. Unzip `OneDrive\Kedma_D1-2026-11-19.zip` into `C:\RnD\Projects\` → `C:\RnD\Projects\Kedma_D1\` (the media: panoramas, the built
   tour, the working canvases, renders, the Blender scene). Overwrite the text files from step 1 if asked: they are the same.
3. The keys file `C:\RnD\.env` (FAL_KEY, OPENROUTER_API_KEY) is in NO copy. Bring it yourself, or put the keys in a new `.env` there.
4. Open Claude Code in `C:\RnD` and write «תמשיך את קדמה». The session will:
   - create the working folder `C:\RnD\.wt\kedma-d1` (a git worktree, a new branch off main),
   - copy `Projects/Kedma_D1/worktree/Projects/` over `.wt/kedma-d1/Projects/`, and `job/` to `.wt/kedma-d1/Projects/3Dengine/jobs/kedma-d1/`,
   - set the paths in `job/env.sh` to that computer (Python venv, Blender, Chrome) and run the engine's doctor,
   - continue from the resume point: last section of `memory/project/2026-11-16-kedma-d1-simulation.md` (next: day/night).

Left out of the zip (still on the first computer, `C:\RnD\.wt\kedma-d1` and `C:\RnD\Projects\Kedma_D1`): the `*.before-*` canvas
backups (4.4 GB), the per-view image answers under `_local/flatfix/` (2 GB) and the non-chosen panoramas in `_local/generated/`.
