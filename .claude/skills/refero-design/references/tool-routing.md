<!-- Moved verbatim from .claude/skills/refero-design/SKILL.md lines 119-186 on 2026-09-08 — harness upgrade plan (docs/harness-upgrade-plan.md, not transferred), wave 6. Nothing rewritten; only CRLF normalised to LF. -->
<!-- Relocation note (2026-09-08): links written as references/<file>.md were relative to the skill root; from inside references/ read them as ./<file>.md. Body text left verbatim. -->

## Tool Routing

### Use Styles First For Visual Work

Use `refero_search_styles` when the user asks to design, redesign, improve, polish, or
create anything with a visual component.

A style is a semantic design reference extracted from a real web marketing/product page.
It is not a screenshot and not a component library. Search results give previews; full
style references from `refero_get_style` provide design guidance such as visual thesis,
tokens, typography, layout/composition, section rhythm, spacing, elevation, surfaces,
components, imagery treatment, implementation notes, and do/don't rules.

Current limitation: Refero styles currently cover web marketing/product pages such as
landing pages, pricing pages, product marketing sites, editorial brand sites, and SaaS
websites. They do not currently cover in-app dashboards, auth screens, settings screens,
or iOS app screens as style systems. Still use styles for product UI tasks to establish
visual language, then use screens/flows for product logic.

Use styles for:

- look and feel
- brand direction
- landing pages and marketing pages
- typography, palette, layout, section structure, spacing, radius, elevation, surfaces
- component treatments and sometimes component/code examples
- imagery and product screenshot treatment
- design-system inspiration
- making a generic interface feel more tasteful

### Use Screens For Concrete UI Patterns

Use `refero_search_screens` when you need:

- a specific screen type
- a specific component or UI pattern
- page layout and content hierarchy
- copy and CTA patterns
- form/state examples
- dashboards, settings, modals, tables, pricing, empty states, auth, or product-screen details

After finding strong screens:

- use `refero_get_screen` for full details
- use `refero_get_similar_screens` to expand from a strong example
- use `refero_get_screen_image` only when raw screenshot inspection is needed

### Use Flows For Journeys

Use `refero_search_flows` when the task has a before/after sequence:

- onboarding
- signup
- checkout
- subscription management
- cancellation
- account deletion
- password reset
- profile/settings changes
- any multi-step process

After finding a strong flow, use `refero_get_flow` for step-by-step goals, actions,
system responses, and completion states.

### Use Visual Workflow For Images And QA

For image generation, visual options, generated assets, and visual QA, read
[references/visual-workflow.md](references/visual-workflow.md) when the task needs it.
