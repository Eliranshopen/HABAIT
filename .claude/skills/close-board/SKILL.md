---
name: close-board
description: "Close ONE board as a single motion: verify every status against git, cap the ship summary, update the fielded row, answer the gate question, then file the lessons, garden memory, propose promotions and commit the records. Explicit invocation only; it never files a gate memo, never fakes a status."
user-invocable: true
disable-model-invocation: true
argument-hint: "<board-slug> [--dry-run]"
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent
model: opus
---

# /close-board — a board is closed when its record is TRUE, not when its tasks stop

> ▶ **Local commits resumed (Eliran, 2026-11-04: "כן").** Identity is set and the repo is local only (root `CLAUDE.md` §8.7, §11). Step 1(a) (resolve a harness-root hash) and Step 11 (ONE path-limited commit of the records) run against local git on `main`. ⏸ Still suspended — no remote: every step that pushes, fetches, tags, opens a git worktree, compares to `origin/main` or touches the app repo; report it as `SUSPENDED (no remote)` and carry on with the rest. Working folders are plain copies under `C:\RnD\.wt\<name>` (root `CLAUDE.md` §8.7). The product is `Projects/Habait/habait-walkaround/`, not `Habait/MVP/app` (OWED-009).

**The eleven steps, in order** (the detail the frontmatter description no longer carries, trimmed
2026-09-08 to one trigger sentence per `.claude/skills/CLAUDE.md`): 0 orient · 1 verify every task
status against git, in the right repository · 2 the capped ship summary in the board README · 3 the
fielded row in `development/tasks/CLAUDE.md`, fixed State vocabulary · 4 the gate answer + any
reservation row it left in the gate-number register · 5 the `memory/runs/` entry + one ≤400-char INDEX
pointer · 6 an OWED row per debt left owed · 7 the `SHIP-LEDGER.md` row, if the board shipped app code
and the row is missing · 8 lessons · 9 garden · 10 promote · 11 records. ⛔ It never files a gate memo,
never claims a gate number, and never rewrites a board's history to make a status true.

