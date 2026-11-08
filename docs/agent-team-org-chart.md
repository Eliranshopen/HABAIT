# Agent team — the roster
<!-- generated 2026-11-03 from .claude/agents/*.md frontmatter · owner: Eliran Shopen · regenerate rather than hand-edit the table -->

Every row is read from the definition's own frontmatter. `status` and `owner-track` are labels (root `CLAUDE.md` §10); a dormant agent is still spawnable. Models: sonnet for mechanical legs, opus for drafting and judging, never inherit.

| Agent | Track | Status | Model | Tools | Charter |
|---|---|---|---|---|---|
| `habait-brand-media` | habait | live | sonnet | Read, Write, Edit, Bash, Glob, Grep | Generates atmospheric marketing media for the public landing through the fal.ai pipeline, budget-capped and checkpointed so a retry never re-bills. |
| `habait-deploy-qa` | habait | live | sonnet | Read, Write, Edit, Bash, Glob, Grep, WebSearch, WebFetch | Runs the release preflight (staged-folder identity, local-git state, worktree provenance, habait-flow live verify, the SHIP-LEDGER row), deployed-URL QA, the browser paint-proof and the warden re-gate handoff. |
| `habait-ux-judge` | habait | live | opus | Read, Write, Edit, Glob, Grep, Bash | Judges a built surface against its design of record from captured frames and walk reports, refute-first, and writes the numbered finding table plus the reviewer's own verdict line. |
| `video-editor` | habait | live | opus | Read, Write, Edit, Bash, Glob, Grep | Turns an approved storyboard into a QA-ready render - captures, ledgered generation, corrected transcripts, the engine composition, chunked renders and the delivery set - under the machine rules. |
| `video-producer` | habait | live | opus | Read, Write, Edit, Glob, Grep, WebSearch, WebFetch | Plans one division video from the ask to an approved storyboard - brief, script, beat table, disclosure plan, engine choice and budget estimate - in the house style of video/brand/. |
| `video-qa` | habait | live | sonnet | Read, Write, Edit, Glob, Grep, Bash | Gates every division render before Eliran sees it - the measured QA plus a refute-first pass over beats, Hebrew text, disclosure, honesty, brand, audio, safe zones, spend and the delivery set, one finding per row in qa/QA.md. |
| `codebase-cartographer` | harness-ops | live | sonnet | Read, Write, Edit, Glob, Grep, Bash | Keeps the per-folder CLAUDE.md navigation layer, the root Context map and the memory reconciliation current - the writer behind /sync-context. |
| `compliance-warden` | harness-ops | live | sonnet | Bash, Read | The pre-publish and pre-ship compliance gate - the deterministic structural check plus judgement on add-only and disclosure - and the author of the numbered gate memo. |
| `secrets-steward` | harness-ops | live | sonnet | Read, Grep, Glob, Write, Edit | Keeps docs/governance/SECRETS-LEDGER.md current by credential NAME - where it lives, exposure event, rotation state, and the checklist Eliran executes. |
| `capability-scout` | research | live | sonnet | Read, Write, Edit, Bash, Glob, Grep, WebSearch, WebFetch | Surveys and LIVE-PROBES candidate APIs, data sources and tools into evidence files, with the verdict vocabulary WORKS-TODAY / WORKS-WITH-KEY / PAID / BLOCKED / DEAD. |

## Counts

| Track | live |
|---|---|
| habait | 6 |
| harness-ops | 3 |
| research | 1 |

18 definitions were archived 2026-11-03 to `archive/agents/` (plan `development/plans/2026-11-03-harness-focus.md`); restore = move back. Product build work goes to the 7 project agents in `Projects/Habait/.claude/agents/`. No definition holds `Agent` now (`orchestrator` archived). Definitions with no Bash by construction: `secrets-steward`, `video-producer`.
