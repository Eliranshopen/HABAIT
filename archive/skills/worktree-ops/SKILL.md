---
name: worktree-ops
description: "SUSPENDED 2026-11-03, no git (Eliran). Described git worktrees under C:/RnD/.wt; work now runs in plain working folders per root CLAUDE.md §8.7. Do not run any command in this skill."
user-invocable: true
disable-model-invocation: true
argument-hint: "create <name> [--branch <branch>] | verify [<name>] | retire <name>"
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent
model: inherit
---

# /worktree-ops — create, verify, retire; one way, and never a deletion

> ⛔ **SUSPENDED 2026-11-03 — no git** (Eliran: "I dont want any git you know. no git"). Run none of the commands below. Work runs in plain working folders under `C:\RnD\.wt\<name>` (root `CLAUDE.md` §8.7). The text is kept as history for the day a new git is configured.

**Taxonomy: group C · Harness ops** (`docs/skill-taxonomy.md` §2). Created 2026-08-27, board
`development/tasks/rnd-reorg/` T11, capability item **CP-17**, migration family **6E**.

**Explicit invocation only.** `disable-model-invocation: true` — only a typed `/worktree-ops` runs it. The
create path touches junctions and the retire path is one wrong flag away from wiping the app repo's
dependencies; neither is something a model should reach for on its own.

**The two trees this skill knows about:**

| | Path | Authority |
|---|---|---|
| Harness repo | `C:/RnD` (`git init` 2026-11-03, local only, no remote), base `main` | harness work: agents, skills, docs, boards, the project's text layer |
| Product repo | `C:/RnD/Projects/Habait/habait-walkaround` (its **own** git repo, ignored by the harness), base: see CREATE step 0 | product code — the harness never commits into it |
| Worktree home | `C:/RnD/.wt/` | ignored by the harness repo except `.wt/CLAUDE.md`; one flat folder per thing worked on (root §8.7) |

`<repo>` below is one of the two repo paths. Name the worktree after the board or task slug.

**Read first:** `docs/governance/WORKTREES.md` (the rules — ⛔ it holds **no** inventory table, by design;
run its commands instead) and `docs/governance/RETENTION.md` §1 (D11: no deletion, report-first).

---

## Mode: CREATE

