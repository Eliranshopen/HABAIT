# Milestone 2.1, task 01 — the proof on one room: what was measured

Run by the main session on 2026-11-19, 10:30 to 10:56, in the working folder `C:/RnD/.wt/3dengine/Projects/3Dengine`, with the script `proofs/render-one-room.mjs`. The chain is the brought-in one, UNCHANGED: no file under `pipeline/` was edited. $0: the reading comes from the kept fixture reading, and no key reached a tool. The machine: load 6 to 19 % when each run started; no other Blender was running and the machine's Blender lock was free the whole time.

**The result the card asks for.** `pano.webp` (52,502 bytes), `depth.png` (148,727) and `pano.render.json` (10,174) of the living room of apartment 846, rendered by `run-project.mjs` → `render_tour.mjs` → Blender 4.5.10 (Cycles, CPU) at the chain's defaults, 2048x1024 and 32 samples: `proof-a-3-render.txt`. Their hashes are in the record of that run (`record-full.json` in the proof's work folder, which is not in git; the three numbers above are from the run's own listing).

## The six questions of the card

**1. What the five steps write, and where.** 18 files before the render, 65 with it (the record of each run lists every one with its bytes and its hash):
- `apartments/<id>/`: `plan.general.json`, `cameras.json`, `apartment.json`, `material-board.json`, and `_local/plan/` (`plan-crop.png`, `pdf-vectors.json`, `trace-plan.json`).
- `tours/<id>/`: `plan.base.json`, `plan.json`, `_furnish/` (`placements.json`, `plan.furnished.json`, `report.json`, two preview pictures); after the render also `scene-full.blend` (5.1 MB), `scene-full.report.json`, `manifest.json`, `renders/<point>/` (`pano.webp`, `depth.png`, `pano.render.json`, `pano.render.log`), `renders/_render-tour.report.json`, `renders/_logs/`.
- `out/<id>/`: `job.json`, `package/package.json`, one log per step.
- The reading itself writes, beside `plan.general.json`: `crop.png` (860,372 bytes) and `pdf-vectors.json` (561,591), which the build takes (`--crop`; the vectors are picked up from beside the plan).
- **The living room's point is `cp-livingRoom`** (room `r-living-room`) in a plan made by the reading tool; `cp-living` is the id in the older, hand-made plan of 846. Ten camera points, one per room. Room types in this plan: bedroom, bathroom, kitchen, hall, living, balcony, storage.

**2. Which files are the same bytes in a second run from the same input** (`proof-b-3-compare.txt`: two runs, each from nothing, 1024x512 and 8 samples; and the full-quality run against the first of them):
- **The same, in all three runs:** every file of the build (the 14 files of `apartments/<id>/` and `tours/<id>/` before the render, and the casework and furnish logs).
- **The same in the two renders that can be compared:** `pano.webp` and `depth.png`, byte for byte, and pixel for pixel (0 of 1,572,864 values differ in each). The depth's packed pixels: the same.
- **NOT the same:** `pano.render.json` (it holds times and dates), `tours/<id>/manifest.json`, `scene-full.blend` and `scene-full.report.json` (every scene build differs), `_render-tour.report.json`, every log of the render, `out/<id>/job.json` and `package.json`.
- The pipeline's own notes (`pipeline/360walkaround/pipeline/ENV.md`) measured three different sizes of the colour picture in five identical renders at another size. So the colour picture being the same bytes here, twice, is a measurement and not a promise.
- **The reading, a second time** (`proof-c-crop-again.txt`): `plan.general.json`, `crop.png` and `pdf-vectors.json` are the same bytes in two readings of the same PDF from the same kept reading with the same id and day.

**3. The seconds.**
| What | Seconds | File |
|---|---|---|
| the reading from the kept reading (not part of 2.1) | 262 and 248 | `proof-a-1-plan.txt`, `proof-c-crop-again.txt` |
| the four build steps together | 15 to 20 (apartment 0, casework 2, cameras 2, furnish 13) | `proof-a-2-build.txt`, `proof-b-2-two-runs.txt` |
| the render step for ONE point at 2048x1024, 32 samples | 479, of which Blender's render 425 (the rest: the scene build and the checks) | `proof-a-3-render.txt` |
| the render step for one point at 1024x512, 8 samples | 58 and 70, of which Blender's render 28 and 31 | `proof-b-2-two-runs.txt` |
| the same render asked again, nothing changed | 4 (skipped by the tool) | `proof-a-4-again.txt` |
The older record of this room (74 s) was at 16 samples. At the chain's default one room is about seven minutes on this machine's processor: two rooms at full quality do not fit a test.

**4. Junctions.** Yes. With `apartments/<id>`, `tours/<id>` and `out/<id>` made as directory junctions into another folder, the unchanged chain built and rendered, and all 65 files were in that folder (`proof-a-2-build.txt`, `proof-a-3-render.txt`: «junctions: true, true, true»). The junction NAMES `apartments/<id>` and `tours/<id>` show as untracked in `git status` while they exist (`out/` is ignored); removed, the tree is as it was (`proof-c-crop-again.txt`, the last lines).

**5. What the render skips, and what makes it render again.** Asked again with nothing changed, the tool skipped the point (4 s). Its key for a point holds the scene's build time: the two runs from nothing have DIFFERENT keys for the same point and the same input (`proof-b-3-compare.txt`: «input key: DIFFERENT»). So after any rebuild of the scene the tool no longer knows a point it rendered. Inside one job the scene is built once and kept.

**6. Free.** The tools ran with a fixed word in place of `FAL_KEY`, no other key name in their environment, and an env root that is an empty folder (the script's `toolEnv`): the build and the render need no key and read no keys file then.

## Found on the way
- **The smallest picture the chain renders is 1024x512.** `render_tour.mjs` hands the render a wrap pad of 512 px, and the render script refuses a pad larger than half the width: a try at 512x256 ended in exit 1 after 2 s (`proof-b-1-two-runs.txt`). When the render fails that early, `render_tour.mjs` itself crashes reading a `manifest.json` that was never written.
- **The tools' Blender lock** was free before and after every run. A run stopped at its time limit would leave it (the tools remove it only on a normal exit); the proof script removes it only when it names the run the script itself stopped.
- **The proof script lives in `proofs/`, not in `engine/proofs/`** as the board's card expected: a script that starts Blender cannot be under the unit tests' coverage bar of `engine/**`, and the test that imports every engine module would run it.

## What the contract can rest on
- A job's build and render files can live in the job, behind three junctions, with no change of a brought-in file.
- The build's files, the crop and the vectors can be hashed outputs: they are the same bytes every time.
- A room's three files are written once; the stage must never ask the tool for a room it holds, because the tool's own skip does not survive a rebuild of the scene, and `pano.render.json` is never the same bytes twice.
- «The same picture» of a repeated render: the depth and the colour picture were the same bytes here; the test may ask for the depth bit for bit, and for the colour picture within a small measured tolerance.
- A test renders at 1024x512 with few samples (about a minute a room with the scene build); the full quality was proven once, here.
