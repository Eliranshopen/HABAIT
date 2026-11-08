# scripts/ — harness scripts
<!-- last-updated: 2026-11-04 -->

## What's here
Small scripts that turn a hand-proven harness procedure into one command (root `CLAUDE.md` §3, §5: dry-run by default, `--go` to write, non-zero exit with the reason on stderr). Both were hand-run first on 2026-11-03 (`.wt\harness-focus`) and tested on a scratch root before landing here. Plan: `development/plans/2026-11-03-harness-focus.md` phase 3.

| File | Purpose |
|---|---|
| `wt.py` | the working-folder procedure of root §8.7: `open` (copy + sha256 manifest), `add` (follow-up in the same task; re-adding a file already closed in this task reopens it with a fresh hash, the old pair kept under `rounds`, 2026-11-04), `status`, `close` (refuses on drift, copies back, verifies, records). Refuses a path another open folder holds. Never deletes a folder (D11) |
| `board_state.py` | one state source (plan `development/plans/2026-11-04-workflow-cleanup.md`): checks the board table (`development/tasks/CLAUDE.md`) and the plans table against each board README's `**State:** \`WORD\`` line; lists boards with no row, dead rows, plans with no row. `--go` rewrites only a drifted leading state word, never adds a row. Tested on a scratch copy 2026-11-04 (injected drift → fixed → byte-equal to live) |
| `mem_entry.py` | one memory entry per root §0.2: the `_TEMPLATE.md` entry, its INDEX line under the existing header (≤ 400 chars), the second-reader pointer. Refuses missing evidence paths and secret-shaped text (§8.1) |
| `media_pull.py` | gives a feature git worktree under `.wt\<name>` the media git does not carry, from the main checkout: folders become read-only junctions (`_local/` of tour360 apt846, engine, studio; `node_modules`), `platform/_local` is a real copy (builds write there), floor-plan webp copied + sha256. Dry-run default, `--go` acts, record `.wt\<name>.media.json`; **`--unlink --go` BEFORE a worktree is removed** (2026-11-04, first used by `fix-disclosure-badge`) |

## Conventions / gotchas
- Run from `C:\RnD` in Git Bash: `python scripts/wt.py …`, `python scripts/mem_entry.py …`; `--root <dir>` points either at a test copy.
- Both force UTF-8 output (the console is cp1255).
- The `/close-task` skill (`.claude/skills/close-task/`) is the procedure that calls them.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md)
