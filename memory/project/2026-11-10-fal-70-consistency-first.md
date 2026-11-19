---
date: 2026-11-10
layer: project
author: main session (new, the simulation-fixes session of the 10:50 handoff)
second-reader: habait-deploy-qa (the deploy of this round); compliance-warden (disclosure line untouched); every painter tool run (close-seam, finish-pano) reads the ceiling
---
# Rulings 2026-11-10 ~11:20: FAL credit $70; consistency across ALL tabs before any generation; the sink as the dining tab shows it

**Eliran, 2026-11-10 (verbatim, after the handoff):** «תעבור על כל מה שאמרת שצריך לתקן. אני רק מזכיר הקרדיט שלך ב-FAL הוא 70$ אז תשתמש בו בחכמה כדי לתקן את הדברים.
1. … כל פעם חייבת להיות עקביות של הדברים בין כל לשונית ללשונית בהדמייה … הכניסה בלשונית כניסה שונה מאיך שהיא נראית בלשונית פינת אוכל ומאיך שהיא נראית בסלון … הכלל שלך הוא עקביות ולכן לפני שאתה מתקן או מג'נרט תמונות חדשות אתה חייב לעבור על כל הלשוניות בהדמייה ושבכולם תהיה עקביות נניח שהדלת והכניסה תראה אותו דבר בכל לשונית.
2. יש לך לתקן את מיקום הכיור. בלשונית פינת אוכל הכיור לא ממוקם באותו מקום כמו בלשונית מטבח ואני מעדיף שזה יראה כמו בלשונית פינת אוכל.»

**How to apply.**
- **Money:** the fal credit is **$70** (replaces the $25 ceiling of `2026-11-10-fal-budget-25.md` as the amount; the §7 rails stay: ledger before every paid call, dry-run first, `--go` inside the estimate, checkpoints; soft stop = tell Eliran). The session's own working ceiling: **$60**, leaving $10 of margin for the live tour's AI edits (Vercel `FAL_KEY` is the same key).
- **Go given** for the open simulation fixes list (`2026-11-10-handoff-simulation-fixes.md` items 1-4, 6); the entrance video (item 5) stays his separate call. Each paid batch still gets its estimate presented first.
- **Rule (binding, every round):** before any paint call, an audit of EVERY interior tab (01-11) for cross-scene consistency — the same door, the same console, the same kitchen from every scene that sees it — not only the fixture groups the judge knows. Doors were not an audited group before this day (consistency-check.mjs groups = plan fixtures + railing); the entrance door o-12 shows oak from 03-dining and taupe from 01/04. A generation is ordered only after the audit says what differs, and the fix is judged again across every scene that sees it.
- **Sink:** the reference look for the kitchen run is 03-dining (sink directly beside the tall column); 02-kitchen is the view to change. The plan's own gaps still bind (sink centre 85 cm from the tall column; hob-sink 219): the deterministic check 2026-11-10 08:57 (recheck row 269) reads 02 sink-tall 110, 03 143, 04 105; hob-sink 02 183, 03 141, 04 130 vs 219 → 03/04 hobs are the fidelity fail, 02's sink is Eliran's visual ask. Both are fixed in one kitchen round, then R31/R32 rerun.
- Evidence of the ask: the five screenshots Eliran pasted (01 entrance, 03 dining x2, 04 living, 02 kitchen) in the session of 2026-11-10 ~11:15; the recheck file `apartments/apt846/_local/fidelity/recheck__kitchen__2026-11-10T08-57-14-490Z.json`.

**Go, 2026-11-10 ~12:05 (Eliran: «כן» to «לאשר סבב 1 עד $15?»):** round 1 = consistency (doors 03/04/01/02) + kitchen (02 sink like 03; 03/04 hob to the plan's 219; 04 two shelves), cap **$15** on the apt846 ledger (start $314.82 → stop $329.82). Audit evidence: `Projects/Habait/habait-walkaround/qa-evidence/tour360/sim-fixes-2026-11-10/AUDIT.md` + `audit-findings-parquet.jpg`; worktree `.wt/rainbow-sim-fixes`.

**Round 2 go, 2026-11-10 ~14:50 (Eliran: «מאושר», «מנורה כן»):** regenerate the four open-space tabs (01-04) from ONE source sheet, up to **$35** (ledger $326.23 -> stop $361.23). Sources per element (`qa-evidence/tour360/sim-fixes-2026-11-10/WALK-2.md`): console + front door = 01; sink = 03 (a cabinet's gap to the column); oven, fridge column, shelves + decor = 02; sofa + rug = 04; hall unit = doors per plan; a pendant lamp over the dining table in every tab. Method he approved: full walk by the session (11 tabs x 8 directions) BEFORE he sees anything, one defect list, fix per room, full walk again, then the test link.
