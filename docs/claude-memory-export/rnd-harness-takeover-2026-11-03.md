---
name: rnd-harness-takeover-2026-11-03
description: "State of the C:\\RnD harness after the 2026-11-03 re-attribution — what exists, what is placeholder, where the open debts are"
metadata:
  node_type: memory
  type: project
  originSessionId: e5bf0208-2877-45e3-b518-1b0dce9b1a8c
  modified: 2026-11-08T10:15:00.380Z
---

On 2026-11-03 the harness in `C:\RnD` was re-attributed from the previous CTO to Eliran Shopen. Only `.claude/` existed; the product repo tree the agents reference (`Habait/MVP/app`, `video/`, `3D/`, `listings/`, `.wt/`, hooks) was never transferred and does not exist yet — the agents' paths were deliberately kept so the layout is decided.

What exists now: root `CLAUDE.md` (sections §0–§12 numbered to match what the agents cite), `docs/INHERITED-DECISIONS.md`, `docs/agent-team-org-chart.md` and `docs/skill-taxonomy.md` (generated from frontmatter), `docs/OWNER-PASTE.md`, `docs/governance/{README,SECRETS-LEDGER,WORKTREES,SHIP-LEDGER,OWED}.md`, and a `memory/` scaffold.

Placeholders in root `CLAUDE.md` §11: the git rows (identity, harness/app/walkaround repos) are "none — no git" since Eliran's no-git ruling of 2026-11-03; MCP servers and hooks are still unset. Open debts and Eliran's pending rulings: `docs/governance/OWED.md`, current-state line under its title (OWED-001…021 at the end of 2026-11-03).

A backup of the pre-edit `.claude/` is a tarball in the session scratchpad (temporary); the originals also still exist in the CTO's repos.

**How to apply:** before recommending `/ship`, `/worktree-ops`, `/run-eval` or `/close-board`, remember their push/remote steps are suspended (local git only since 2026-11-04, no remote); they need the product folder re-pointed (OWED-009) before the rest can run. Heredocs with long multi-file content failed in this environment's Bash tool; write content files with Write or a Python scaffold script instead.

**2026-11-03 later:** the real Habait product is at `C:\Habait` (33 GB lab workspace, not a git repo; `habait-walkaround` inside it is the repo, dirty by design, remote still Slava12233). A plan + 9-card board to copy it into `C:\RnD\Projects\Habait` is filed (`development/plans/2026-11-03-copy-habait-to-projects.md`); nothing copied until Eliran answers task 02's five questions. `C:\Habait` is read-only to agents; another Claude session (`habait-da`) works there.

**2026-11-03 13:05:** the copy is DONE and verified: `C:\RnD\Projects\Habait` (30.4 GB, 5/5 checks, paths re-pointed, venv rebuilt, Blender + Node OK; 2 engine tests fail in both copies, pre-existing). Only cut-over (task 09) is open — on Eliran's word: re-sync, re-verify, Eliran renames `C:\Habait` to an archive. Habait sessions start from `C:\RnD\Projects\Habait` (Q5).

**2026-11-03 cut-over DONE:** `C:\Habait` renamed to `C:\Habait-archive-2026-11-03`; `C:\RnD\Projects\Habait` is the only live copy; Habait sessions start from there. Lessons: robocopy re-sync needs `/XO`; a Windows folder lock is usually a process cwd (find with psutil); orphan `python -m http.server` processes outlive sessions.


**2026-11-03 end of day:** a five-reviewer cleanup fixed ~124 contradictions (git text, counts, dead paths, "card" → "context file"); what is left needs Eliran (OWED-014…021). See [[user-eliran-head-of-rnd]] and [[rule-worktree-for-every-new-thing]].

**2026-11-04 correction:** the "no git" lines above are superseded. Git is back, local, on `main` (Eliran: "please install git, i want to be on the main branch"), with a repo-local identity `Eliran Shopen <eliran@habait.ai>` (root §11). There is no remote. Later the same day: a new feature is a git worktree under `.wt\`, and ONE repo (`C:\RnD` tracks `Projects/Habait` since `de560da`) — see [[rule-worktree-for-every-new-thing]]. `/close-board` and `/plan-to-tasks` commit locally; Check 16 and the push/remote steps of `/ship` wait. See [[user-eliran-head-of-rnd]].

**2026-11-08 correction:** "there is no remote" is superseded for one remote only: `github` → `Eliranshopen/HABAIT` (public, his gmail account), media-free no-history snapshot commits on his word (root §11, repo `memory/project/2026-11-08-github-remote-habait.md`). It is a mirror, not the `<app-repo>` row: `/ship`'s push/remote steps and Check 17 still wait.
