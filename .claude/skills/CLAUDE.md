# .claude/skills/ — harness skills
<!-- last-updated: 2026-11-04 -->

## What's here
Every `/skill` the main session can invoke — one folder per skill, each with its own `SKILL.md` (the contract) and a generated `CLAUDE.md` that only routes to it (root §8.6; its sub-folders `references/`, `agents/`, `evals/`… carry one too). **36 skill dirs** on disk (`ls -d .claude/skills/*/ | wc -l`, minus any dir without a `SKILL.md`). **15 are explicit-only**
(`disable-model-invocation: true`, invoked as `/name`) and **21 may auto-trigger** (`plan-to-tasks` and `sync-context` became explicit-only 2026-11-04, plan `development/plans/2026-11-04-workflow-cleanup.md`;
`improve-animations` became explicit-only and `frontend-design` was archived 2026-11-04, plan `development/plans/2026-11-04-owed-cleanup.md`). 22 more were moved to `C:\RnD\archive\skills\` on 2026-11-03 (plan `development/plans/2026-11-03-harness-focus.md`; restore = move back). The register — provenance, pin status and invocation mode per skill — is [`docs/skill-taxonomy.md`](../../docs/skill-taxonomy.md); this is the map.

## The groups (a taxonomy, not a folder layout — no dir moves)
| Group | Dirs | Note |
|---|---|---|
| C · Harness ops (6) | `plan-to-tasks` · `sync-context` · `ship` · `rotate-secrets` · `close-board` · `close-task` | the meta-skills; all explicit-only (since 2026-11-04 also `plan-to-tasks` and `sync-context`, each ≤ 150 lines with its full previous text in `references/full-spec-2026-11-04.md`; the Habait project's `plan-to-tasks` is a pointer to the root one). `close-task` (2026-11-03) drives `scripts/wt.py` and `scripts/mem_entry.py`. `ship` and `close-board` have their git steps on hold until Eliran sets identity and remote (root §8.7) |
| D · Design authority (9) | `shadcn` · `ui-ux-pro-max` · `web-design-guidelines` · `marketing-psychology` · `refero-design` · `hebrew-rtl-best-practices` · `office-ui-principles` · `ui-craft-dashboard` · `playground` | real dirs, never symlinks (D6); `web-design-guidelines` pinned to a vendored dated copy; the last four explicit-only except `hebrew-rtl-best-practices`; `frontend-design` is served by the installed plugin `frontend-design:frontend-design` (repo copy archived 2026-11-04, OWED-007) |
| F · Animation & motion (11) | `animate` · `animation-vocabulary` · `apple-design` · `ask-sonner` · `emil-design-eng` · `find-animation-opportunities` · `improve-animations` · `pick-ui-library` · `prototype` · `review-animations` · `break-ui` | the ordered toolset for motion and UI-polish work — the one ruled line of design precedence; `pick-ui-library`, `prototype`, `review-animations`, `break-ui`, `improve-animations` explicit-only (`improve-animations` writes plan files, 2026-11-04) |
| V · Video Division (1) | `video-division` | the front door of `video/`; the vendor skills under `video/.claude/skills/` are directory-scoped and not counted here |
| Ungrouped (9) | `grilling` · `improve-codebase-architecture` · `codebase-design` · `domain-modeling` · `mobile-native` · `real-estate-content-production` · `imagegen-frontend-mobile` · `mobile-responsive` · `responsive-design` | `mattpocock/skills` trio (2026-11-03): `improve-codebase-architecture` (explicit-only) uses `codebase-design` and `domain-modeling` (both auto) and hands off to `grilling`. `real-estate-content-production` (auto, `calesthio/generative-media-skills`, 2026-11-03): property-media truth/disclosure/QA; US sources, Habait §6 wins. 2026-11-04 installs: gotchas below |
| Archived 2026-11-03 (22) + 2026-11-04 (1) | groups A, B, E, `analyze-plan`, `worktree-ops`, `run-eval`, `test-bounded`, `grill-me`, `animate-expo`, `write-swift`; `frontend-design` (2026-11-04, OWED-007: the plugin copy wins) | in `C:\RnD\archive\skills\`, moved not deleted; restore = move back |

## Frontmatter standard — every new skill and every `SKILL.md` you touch
1. **`description` = ONE trigger sentence, ≤ 300 chars.** Every description loads into every session, so it is a session-wide tax; keyword dumps, trigger-phrase lists and flag manuals go in the body.
2. **Declare `allowed-tools` explicitly.**
3. **Model-invocable skills keep `SKILL.md` ≤ 150 lines** — detail in `references/*.md`, code in `scripts/*` (progressive disclosure).
4. **`disable-model-invocation: true`** for anything that writes a register or runs a heavy command.
5. **Nothing is deleted to hit a ceiling** — relocate with a stub.

## Conventions / gotchas
- Design-skill precedence is **unruled** (D14 — Eliran's open call); the one ruled line is motion → group F. Surface conflicts rather than silently picking.
- ⛔ **Grep is not a usage count** — common-word names (`ship`, `studio`, `animate`, `prototype`) hit ordinary prose. The 2026-11-03 archive was decided on scope (habait-walkaround + Video), not on usage counts; Eliran delegated the call.
- MCP servers (`21st`, `refero`, HeyGen, fal) register only in the per-machine `~/.claude.json`, never in the repo; a new server's `mcp__*` tools appear after a session restart.
- Per root `CLAUDE.md` §3 the orchestrator skills (`studio`, `studio-v2`) were built LAST, after hand-proving — a skill's existence is not licence to skip proving a new flow by hand.
- **The 2026-11-04 installs (Ungrouped).** `imagegen-frontend-mobile` (`Leonxlnx/imagegen-skills`): art direction for generated mobile-screen images, no code. The phone-UI trio: `responsive-design` (`wshobson/agents`, layout technique) + `mobile-responsive` (`AsadSumbul`, the no-overflow gate; its `check-overflow.js` misses RTL overflow) + `mobile-native`.
- `skills-lock.json` (repo root) is written by the installer only; ⛔ never extend it by hand. It pins seven skills: the three 2026-11-04 installs (re-install commands in each one's context file), and three from `mattpocock/skills` — `improve-codebase-architecture`, `codebase-design`, `domain-modeling` — and `real-estate-content-production` from `calesthio/generative-media-skills`, all installed 2026-11-03 as real-folder copies (`installMode: copy`); re-install
  with `npx skills add https://github.com/mattpocock/skills --skill <name> -a claude-code --copy -y`. Their upstream `SKILL.md` bodies are not edited. On 2026-11-04 (OWED-018) their frontmatter only got `allowed-tools`, and `real-estate-content-production` got a ≤ 300-char description with the upstream one kept verbatim as a YAML comment; a re-install overwrites both. Its 530-line body stays over the 150-line standard (upstream, not split).
- Skill `name:` matching and `/slash` routing are keyed off directory location.
- **Plugin duplicates (OWED-007, 2026-11-04):** one copy per skill, decided in `docs/skill-taxonomy.md` §6. The installed plugins are `frontend-design`, `vercel` and `railway` (`~/.claude/plugins/installed_plugins.json`); a plugin skill cannot be switched off from this folder — that is a `skillOverrides` line in `settings.local.json`, Eliran's file.

## Context-file generator (root §8.6 detail)
(Moved from root `CLAUDE.md` on 2026-11-04, wording unchanged.)
- `python .claude/skills/sync-context/generate-cards.py --check` lists every folder that lacks one; `--apply` writes it from facts on disk (file and subfolder tables) with a Purpose placeholder that a person or `codebase-cartographer` fills — never invented.
- Generated files carry `generated-by` on line 3 and keep their Purpose and Gotchas across runs; hand-written files (no marker) are never overwritten. The full list is `docs/context-map.generated.md`; the Context map below lists the areas only.

## Links
Parent: [../../CLAUDE.md](../../CLAUDE.md) · Register: [../../docs/skill-taxonomy.md](../../docs/skill-taxonomy.md)
