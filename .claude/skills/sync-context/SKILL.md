---
name: sync-context
description: "Explicit only: one /sync-context pass over the whole context layer: refresh every CLAUDE.md and the root Context map, reconcile both memory systems (prune/relink/correct, never invent), then run the drift checks (16 on hold until re-pointed, 17 on hold: no remote, 18 plan/board state) and the weekly metrics block."
user-invocable: true
disable-model-invocation: true
---

# /sync-context — the context layer, the memory, the drift checks

> ⏸ **Local git on `main` since 2026-11-04; identity set, no remote (Eliran: local only).** Check 16 (worktree inventory) is on hold until re-pointed to `C:\RnD`'s git worktrees (one repo since 2026-11-04) (Eliran 2026-11-04: features in git worktrees under `.wt\`): print `SUSPENDED (check 16 — not re-pointed)`. Check 17 (versions) is on hold: report it `SUSPENDED (no remote)`. Check 0 reads file modified times, not commit dates. No step commits anything.

Lean contract (2026-11-04, plan `development/plans/2026-11-04-workflow-cleanup.md`). Numbering is kept because other files point at it (Target 3e, Checks 9, 16, 17). Every check's full specification and history: [references/full-spec-2026-11-04.md](references/full-spec-2026-11-04.md). Retired text: [RETIRED-2026-10-22.md](RETIRED-2026-10-22.md). The rules this pass enforces are root `CLAUDE.md` §0 (memory), §8.6 (a context file in every folder) and §8.8 (plans). Where this file and those rules disagree, the root wins.

**Actually edit the files.** Report what changed, and print every check line every pass, even when it is clean.

## Target 1 — the CLAUDE.md context files (root §8.6)
1. `python .claude/skills/sync-context/generate-cards.py --check` lists missing and stale generated files. Then `--apply` writes them and `docs/context-map.generated.md`. Re-run `--check` until it prints `missing context files: 0 · stale generated: 0`.
2. Generated files (`generated-by` on line 3): the generator owns the tables. Purpose and Gotchas are filled from what is on disk, by `codebase-cartographer` or by hand, never invented.
3. The ~30 hand-written context files (the root Context map's rows): compare each Key-files and Subfolders table with the folder, add new load-bearing files, remove deleted ones, and correct any claim the disk contradicts (paths, counts, the git state). Set `<!-- last-updated: YYYY-MM-DD -->` on line 2 of every file you touch.
4. Excluded: vendor and build output, `.wt/`, dated `*-backup-` / `*-archive-YYYY-MM-DD` copies (root §8.6).

## Target 2 — the root Context map
The root `CLAUDE.md` `## Context map` lists the **areas** (the hand-written context files). The full list, one row per `CLAUDE.md` on disk, is the generated `docs/context-map.generated.md`. Both directions hold: every hand-written context file has its area row, and every row points at a file that exists. Keep each row's one-liner in step with its file's title.

## Target 3 — memory, both systems
1. **Repo `memory/`:** run `node .claude/skills/sync-context/verify-memory.mjs`. It lists orphan files (no INDEX line) and dead INDEX links, and warns on INDEX lines over 400 chars. Fix only by prune / relink / correct, then re-run until it prints `CLEAN`. ⛔ Never read `INDEX.md` whole: grep it.
2. **Claude Code auto-memory** (`~/.claude/projects/c--RnD/memory/`, index `MEMORY.md`): one index line per file, no dead lines, and every fact that the disk now contradicts corrected or removed.
3. **Never invent.** Every line is grounded in a file that exists. `runs/` is append-only: correct it with a new entry, never by rewriting. ⛔ Never delete a memory file. Secrets: names only.
4. **3e, the garden:** a live `memory/agents/<name>.md` over 200 KB rotates verbatim onto `agents/<name>.<YYYY-MM>.md`, with an archive-index block left in the live file and its INDEX lines repointed in the same change. A retired one-board persona's file moves to `agents/_ephemeral/`.
5. **HOT:** the main session rewrites `memory/HOT.md` by hand, ≤ 60 lines, and updates the stamp on line 2. Each line points at its source and does not narrate. `generate-hot.mjs` is not used: its inherited format does not match this harness (HOT line 2).

## The checks — report-only signals, every line printed every pass
| # | Check | How | Result |
|---|---|---|---|
| 0 | context-file staleness | a folder's newest file mtime vs. its file's `last-updated` | flags for review, never an auto-rewrite; `lint-bom` / `evidence-index`: SKIP (no `.claude/hooks/`, no `qa-evidence/`) |
| 1 | marker lint | `check-context.mjs` [1]: exactly one `last-updated` marker, line 2 | PASS / FAIL |
| 2 | ship-ledger currency | newest date in `docs/governance/SHIP-LEDGER.md` vs. the newest `memory/runs/*` ship/deploy entry | IN SYNC / GAP |
| 3 | OWED owners and age | `docs/governance/OWED.md`: no blank/TBD owner; open rows by age | list |
| 4 | gate-number register | the register and `Habait/MVP/` do not exist | `SKIP (register absent)` |
| 5–8 | rules block byte-identity · line ceilings · startup token budget · enforced-by vs. installed hooks | `node .claude/skills/sync-context/check-context.mjs` (exit 1 = a FAIL to fix this pass, in the file that is wrong; never by editing `settings*.json`) | PASS / FAIL |
| 9 | memory-contract phrases | `check-context.mjs` [9]: "bounded read-first", "second reader", "An action is not done until its memory is written" in root `CLAUDE.md`, `memory/README.md`, `.claude/agents/_MEMORY_PREAMBLE.md` (case-insensitive) | PASS / FAIL |
| 10, 13–15 | retired | `RETIRED-2026-10-22.md` | `RETIRED` |
| 11 | HOT freshness | `memory/HOT.md` ≤ 60 lines and its line-2 stamp names this pass | PASS / FAIL |
| 12 | memory caps, strict | `node .claude/skills/sync-context/verify-memory.mjs --strict` after 3e | REPORTED (gates at `/close-board`) |
| 16 | worktree inventory | on hold until `check-worktrees.mjs` reads `git -C C:/RnD worktree list` | `SUSPENDED (check 16 — not re-pointed)` |
| 17 | version register | needs a remote | `SUSPENDED (no remote)` |
| 18 | plan / board state (2026-11-04) | `python scripts/board_state.py`: both tables against each board README's `**State:**` line; boards and plans with no row | CLEAN / DRIFT (fix leading words with `--go`; add missing rows by hand) |
| — | weekly metrics | `node .claude/skills/sync-context/metrics.mjs`, verbatim | report-only, never gates; "dirty measures dirtiness, not truth" |

A check that exits 1 is a real finding: fix it in the file that is wrong, and never re-run the unchanged command hoping for a 0.

## Report
```
=== Context files ===   generate-cards: missing N · stale N · written N; hand-written refreshed: <files> | in sync
=== Context map ===     area rows added/removed; generated list N files (parity OK)
=== Memory ===          repo: orphans / dead links / corrected facts | CLEAN; auto-memory: … | in sync; HOT rewritten (N lines)
=== Checks 0–18 ===     one line per number, as in the table above
=== Weekly metrics ===  <metrics.mjs output>
```

## Rules
- Edit; don't just report. Keep each file's style; change only what changed.
- House voice: terse, navigational, honest (root §8.3).
- Never invent; prune / relink / correct only. `runs/` append-only. Never delete a memory file.
- Several sessions may be editing at once. Run `git status` first, and don't sweep a file another session holds staged; tell that session instead.
- No commit as part of the pass; the main session commits afterwards if Eliran wants it.
