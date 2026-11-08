
## 2026-11-04 · main session · One git repo: the Habait product folded into C:\RnD
- **Did:** Eliran chose one repo. Product .git (8 commits, 35cc0f6) and an empty Projects/Habait/.git archived at C:\Habait-git-archive-2026-11-04 (moved, not deleted). Commit de560da: 1,331 files, habait-walkaround = the same 935. Rules re-pointed: a feature = git -C C:/RnD worktree add C:/RnD/.wt/<feature> -b <feature>.
- **Evidence:** `development/plans/2026-11-04-one-git-repo.md` · `.gitignore`
- **Learned:** Corrects project/2026-11-04-git-back.md: there is no separate product repo. Nested .git folders block git add with 'does not have a commit checked out'; find them before folding. Root ignores dist/build and *.log, so previously tracked files need -f to keep parity.
- **Owed / open:** Eliran: the archive folder C:\Habait-git-archive-2026-11-04 (keep or remove, his act); rnd-db never got the pause notice.
- **Second reader:** `habait-deploy-qa`
