
## 2026-11-04 · main session rnd-67 · apt-furniture-swap (plan)
- **Did:** Eliran asked: swap any furniture from a catalog + a typed prompt bar in the apartment sim. Found the prototype (edit-live.js, CATALOG-PLAN, demo-01 only, behind the unlock code). Eliran: extend it; catalog = IKEA (laptop-only, OQ-C1) + fal-generated; access = session's call: behind the code, 5 USD soft / 10 hard. Worktree .wt/apt-furniture-swap off main 7b6f617. Task 1 (hold glide after the orbit clip looked frozen) handed to rnd-32 on exterior-film; it confirmed and fixed in its working copy.
- **Evidence:** `development/plans/2026-11-04-apt-furniture-swap.md`
- **Learned:** The furniture swap and typed bar already exist as the T14-T18 prototype; apt846 lacks markers.json (scan-pieces.mjs). The hold's idle arc glide (holdarc.js GLIDE_FPS 4.5) after the clip reads as a stall.
- **Owed / open:** rnd-67: /plan-to-tasks for the board; rnd-32: glide fix evidence in the exterior-film board logs (glide-*)
- **Second reader:** `habait-deploy-qa`

## 2026-11-04 · main session rnd-67 · apt-furniture-swap P1 P2 P4 progress
- **Did:** Branch apt-furniture-swap commits 006c397 + a914d6f: chat calls go through fal when there is no OpenRouter key; apt846 scanned; 18 AI catalog items; 49 rings in 8 scenes incl. bedrooms; build --catalog=ai; 2 paid swaps held by the judges. Spent about 1.86 USD of 5 (ledger and progress in the plan).
- **Evidence:** `development/plans/2026-11-04-apt-furniture-swap.md`
- **Learned:** The replace judge passes swaps that the eye fails: a wedge cut into the rug under a new sofa, and the old table's plant left on the floor. The IKEA photos are gone from disk (catalog _local missing).
- **Owed / open:** rnd-67: fix the paste leftovers, the typed bar on apt846, a bed swap, a fresh judge, merge, QA
- **Second reader:** none

## 2026-11-04 · main session rnd-67 · Eliran: the swap and the typed bar go on habait-flow, open to everyone, FAL key from .env
- **Did:** Eliran ruled: the capability (ring on a piece opens the catalog; typed bar generates the change) must work on https://habait-flow.vercel.app for everyone who enters, no code; the session moves FAL_KEY from .env to the Vercel env by command (replaces D-T360-18 for this project). Not a batch restyle of the apartment.
- **Evidence:** `development/plans/2026-11-04-apt-furniture-swap.md`
- **Learned:** An open paid endpoint needs guards: per-IP limit + per-instance daily cap; a fal console spend limit is Eliran's act.
- **Owed / open:** rnd-67: wire /api on habait-flow, open mode, IP limit, merge main, local proof, then ask Eliran for the deploy go
- **Second reader:** `secrets-steward`

## Backlog from Eliran (2026-11-04 ~16:30, rnd-9d) — "עדיפות אחרונה", after the 846 fix, the portal reproduction and the portal itself
1. **Pre-rendered options per item:** for every swappable piece/room (living-room styles, dining sets, …) generate several variants ahead of time, so a visitor's swap is instant instead of a live generation that "takes forever". Ledgered batch per apartment, gate-checked like any designed pano.
2. **Phone UI density:** "הכל אחד על השני וממש צפוף" — re-do the phone layout of the tour with a UI skill (`ui-ux-pro-max` / `mobile-native`), after the above.
- Skills for item 2 (installed 2026-11-04 by rnd-80 on Eliran's go): `mobile-responsive` (overflow gate 320–414, 44 px targets; its check-overflow.js measures only RIGHT overflow — on RTL also check rect.left < -1 / scrollWidth > clientWidth; run bounded `timeout 300 node .claude/skills/mobile-responsive/scripts/check-overflow.js <url> 320,360,375,390,414`), `responsive-design` (container queries, clamp(), grid). Translate its physical-property examples to logical ones.
