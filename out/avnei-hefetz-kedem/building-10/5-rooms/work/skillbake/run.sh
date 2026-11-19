#!/bin/bash
# the day-night-keyframes skill, mode B, on this apartment: to_blend -> prep -> 4 keys (noon first). Every Blender call waits on the lock.
set -e
J=/c/RnD/.wt/avnei-hefetz-kedem-5/out/avnei-hefetz-kedem/building-10/5-rooms; SK=/c/RnD/.claude/skills/day-night-keyframes/scripts/walk; W=$J/work/skillbake
cd $J
[ -f $W/look6.blend ] || timeout 3900 python scripts/blender_run.py --wait 3600 -- -b --factory-startup -P scripts/18_to_blend.py -- scene/apartment-look.glb "$(cygpath -w $W/look6.blend)"
[ -f $W/prep6/prep.blend ] || timeout 3900 python scripts/blender_run.py --wait 3600 -- -b "$(cygpath -w $W/look6.blend)" --factory-startup -P $SK/walk_bake.py -- --stage prep --dir "$(cygpath -w $W/prep6)" --groups 6 --size 2048
# one bounded call per key set: each Blender call waits on the lock, then is killed by the driver at 3800 s at most
for keys in noon morning,golden,night; do
  timeout 9000 python -I $SK/walk_keyframes.py --prep "$(cygpath -w $W/prep6/prep.blend)" --presets "$(cygpath -w $W/walk_presets.json)" --out "$(cygpath -w $W/out6)" --keys $keys --samples 16 --timeout 3800 --blender "$(cygpath -w $J/scripts/blender_locked.cmd)" --run 2>&1 | tail -4
  echo "[$keys] $(date +%H:%M)"
done
echo CHAIN_DONE
