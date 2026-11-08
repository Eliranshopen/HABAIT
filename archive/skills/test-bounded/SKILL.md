---
name: test-bounded
description: "Run the app's tests inside the Machine resource rules: DB preflight, then the changed-files runner or one capped leg, always as timeout 300, and rule 2 verbatim on exit 124."
user-invocable: true
disable-model-invocation: true
argument-hint: "[<app-worktree-path>] [--leg leg1|leg2|leg3]"
allowed-tools: Bash, Read, Grep
model: inherit
---

# /test-bounded — the only sanctioned way to run this app's tests

> ⛔ **Git steps suspended 2026-11-03 — no git** (Eliran: "I dont want any git you know. no git"). Every step below that runs git — a worktree, branch, commit, merge, tag, fetch, push, pinned identity or `origin/main` comparison — does not run: report it as `SUSPENDED (no git)` and carry on with the rest. Working folders are plain copies under `C:\RnD\.wt\<name>` (root `CLAUDE.md` §8.7). The product is `Projects/Habait/habait-walkaround/`, not `Habait/MVP/app` (OWED-009).

**Taxonomy: group C · Harness ops.** Created 2026-09-08 — harness upgrade plan
(`docs/harness-upgrade-plan.md`), wave 4 (SKL-4 amended; filed in the wave 6 skills pass). **Explicit
invocation only** — `disable-model-invocation: true`, so no model auto-selects it. The failure it exists
to prevent is not a red suite; it is an **unbounded** suite: since 2026-08-06 this
32 GB laptop logged 111 low-memory events and 6 hard freezes, every one a node test worker running with
no time bound (45–94 GB). The **Machine resource rules** (`C:/Users/elira/.claude/CLAUDE.md`, backed by
the `test-guard` PreToolUse hook once it is installed — UNINSTALLED today, see `.claude/hooks/README.md`) are the fixed constraint here; this skill is their runnable shape and
⛔ never relaxes them.

---

## Step 0 — orient (name the worktree before running anything)

State in one line each: **which app worktree** (`$1`, else the dev-loop worktree
`C:/RnD/.wt/dev-loop`), **which branch**, **which leg or diff**. Then `cd` there — every command
below runs from the app worktree, not the harness root (two repos, two authorities).

⛔ **Never `npm install` through a worktree whose `node_modules` is a junction** to the main checkout.
⛔ **One heavy run at a time on this machine** (rule 3): if another test, build, sweep or render is
running, stop and say so — do not start a second.

---

## Step 1 — preflight the database

```
node scripts/db-preflight.mjs
```

A 500 ms TCP probe of Postgres on `127.0.0.1:55432`.

- **exit 0** → continue to step 2.
- **exit 2** → Postgres is down. Print the ONE line the script itself prints (it names the fix) and
  **stop**, unless the leg you were asked for is DB-free — say which it is and why it needs no database.
- ⛔ Never work around a down database by skipping tests silently or by editing the leg strings.

---

## Step 2 — run it bounded

`timeout N` is the **first word** of the command, in Git Bash, and the Bash tool call gets a timeout of
**360000 ms** so the kill lands inside the call and the harness never backgrounds it.

**Default — only what changed:**

```
timeout 300 node scripts/test-changed.mjs
```

Changed files versus the merge-base with `origin/main` → their colocated and same-directory tests. On a
high-fan-in change (`lib/db.ts`, `lib/auth/**`, `lib/dev-one/**`, `migrations/**`,
`lib/landing/routes.ts`) it falls back to the whole leg and says so.

**With `--leg`, one capped leg:** `timeout 300 node scripts/run-leg.mjs <leg> --test-concurrency=8`

- ⛔ **Foreground only** (rule 4): no `run_in_background`, no `&`.
- ⛔ **No heap flags** (rule 6): `--max-old-space-size` does not bound this — the growth was
  ArrayBuffers. The timeout is the bound. ⛔ Never raise `--test-concurrency` above 8 here.

---

## Step 3 — if it exits 124

Machine resource rule 2, verbatim:

> **Exit 124 is the bound, not a red suite.** Report the tail, kill any leftover node.exe from your run
> (`taskkill /PID <pid> /T /F`), then run ONCE more with fewer paths and report the count as partial.
> Never re-run an unchanged command hoping for another result; never loop a suite. A mutation proof is
> one bounded call per mutation.

Kill by **PID from your own run** — ⛔ never kill listeners on 5173/8791 (the parked 3D track).

---

## Step 4 — report

1. **pass / fail / partial counts** as `N/N`, not "green"; a pre-existing failure class named as such.
2. **Which files matched no test** — `test-changed.mjs` reports them; an unreported gap reads as coverage.
3. **The exact command that produced each number**, timeout included. ⭐ A number without its command
   does not go in the report at all.
4. **Whether the run was bounded, partial (124), or blocked at step 1** — and any PID you killed.

---

**Provenance** — 2026-09-08 · harness upgrade plan, wave 4 (SKL-4), wave 6 pass · Constraint it implements:
the **Machine resource rules** · Scripts it calls: `scripts/db-preflight.mjs`,
`scripts/test-changed.mjs`, `scripts/run-leg.mjs` (wave 4, app repo) · ⛔ It never edits a leg string,
never installs a hook, and never commits.
