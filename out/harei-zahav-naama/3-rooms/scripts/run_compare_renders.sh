#!/usr/bin/env bash
# render every comparison GLB (and the Hunyuan originals) in the same studio, one Blender at a time under the machine lock
cd "$(dirname "$0")/.."
for it in lounge_chair sofa_corner; do
  for m in hunyuan rodin meshy tripo hitem; do
    g=items/compare/$m/$it.glb; [ $m = hunyuan ] && g=items/glb/$it.glb
    o=qa/compare/${it}_$m.png; [ -f $o ] && continue
    python scripts/run_blender.py --wait 6000 --timeout 600 -- -b --factory-startup -P scripts/blender/compare_render.py -- $g $o --res 900 2>&1 | grep -E "CMP OK|Error" | cut -c1-200
  done
done
echo COMPARE_RENDERS_DONE
