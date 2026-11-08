# mobile-responsive/ — context file
<!-- last-updated: 2026-11-05 -->
<!-- generated-by: generate-cards.py · tables are facts from disk and regenerate; Purpose and Gotchas are kept as written -->

## Purpose
Skill `mobile-responsive` (auto, from `AsadSumbul/mobile-responsive`, MIT, installed 2026-11-04 on Eliran's ask) — mobile-first web UI from 320px to desktop: no horizontal overflow, ~44px touch targets, reflow instead of shrink, and match the project's existing tokens and breakpoints. The contract is `SKILL.md`; this context file only routes (root `CLAUDE.md` §8.4).

## What's here (2026-11-05)
4 files here · 3 subfolders · 15 files / 685.4 KB in the whole tree (vendor and build output excluded)

| File | Size | Modified |
|---|---|---|
| `.gitignore` | 80 B | 2026-11-04 |
| `LICENSE` | 1.1 KB | 2026-11-04 |
| `README.md` | 5.3 KB | 2026-11-04 |
| `SKILL.md` | 8.4 KB | 2026-11-04 |

## Subfolders
| Folder | Card | Files in tree |
|---|---|---|
| `assets/` | [`assets/CLAUDE.md`](assets/CLAUDE.md) | 6 (656.3 KB) |
| `references/` | [`references/CLAUDE.md`](references/CLAUDE.md) | 4 (12.1 KB) |
| `scripts/` | [`scripts/CLAUDE.md`](scripts/CLAUDE.md) | 1 (2.3 KB) |

## Gotchas
- Installed by the `skills` CLI (`skills-lock.json`, `installMode: copy`); re-install with `npx skills add https://github.com/AsadSumbul/mobile-responsive --skill mobile-responsive -a claude-code --copy -y` — this overwrites the frontmatter edit (≤ 300-char description, upstream one kept as a YAML comment, `allowed-tools`, 2026-11-04). Body unedited.
- ⚠ **RTL blind spot:** `scripts/check-overflow.js` only measures overflow to the RIGHT (`rect.right - clientWidth`). On a Hebrew `dir="rtl"` page the overflow goes LEFT (`rect.left < 0`) and the script reports a false "All widths clean". On Habait pages also check `rect.left < -1`, or read `document.documentElement.scrollWidth > clientWidth`.
- The script needs Playwright (`require('playwright')`); run it bounded per root §12: `timeout 300 node .claude/skills/mobile-responsive/scripts/check-overflow.js <url> 320,360,375,390,414`. Habait's QA width is 390px (`habait-deploy-qa`), so add it to the list.
- Examples are Tailwind/JSX; the Habait platform is plain HTML/CSS/JS — use `references/frameworks.md` (plain CSS) and logical properties per `hebrew-rtl-best-practices` (`margin-inline-start`, not `margin-left`).
- `assets/` is upstream's before/after demo (`capture.js` + screenshots); not part of the working flow.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md) · Root: [../../../CLAUDE.md](../../../CLAUDE.md) · Rule: root `CLAUDE.md` §8.6 · Full list: `docs/context-map.generated.md`
