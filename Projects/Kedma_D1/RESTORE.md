# Restoring Kedma D/1 on another computer
<!-- 2026-11-19, written by the session that built the tour -->

Everything needed is in the GitHub repo Eliranshopen/HABAIT (Eliran 2026-11-19: media included, public), no other computer needed.

1. `git clone https://github.com/Eliranshopen/HABAIT C:\RnD` (about 9 GB with the other projects' text; Kedma's media is 2.1 GB).
   `C:\RnD\Projects\Kedma_D1\` then holds: `panoramas/` (13 final panoramas), `dist/` (the built tour), `job/` (tools, prompts,
   logs), `plan/`, and `worktree/` (the working folder: canvases, the chosen answers, renders, the Blender scene, the changed tools).
2. The keys file `C:\RnD\.env` (FAL_KEY, OPENROUTER_API_KEY) is in no copy and never goes to GitHub. Bring it, or create a new `.env`.
3. Open Claude Code in `C:\RnD` and write «תמשיך את קדמה». The session will:
   - create the working folder `C:\RnD\.wt\kedma-d1` (a git worktree, a new branch off main),
   - copy `Projects/Kedma_D1/worktree/Projects/` over `.wt/kedma-d1/Projects/`, and `job/` to `.wt/kedma-d1/Projects/3Dengine/jobs/kedma-d1/`,
   - set the paths in `job/env.sh` to that computer (Python venv, Blender, Chrome) and run the engine's doctor,
   - continue from the resume point: last section of `memory/project/2026-11-16-kedma-d1-simulation.md` (next: day/night).

Not on GitHub (only on the first computer, `C:\RnD\.wt\kedma-d1`): the `*.before-*` canvas backups (4.4 GB), the per-view image
answers under `_local/flatfix/` (2 GB) and the non-chosen panoramas in `_local/generated/`. None is needed to continue.
A copy of the same package also sits in the first computer's OneDrive (`Kedma_D1-2026-11-19.zip`); OneDrive showed a sync error there.