**Taxonomy: group C · Harness ops** (`docs/skill-taxonomy.md` §2). Created 2026-08-27, board
`development/tasks/rnd-reorg/` T20, capability item **CP-19** (depends on CP-45's fielded table and
CP-09's retention/shelf rules).

**Explicit invocation only.** `disable-model-invocation: true` — no model auto-selects this skill; only a
typed `/close-board` runs it. Closing a board writes into four registers and one append-only log; that is
not a motion any model should start on its own initiative.

**Why this exists (the measured failure, four times over).** Boards in this repo do not fail to *ship* —
they fail to *say so*:

1. Two V6 boards sat on "BOARD READY … awaiting Eliran's go" for **21 days** after their real deploy
   (`habait-landing-v6-fixes` / `-redesign`, corrected 2026-08-27 by `rnd-reorg` T04).
2. `habait-a11y-cookies/README.md`'s header read *"OPEN — no task started"* directly above a real
   production merge (`5173bb5`, 2026-08-26) that no sentence in the board ever cited.
3. `habait-auth-modal`'s T12 was described as "never pushed" across the card, several memory entries and
   the board's own intro — true when written, made false by a *later* task's merge chain that nobody
   cross-checked.
4. And the shape this skill is named for: **`OWED-008` is a board close-out that is itself an open debt**
   (`habait-buyer-playbook` — the code shipped, the flags closed, the bookkeeping did not).

⭐ **The law behind all four:** *a board card records what a board INTENDED; only git records what
shipped.* An uncited status sentence is unverifiable **by construction** — it just sits there until
someone happens to re-measure it. Everything below exists to make that impossible for one board.

---

> **The six-step close since 2026-10-22 (D-AUD-21, V-03):** 0–1 · 3 · 4 · 5 · 8 · 11, with 6 kept narrowed; steps 2, 7, 9 and 10 are retired stubs below, their text in RETIRED-2026-10-22.md. The garden (rotation, strict caps) runs in /sync-context Target 3e; R-9's strict placement moved there and here (D-AUD-18).

## Step 0 — orient (2 minutes, always)

Read, in this order: the board's own `README.md` (its task table + any standing rails), its
`run-tasks.md` if one exists, `development/tasks/CLAUDE.md` (the board convention, the State vocabulary,
the 6D spot-check recipe), `docs/governance/OWED.md` (§1 rules), and `docs/governance/SHIP-LEDGER.md`
(line 1 + §3). Then state, in one line each:

- **which board** (slug) and how many task files it has (`ls development/tasks/<slug>/task-*.md | wc -l`);
- **which repository its work landed in** — the harness root repo, `Habait/MVP/app` (a separate repo), or
  both. ⛔ Decide this before step 1; it changes how every hash is checked.
- **whether the board shipped anything to a surface real users hit** — this decides steps 3 and 7.

---

## Step 1 — VERIFY EVERY TASK STATUS AGAINST REALITY

The board's task table and the task files are two surfaces for one fact. Read **both**, and treat any
disagreement as a finding, not a formatting nit (`rnd-reorg` T19 found a board under-reporting its own
ship this exact way).

```
grep -m1 "^\*\*Status:\*\*" development/tasks/<slug>/task-*.md      # per-file claim
grep -oE "^\| T[0-9]{2} \|.*"  development/tasks/<slug>/README.md   # per-row claim
```

**The rule being enforced** (`development/tasks/CLAUDE.md`, minted by `rnd-reorg` T10):

> ⭐ **any board README asserting a ship state MUST cite the commit hash(es).**

For every row marked done, extract its hashes and resolve each one. **Which command depends on the
repository — this is the step's whole difficulty:**

**(a) A harness-root commit** — the board's own docs, cards, memory, skills:

```
git cat-file -e <hash>^{commit} && git log -1 --format='%h %s' <hash>
```

**(b) An app-repo commit** — anything under `Habait/MVP/app`. Use the 6D recipe verbatim:

```
git -C C:/RnD/.wt/buyer-playbook merge-base --is-ancestor <hash> origin/main && echo shipped
```

- ⛔ **Never bare `git <cmd>` from the harness root for an app hash** — different repository; it fatals.
- ⛔ **Never check against `HEAD`** in the app repo: the main checkout is parked on an old branch. Name
  `origin/main` explicitly and prefer a worktree.
- Degrades to `SKIPPED — app tree absent` on a machine without the app cloned (`SETUP.md` §1). Don't
  fatal, don't guess.

⭐ **A hash missing from the harness log is not automatically a lie — check the other repo before you
call it one.** Measured on this skill's own dry run: 4 of 39 hashes cited across one board resolved only
in the app repo, and three of those four were ancestors of `origin/main` (the fourth, `6ecfe9d`, is a
real unmerged commit and a real finding).

**When a done row cites NO hash at all**, do not stop at "fails the rule". Find out which of two very
different things is true, because they have different remedies:

```
git log --oneline --grep="<board-slug> T<NN>"
```

- **Commits exist** → this is a **citation failure**. Write the hashes into the row. Cheap, and the row
  becomes checkable by anyone in seconds.
- **No commits exist** → this is a **status failure**. The row is not done. Say so plainly and leave it
  open; ⛔ never edit a task file to make a false ✅ true.

⚠ **Put the board slug inside the `--grep`.** Task numbers are **per-board namespaces**, and a bare
`--grep="T17"` is measurably wrong: on this repo it returns `habait-a11y-cookies` T17/T18 and a Landing
V10 T17 alongside the board you meant.

**Report the outcome as three counts**, never as prose: rows done / rows done-and-cited / rows still
open, plus a per-row line for every failure with its remedy.

---

## Step 2 — RETIRED 2026-10-22 (D-AUD-21, the six-step close): MERGED into Step 11.1, the board README header (V-28). Its text, verbatim, is in [RETIRED-2026-10-22.md](RETIRED-2026-10-22.md).

## Step 3 — THE FIELDED ROW IN `development/tasks/CLAUDE.md`

One row, fielded, in the table that already exists. ⛔ **Do not create a `STATUS.md` for the board and do
not add a fourth status surface** — that was refused by name in the plan (CP-45).

`| Board | Filed | State | Plan | Gate |`

**The `State` vocabulary is FIXED — use one of these eight words, exactly:**

`SHIPPED` · `DEPLOYED-PREVIEW` · `BUILT-NOT-SHIPPED` · `IN-PROGRESS` · `OPEN-NOT-STARTED` ·
`RESEARCH-ONLY` · `PARTIAL-BOARD` · `CLOSED`

(Eight state words, and separately the `Ship commit` verification marks — `✓` for a live
`merge-base --is-ancestor` pass, `SKIPPED — app tree absent`, and `UNVERIFIED-<reason>` with the reason
stated. ⛔ Never round an unverified cell up to `✓`.)

- **`Spend` blank = nobody measured it. Never estimate.**
- **An honest gap is a finished cell.** Eight rows in that table already carry SKIPPED/UNVERIFIED cells
  on purpose; a future pass closes them by measuring, not by re-guessing.

```
SKIP (step 3 fielded row): development/tasks/CLAUDE.md not present
```

---

## Step 4 — THE GATE CHECK, AND THE RESERVATION IT MAY HAVE LEFT OPEN

**4a — did this board's work get gated?** Re-measure at run time; never trust a remembered number:

```
ls Habait/MVP/docs/compliance-gate-*.md | wc -l
ls Habait/MVP/docs/compliance-gate-*.md | sort -V | tail -3
grep -l "<board-slug>" Habait/MVP/docs/compliance-gate-*.md
```

Then write **one** of exactly two sentences into the close-out record:

- *"Gated by `compliance-gate-NN.md` (verdict, date, scope)"* — naming the memo, or
- *"This board shipped boardless/gateless by ruling"* — naming **whose** ruling and where it is written.

⛔ **Never leave the question unanswered.** An unstated gate is the shape of `OWED-005` (a live,
PII-collecting surface that has shipped twice with no gate memo, no QA report and no plan).

⛔ **This skill never files a gate memo and never claims a number.** Filing is compliance-warden's act;
`/close-board` only records which of the two sentences is true. If the board *needs* a gate it never
got, that is an **OWED row in step 6**, not a number taken here.

**4b — close any reservation row in `Habait/MVP/docs/GATE-NUMBER-REGISTER.md` §3.** If the board reserved
a number, set its `Status` to the fate that actually occurred, using that file's own vocabulary:

`HELD` (stands, nothing filed) · `SPENT-BY-OTHER` (another board filed it first) · `RELEASED` (the board
no longer holds it)

⛔ **A released number goes back into NOTHING, never into supply — a hole stays a hole.** And ⭐ *a
reservation in a board README is not a claim on a number; only a filed memo is* — the register's §2 rule,
proven three times by real collisions (#56, #58, and the auth-modal residue).

```
SKIP (step 4b reservation): Habait/MVP/docs/GATE-NUMBER-REGISTER.md not present
SKIP (step 4b reservation): no §3 row names this board — nothing to close
```

---

## Step 5 — THE `memory/runs/` ENTRY + ONE INDEX LINE

- One entry, `memory/runs/YYYY-MM-DD-<board-slug>-close.md`, in `memory/_TEMPLATE.md`'s format:
  frontmatter (`date`, `actor`, `type`, `tags`, `listing`) then *What happened · Why it matters ·
  Next / watch*.
- ⭐ **This is the one non-negotiable step.** A boardless ship is survivable; an unrecorded one is not.
- `memory/runs/` is **APPEND-ONLY**. ⛔ Never edit an existing entry — correct forward with a new one
  that names what it supersedes.
- Add **exactly one** pointer line under `memory/INDEX.md`'s **`runs/`** header. ⛔ **Never add a header**
  — the index has exactly FOUR (`project/` · `runs/` · `listings/` · `agents/`). The cap is **≤ 400
  characters**: the link plus ONE hook sentence, forward-only for entries dated 2026-08-28 or later.
- Then verify:

```
node .claude/skills/sync-context/verify-memory.mjs        # expect CLEAN
```

```
SKIP (step 5 memory): memory/runs/ not present
```

---

## Step 6 — WHAT STAYS OWED → `docs/governance/OWED.md`

One row per DEBT with a named actor and a source that resolves — never a row for every flag or wish (narrowed 2026-10-22, D-AUD-21, V-32: 386 of 466 rows were open with a median age of 42 days on 2026-10-20); the board's own open rows are closed or carried forward by id. Compute the next id — ⛔ **ids are
never reused, not even after a row closes:**

```
grep -oE "OWED-[0-9]{3}" docs/governance/OWED.md | sort -u | tail -1
```

Rules from that file, all binding:

1. **Every row opens from a named artifact on disk** — a gate flag, a QA finding, a plan/contract clause,
   a `memory/runs/` entry, or a measured absence. The `Source` cell must resolve.
2. **`Owner` is never blank and never "TBD."** If nobody owns it, it is not a debt, it is a wish.
3. **One line per row. Hard cap.** Detail lives in the `Source`.
4. **Where a source document forbids a characterisation, reproduce the prohibition verbatim.** An
   `OPEN` state must never become readable as "sent and awaiting a reply."
5. **Secrets: names only, never values** (D8).
6. `Age` is **computed, never stored** — the file carries one `As-of` stamp; refresh that, not the rows.

⭐ **Unpaid consequences of a ship belong here, not in the ledger. A model-pin change belongs in
`MODEL-PINS.md` (not transferred), not in either.**

```
SKIP (step 6 OWED rows): docs/governance/OWED.md not present
```

---

## Step 7 — RETIRED 2026-10-22 (D-AUD-21, the six-step close): MERGED into Step 1, which resolves every cited hash against SHIP-LEDGER.md (V-33); the ledger row is written at ship time. Its text, verbatim, is in [RETIRED-2026-10-22.md](RETIRED-2026-10-22.md).

## Step 8 — LESSONS: the `project/` facts this board EARNED (added 2026-09-08)

⭐ **A close without lessons is not a close.** For every rule, gotcha or law this board *proved*, write or
refresh ONE entry under `memory/project/`, each one linking the evidence that earned it — a commit, a
gate memo, a `qa-evidence/` path, or the command that measured the number.
- ⛔ **No lesson without a link.** An unlinked claim is the uncited-status failure of step 1 in a new costume.
- **One fact, one home:** refresh the existing `project/` entry on that topic; never mint a second one beside it.
- A fact the board only *suspects* is not a lesson — it is a `Next / watch` line in the step-5 runs entry.
- Name the **second reader** for each lesson (the other actor it binds) and give them one pointer line.

Pointer: layers, entry format and the pointer wording live in `memory/README.md` — quote it, never restate it.
Source: harness upgrade plan (`docs/harness-upgrade-plan.md` (not transferred)), wave 3.

---

## Step 9 — RETIRED 2026-10-22 (D-AUD-21, the six-step close): MERGED into /sync-context Target 3e, the garden (V-20, V-35); the pass that runs enforces the caps. Its text, verbatim, is in [RETIRED-2026-10-22.md](RETIRED-2026-10-22.md).

## Step 10 — RETIRED 2026-10-22 (D-AUD-21, the six-step close): MERGED into Step 8: a lesson whose topic already has a project/ entry is the second earning and is proposed there (V-36). Its text, verbatim, is in [RETIRED-2026-10-22.md](RETIRED-2026-10-22.md).

## Step 11 — RECORDS: generated header, untracked board, ONE path-limited commit (added 2026-09-08)

1. **Copy the newest Key-state line into the board README header by hand, dated** — UNENFORCED: no header generator exists (OWED-242, open since 2026-09-08; relabelled 2026-10-22, V-37). The failure this guards: a header read "NOT STARTED" over a live board three times.
2. **`git ls-files development/tasks/<slug>/`** — an EMPTY result means the board is untracked: open an OWED row
   (step 6) **and** stage the board directory, in this same turn (R-15).
3. **Commit the records in the SAME turn as the edits, path-limited:**
   `git add docs/governance/OWED.md docs/governance/DECISIONS.md development/tasks/<slug>/ memory/runs/<entry> memory/INDEX.md`
   then one commit naming the board slug.
4. ⛔ **Never `git add -A`**, ⛔ never stage `Habait/MVP/docs/research/karnei-assets/` (R2), and ⛔ never commit
   into the app repo from here — two repos, two authorities (rule 6).

Pointer: which layer each memory path belongs to is `memory/README.md`'s answer, not this step's.
Source: harness upgrade plan (`docs/harness-upgrade-plan.md` (not transferred)), wave 5 (R-15).

---

## Registers this skill writes

| Register | What this skill writes | If absent |
|---|---|---|
| `development/tasks/<slug>/README.md` + its `task-*.md` | verified statuses with hashes; the capped ship summary | `SKIP`, reported |
| `development/tasks/CLAUDE.md` | one fielded row, fixed State vocabulary | `SKIP`, reported |
| `Habait/MVP/docs/GATE-NUMBER-REGISTER.md` | **only** the fate of a §3 reservation row this board opened | `SKIP`, reported |
| `memory/runs/<date>-<slug>-close.md` + `memory/INDEX.md` | the close entry + one ≤400-char pointer under `runs/` | `SKIP`, reported |
| `docs/governance/OWED.md` | one row per debt left owed | `SKIP`, reported |
| `docs/governance/SHIP-LEDGER.md` | one row + its evidence path, only if the board shipped app code | `SKIP` — usually legitimate |

⛔ **This skill never writes** a `compliance-gate-NN.md` memo (compliance-warden's, at filing time), a QA
report (`habait-deploy-qa`'s), `docs/governance/SECRETS-LEDGER.md` (see `/rotate-secrets`),
`docs/governance/MODEL-PINS.md` (not transferred) (see `/run-eval`), or `docs/governance/WORKTREES.md` (see
`/worktree-ops`). ⛔ It also never **deploys** — a board that still needs a deploy is `/ship`'s job first,
`/close-board`'s second.

**Every register step reports one of three things: written, `SKIP (<reason>)`, or
`not applicable (<why>)`. Never a silent pass.** A reverted register must leave no dangling step
(`MIGRATION-DRAFT.md` §10.5).

---

## Dry description-run — this board, `development/tasks/rnd-reorg/`, measured 2026-08-27

⛔ **Description only — nothing below was written.** `rnd-reorg` is **IN-PROGRESS**; its real close-out is
its own **T24**, and this run exists to prove the sequence against the board that will consume it. Every
number was measured, not carried from a plan.

**Step 0.** Board `rnd-reorg`, 25 task files (T00–T24), work landing in the **harness root repo** on
branch `reorganization`. Nothing on this board deploys to a user-facing surface.

**Step 1 — the interesting result.** 18 of 25 rows are marked ✅; 7 are open (T01, T13, T15, T20, T22,
T23, T24). Of the 18:

- **7 pass outright** — T00 `93d6d43` · T02 `b939717`/`64364e2`/`4351917` · T03 `c2a38c8`…`c13d957` ·
  T04 `02c7d3e` · T06 `036ff92`…`d36c958` · T07 `9ece2a9`/`23d6b66` · T16 `056784c`/`43dbc63`. All
  resolve in the harness log.
- **11 FAIL the citation rule** — T05, T08, T09, T10, T11, T12, T14, T17, T18, T19, T21 cite **no hash**
  in either the README row or their own `Status:` line. ⭐ **And every one of them is a citation failure,
  not a status failure**: `git log --oneline --grep="rnd-reorg T<NN>"` finds the commits for all eleven
  (T05 `91a8865`…`c93a599`, T08 `040c261`/`05453c7`/`884e749`, T09 `5f11ba4`/`1d0e8b4`, T10 `d392b56`,
  T11 `1ca7870`/`8474d5b`, T12 `f60a12a`, T14 `bbceda2`/`b0c5b1f`/`b573658`, T17 `80adf3f`,
  T18 `dacdc1e`/`fdc6ddd`, T19 `079bb4d`…`864c9d7`, T21 `29465cb`). Remedy: write them in. **The board
  that minted the commit-citation rule is 11 rows in breach of it** — which is exactly why this is a
  step in a skill and not a line in a convention document.
- **Two partial citations worth naming:** T02's 1A commit is deliberately *sequenced behind T01* and says
  so ("hash to be added when it lands") — an honest placeholder, not a breach; T06 cites `5B-1` and
  `<see git log: README + docs card row>` where hashes belong — placeholders that read like citations.
- **Two-repo check:** 39 distinct hashes appear across the board's files; **35 resolve in the harness
  repo and 4 only in the app repo** (`5173bb5`, `c30b1f4`, `70a01b3` — all ancestors of `origin/main`;
  `6ecfe9d` — exists but is **NOT** an ancestor, the known T07m finding, already tracked as T23.4).

**Step 2 — what the ship summary would say.** This board has no ship: a few lines stating
**IN-PROGRESS → CLOSED (harness-internal, no deploy)**, the cluster merge commit(s) once T24 merges
`reorganization` to `main`, and a link to `memory/runs/2026-08-27-rnd-reorg-*.md` (19 entries and
counting). ⛔ Not a retelling — the board's 25 task files already carry the detail.

**Step 3 — the fielded row.** Its row exists and currently reads `IN-PROGRESS` · `#59 CLEAR ×3 (T00
pre-gate)` · Ship commit `— (in-progress; no single ship-shaped deliverable)` · Blocking *"T01 awaiting
Eliran's `!` deletion commands"* · Spend `$0 (docs-only so far)`. At close it becomes **`CLOSED`** (the
vocabulary word for retired-and-will-not-resume) or **`SHIPPED`** only if T24's merge is treated as this
board's ship — a call for T24, not for this description. ⚠ The `Spend` cell needs re-measuring: `$0` was
true when written, and T20 spent $0, but the board has since run gate passes and evals elsewhere.

**Step 4 — the gate check.** Two memos name this board, and **neither is a closing gate**:
`compliance-gate-59.md` (T00 pre-gate, CLEAR ×3, scoped to the three T01 deletion families) and
`compliance-gate-60.md` (T07 post-write pass over the two registers, CLEAR ×2). The glob measures **53**
files, highest filed **#60**. ⇒ The close-out sentence available today is *"gated in two scoped passes
(#59, #60); the whole-board closing gate is T24's and is not yet filed"* — i.e. **an OWED row, not a
number taken here.** Step 4b: `grep "rnd-reorg" GATE-NUMBER-REGISTER.md` returns three mentions, **none
of them a §3 reservation row** — this board never reserved a number, it re-measured and took #59 above
the highest spent one (the register cites that as its worked example of the procedure done right). ⇒
`SKIP (step 4b reservation): no §3 row names this board`.

**Step 5 — memory.** Nineteen `memory/runs/2026-08-27-rnd-reorg-*.md` entries already exist (one per
task, per the board's own rule 5). The close adds one more, `-t24-close-out.md`, plus one ≤400-char
INDEX line under the single `runs/` header.

**Step 6 — the OWED rows it would file today** (ids continue from the highest on disk, currently
`OWED-010`; ⛔ never reuse):

| Would-be row | Class | Owner | Source that resolves |
|---|---|---|---|
| **D14 unruled** — design-skill precedence; `docs/skill-taxonomy.md` §4 ships a **PROVISIONAL** Navigator-mode default flagged for audit | DOC | **Eliran** (a ruling is Eliran's act) | `development/tasks/rnd-reorg/README.md` decision ledger, D14 row · `docs/skill-taxonomy.md` §4 |
| **T01 unexecuted** — the three deletion families (2E, 2F, D4) cleared by gate #59 and awaiting Eliran's own `!` commands; **T02's 1A commit is sequenced behind it** and cannot land first | DOC | **Eliran** (classifier: the deletion is Eliran's hand) | `development/tasks/rnd-reorg/task-01-dead-weight-closure.md` · `Habait/MVP/docs/compliance-gate-59.md` |
| **T24's closing gate not filed** — the board's own definition-of-done | GATE-FLAG | main session (to commission) → compliance-warden (to run) | `development/tasks/rnd-reorg/task-24-close-out.md` |
| **11 uncited done rows** (step 1) — if they are not repaired *during* the close | DOC | main session | this dry run + `development/tasks/CLAUDE.md`'s citation rule |

⚠ Also live but **not** this board's to open: `OWED-008` (buyer-playbook close-out) is the same
close-out debt on a different board and would be *discharged* by running this skill there, not
duplicated here.

**Step 7 — the ship-ledger row.** `SKIP (step 7 ship-ledger row): harness-root board — the ledger's scope
is the app repo (line 18)`. ⭐ **This is the correct outcome, not a gap** — and it is the reason step 7
opens with a scope gate instead of a template.

---

## Rules

1. **Explicit invocation only.** Never auto-run, never chain from another skill, never from an agent.
2. **Measure, don't recall.** Every count, hash, gate number and file list is re-derived at run time.
   Numbers in this file are dated examples, not inputs.
3. ⛔ **Never edit a task file or README to make a false status true.** A row whose commits do not exist
   is not done; write the truth and leave it open.
4. ⛔ **Never renumber a gate, never fill a hole, never claim a number.** Only a filed memo claims one.
5. **Forward-only conventions stay forward-only** — the ship-summary cap does not authorise rewriting the
   21 boards that already carry a full retelling, and `memory/runs/` is never edited.
6. **Two repos, two authorities.** The harness never commits into the app repo, or vice versa. Check each
   hash in the repository it belongs to.
7. **Secrets: names only, never values** (D8) — in the board, the summary, the OWED row, the commit
   message.
8. **Report a SKIP, never a silent pass**, and close with a written summary naming: rows verified /
   cited / still open, the gate sentence chosen, every register written or skipped with its reason, and
   every OWED id opened.

---

**Provenance** — Created 2026-08-27 · Author: habait-agent-smith, board `development/tasks/rnd-reorg/`
task **T20** · Capability item **CP-19** (P2; depends on **CP-45** fielded board status and **CP-09**
retention) · Registers kept alive: `docs/governance/OWED.md` + the board status table · Companions:
`/ship` (deploy first, close second), `/run-eval`, `/sync-context` · Conventions it enforces:
`development/tasks/CLAUDE.md` (T10 commit-citation rule, T19 ship-summary cap, the State vocabulary),
`Habait/MVP/docs/GATE-NUMBER-REGISTER.md` §2/§3, `docs/governance/OWED.md` §1,
`docs/governance/SHIP-LEDGER.md` line 1 + §3 · Dry-run subject: this same board, measured 2026-08-27.
