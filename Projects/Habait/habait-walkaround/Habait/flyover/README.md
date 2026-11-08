# flyover — camera-projection experiment (lane C)

Can a GPT-skinned photoreal image of the tower be "baked" onto `tower-mass.obj` by camera projection so new angles render with
the photoreal look and stable geometry? Results and verdict: `REPORT.md`. Contact sheets: `renders/contact.jpg`
(two keyframes) and `renders-pano/contact.jpg` (two 360 nodes cut into cube faces).

Inputs are read in place (read-only) from `../studio/_local/projects/apt846-rainbow-tlv/` and
`../tour360/apartments/apt846/_local/panos-ext/`; nothing under `studio/` or `tour360/` is written.

## Files

* `project_skin.py` — Blender script: imports the mass, lays the orthophotos, builds one camera + depth map + shader block per
  projector, renders views × variants (`clay`, `proj1` = first projector group, `proj2` = all, `cov` = coverage mask), measures
  area coverage by ray casting. Projector frames: `X = x_cm/100, Y = -y_cm/100, Z up, unit floor at 0` (the studio frame; the OBJ
  is imported with forward Y / up Z, i.e. untransformed).
* `projectors.json` — the two keyframes with the clay cameras they were generated from (frame 1 of `renders/clay/<shot>/camera.json`).
* `equi2faces.py` — cuts a skinned equirect into the six cube faces of the studio's `faces.json` (inverse of `tools/cube2equi.py`).
* `projectors-panos.json`, `panos/<node>/face_*.png` — the 12 cube-face projectors of node-b-tower and node-c-facade.
* `contact_sheet.py` — contact sheet + `sanity.jpg` + `pixel_coverage.json` from a renders folder.

## Commands (Git Bash)

```bash
BLENDER="C:/RnD/Projects/Habait/tools/blender-4.5.10/blender-4.5.10-windows-x64/blender.exe"
PY="C:/RnD/Projects/Habait/tools/habait-venv/Scripts/python.exe"
F="C:/RnD/Projects/Habait/habait-walkaround/Habait/flyover"
P="C:/RnD/Projects/Habait/habait-walkaround/Habait/studio/_local/projects/apt846-rainbow-tlv"
T="C:/RnD/Projects/Habait/habait-walkaround/Habait/tour360/apartments/apt846/_local"
export PYTHONIOENCODING=utf-8
cd "$F"

# run A: two keyframes (approach + facade). ~1 min. Always pass absolute paths (Blender resolves relative --out against its own cwd).
"$BLENDER" -b --factory-startup -P project_skin.py -- --projectors "$F/projectors.json" --out "$F/renders" \
    --res 960x540 --samples 16 --variants clay,proj1,proj2,cov --views orig,az-30,az+30,az+60,low --orbit 12 --save-blend
"$PY" -I contact_sheet.py --renders "$F/renders"

# run B: 360 nodes -> cube faces -> 12 projectors. ~1.5 min.
"$PY" -I equi2faces.py --node node-b-tower  --equi "$T/panos-ext/node-b-tower.png"  --faces "$P/renders/clay-nodes-ortho/node-b-tower/faces.json"  --out "$F/panos/node-b-tower"
"$PY" -I equi2faces.py --node node-c-facade --equi "$T/panos-ext/node-c-facade.png" --faces "$P/renders/clay-nodes-ortho/node-c-facade/faces.json" --out "$F/panos/node-c-facade"
"$PY" -I -c "import json;a=json.load(open('$F/panos/node-b-tower/projectors.json'))['projectors'];b=json.load(open('$F/panos/node-c-facade/projectors.json'))['projectors'];json.dump({'projectors':a+b},open('$F/projectors-panos.json','w'),indent=1)"
"$BLENDER" -b --factory-startup -P project_skin.py -- --projectors "$F/projectors-panos.json" --out "$F/renders-pano" \
    --res 960x540 --samples 16 --variants clay,proj1,proj2,cov \
    --views "orig,az-30,az+30,az+60,low,at;68.4477;-47.2597;17.7875;8.765;-9.9516;4.1123;18;nodeb" --orbit 12
"$PY" -I contact_sheet.py --renders "$F/renders-pano" --views "nodeb,orig,az-30,az+30,az+60,low" \
    --t1 "projected: 360 node-b (6 faces)" --t2 "projected: node-b + node-c (12 faces)" --tc "coverage R=node-b G=node-c grey=unseen" \
    --keyframe "$F/panos/node-b-tower/face_left.png" --sanity-view nodeb
```

