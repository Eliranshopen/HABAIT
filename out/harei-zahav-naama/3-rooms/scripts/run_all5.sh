#!/usr/bin/env bash
# 2026-11-18, the sales-sheet layout: slim the corner sofa, rebuild + bake (walk5), then the photo skin and the hours (run_skin5.sh)
cd "$(dirname "$0")/.."
echo "== opt $(date +%H:%M)"
[ -f walkaround/items/glb/sofa_corner.glb ] || python scripts/run_blender.py --wait 6000 --timeout 900 -- -b --factory-startup -P scripts/blender/optimize_glb.py -- . sofa_corner 2>&1 | grep -E "OPT OK|Error"
[ -f scene/hatzav_v2.blend ] && mv scene/hatzav_v2.blend scene/hatzav_v2-renders-layout-2026-11-18.blend
echo "== build $(date +%H:%M)"
bash scripts/run_v5.sh || exit 1
echo "== skin $(date +%H:%M)"
bash scripts/run_skin5.sh
