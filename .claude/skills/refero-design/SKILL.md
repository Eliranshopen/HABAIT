---
name: refero-design
description: "Research-first design methodology: ground every UI, product, web, landing-page or visual-polish task in real references (Refero MCP styles/screens/flows, or the bundled craft refs), lock one direction, synthesise, then build. Use even when Refero is unmentioned and MCP absent."
allowed-tools: Read, Grep, Glob, Write, Edit, Bash
---

# Refero Design

Refero gives agents taste and product evidence. Use it before design work instead of
relying on generic model knowledge.

Refero has three research layers:

1. **Styles** - visual direction and taste.
2. **Screens** - concrete UI patterns and product-screen decisions.
3. **Flows** - multi-step journey logic.

Best results come from combining layers: visual direction from styles, concrete UI
patterns from screens, and sequencing from flows when the task has multiple steps.

Progressive disclosure (2026-09-08, harness upgrade plan `docs/harness-upgrade-plan.md` (not transferred), wave 6): the long
bodies moved verbatim into `references/` and this file became the router. Nothing was dropped — every former
section has a row in the table below.

## When to use / when not

**Use** for UI design, product design, web design, landing pages, dashboards, product screens, redesigns,
visual polish, frontend/CSS styling, design systems, components, responsive design, typography, color,
spacing, motion, icons, accessibility, copywriting, conversion, and anti-AI-slop work — including when the
user never says "Refero" and when the live MCP tools are not configured.

**Do not use** for non-visual work, or as a second opinion alongside another design skill mid-task: this
skill's own `references/non-negotiables.md` forbids running a generic frontend/product design skill as a
parallel design authority. That precedence claim is this skill's self-claim, **not a Eliran ruling** —
design-skill precedence is open as D14 (`docs/skill-taxonomy.md` section 4, `.claude/skills/CLAUDE.md`).
Surface the conflict rather than silently picking, and the landing's one-shot-entrance ban (R-SFX-3) beats
any suggestion made here.

## Workflow (in order)

0. **Read [`references/non-negotiables.md`](references/non-negotiables.md) first** — it is the binding
   contract for every step below (research before design, no copying one reference, no averaging, no
   token-role changes, imagery respected, validate after building).
1. **Set up / check MCP** if live research is wanted — [`references/mcp-setup.md`](references/mcp-setup.md),
   tool details in [`references/mcp-tools.md`](references/mcp-tools.md). No MCP is not a licence to skip
   research: fall back to the bundled craft references and any user-provided references.
2. **Discovery** — form the short design brief, asking only for what would change the result:
   [`references/discovery-brief.md`](references/discovery-brief.md).
3. **Route the workflow** — pick the lightest path that can still be excellent (section below).
4. **Route the tools** — styles first for anything visual, screens for concrete patterns, flows for
   journeys: [`references/tool-routing.md`](references/tool-routing.md).
5. **Research** — the search/extract/lock loops per layer:
   [`references/research-workflow.md`](references/research-workflow.md); match effort to risk with
   [`references/research-depth.md`](references/research-depth.md). Ends in a **reference lock**.
6. **Synthesise** — three buckets (visual direction / product pattern / journey logic):
   [`references/synthesis.md`](references/synthesis.md).
7. **Present findings + decision ledger** before implementing:
   [`references/present-findings.md`](references/present-findings.md). A major choice with no source does
   not ship.
8. **Build** — [`references/design-craft.md`](references/design-craft.md) plus only the craft files the task
   needs (typography, color, motion, icons, craft-details, copywriting, anti-ai-slop).
9. **Gate** — [`references/quality-gate.md`](references/quality-gate.md); for substantial visual work also
   run the visual QA pass in [`references/visual-workflow.md`](references/visual-workflow.md). If an answer
   is no, research or refine more before delivering.

## Workflow Routing

Choose the lightest workflow that can produce a high-quality result.

- **Direct build:** use for small UI fixes, clear production edits, existing design-system
  work, or tasks with a concrete source to match. Research and lock the direction, then code.
- **Visual exploration:** use when the user asks for variants, a new visual language, a
  major redesign, a landing page, or another high-visibility surface with several plausible
  directions. Default to three reference-locked options and ask the user to choose; see
  [references/visual-workflow.md](references/visual-workflow.md).
- **Audit:** use captured screenshots, Refero screens, or flows as evidence before critique.
- **Asset generation:** use generated imagery only when the reference lock requires bitmap
  media that code, icons, or existing assets cannot faithfully provide; see
  [references/visual-workflow.md](references/visual-workflow.md).

## References

Moved out of this file on 2026-09-08, verbatim (CRLF normalised to LF):

| File | What it holds | When to open it |
|---|---|---|
| [`non-negotiables.md`](references/non-negotiables.md) | The 14 binding rules of the methodology | **Always, before step 1** |
| [`mcp-setup.md`](references/mcp-setup.md) | The `claude mcp add` line and `/mcp` sign-in | Setting up or debugging live research |
| [`discovery-brief.md`](references/discovery-brief.md) | What to clarify plus the brief template | Start of any non-trivial task |
| [`tool-routing.md`](references/tool-routing.md) | Styles vs. screens vs. flows, what each is for, the current web-pages-only limit of styles | Deciding which layer to search |
| [`research-workflow.md`](references/research-workflow.md) | The three research loops, good query examples, what to extract, the synthesis rule, the **reference-lock template**, combining sources without moving token roles | The research pass itself |
| [`research-depth.md`](references/research-depth.md) | Search and style counts by task risk | Sizing the research effort |
| [`synthesis.md`](references/synthesis.md) | Visual direction / product pattern / journey logic buckets with output examples | Turning findings into a concept |
| [`present-findings.md`](references/present-findings.md) | Research-summary format and the decision-ledger table | Before implementation |
| [`design-craft.md`](references/design-craft.md) | Core craft rules (tokens first, preserve traits and roles, AI-slop defaults to avoid, `text-wrap`, a11y not a late pass) and the craft-file index | Implementation |
| [`quality-gate.md`](references/quality-gate.md) | The 16-question pre-delivery checklist | Before handoff |

Pre-existing craft references (untouched): [`typography.md`](references/typography.md) ·
[`color.md`](references/color.md) · [`motion.md`](references/motion.md) · [`icons.md`](references/icons.md) ·
[`craft-details.md`](references/craft-details.md) (forms, focus, images, touch, performance, accessibility) ·
[`copywriting.md`](references/copywriting.md) · [`anti-ai-slop.md`](references/anti-ai-slop.md) ·
[`visual-workflow.md`](references/visual-workflow.md) (image generation, visual options, visual QA) ·
[`mcp-tools.md`](references/mcp-tools.md) · [`example-workflow.md`](references/example-workflow.md).

## Example

For a complete walkthrough, see [references/example-workflow.md](references/example-workflow.md).
