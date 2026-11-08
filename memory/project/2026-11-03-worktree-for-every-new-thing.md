## 2026-11-03 · main session · Eliran's ruling: a git worktree for every new thing, under `C:\RnD\.wt`
- **Did:** recorded the ruling as root `CLAUDE.md` §8.7 and `docs/governance/WORKTREES.md` rule 8 — every new piece of work (board, task, fix, experiment) runs in its own worktree `C:\RnD\.wt\<name>`, created by `/worktree-ops create <name>` off the repo the work belongs to, registered on creation; the main checkout stays on the trunk; close = archive tag + push (R-ORG-2), removal = Eliran's act (D11). Updated the §1 `.wt/` row (folder exists, empty since 2026-11-03).
- **Evidence:** root `CLAUDE.md` §8.7 and §1 `.wt/` row; `docs/governance/WORKTREES.md` rule 8; `ls C:/RnD/.wt` (empty).
- **Learned:** neither `C:\RnD` nor `Projects/Habait` is a git repo (`git rev-parse` fails in both), so the rule cannot be executed yet — `git init` plus the pinned identity (root §11) are Eliran's acts and the prerequisite. `/worktree-ops` still targets `Habait/MVP/app` (OWED-009 territory).
- **Owed / open:** Eliran — initialise the harness repo (and decide whether `Projects/Habait` is its own repo), set the §11 identity, add `.wt/` to `.gitignore`; then `/worktree-ops` needs its repo paths re-pointed (fold into OWED-009). Until then every new task starts by reporting the gap and asking Eliran for the go to work in the main checkout.
- **Second reader:** `workspace-steward` (keeps `WORKTREES.md` and the `.wt/` inventory) · `orchestrator` (must open a worktree before routing any board).

## 2026-11-03 · main session · correction: the rule is live, no longer blocked
- **Did:** the "blocked until git exists" line above is superseded: the harness repo exists (`e6c2596`), the first worktree ran end to end, root §8.7 now carries open → register → close (rebase, `--ff-only`, `archive/<name>`) → removal-is-Eliran's, and memory/register rows are written in the main checkout by absolute path.
- **Evidence:** root `CLAUDE.md` §8.7; `memory/runs/2026-11-03-worktree-rule-live.md`; check 16 PASS.
- **Learned:** two repos feed `.wt/`: the harness `C:\RnD` (base `main`) and the product `Projects/Habait/habait-walkaround` (base picked by `/worktree-ops` step 0; local `main` while its origin is unreachable).
- **Owed / open:** OWED-010, OWED-011 (Eliran).
- **Second reader:** `workspace-steward` · `orchestrator`.

## 2026-11-03 · main session · superseded: no git
- **Did:** the git-worktree form of this rule is superseded by Eliran's "I dont want any git you know. no git"; the rule continues as plain working folders under `C:\RnD\.wt\<name>` → `project/2026-11-03-no-git.md`.
- **Evidence:** root `CLAUDE.md` §8.7.
- **Learned:** nothing new.
- **Owed / open:** OWED-012.
- **Second reader:** none.

## 2026-11-03 · main session · Eliran's ruling: one folder per board or task, not per fix; `.wt` hidden in VS Code
- **Did:** after `.wt` grew a sibling folder for every small fix (`cleanup-2026-11-03-checks`, `-generator`, `-size`, `-skillsmap`), Eliran chose option A: every board, task or experiment gets ONE working folder; a fix or follow-up inside the same task adds an entry (its own `sha256_at_open`, then the close step) to that task's manifest, never a new sibling. `.vscode/settings.json` at the root hides `.wt` and `.git` from the Explorer, search and quick-open and sets `git.enabled: false`.
- **Evidence:** root `CLAUDE.md` §8.7 (the "One folder per task, not per fix" and "Hidden in VS Code" lines); `.wt/CLAUDE.md` (Follow-up step); `.vscode/settings.json`; `.wt/one-folder-per-task/manifest.json`.
- **Learned:** the per-fix siblings, not the rule itself, made `.wt` unreadable.
- **Owed / open:** OWED-012 (unchanged).
- **Second reader:** `orchestrator` · `workspace-steward` → `runs/2026-11-03-one-folder-per-task.md`.

## 2026-11-03 · main session · correction: `.wt` shows in the VS Code Explorer again
- **Did:** Eliran, seeing the Explorer without it: "I want the WT folder under the main folder". `.vscode/settings.json` no longer hides `.wt`; it stays out of VS Code's search and quick-open (`search.exclude`), `.git` stays hidden, `git.enabled: false` stays. The "hidden in VS Code" half of the entry above is superseded; the one-folder-per-task half stands.
- **Evidence:** `.vscode/settings.json`; root `CLAUDE.md` §8.7 ("VS Code" line); `.wt/one-folder-per-task/manifest.json` round 2.
- **Learned:** Eliran wants to see the working folders in the tree; hiding a folder from him reads as losing it.
- **Owed / open:** none.
- **Second reader:** `workspace-steward` · `orchestrator`.

## 2026-11-03 · main session · Eliran's ruling: a working folder only for a new task he opens, not for every action
- **Did:** Eliran (Hebrew, verbatim): "תסביר פה שאני לא צריך WT לכל פעולה שקורית אלא רק למשימות חדשות שאני פותח לביצוע תחת הפרויקט". Root §8.7 now says a `.wt\<name>` is opened only when Eliran opens a new task for execution under a project (a board, or work he names and hands over). Questions, reviews, small edits he asks for, context-file/harness-doc updates and `/sync-context` go straight into the live files. One-folder-per-task-not-per-fix stands inside a task. This ruling's own edits were made in place, with no working folder.
- **Evidence:** root `CLAUDE.md` §8.7 (first two lines), §1 `.wt/` row, Context map `.wt/` row; `.wt/CLAUDE.md` "What's here"; `.claude/CLAUDE.md` gotchas; `memory/HOT.md`.
- **Learned:** "every new thing" was read too broadly; the folder is for an executed task, not for maintenance or a single action. When unsure, ask him.
- **Owed / open:** `docs/governance/WORKTREES.md` item 8 still says "every … fix" but the register is frozen git-era history; left untouched.
- **Second reader:** `orchestrator` · `workspace-steward` (pointer lines added).

## 2026-11-03 · main session · narrowed again: working folders only for project changes
- **Did:** Eliran: "i dont need wt for code only wt for changes or updates i do for the peoject". Root §8.7: a `.wt\<name>` only for a change or update Eliran opens on a project under `Projects\`; harness work (root `CLAUDE.md`, `.claude/`, `docs/`, scripts, context files, `/sync-context`), questions and reviews go straight into the live files. Supersedes the "new task" wording of the entry above.
- **Evidence:** root `CLAUDE.md` §8.7 lines 1–2; `.wt/CLAUDE.md`; `.claude/CLAUDE.md`; `memory/HOT.md`; `runs/2026-11-03-wt-cleared.md`.
- **Learned:** Eliran's "project" means the product (`Projects\Habait`), not the harness.
- **Owed / open:** none.
- **Second reader:** `orchestrator` · `workspace-steward`.
