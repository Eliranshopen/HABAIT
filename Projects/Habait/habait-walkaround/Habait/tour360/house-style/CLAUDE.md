# Habait/tour360/house-style/
<!-- created: 2026-11-05 · fork F (rnd-9d), project-runner · authority: Eliran -->

## What's here
The house look every new project is skinned in, so a portal project comes out like Rainbow apt846 with no human step.

| File | Purpose |
|---|---|
| `style-living.png` | the style reference (image 3 of every skin call): a copy of apt846's `_local/refs/style-living.png` (2026-11-01), the reference the Rainbow skins were made with |

## Conventions
- `tools/skin-project.mjs` copies it to `apartments/<id>/_local/refs/style-living.png` when the project has none; `make-skin-prompts.mjs` then names it.
- The material words come from `apartments/apt846/material-board.json` (copied per project by `run-project.mjs` step apartment).

## Links
Parent: [../CLAUDE.md](../CLAUDE.md)
