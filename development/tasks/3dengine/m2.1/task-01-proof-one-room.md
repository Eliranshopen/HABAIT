# Milestone 2.1 · task 01 — The proof: the existing chain renders one room in the engine home
<!-- board: 3dengine · milestone 2.1 (card 08 of the board) · created: 2026-11-19 · owner: Eliran Shopen -->

**Agent:** engine-builder · **Model:** opus · **Ruling tier:** T0
**Runs as:** the main session, in the `engine-builder` role; the scene and render chain is the `blender-scene` role's ground (the project agents do not load in a session started at `C:\RnD`)
**Wave:** 0 · **Depends on:** card 07 of the board (milestone 1.4) is closed
**State:** `DONE` — 2026-11-19: the unchanged chain rendered the living room (`cp-livingRoom`) in the engine home at 2048x1024 and 32 samples (425 s of Blender on the processor); the six questions are answered in `../logs/2.1/proof-facts.md`. The script is `Projects/3Dengine/proofs/render-one-room.mjs` (not `engine/proofs/`: a proof is not under the engine's coverage bar).

## Files it creates or changes
- `engine/proofs/render-one-room.mjs` (new: the proof as a script; dry-run without `--go`)
- `engine/proofs/CLAUDE.md` (new folder, its context file)
- `development/tasks/3dengine/logs/2.1/proof-*` (the evidence, and `proof-facts.md`: what the contract needs to know)

## Instructions
Hand-prove before automating (root §3). Run the EXISTING chain, unchanged, inside the engine home, on ONE render point of apartment 846: from the plan the reading tool makes of the golden PDF (the kept fixture reading, $0) through `run-project.mjs` steps `apartment` → `casework` → `cameras` → `furnish` → `render` with `--render-points cp-living`. The scene is always the whole apartment; only the render is one point. One Blender at a time on this machine, under the lock file named by `HABAIT_BLENDER_LOCK` (root §12). Other sessions render too: when the lock is held, WAIT; never remove a lock that is not this run's own. Keep the script and its evidence. Then MEASURE what the contract needs, each as a saved fact: (1) every file the five steps write, and where; (2) which of them are the same bytes in a second run from the same input (the build files, `crop.png` of the reading, `pano.webp`, `depth.png` and its packed pixels, `pano.render.json`); (3) the seconds of every step and of the scene build; (4) whether the three folders the tools write into (`apartments/<id>`, `tours/<id>`, `out/<id>` inside the pipeline tree) can be directory junctions into a folder elsewhere, so that a job's files live in the job; (5) what `render_tour.mjs` skips in a second run, and what makes it render again (the scene's build time and absolute paths are in its input key); (6) what the tools do with no keys in the environment (they read a keys file at start when `FAL_KEY` is unset): prove the free steps run with a fixed word in its place and an env root that has no keys file. No ported file is changed in this task; if the chain cannot run as it is, stop and write down why.

## Acceptance criteria
1. `pano.webp`, `depth.png` and `pano.render.json` of `cp-living` exist, made in the engine home by the unchanged chain; the render report shows the resolution and the samples of the chain's default.
2. `proof-facts.md` answers the six questions above, each with the file that shows it.
3. The tracked files of the engine home are as they were after the proof (`git status --short -- Projects/3Dengine` shows nothing new that the proof left).
4. The script is dry-run by default and names every folder it will write before it writes (root §5).

**Check:** `cd C:/RnD/.wt/3dengine/Projects/3Dengine && node engine/proofs/render-one-room.mjs` prints the plan of the run and writes nothing; the evidence of the real run is in `logs/2.1/proof-*`.

## Standing rails
1. **Bounded read-first:** `memory/HOT.md`, then the LAST ~150 lines of your own `memory/agents/<name>.md` (plus its archive-index block), then `memory/listings/<id>.md` only if the task names a listing. ⛔ Never read `memory/INDEX.md` whole — grep it.
2. **Write last, once:** ONE entry (`memory/_TEMPLATE.md`) into the layer that owns the fact, plus ONE ≤400-char pointer line under that layer's existing `memory/INDEX.md` header. ⛔ Never add a header.
3. **Second reader:** at write time, name which OTHER actor must know this; append ONE pointer line into each named actor's `memory/agents/<name>.md` — `→ see <entry> — why it binds you`. No affected actor = say "none".
4. **An action is not done until its memory is written.**
5. **Ruling tier** — every brief carries its own `T0` / `T1` / `T2`.
6. Root `CLAUDE.md` §2, §8.7, §12: work only in the board's working folder; `timeout` on every run, one heavy run at a time, foreground; never open a `.env`; the plan's budget or $0; no deploy without Eliran's own go for that deploy (§9).
7. **The gate (Eliran, 2026-11-16):** no card starts before the previous card is closed. A card closes only after its closing test, its unit tests, every earlier card's tests, test coverage of at least 80 %, and a sync-context pass (plan §7.2).
8. **Git:** stage only your own paths; ⛔ never `git add -A` (the deletion of `Projects/Habait` in the main tree is unstaged and must stay so); never push.
9. **Secrets by NAME only:** never print a value, never name a `.env` path in a command; check a key's presence as a yes/no.
10. **Paid calls:** ledger row BEFORE the call, dry-run first, inside the cap, and only after Eliran answered the card's question.

Full contract: `memory/README.md` and root `CLAUDE.md` §0.
