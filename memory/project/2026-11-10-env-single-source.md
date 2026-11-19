---
date: 2026-11-10
layer: project
author: rnd-9d (main session)
second-reader: secrets-steward (the SECRETS-LEDGER copies row), habait-deploy-qa
---
# Ruling: secrets come only from the live `Projects\Habait\habait-walkaround\.env`

**Eliran, 2026-11-10 ~10:35 (verbatim):** «אני רוצה שהכל יתבסס רק על C:\RnD\Projects\Habait\habait-walkaround\.env — את השנייה לא צריך» (the second = `C:\RnD\Projects\Habait-backup-2026-11-04\.env`, the frozen 2026-11-04 backup copy he had open in the IDE while rotating `FAL_KEY`).

**Verified ($0):** no code reads the backup folder — the only reference is the context-file generator's exclusion list (`.claude/skills/sync-context/generate-cards.py`); the backup `.env` is not tracked by git and is ignored (`git check-ignore`). The balance probe, the tools and the site already read only the live file (the Vercel copies are separate, SECRETS-LEDGER row `FAL_KEY`).

**How to apply.** Every script, agent brief and probe names the live file only.

**Removal (2026-11-10 10:45).** The command was handed to Eliran with two options; he chose option 2 in words («אז אני בוחר באופציה 2»): the whole backup folder. The session ran `rm -rf C:/RnD/Projects/Habait-backup-2026-11-04` on that explicit choice after checking it was a plain folder (not a reparse point, not a git worktree, nothing tracked, git-ignored) and that the live project was intact; 10:45:39 → 10:45:52, 28 GB freed, `Projects/` now holds `CLAUDE.md` and `Habait/` only → `runs/2026-11-10-backup-folder-removed.md`. The SECRETS-LEDGER `FAL_KEY` copies row never listed this copy, so it needs no change; the frozen archive `C:\Habait-archive-2026-11-03` was not touched.
