# proofs/ — hand proofs, kept as scripts
<!-- last-updated: 2026-11-19 -->

## What's here
A new flow is run by hand once before the engine wraps it (root `CLAUDE.md` §3). The script of such a proof is kept here, with its evidence under the board's `logs/<milestone>/`. Nothing here is the engine: the stages are in `../engine/stages/`, and this folder is NOT under the coverage bar of `engine/**` and `mcp/**` (a proof that starts Blender cannot be a unit test, and the test that imports every engine module must not run it).

| File | Purpose |
|---|---|
| `render-one-room.mjs` | (2.1) the brought-in build and render chain, unchanged, on ONE render point of apartment 846: phases `plan` (the reading from the kept fixture reading, $0), `build`, `render`, `record`, `compare`, `pixels`, `clean`. Dry-run unless `--go`. With `--junctions` the three folders the tools write into (`apartments/<id>`, `tours/<id>`, `out/<id>` inside `pipeline/`) are junctions into `.runtime/proofs/2.1/<id>/`. What it measured: `development/tasks/3dengine/logs/2.1/proof-facts.md` |

## Conventions / gotchas
- A proof script follows the script contract (root §5): dry-run by default, it names every folder it will write, it exits non-zero on a failure.
- The id of a proof run is `proof21<letters or digits>`: it names folders the script may remove, so nothing else may carry such a name.
- One Blender at a time on this machine: the tools take the lock file named by `HABAIT_BLENDER_LOCK`. A proof only looks at it; it removes it in one case, when it names the run the script itself stopped at its time limit.
- Free: the tools get a fixed word in place of a key and an env root with no keys file. Nothing of a drawing's text is printed: the tools' output goes to a log in the work folder.
- The smallest picture the chain renders is 1024x512 (the wrap pad of 512 px must be at most half the width).

## Links
Parent: [../CLAUDE.md](../CLAUDE.md) · Evidence: [../../../development/tasks/3dengine/logs/2.1/proof-facts.md](../../../development/tasks/3dengine/logs/2.1/proof-facts.md)
