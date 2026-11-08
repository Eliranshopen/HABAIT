---
name: ui-craft-dashboard
description: "Dense-dashboard craft for data-heavy internal tools: tables, metric cards, charts, empty and first-run states, forms, AI-chat panels, plus a completeness checklist per screen archetype and a scored heuristic critique. Use when building or reviewing a dashboard, admin or data-table screen."
allowed-tools: Read, Grep, Glob, Write, Edit
disable-model-invocation: true
license: MIT (Eduardo Calvo, educlopez/ui-craft; LICENSE in this folder)
---

# UI craft for dense dashboards (lean router)

Installed into the Habait harness on 2026-10-03 by copy (D-DEV-UX-10) from `educlopez/ui-craft` (commit `ceecc8e`, 2026-09-03): the
`ui-craft-dense-dashboard` variant as `references/dense-dashboard.md` and fourteen of the parent skill's references. NOT installed, on
purpose: the parent `ui-craft/SKILL.md` with its Discovery questions and its `/brief`, `/tokens`, `/sddesign` routing, the plugin
commands, the MCP server, the `.ui-craft/` memory folder, the Go CLI and the evals. A link inside a reference to a file that is not in
this folder (`finish-bar.md`, `themes.md`, `craft-intent.md`, `tokens.md`, `personas.md`, `components.md`, `modern-css.md`, the landing and
auth recipes) points at the upstream repo; it was left out deliberately.

## Which reference to open

| Open | For |
|---|---|
| `references/dense-dashboard.md` | the style anchors: tabular numbers right-aligned, a semantic palette plus one accent, a 4/8 px grid, micro-motion only, skeleton rows, no pies |
| `references/dashboard.md` | metric cards, charts, the sidebar, tables: the primary reference for an office screen |
| `references/recipe-dashboard.md` | the acceptance bar for a whole dashboard |
| `references/coverage.md` | **the completeness checklist** per screen archetype: data table, empty and first-run, settings, search and filter, detail view (see the contract below) |
| `references/heuristics.md` | **a scored critique**: Nielsen's ten plus six laws, judged 0 to 100, with personas |
| `references/state-design.md` | loading, empty, error, partial and success states for every component |
| `references/forms.md` | labels, validation timing, field types, multi-step forms |
| `references/copy.md` | microcopy by context: buttons, errors, empty states, danger zones; a tooltip must add value, never repeat the label |
| `references/ai-chat.md` | an assistant panel: status and tool-trace affordances, streaming, suggestions |
| `references/dataviz.md` | chart choice and encoding |
| `references/color.md` | a semantic palette in OKLCH, contrast |
| `references/typography.md` | the scale, tabular numbers, mono for ids |
| `references/accessibility.md` | the floor every screen keeps |
| `references/responsive.md` | tablet and laptop breakpoints, toolbar collapse |
| `references/motion.md` | the rendering-performance section only (compositor, layers, scroll-linked motion) |

## The coverage contract (from `coverage.md`, kept)

Report each archetype item as **present**, **partial**, **missing**, **not-needed** or **unknown**, with the evidence (a frame, a
`file:line`). No score. Coverage never gates a ship and never overrides a ruling; it tells the builder what a screen of this kind is
usually expected to have, so a gap is a question, not a defect.

## House overrides (Habait)

- **Fonts:** the style anchors name IBM Plex, Inter and a mono face. Habait uses the platform's own: Assistant for body text and Heebo for
  headings and every number (Heebo's digits are equal-width; neither font has `tnum`). No mono face for ids in Hebrew UI; an id is
  isolated with `<bdi>` instead.
- **Colour:** the semantic palette's "warning" is amber in this skill. On Habait amber is reserved for the ״הדמיה״ badge and the footer
  dot (D-DEV-UX-3, D-DEV-UX-12); use the office's four meanings (green done, red blocked, indigo your move, teal in motion) and slate idle.
- **Sidebar:** the platform's dashboard-01 shell (an inset sidebar of 288 px on a tinted ground) stays; the reference's 200 to 240 px
  sidebar is a different product's choice.
- **Shortcuts:** ⌘K and J/K are welcome where they exist; a Windows machine shows Ctrl, and the office's agent opens with ״/״
  (`e.code === 'Slash'` too, for Hebrew layouts).
- **Motion:** micro only, 120 to 200 ms, none under `prefers-reduced-motion`; the landing's one-shot-entrance ban (R-SFX-3) wins over any
  motion suggestion here.
