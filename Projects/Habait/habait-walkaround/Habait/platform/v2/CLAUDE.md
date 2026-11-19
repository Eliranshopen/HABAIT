# v2/ — context file
<!-- last-updated: 2026-11-09 -->

## Purpose
A relocation stub. The Rainbow v2 test page moved on 2026-11-09 (round 2) to `../apartment-journey/`, the apartment journey that `/hold/` opens when 846 is picked. Eliran (2026-11-09): no entry point may be about one apartment, so `index.html` here forwards the old test link `…/v2/` to the project landing `../` (`/`), not to the journey.

## What's here
| File | What |
|---|---|
| `index.html` | the forward to `../` (meta refresh + `location.replace`, a plain link without JS) |

## Gotchas
- Never point this at `../apartment-journey/`: the journey is reached only from the hold's 846 card.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md) · The journey: [../apartment-journey/CLAUDE.md](../apartment-journey/CLAUDE.md) · Plan: `development/plans/2026-11-09-rainbow-v2.md` §8
