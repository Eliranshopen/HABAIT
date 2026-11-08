# domain-modeling/ — context file
<!-- last-updated: 2026-11-05 -->
<!-- generated-by: generate-cards.py · tables are facts from disk and regenerate; Purpose and Gotchas are kept as written -->

## Purpose
Skill `domain-modeling` (auto, from `mattpocock/skills`) — Build and sharpen a project's domain model: challenge terms, keep `GLOSSARY.md` current, offer ADRs under `docs/adr/` sparingly. The contract is `SKILL.md`; this card only routes (root `CLAUDE.md` §8.4).

## What's here (2026-11-05)
3 files here · 1 subfolders · 4 files / 8.5 KB in the whole tree (vendor and build output excluded)

| File | Size | Modified |
|---|---|---|
| `ADR-FORMAT.md` | 2.7 KB | 2026-11-03 |
| `GLOSSARY-FORMAT.md` | 2.3 KB | 2026-11-03 |
| `SKILL.md` | 3.4 KB | 2026-11-04 |

## Subfolders
| Folder | Card | Files in tree |
|---|---|---|
| `agents/` | [`agents/CLAUDE.md`](agents/CLAUDE.md) | 1 (104 B) |

## Gotchas
- Installed by the `skills` CLI (`skills-lock.json`, `installMode: copy`); upstream files are not edited, re-install with the CLI.
- It creates `GLOSSARY.md` and `docs/adr/` lazily. In a project that is a project change (root §8.7, a `.wt` folder); a new folder gets its context file in the same change (§8.6). Eliran's rulings still go to `memory/project/` and `docs/INHERITED-DECISIONS.md`, never only to an ADR.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md) · Root: [../../../CLAUDE.md](../../../CLAUDE.md) · Rule: root `CLAUDE.md` §8.6 · Full list: `docs/context-map.generated.md`
