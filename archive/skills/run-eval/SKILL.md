---
name: run-eval
description: "One budget-capped entry point for every model evaluation in the Habait app repo — buyer, golden, dashboard, dev. Explicit invocation only; every path spends real OpenRouter money against a shared balance. State the ceiling before spending anything; secrets by name only."
user-invocable: true
disable-model-invocation: true
argument-hint: "buyer | golden | dashboard | dev [--budget <usd>] [--runs N] [--locale he|en|fr] [--selftest]"
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent
model: inherit
---

# /run-eval — say what you are about to spend, before you spend it

> ⛔ **Git steps suspended 2026-11-03 — no git** (Eliran: "I dont want any git you know. no git"). Every step below that runs git — a worktree, branch, commit, merge, tag, fetch, push, pinned identity or `origin/main` comparison — does not run: report it as `SUSPENDED (no git)` and carry on with the rest. Working folders are plain copies under `C:\RnD\.wt\<name>` (root `CLAUDE.md` §8.7). The product is `Projects/Habait/habait-walkaround/`, not `Habait/MVP/app` (OWED-009).

One budget-capped entry point for every model evaluation in the Habait app repo, wrapping the four eval
scripts as they exist today: `eval-buyer.mjs` (`--agent` REQUIRED, budget wall), `eval-golden.mjs` (NEVER
bare — a bare run is the full multi-model matrix that once drained the balance to minus $0.13),
`eval-dashboard.mjs` (refuses to run without `--models`, `--runs` and `--budget`) and `eval-dev.mjs`
(`--agent` REQUIRED). Always run from the current app worktree tracking `origin/main`, never the parked main
checkout; state the ceiling before spending anything and prefer the zero-spend self-test first; then record
the measured result in `memory/runs`, and a dated EVENT row in `MODEL-PINS.md` only when a pin actually
changed. Names only, never values — an eval reads `.env.local` to log in and must never echo what it read.
*(This paragraph carried the detail that used to sit in the frontmatter description; moved 2026-09-08 —
harness upgrade plan `docs/harness-upgrade-plan.md`, wave 6.)*

**Taxonomy: group C · Harness ops** (`docs/skill-taxonomy.md` §2). Created 2026-08-27, board
`development/tasks/rnd-reorg/` T20, capability item **CP-18**, under ruling **CP-10**.

**Explicit invocation only.** `disable-model-invocation: true` — no model auto-selects this skill; only a
typed `/run-eval` runs it. Every path below spends real OpenRouter money against a shared balance.

## ⚖ The CP-10 ruling, recorded here so it is not re-litigated

**The eval-runner stays a SKILL. There is no `eval-runner` agent and none is needed today.** The plan's
own words: *"the case for a separate role is the weakest in the set."* The discipline is already
contract-grade **inside individual boards** — `development/tasks/habait-dashboard/run-tasks.md:41` and
five sibling board files re-type the flag law verbatim — so **the gap was centralization, not absence**,
and a skill centralizes it without adding a definition that would need its own memory, charter and
routing. ⇒ **Revisit only if a standing eval cadence emerges** (a scheduled pre-deploy matrix, or evals
becoming an owned recurring job rather than a per-round act). Until then, the pins' authority stays in
the app repo and this skill files the records harness-side.

---

## Why this exists (the incident, in one paragraph)

Root `CLAUDE.md` §9, 2026-07-10, verbatim:

> **eval-golden.mjs run bare = full multi-model matrix (≈$2.5)** — always pass `--models/--runs/--budget` (it once drained the balance to −$0.13 mid-ship; topped up, gate re-run PASS, ≈$9.8 left)

*(⛔ Do not reflow that line — it is byte-verbatim from root `CLAUDE.md` §9 so a grep for it matches.)*

The primary record is `memory/runs/2026-07-10-habait-funnel-ship.md`, which is blunter about the cause:
*"⚠️ INCIDENT (orchestrator's error, not an agent's): the ship eval was invoked as
`eval-golden.mjs --base=<prod>` with NO narrowing flags."* It also carries the subtler damage — the
degraded rows measured **during credit starvation** looked like a model regression and were not one.
⭐ **A budget exhaustion does not fail loudly; it fails as bad data.**

The second standing rail, root `CLAUDE.md` §9, 2026-07-13, verbatim:

> Standing: eval-buyer.mjs requires `--agent` + $0.50 wall

---

## ⛔ HARD STOP — the flag law, and the one script that does NOT enforce it

