# improve-codebase-architecture/ — context file
<!-- last-updated: 2026-11-05 -->
<!-- generated-by: generate-cards.py · tables are facts from disk and regenerate; Purpose and Gotchas are kept as written -->

## Purpose
Skill `improve-codebase-architecture` (explicit `/improve-codebase-architecture`, from `mattpocock/skills`) — Scan a codebase for deepening opportunities, present them as a visual HTML report, then grill through whichever one you pick. The contract is `SKILL.md`; this card only routes (root `CLAUDE.md` §8.4).

## What's here (2026-11-05)
2 files here · 1 subfolders · 3 files / 12.8 KB in the whole tree (vendor and build output excluded)

| File | Size | Modified |
|---|---|---|
| `HTML-REPORT.md` | 6.6 KB | 2026-11-03 |
| `SKILL.md` | 6.0 KB | 2026-11-04 |

## Subfolders
| Folder | Card | Files in tree |
|---|---|---|
| `agents/` | [`agents/CLAUDE.md`](agents/CLAUDE.md) | 1 (171 B) |

## Gotchas
- Installed by the `skills` CLI (`skills-lock.json`, `installMode: copy`); re-install with the CLI, never edit the lock by hand.
- It calls the skills `codebase-design`, `domain-modeling` and `grilling` — all installed (the first two on 2026-11-03, same source).
- Step 1 scans `git log` for hot spots — the harness repo is new (2026-11-04) and `Projects/Habait/` is outside it: name the module or area instead until there is history.
- Writes its report to `%TEMP%`, not the repo; the report loads Tailwind and Mermaid from CDNs.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md) · Root: [../../../CLAUDE.md](../../../CLAUDE.md) · Rule: root `CLAUDE.md` §8.6 · Full list: `docs/context-map.generated.md`
