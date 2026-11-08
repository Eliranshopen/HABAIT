---
name: rotate-secrets
description: "Explicit only: the credential-rotation runbook, one credential at a time — burn-check, generate, Eliran sets it in the console, redeploy, verify behaviourally by probe, then the SECRETS-LEDGER row via secrets-steward and the OWED rows. Names only, never values."
user-invocable: true
disable-model-invocation: true
argument-hint: "<credential NAME> [--all] [--burn-report]"
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent
model: sonnet
---

# /rotate-secrets — rotate by name, prove by behaviour, record the state

**When to use** (the full trigger text, moved here verbatim from the `description` on 2026-11-04, OWED-018): The credential-rotation runbook as an executable sequence, one credential at a time: burn-check first, generate (a provider console is Eliran's act; a locally-generable secret is piped straight into the console tool and never printed), Eliran sets it in the console, redeploy because env changes are not retroactive, verify BEHAVIOURALLY with a probe rather than by reading any value, then file the SECRETS-LEDGER row through secrets-steward and update the OWED debt rows. Explicit invocation only. Names only, never values — the skill never echoes, prints, pulls or stores a credential, never runs vercel env pull, and a chat-exposed value is BURNED, which files a burn row before anything else happens.

> ⏸ **Git steps on hold until Eliran rules on them** (identity set 2026-11-04; local only, no remote — root `CLAUDE.md` §8.7, §11). Every step below that commits, tags, fetches, pushes, opens a git worktree or compares to `origin/main` does not run yet: report it as `SUSPENDED (not ruled)` and carry on with the rest. Working folders are plain copies under `C:\RnD\.wt\<name>` (root `CLAUDE.md` §8.7). The product is `Projects/Habait/habait-walkaround/`, not `Habait/MVP/app` (OWED-009).

**Taxonomy: group C · Harness ops** (`docs/skill-taxonomy.md` §2). Created 2026-08-27, board
`development/tasks/rnd-reorg/` T11, capability item **CP-16**, migration family **6E**.

**Explicit invocation only.** `disable-model-invocation: true` — no model may auto-select a skill whose
subject is credentials. Only a typed `/rotate-secrets` runs it.

**Why this exists.** Six named credentials sat in `docs/governance/key-rotation-runbook-2026-08.md` for 22
days with **zero completion records**, while the runbook carried an empty *"(fill at ship time)"* outcome
slot. `docs/governance/SECRETS-LEDGER.md` is now that single state slot, and this skill is the step that
writes it — the register is not a document someone is supposed to remember.

---

## ⛔ The hard rail — read it before every run, no exception for "just checking"

- **You never read, print, pull, echo, grep, quote, hash, redact-but-keep, or store a credential VALUE.**
  Not a prefix, not a suffix, not its length. **Names only** — the text left of `=`.
- ⛔ **Never `vercel env pull`.** Two reasons, both proven: it is one of the commands that **rewrites
  `.env.local`**, and a **sensitive-typed Vercel var pulls back as the literal `[SENSITIVE]`**, not an
  empty string — so a "the pulled file is non-empty" check is a **lie** for masked values. A pulled file
  is not authoritative for a fresh var; only behaviour is.
- ⛔ **Never open** `.env`, `.env.*`, `*.env.local*`, `**/mapconfig.local.js`, anything under
  `C:/RnD/.wt/_env-backups/`, any `*.bak`/`*.backup*` beside an env file, or `~/.claude.json` —
  with any tool. The **name manifests** you may read carry names and zero values by design: root
  `.env.example`, the app's `.env.example`, `SETUP.md` §2, and the runbook.
- ⛔ **Never ask Eliran to paste a value into chat, and never accept one if they do.** ⭐ **A chat-exposed
  credential is BURNED** — rotation stops being optional and becomes overdue; where the credential has no
  successor need the remedy is outright **revocation**, not rotation. **Every recorded credential
  exposure in this repo's history was a human paste into a transcript.**
- ⛔ **The harness never holds a console.** Every console step is Eliran's own act. The skill prepares the
  numbered checklist, verifies behaviour afterwards, and writes the row.
- ⭐ **Copy `.env.local` aside before ANY Vercel command, `link` included.** Three proven destructions:
  `vercel blob create-store`, `vercel integration add neon`, and (CLI 59) **`vercel link`**, which now
  writes the file too. Backups go to `C:/RnD/.wt/_env-backups/` on purpose — a `.bak` beside the
  original surfaces as an untracked file inside a worktree. ⚠ That directory is plaintext outside every
  git repo (`SECRETS-LEDGER.md` §2); you may report its **path and entry count**, never its contents.
- ⭐ **Env changes are not retroactive** — every store change needs a **redeploy** to take effect.

---

## Step 0 — burn check, FIRST, before anything else

If any transcript, run entry, task file or report shows a credential **value** having been pasted, that
credential is burned. Do not continue the rotation sequence until the row is filed.

Delegate to `secrets-steward` (`.claude/agents/secrets-steward.md` — `Read, Grep, Glob, Write, Edit`, **no
Bash by construction**, so it *cannot* pull or echo a value): file or upgrade the row to
`BURNED — REVOKE, not rotate` (or `ROTATION OWED` where a successor is needed) and point
`docs/governance/OWED.md` at it. `OWED-001` is the rotation family; `OWED-002` is the burned seedance
key; **ids are never reused, never renumbered**.

Report which credential (by NAME), where it was exposed (by path/date), and that the row is filed. Then
resume.

---

## Step 1 — scope the round, by name

Read `docs/governance/SECRETS-LEDGER.md` §1 (state) and `key-rotation-runbook-2026-08.md` (procedure) in
the same folder. List the credentials in scope **by name only**, each with: where it lives (by name), its
current ledger status, its console, and its probe. Confirm the list with Eliran before touching anything.

⚠ Two facts that change the order:
- Rotating `SESSION_SECRET` **invalidates every live demo session** (users re-login). Never mid-demo.
- Where a credential has no successor need (a retired pipeline, a retired showcase), the remedy is a
  plain **revoke** — say so instead of manufacturing a replacement.

---

## Step 2 — generate

Two lanes. Pick by whether the credential is issued by a provider or generated locally.

**Lane A — provider-issued (default).** `OPENROUTER_API_KEY`, `BLOB_READ_WRITE_TOKEN`, the fal/seedance
key, the Cesium ion token, the Google Maps key, the `21st` and `refero` MCP bearers. **Eliran creates the
new credential in the provider console.** The harness writes the numbered steps (console → the exact
screen → "create new, do not delete the old one yet"); it does not perform them and never sees the value.

**Lane B — locally generable (`SESSION_SECRET` and its shape).** The value is **piped straight into the
console tool and never printed**:

```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" | vercel env add <NAME> production
```

⛔ **Never run the `node -e` half on its own** — bare, it prints the value into the transcript and burns
it on creation. ⭐ Proven twice: a secret can be provisioned without ever entering the transcript. Run
this lane **only on Eliran's explicit order**; the default is still that the console is their.

**To hand a value to Eliran** (when they need to type it on a device): write it to a scratchpad file and
open that file on their screen. ⛔ Never print it, never put it in a task file, a commit message, a report
or `memory/`.

---

## Step 3 — Eliran sets it in the console

His act, always. Vercel: dashboard → Habait-DEV → Settings → Environment Variables (Production + Preview
+ Development), or `vercel env add <NAME>` fed from a pipe. Provider credentials: that provider's own
dashboard. Local `.env.local` is updated **by hand** — never by `vercel env pull`.

Present the steps as a numbered list carrying **NAMES**. Then wait. A step you cannot verify is not a step
you may assume happened.

---

## Step 4 — redeploy

⭐ **Env changes are not retroactive.** After **all** the round's keys are set: **one** redeploy.

Use `/ship`'s deploy step if this rides on a release; otherwise `vercel deploy --prod` from the ship
worktree (⚠ `OWED-009`: a GitHub push no longer triggers a build, cause unmeasured). ⛔ A redeploy is a
production action and needs Eliran's own explicit go, exactly like any other deploy.

---

## Step 5 — verify BEHAVIOURALLY (never by value)

⭐ **Verification is behavioural, never by value** (`SECRETS-LEDGER.md` §3.6). `habait-deploy-qa` runs the
probes; `secrets-steward` **specifies** them in writing; results come back **by credential NAME** with a
status code / a rendered artifact / a streamed message — never a value, in either direction.

| Credential (name) | The probe that closes its row |
|---|---|
| `SESSION_SECRET` | `/login` returns 200 **and** a demo login succeeds |
| `OPENROUTER_API_KEY` | one cheap golden-chat message **streams** (cheapest model, one message) |
| `BLOB_READ_WRITE_TOKEN` | a dashboard image **renders** from Blob |
| any revoked key | the **OLD** credential returns **401** on a direct probe — revocation proven, not assumed |

⛔ A console screenshot, a green dashboard row, or "Eliran says they set it" is **not** a probe. ⭐ Ledger
item **S-3**: no row has ever been closed by a behavioural probe recorded in the file — the first time it
happens sets the pattern, so write the probe result and its evidence path, not the click.

---

## Step 6 — the register rows

1. **`docs/governance/SECRETS-LEDGER.md`** — via `secrets-steward`. One row per credential name:
   `name · where it lives (by name) · exposure event + date · status · evidence path`. The status changes
   only when the **probe** passed, and the evidence path is the record of that probe. Append-and-supersede;
   never rewrite a register's history (`docs/governance/README.md` §4.4).
2. **`docs/governance/OWED.md`** — update `OWED-001` (the rotation family) and/or `OWED-002` (the burned
   key). A closed row **keeps its id** and gains a path to the evidence that closed it. Owner is never
   blank and never TBD.
3. **`memory/runs/YYYY-MM-DD-<slug>.md` + one `memory/INDEX.md` line** (≤400 chars) — names, paths, probe
   outcomes; ⛔ **zero secret bytes**. `memory/runs/` is append-only; correct forward.

**If a register file is absent → report `SKIP` and carry on; never fail:**

```
SKIP (secrets ledger): docs/governance/SECRETS-LEDGER.md not present — state not recorded, rotation still valid
SKIP (owed rows):      docs/governance/OWED.md not present
SKIP (runbook):        docs/governance/key-rotation-runbook-2026-08.md not present — console steps unverified against the house procedure
```

---

## Registers this skill writes

| Register | What this skill writes | Written by | If absent |
|---|---|---|---|
| `docs/governance/SECRETS-LEDGER.md` | the per-credential state row, closed by a probe result | `secrets-steward` | `SKIP`, reported |
| `docs/governance/OWED.md` | `OWED-001` / `OWED-002` state, or a new id (never reused) | `secrets-steward` | `SKIP`, reported |
| `memory/runs/<date>-<slug>.md` + `memory/INDEX.md` | the round's record, names only | this skill | `SKIP`, reported |

⛔ **This skill never writes** `docs/governance/key-rotation-runbook-2026-08.md`'s outcome section — that
slot was deliberately replaced by a link to the ledger (governance design rule 3: *a new tracker replaces
an existing empty state slot, never adds one*). Never re-create a second state slot.

---

## Rules

1. **Names only, never values.** In the ledger, the OWED row, the runs entry, the INDEX line, the commit
   message, the report, and this session's own output (decision **D8**, 2026-08-27).
2. **Burn first, rotate second.** A reported chat-paste files its row before any other step runs.
3. **Consoles are Eliran's.** Prepare, wait, verify, record. Never perform a console step, never assume one.
4. **Copy `.env.local` aside before ANY Vercel command, `link` included.**
5. **Never `vercel env pull`; `[SENSITIVE]` is a placeholder, not a value, and an empty pull is not proof.**
6. **One redeploy after all keys** — env changes are not retroactive — and the redeploy needs its own go.
7. **A row closes on a probe, not a click.**
8. **Report by name:** which credentials were rotated / revoked / deferred, which probes passed with their
   evidence paths, which rows were written, and what is still owed and to whom.

---

**Provenance** — Created 2026-08-27 · Author: habait-agent-smith, board `development/tasks/rnd-reorg/`
task **T11** · Capability item **CP-16** · Migration family **6E** · Authority: inherited decision **D8** (now Eliran's)
(ledger in-repo, names only) · Register kept alive: `docs/governance/SECRETS-LEDGER.md` · Procedure it
drives: `docs/governance/key-rotation-runbook-2026-08.md` · Agents: `.claude/agents/secrets-steward.md`
(rows, checklist), `.claude/agents/habait-deploy-qa.md` (runs the probes only) · Companions: `/ship`,
`/worktree-ops`.
