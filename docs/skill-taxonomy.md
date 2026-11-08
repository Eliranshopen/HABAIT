# Skill taxonomy — the register
<!-- generated 2026-11-03 from .claude/skills/*/SKILL.md frontmatter · owner: Eliran Shopen -->

Groups are a taxonomy, not folders (map: `.claude/skills/CLAUDE.md`). Invocation: **auto** = the model may trigger it from its description; **explicit** = `/name` only (`disable-model-invocation: true`). §3 lists what each harness-ops skill needs before it can pass; §4 design precedence is unruled (D14, Eliran's call) except motion → group F.

## §2 The register

| Skill | Group | Invocation | Lines | Trigger (first 140 chars) |
|---|---|---|---|---|
| `close-task` | C · harness-ops | explicit | 45 | Close one task as root CLAUDE.md §0.2 asks: close its working folder if it has one (scripts/wt.py), write its memory entry, INDEX line and secon |
| `close-board` | C · harness-ops | explicit | 410 | Close ONE board as a single motion: verify every status against git, cap the ship summary, update the fielded row, answer the gate question, |
| `plan-to-tasks` | C · harness-ops | explicit | 91 | Turn one APPROVED plan in development/plans/ into a board under development/tasks/<slug>/: cards matched to the right agents (harness or proj |
| `rotate-secrets` | C · harness-ops | explicit | 208 | Explicit only: the credential-rotation runbook, one credential at a time — burn-check, generate, Eliran sets it in the console, redeploy, ve |
| `ship` | C · harness-ops | explicit | 347 | The release sequence for the Habait app repo, run by the main session end to end: preflight, deploy behind Eliran's own per-deploy go, live- |
| `sync-context` | C · harness-ops | explicit | 66 | Explicit only: one /sync-context pass over the whole context layer: refresh every CLAUDE.md and the root Context map, reconcile both memory  |
| `hebrew-rtl-best-practices` | D · design | auto | 93 | Build and check Hebrew right-to-left web UI: logical CSS properties, bidi isolation for numbers, prices, phones and mixed Hebrew-Latin text, |
| `marketing-psychology` | D · design | auto | 87 | Apply psychological principles and mental models to marketing — why people buy, ethical influence, pricing perception, growth loops. Reach f |
| `office-ui-principles` | D · design | explicit | 41 | Five principle cards for dense B2B operator screens: expert-tool layout, a table and its plan or chart in sync, density by user type, a smal |
| `playground` | D · design | explicit | 78 | Build a self-contained single-file HTML playground: controls on one side, a live preview, 3 to 5 presets and a prompt box with a Copy button |
| `refero-design` | D · design | auto | 107 | Research-first design methodology: ground every UI, product, web, landing-page or visual-polish task in real references (Refero MCP styles/s |
| `shadcn` | D · design | auto | 142 | Manages shadcn/ui components and projects — add, search, fix, debug, style and compose UI, including chat interfaces, with project context a |
| `ui-craft-dashboard` | D · design | explicit | 56 | Dense-dashboard craft for data-heavy internal tools: tables, metric cards, charts, empty and first-run states, forms, AI-chat panels, plus a |
| `ui-ux-pro-max` | D · design | auto | 111 | Searchable UI/UX design intelligence for web and mobile — styles, color palettes, font pairings, product patterns, UX guidelines and chart t |
| `web-design-guidelines` | D · design | auto | 42 | Review UI code for compliance with Vercel's Web Interface Guidelines (accessibility, focus, forms, animation, typography, content, images, p |
| `animate` | F · motion | auto | 145 | Build an animation from scratch in decision order — animate at all, purpose, tool, properties, curve and duration, interruption, exit — and  |
| `animation-vocabulary` | F · motion | auto | 62 | Reverse-lookup glossary that turns a vague description of a web animation or motion effect into its exact term ("the bouncy thing when a pop |
| `apple-design` | F · motion | auto | 148 | Apple's interface design and fluid, physical motion translated for the web. Use when building or reviewing gesture-driven UI, springs, drag/ |
| `ask-sonner` | F · motion | auto | 83 | Guide to Sonner, the React toast library: setup, toast() calls, promise and loading toasts, updating, dismissing, styling, theming and posit |
| `break-ui` | F · motion | explicit | 183 | Stress-test a screen with realistic worst-case data (long Hebrew and Latin names, unbreakable emails, zero, one and 1,000 items, extreme pri |
| `emil-design-eng` | F · motion | auto | 112 | Emil Kowalski's design-engineering philosophy — UI polish, component design, animation decisions, and the invisible details that make softwa |
| `find-animation-opportunities` | F · motion | auto | 135 | Search a codebase or UI for places that don't animate but should, and reject everything that shouldn't. Read-only: proposes motion with exac |
| `improve-animations` | F · motion | explicit | 105 | Explicit only: survey a codebase's animation and motion code, then write a prioritized audit and self-contained implementation plans for oth |
| `pick-ui-library` | F · motion | explicit | 78 | Pick the right library for a given frontend task from a curated, opinionated list — numbers, OTP inputs, charts, command menus, virtualizati |
| `prototype` | F · motion | explicit | 92 | Build multiple genuinely different versions of a UI piece you describe, rendered behind a visual picker so you can flip through them live an |
| `review-animations` | F · motion | explicit | 113 | Reviews animation and motion code against a high craft bar derived from Emil Kowalski's design engineering philosophy. Default to flagging;  |
| `video-division` | V · video | auto | 130 | Front door of the Habait Video Division (video/): routes any ask to plan, make or edit a video, reel, film, promo, screen recording, caption |
| `grilling` | — ungrouped | auto | 29 | Grill the user relentlessly about a plan, decision, or idea. Use when the user wants to stress-test their thinking, or uses any 'grill' trig |
| `codebase-design` | — ungrouped | auto | 115 | Shared vocabulary for designing deep modules. Use when the user wants to design or improve a module's interface, find deepening opportunitie |
| `domain-modeling` | — ungrouped | auto | 75 | Build and sharpen a project's domain model. Use when discussing codebase terminology, writing or editing a GLOSSARY.md, or recording or edit |
| `improve-codebase-architecture` | — ungrouped | explicit | 72 | Scan a codebase for deepening opportunities, present them as a visual HTML report, then grill through whichever one you pick. |
| `mobile-native` | — ungrouped | auto | 127 | Make a web app feel native on a phone: the CSS and meta-tag fixes for sticky hover, tap flash, the 100vh bug, input zoom, laggy taps, pull-t |
| `real-estate-content-production` | — ungrouped | auto | 530 | Provider-independent real estate media production — listing photos, virtual staging, property videos, walkthroughs, floor-plan explainers, a |
| `imagegen-frontend-mobile` | — ungrouped | auto | 1467 | Image-only art direction for premium mobile app screen concepts and multi-screen flows (iOS, Android, cross-platform) in a phone mockup. Use |
| `mobile-responsive` | — ungrouped | auto | 153 | Mobile-first responsive web UI from 320px to desktop: no horizontal overflow, 44px touch targets, reflow not shrink, matching the project's |
| `responsive-design` | — ungrouped | auto | 45 | Implement modern responsive layouts using container queries, fluid typography, CSS Grid, and mobile-first breakpoint strategies. Use when b |

**Archived 2026-11-03** (22, moved to `archive/skills/`, plan `development/plans/2026-11-03-harness-focus.md`; restore = move back): groups A and B, `analyze-plan`, `worktree-ops`, `run-eval`, `test-bounded`, the seven `21st-*` (group E), `write-swift`, `animate-expo`, `grill-me`. OWED-006 resolved; `grill-me` part of OWED-017 resolved. 32 skills remained; `close-task` added the same day → 33: 21 auto, 12 explicit; `real-estate-content-production` installed the same day → 34: 22 auto, 12 explicit. **2026-11-04:** `plan-to-tasks` and `sync-context` explicit (plan `2026-11-04-workflow-cleanup.md`); `improve-animations` explicit and `frontend-design` archived (OWED-007, plan `2026-11-04-owed-cleanup.md`) → 33: 18 auto, 15 explicit.

## §3 What the harness-ops skills need before they can pass

| Skill | Needs |
|---|---|
| `ship`, `close-board` | git steps on hold until identity and remote are set (root §8.7); the product folder `Projects/Habait/habait-walkaround/` once OWED-009 re-points them; the registers under `docs/governance/` |
| `sync-context` | the `memory/` layer (scaffolded) and the per-folder `CLAUDE.md` context files; check 16 on hold until re-pointed to the product worktrees, check 17 on hold (no remote) |
| `rotate-secrets` | `docs/governance/SECRETS-LEDGER.md` (scaffolded) and a credential to rotate |
| `plan-to-tasks` | a plan file and a board folder under `development/tasks/<board>/` |

## §4 Precedence

Motion and UI-polish → group F in its ordered sequence (the one ruled line). Everything else: unruled (D14, `docs/INHERITED-DECISIONS.md`) — surface the conflict to Eliran rather than silently picking. Hebrew RTL screens always pass `hebrew-rtl-best-practices`.

## §5 Provenance and pins

`skills-lock.json` is written by the installer only. Its seven rows: `mobile-responsive` from `AsadSumbul/mobile-responsive` and `responsive-design` from `wshobson/agents` (both installed 2026-11-04 on Eliran's ask after a skills.sh search, `installMode: copy`; frontmatter-only edits — `allowed-tools` on both, a ≤ 300-char description on `mobile-responsive` with the upstream one as a YAML comment; its `check-overflow.js` misses RTL overflow, see its context file), `imagegen-frontend-mobile` from `Leonxlnx/imagegen-skills` (installed 2026-11-04 on Eliran's ask, `installMode: copy`; upstream moved it out of `leonxlnx/taste-skill` on 2026-10-19, commit `825e306`; frontmatter-only edit the same day — ≤ 300-char description with the upstream one as a YAML comment, `allowed-tools`; the 1,465-line body stays upstream), `real-estate-content-production` from `calesthio/generative-media-skills` (installed 2026-11-03 on Eliran's ask, `installMode: copy`; the 530-line body stays over the 150-line standard, left as upstream; US legal sources, Habait's §6 rails win), and the `mattpocock/skills` trio, installed 2026-11-03 as real-folder copies (`installMode: copy`), OWED-004 resolved: `improve-codebase-architecture` (its Step 1 `git log` scan is suspended, no git) calls `codebase-design` and `domain-modeling`. Upstream bodies are not edited; on 2026-11-04 (OWED-018) the four locked skills got frontmatter-only edits — `allowed-tools` on all four, and a ≤ 300-char description on `real-estate-content-production` with the upstream one kept verbatim as a YAML comment. A re-install overwrites them. Group D skills were copied as real folders with their upstream LICENSE; group E and F are unpinned by design; `web-design-guidelines` is pinned to a vendored dated copy. Duplicates with Eliran's user-scope plugins: §6.

## §6 One copy per skill — OWED-007 (decided 2026-11-04, main session's delegation, navigator mode)

Checked 2026-11-04: the installed plugins are `frontend-design@claude-plugins-official` (1.1.1), `vercel@claude-plugins-official` (0.50.0) and `railway@railway-skills` (`~/.claude/plugins/installed_plugins.json`); no user-scope skill in `~/.claude/skills/` shares a name with a repo skill. So two names really have two copies today; the other repo-local design and motion skills have no plugin twin and are the only copy.

| Skill | Copies found | Wins | Why | Done |
|---|---|---|---|---|
| `grilling` vs `grill-me` | repo `grilling`; `grill-me` already in `archive/skills/` | `grilling` | the live one; `improve-codebase-architecture` hands off to it | nothing to move; `grill-me` stays archived |
| `frontend-design` | repo `.claude/skills/frontend-design/` (55 lines, older text) and plugin `frontend-design:frontend-design` 1.1.1 | plugin | same upstream skill; the plugin copy is the newer text and updates with its marketplace; two copies put two near-identical descriptions in every session | repo copy moved to `archive/skills/frontend-design/` (restore = move back) |
| `shadcn` | repo `.claude/skills/shadcn/` (shadcn/ui's own skill: `rules/`, `evals/`, CLI-scoped `allowed-tools`, live `npx shadcn info` context) and plugin `vercel:shadcn` (Vercel's guide, 596 lines) | repo | different upstreams, not a copy of one another; the repo one carries the CLI rules and evals the Habait UI work uses | kept. The plugin skill cannot be switched off from the repo — if Eliran wants it off: a `skillOverrides` entry for `vercel:shadcn` in `settings.local.json` (his file) |
| `playground` | repo `.claude/skills/playground/`; the `playground` plugin exists only in the marketplace cache, not installed | repo | no installed twin | kept |
| `animate`, `animation-vocabulary`, `apple-design`, `ask-sonner`, `emil-design-eng`, `find-animation-opportunities`, `improve-animations`, `pick-ui-library`, `prototype`, `review-animations`, `break-ui`, `mobile-native`, `refero-design`, `ui-ux-pro-max`, `web-design-guidelines`, `marketing-psychology`, `hebrew-rtl-best-practices`, `office-ui-principles`, `ui-craft-dashboard` | repo only | repo | no installed plugin twin on 2026-11-04 (the OWED row's count of 13 could not be reproduced from disk on 2026-11-04) | kept |
