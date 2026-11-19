# apt846 cross-scene consistency audit — 2026-11-10 (before any paint call, Eliran's rule)

**Rule (Eliran, 2026-11-10):** «לפני שאתה מתקן או מג'נרט תמונות חדשות אתה חייב לעבור על כל הלשוניות בהדמייה ושבכולם תהיה עקביות». This audit covers every interior tab (01–11) in the set the visitor sees by default (`floor:parquet`, `videos.json defaultFloor`), plus `balanced`, `floor:concrete`, `floor:marble` (sheets cut for all four; the finish sets carry the same picks, so the findings repeat there).

**Tool:** `Habait/tour360/tools/consistency-check.mjs --all-groups --set <set>` (sheet-only, $0). New today: door groups (`door-<opening id>`, every `door` / `entrance_door` opening of `plan.general.json`), because doors were not an audited group before — the fixture groups passed 9/9 on 2026-11-06 while the entrance door differed between tabs. `door-o-10` / `door-o-11` were also cut with `--scenes 01-entrance,…` (the sight-line test hides them from 01 behind the tall column).

**Sheets:** `Habait/tour360/apartments/apt846/_local/fidelity/consistency__<group>__<set>__<hash>.jpg` (15 groups × 4 sets). Summary picture: `audit-findings-parquet.jpg` (this folder).

## Findings (parquet set; judged by eye on the sheets, deterministic numbers from `--recheck last` row 269)

| # | Element | Scenes that see it | What differs | Reference look | Fix |
|---|---|---|---|---|---|
| A | entrance door `o-12` | 01, 03, 04 | **03-dining paints it light OAK with a panel frame**; 01 and 04 taupe, black lever (as the render) | 01-entrance (taupe, flush, black lever) | band on 03 |
| B1 | guest-bath door `o-11` + bedroom-2 door `o-10` | 04, 11 / 04, 10 | **04-living paints both as framed OAK doors**; 10 and 11 show white flush zero-line doors with a black lever (material board: zero-line, painted the wall colour) | 10 / 11 (white flush) | band(s) on 04 |
| B2 | wardrobe door `o-6` | 01, 02, 07, 08 | **01-entrance and 02-kitchen paint it OAK** (open leaf at the end of the living); 07 and 08 white flush | 07 / 08 | band on 01; small band on 02 (730 cm away) |
| C1 | kitchen sink | 02, 03, 04 | 02 shows a cabinet between the tall column and the sink (sink–tall 110 cm); 03 shows the sink directly beside the column — **Eliran: like 03** | 03-dining | band on 02 (sink moved toward the column; plan: sink centre ~85 cm from the column face, inside tolerance) |
| C2 | hob ↔ sink gap (R31) | 03, 04 | **03: 141 cm, 04: 130 cm vs the plan's 219** (FAIL every run since 2026-11-06); 02: 183 (pass) | the plan | row-limited band on 03 and on 04 (hob + oven moved toward the facade end) |
| C3 | open shelves | 02, 03, 04 | 04 shows **three** shelves; 02 and 03 two (board: two) | 02 / 03 | same band as C2 on 04 |
| — | 01 fridge placement | 01 | known deviation (`fidelity.json known_deviations`, shipped by ruling 2026-11-06) | — | not in this round |

**Consistent (no action):** living (sofa, TV wall, console, floor lamp), dining (table, chairs), wardrobe fronts (07/08/09), bedroom-main (07/08), bedroom-2 (10), bath-main (09), bath-guest (11), terrace railing (01–06), door `o-9` (white flush in 07/08/09), door `o-13` (glass slider in 06/07), glazing and curtains.

## Round 1 plan (consistency + kitchen) — estimate
- 7–8 band repaints with `close-seam.mjs` (gpt25-high $0.60 each, render-guided, `--rows` where only the counter changes; retries ×2 budgeted) ≈ **$10**, gates (depth, $0.01/webp) + consistency judges (3 runs × 3 groups × 4 sets, $0.01 each) ≈ **$1.5**, finish re-bases at $0 (`rebase_finish.py`). **Cap for the round: $15.** Ledger: `apartments/apt846/_local/ledger.json` (reserve-and-settle per call).
- Order: A (03 door) → B1 (04 doors) → B2 (01, 02) → C1 (02 sink) → C2+C3 (03, 04 hob/shelves). After each: 1 % gate, the band-edge rules R25/R25b, the consistency sheet re-cut and judged across every scene that sees the element, finishes rebased, 1440/390 screenshots.
- Then rounds 2 (07/10 raw finishes that add/move doors; bathrooms' finish) and 3 (3840 full set) with their own estimates.