0. **Pick the base: local `main` in both repos.** ⛔ **No old git (Eliran, 2026-11-03: "Dont use any git
   you familiar from before. if we need we will configure new git").** Never fetch, pull or push the
   product repo's old `origin` (`Slava12233/habait-walkaround`), never use the old GitHub login or the
   personal gmail. Once Eliran configures the new git (root §11), the remote-freshness check returns here:
   fetch the NEW remote, compare `origin/main...main`; only behind → `origin/main` · only ahead → `main` ·
   both → stop and report. Measured 2026-11-03: local `main` of the product repo is 2 commits ahead of
   the old `origin/main` — basing off that ref would drop work.
   ⛔ The old trap still holds when the remote is live: a main checkout parked on an old branch (168
   commits behind, 2026-08-27) is never a base.
```
git -C <repo> worktree add C:/RnD/.wt/<name> -b <name> <base>
```
**Register it the same minute** in `C:/RnD/docs/governance/worktrees.json` (main checkout, absolute path):
`purpose · repo · branch · base · deploy · record`. Check 16 fails on a worktree with no entry.

Then, in order:

1. ⭐ **Copy `.env.local` aside FIRST — before ANY Vercel command, `link` included.** Three proven
   destructions: `vercel blob create-store`, `vercel integration add neon`, `vercel link` (CLI 59 writes
   it too). Backups go to `C:/RnD/.wt/_env-backups/` on purpose — a `.bak` beside the original
   surfaces as an untracked file inside the worktree. ⚠ Those are plaintext files outside every repo
   (`docs/governance/SECRETS-LEDGER.md` §2): report the path and the count, never open one.
2. ⭐ **Only if `<repo>/node_modules` exists** (none on 2026-11-03 in either repo): the junction must be **SAME-VOLUME**. Verify both sides resolve to the same drive
   letter *before* creating it — a `C:` → `D:` junction broke webpack's absolute-path module resolution;
   the same junction on `D:` works.
   ```
   cmd /c mklink /J "C:\RnD\.wt\<name>\node_modules" "<repo, backslashed>\node_modules"
   cmd /c dir /AL "C:\RnD\.wt\<name>"     # confirm the reparse point exists
   ```
3. ⭐ **`next dev --webpack` inside a worktree** — Turbopack refuses a junctioned `node_modules`
   (*"symlink points out of the filesystem root"*). Tests via node/tsx follow junctions fine. ⚠ It did
   **not** reproduce once (2026-08-24) — plan around it as a likely failure, not a certainty.
4. ⚠ **`next build` is NOT covered by that fallback.** The junction panic applies to `next build` too and
   the webpack fallback is not equivalent there: a real production build needs a **REAL (non-junction)
   `node_modules`** and default Turbopack. Un-junction + `npm ci` in the ship worktree when you build.
5. ⛔ **Never `npm install` through the junction** while another session is working — the shared
   `node_modules` tracks whatever branch the **main checkout** sits on.
6. **Pinned identity check**, now, not at push time:
   ```
   git -C C:/RnD/.wt/<name> config user.email     # expect the identity in root CLAUDE.md §11; UNSET until Eliran configures the new git → no commit, report and stop
   ```
   ⭐ The **numeric id** matters, not just the `noreply.github.com` suffix — a wrong-number noreply makes
   Vercel silently refuse to build (status `UNKNOWN`, zero logs).
7. **Record the tree** in the round's task file or `memory/runs/` entry: worktree path, branch, base
   commit, and the env backup filename. Provenance is a `/ship` preflight item.

⚠ **Ports.** Name the dev port you chose and kill it **by PID** at the end. On a junctioned worktree a
child process's command line reports the **junction target**, so you cannot identify which tree a running
server serves from its command line (rule 9) — track the PID you spawned.
⚠ **Machine resource rules** (root `CLAUDE.md`; backed by the `test-guard` hook once it is installed per `.claude/hooks/README.md` — until then this line is the only rule): every test, build, server, browser or render command runs in Git Bash as `timeout N <cmd>` (tests 300 s, build/typecheck 540, servers/sweeps/renders 540 per chunk, 1800 once `BASH_MAX_TIMEOUT_MS` is raised) with the tool timeout above N; one heavy run at a time; foreground only; kill what you start by PID; never sleep-poll a backgrounded run — stop it, kill its tree, re-run bounded once.

---

## Mode: VERIFY

**Delegate the inventory to `workspace-steward`** (`.claude/agents/workspace-steward.md` — reporting-only
by construction; it may never delete, prune, `npm install` through a junction, or open `_env-backups/`).
It runs exactly the generating commands `WORKTREES.md` opens with — ⛔ never a hand-copied table:

```
git -C C:/RnD worktree list --porcelain                                  # harness repo
git -C C:/RnD/Projects/Habait/habait-walkaround worktree list --porcelain # product repo
ls C:/RnD/.wt                                # what is on disk (a SUPERSET)
git -C C:/RnD/.wt/<name> branch -vv          # branch + upstream for one entry
```

Classification per disk entry: **REGISTERED** · **ORPHAN SHELL** · **JUNCTION-BEARING** (R7 applies) ·
**NOT-A-WORKTREE** (`_env-backups` and anything without a `.git` file), each with `du -sh` and a
last-modified stamp. ⛔ The report goes into the task's scratchpad or the board task file — **never into
`WORKTREES.md`**, whose line-1 rule forbids an inventory table.

⚠ **Re-measure, never quote.** The study's figures (39 dirs vs 14 registered = 24 orphan shells, ~11 GB,
2026-08-27) are a **dated measurement**, not current state. Stamp every number with today's date and the
command that produced it.

Three checks worth running in the same pass:

- ⭐ **"Prod tip" has a shelf life of MINUTES on a multi-worktree clone.** Read `git log origin/main` for
  the tip; name the commit **your** work shipped as. A tip copied from a card was wrong within the hour.
- **Base freshness:** `git -C <wt> log --oneline HEAD..origin/main` — empty, or merge before you ship.
- ⭐ **Prove isolation, don't assume it:** `comm -12` of two concurrent rounds' changed-file lists must be
  **EMPTY** before either pushes. That check is why two rounds shipped the same day without a
  reconciliation.
- ⚠ **A dirty file is only live work if its content is NEWER than the ref your edit descends from.** Six
  uncommitted cards once looked like another session's in-flight work and were in fact *older* than
  `origin/main`, stranded by a branch switch. Compare stamps against `origin/main` before deciding to
  leave a file alone.

---

## Mode: RETIRE

### ⛔ R7 — quoted VERBATIM from `docs/governance/WORKTREES.md` rule 5; reproduce it unaltered in every prune proposal

> ⛔ **R7 — junction-safe removal.** A recursive delete follows the junction and wipes the **app repo's** installed dependencies. Order: `cmd /c rmdir "<dir>\node_modules"` (remove the reparse point) → assert the app's own `node_modules` still exists → then remove the shell. ⛔ **Never** `rm -rf` / `Remove-Item -Recurse` on the parent.

*(One line on purpose: byte-verbatim from `docs/governance/WORKTREES.md` rule 5 and from
`.claude/agents/workspace-steward.md`, so a grep for it matches all three. ⛔ Do not reflow it.)*

The three ordered steps, as commands Eliran runs (each one their, prefixed `!`):

```
cmd /c rmdir "C:\RnD\.wt\<name>\node_modules"                 # 1 — the JUNCTION only, never -Recurse
ls <repo>/node_modules | head                                   # 2 — ASSERT the repo's own deps survive (skip if it has none)
git -C <repo> worktree remove C:/RnD/.wt/<name>                # 3 — then, and only then, the shell
```

