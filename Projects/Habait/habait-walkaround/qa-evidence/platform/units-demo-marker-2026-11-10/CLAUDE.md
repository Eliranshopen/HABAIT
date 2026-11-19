# qa-evidence/platform/units-demo-marker-2026-11-10/ — context file
<!-- last-updated: 2026-11-10 -->

## Purpose
Evidence of the 2026-11-10 change «להשאיר כהדגמה עם סימון» (Eliran, 10:45): in the Rainbow building only apartment 846 has sales-plan data (DBLK 15.10.2025); every other unit keeps its demo numbers and now says so. `fixtures/rainbow/units.json` carries `source: "sales-plan" | "demo"` per unit; every render site of rooms / area / terrace shows «נתוני הדגמה» / "Sample data" when the source is demo and nothing extra for 846. Branch `units-demo-marker` (7d551eb + 51471bf), fast-forwarded into `main` 51471bf; NOT deployed. Stage: `stage_flow.py <scratch> --edit-api --studio` of live main 51471bf.

## What's here
| File / folder | What |
|---|---|
| `units-demo-marker.json` | the badge check (`Habait/platform/test/units-demo-marker.shots.mjs`) at 390 and 1440: PASS — 856 card badge 23 px between the facts and the button, sheet no sideways scroll, primary button 46–48 px; 846 card 0 badges; drawer 11 badges (846 none, rows ≥ 46 px); pills 11 marked, 846 unmarked, phone pills ≤ 19 px; apartment 845 hero chip 22 px + 1 «אודות» row, 846 hidden; landing 846 title clean, 11 availability chips; 0 page errors |
| `a1-apartment-845-*.png`, `a1-apartment-846-*.png`, `a2-apartment-845-about-*.png` | the apartment page: chip beside the status for 845, none for 846; the «אודות» data-source row |
| `l1-landing-availability-*.png` | the landing availability list: a chip on each demo row, 846 clean |
| `h1-hold-pills-*.png`, `h2-hold-card-846-*.png`, `h3-hold-card-856-*.png`, `h4-hold-units-list-*.png` | the hold: the pills' sub-line mark (desktop), 846's card unchanged, 856's card with the badge under the facts, the «דירות» drawer |
| `predeploy/` | `node Habait/tools/deploy/predeploy.mjs <stage>`: PASS 34 page×size |
| `hold-phone/` | `test/hold-phone.check.mjs`: PASS 375 / 390 / 430 / 1440 |
| `apartment-journey/` | `test/apartment-journey.check.mjs`: PASS (846 journey unchanged, no badge) |
| `rainbow-flow/` | `test/rainbow-flow.check.mjs`: PASS 1440 / 390 |
| `no-price/` | `test/no-price.check.mjs`: PASS 360 / 390 / 1440 (prices stay hidden next to the badge) |

PNGs are gitignored (on disk only); the JSON verdicts are committed. $0 — no paid call.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md) · Rule: root `CLAUDE.md` §8.6 · Memory: `memory/runs/2026-11-10-units-demo-marker.md`
