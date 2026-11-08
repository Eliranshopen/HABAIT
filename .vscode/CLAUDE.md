# .vscode/ — context file
<!-- last-updated: 2026-11-05 -->
<!-- generated-by: generate-cards.py · tables are facts from disk and regenerate; Purpose and Gotchas are kept as written -->

## Purpose
VS Code settings for the `C:\RnD` folder (Eliran, 2026-11-03, root `CLAUDE.md` §8.7): `settings.json` hides `.git`, keeps `.wt/` (the working folders) visible in the Explorer but out of search and quick-open, and sets `git.enabled: true` so VS Code shows the `main` branch (local git, Eliran 2026-11-04).

## What's here (2026-11-05)
1 files here · 0 subfolders · 1 files / 173 B in the whole tree (vendor and build output excluded)

| File | Size | Modified |
|---|---|---|
| `settings.json` | 173 B | 2026-11-04 |

## Gotchas
- A setting here applies only when VS Code opens `C:\RnD` itself as the folder; opening `Projects\Habait` alone uses that folder's own `.vscode/`.
- After a change here, run **Developer: Reload Window** if the git badges or a hidden folder do not update at once.
- `.wt/` shows in the Explorer at Eliran's ask (2026-11-03: "I want the WT folder under the main folder"; it was hidden for about an hour before that). Only `search.exclude` skips it, so a search finds the live file and never a working-folder copy.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md) · Root: [../CLAUDE.md](../CLAUDE.md) · Rule: root `CLAUDE.md` §8.6 · Full list: `docs/context-map.generated.md`
