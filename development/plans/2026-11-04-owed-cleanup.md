# OWED cleanup pass — the debts the main session can close
<!-- 2026-11-04 · main session · Eliran: "תתקן מה שצריך בעצמך" -->

## The ask
Eliran, 2026-11-04, after the open list (OWED-003, 007, 009, 016–021, 024, 026): "תתקן מה שצריך בעצמך". Harness calls are delegated to the main session (auto-memory `feedback-delegated-harness-calls`); legal wording, deletions, deploys and paid calls stay his (root §6, §8.2).

## Split — what this pass does, and what it does not
| OWED | What | Who | Territory (no overlap) |
|---|---|---|---|
| 018 + 007 + the skills' share of 019 | skill frontmatter to the standard in `.claude/skills/CLAUDE.md` (descriptions ≤ 300, `allowed-tools`, `model` never `inherit`, file-writing skills explicit-only, model-invocable `SKILL.md` ≤ 150 lines with detail moved to `references/`); decide the repo-local vs plugin duplicate per skill and record it; dead pointers inside skills | worker A (opus) | `.claude/skills/**`, `docs/skill-taxonomy.md` |
| 009 + the agents' share of 019 | re-point `habait-deploy-qa` and `habait-ux-judge` from `Habait/MVP/app` to `Projects/Habait/habait-walkaround`; dead pointers and pasted copies in agent files | worker B (sonnet) | `.claude/agents/**`, `docs/agent-team-org-chart.md` |
| 019 (rest) | dead references (`docs/harness-upgrade-plan.md`, `CONTEXT-FILE-STANDARD.md`, `MODEL-PINS.md`, `v2-plan.md`, `RETENTION.md`, `/skill-doctor`, decisions #6/#7) marked "not transferred" or removed; pasted machine-rules copies → one-line pointers to root §12 | worker C (sonnet) | `docs/**` except the two files above and `OWNER-PASTE.md`; `development/plans/**` except this file; `scripts/**`; `memory/README.md` |
| 003 | re-author the three guard hooks (`subagent-context.ps1`, `test-guard`, `agent-model-guard.ps1`) as files in `.claude/hooks/` + their settings block in `docs/OWNER-PASTE.md` §b, ready to paste | worker D (opus) | `.claude/hooks/**` (new, with its context file), `docs/OWNER-PASTE.md` |

Not in this pass: **024 (3)** a11y statement — needs the coordinator's name and contact from Eliran, then his approval and a deploy go. **016** moves touch running services and **017** is deletions — Eliran's. **020, 021** belong to the Habait session. **026** belongs to the next board that touches `tools/deploy-vercel` (it lives in the separate `Projects/Habait` repo).

## Rails for every worker
No commit, no push, no deploy, no paid call, no delete (move to `archive/` is allowed only for worker A's duplicate skills, never delete). Never open `.env*`. Never touch `memory/` — the main session writes one memory entry per worker from its return report. Touch only its own territory; other sessions are live in `development/tasks/` and `Projects/`. Never edit `settings*.json`. Every edited context file keeps its line-2 marker, stamped 2026-11-04.

## Done when
`check-context.mjs` PASS, `generate-cards.py --check` 0 missing / 0 stale, `verify-memory.mjs --strict` PASS; OWED rows 003, 007, 009, 018, 019 carry a dated note; one path-limited commit by the main session.
