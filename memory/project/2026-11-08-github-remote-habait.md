
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

## 2026-11-19 · main session (Day/Night skill session) · sync on his word («אתה יכול לשמור הכל בגיטהאב?»)
- **Did:** pushed 07fb102 to Eliranshopen/HABAIT main: the WHOLE C:\RnD working tree (incl. uncommitted work of every session) layered on 904aa1d, adds and updates only, nothing removed. Left out: 1905 media files, 1 log > 5 MB, every .env. Local main, local index and .wt untouched (built in a temp GIT_INDEX_FILE).
- **Learned:** another session had synced twice the same morning (42fe44d, 904aa1d, incl. `out/harei-zahav-naama` and the Avnei Hefetz worktree); a plain working-tree snapshot would have deleted 1039 of their files on the mirror, so build on the remote tip with `read-tree <tip>` + `update-index --add --stdin` (LF-only path list: Windows CRLF lines are silently "Ignoring path"). Secret scan: 3 pattern hits, all fake test values or a public page's api-key attribute already published.
- **Second reader:** `habait-deploy-qa`

## 2026-11-19 · main session · sync: Avnei Hefetz Kedem project added (Eliran «אתה יכול לשמור הכל בגיטהאב?» → dialog «קוד וטקסט בלבד»)
- Local: branch avnei-hefetz-kedem-5 commit 494612f4 = 270 code/text files of out/avnei-hefetz-kedem (media left out: 1,800+ jpg/png/exr/glb/blend/pdf…). Secret scan: 0 real hits (only task slugs «task-NN-…» and planted test fakes).
- Remote: github/main had moved to 07fb102b (another session's same-day snapshot, «adds and updates only, nothing removed»). Layered on it the same way: tree = 07fb102b + the 270 files, 270 A / 0 D / 0 media → commit 2a8e190c pushed (07fb102b..2a8e190c). Lesson: build every snapshot on the CURRENT remote head's tree, never from local main (a main-based tree showed 459k deletions against 07fb102b).
- Second reader: none.

## 2026-11-19 · main session (3dengine) · HABAIT layer 7b1ea0d3: the close of engine milestone 1.4 (main 6a384927 to 5c40ee13) on top of 2a8e190c
- **Did:** Eliran asked this session too (his words: can you save everything to GitHub). A main-based snapshot (6f0f6516 on 444c5b2) was REJECTED as not fast-forward: three other sessions had pushed layered snapshots that morning (904aa1d3, 07fb102b = the whole working tree, 2a8e190c). Nothing was forced. Built a layer on the mirror head 2a8e190c: 110 files (80 added: the third review's report and evidence; 23 taken from main; 7 shared record files as they stand in the working tree, after checking that each holds every line the mirror had except lines the close itself replaced). 13 files of the close were there already (the working-tree snapshot had caught the close in the middle). Pushed 2a8e190c..7b1ea0d3; the tree went from 6763 to 6843 files, nothing removed, no media. Secret scan: the whole of main at 5c40ee13 (5348 non-media files, 20 patterns) and the 110 files of the layer: 0 real hits. Local main and its working tree untouched.
- **Evidence:** `.git/config` (remote `github`; `git ls-remote github` answers 7b1ea0d3) · `development/tasks/3dengine/logs/1.4/gate-summary.txt`
- **Learned:** The mirror is written by several sessions on the same morning: ls-remote first, fetch the head, and build on ITS tree; a snapshot of local main alone would have removed 1533 files other sessions had put there. A working-tree snapshot stores CRLF where git stores LF, so compare files with line endings folded before calling them different (12 of 18 seeming conflicts were the same text). For a shared record file take the working file only after checking it is a superset of the mirror's lines. A scan pattern sk- needs a boundary before it: task-07-m1-4... matched 91 times.
- **Owed / open:** None for this session. Not on the mirror by rule: media (1520 files of main), env files, ignored folders. The branch blender-walk (8 commits, 2026-11-12) is in no snapshot: Eliran's call.
- **Second reader:** none
