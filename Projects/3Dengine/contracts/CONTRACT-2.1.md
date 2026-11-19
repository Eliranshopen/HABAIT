# Contract 2.1 — the render as an engine stage
<!-- milestone 2.1 (board card 08) · written 2026-11-19 by the main session, on the proof of task 01 (development/tasks/3dengine/logs/2.1/proof-facts.md) · only the main session changes this file -->

**In one line:** `building` and `rendering` become real stages of a job. The engine starts the brought-in build and render tools itself, one Blender at a time on the machine, keeps a row for every room it rendered, and never renders a room it already holds.

The plan's row (§7.1, 2.1), word for word: `pano.webp`, `depth.png` and `pano.render.json` for the living room; a kill in the middle of rendering two rooms and then a resume does not render again the room that finished; a second run on the same input skips everything; a repeated render of one room gives the same picture.

Nothing under `pipeline/` is changed in this milestone: the tools are wrapped, never forked.

## 1. The tools, and the one way the engine starts them
- **The build** is `pipeline/Habait/tour360/tools/run-project.mjs <id> --plan <plan> --crop <crop> --steps apartment,casework,cameras,furnish`, started only through `engine/build.mjs`.
- **The render of a point** is the same tool with `--steps render --render-points <point> --res <WxH> --samples <n>`, started only through `engine/render.mjs`. It starts `render_tour.mjs`, which builds the scene when it is missing or stale (a Blender run) and renders the point (a Blender run).
- **Every value handed to a tool is an absolute path, a checked id, a checked point name or a number** (contract 1.2 §1: the tools find their flags by their text anywhere in the command). An id is `j` and the job's id (17 characters of `[a-z0-9]`); a point is `cp-` and letters or digits; a size is two whole numbers; a path with a character outside printable ASCII is refused before anything starts (`TOOLCHAIN_MISSING`, the sentence of 1.3).
- **A run is asynchronous** (the runner's heartbeat goes on), has a time limit, and is stopped as a whole process tree: Blender is a grandchild of what the engine starts.
- **Nothing a tool printed reaches an answer, a job file or the runner's log.** Its output goes to a log file in the job's workspace. The tools print room names of the drawing.

## 2. The workspace: where a job's build and render files live
The tools write at fixed places inside the pipeline tree: `Habait/tour360/apartments/<id>`, `360walkaround/tours/<id>` and `Habait/tour360/out/<id>`. They cannot be told another place.
- **A job's files live in the job:** `jobs/<job id>/work/apartment`, `work/tour` and `work/out`. For the time a tool runs, the three names in the pipeline tree are directory junctions to them (proven: the unchanged chain builds and renders through junctions).
- **The names are there only while a stage of the job runs.** A stage makes them before it starts a tool and removes them when it ends, however it ends (done, failed, stopped). Removing a name removes the link and never what it points at.
- **A name that is in the way is never followed and never removed:** if one of the three names exists and is not a junction to THIS job's folder, the stage fails (`STAGE_FAILED`, a fixed sentence) and touches nothing.
- **A runner that is killed leaves the three names.** The next runner of that job finds junctions to its own job and uses them. They are removed when that stage ends.
- **Nothing else of a job is in the pipeline tree**, and no tracked file of the engine home changes: while they exist the names show as untracked (`out/` is ignored).

## 3. `building`
- **Input:** the outputs of `tracing`. Since 2.1 they are seven: the five files of contract 1.3 and, from the same folder of the reading tool, `crop.png` and `pdf-vectors.json` (the picture of the drawing and its vector lines, which the build takes). All seven are the same bytes in every reading of the same PDF from the same kept reading (measured). *This changes one line of contract 1.3 (§3: «its five files are the stage's outputs»).*
- **A plan whose rooms carry a type outside the reading tool's own list is refused before any tool starts** (`STAGE_FAILED`; the sentence gives a count and never the word). The list is the nine values the reading tool maps every room to: `hall`, `living`, `kitchen`, `bedroom`, `bathroom`, `storage`, `balcony`, `safe_room`, `other`; a unit test reads it from the tool's file. A plan the tool made cannot carry another type; a file changed by a hand can. (The item of 1.3's review, O-1.) The stage's `detail` says how many rooms are `other`: the build leaves such a room without furniture.
- **Outputs, hashed in the manifest row:** the 12 files of fixed names the four steps write under `work/apartment` and `work/tour` (the plan with its casework and camera points, `cameras.json`, `apartment.json`, the material board, the three files of `_local/plan`, `plan.base.json`, `plan.json`, and `placements.json`, `plan.furnished.json`, `report.json` of `_furnish`). They are the same bytes in every run from the same input in the same job (measured, three runs). Not outputs: the logs and `work/out` (they hold times), and the preview pictures of `_furnish` (the tool names them after rooms, and a path in the manifest must not carry a name of the drawing: §8).
- **`detail`:** the count of rooms, how many of them are `other`, the count of camera points, the seconds.
- **Failure:** a tool that ends with another exit code, or does not end inside `build.timeoutSeconds`, fails the job with `STAGE_FAILED` and a fixed sentence naming the step; the tool's own words stay in its log.

## 4. `rendering`: a row per room
- **Which points:** the camera points of the built plan, in its order; or, when the setting `render.points` names some, only those, in the plan's order. A named point that the plan does not have fails the job (`STAGE_FAILED`) before any tool starts.
- **One room at a time.** For each point the stage either holds the room already (below) or takes the machine's Blender lock (§5), starts the render of that ONE point, and when the tool ends well writes the room's row. Then the next point. The lock is given back after every room.
- **A room is named by its place in the plan's order** (`room-01`, `room-02`, …) in everything the engine writes: the point's own name comes from the drawing (§8) and stays in the tools' files.
- **The room the job keeps** is the folder `jobs/<id>/stages/rendering/rooms/room-NN/`: a copy of the three files the tool wrote for that point (`pano.webp`, `depth.png`, `pano.render.json`), and beside it **the room's row**, `rooms/room-NN.json` (`habait/room.v1`): the place, the hash of the room's inputs, the three files with their bytes and sha256, the size and the samples, the seconds, the attempt that rendered it. The row is written last, after the three copies are on the disk, by a temp file and a rename, and only by a runner that still owns the job and the heavy lock.
- **The hash of a room's inputs** is the sha256 of: the stage's own input hash (which holds everything before it: the PDF, the reading, the build's outputs, the engine version), the point's name, the size and the samples.
- **A room the job holds is never rendered again.** The job holds a room when its row is there, names the same place and input hash, and the three kept files re-hash to what the row says. Then the stage starts no tool for it; when the tool's own copy in the workspace is gone or changed, it is put back from the kept one. *Why this is a rule and not an economy:* `pano.render.json` is never the same bytes twice, the tool's own «already rendered» does not survive a rebuild of the scene, and the stages after this one are paid for per picture: other bytes of a room would make them pay again.
- **A row that does not add up** (a file gone or changed, another input hash, a row that is not this job's point) is no row: the room is rendered again, and the new row replaces it.
- **Why the row is not a row of `manifest.json`:** a job's manifest has one row per finished attempt of a stage (contract 0.3), and a stage that is stopped in the middle has none. The rooms' rows are the stage's own record, kept by the same rules.
- **The stage's outputs, hashed in its manifest row** when every point has its row: for every rendered point, in the plan's order, the row and the three kept files. Since no held room is rendered again, they are the same bytes in every attempt.
- **A kill in the middle of a room** leaves the rooms before it with their rows and that room without one: the next runner renders from that room on. What the killed run left of that room, in the workspace or half-copied, is overwritten.
- **Failure:** a render that ends with another exit code, does not leave its three files, or does not end inside `render.timeoutSeconds` (per room) fails the job with `STAGE_FAILED` and a fixed sentence naming the point's place in the order, never its name. The rooms already rendered keep their rows: a restart goes on from the failed room.

## 5. The machine's Blender lock
One Blender at a time on this machine, whoever starts it (root `CLAUDE.md` §12). The tools already keep that rule with a lock FILE at the path the settings name (`blenderLock`; machine-wide, outside every working folder): it is made by an exclusive create, holds its owner's words and pid, has no staleness and no wait limit, and is removed by its holder on a normal exit only.
- **The engine holds that file itself around every tool run that can start Blender** (every render of a point), by the tools' own protocol: an exclusive create; the content `{ owner: "habait-engine", job, mark, pid, at }`, where `mark` is the tool id of the job (`j<job id>`), which every process of that job's tools carries in its command line.
- **The tool the engine starts takes a lock too.** It is handed a lock path of the job's own (`work/blender.lock`), which the stage removes before every start: a run that is killed cannot leave the machine's lock behind in the tool's name.
- **Held by anybody else, the engine WAITS.** The job stays in `rendering` with `waiting_for: "blender-lock"`, and looks again every few seconds; it answers a stop while it waits. It never removes and never takes a lock that names another owner, alive or dead: a lock left by a killed tool of another session is that session's, and the job waits until a person removes it.
- **The engine removes a lock in one case only:** it names the owner `habait-engine` and a pid that is dead. Before the file goes, every process that still carries that lock's `mark` in its command line is stopped (a killed runner leaves its tool and its Blender running). All of it happens under the engine's own guard (`<blenderLock>.engine-guard`, the folder lock of contract 1.4 §11), so two engine processes never look and act on the lock at the same moment.
- **The engine's folder lock is never used on the Blender lock's own path:** a folder renamed onto a file replaces the file, and that file may be another session's hold.
- **Given back:** after the tool ended, was stopped or failed, the engine removes the file when it still names this process. A stop of the job stops the tool's whole tree first.
- **The heavy lock of contract 0.3 is unchanged** and comes first: `rendering` is the job's heavy stage, one per engine home; the Blender lock is the machine's, across homes and sessions.

## 6. A stop, a kill, and what they leave
- **A stop of the job while a tool runs** (cancel, another runner took the job, the heavy lock lost): the stage stops the tool's whole process tree, gives the Blender lock back, removes the three names, and hands the runner exactly what it threw. No row is written for the room in flight.
- **A runner that is killed** leaves: its tool and Blender running, the Blender lock in its name, the three names. The next runner of the job, before it starts anything, stops every process that carries the job's `mark`, removes the engine's own dead lock (§5), and goes on from the first room without a row.
- **Before every start of a tool** the stage stops whatever still carries the job's `mark`: two tools of one job never write one workspace.
- No Blender, no tool and no lock of a job is left after a stop, a failure, or a kill followed by a resume.

## 7. «The same picture»
A repeated render of one room, from the same input, at the same size and samples, gives: **the same depth, bit for bit** (the packed pixels the tool records as `packed_data_sha256`, and here also the same file), and **the same colour picture within a tolerance**: at most 1 % of its values differ, and the mean difference over all values is under 0.5 of 255. In the proof the two colour pictures were the same bytes; the pipeline's own notes measured sizes that differ by a few bytes at another size, so the bytes are not promised. Inside one job a held room is never rendered twice, so the closing test first takes the room's row away (a room without a row is rendered again: §4) and compares the second render with a saved copy of the first.

## 8. Free, and no text of the drawing
- **No key and no keys file reaches the tools.** They get a fixed word in place of `FAL_KEY` (they read a keys file at their start when that name is unset), no other key name, and an env root that is an empty folder of the job. Proven: the build and the render need nothing else. The stages are free: no paid call, `cost_usd` 0.
- **Nothing an answer, `job.json`, `manifest.json`, a room's row, a path the engine chose or the runner's log says is text of the drawing.** Camera point names come from the reading's room names, so the engine names a room by its place in the order and gives counts. The tools' own files and logs in the workspace (`work/`) hold names, as the reading's folder does since 1.3; they stay in the job and no answer copies from them.

## 9. Settings, the version, and a real job today
- `build`: `timeoutSeconds` (600).
- `render`: `res` (`2048x1024`, the chain's default; at least `1024x512`: the tool's wrap pad of 512 px must be at most half the width, and the height is half the width), `samples` (32; a whole number from 1 to 4096), `timeoutSeconds` per room (1800), `points` (absent or `null`: all; else a list of point names), `lockPollSeconds` (5).
- Every number is a JSON number (contract 1.4 §6); a value that is not is refused by its name.
- The engine version is `2.1.0`: part of every job id, so jobs made before it are other jobs.
- **A real job today:** `tracing` → `building` → `rendering` are real; then `awaiting_approval` with the quote of the stub (the real quote is 4.1); approved, it fails at `skinning` (`STAGE_FAILED`: no real implementation; contract 1.3 §1). The real home's jobs stay `stub`.
- One room at the chain's default takes about seven minutes of this machine's processor; a whole apartment is rendered once, by this stage, at 3.1.

## 10. What changes in an earlier contract
- **1.3 §3:** the outputs of `tracing` are seven, not five (§3 above).
- **1.4 §11, the release of the folder lock** (the third review of 1.4, O-3): when `fn` ran and the release then fails, the result of `fn` is still returned, or its own error still thrown; a release that failed is reported apart, and never hides either. (Task 05.)
- **0.3:** the job file's `waiting_for` may also say `blender-lock` (the schema `contracts/job.schema.json` gains the word); nothing else. The rooms' rows are the stage's own (§4).
- **1.2 §3, the reading wrapper:** starting a tool with a log file, a time limit and a stop of its whole tree moved to `engine/lib/tool.mjs`, shared with the build and the render; the reading wrapper behaves as before.

## 11. Tests
- **The closing test** is `tests/stages/m2.1.test.mjs` (the stage tier: real Blender), on a temp home, at $0, the render limited to two points at `1024x512` and few samples: (1) the living room's three files are in the job and its row says so; (2) the runner is killed in the middle of the second room, and a resume does not render the first room again (its files and its row are the same bytes) and renders the second; (3) a second run on the same input (the job cancelled and started again) starts no tool; (4) the living room rendered again, after its row was taken away, is the same picture (§7). It waits for the machine's Blender lock like the stage; a wait for another session is time. After it: no process, no lock of the engine, no name in the pipeline tree.
- **Unit tests, with fake tools and no Blender:** the workspace (the three names made, used, removed; a name in the way), the build wrapper and stage (every exit, the time limit, a stop, the room types, the seven inputs, the outputs), the Blender lock (the protocol against a real second process: waits, never takes another's, removes its own dead one after stopping its leftovers, two engine processes at one moment), the render wrapper and stage (rows, held rooms, a row that does not add up, the order, a stop in the middle, a failure in the middle), the settings.
- **The full quality** (2048x1024, 32 samples) was rendered once, by hand, in the proof of task 01.

## 12. What is NOT in 2.1
- **The whole apartment, the furnishing audit, the time against 859 s:** 3.1, where this stage renders all the rooms.
- **The CG check against the plan:** 3.1. **The tour in the CG look, the link:** 3.2, 3.3.
- **The real quote:** 4.1. **The AI look and everything after it:** 5.x on.
- **Cleaning the workspace of a job that ended** (the scene file is 5 MB, a room's files are small), and the three names of a job whose runner was killed and that nobody resumes: the milestone that owns a job's end (3.3).
- **A GPU.** The chain picks one when the machine has it; this machine renders on the processor. The size and samples are in a room's input hash; the device is not.
- **A lock left by a killed tool of another session:** a person removes it (§5).
- **The coverage of a brought-in file under the coverage tool** (carried from 1.2): stays on the board.

## 13. Decisions taken while this was written (2026-11-19, main session, for Eliran's audit)
- **Junctions, not copies and not a change of the tools.** The tools' places are fixed; the proof showed junctions work. So a job's files are in the job with no change of a brought-in file, and deleting a job folder deletes its build and render.
- **A row per room is a file of the stage, not a row of the job's manifest** (§4): the manifest's rule «one row per finished attempt» is what resume rests on since 0.3.
- **One tool start per room,** not one start for all rooms: a row is written at a known moment, a stop is answered between rooms, and the machine's Blender is given to others between rooms. It costs a few seconds per room (the tool's start and its look at the scene).
- **The engine waits for a foreign lock for ever, like the tools do,** and says what it waits for. Taking a lock of another session to save time would start two Blenders on one machine.
- **Tests render small** (1024x512, few samples: about a minute a room with the scene build). The mechanics the test proves do not depend on the picture's size; the full size was proven by hand.
- **«The same picture» has a tolerance for the colour picture** (§7), because the pipeline's own notes show its bytes are not always the same.
- **A room is kept as a COPY of the tool's three files, under the name of its place in the order** (§4). The copy is what the manifest hashes and what «held» means; the tool's own files can be rewritten by a later tool, and their folder is named after the point, which is a word of the drawing.
- **An engine lock whose pid was taken by another, long-lived process is not seen as dead:** the job waits, and a person removes the file. Written as a limit; the lock has no heartbeat.
- **The proof script is `proofs/render-one-room.mjs`,** outside `engine/`: a script that starts Blender cannot be under the unit tests' coverage bar.
