#!/bin/bash
cd /c/RnD/.wt/avnei-hefetz-kedem-5/out/avnei-hefetz-kedem/building-10/5-rooms
W=work/skillbake
timeout 3700 python scripts/blender_run.py --wait 3600 -- -b "$(cygpath -w $W/out6/noon/prep_noon.blend)" --factory-startup -P scripts/blender/29_render_still.py -- "$(cygpath -w work/realism/cams.json)" living_1 "$(cygpath -w qa/gen/still_living_1.png)" --samples 96 2>&1 | grep -a "STILL_OK\|Error"
timeout 7300 python scripts/blender_run.py --wait 3600 -- -b "$(cygpath -w $W/prep6/prep.blend)" --factory-startup -P scripts/blender/28_project_photos.py -- --walk "$(cygpath -w $W/out6/noon)" --views "$(cygpath -w work/realism/views_proj.json)" --out "$(cygpath -w work/realism/proj)" 2>&1 | grep -a "PROJECT_OK\|Error\|view \|gain" | tail -8
echo JOBS_DONE
