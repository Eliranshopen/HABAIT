---
name: ui-ux-pro-max
description: "Searchable UI/UX design intelligence for web and mobile — styles, color palettes, font pairings, product patterns, UX guidelines and chart types across 10 stacks, queried through its own Python CLI. Reach for it to plan, build, review or fix how a UI looks, feels, moves or is interacted with."
allowed-tools: Read, Grep, Glob, Write, Edit, Bash
---

# UI/UX Pro Max - Design Intelligence

Comprehensive design guide for web and mobile applications. Contains 50+ styles, 161 color palettes, 57 font pairings, 161 product types with reasoning rules, 99 UX guidelines, and 25 chart types across 10 technology stacks. Searchable database with priority-based recommendations.

Progressive disclosure (2026-09-08, harness upgrade plan `docs/harness-upgrade-plan.md` (not transferred), wave 6): the nine
long sections moved verbatim into `references/`; `data/` (32 CSVs) and `scripts/` are untouched. This file
holds the trigger rules, the priority table and the router.

## When to Apply

This Skill should be used when the task involves **UI structure, visual design decisions, interaction patterns, or user experience quality control**.

### Must Use

This Skill must be invoked in the following situations:

- Designing new pages (Landing Page, Dashboard, Admin, SaaS, Mobile App)
- Creating or refactoring UI components (buttons, modals, forms, tables, charts, etc.)
- Choosing color schemes, typography systems, spacing standards, or layout systems
- Reviewing UI code for user experience, accessibility, or visual consistency
- Implementing navigation structures, animations, or responsive behavior
- Making product-level design decisions (style, information hierarchy, brand expression)
- Improving perceived quality, clarity, or usability of interfaces

### Recommended

This Skill is recommended in the following situations:

- UI looks "not professional enough" but the reason is unclear
- Receiving feedback on usability or experience
- Pre-launch UI quality optimization
- Aligning cross-platform design (Web / iOS / Android)
- Building design systems or reusable component libraries

### Skip

This Skill is not needed in the following situations:

- Pure backend logic development
- Only involving API or database design
- Performance optimization unrelated to the interface
- Infrastructure or DevOps work
- Non-visual scripts or automation tasks

**Decision criteria**: If the task will change how a feature **looks, feels, moves, or is interacted with**, this Skill should be used.

Harness note (2026-09-08): design-skill precedence is UNRULED — D14 is Eliran's open call (`docs/skill-taxonomy.md`
section 4) — `refero-design` claims primacy in its own card, which is a self-claim, not a ruling. Motion work
routes to group F (`emil-design-eng` and the animation set), the one ruled line. Surface a conflict rather
than silently picking; the landing's one-shot-entrance ban (R-SFX-3) beats any suggestion made here.

## Rule Categories by Priority

*For human/AI reference: follow priority 1→10 to decide which rule category to focus on first; use `--domain <Domain>` to query details when needed. Scripts do not read this table.*

| Priority | Category | Impact | Domain | Key Checks (Must Have) | Anti-Patterns (Avoid) |
|----------|----------|--------|--------|------------------------|------------------------|
| 1 | Accessibility | CRITICAL | `ux` | Contrast 4.5:1, Alt text, Keyboard nav, Aria-labels | Removing focus rings, Icon-only buttons without labels |
| 2 | Touch & Interaction | CRITICAL | `ux` | Min size 44×44px, 8px+ spacing, Loading feedback | Reliance on hover only, Instant state changes (0ms) |
| 3 | Performance | HIGH | `ux` | WebP/AVIF, Lazy loading, Reserve space (CLS &lt; 0.1) | Layout thrashing, Cumulative Layout Shift |
| 4 | Style Selection | HIGH | `style`, `product` | Match product type, Consistency, SVG icons (no emoji) | Mixing flat & skeuomorphic randomly, Emoji as icons |
| 5 | Layout & Responsive | HIGH | `ux` | Mobile-first breakpoints, Viewport meta, No horizontal scroll | Horizontal scroll, Fixed px container widths, Disable zoom |
| 6 | Typography & Color | MEDIUM | `typography`, `color` | Base 16px, Line-height 1.5, Semantic color tokens | Text &lt; 12px body, Gray-on-gray, Raw hex in components |
| 7 | Animation | MEDIUM | `ux` | Duration 150–300ms, Motion conveys meaning, Spatial continuity | Decorative-only animation, Animating width/height, No reduced-motion |
| 8 | Forms & Feedback | MEDIUM | `ux` | Visible labels, Error near field, Helper text, Progressive disclosure | Placeholder-only label, Errors only at top, Overwhelm upfront |
| 9 | Navigation Patterns | HIGH | `ux` | Predictable back, Bottom nav ≤5, Deep linking | Overloaded nav, Broken back behavior, No deep links |
| 10 | Charts & Data | LOW | `chart` | Legends, Tooltips, Accessible colors | Relying on color alone to convey meaning |

