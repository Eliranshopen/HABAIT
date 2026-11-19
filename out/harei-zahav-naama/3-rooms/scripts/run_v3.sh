#!/usr/bin/env bash
# The v2 walk: upgraded scene + AI pieces → prep → bake (6 groups + the floor) → export → walkaround/model_v2.
# Every Blender step takes the machine lock (run_blender.py) and is bounded; a step whose output exists is skipped (re-run safe).
set -euo pipefail
cd "$(dirname "$0")/.."
RB="python scripts/run_blender.py --wait 3000 --timeout 1500 --"
W=work/walk4
[ -f scene/hatzav_v2.blend ] || $RB -b scene/hatzav.blend --factory-startup -P scripts/blender/build_v2.py -- . 2>&1 | grep -E "V2 OK|PLACE|Error" || exit 1
[ -f $W/prep.blend ] || $RB -b scene/hatzav_v2.blend --factory-startup -P scripts/blender/walk_bake.py -- --stage prep --dir $W --groups 6 --size 2048 2>&1 | grep -E "WALK_PREP_OK|kinds|groups|Error" || exit 1
for k in 0 1 2 3 4 5 6; do
  [ -f $W/bake_$k.exr ] || $RB -b $W/prep.blend --factory-startup -P scripts/blender/walk_bake.py -- --stage bake --dir $W --group $k --samples 32 2>&1 | grep -E "WALK_BAKE_OK|baked|Error" || exit 1
done
$RB -b $W/prep.blend --factory-startup -P scripts/blender/walk_bake.py -- --stage export --dir $W --exposure -0.4 --look "AgX - Medium High Contrast" 2>&1 | grep -E "atlas|floor|Error|exported" ; ls $W/gl/walk.gltf
echo RUN_V2_DONE
