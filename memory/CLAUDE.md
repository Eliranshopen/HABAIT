# memory/ — the collective memory
<!-- last-updated: 2026-11-04 -->

## What's here
The department's durable record between sessions, updated as development progresses. The contract is root `CLAUDE.md` §0 (canonical); `README.md` here repeats it with the layer table and the rotation procedure; `.claude/agents/_MEMORY_PREAMBLE.md` is the ≤ 12-line pointer every sub-agent carries. All three carry the same three marker phrases — *bounded read-first*, *second reader*, *An action is not done until its memory is written* — and `/sync-context` Check 9 fails if any file loses one.

## Key files
| File | Purpose | Rule |
|---|---|---|
| `README.md` | the contract in full: layers, read/write rules, rotation, secrets | quotes root §0, never restates it differently |
| `HOT.md` | ≤ 60 lines every actor reads first | regenerated at every `/close-board` and `/sync-context`; the main session makes it true at session end |
| `INDEX.md` | one ≤ 400-char pointer line per entry under `## agents` · `## listings` · `## project` · `## runs` | ⛔ never read whole — grep; never add a header |
| `_TEMPLATE.md` | the entry shape: Did · Evidence · Learned · Owed · Second reader | every entry uses it |

## Subfolders (leaves of one layer — each has a generated card, root §8.6)
| Folder | Holds | Written by | When |
|---|---|---|---|
| `agents/` | one file per sub-agent, newest entry last (`_about.md` explains); `orchestrator-lessons.md` for the orchestrator | the agent itself | end of every task |
| `listings/` | one file per listing id | listing agents | end of every listing task |
| `project/` | facts about the product, stack and decisions that outlive a task | main session, `codebase-cartographer` | when a fact is proven or Eliran rules |
| `runs/` | `YYYY-MM-DD-<slug>.md`, one per board or round — **append-only**, never rewritten | main session at close | every board close, every ship |

## Conventions / gotchas
- Read bounded: `HOT.md`, the tail ~150 lines of your own agent file, the listing file only when named.
- Write last, every time: no entry = the task is not done. Name the second reader.
- Never invent; never delete a memory file; names of secrets only. A live `agents/<name>.md` over 200 KB rotates onto its month shelf with an archive-index block left behind.
- Claude Code's own auto-memory for this project lives outside the repo (`~/.claude/projects/C--RnD/memory/`, index `MEMORY.md`) and is reconciled by `/sync-context` too.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md) · Contract: root §0
