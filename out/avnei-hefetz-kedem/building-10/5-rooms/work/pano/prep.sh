#!/bin/bash
# 360: the final model -> .blend (18_to_blend) -> noon light (the skill's relight.py) -> a quick test panorama
cd /c/RnD/.wt/avnei-hefetz-kedem-5/out/avnei-hefetz-kedem/building-10/5-rooms
SK=/c/RnD/.claude/skills/day-night-keyframes/scripts
[ -f work/pano/final.blend ] || timeout 7300 python scripts/blender_run.py --wait 7200 -- -b --factory-startup -P scripts/18_to_blend.py -- scene/apartment-final.glb "$(cygpath -w work/pano/final.blend)" 2>&1 | grep -a "TO_BLEND"
[ -f work/pano/noon.blend ] || timeout 3700 python scripts/blender_run.py --wait 3600 -- -b "$(cygpath -w work/pano/final.blend)" --factory-startup -P $SK/relight.py -- --presets "$(cygpath -w work/skillbake/walk_presets.json)" --key noon --out "$(cygpath -w work/pano/noon.blend)" 2>&1 | grep -a "RELIGHT_OK\|Error" | cut -c1-200
timeout 3700 python scripts/blender_run.py --wait 3600 -- -b "$(cygpath -w work/pano/noon.blend)" --factory-startup -P scripts/blender/30_render_panos.py -- "$(cygpath -w work/pano_points.json)" "$(cygpath -w work/pano/test)" --res 1536 --samples 16 --only dining 2>&1 | grep -a "PANO_OK\|Error"
echo PREP_DONE
