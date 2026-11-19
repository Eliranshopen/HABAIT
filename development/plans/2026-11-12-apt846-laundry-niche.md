# 2026-11-12 — apt846: the laundry niche as the sales plan draws it (open, a washing machine, no door)

**Ask (Eliran, 2026-11-12):** «שים לב שבהדמייה יש דלת שאני לא חושב שמופיעה בתכנית מכר תבדוק בבקשה» → checked (memory `project/2026-11-12-laundry-niche-door.md`) → «תעשה כמו שזה נראה בתכנית מכר».

**What the plan draws:** on the west wall between the entrance and the main bath, a wall fin. Its north face holds the electrical cabinet (the box with the lightning sign). South of it is the washing-machine niche (a circle in a square), open toward the living room, with no door line and no swing.

**What ships today:** a tall white zero-line door with a black lever closes the niche. It came from our 2026-11-05 reading (fixture `l-laundry` «closed by a zero-line flush door», skin-notes 01/04), not from the plan. It is visible in `04-living` (left of the pillar) and `02-kitchen`. In `01-entrance` the fin hides the niche: the door seen there is the electrical cabinet's face, which the plan does draw.

## Steps
1. **Source of truth ($0, done in worktree `apt846-laundry-niche`):**
   - `plan.json` and `plan.general.json`: `l-laundry` becomes kind `washer`, 85 cm high, an open niche with a washing machine and no door.
   - `skin-notes` 01/04 updated to match.
   - `washer` added to the fixture kinds (`build_scene.py`, `validate-plan-general.mjs`); the validator passes.
2. **Pictures (paid, BLOCKED: fal balance exhausted 403):** run `qa-evidence/tour360/laundry-door-2026-11-12/tools/laundry-prep.mjs`, which wrote `_local/laundry/prompts.json` with 8 edits: 02 and 04 × base, parquet, concrete, marble. Each edit is gpt25-medium, seed 91, booked $0.20, so $1.60 in all (cap: ledger hard cap $380; ledger $365.04). Dry run OK. After the top-up:
   - Run `gen-pano.mjs apt846 <id> gpt25-medium --prompts _local/laundry/prompts.json --seed 91 --cap 380` per entry.
   - Paste only the niche polygon of each answer onto the shipped picture (r4paste-style).
   - Run the 1 % gate on every changed byte.
3. **Owed (later, $0):**
   - Re-render the CG of cp-living, cp-kitchen and cp-entrance from the corrected plan, so the gate's Image 1 shows the open niche.
   - Rebuild the dollhouse. It is the platform `media/dollhouse.html`, exported 2026-11-02, from before `l-laundry`; check what it shows at the niche.
4. **QA (closing cards):** look at 02/04 by eye on all 4 floor sets; build-tour gate PASS; test link at 1440 and 390 (living and kitchen toward the entrance); every room button still OK (`allbuttons.mjs`, the living → bedroom-wing button sat on this door per hotspot-check 2026-11-11). Then Eliran's look; production only on his own go.

**Open for Eliran:** the electrical cabinet keeps its full-height flush front with a lever, which reads like a door. The plan draws a cabinet there, so it stays unless he says otherwise.

## Result (2026-11-12 ~16:40)
- Only `04-living` shows the niche. In `02-kitchen` the curved TV wall hides it: the door the model changed there was the front door, so those answers were discarded ($1.00). In `01-entrance` the fin hides it.
- One answer (04 concrete, seed 93, the door's exact width); its niche polygon was pasted on all 4 floor sets. Gate PASS 0.44 % ×4, build gate PASS.
- Test link `dpl_DRbtHkYu` (test-r43); buttons 30/30. Money: ≈ $2.32 of the $3 cap.
- Production waits for Eliran's own go. Step 3 (CG re-render, dollhouse) is still owed.
