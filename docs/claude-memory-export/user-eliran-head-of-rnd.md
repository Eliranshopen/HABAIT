---
name: user-eliran-head-of-rnd
description: "Who the user is — Eliran Shopen, head of the new Habait R&D department, sole authority over the C:\\RnD harness; local git on main since 2026-11-04 (repo-local identity eliran@habait.ai); since 2026-11-08 one remote: public Eliranshopen/HABAIT (his gmail GitHub account), media-free snapshots on his word"
metadata:
  node_type: memory
  type: user
  originSessionId: e5bf0208-2877-45e3-b518-1b0dce9b1a8c
  modified: 2026-11-08T10:15:07.173Z
---

The user is **Eliran Shopen**, founder/head of R&D at Habait (office@habait.ai, Windows user `elira`, GitHub login Eliranshopen). On 2026-11-03 they took over the Claude Code harness (28 sub-agents, 50 skills) built by their previous CTO and started the department from zero in `C:\RnD`.

Decisions they gave on 2026-11-03:
- Fresh start in C:\RnD; keep every agent and skill file (never delete them), only scrub the CTO's name and make Eliran the authority.
- Inherited rulings live once in `docs/INHERITED-DECISIONS.md`; prompts cite that file.
- **Git is back, local, branch `main` (Eliran, 2026-11-04: "please install git, i want to be on the main branch").** Replaces the 2026-11-03 "no git". ONE repo = C:\RnD, `Projects/Habait` included since commit `de560da` (Eliran: "יש רק מאגר Git אחד"); `.gitignore` keeps out .env*, .wt/*, Projects/Habait/tools/ and media. Identity `Eliran Shopen <eliran@habait.ai>` is set repo-local (2026-11-04). Remote, push and GitHub login (`gh` is logged in as an old account: never use it) are NOT set up and stay their call; A new feature is a git worktree `.wt\<feature>` off `C:\RnD`'s `main` (Eliran, 2026-11-04, correcting a misread; see [[rule-worktree-for-every-new-thing]]); the product's old `.git` is archived at `C:\Habait-git-archive-2026-11-04`; never push. Never the personal gmail.
- They write in Hebrew sometimes; the harness convention is English toward the operator, Hebrew-first product.

- **2026-11-08 change:** Eliran confirmed GitHub login `Eliranshopen` IS his <his gmail address> account and ruled an upload of the whole project without media → repo `Eliranshopen/HABAIT` (remote `github`), media-free no-history snapshot commits only. Created private; Eliran set it **PUBLIC** himself the same day ("בסדר שהוא PUBLIC אני הגדרתי אותו ככה") — so every future sync is a public publish: secret-scan before each push. The old "never use gh / never the gmail / never push" applies everywhere else; each sync to HABAIT needs his word.

**How to apply:** treat Eliran as the one who gives every go, pays, deletes and installs. Local git commands on C:\RnD are allowed (identity `Eliran Shopen <eliran@habait.ai>` set repo-local on their word 2026-11-04); no remote or push without their word; a new feature runs in a git worktree under `.wt\` (root `CLAUDE.md` §8.7). See [[rnd-harness-takeover-2026-11-03]] and [[rule-worktree-for-every-new-thing]].