### Options worth knowing

* `--views`: `orig` (the approach keyframe camera), `az<deg>` (rotate the approach camera about its look point, + = counter-clockwise
  from above), `low` (110 m out, 40 m up), `orbit<N>` (N cameras around), `at;x;y;z;lx;ly;lz;lens;label` (any camera).
* `--variants dbgA,dbgB` render the projector's u/v/alpha and d/D/visibility to debug a projector.
* `--bare` projects onto the bare mass only (no railings/mullions/bushes). `--no-ortho` drops the ground.
* Projector entries: `image`, `lens_mm`, `sensor_mm`, `res`, and either `pos`+`look` or a Blender `matrix_world`; optional
  `group` (faces of one node share a group; `proj1` = first group), `tol_abs`/`tol_rel` depth-test tolerance (default 0.35 m, 0.4 %).
* Depth maps are cached as `renders*/depth_<name>.exr`; delete them if a projector camera changes.

## Notes

* EEVEE Next ignores `view_layer.material_override`, so the depth pass assigns the depth material directly.
* The EXR depth maps come out half-float (0.125 m steps at 230 m) — within the depth tolerance.
* A first test run wrote to `C:\renders\_test` because `--out renders/_test` was relative; the files were moved into
  `flyover/renders/_test` and the empty `C:\renders` folder was left for the user to delete.

## C1 (2026-11-02): skins of the 4 exterior 360 nodes baked onto site.glb

* `bake_skins.py`: UV atlases (tower 4096, others 2048) + per-vertex details. Visibility comes from Cycles point-light
  bakes at each node, the colour from spherical lookup into the equirect skins, plus an edge guard from per-node depth
  equirects. Writes `renders/baked/` (PNG skins, `_cov` coverage codes, `_src` winning node, `baked.blend`). Mapping and
  weights are in the header.
* `render_check.py`: 6 new cameras along a->b->c->d (2 equirect, 4 perspective), a 6-frame sequence, a node-b sanity
  render, coverage and blur stats, and `renders/baked-check/contact.jpg` (`--orbit 12` = coverage sweep, not run yet).
* `export_glb.py`: `renders/baked/site_baked.glb` (unlit, for the :8899 viewer). See `renders/baked/BAKED-README.md`.

## v5 (2026-11-02): 16 nodes, full orbit coverage (`skins-extra/`)

* `skins-extra/make_nodes.py` → `nodes-extra.json` (7 ring-B nodes every 45° at node-b's radius 81.9 m / z 17.79 about the tower
  centroid (-5.9, -13.0); the ring-A slots +120/+240 from node-a are the existing `node-o2/o4-orbit` skins) + `shots.extra.json`
  (render_shots.py input) + `bake-nodes-v5.json` (the `bake_skins.py --nodes` list: a, b, c, d, o1..o5, rb045..rb315).
* Clay: studio `tools/render_shots.py` (unchanged, read-only) + `tools/cube2equi.py` → `skins-extra/clay-pano/`; `node-b-control`
  re-renders node-b and matches the studio clay (MAE 0.003). Skins: `skin_nodes.py` (PAID, GPT Image 2.5, ledger
  `skins-extra/ledger.json`), `seam_feather.py` (copy of the studio tool). Never pass a whole neighbouring equirect as a reference
  (GPT copies its framing); pass a crop (`refs/node-b-tower.crop.png`).
* Bake/check/export: `bash skins-extra/run_v5.sh [bake|composite|check|before|export|all]` → `renders/baked-v5/`
  (`site_baked.glb`, same object names as v4), `renders/baked-check-v5/` (contact, `--orbit 12`, `before-v4/`, `orbit_look/`).
  `bake_skins.py` new options: `--nodes`, per node `skip_groups` / `no_gain`; default behaviour unchanged.
