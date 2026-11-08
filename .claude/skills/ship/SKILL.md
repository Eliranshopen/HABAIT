---
name: ship
description: "The release sequence for the Habait app repo, run by the main session end to end: preflight, deploy behind Eliran's own per-deploy go, live-verify by browser paint proof, then the closing register writes that make the ship exist. Explicit invocation only; it never deploys on its own."
user-invocable: true
disable-model-invocation: true
argument-hint: "<what shipped, in a few words> [--board <slug> | --boardless]"
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent
model: opus
---

# /ship — the release sequence, with the register writes as steps inside it

> ⏸ **Git steps on hold until Eliran sets a remote** (identity set 2026-11-04; local only by Eliran's word, root `CLAUDE.md` §8.7, §11). Every step below that commits, tags, fetches, pushes, opens a git worktree or compares to `origin/main` does not run yet: report it as `SUSPENDED (no remote)` and carry on with the rest. Working folders are plain copies under `C:\RnD\.wt\<name>` (root `CLAUDE.md` §8.7). The product is `Projects/Habait/habait-walkaround/`, not `Habait/MVP/app` (OWED-009).

**The seven steps, in order** (the detail the frontmatter description no longer carries, trimmed
2026-09-08 to one trigger sentence per `.claude/skills/CLAUDE.md`): 0 orient · 1 preflight per
`habait-deploy-qa`'s narrowed remit — tests, `tsc`, the byte-frozen-file check, a gate memo filed or an
explicit boardless note · 2 DEPLOY behind Eliran's own per-deploy go, under the pinned commit identity ·
3 live-verify by browser paint proof across every host alias and every locale · 4 the five closing
steps that make the ship exist — the `SHIP-LEDGER.md` row, the `Habait/CLAUDE.md` correction line, the
`memory/runs/` entry plus its INDEX line, the board README status cell with its hash, and an OWED row
for anything left owed · 5 the rotation check for this round's writers · 6 the hotfix escape hatch.
⛔ It never deploys on its own, and there is deliberately **no `release-manager` agent**.

**Taxonomy: group C · Harness ops** (`docs/skill-taxonomy.md` §2). Created 2026-08-27, board
`development/tasks/rnd-reorg/` T11, capability item **CP-15**, migration family **6E**.

**Explicit invocation only.** `disable-model-invocation: true` — no model auto-selects this skill; only a
typed `/ship` runs it. That is deliberate: every step below either needs Eliran's own word or writes a
record that must be true.

**⛔ There is no `release-manager` agent and none may be created.** A deploy-shaped agent brief inherits
the auto-mode safety classifier that blocked 28 of 30 such briefs (root `CLAUDE.md` §8, convention 2), and
the artifact this project actually keeps losing is **the ship-log write, not the deploy**. So the fix is a
skill the **main session** runs, in the visible session, with Eliran present —
`docs/research/rnd-reorg/MIGRATION-DRAFT.md` §11 5F and `CAPABILITY-PLAN.md` §7.1. If a step is blocked,
hand the command to Eliran with a `!` prefix; **never route around a block.**

**Why this exists (the measured failure).** The ship log has failed three times on the record: five ships
accumulated in root `CLAUDE.md` §9 unlogged; the entry that finally logged them got its own prod tip wrong
within the hour; and `SHIP-LEDGER.md` opened in 2026-08-27 with a 40-run gap behind it. The department's
own law from that entry: *"a ship log is only as good as the discipline of writing it at ship time."*
Section 4 is therefore not paperwork after the ship — it **is** the ship.

---

## Step 0 — orient (2 minutes, always)

Read, in this order: `docs/governance/SHIP-LEDGER.md` (its line-1 split-sourcing rule and §3 filing
rules), `docs/governance/OWED.md` (what this round is expected to pay down or add to),
`docs/governance/WORKTREES.md` (rules 4, 7, 8 bite during a ship), and the board's own `README.md` if
there is one. Then state, in one line each: **which worktree**, **which branch**, **which base commit**,
**boardless or board `<slug>`**.

---

## Step 1 — PREFLIGHT (habait-deploy-qa's narrowed remit)
⚠ **Machine resource rules:** root `CLAUDE.md` §12 (pasted copy replaced by this pointer 2026-11-04, OWED-019).

Delegate to `habait-deploy-qa` (`.claude/agents/habait-deploy-qa.md`, narrowed 2026-08-27 by CP-11/CP-27)
or run its checklist directly. Every item is pass/fail and reported by name:

1. **Commit identity — author AND committer** is EXACTLY
   the pinned identity in root `CLAUDE.md` §11 (Eliran's; ⛔ unset until the department repo is created — this check FAILS until it is).
   ```
   git -C <worktree> log -1 --format='%an <%ae> | %cn <%ce>'
   git -C <worktree> config user.email        # expect the same numeric noreply
   ```
2. **Base freshness** — `git -C <worktree> fetch origin && git -C <worktree> log --oneline HEAD..origin/main`
   is **EMPTY**, else merge first.
3. **Worktree provenance** — name the worktree and branch; `git -C <worktree> status --porcelain` clean.
4. **`.env.local` copied aside** before ANY Vercel command, `link` included (three proven destructions:
   `vercel blob create-store`, `vercel integration add neon`, `vercel link`).
5. **Tests + types** — the app's own suite and `tsc` green, with the counts stated
   (`N/N`, not "green"). A pre-existing failure class is named as pre-existing, with its count.
6. **The byte-frozen-file check** — every file the round's contract declares frozen is diff-EMPTY against
   the base (`git -C <worktree> diff --stat <base> HEAD -- <frozen paths>`). Name the paths you checked;
   an unchecked frozen path is a failed preflight, not a silent pass.
7. **Gate memo filed, or an explicit boardless note.** Either `Habait/MVP/docs/compliance-gate-NN.md`
   exists for this round (re-measure the free number with `ls Habait/MVP/docs/compliance-gate-*.md` and
   `Habait/MVP/docs/GATE-NUMBER-REGISTER.md`; ⭐ **a reservation in a board README is not a claim on a
   number — only a filed memo is**), **or** you write one line into the ship record saying this round
   shipped boardless and ungated on Eliran's direct order. ⛔ Never leave the question unanswered — an
   unstated gate is the shape of `OWED-005`.

⚠ A gate memo is **pre-ship paper**. It never becomes the authority for a merge commit
(`SHIP-LEDGER.md`, line 1).

---

## Step 2 — DEPLOY

### ⛔ HARD STOP 1 — Eliran's own go, quoted verbatim from root `CLAUDE.md` §9 (2026-07-15)

> **Standing rule reinforced: every prod deploy needs its OWN explicit go (a bug report ≠ deploy authorization — the auto-mode classifier correctly blocked a push made without asking).**

*(One line on purpose: the sentence is byte-verbatim from root `CLAUDE.md` §9, 2026-07-15, so a grep for
it matches. ⛔ Do not reflow it.)*

A bug report, a "this is broken", a green gate, a finished board, an earlier deploy's go, and your own
confidence are **none of them** authorization. Ask, in the session, for this deploy. If the answer has not
arrived, stop here and report the preflight result — a preflight with no deploy is a complete, successful
`/ship` run up to step 2.

### ⛔ HARD STOP 2 — the pinned identity

The pinned identity lives in root `CLAUDE.md` §11 — Eliran's, set when the department repo is created. Until then this stop cannot pass.

**The numeric id matters, not just the `noreply.github.com` suffix.** A wrong-number noreply makes
Vercel's git protection **silently refuse to build** — deployment status `UNKNOWN` with **zero build
logs** is the signature. The fix is an empty commit under the correct identity, **never a history rewrite
of pushed `main`**.

### ⚠ OWED-009 — a GitHub push no longer triggers a Vercel build

Since 2026-08-25 a push to `main` has stopped triggering a build (silent skip, **cause unmeasured**;
identity was verified correct at the time, so this is *not* the wrong-number look-alike above).
`docs/governance/OWED.md` **OWED-009**, class PROD-P0. Until the cause is measured:

```
vercel deploy --prod                # from the ship worktree, after the merge is pushed
```

is how a ship reaches production. ⛔ **A push landing on `origin/main` is not proof the live site
changed** — that is precisely why step 3 is not optional. Re-read the OWED row before every ship: if it
has closed, the push route is back.

---

## Step 3 — LIVE-VERIFY (a browser, not a curl)

> ⭐ **"a curl 200 does not prove a browser will paint"** — compliance-warden, gate #20, 2026-07-14.

`WebFetch`/`curl` is curl-class evidence and does **not** satisfy this step. The recipe (CP-27, in
`habait-deploy-qa`'s definition, reproduced here so the skill is runnable on its own):

1. Headless Chrome via `playwright-core` (already declared in `Habait/MVP/app/package.json`), driven from
   `Bash`, in a fresh **logged-out** context — plus a logged-in pass for any gated surface.
2. Navigate to the **DEPLOYED** URL, never localhost.
3. Assert the **real network request the feature depends on** fired and returned 200 with the right
   content-type — tile/style/glyph `.pbf` for a map, a `Range` `.mp4` for video, a streamed chunk for
   chat — not merely the document status.
4. Assert the DOM **painted**: visible element with a non-zero bounding box, canvas non-blank by pixel
   sample, console free of errors.
5. Assert **CONTENT**, not just paint — a raw 401 JSON body IS a paint of the wrong thing (R-D4-MAP,
   2026-07-16).
6. Save the screenshot as **lossless WebP** into `qa-evidence/<board>/<task>/`
   (`docs/governance/RETENTION.md` (not transferred)) and cite the path in the ship record.

**Coverage — both axes, every time:**

- **Host aliases:** `habait.ai` · `www.habait.ai` (308 → apex) · `app.habait.ai` · `habait-dev.vercel.app`.
- **Locales:** every locale the changed surface serves — `/x`, `/en/x`, `/fr/x` (the homepage's polarity is
  inverted: bare `/` is English, `/he` Hebrew). A one-locale check on a trilingual surface is not a
  live-verify; say which locales you actually loaded.

---

## Step 4 — THE CLOSING STEPS (this is what makes the ship exist)

Run **all five**. Each names its own file. **If a register file is absent → report `SKIP` with the reason
and carry on. A missing register is never a failure of this skill** — a reverted register must leave no
dangling step (`MIGRATION-DRAFT.md` §10.5).

### 4.1 The `docs/governance/SHIP-LEDGER.md` row

Newest first, at the top of §1's table. The columns, exactly as the file carries them:

```
| Date | What | Merge commit | Board | Plan | Contract | Gate | QA | Live-verified | Spend | Rollback |
```

- **Sourcing is SPLIT and the split is the point** (the file's line 1): `Date · Board · Plan · Contract ·
  Gate · QA · Spend` come from the gate memo / QA report / board; **`Merge commit` · `Live-verified` ·
  `Rollback` come from this round's `memory/runs/` entry + `git log origin/main`** — only git records what
  shipped.
- ⛔ **An empty `Board` / `Plan` / `Gate` cell is LEGITIMATE, not a gap.** Write `⛔ none`. This project
  ships boardless rounds on Eliran's direct order.
- **`Spend` blank = nobody measured it. Never estimate.** `—` means none.
- **Rollback** is `git revert -m 1 <merge>` **only for a real merge commit**; a fast-forward has no
  mainline to pick, so it is a plain `git revert <hash>`. State which.
- **Also prepend the evidence path** to the "**Evidence paths, in the same order**" block directly under
  the table — it is positionally coupled to the rows. A row added without its evidence line silently
  desynchronises every path below it.
- ⛔ **Backfill rule:** the ledger opens at **2026-08-17** and is **not** retro-filled. Do not add a row
  for an older ship while you are here.
- Verify the hash you just wrote actually reaches production:
  ```
  git -C C:/RnD/.wt/<worktree> merge-base --is-ancestor <hash> origin/main && echo shipped
  ```
  ⛔ Never bare `git` from the harness root (different repository — it fatals); ⛔ never against `HEAD`
  (the app's main checkout is parked on an old branch).

```
SKIP (4.1 ship-ledger row): docs/governance/SHIP-LEDGER.md not present — row not written, nothing failed
```

### 4.2 The `Habait/CLAUDE.md` correction-block line

That card carries a run of dated pointer paragraphs (currently ending just above `## Key files`) whose job
is to stop the card lagging production. Append **one dated line** — not a retelling: what shipped, the
merge commit, the surface, and the `memory/runs/` path. Re-stamp the card's `<!-- last-updated -->`
marker (exactly one, bare `YYYY-MM-DD`, line 2 — `docs/CONTEXT-FILE-STANDARD.md` (not transferred) §3.3).

```
SKIP (4.2 correction line): Habait/CLAUDE.md not present
```

### 4.3 The `memory/runs/YYYY-MM-DD-<slug>.md` entry + its INDEX line

- The entry is the round's real record: frontmatter per `memory/_TEMPLATE.md`, then *What happened · Why
  it matters · Next / watch*. ⭐ **This is the one non-negotiable** — a boardless ship is fine; an
  unrecorded ship is not (`SHIP-LEDGER.md` §3.3).
- `memory/runs/` is **APPEND-ONLY**: never edit an existing entry; correct forward with a new one that
  names what it supersedes.
- Add exactly one pointer line under `memory/INDEX.md`'s `runs/` header, **≤ 400 characters** (link + one
  hook sentence; the entry carries the detail — `memory/_TEMPLATE.md`, forward-only from 2026-08-28).
- Then `node .claude/skills/sync-context/verify-memory.mjs` → expect `CLEAN`.

```
SKIP (4.3 memory): memory/runs/ not present
```

### 4.4 The board README status cell — with the hash

⭐ **Any board README asserting a ship state MUST cite the commit hash(es)**
(`development/tasks/CLAUDE.md`, the T10 rule). An uncited status sentence is unverifiable by construction:
that is exactly how two v6 boards sat on "awaiting Eliran's go" for **21 days** after their real deploy, and
how an `a11y-cookies` header read "OPEN — no task started" directly above a real production merge.

Keep the closing summary to **a few lines** — ship state, the hash(es), and a link to the
`memory/runs/` entry, which is where the narrative belongs (the cap in `development/tasks/CLAUDE.md`;
forward-only, no retroactive rewrites of the 21 boards that already carry a full retelling).

```
SKIP (4.4 board cell): boardless round — no board README to update (state this, do not invent a board)
```

### 4.5 `docs/governance/OWED.md` — one row per thing left owed

Anything this ship deferred, declared, or newly exposed: a missing env var, an unwritten QA report, a
contract amendment owed, a gate not run. Rules from that file: **ids are never reused**; **`Owner` is
never blank and never TBD**; **one line per row**; secrets by **name only**. Unpaid consequences of a
ship row belong here, **not** in the ledger. A model-pin change belongs in `MODEL-PINS.md` (not transferred), not either.

```
SKIP (4.5 OWED rows): docs/governance/OWED.md not present
```

---

## Step 5 — RETIRED 2026-10-22 (D-AUD-17, the lean lab): MERGED into /sync-context Target 3e, the garden: the cap breach grew from 1 file to 7 across the 22 ledger rows dated 2026-09-20 or later while this per-ship check ran scoped (V-04, V-20). Its text, verbatim, is in [RETIRED-2026-10-22.md](RETIRED-2026-10-22.md). Steps 0–4 and 6 stay: the identity check, the own-go hard stop, the paint proof and the `!` hand-off.

## Step 6 — THE HOTFIX ESCAPE HATCH: WHEN THE CLASSIFIER BLOCKS THE COMMAND (added 2026-09-08)

Auto mode's safety classifier will refuse a push or a deploy from this session. ⭐ **That refusal is
correct, and it is a hand-off, not an obstacle** (root `CLAUDE.md` §8, convention 2; rule 2 below).
1. **Stop at the block.** ⛔ Never split, rename, re-word, wrap, background or move the command into a
   script, an npm key or an agent brief to get past it. Routing around a block is the failure, not the delay.
2. **Hand Eliran ONE exact command** for their own session prompt, `!`-prefixed, copy-pasteable, worktree named,
   no placeholders — `!git -C C:/RnD/.wt/<worktree> push origin main`, or `!vercel deploy --prod` (step 2).
3. **Say three things with it:** what it does, what proves it worked (step 3's paint proof, not a curl),
   and what to do if it fails.
4. **Record which route ran** — Eliran's `!` command or this session's — in step 4.3's entry, and open an
   OWED row (4.5) for anything the block left unrun.

Pointer: this step only names the hand-off; the standing rule itself lives in root `CLAUDE.md` §8.
Source: harness upgrade plan (`docs/harness-upgrade-plan.md` (not transferred)), wave 4 (DEV-6 / SKL-6).

---

## Registers this skill writes

| Register | What this skill writes | If absent |
|---|---|---|
| `docs/governance/SHIP-LEDGER.md` | one row in §1 + its evidence path in the ordered block below the table | `SKIP`, reported |
| `Habait/CLAUDE.md` | one dated line in the correction block + the `last-updated` marker | `SKIP`, reported |
| `memory/runs/<date>-<slug>.md` + `memory/INDEX.md` | the round's entry (new file) + one ≤400-char pointer | `SKIP`, reported |
| `development/tasks/<board>/README.md` | the status cell, with the hash | `SKIP` — boardless is legitimate |
| `docs/governance/OWED.md` | one row per debt left owed | `SKIP`, reported |

⛔ **This skill never writes** `Habait/MVP/docs/GATE-NUMBER-REGISTER.md` (the warden's, at gate-filing
time), `docs/governance/SECRETS-LEDGER.md` (secrets-steward's — see `/rotate-secrets`),
`docs/governance/MODEL-PINS.md` (not transferred) (a pin change is its own record), or an inventory into
`docs/governance/WORKTREES.md` (its line-1 rule forbids one — see `/worktree-ops`).

---

## Dry description-run — a BOARDLESS ship, with Board/Gate cells legitimately empty

Worked against a real round: the **2026-08-16 `/interest` CEO round**
(`memory/runs/2026-08-16-interest-ceo-round.md`). ⛔ **Description only — do not append this row.** The
ledger's backfill rule opens it at 2026-08-17, so a 2026-08-16 ship stays authoritative in `memory/runs/`
and root `CLAUDE.md` §9. This shows the *shape*, not a pending edit.

- **Step 1 preflight:** identity pinned ✅ · base `4e5ac06`, `HEAD..origin/main` empty ✅ · worktree
  `interest-improvements` off `main`, clean ✅ · `.env.local` copied aside ✅ · suite 6→8 DOM tests green,
  including a negative that proves the declined path fires **zero** fetch calls ✅ ·
  frozen surfaces (API/schema/DB/`proxy.ts`/`routes.ts`) diff-EMPTY ✅ · **gate: none — boardless, stated
  in the record, and this surface is `OWED-005`'s open hole.**
- **Step 2 deploy:** Eliran reviewed it live on the worktree dev server and **gave the go in session**;
  `main` fast-forwarded `4e5ac06..c4955ab` and pushed under the pinned identity. ⚠ Vercel auto-built —
  which was still true on 2026-08-16; **OWED-009 opened 2026-08-25**, so the same ship today would deploy
  by `vercel deploy --prod` from the worktree.
- **Step 3 live-verify:** ~220s after push, `/interest`, `/en/interest`, `/fr/interest` all serving the new
  build — **three locales named, not "verified live".**
- **Step 4 closing steps:** the row below; no board cell (boardless); no OWED row opened by the round
  itself (its debts, B1 and the missing gate, were already `OWED-003`/`OWED-005`).

```
| 2026-08-16 | `/interest` CEO round — counter inside the panel, larger type, page-scoped bold logo, rebuilt thank-you + WhatsApp card, "No" = a collects-nothing exit | `c4955ab` (fast-forward `4e5ac06..c4955ab`) | ⛔ none | ⛔ none | ⛔ none | ⛔ none | ⛔ none | ×3 locales — `/interest`, `/en/interest`, `/fr/interest`, ~220s after push | | `git revert c4955ab` (⚠ NOT `-m 1` — a fast-forward, there is no merge commit) |
```

Evidence path line, prepended to the ordered block: `memory/runs/2026-08-16-interest-ceo-round.md`.

**Read the empty cells correctly.** Four `⛔ none` cells and a blank `Spend` are five honest statements:
no board, no plan file, no contract amendment, no gate memo, and nobody measured the spend. That is a
legitimate row. The single cell that may **never** be empty is the `memory/runs/` evidence path.

---

## Rules

1. **Explicit invocation only.** Never auto-run, never chain from another skill, never from an agent.
2. **One explicit go per deploy** — quoted in full at step 2. A classifier block goes to Eliran with `!`;
   never route around it.
3. **Name the commit YOUR work shipped as**, and read `git log origin/main` for the tip. ⭐ "Prod tip" has
   a shelf life of **minutes** on a multi-worktree clone; a tip copied from a card was wrong within the
   hour. Never copy a tip from a card, including this one.
4. **A green suite is not proof a component ships** — trace the route's `page.tsx`; DECLARED-UNMOUNTED
   files compile and pass.
5. **Secrets: names only, never values** — in the ledger, the runs entry, the commit message, the report
   (D8). A value in chat is BURNED: stop and route to `/rotate-secrets`.
6. **The harness never commits into the app repo from the harness repo, or vice versa.** Two repos, two
   authorities.
7. **Report a SKIP, never a silent pass.** Every closing step reports one of: written, `SKIP (<reason>)`,
   or `not applicable (<why>)`.
8. **Close with a written summary** naming: the merge hash, the deploy route used (push vs CLI), which
   aliases and locales were painted, each closing step's outcome, and every OWED row opened.

---

**Provenance** — Created 2026-08-27 · Author: habait-agent-smith, board `development/tasks/rnd-reorg/`
task **T11** · Capability item **CP-15** (P0) · Migration family **6E** · Register kept alive:
`docs/governance/SHIP-LEDGER.md` · Companions: `/rotate-secrets`, `/worktree-ops` · Agent it delegates the
preflight and paint proof to: `.claude/agents/habait-deploy-qa.md` · ⛔ No `release-manager` agent, by
ruling.
