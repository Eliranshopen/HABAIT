# Sub-agent memory pointer — the block every definition carries
<!-- last-updated: 2026-11-03 · owner: Eliran Shopen -->
Non-fork sub-agents load the `CLAUDE.md` hierarchy, so root `CLAUDE.md` §0 is the contract they inherit. A definition therefore carries a **pointer, not the contract** — the block below, ≤ 12 lines. The `SubagentStart` hook (`.claude/hooks/subagent-context.ps1`) prints the hot slice at spawn once Eliran installs it (`docs/OWNER-PASTE.md`); until then the root card plus this block are the bind.

## The block (paste into every new definition — ≤ 12 lines)
```
## Collective memory — bounded read-first, write-last (non-negotiable)
You inherit the harness root `CLAUDE.md` (its §0 is the contract; `memory/README.md` has the full text).
**Before acting:** read `memory/HOT.md` (≤ 60 lines, regenerated at every `/close-board` and
`/sync-context`), then the LAST ~150 lines of `memory/agents/<your-name>.md` plus its archive-index
block, and `memory/listings/<listing-id>.md` only if the task names a listing.
⛔ Never read `memory/INDEX.md` whole — grep it.
**Before returning:** append ONE entry (`memory/_TEMPLATE.md`) to `memory/agents/<your-name>.md` — or
the layer that owns the fact (`memory/listings/<id>.md` · `memory/project/` · `memory/runs/`) — plus
ONE ≤ 400-char pointer line to `memory/INDEX.md` under that layer's existing header (never add a header).
Name the **second reader** — the other actor who must know this — and append one pointer line
(`→ see <entry> — why it binds you`) to their `memory/agents/<name>.md`, or say "none".
An action is not done until its memory is written.
```

## Substitutions (preserve, don't flatten)
_Agents marked (archived) live in `archive/agents/` since 2026-11-03; their substitutions are kept for a restore._
- `<your-name>` → the agent's own memory filename. **`orchestrator` (archived) writes `orchestrator-lessons.md`**, holds no Write/Edit/Bash, and keeps its "delegate the write to a worker" paragraph under the block. On first run an agent creates its file from `memory/_TEMPLATE.md` and adds the INDEX line (`memory/agents/_about.md`).
- The listing read is for listing agents only; every other agent keeps its own third read — the plan or board (`codebase-cartographer`), the surface's `memory/project/` entries (`habait-brand-media`), `360walkaround/V2-PLAN.md` + the task file (`render-pipeline-engineer`, archived), `3D/MVP-PLAN.md` §2 + `3D/mvp/CONTRACT.md` (`walkthrough-engineer`, archived).
- Extra bounded reads and write targets already in a definition stay, bounded the same way — never add a new one: `compliance-warden` (`memory/project/verified-tech-stack.md` legal section; gate verdict → the listing), `scraper` (archived; `agents/sourcing.md` + `agents/deal-sourcing-researcher.md` tail slices; pull outcome → `memory/runs/`), `habait-asset-wrangler` (archived; the flagship listing file).
- ⛔ `secrets-steward` holds no Bash and may never open `.env*` or an env backup; its copy states that the "reading past these slices" sentence never licenses a read that could touch a VALUE — names only, in the entry and in the INDEX line.
- `router` (archived) keeps its deliberately compressed **two-line** form. Keep it compressed; bound it anyway.

## The lint
```
ls .claude/agents/*.md | wc -l                              # N (13 on 2026-11-04: 10 definitions + CLAUDE.md, _TEMPLATE.md, this file)
grep -l "bounded read-first" .claude/agents/*.md | wc -l    # must equal N
grep -L "bounded read-first" .claude/agents/*.md            # must print NOTHING
```
The marker phrase is `bounded read-first` and lives in the block's own heading, so every copy carries it — this file and `CLAUDE.md` included, which is why the expected `-L` output is empty. `-L` alone also prints nothing when the glob matches nothing, so always pair it with the count identity. A file `-L` lists is a definition whose pointer was never updated — fix the definition, not the lint.