**Measured 2026-08-27 against `origin/main`** (`git -C <worktree> ls-tree --name-only origin/main scripts/`
then `git … show origin/main:scripts/<file>`; read-only, nothing executed):

| Script | Refuses a bare run? | Required | `--budget` default | Notes |
|---|---|---|---|---|
| `scripts/eval-buyer.mjs` | ✅ **YES** — `REFUSED: eval-buyer.mjs requires --agent (main \| all).` | `--agent` | **0.50** (`--runs` default 1) | wall is **PREDICTIVE** since T15: stops *before* a beat it may not afford, reserving the priciest beat seen so far (min $0.10) ⇒ a `--budget` under $0.10 grades nothing, by design. Has **`--selftest`** = zero spend |
| `scripts/eval-dashboard.mjs` | ✅ **YES** — `REFUSED: eval-dashboard.mjs requires --models, --runs, --budget.` | `--models`, `--runs`, `--budget` | none — must be passed | pinned-model copilot eval |
| `scripts/eval-dev.mjs` | ✅ **YES** — `--agent` is REQUIRED | `--agent` (`marketing\|video\|leads\|research\|all`) | **0.50** (`--runs` default 1) | **no full-matrix mode at all**, by design |
| `scripts/eval-golden.mjs` | ⛔ **NO — NOTHING STOPS YOU** | *(nothing)* | **5.00** | its own header documents `node scripts/eval-golden.mjs   # full matrix (default×10 + 3×5)` as usage line 1 |

⭐⭐ **The measurement that matters most, and it contradicts the comfortable assumption:** grep for
`REFUSED` or an argument-guard `process.exit(1)` in `eval-golden.mjs` returns **nothing**. The three
scripts that enforce the flag law were all written *after* the incident and cite it in their own headers;
**the script that caused it was never retrofitted.** Worse, its `--budget` **defaults to $5.00** — higher
than the ~$2.47 balance the bare run drained — so the guard it does have would not have stopped the very
incident it is remembered for.

⇒ **For `eval-golden.mjs`, the rail is YOU.** Always pass `--models`, `--runs` **and** an explicit
`--budget` you can afford to lose. ⛔ Never `--base=<prod>` without all three. ⛔ Never assume a script's
default ceiling is a safe one — read it, at run time, in the file.

---

## Step 0 — the worktree, not the parked checkout

```
git -C <worktree> rev-list --left-right --count origin/main...HEAD     # expect 0	0
git -C <worktree> rev-parse --abbrev-ref HEAD
git -C <worktree> status --porcelain                                   # expect clean
```

- Run from the **CURRENT** worktree under `C:/RnD/.wt/` (see `docs/governance/WORKTREES.md`; on
  2026-08-27 `buyer-playbook` was clean at `0	0`).
- ⛔ **Never `Habait/MVP/app` itself** — the main checkout is parked on an old branch, ~168 commits behind
  `origin/main` with dirty files. An eval there measures code production left behind.
- If the count is not `0	0`, **state the delta and what it contains** before running. Evaluating a
  branch is legitimate; evaluating a branch while reporting it as `origin/main` is not.
- ⭐ **State which commit you evaluated.** A model score without a commit is unreproducible; "prod tip"
  has a shelf life of minutes on a multi-worktree clone.

## Step 1 — spend NOTHING first

```
node scripts/eval-buyer.mjs --selftest
```

Zero spend: no login, no request, no model. It proves every grader **falsify-first** — each shown RED on
a manufactured violation and GREEN on a compliant turn. ⭐ **Run it before spending anything**, and
especially after any change to graders, prompts or tools. A grader that cannot fail is not a grader, and
this repo has already shipped one stale `--selftest` count that sat unnoticed.

For the other three there is no self-test: rehearse with the **narrowest possible** real run instead —
one model, one run, a couple of beats, the smallest budget that clears the $0.10 floor.

## Step 2 — the prerequisites nobody writes down until an eval dies at beat 1
⚠ **Machine resource rules** (root `CLAUDE.md`; backed by the `test-guard` hook once it is installed per `.claude/hooks/README.md` — until then this line is the only rule): every test, build, server, browser or render command runs in Git Bash as `timeout N <cmd>` (tests 300 s, build/typecheck 540, servers/sweeps/renders 540 per chunk, 1800 once `BASH_MAX_TIMEOUT_MS` is raised) with the tool timeout above N; one heavy run at a time; foreground only; kill what you start by PID; never sleep-poll a backgrounded run — stop it, kill its tree, re-run bounded once.

