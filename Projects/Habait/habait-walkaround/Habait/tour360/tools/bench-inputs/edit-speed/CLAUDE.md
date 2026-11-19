# edit-speed/ — context file
<!-- last-updated: 2026-11-16 -->

## Purpose
Inputs of the editor speed bench (plan `development/plans/2026-11-16-typed-change-all-tabs.md` §4 B2; Eliran 2026-11-16: a faster editor among the models fal hosts).

## What's here
| File | What |
|---|---|
| `kitchen-dining.jpg` | 1264×848, the kitchen tab looking at the dining table — the view the page cut from the served apt846 tour (`tools/follow-live-check.mjs`, 2026-11-16) |
| `dining-table.jpg` | 1264×848, the dining tab aimed at the same spot — the view a follow turn sends |
| `cases.json` | the three cases (people · object · follow) with the handler's own instructions; written by `node tools/edit-bench-cases.mjs`, never by hand |

## Gotchas
- Regenerate `cases.json` after any change to the wording in `server/handler.mjs` (`assemble`, `assembleFollow`): the bench must time the words a visitor's turn sends.
- The bench is dry by default; `--go --cap <usd>` is a paid run and needs Eliran's budget word (root §7).

## Links
Parent: [../CLAUDE.md](../CLAUDE.md) · Bench: `../../edit_bench.py`