⛔ **Step 2 is not optional and its result is quoted in the report.** Skipping it is how a "cleanup"
becomes a reinstall of the live app repo's dependencies.

### ⛔ This skill never initiates a deletion

**Every prune is Eliran's explicit act** (decision **D11**, report-first). The skill **prepares** the list
and stops; the default is that **Eliran runs the commands**. The single exception is narrow and must be
visible: a removal step may run only when **Eliran's own authorizing line is quoted verbatim in the run,
naming that path** — no inference from "clean it up", no carry-over from an earlier round's approval, no
blanket go. Absent that quote, the skill hands the commands over and stops.

⭐ A delete-shaped compound command trips the auto-mode safety classifier **by design** — never split it
to sneak past, never disguise the wording, never hand a deletion to another worker, and **never route
around a genuine block**: give it to Eliran with a `!` prefix and stop.

⛔ `workspace-steward` may never be asked to do any of this: it is reporting-only by construction and its
own prompt bans every deletion verb.

### The prune proposal — one block per candidate

path · class · size · branch + upstream · last commit date · commits not on `origin/main`
(`git log origin/main..<branch> --oneline | wc -l`) · modified in the last 7 days? · **the citation
check** —

```
grep -rn "<path>" C:/RnD/memory/runs/ C:/RnD/development/tasks/ C:/RnD/docs/governance/
```

— any hit means **KEEP**, and say why. Verdict vocabulary: **KEEP / CANDIDATE / ASK** — never "delete".
Close every proposal with: **"No action taken. Every removal is Eliran's own command."**

⚠ Two measured reasons the list is never self-evident: at least one "orphan" (`buyer-playbook`) was in
active use as recently as **2026-08-26**, and twelve of the "empty" shells held junctions resolving into
the live app repo.

### ⛔ Branch removal

**Never propose deleting a branch on "merged into `origin/main`" alone.** That criterion includes `main`
itself and every branch checked out in a worktree, and executing it destroys uncommitted work. The honest
criterion is *merged **AND** not checked out anywhere **AND** not the default branch **AND** verified at
content level*. It is app-repo scope in any case, outside the harness's git authority — you report, you
do not decide. The standing example is `WORKTREES.md` **W-3**: branch `buyer-grad` / commit `6ecfe9d`,
proven at content level **not** to be on `origin/main`.

---

## Registers this skill writes

| Register | What this skill writes | If absent |
|---|---|---|
| `docs/governance/WORKTREES.md` | **rules only** — a new row (with the run entry that earned it) when a round earns one, and the `As-of` re-stamp. ⛔ Never an inventory table (its line-1 rule) | `SKIP`, reported |
| the task scratchpad / board task file | the generated inventory and any prune proposal | n/a — always writable |
| `memory/runs/<date>-<slug>.md` + `memory/INDEX.md` | a create or retire round's record (≤400-char INDEX line) | `SKIP`, reported |

```
SKIP (worktree rules): docs/governance/WORKTREES.md not present — rule not recorded, the operation still stands
SKIP (memory):         memory/runs/ not present
```

⛔ **This skill never writes** `docs/governance/SECRETS-LEDGER.md`. A new `_env-backups/` entry, or any
plaintext env copy discovered in a tree, is **reported to `secrets-steward`** by path and date — never
opened, never enumerated by content (that ledger's §2 rule; its fate is S-2, Eliran's).

---

## Rules

1. **Explicit invocation only.** Never auto-run; never chained from another skill.
2. **⛔ Never initiate a deletion** — not a directory, not a junction, not a worktree registration, not a
   branch. Prepare, report, stop. A removal runs only behind Eliran's own authorizing line, quoted
   verbatim and naming the path.
3. **R7 verbatim in every prune proposal**, with the "assert the app's own `node_modules` survives" step
   quoted **and its result** shown.
4. **Same-volume junction; `next dev --webpack` in a worktree; a REAL `node_modules` for `next build`;
   never `npm install` through the junction.**
5. **Copy `.env.local` aside before ANY Vercel command, `link` included** — and never open a backup.
6. **Measure the app repo with `git -C <path> …` / `git ls-tree -r origin/main`, never `find`** over a
   parked checkout (rule 7). ⛔ Never bare `git` from the harness root for an app-repo hash — different
   repository; it fatals.
7. **Every number is stamped with the day it was measured and the command that produced it.** Quoting a
   prior pass's count as current is the failure this whole register exists to prevent.
8. **Close with:** the mode run, the paths touched, the checks that passed, the exact commands left for
   Eliran, and the memory entry + INDEX line.

---

**Provenance** — Created 2026-08-27 · Author: habait-agent-smith, board `development/tasks/rnd-reorg/`
task **T11** · Capability item **CP-17** · Migration family **6E** · Authority: inherited decision **D11** (now Eliran's)
(no deletion, report-first) · Register kept alive: `docs/governance/WORKTREES.md` · Agent it delegates the
inventory to: `.claude/agents/workspace-steward.md` (reporting-only) · Companions: `/ship`,
`/rotate-secrets`.
