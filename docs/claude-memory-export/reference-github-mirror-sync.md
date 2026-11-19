---
name: reference-github-mirror-sync
description: "How to sync C:\\RnD to the public GitHub mirror Eliranshopen/HABAIT when Eliran asks («אתה יכול לשמור הכל בגיטהאב?»): layered, media-free, on the remote head's tree, never forced"
metadata:
  node_type: memory
  type: reference
  originSessionId: 40c3c5f2-e1ea-4dd3-baf1-ad71447227fd
  modified: 2026-11-19T08:12:03.543Z
---

**The mirror:** remote `github` → `https://github.com/Eliranshopen/HABAIT.git`, PUBLIC by Eliran's choice. Local `main` is never pushed; the mirror gets snapshot commits only, each sync on his word (root CLAUDE.md §11, [[user-eliran-head-of-rnd]]). His words «אתה יכול לשמור הכל בגיטהאב?» (2026-11-19) ARE the word for a sync; another session asked him what «הכל» covers and got «קוד וטקסט בלבד» (code and text only): media stays out.

**He asks several sessions the same morning.** On 2026-11-19 three other sessions had pushed before mine, and my main-only snapshot was rejected as not fast-forward. So, every time:
1. `git -c credential.helper='!gh auth git-credential' ls-remote github`, then `fetch github main`. Never force.
2. Build on the REMOTE HEAD's tree, as a layer: adds and updates only, nothing removed (a tree made from local main alone would have deleted 1533 files other sessions had put there). Temp index: `GIT_INDEX_FILE=<tmp> git read-tree <remote head>`, `update-index --add -z --index-info`, `write-tree`, `commit-tree -p <remote head>`; push `<commit>:refs/heads/main`. No working tree, index or branch of C:\RnD is touched.
3. Bring only what my session owns: the paths main changed between the main commit the mirror already holds and now. Media out (png webp jpg gif exr hdr mp4 mov mp3 m4a wav glb fbx blend pdf zip tgz …), env files out.
4. A file the mirror holds in another version may be the same text with CRLF (a working-tree snapshot stores CRLF, git stores LF): fold line endings before calling it different. For a shared record file (memory/INDEX.md, HOT.md, plans/CLAUDE.md, Projects/CLAUDE.md, context-map) take the WORKING file, and only after checking it holds every line the mirror has except lines I replaced myself.
5. Secret scan before the push, values never printed (about 20 patterns; put a boundary before `sk-`, or `task-07-…` matches). Known harmless hits: planted fake keys in tests and reviewers' scripts, `PropertiesService…getProperty('LEAD_SECRET')`, a public widget key inside a saved third-party page that has been on the mirror since 2026-11-08.
6. Record it: one entry in `memory/project/2026-11-08-github-remote-habait.md` (+ INDEX line), own lines staged only.

My scripts of 2026-11-19 (scratchpad, may be gone): `snapshot_scan.py`, `snapshot_layer2.py`; the method above is enough to rewrite them.
