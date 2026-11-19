---
name: rule-worktree-for-every-new-thing
description: "Eliran's rule: ONE git repo C:\\RnD (product folded in 2026-11-04, de560da); a NEW FEATURE = a git worktree C:\\RnD\\.wt\\<feature> on its own branch off main, never work on main; one per task, never per fix; harness work never gets one. Root CLAUDE.md §8.7."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 36366c87-19e4-42ff-821b-621f9ab40ec1
  modified: 2026-11-04T10:35:19.069Z
---

**Current form (2026-11-04).** Eliran: "כל מה שרציתי זה שתהיה האפשרות לWORKTREE ככה שאוכל לעבוד על פיצרים בנפרד ולא על הMAIN" (all he wanted was the ability to use worktrees so features are developed separately, not on main). A new feature = `git -C C:/RnD worktree add C:/RnD/.wt/<feature> -b <feature>`, commit on the branch, merge into `main` when done. Removing a worktree is Eliran's act. Never push.

**One repo (2026-11-04).** Eliran: "יש רק מאגר Git אחד, שזה ה-Git שאתה כבר מחובר אליו" — he sees one repo, and asked to make it so. `C:\RnD` now tracks `Projects/Habait` (commit `de560da`); the product's old `.git` (8 commits, `35cc0f6`, origin = the previous owner's GitHub) and an empty `Projects/Habait/.git` are archived at `C:\Habait-git-archive-2026-11-04`. Explain git in plain terms to him (commit ≠ merge; he asked both).

**Misread to avoid:** when asked "`.wt` plain folders vs git worktrees?" he answered ".wt" and I recorded "no git worktrees". He meant worktrees under `.wt`. When a one-word answer could mean either option, confirm what it means before recording it as a ruling.

**History (2026-11-03).** The rule began as "create work tree for every things we work on … C:\RnD\.wt", then ran as plain copy folders with a sha256 manifest (`scripts/wt.py`) during a short "no git" period. Folders opened in that form still close with `wt.py`. Narrowings that still hold: a folder only for a change Eliran opens on a project under `Projects\` (not for harness work, questions, reviews or /sync-context); one folder per task, never one per fix; `.wt` stays visible in the VS Code Explorer (hiding it reads to him as losing it).

**How to apply:** the worktree carries tracked files only. Restore ignored media with `python scripts/media_pull.py <name> --go`: read-only media become junctions, `platform/_local` is copied because builds write there. Before Eliran removes a worktree, run `--unlink --go`. Worktree names and the full plan are in `development/plans/2026-11-04-feature-worktrees.md` §10. The first worktree, `fix-disclosure-badge`, was merged and deployed on 2026-11-04. Stage only the paths you changed, never `git add -A`, because parallel sessions edit the same tree. See [[user-eliran-head-of-rnd]] and [[rule-context-file-in-every-folder]].
