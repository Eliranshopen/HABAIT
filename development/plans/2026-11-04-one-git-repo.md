# One git repo — fold the Habait product into `C:\RnD`
<!-- filed: 2026-11-04 · main session rnd-a2 / rnd-77 · state: DONE 2026-11-04 — commit de560da (Eliran: "כן" ×2, after the gate showed 182 MB) · harness work, no board -->

## Result (2026-11-04)
- Commit `de560da`: 1,331 files under `Projects/Habait`; `habait-walkaround` = exactly the 935 files its old `.git` tracked (18 of them were ignored by later rules and were added with `-f` to keep parity).
- Gate: 182 MB total, over the 150 MB / 20 MB marks. 172.6 MB of it was already in the old product git (`orbit_real.mp4` 41 MB, the guide videos); new content was 396 files, 9.5 MB. Eliran approved after seeing it.
- Found on the way: a third, empty `Projects/Habait/.git` (0 objects, made 09:18) that blocked `git add`. It was archived beside the product's `.git` in `C:\Habait-git-archive-2026-11-04\Projects-Habait-empty.git`.
- Widened from the draft: `research/` keeps code too (`html`, `js`, `mjs`, `cjs`, `css`, `json`, `py`, `txt`), because `research/fal-bench-2026-11-02/flyover3d/` is the live `/hold/` page.
- Rules updated: root §8.7 and §11, `.wt/CLAUDE.md`, `Projects/CLAUDE.md`, `Projects/Habait/CLAUDE.md`, `/plan-to-tasks` Step 5, HOT, auto-memory.
- Not delivered: the pause notice to rnd-db, which was held and expired (different permission mode). rnd-32 (rnd-23, exterior-film) confirmed and was told it is done.

## The ask
Eliran, 2026-11-04: "יש רק מאגר Git אחד, שזה ה-Git שאתה כבר מחובר אליו", then chose option 1 = one repo. Today there are two `.git` folders on disk.

## What is on disk (measured 2026-11-04)
| Repo | Where | History | Notes |
|---|---|---|---|
| harness | `C:\RnD\.git` | 12 commits, `main`, created 2026-11-04 | root `.gitignore` excludes `Projects/Habait/` |
| product | `C:\RnD\Projects\Habait\habait-walkaround\.git` | 8 commits, `main` at `35cc0f6`; `origin` = `github.com/Slava12233/habait-walkaround` | came with the copy from the other machine; 935 tracked files, 88 MB, pack 13 MB; `git worktree list` = `main` only (no feature worktree yet); 1 uncommitted change (`CLAUDE.md`) |

`Projects/Habait` sizes: `habait-walkaround/` 28 GB (of which `Habait/flyover/` 16 GB of renders, already ignored), `tools/` 2.5 GB, `research/` 2.1 GB (3,585 files, 93 of them `.md`), `mix/` 98 MB (Eliran's videos + PDF + 3 `.md`), `development/` 56 MB (76 png, 52 md), `data/` 2.1 MB, `.claude/` 55 KB, root files (`CLAUDE.md`, `SESSIONS.md`, `REPOINTED.md`, `memory.md` 200 KB).

## What goes into the one repo
| In git | Out of git (stays on disk, untouched) |
|---|---|
| `habait-walkaround/`: exactly today's tracked set; its own `.gitignore` keeps working in the subfolder (renders, `_local/`, `media/cache/`, `node_modules/`, floor-plan webp, `.env*`) | `tools/` (Blender, venv, appdeps: 2.5 GB) |
| `.claude/` (the 7 project agents, the `plan-to-tasks` pointer) | `research/` binaries (images, video, data: ~2.1 GB) |
| root files: `CLAUDE.md`, `SESSIONS.md`, `REPOINTED.md`, `memory.md`, `.gitignore` | `mix/` media (`*.mp4`, `*.pdf`: Eliran's uploads) |
| `docs/`, `data/` (sales-plan corpus, 2.1 MB) | `development/**/*.png` (board screenshots) |
| `research/**/*.md`, `mix/*.md`, `development/` text (`md`, `json`, `jsonl`) | everything any `.gitignore` already excludes |

**Gate before the commit:** `git add --dry-run Projects/Habait` → file count, total size, the 20 largest. Stop if any file is > 20 MB or the total is > 150 MB, and show Eliran the list.

## Steps
1. **Quiet window.** Tell the live sessions (rnd-23, rnd-7d, rnd-8d, rnd-3f) to stop running git inside `habait-walkaround`. Check `git worktree list` there = `main` only, and its status = the one known change.
2. **Archive the product `.git`, don't delete it:** move `habait-walkaround\.git` to `C:\Habait-git-archive-2026-11-04\.git` (the same pattern as `C:\Habait-archive-2026-11-03`). Its 8 commits and the `origin` URL stay readable there. Removing it later is Eliran's act.
3. **Root `.gitignore`:** replace the line `Projects/Habait/` with the exclusions in the table above.
4. **Gate:** run the dry run, then show the list and the numbers.
5. **One commit** on `main`: "Fold the Habait product into the harness repo". Path-limited to `Projects/Habait` + `.gitignore`. Never push.
6. **Rules follow the change**, in the same pass: root `CLAUDE.md` §8.7 (a feature = `git -C C:/RnD worktree add C:/RnD/.wt/<feature> -b <feature>`) and §11 (the `habait-walkaround` row: no separate repo); `.wt/CLAUDE.md`; `Projects/Habait/CLAUDE.md`; `Projects/CLAUDE.md`; `/plan-to-tasks` Step 5; `memory/HOT.md`; `memory/project/2026-11-04-git-back.md` (a new correcting entry); the auto-memory rule file.
7. **Verify:** `git -C C:/RnD status` is clean for `Projects/Habait`; `git ls-files Projects/Habait/habait-walkaround | wc -l` = 935 (± the one changed file); no `.git` is left under `Projects/`; `board_state.py` and `generate-cards.py --check` are clean.

## Rollback
Move `.git` back from `C:\Habait-git-archive-2026-11-04\`, then `git revert` the fold commit and the `.gitignore` commit. Nothing is deleted, so this is complete.

## Risks
- A session that runs git in `habait-walkaround` during step 2 → step 1 is the guard.
- `CRLF` warnings on Windows: content is unchanged; no renormalisation in this plan.
- A `.wt\<feature>` worktree is now a checkout of the whole repo (harness + product, ~100 MB of tracked files); ignored media still need `media-pull` / `npm ci` inside it, as before.
