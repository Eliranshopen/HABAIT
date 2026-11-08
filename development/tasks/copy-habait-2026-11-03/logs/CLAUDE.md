# logs/ — context file
<!-- last-updated: 2026-11-05 -->
<!-- generated-by: generate-cards.py · tables are facts from disk and regenerate; Purpose and Gotchas are kept as written -->

## Purpose
Evidence of the board: robocopy dry-run/copy/re-sync logs, the two verifier reports, the re-point tables, the toolchain report, the scripts that produced them (`repoint.py`, `verify_walk.py`, `toolchain.sh`).

## What's here (2026-11-05)
31 files here · 0 subfolders · 31 files / 125.6 KB in the whole tree (vendor and build output excluded)

| File | Size | Modified |
|---|---|---|
| `blender-smoke.log` | 5.6 KB | 2026-11-03 |
| `copy-all.log` | 1.3 KB | 2026-11-03 |
| `copy-summary.md` | 706 B | 2026-11-03 |
| `dry-run-all.log` | 498 B | 2026-11-03 |
| `dry-run-summary.md` | 395 B | 2026-11-03 |
| `engine-tests.log` | 1.7 KB | 2026-11-03 |
| `exclude-fixed.txt` | 155 B | 2026-11-03 |
| `npm-ci-appdeps.log` | 24 B | 2026-11-03 |
| `npm-ci-engine.log` | 25 B | 2026-11-03 |
| `pip-freeze.err` | 0 B | 2026-11-03 |
| `pip-freeze.txt` | 1.3 KB | 2026-11-03 |
| `repoint-after-resync.md` | 12.3 KB | 2026-11-03 |
| `repoint-applied.md` | 12.3 KB | 2026-11-03 |
| `repoint.py` | 2.5 KB | 2026-11-03 |
| `resync-all.log` | 28.5 KB | 2026-11-03 |
| `resync-summary.md` | 1.0 KB | 2026-11-03 |
| `toolchain-report.md` | 1.6 KB | 2026-11-03 |
| `toolchain.sh` | 2.7 KB | 2026-11-03 |
| `venv-create.log` | 0 B | 2026-11-03 |
| `venv-imports.log` | 228 B | 2026-11-03 |
| `venv-install.log` | 0 B | 2026-11-03 |
| `verify-report-2.md` | 1.5 KB | 2026-11-03 |
| `verify-report.md` | 2.8 KB | 2026-11-03 |
| `verify-robocopy.log` | 7.3 KB | 2026-11-03 |
| `verify-walk-fixed.out` | 6.8 KB | 2026-11-03 |
| `verify-walk.out` | 9.4 KB | 2026-11-03 |
| `verify2-robocopy.log` | 561 B | 2026-11-03 |
| `verify2-status-copy.txt` | 7.0 KB | 2026-11-03 |
| `verify2-status-src.txt` | 6.2 KB | 2026-11-03 |
| `verify2-walk.out` | 7.0 KB | 2026-11-03 |
| `verify_walk.py` | 4.2 KB | 2026-11-03 |

## Gotchas
- `exclude-fixed.txt` is byte-identical to `../exclude.txt` by design: it is the verifier's evidence copy; `exclude.txt` is the manifest.
- `repoint-applied.md` (task 06) and `repoint-after-resync.md` (task 09) are byte-identical by design: the re-apply after the re-sync changed the same 158 files.
- An unescaped backslash-t in a script once turned a path separator into a TAB; write paths in raw strings or with forward slashes.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md) · Root: [../../../../CLAUDE.md](../../../../CLAUDE.md) · Rule: root `CLAUDE.md` §8.6 · Full list: `docs/context-map.generated.md`