- **A running server.** All four replay against a real HTTP route; `--base` defaults to
  `http://localhost:3000`. ⚠ A stale process may hold `:3000` — if the dev server came up on `:3001`,
  pass `--base=http://localhost:3001`. Inside a worktree, start it with `next dev --webpack` (Turbopack
  refuses a junctioned `node_modules`).
- **A database**, for anything reading real inventory or writing profile state.
- **Credentials.** `eval-buyer.mjs` reads `DEMO_USERS` from `.env.local` and performs a real
  `POST /api/login`. ⛔ **Names only, never values** (D8): never echo, paste, log or quote what it read —
  not into chat, not into the run entry, not into a commit message. A chat-exposed value is **BURNED** ⇒
  stop and route to `/rotate-secrets`.
- ⛔ **Copy `.env.local` aside before ANY Vercel command**, `link` included (three proven destructions:
  `vercel blob create-store`, `vercel integration add neon`, `vercel link`). An eval itself does not run
  Vercel commands — this bites when one is run beside it.

## Step 3 — declare the ceiling, THEN run

State, in one line, before the first request: **script · agent/models · runs · beats · budget · locale ·
base · commit.** That line is the whole point of the flag law: *"the flag law's purpose was never 'pick
an agent' — it was 'state what you are about to spend.'"*

```
node scripts/eval-buyer.mjs --agent=main --runs=1                              # wall $0.50
node scripts/eval-buyer.mjs --agent=all --runs=1 --budget=2.00                 # the D11 invocation
node scripts/eval-dashboard.mjs --models=<id> --runs=1 --budget=0.50
node scripts/eval-dev.mjs --agent=marketing                                    # wall $0.50
node scripts/eval-golden.mjs --models=<id> --runs=2 --budget=<yours>           # ⛔ never bare
```

Flags shared across the family (measured, not assumed): `--base=URL` · `--beats=1,2,…` ·
`--timeout=MS` (default 90000) · `--json=PATH` · **`--locale=he|en|fr`** · `--model=ID` /
`--models=a,b` (validated against `ALLOWED_MODEL_IDS`; an unknown id is refused **before** any request).

⚠ **`--budget` above a script's stated cap is allowed and warns** — `eval-buyer.mjs` prints
`!! NOTE: --budget=$… exceeds the task-05 default cap ($0.50) — make sure this was ordered.` **That
warning is expected output under an ordered wider run, not a fault.** Say who ordered it.

⚠ **On `--locale`:** the agent replies in that language and graders are locale-tolerant, but beat routing
is still graded on the Hebrew golden `user_text`, and the replay badge inside the canvas directive stays
the Hebrew literal **"שחזור הדגמה"** in every locale — that literal is the compliance anchor; only the
client's display badge is localized. ⛔ A locale run is not a licence to "fix" that assertion.

## Step 4 — read the result honestly

- **Grounding beats eloquence.** A correct *"אין לי נתונים על זה בדמו"* / *"לא זמין"* is a **PASS**; a
  fluent invented number is the worst possible failure. Grade the refusal beats first.
- ⭐ **`model_used` records only the LAST step.** On 3 of 6 runs OpenRouter fell back mid-turn and it was
  invisible except through cost/token anomalies. A fallback is not a signal you will see.
- ⭐ **An eval's `AGENT_MODEL_PINS` label is a hand-maintained MIRROR, and it has lied** — it once
  reported sonnet for turns that really ran the registry's haiku pin. Trust the registry, not the label.
- ⭐ **Provider TTFT is WEATHER, not a property** — the same model measured 12–78s one morning and
  3.5–4.1s the same afternoon. Measure at decision time; never carry a morning's tail into an
  afternoon's ruling.
- ⭐ **Compare cost on OUR prompt, not on sticker price.** Anthropic tokenizes the Hebrew prompt roughly
  4× and caching is asymmetric, which is why an old "1/14th the cost" line must not be reused as a live
  argument.
- **A run aborted on budget is not evidence of a regression** — it is starved data. Label it as aborted,
  keep the transcripts, and re-run the affected beats with a real ceiling before concluding anything.

## Step 5 — file the records

### 5.1 `memory/runs/YYYY-MM-DD-<slug>-eval.md` — always

Frontmatter per `memory/_TEMPLATE.md`, then *What happened · Why it matters · Next / watch*, carrying at
minimum: **script, agent/models, runs, beats, locale, base, the evaluated COMMIT, pass/fail per beat
class, measured spend to the cent, and any abort.** ⛔ Append-only — never edit an older entry; correct
forward. Then one **≤ 400-character** pointer line under `memory/INDEX.md`'s **`runs/`** header (⛔ never
add a header — there are exactly four), and:

