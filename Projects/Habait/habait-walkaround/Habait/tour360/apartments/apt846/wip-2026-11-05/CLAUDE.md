<!-- context file · 2026-11-05 · fix-846-fidelity WIP snapshot -->
# wip-2026-11-05 — the fix-846-fidelity state at the account switch (2026-11-05 ~19:15)

Snapshots of two `_local` files the next session needs (the `_local` folder itself is not tracked):
- `picks.json` — the picture each room ships (`_local/generated/<file>`); copy back over `_local/picks.json` if it was lost.
- `ledger.json` — the paid-call ledger, settled $216.58 (ceiling $234.89 by the coordinator; one-liner owed at $224.89).

## Where the work stands (third account switch, ledger $216.58, ceiling $234.89, one-liner owed at $224.89)
- CG: all 11 points on the frozen cameras. All 11 pictures gate PASS at 1% (01 0.80, 02 0.24, 03 0.46, 04 0.44, 05 0.09, 06 0.00,
  07 0.72, 08 0.78, 09 0.29, 10 0.51, 11 0.28).
- Done since f39d8f3: the entrance ghost twig band-repaired (u 0.894) + its 3 finishes redone PASS; consistency bands with --ref:
  04 (the invented door on the TV wall removed), 02 and 03 (their view of the living copies 04), 08 (no bench; bed copies 07),
  07 (bed foot, straight — the judge still reads a curved foot).
- Consistency, every group judged: PASS kitchen (re-run), dining, living, wardrobe, bedroom-2, bath-guest, bath-main,
  terrace-railing. FAIL bedroom-main only: 07's bed reads as having a curved bench/foot extension, 08's bed a plain rectangular
  base (sheet _local/fidelity/consistency__bedroom-main__picks__*.jpg, newest).
- Floor finishes: PASS on the CURRENT picks for 01, 05, 06, 09/11 (none), 10. STALE (their pick changed after the finishes):
  02, 03, 04, 07, 08 -> redo 15 finishes ($9.00).

## The exact next step (wait for the coordinator's "resume" before any paid call or render)
1. bedroom-main group: one band on 07 at the bed's foot (07 pick, u ~0.20-0.25, band ~40 deg, near the camera) to a plain
   rectangular upholstered base with no bench/curved foot extension (geometry from Image 2), gate, then
   `consistency-check.mjs apt846 --group bedroom-main --set picks --judge --cg-tour apt846-furnished`.
2. Redo the finishes of 02, 03, 04, 07, 08 (`finish_all.sh 02-kitchen 03-dining 04-living 07-bedroom-main 08-wardrobe`), each gated.
   Budget: ~$10.20 for 1+2 -> ~$228; send the one-liner at $224.89; stop before $234.89.
3. Final `--all-groups --judge` (every group PASS), rings rescan, make-sets, `build-tour.mjs apt846 --catalog=ai` must package.
4. 1440/390 screenshots (qa-1440-390.cjs) incl. the hotspots (scenes.json R23) and one typed edit on phone.
5. Merge into main by hand (consistency-check.mjs onto fork F's version; stage own paths), copy `_local` picks/finish sets to live, report.

## Links
Parent: [../CLAUDE.md](../CLAUDE.md)