## Workflow (in order)

Search specific domains using the CLI tool below. The engine is a Python CLI (`scripts/search.py`) over the
32 CSVs in `data/`. Exact commands, flags and the scenario-to-step routing table live in
[`references/workflow-and-cli.md`](references/workflow-and-cli.md) — open it before running anything.

0. **Check Python** — [`references/prerequisites.md`](references/prerequisites.md) (on Windows use `python`,
   not `python3`).
1. **Analyze user requirements** — product type, audience, style keywords, stack.
2. **Generate the design system (REQUIRED)** — `--design-system`, optionally `--persist` for
   `design-system/MASTER.md` plus per-page overrides, optionally the `--variance` / `--motion` / `--density`
   dials. All of it in [`references/workflow-and-cli.md`](references/workflow-and-cli.md).
3. **Supplement with domain searches** — `--domain product|style|color|typography|chart|ux|…`; the domain
   list and keyword examples are in [`references/search-reference.md`](references/search-reference.md).
4. **Apply stack guidelines** — `--stack nextjs|react|shadcn|vue|svelte|astro|swiftui|flutter|react-native`.
5. **Review before delivery** — the rule checklist in
   [`references/quick-reference.md`](references/quick-reference.md), then the ship gate in
   [`references/pre-delivery-checklist.md`](references/pre-delivery-checklist.md).

## References

Moved out of this file on 2026-09-08, verbatim (CRLF normalised to LF):

| File | What it holds | When to open it |
|---|---|---|
| [`quick-reference.md`](references/quick-reference.md) | The full rule corpus by section — accessibility, touch, performance, style, layout, typography, color, animation, forms, navigation, charts (238 lines, the bulk of the old file) | Reviewing UI, or when you need the rule behind a priority row above |
| [`workflow-and-cli.md`](references/workflow-and-cli.md) | Scenario→step routing table and Steps 1-4 in full: `--design-system`, `--persist` master/override pattern, the three design dials, `--domain` table, `--stack` | Any actual run of the skill |
| [`prerequisites.md`](references/prerequisites.md) | Python install per OS and the Windows `python` vs `python3` note | Before the first command |
| [`search-reference.md`](references/search-reference.md) | Available domains, available stacks, example keywords | Choosing what to query |
| [`example-workflow.md`](references/example-workflow.md) | A worked end-to-end run ("Make an AI search homepage") | Learning the flow, or checking your own sequence |
| [`output-formats.md`](references/output-formats.md) | ASCII box (default) vs. markdown output | Piping results into docs |
| [`tips-for-better-results.md`](references/tips-for-better-results.md) | Query-writing tips | Searches come back weak |
| [`common-rules-app-ui.md`](references/common-rules-app-ui.md) | Common rules for professional app UI (iOS/Android/RN/Flutter) with fixes and symptoms | Native or cross-platform app work |
| [`pre-delivery-checklist.md`](references/pre-delivery-checklist.md) | Pre-delivery checklist: visual quality, interaction, light/dark, layout, accessibility (App UI scope) | Immediately before handoff |

Untouched in this dir: `data/` (32 CSVs, the searchable corpus) and `scripts/` (`search.py`, `core.py`,
`design_system.py`).
