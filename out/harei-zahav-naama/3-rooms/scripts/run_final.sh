#!/usr/bin/env bash
# 2026-11-18 final: the Hitem3D pieces (Eliran let me pick the winner of the comparison) into the sales-sheet layout.
# 1 swap the GLBs (the Hunyuan ones kept in items/glb_hunyuan/)  2 slim: desktop 150k faces / 2048 maps, phone 30k / 1024 (_m)
# 3 build_v2 on the plan's base scene + bake (walk6)  4 the photo skin and the hours (run_skin6.sh; it stops for a look at the frames)
cd "$(dirname "$0")/.."
IDS="sofa_corner lounge_chair rattan_pendant dining_chair dining_table alt_ctable_nesting mushroom_lamp wall_sconce vase_branches ribbed_vase globe_lamp stone_bowl kitchen_props kids_bed nightstand paper_lantern kids_rug"
mkdir -p items/glb_hunyuan
echo "== swap $(date +%H:%M)"
for k in $IDS; do
  h=items/compare/hitem/$k.glb
  [ -f $h ] || { echo "MISSING hitem $k"; continue; }
  [ -f items/glb_hunyuan/$k.glb ] || { [ -f items/glb/$k.glb ] && cp items/glb/$k.glb items/glb_hunyuan/$k.glb; }
  cp $h items/glb/$k.glb
  rm -f walkaround/items/glb/$k.glb walkaround/items/glb/${k}_m.glb   # the old slimmed copies are rebuilt from the new GLB
done
echo "== slim $(date +%H:%M)"
for k in $IDS; do
  [ -f items/glb/$k.glb ] || continue
  python scripts/run_blender.py --wait 6000 --timeout 900 -- -b --factory-startup -P scripts/blender/optimize_glb.py -- . $k --faces 150000 --tex 2048 --q 90 --nopreview 2>&1 | grep -E "OPT OK|Error" | cut -c1-160
  python scripts/run_blender.py --wait 6000 --timeout 900 -- -b --factory-startup -P scripts/blender/optimize_glb.py -- . $k --faces 30000 --tex 1024 --q 85 --suffix _m --nopreview 2>&1 | grep -E "OPT OK|Error" | cut -c1-160
done
echo "== build $(date +%H:%M)"
[ -f scene/hatzav_v2.blend ] && mv scene/hatzav_v2.blend scene/hatzav_v2-before-final-$(date +%H%M).blend
sed -e 's|W=work/walk4|W=work/walk6|' scripts/run_v3.sh > scripts/run_v6.sh
bash scripts/run_v6.sh || exit 1
echo "== skin $(date +%H:%M)"
sed -e 's|work/walk5|work/walk6|; s|frames5|frames6|g; s|photos5|photos6|g; s|views5|views6|g; s|proj5|proj6|g; s|out5|out6|g' scripts/run_skin5.sh > scripts/run_skin6.sh
bash scripts/run_skin6.sh
echo RUN_FINAL_DONE
