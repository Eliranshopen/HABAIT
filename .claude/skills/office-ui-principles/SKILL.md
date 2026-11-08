---
name: office-ui-principles
description: "Five principle cards for dense B2B operator screens: expert-tool layout, a table and its plan or chart in sync, density by user type, a small status-colour set with recoverable errors, guided multi-step flows. Use when designing or reviewing an office, dashboard, inventory or wizard screen."
allowed-tools: Read, Grep, Glob
disable-model-invocation: true
license: MIT (Dembrandt, dembrandt/dembrandt-skills; LICENSE in this folder)
---

# Office UI principles (router over five dembrandt cards)

Installed into the Habait harness on 2026-10-03 by copy (D-DEV-UX-10) from `dembrandt/dembrandt-skills` (commit `b05848a`,
2026-10-02): five of its 45 single-file skills, kept verbatim in `references/` with their tool-specific front matter (`metadata`,
`retrieval`) stripped. One description in the session instead of five. Each card ends in a review checklist: run it as the acceptance
list for the screen in hand.

## Which card to open

| Open | When the screen | The rule it adds |
|---|---|---|
| `references/operational-expert-tool-ui.md` | is a work surface a specialist uses all day (the developer's office, the units table, the inbox) | information over whitespace; the layout follows the workflow; filters, views and panels persist; hierarchical data as in-place accordions; per-row inclusion toggles always visible; status visible without interaction; workflow-scope filters kept apart from search; bulk feedback that scales with the count |
| `references/coordinated-data-views.md` | shows the same data twice (the stacking plan and the units list, a map and a list, a funnel and a table) | one shared selection store; select in either view, the other highlights and scrolls the row into view; colour encodes STATE and the label encodes identity; one legend; calendar grids on one cell pitch; an analysis panel beside the data, non-modal |
| `references/ui-density.md` | feels crowded, or must work on a phone | density by platform and user type; density tokens (row height, cell padding, gap); on mobile remove, collapse or reposition, never shrink; **"Reading is time"**: cut words before shrinking them, front-load the scannable word, the right icon in the relevant place only |
| `references/status-colors-and-errors.md` | carries status, validation, alerts or an empty or error state | a small set of status colours, each one meaning one thing everywhere; neutral grey over a misused colour; every error says what went wrong and what to do next; state the consequence BEFORE the action |
| `references/user-flows-and-guided-paths.md` | is a wizard, an onboarding or any multi-step path | when to guide and when not to; the step indicator, back always available, forward validated per step, an exit that keeps the draft; one decision per step; step titles in the user's words; a summary before the irreversible step; land somewhere meaningful after |

## House overrides (Habait)

- **Amber and orange are not a warning colour on Habait.** `status-colors-and-errors` and `operational-expert-tool-ui` name amber as
  "warning" or "pending". On this platform amber is reserved for the ״הדמיה״ AI-render badge and the footer's disclosure dot (D-DEV-UX-3,
  D-DEV-UX-12). The office's five meanings are green done, red blocked, indigo your move, teal in motion, slate idle; a third attention
  level, if ever needed, is drawn by icon weight, never by a hue.
- **Unit status hues follow the platform's own dashboard matrix** (D-DEV-UX-4): available the pale well, reserved outlined teal with a dot,
  sold the quiet fourth navy step, owners hatched. Colour encodes the state; the unit id is the label (`coordinated-data-views`).
- **Rows:** the cards say 28 to 36 px for experts; the office uses 40 px by default with a 32 px dense switch and 48 px for two-line cells
  (lane D's scale), and every target stays at least 24 px (44 px on touch).
- **Arrows in the cards' diagrams are LTR.** Read them in reading order; on a Hebrew screen the workflow runs right to left.

## How to use the checklists

Copy the checklist of each card that applies into the review, one line per item: present, partial or missing, with the frame or the
`file:line` that shows it. A checklist is an acceptance list, not a score, and it never overrides a ruling of Eliran's.
