# fix-846-fidelity-2026-11-08-sales-plan-numbers — apartment 846's numbers = the sales plan
<!-- last-updated: 2026-11-10 -->
<!-- context file · 2026-11-08 · fork A fix-846-fidelity -->
## What's here
Eliran (2026-11-08): «כן, לפי תוכנית המכר». The site printed 846 as 4 rooms / 118 m² / terrace 22 m² (`platform/fixtures/rainbow/units.json`);
the sales plan (DBLK, 15.10.2025) prints 3 rooms / 106.72 m² / sun terrace 26.15 m². The data sources were corrected, not the HTML.

| File | What |
|---|---|
| `sales-plan-values.json` | every figure printed on the plan (read by eye: the PDF has no text layer), the source hash, what is not printed, the before values |
| `pdf-titleblock-300.png`, `pdf-unitbadge-300.png`, `pdf-full-72.png` | the crops the values were read from (gitignored images) |
| `pages/` | the apartment page, the /hold/ unit card and the tour place card at 1440 and 390 on a stage from live (gitignored images) + `pages.json` |

## Links
Parent: [../CLAUDE.md](../CLAUDE.md)