```
node .claude/skills/sync-context/verify-memory.mjs        # expect CLEAN
```

```
SKIP (5.1 memory): memory/runs/ not present
```

### 5.2 `docs/governance/MODEL-PINS.md` — an EVENT row, ONLY if a pin actually changed

⛔ **That file holds NO current-state pin table and must never grow one.** It is a **pointer registry plus
a dated event log**: the pin lives in the app repo (`lib/buyer-team/registry.ts`, enforced by
`lib/buyer-registry.test.ts`), and a harness copy would become a **sixth mirror** of a value that already
has five. To learn the pin, read the authority — on `origin/main`, not on a parked branch.

An eval that merely *measured* models writes **nothing** here; its evidence lives in the run entry. When
a pin does change, append one row to §2:

```
| Date | Surface | Change | Why / evidence | Who ruled | Commit |
```

⚠ **Five files carry the buyer pin and they move together** — `lib/buyer-team/registry.ts` ·
`lib/buyer-registry.test.ts` · `components/buyer-team/agents-meta.ts` ·
`components/buyer-team/buyer-team.dom.test.tsx` · `scripts/eval-buyer.mjs`. **A repin that touches four
of five leaves a green suite and a lying eval label.** Name all five in the row's evidence.

```
SKIP (5.2 model-pins row): no pin changed — evidence stays in the run entry
SKIP (5.2 model-pins row): docs/governance/MODEL-PINS.md not present
```

### 5.3 Nothing else

⛔ This skill never writes `docs/governance/SHIP-LEDGER.md` (a pin change belongs in `MODEL-PINS.md`,
*"not here, even when it shipped as a deploy"*), never writes a gate memo, and **never deploys** — if an
eval was a pre-ship check, the ship itself is `/ship`, behind its own explicit go.

---

## Registers this skill writes

| Register | What this skill writes | If absent |
|---|---|---|
| `memory/runs/<date>-<slug>-eval.md` + `memory/INDEX.md` | the measured result + one ≤400-char pointer under `runs/` | `SKIP`, reported |
| `docs/governance/MODEL-PINS.md` | one dated **EVENT** row in §2 — only when a pin changed | `SKIP`, reported |
| `docs/governance/OWED.md` | a row only if the eval exposed a debt (a lying mirror, a stale grader) | `SKIP`, reported |

⛔ **Never** a "current pin" column, anywhere in the harness. ⛔ **Never** an edit to the app repo from
the harness — two repos, two authorities; this skill *reads and runs* there and files its records here.

---

## Rules

1. **Explicit invocation only.** Never auto-run, never chain from another skill, never from an agent.
2. ⛔ **Never `node scripts/eval-golden.mjs` bare** — and know *why* the rule is absolute: unlike its
   three siblings, that script will not stop you, and its default ceiling is $5.00.
3. **Declare the spend before the run and report it to the cent after.** Blank means unmeasured; never
   estimate.
4. **Zero-spend first** (`--selftest`), narrowest-real-run second, matrix only on an explicit order.
5. **Run from the current worktree; name the commit you evaluated.** Never the parked checkout, never
   `HEAD` as a stand-in for `origin/main`.
6. **Secrets: names only, never values.** An eval logs in; it must never surface what it read.
7. **Re-measure the flags before quoting them.** This file's table was measured 2026-08-27 on
   `origin/main`; scripts change. `git -C <worktree> show origin/main:scripts/<file> | head -60` is the
   authority, not this table.
8. **Report a SKIP, never a silent pass**, and close with: script, flags, commit, per-beat verdicts,
   measured spend, and every record written or skipped with its reason.

---

**Provenance** — Created 2026-08-27 · Author: habait-agent-smith, board `development/tasks/rnd-reorg/`
task **T20** · Capability item **CP-18** (P2), under ruling **CP-10** (eval-runner stays a skill) ·
Register kept alive: `docs/governance/MODEL-PINS.md` · Companions: `/ship`, `/close-board`,
`/rotate-secrets`, `/worktree-ops` · Scripts wrapped, measured read-only on `origin/main` 2026-08-27:
`scripts/eval-buyer.mjs`, `scripts/eval-golden.mjs`, `scripts/eval-dashboard.mjs`, `scripts/eval-dev.mjs`
(app repo `<github-org>/<app-repo>`) · Incident of record:
`memory/runs/2026-07-10-habait-funnel-ship.md` + `Habait/MVP/docs/qa-evidence/funnel/task09-eval-incident.txt`.
