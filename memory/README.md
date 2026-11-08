# memory/ — the collective memory (the contract is root `CLAUDE.md` §0; this copy adds the layer table and the rotation procedure, kept in step by `/sync-context` Check 9)
<!-- created: 2026-11-03 · owner: Eliran Shopen -->

Every session and every sub-agent reads first and writes last. The memory is the department's only durable record between sessions; the chat transcript is not.

## Layers
| Path | Holds | Written by |
|---|---|---|
| `HOT.md` | ≤ 60 lines: what every actor must know right now. Regenerated at every `/close-board` and `/sync-context`; never hand-grown past the cap | the main session |
| `INDEX.md` | one ≤ 400-char pointer line per entry, under four fixed headers (`agents` · `listings` · `project` · `runs`). ⛔ Never read whole — grep it | every writer |
| `agents/<name>.md` | one file per sub-agent: its lessons, in dated entries | that agent (the orchestrator writes `orchestrator-lessons.md`) |
| `listings/<id>.md` | everything learned about one listing | listing agents |
| `project/` | facts about the product and the stack that outlive any task | the main session, cartographer |
| `runs/` | one entry per board or round: what shipped, what it cost, what is owed | the main session at close |
| `_TEMPLATE.md` | the entry shape | — |

## The contract
1. **Before acting (bounded read-first):** read `HOT.md`, then the LAST ~150 lines of your own `agents/<name>.md` plus its archive-index block, and `listings/<id>.md` only if the task names a listing. Never `INDEX.md` whole.
2. **Before returning:** append ONE entry (`_TEMPLATE.md`) to the layer that owns the fact, plus ONE pointer line in `INDEX.md` under that layer's existing header (never add a header). Name the second reader and add one pointer line to their file, or say "none".
3. **An action is not done until its memory is written.**
4. **Rotation:** a live `agents/<name>.md` over 200 KB rotates onto a month shelf (`agents/<name>.<YYYY-MM>.md`), with an archive-index block left in the live file and the `INDEX.md` lines repointed in the same change.
5. **Secrets never enter memory** — names only (root §8.1).

On first run an agent creates its own file from `_TEMPLATE.md` and adds its INDEX line (`agents/_about.md`).


## Layer table with the When column
(Moved from root `CLAUDE.md` §0.1 on 2026-11-04, wording unchanged.)

| Path | Holds | Written by | When |
|---|---|---|---|
| `memory/HOT.md` | ≤ 60 lines: what every actor must know right now | the main session (regenerated at every `/close-board` and `/sync-context`) | every pass |
| `memory/INDEX.md` | one ≤ 400-char pointer line per entry under four fixed headers (`agents` · `listings` · `project` · `runs`). ⛔ Never read whole — grep it | every writer | with every entry |
| `memory/agents/<name>.md` | one file per sub-agent: its lessons, dated, newest last | that agent (`orchestrator` writes `orchestrator-lessons.md`) | end of every task |
| `memory/listings/<id>.md` | everything learned about one listing | listing agents | end of every listing task |
| `memory/project/` | facts about the product, the stack and the decisions that outlive any task | the main session, `codebase-cartographer` | the moment a fact is proven |
| `memory/runs/YYYY-MM-DD-<slug>.md` | one entry per board or round: what shipped, what it cost, what is owed. **Append-only** — correct with a new entry, never a rewrite | the main session at close | every board close, every ship |
| `memory/_TEMPLATE.md` | the entry shape: Did · Evidence · Learned · Owed · Second reader | — | — |
| `memory/README.md` | this contract in full, plus size discipline | — | — |