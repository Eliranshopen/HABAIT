# _TEMPLATE.md — how to author a new sub-agent definition
<!-- last-updated: 2026-11-03 · owner: Eliran Shopen -->
Copy the two blocks below into `.claude/agents/<name>.md`, fill them in, then run the lints at the bottom.

⚠ **This file is deliberately NOT a loadable definition.** Its frontmatter sample is fenced and indented two spaces so (a) the registry cannot spawn a phantom agent called `_TEMPLATE`, and (b) the column-0 lints (`grep -l "^status:"`) keep counting definitions only. **Strip the two-space indent when you paste**, and keep `---` on line 1 of the real file.

## 1. Frontmatter — exactly nine keys, in this order
```yaml
  ---
  name: <kebab-case, matches the filename>
  description: "One paragraph, DOUBLE-QUOTED — what this agent does, what it refuses, and a 'Use for…' routing hint. Unquoted is a load failure: a plain scalar containing ': ' is a mapping indicator, and ' #' silently truncates the value."
  model: sonnet
  tools: Read, Write, Edit, Bash, Glob, Grep
  color: blue
  status: live
  owner-track: habait
  charter: "ONE quoted line - what this agent is for. A dormant agent's charter also carries its own last-measured activity date."
  boundary: "ONE quoted line - what it must NOT do and who takes that job instead; say whether the rail is an ABSENT TOOL (unarguable) or a PROMPT RULE (arguable)."
  ---
```
- **`model:` is `sonnet` or `opus` — never `inherit`** (root `CLAUDE.md` §10.4): sonnet for reading, verifying and mechanical legs; opus for drafting and judging.
- `status:` `live` · `dormant` · `archived` · `owner-track:` the closed set `habait` · `visualizer` · `agency` · `harness-ops` · `research` (a sixth value means editing `docs/agent-team-org-chart.md` first, not inventing a string here).
- ⛔ **Both prose keys and `description:` are DOUBLE-QUOTED, always**; write inner quotes as `'…'` so no escaping is ever needed. **No new definition gets `Agent` in `tools:`** — the agent tree is exactly one level deep and `orchestrator` alone holds it.
- Never a tool the boundary line says the agent must not have: an absent tool is the only rail that cannot be argued with.

## 2. Body — the memory pointer first (≤ 12 lines, verbatim from `_MEMORY_PREAMBLE.md`)
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
Substitute per `_MEMORY_PREAMBLE.md` ("Substitutions") — own memory filename, the third read when the agent is not a listing agent, any extra bounded read the agent already owed.

## 3. If the agent holds `Bash`, paste this line into its rules section, verbatim
- ⚠ **Machine resource rules** — root `CLAUDE.md` §12 owns the text (`timeout N <cmd>`, one heavy run at a time, foreground only); follow it as written.

## 4. Then a boundary line in the body
- **Boundary (repeat the frontmatter `boundary:` in the body, in prose):** the paths this agent may write, the register rows it owes, what it hands to whom, and the one thing it must never do. Name the owner of every job it refuses — a boundary with no named taker is a gap, not a rail.

## 5. The lints — run all of them after authoring, paste the counts into the writeback
The lint block lives in one place: `.claude/agents/CLAUDE.md`, section "Lints" — run it as written.

Then parse every frontmatter block with `js-yaml` (or a strict regex fallback) and report `parsed N/N, nine keys each` — the registry is read at SESSION START, so a parse failure hides the agent until the next session. Roster narrative: `docs/agent-team-org-chart.md`; skills: `docs/skill-taxonomy.md`; `habait-agent-smith` (archived 2026-11-03; the main session holds this duty) owns this file and every definition in this folder.
