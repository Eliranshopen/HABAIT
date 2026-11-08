# real-estate-content-production/ — context file
<!-- last-updated: 2026-11-05 -->
<!-- generated-by: generate-cards.py · tables are facts from disk and regenerate; Purpose and Gotchas are kept as written -->

## Purpose
Skill `real-estate-content-production` (auto, from `calesthio/generative-media-skills`, installed 2026-11-03 on Eliran's ask) — provider-independent truthfulness, disclosure, fair-housing, privacy and QA controls for real-estate media: virtual staging, listing photos, walkthrough reels, renovation concepts, neighborhood clips. Guidance only, no scripts. The contract is `SKILL.md`; this card only routes (root `CLAUDE.md` §8.4).

## What's here (2026-11-05)
2 files here · 0 subfolders · 2 files / 54.5 KB in the whole tree (vendor and build output excluded)

| File | Size | Modified |
|---|---|---|
| `EVAL.md` | 14.9 KB | 2026-11-03 |
| `SKILL.md` | 39.7 KB | 2026-11-04 |

## Gotchas
- Installed by the `skills` CLI (`skills-lock.json`, `installMode: copy`); upstream files are not edited, re-install with `npx skills add https://github.com/calesthio/generative-media-skills --skill real-estate-content-production -a claude-code --copy -y`.
- `SKILL.md` is 532 lines (over the 150-line standard, §8.4) and has no `allowed-tools`; kept as upstream because the lock hashes it.
- Its legal sources are US (NAR/MLS, HUD, FTC, FAA, Meta housing ads). For Israeli listings it is a production checklist, not a legal reference; Habait's own rails win where they differ — add-only on real footage, the bilingual *הדמיה · AI-generated* badge (root §6), and disclosure wording is Eliran's call.
- `EVAL.md` is a grader rubric ("do not expose to the agent being evaluated"); don't load it into a working prompt.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md) · Root: [../../../CLAUDE.md](../../../CLAUDE.md) · Rule: root `CLAUDE.md` §8.6 · Full list: `docs/context-map.generated.md`
