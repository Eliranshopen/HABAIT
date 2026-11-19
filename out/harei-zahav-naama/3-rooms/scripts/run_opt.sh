#!/usr/bin/env bash
# slim every AI GLB not yet in walkaround/items/glb (Blender under the machine lock), one at a time
cd "$(dirname "$0")/.."
while read k; do
  [ -f walkaround/items/glb/$k.glb ] && continue
  python scripts/run_blender.py --wait 3000 --timeout 600 -- -b --factory-startup -P scripts/blender/optimize_glb.py -- . $k 2>&1 | grep -E "OPT OK|Error" | sed "s/^/$k: /"
done < work/to_opt.txt
echo RUN_OPT_DONE
