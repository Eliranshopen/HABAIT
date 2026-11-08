# .wt/ — one working folder per project change
<!-- last-updated: 2026-11-04 -->

## What's here
A folder is opened here only when Eliran opens a change or update to a project under `Projects\`: one flat folder per task, named after its board or task slug (root `CLAUDE.md` §8.7, Eliran 2026-11-03). **Nothing else gets a folder** (Eliran, 2026-11-03: "i dont need wt for code only wt for changes or updates i do for the peoject"): harness work, context files, `/sync-context`, questions and reviews are done straight in the live files. **One folder per task, not per fix** (Eliran, 2026-11-03): a fix or follow-up inside the same task goes into that task's folder, never into a new sibling. **A new feature is a git worktree** (Eliran, 2026-11-04: "כל מה שרציתי זה שתהיה האפשרות לWORKTREE ככה שאוכל לעבוד על פיצרים בנפרד ולא על הMAIN"): from the one repo (since 2026-11-04 `C:\RnD` holds the product too, plan `development/plans/2026-11-04-one-git-repo.md`), `git -C C:/RnD worktree add C:/RnD/.wt/<feature> -b <feature>`; commit on the branch; merge into `main` when done; `git worktree remove` is Eliran's act. A worktree holds only tracked files — ignored media (floor-plan webp, `media/cache/`, `node_modules/`) is restored by `media-pull` / `npm ci` inside it. The older folders below are plain copies plus a hash manifest (the 2026-11-03 no-git form) and close with `scripts/wt.py`.

This folder **shows in VS Code's Explorer** under the root (Eliran, 2026-11-03: "I want the WT folder under the main folder"). VS Code's search and quick-open skip it (`search.exclude` in the root `.vscode/settings.json`), so a search finds the live file, never a copy here.

## How a working folder lives
`python scripts/wt.py open|add|status|close <name> … --go` runs these steps (dry-run without `--go`; `scripts/CLAUDE.md`).

| Step | What |
|---|---|
| Open | copy each file the work will change to `.wt\<name>\files\<relative path>`; write `.wt\<name>\manifest.json`: name, purpose, opened, and per file `path` + `sha256_at_open` (`null` for a new file) |
| Work | edit only the copies; create new files under `files\` too |
| Follow-up | another file in the same task: copy it into the same `files\`, add its entry with its own `sha256_at_open` to the same manifest, and close it the same way. No new folder |
| Close | per file: the live file's sha256 must still equal `sha256_at_open` (else stop and reconcile by hand); copy back; set `closed` and per-file `sha256_at_close` in the manifest |
| Remove | Eliran's act only (D11) |

## What is here now (2026-11-04)
| Folder | State |
|---|---|
| `exterior-film/` | open (plain copy + manifest) — board `development/tasks/exterior-film`, EXECUTING |
| `fix-disclosure-badge/` | **git worktree**, branch `fix-disclosure-badge` ("תג הדמיה + הסתרת כפתורי קשר") — F01/F03/F20 merged into `main` 2026-11-04 (`7b6f617`) and DEPLOYED (`dpl_eDQTT7o6o2S6hprXnaCGkP1VJwTc`); F02 (badge on hold/dollhouse/flow/landing) still open in this task. Media: `python scripts/media_pull.py fix-disclosure-badge` |

The 12 closed working folders (`apartment-3d`, `build-zip-assets`, `dollhouse-in-tour`, `harness-focus`, `hold-building-tour`, `platform-ui-ux`, `prod-exposure-fix`, `studio-agent-fal`, `tour-dollhouse-developer`, `tour-exterior-floors`, `transition-rise`, `workflow-cleanup`) were **moved, not deleted**, to `C:\RnD\.wt-archive-2026-11-04\` on Eliran's word (2026-11-04: "תעשה מה שאתה חושב"); every one was closed and copied back. Restore = move back. New feature worktrees open here from the one repo `C:\RnD` (plan `development/plans/2026-11-04-feature-worktrees.md`).
The eight harness folders that were here earlier were removed on Eliran's go, 2026-11-03 → `memory/runs/2026-11-03-wt-cleared.md`.

## Gotchas
- Memory and register rows are written straight to the live `C:\RnD\memory\` and `C:\RnD\docs\governance\`, never through a working folder.
- The context-file generator and checkers skip `.wt/`, so no generated `CLAUDE.md` lands inside a working folder.
- VS Code's search skips this folder, which is the point: the live file is the only hit. Browse a manifest here in the Explorer; edit only the live files.
- `/worktree-ops` is archived and targets the old app; feature worktrees follow the paragraph at the top. `git -C C:/RnD worktree list` is the inventory of git worktrees here.
- Moved from root `CLAUDE.md` §8.7 (2026-11-04, size cap; updated the same day for one repo): `C:\RnD` is the only repo; the product entered it in commit `de560da`. The product's old `.git` (baseline `35cc0f6`, `origin` = the previous owner's GitHub) is archived at `C:\Habait-git-archive-2026-11-04` — never push. Remote, GitHub login and push are Eliran's act. The root `.gitignore` keeps out `.env*`, `.wt/*`, `Projects/Habait/tools/` and the media of `research/`, `mix/`, `development/`; `habait-walkaround/.gitignore` still rules its subtree. Still suspended: `/worktree-ops` (archived), `/sync-context` Check 16 (until re-pointed), every push/remote step of `/ship` and `/close-board`. Detail: `memory/project/2026-11-04-git-back.md`.
- Moved from root `CLAUDE.md` §8.7 (2026-11-04, size cap), the earlier wording of "nothing else gets a folder", translated: "I don't need a WT for every action that happens — only for new tasks I open for execution under the project".
- Each working folder's `manifest.json` is its record; `ls C:/RnD/.wt` is the inventory.
- `_env-backups/`, if it ever appears here, holds plaintext env copies: never open it (`docs/governance/SECRETS-LEDGER.md` §2).

## Rule §8.7 procedure
(Moved from root `CLAUDE.md` on 2026-11-04, wording unchanged.)
- **One folder per task, not per fix** (Eliran, 2026-11-03, after `.wt\` grew a new folder for every small fix; moved from root §8.7 on 2026-11-04, word for word): every fix, follow-up and check-driven correction inside the same task goes into that task's folder — add the file to the same manifest with its own sha256 at that moment, and run the close step for it. A new sibling folder (`<name>-checks`, `<name>-size` …) is never opened for it.
- **Use `python scripts/wt.py open|add|status|close <name> … --go`** (dry-run without `--go`); it does the steps below and refuses on drift. `/close-task` closes a task end to end.
- **Open:** copy the files the work will change into `.wt\<name>\files\` at their relative paths and write `.wt\<name>\manifest.json` with each file's sha256 at copy time. **Work** only in the copies; new files are created there too.
- **Close:** for each file, check that the live file's sha256 still equals the one recorded at open — if not, someone else changed it: stop and reconcile by hand — then copy it back and write the close into the manifest. Removing a closed folder is Eliran's act (D11).
- **Memory and register rows are written straight to the live `C:\RnD\memory\` and `C:\RnD\docs\governance\`**, never through a working folder.
- **VS Code** (Eliran, 2026-11-03; git part updated 2026-11-04): `.vscode/settings.json` hides `.git` in the Explorer; `git.enabled` is `true` since local git came back (2026-11-04), so VS Code shows the branch and git badges. `.wt/` shows in the Explorer under the root (Eliran: "I want the WT folder under the main folder"); only search and quick-open skip it, so a search finds the live file, never a working-folder copy.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md) · Rule: root `CLAUDE.md` §8.7 · Settings: [../.vscode/settings.json](../.vscode/settings.json)
