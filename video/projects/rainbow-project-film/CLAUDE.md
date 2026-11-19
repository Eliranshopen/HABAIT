# rainbow-project-film/ — context file
<!-- last-updated: 2026-11-10 -->

## Purpose
The first film made with the `project-film` skill: a 66.2 s, 1280x720 draft for Rainbow Tel Aviv, built at $0 from media already on disk (Eliran, 2026-11-10: only existing material, no cost). **DRAFT: not approved, not published.**

## What's here
| Path | Purpose |
|---|---|
| `build.py` | the whole film as one script: shot list, captions, overlays, music. Dry-run by default, `--go` builds (about 1 min), idempotent |
| `manifest.json` | one row per shot: source + sha256, subject, disclosure, captions, cost 0 |
| `out/rainbow-project-film-draft-16x9.mp4` | the film |
| `qa/contact-sheet.jpg` | one frame per second |
| `clips/`, `overlays/` | build intermediates (per-shot clips, caption/badge PNGs rendered by headless Chrome) |

## Gotchas
- No lifestyle shots, no transformation hook, no map pills, no voice: nothing on disk supports them at $0.
- Interiors are pans inside the live 2048 px parquet panoramas, so they are softer than the exterior clips.
- The logo is the platform's placeholder `fixtures/rainbow/logo.svg`, not the developer's.
- Music is an existing 30 s track looped three times; nobody has listened to the loop.
- ffmpeg lessons: v360 yaw commands need `reset_rot=1`; clips must share one pixel format and colour tags before a concat copy; burn overlays per shot, not in one pass over the film.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md) · Recipe: `.claude/skills/project-film/SKILL.md`
