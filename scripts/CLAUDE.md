# scripts/ — harness scripts
<!-- last-updated: 2026-11-19 -->

## What's here
Small scripts that turn a hand-proven harness procedure into one command (root `CLAUDE.md` §3, §5: dry-run by default, `--go` to write, non-zero exit with the reason on stderr). Both were hand-run first on 2026-11-03 (`.wt\harness-focus`) and tested on a scratch root before landing here. Plan: `development/plans/2026-11-03-harness-focus.md` phase 3.

| File | Purpose |
|---|---|
| `wt.py` | the working-folder procedure of root §8.7: `open` (copy + sha256 manifest), `add` (follow-up in the same task; re-adding a file already closed in this task reopens it with a fresh hash, the old pair kept under `rounds`, 2026-11-04), `status`, `close` (refuses on drift, copies back, verifies, records). Refuses a path another open folder holds. Never deletes a folder (D11) |
| `board_state.py` | one state source (plan `development/plans/2026-11-04-workflow-cleanup.md`): checks the board table (`development/tasks/CLAUDE.md`) and the plans table against each board README's `**State:** \`WORD\`` line; lists boards with no row, dead rows, plans with no row. `--go` rewrites only a drifted leading state word, never adds a row. Tested on a scratch copy 2026-11-04 (injected drift → fixed → byte-equal to live) |
| `sync_checks.py` | (2026-11-16) the three report-only checks of a `/sync-context` pass that had no script: [0] hand-written context files whose folder holds a file newer than the date on their marker line, [2] the newest `SHIP-LEDGER.md` date against the newest ship or deploy file in `memory/runs/`, [3] `OWED.md` open rows and blank owners. Read-only, writes nothing, never touches an env file. Written after two passes skipped these checks |
| `mem_entry.py` | one memory entry per root §0.2: the `_TEMPLATE.md` entry, its INDEX line under the existing header (≤ 400 chars), the second-reader pointer. Refuses missing evidence paths and secret-shaped text (§8.1) |
| `media_pull.py` | gives a feature git worktree under `.wt\<name>` the media git does not carry, from the main checkout: folders become read-only junctions (`_local/` of tour360 apt846, engine, studio; `node_modules`), `platform/_local` is a real copy (builds write there), floor-plan webp copied + sha256. Dry-run default, `--go` acts, record `.wt\<name>.media.json`; **`--unlink --go` BEFORE a worktree is removed** (2026-11-04, first used by `fix-disclosure-badge`) |

| `snap_common.py` · `snap_scan.py` · `snap_history.py` · `snap_ingest.py` · `snap_upload.py` | (2026-11-19) the snapshot of the whole `C:\RnD` folder for the public repo `Eliranshopen/RnD` (plan `development/plans/2026-11-19-full-public-repo-rnd.md`), built in the bare repo `C:\RnD-full.git`, outside the tree. `snap_scan.py`: inventory + secret scan of the working tree, values never printed. `snap_history.py`: the same scan over the whole local git history. `snap_ingest.py ingest \| status \| commit`: records every file (text as git blobs, media hard-linked into an LFS store), then writes one snapshot commit; **`commit --no-media --ref refs/heads/<new>`** is the form in use since Eliran's ruling of 2026-11-19 (no media, no LFS; documents as git files; the left-out media listed by path and size). `snap_upload.py`: bounded rounds of an LFS upload, NOT in use while the ruling is "without media". Dry-run by default, `--go` writes, resumable; run with `python -I`. Proven by hand first on one folder of 19 files |
| `restore/` | (2026-11-19) the engine's restore pack for another computer: `RESTORE.cmd` / `restore.ps1` (tools, repository from a bundle, worktree, assets, notes, agent side, readiness check), `README-HE.md`, and the tools that build and scan the pack; published as a release asset of `Eliranshopen/RnD`. Its own context file: [`restore/CLAUDE.md`](restore/CLAUDE.md) |

## Conventions / gotchas
- A refresh of the `RnD` repo, on Eliran's word only: `python -I scripts/snap_ingest.py ingest --go` until exit 0 → `snap_scan.py` and `snap_history.py` (0 real hits) → `snap_ingest.py commit --no-media --ref refs/heads/no-media-2 --readme C:/RnD-full.git/extras/README-no-media.md --go` → `git -C C:/RnD-full.git -c credential.helper='!gh auth git-credential' push origin refs/heads/no-media-2:refs/heads/main`. Never publish a SHA-256 list of media: an LFS object once uploaded to a public repo is served to anyone who knows its hash.
- Run from `C:\RnD` in Git Bash: `python scripts/wt.py …`, `python scripts/mem_entry.py …`; `--root <dir>` points either at a test copy.
- Both force UTF-8 output (the console is cp1255).
- The `/close-task` skill (`.claude/skills/close-task/`) is the procedure that calls them.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md)
