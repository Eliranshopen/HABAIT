# Task 07 — `export_dollhouse.py --bake-light` (rendered light in the tour's palette)
**Agent:** `blender-scene` (status live, track habait) · **Model:** opus · **Ruling tier:** T1 (Blender ownership, card 02c; the palette follows the tour's existing material board, with no new style decision) · **Burst:** 6 · **Depends on:** 06 PASS, Eliran's look at Phase 1, 02c
**Memory file:** `memory/agents/blender-scene.md` (standing agent)
All paths are inside `C:\RnD\.wt\apartment-3d\`. The source `.blend` is read from the live path, read-only, and never saved.

## What to do (`360walkaround/pipeline/export_dollhouse.py`, "ED")
1. **The flag:** `--bake-light [--bake-res 2048] [--bake-samples 128]`. Without it, the output is byte-identical to today (prove it with the sha256 of the GLB).
2. **Palette override in memory, before the bake:** use `Habait/tour360/apartments/apt846/material-board.json` (`habait-tel-aviv-luxury-v1`).
   - walls → warm white plaster;
   - door leaves and jambs → cream, the wall colour (fixes `wood_oak` from `general_furnish.py:950-994` for the bake only);
   - kitchen fronts → sand grey;
   - fabrics → ivory/cream boucle.
   The floor stays neutral, because the bake is light-only.
3. **Where it slots:** after the cut and merge (ED up to `:541`), before the originals are deleted (`:549`).
   - Lightmap-pack UVs (`bpy.ops.uv.lightmap_pack` or Smart UV with margin) on the joined output nodes, into one shared atlas. Caps and glass are excluded.
   - Selected-to-active **Diffuse bake, direct + indirect, colour off**, from the full-height originals: ceilings, `CEILFILL`, `L_ceil_*`, `L_sun`, HDRI.
   - Cycles CPU, OIDN denoise, seed 0.
   - Reuse the `smart_uv`/`do_bake` patterns of `Habait/flyover/bake_skins.py:275-287, 439-481` (read-only reference).
4. **Export:**
   - `export_texcoords=True` (`:623`), texcoord quantization 12 (`:621`), `"UV"` added to the `dissolve_limit` delimit (`:573`); the merged parts share one UV layer name (`:518-519`).
   - The atlas is written as `light.webp` (q85) next to the GLB, plus a 1024 px phone copy.
   - The three floor variants still share one BIN chunk (light-only bake; the floor colour stays a material factor). Assert it, as `build_zip.mjs:539` does.
5. **Report:** `report.json` `bake{res, samples, seconds, atlas_bytes, scene_sha256, palette_source}`. `--selftest` is extended for the new classifier/flag paths.
6. **The run:** one local run under `timeout`, only once Blender is ruled free for rnd-23 (02c). Write a `manifest.json` row in the work tree (inputs, hash, cost $0). Measure the CPU time; it was only estimated (20–40 min).

## Files
- modifies: `360walkaround/pipeline/export_dollhouse.py`
- creates: `Habait/engine/_local/apt846/dollhouse/{apt846-*.glb,light.webp,light-1024.webp,report.json}` in the work tree
- reads: live `Habait/studio/_local/projects/apt846-rainbow-tlv/renders/scene.blend` (read-only, never saved), `material-board.json`

## Acceptance
- `python export_dollhouse.py --selftest` passes.
- Without `--bake-light`, the GLB sha256 equals today's.
- With it: 3 GLBs with one shared BIN hash, `light.webp` ≤ 600 KB at 2048, and the measured bake time in the report.
- The live `scene.blend` sha256 is unchanged.
- Visual: a Workbench/EEVEE preview of the GLB with the atlas shows no black islands, no seams over 2 px on walls, and no baked-in light above the 1.2 m cut. Save it to `after/phase2/`.

## Standing rails (inherited verbatim from the board README — root `CLAUDE.md` §0)
1. **Bounded read-first:** `memory/HOT.md`, then the LAST ~150 lines of your own `memory/agents/<name>.md` (plus its archive-index block). ⛔ Never read `memory/INDEX.md` whole — grep it.
2. **Write last, once:** ONE entry (`memory/_TEMPLATE.md`) into the layer that owns the fact, plus ONE ≤ 400-char pointer line under that layer's existing `memory/INDEX.md` header. ⛔ Never add a header.
3. **Second reader:** name which OTHER actor must know this; append ONE pointer line into their `memory/agents/<name>.md`, or say "none".
4. **An action is not done until its memory is written.**
5. ⛔ **The live repo `C:\RnD\Projects\Habait\habait-walkaround\` is read-only to every card until card 10.** Every write goes into `C:\RnD\.wt\apartment-3d\` (same relative paths as the repo) or into this board folder. Memory rows are the only live writes (root §8.7).
6. ⛔ **No git anywhere** (Eliran, 2026-11-03). `CHANGES.md` in the work tree is the diff.
7. ⚠ **Machine resource rules** (root `CLAUDE.md` §12): every test, build, server, browser or render runs as `timeout N <cmd>`, one heavy run at a time, foreground; kill what you start by PID. The work-tree server is `PORT=8851`. Never use :8850 (another session's port).
8. ⛔ **Blender only by its owner** (`Projects\Habait\SESSIONS.md` rule 4); no paid call on this board ($0 plan). Deploying is a separate explicit go from Eliran (root §9).
