
## 2026-11-08 · main session · GitHub remote: private Eliranshopen/HABAIT, media-free snapshot
- **Did:** Eliran 2026-11-08 ruled a GitHub upload of the whole project without media to his gmail account (= GitHub login Eliranshopen, his word). Pushed a no-history snapshot of main@8864cbf as commit 444c5b2 to private repo Eliranshopen/HABAIT: 2702 files, 833 media files left out, secret scan 0 hits over 15 patterns. Local remote name: github. Local main untouched.
- **Evidence:** `.git/config`
- **Learned:** Replaces the 2026-11-04 'no remote, no push, never the gmail' ruling for this one repo. Filter media with core.quotepath=false: a Hebrew-named PDF slipped through a quoted ls-tree path on the first try (repo habait-rnd, superseded). Push uses -c credential.helper='!gh auth git-credential', no global config change.
- **Owed / open:** Eliran: delete the superseded private repo Eliranshopen/habait-rnd (has one 183KB PDF), or say keep. Future syncs = a new snapshot commit on top of 444c5b2, only on Eliran's word.
- **Second reader:** `habait-deploy-qa`

- **Correction (2026-11-08, same day):** HABAIT was created private; Eliran set it **PUBLIC** himself ("בסדר שהוא PUBLIC אני הגדרתי אותו ככה"). Every future sync is a public publish — secret-scan before each push.

## 2026-11-19 · main session · second sync to HABAIT (public) on Eliran's word «אתה יכול לשמור הכל בגיטהאב?»
- **Did:** Snapshot commit 42fe44da on top of 444c5b2 = tree of main@6a384927 + Projects/Avney_Hefets_Kedem_4 from branch avnei-hefetz-kedem-4 commit a75dca2d (342 code/text files, committed locally first with a project .gitignore that keeps out media, .vercel/, .env*, the nested stage repo). 5574 files pushed, 1556 media left out. Built in a temporary GIT_INDEX_FILE; local main and the main checkout untouched.
- **Evidence:** `git ls-remote github main` = 42fe44da; key scan 15 patterns: 1 hit = the planted fake string `PLANTED` in Projects/3Dengine/tests/stages/m1.2.test.mjs (not a key).
- **Learned:** `git rm --pathspec-from-file` globs and has no -z; use `git update-index -z --force-remove --stdin` for literal Hebrew paths. Uncommitted work in other worktrees (Kedma, Hatzav, AHK B10) is NOT in the snapshot.
- **Second reader:** none

## 2026-11-19 · main session (Hatzav) · snapshot 904aa1d3 pushed on Eliran's word («אתה יכול לשמור הכל בגיטהאב?»)
- **Did:** branch `harei-zahav-naama` got a local commit, `67a9db2a`, with 641 code and text files; the 15 GB of media was left out. Pushed snapshot `904aa1d3` to github/main on top of `42fe44da`, which the Avnei Hefetz session had pushed minutes earlier. Nothing in that snapshot was removed.
- **How:** a 3-way `git merge-tree` of main, harei-zahav-naama and a75dca2d, with no checkout touched. Then a temporary index with the 1558 media files removed, plus the three untracked hatzav memory notes. Secret scan: 0 hits.
- **Learned:** when two sessions sync around the same time, the push is rejected as non-fast-forward. `fetch github` first and build on top of the newest snapshot; never force-push.
- **Owed / open:** local main is NOT merged. The C:\RnD checkout has about 830 dirty files from other sessions, so merging harei-zahav-naama into main waits for a clean checkout.
- **Second reader:** none
