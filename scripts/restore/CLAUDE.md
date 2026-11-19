# scripts/restore/ — the engine's restore pack for another computer
<!-- last-updated: 2026-11-19 -->

## What's here
The files that put the engine's working state (`C:\RnD`, engine home `Projects\3Dengine`) on ANOTHER Windows computer with no dependence on the first one, and the tools that build the pack. Made on 2026-11-19 on Eliran's words («להמשיך את העבודה ממחשב אחר», «תעשה אתה כל מה שצריך», «אני רוצה להגיע למצב שאני מוריד הכל מהריפו בגיטהאב בלי תלות במחשב הזה»).

The pack is ONE download: the asset `RnD-engine-restore.zip` of the release `engine-restore-2026-11-19` in the public repo `Eliranshopen/RnD`; a local copy is `C:\RnD-carry-2026-11-19` on the first computer. Record: `memory/project/2026-11-19-engine-handoff-other-computer.md`.

| File | Purpose |
|---|---|
| `RESTORE.cmd` | the file a person double-clicks on the other computer; it starts `restore.ps1` |
| `restore.ps1` | the restore, seven steps, each safe to run again: the tools (Git, Node 24.22.1, Python 3.13, Blender 4.5.10 exactly, Chrome; installed only when missing), the repository from `rnd-repo.bundle` with every branch, the worktree `.wt\3dengine`, what git does not keep, Claude's notes, the agent side, the engine's environment and its readiness check in both homes. Exit 0 = `READY` twice, 2 = only the keys are missing, 1 = stopped with the reason. It never overwrites and never touches the keys file. ASCII only (Windows PowerShell 5.1) |
| `README-HE.md` | the page Eliran reads: three actions, what is in the pack, the same steps by hand |
| `pack_copy_tree.py` | copies a folder into the pack without env-named files, deploy-tool state and vendor folders (dry run by default, `--go`) |
| `history_scan.py` | secret scan of the WHOLE git history of a repository (every blob of every ref); a value is never printed |
| `dir_scan.py` | the same scan over folders on disk (it reads its patterns from `history_scan.py`) |
| `make_restore_zip.py` | the pack as one zip (without `agent-side\`), with its sha256 and a zip test |

## How the pack is built (hand-proven 2026-11-19; root §3: no wrapper until it is run this way again)
1. `git -C C:/RnD bundle create <pack>/rnd-repo.bundle --all`, then `git bundle verify`.
2. `<pack>/not-in-git/Projects/3Dengine/`: `engine.config.local.json`, `pipeline/360walkaround/catalog/models`, `pipeline/360walkaround/catalog/.cache` (the furniture pack: it can no longer be downloaded), `pipeline/360walkaround/pipeline/probe/probe-assets/hdri`. `<pack>/not-in-git/.wt/deploy-P-7`: the demo site, with `pack_copy_tree.py`.
3. `<pack>/claude-memory/`: the notes of `docs/claude-memory-export/` (the copy with the private address replaced by words), without its `CLAUDE.md`.
4. `RESTORE.cmd`, `restore.ps1`, `README-HE.md` from this folder.
5. `history_scan.py C:/RnD` and `dir_scan.py <pack>/not-in-git <pack>/claude-memory`: 0 real hits, or nothing is published.
6. `make_restore_zip.py <pack> <zip>`; `gh release create <tag> <zip> --repo Eliranshopen/RnD`; compare the asset's `digest` with the printed sha256.
7. The agent side as a second asset `agent-side.zip` holding `habait-agent-ui.tgz` and `pi-habait-wrapper.tgz`: `git archive --format=tar.gz engine-mcp` of `C:\HABAIT-Agent-UI` and of `C:\pi-main\habait` (source only), scanned with `dir_scan.py` after unpacking.

## Conventions / gotchas
- **Publishing is Eliran's act, every time.** The repo `Eliranshopen/RnD` is PUBLIC by his ruling (`memory/project/2026-11-19-full-public-repo-rnd.md`); a new release is made on his word, after both scans.
- **The agent side is published as source only** (Eliran, 2026-11-19, in a question dialog): the git history of those two repositories carries a private address in its commit records, so their bundles stay in the local pack and never go to a public place.
- **The keys file is never in the pack**, in any form. `restore.ps1` ends with exit 2 and says so when the engine reports that only the keys are missing.
- The tree of `Eliranshopen/RnD` is written only by `scripts/snap_ingest.py` (another session's tool); this folder adds RELEASES there, never commits.
- `restore.ps1` was tried three times on this computer against scratch folders (`-Root … -UiRoot … -WrapperRoot … -NotesDir … -SkipInstalls -SkipGlobalPi`): a first run, a second run over the same folders, and a run that downloads the agent side from the release. The install step (winget, the Node installer, the PATH change for Python) has NOT been run anywhere: it only starts when a tool is missing.
- A pack is a picture of one day. After more work, a new pack is built by the steps above and published as a new release.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md)
