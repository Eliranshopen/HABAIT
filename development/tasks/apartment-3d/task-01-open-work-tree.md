# Task 01 — open the work tree `C:\RnD\.wt\apartment-3d\`
**Agent:** main session · **Model:** — · **Ruling tier:** T0 (layout already ruled in the plan, Step 0) · **Burst:** 1 · **Depends on:** 02 (plan approved)
**Memory file:** `memory/runs/` entry at board close (main session)

## What to do
1. Create `C:\RnD\.wt\apartment-3d\` mirroring `C:\RnD\Projects\Habait\habait-walkaround\` paths. Copy in, with robocopy from PowerShell:
   - `Habait\platform\` without `node_modules`, `test\**\*.png` evidence or `_local\` other than `_local\dist\rainbow\846\`
   - `Habait\platform\fixtures\rainbow\` without `orbit_real.mp4`
   - `Habait\tour360\apartments\apt846\{plan.general.json,cameras.json,scenes.json,videos.json,material-board.json,dollhouse\}`
   - `Habait\engine\_local\apt846\dollhouse\` (the floor GLBs `build_zip.mjs` reads)
   - `360walkaround\pipeline\export_dollhouse.py`
2. Write `manifest.json`:
   - `name`, `purpose`, `opened`, `source_root: "Projects/Habait/habait-walkaround"`
   - per file: `path` (relative to the repo) and `sha256_at_open`
3. Write `README.md` (one paragraph: what this is, the board, the preview URL, "nothing is copied back before Eliran's good").
4. Write `tools-wt/changes.py` (inside the work tree) that regenerates `CHANGES.md`:
   - for every manifest file whose work-tree hash differs from `sha256_at_open`, a unified diff against the live file;
   - every new file listed as NEW;
   - binary files by size and hash only.
   Run it once; the result must say "0 changed".
5. `build_zip.mjs` resolves paths relative to `Habait/platform` and to `C:/RnD/Projects/Habait/...`. List every absolute path it reads (`--tour-apartment`, `--glb`, `--legal`), and make sure the work-tree build reads the work-tree copies or reads live files strictly read-only.
6. Update root `CLAUDE.md` §8.7 and `.wt\CLAUDE.md`: the copy mirrors the repo the work belongs to (no `files\` prefix), may hold a runnable copy, and carries `CHANGES.md`. Memory row: `memory/project/` (Eliran's layout ruling, 2026-11-03).

## Files
- creates: `C:\RnD\.wt\apartment-3d\**`
- modifies: root `CLAUDE.md` §8.7, `C:\RnD\.wt\CLAUDE.md`
- reads: live `habait-walkaround` (read-only)

## Acceptance
- `manifest.json` lists every copied file. A recount of the hashes equals the live files.
- `CHANGES.md` says 0 changed.
- No file under `C:\RnD\.wt\apartment-3d\` is a junction or a symlink (`Get-ChildItem -Recurse -Attributes ReparsePoint` → 0).
- Live `habait-walkaround`: no file modified (spot-check: the manifest hashes still match).

## Standing rails (inherited verbatim from the board README — root `CLAUDE.md` §0)
1. **Bounded read-first:** `memory/HOT.md`, then the LAST ~150 lines of your own `memory/agents/<name>.md` (plus its archive-index block). ⛔ Never read `memory/INDEX.md` whole — grep it.
2. **Write last, once:** ONE entry (`memory/_TEMPLATE.md`) into the layer that owns the fact, plus ONE ≤ 400-char pointer line under that layer's existing `memory/INDEX.md` header. ⛔ Never add a header.
3. **Second reader:** name which OTHER actor must know this; append ONE pointer line into their `memory/agents/<name>.md`, or say "none".
4. **An action is not done until its memory is written.**
5. ⛔ **The live repo `C:\RnD\Projects\Habait\habait-walkaround\` is read-only to every card until card 10.** Every write goes into `C:\RnD\.wt\apartment-3d\` (same relative paths as the repo) or into this board folder. Memory rows are the only live writes (root §8.7).
6. ⛔ **No git anywhere** (Eliran, 2026-11-03). `CHANGES.md` in the work tree is the diff.
7. ⚠ **Machine resource rules** (root `CLAUDE.md` §12): every test, build, server, browser or render runs as `timeout N <cmd>`, one heavy run at a time, foreground; kill what you start by PID. The work-tree server is `PORT=8851`. Never use :8850 (another session's port).
8. ⛔ **Blender only by its owner** (`Projects\Habait\SESSIONS.md` rule 4); no paid call on this board ($0 plan). Deploying is a separate explicit go from Eliran (root §9).
