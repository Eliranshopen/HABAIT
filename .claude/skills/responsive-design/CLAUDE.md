# responsive-design/ — context file
<!-- last-updated: 2026-11-05 -->
<!-- generated-by: generate-cards.py · tables are facts from disk and regenerate; Purpose and Gotchas are kept as written -->

## Purpose
Skill `responsive-design` (auto, from `wshobson/agents` plugin `ui-design`, MIT, installed 2026-11-04 on Eliran's ask) — modern responsive layout technique: mobile-first breakpoints, container queries, fluid type and spacing with `clamp()`, CSS Grid. Guidance only, no scripts. The contract is `SKILL.md` (44 lines); depth in `references/`.

## What's here (2026-11-05)
1 files here · 1 subfolders · 5 files / 45.1 KB in the whole tree (vendor and build output excluded)

| File | Size | Modified |
|---|---|---|
| `SKILL.md` | 2.0 KB | 2026-11-04 |

## Subfolders
| Folder | Card | Files in tree |
|---|---|---|
| `references/` | [`references/CLAUDE.md`](references/CLAUDE.md) | 4 (43.1 KB) |

## Gotchas
- Installed by the `skills` CLI (`skills-lock.json`, `installMode: copy`); re-install with `npx skills add https://github.com/wshobson/agents --skill responsive-design -a claude-code --copy -y` — this overwrites the one frontmatter edit (`allowed-tools`, 2026-11-04). Body unedited.
- Pairs with `mobile-responsive` (the no-overflow gate and device matrix) and `mobile-native` (phone-feel fixes: 100vh, tap flash, safe areas). This one is the layout technique.
- Its examples use physical properties (`left`, `margin-left`); on Habait's RTL pages translate to logical properties per `hebrew-rtl-best-practices`.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md) · Root: [../../../CLAUDE.md](../../../CLAUDE.md) · Rule: root `CLAUDE.md` §8.6 · Full list: `docs/context-map.generated.md`
