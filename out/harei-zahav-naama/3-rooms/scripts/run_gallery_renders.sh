#!/usr/bin/env bash
# a studio render of every Hitem3D piece (for the items page), one Blender at a time under the machine lock
cd "$(dirname "$0")/.."
for g in items/compare/hitem/*.glb; do
  k=$(basename $g .glb); o=qa/compare/${k}_hitem.png
  [ $k = sofa_corner ] && rm -f $o   # the earlier short L was rendered under this name
  [ -f $o ] && continue
  python scripts/run_blender.py --wait 6000 --timeout 600 -- -b --factory-startup -P scripts/blender/compare_render.py -- $g $o --res 800 2>&1 | grep -E "CMP OK|Error" | cut -c1-80
done
echo GALLERY_RENDERS_DONE
