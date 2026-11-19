# Hatzav walkaround — real, high-end objects from the renders, plus the RAINBOW features
2026-11-17 · Eliran's ask (same evening as the walkaround delivery, `.wt/harei-zahav-naama`):
- «אתה חייב לשדרג את כל האובייקטים … כרגע זה נראה מאוד מאוד זול» / «זה נראה ממש מצויר»
- «להשתמש בהם [התמונות] כרפרנס כדי לבקש ממודל של FAL לייצר לך בדיוק את אותם הפריטים … עבור 3D WALK AROUND»
- «תמצא כלי שיודע לקחת את אותם תמונות לנתח אותם ולהעביר פרויקט מדויק למודל בFAL … באותם צבעים»
- «אני רוצה את כל הפיצ'רים שקיימים בפרויקט של RAINBOW כמו שינוי ריהוט או אביזרים ע"י לחיצה על העיגול … וגם שורת טקסט חופשי לעיצוב»

State: **EXECUTING.** Eliran's answers (dialog, 2026-11-17 evening): pilot 3 items ≈ $2.5 · build in the Hatzav walk first · all four feature groups in round one · catalog: «the alternatives are different items» (source and its ≈ $13 spend still to be asked after the pilot).
Progress: pilot DONE on fal — $2.04 of $2.50 (`JOB/items/ledger.json`; studio photos `items/studio/`, GLBs `items/glb/`); features written (`walkaround/items.js`, `scripts/17_walk_server.mjs`, check `scripts/19_features_check.mjs`); next: slim GLBs (`optimize_glb.py`), `build_v2.py` → bake v2 (floor in its own atlas + shading map) → checks. Job folder `C:\RnD\.wt\harei-zahav-naama\out\harei-zahav-naama\3-rooms` (= JOB).

## 1. Why it looks drawn (evidence)
| Cause | Evidence |
|---|---|
| Furniture is boxes and lathes, not designed objects | `scripts/blender/hz_public.py`, `hz_furniture.py`; even a full Cycles still looks drawn (`work/test/d_tvwall.png`, `d_kitchen.png`) |
| Materials: oak grain too large and orange, walls a flat colour, fabric with no weave/sheen | same stills against renders 0060000, 1_CShading |
| Web display: baked diffuse only, 2048 atlases, no gloss | `walkaround/walk.js` (MeshBasicMaterial) |
Research: `JOB/docs/upgrade-research.md` (capability-scout, $0 probes). Verdict: replace the objects first; a better bake or splats would only polish boxes.

## 2. The chain (one item at a time, dry-run first, ledgered)
| Step | Tool | Cost per item | Output |
|---|---|---|---|
| 1 Crop | `scripts/15_item_crops.py` (done, $0) | $0 | `items/crops/<id>.png` + measured hex colours, `items/items.json` (26 items) |
| 2 Analyse → exact spec | vision LLM `google/gemini-3.7-flash` (the one RAINBOW's scan uses), Claude reviews | ≈ $0.003 | per item: shape, proportions, materials, hex colours, size in cm from the plan box |
| 3 Clean studio photo, same item, same colours | `fal-ai/nano-banana-pro/edit` (crop + spec as prompt), one ¾ view, + a back view for sofas/chairs | $0.15 per view | `items/studio/<id>_*.png` |
| 4 Image → 3D | `fal-ai/hunyuan-3d/v3.1/pro/image-to-3d` with PBR (+ multi-view) — fallback `fal-ai/hyper3d/rodin/v2.5` ($0.40) | ≈ $0.53–0.68 | `items/glb/<id>.glb` |
| 5 Place | Blender: scale to the plan box (geometry.json), replace the box piece | $0 | scene |
| 6 Built-ins (kitchen, shelving walls, bookcases, vanity, console) | NOT AI 3D (thin boards fail): Blender geometry with 4 mm rounded edges, real oak veneer at true scale, darker back panels, real books/decor | $0 | scene |
| 7 Walls, light | limewash plaster texture, warm light, AgX; proof script `scripts/blender/proof_upgrade.py` | $0 | |
| 8 Web | three.js MeshStandardMaterial: baked lightmap + roughness/normal detail + room reflection probes (oak and stone gloss); 4096 atlases | $0 | walkaround |
| 9 QA | the same angles as the 9 renders, side by side; Chrome at 1440 + 390 | $0 | `qa/upgrade/` |

**Estimate:** ≈ 20 AI items × (≈ $0.003 + $0.15–0.30 + $0.53–0.68) ≈ **$14–20**. Pilot first: 3 items (sofa, lounge chair, rattan pendant) ≈ **$2.5**, show Eliran, then the rest.
Copyright: the kids' room poster in render 0030000 is a film-brand poster — it is replaced by neutral art, never copied.

## 3. RAINBOW features → the 3D walk
Inventory of `Projects/Habait/.../tour360` (Explore agent, 2026-11-17). In a real 3D walk most of RAINBOW's pixel pipeline is not needed: a swap = load another GLB, $0 per click, exact, no left-overs.
| RAINBOW feature | In the walk | Cost per use |
|---|---|---|
| Rings on furniture → pick from a catalog → swap (`tour.js` 163-215, `edit-live.js`) | ring on every movable piece (raycast), same catalog UI and Hebrew copy; each catalog item needs its own GLB (same chain, step 3–4) | $0 per click; ≈ $0.7 once per catalog item |
| Free-text design line (`handler.mjs` prepare + scope rule) | same text step (Gemini + scope rule: object/surface/light yes, structure no) → scene operations: swap item, recolour / re-material, light; a request with no matching operation → say so | ≈ $0.003 per request |
| Floor finish (parquet / concrete / marble) | material swap on the floor | $0 |
| Original / designed toggle, undo / compare / reset | material set toggle, command stack | $0 |
| Plan sheet + minimap with cone | plan image + position | $0 |
| Measure | raycast two points | $0 |
| Language he/en/fr, disclosure badge, lead/contact | copy pack, same badge | $0 |
| Audio tour | later, on Eliran's word | — |
Disclosure: the badge stays «הדמיה · Visualization»; AI-made objects add the line «פריטים נוצרו בעזרת AI להמחשה».

## 4. Order
1. Pilot 3 items ($2.5) + the $0 built-in/material proof → Eliran's look.
2. The other items (≈ $12–17) + built-ins + web shading → walk QA.
3. RAINBOW features: rings + catalog, then free text, then finishes/undo/minimap/measure.
4. QA (live, both sizes); no deploy without his own go.

## 5. Open questions (asked as a dialog)
Spend for the pilot and the whole; 3D model choice; which RAINBOW features first; catalog size.
