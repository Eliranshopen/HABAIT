#!/bin/bash
# the skill's baked media into the walk: sync_media.py (atlases + model, geometry equal across keys) + the floor's light map per key
set -e
OUT=$1; J=/c/RnD/.wt/avnei-hefetz-kedem-5/out/avnei-hefetz-kedem/building-10/5-rooms; cd $J
timeout 300 python -I /c/RnD/.claude/skills/day-night-keyframes/scripts/walk/sync_media.py "$(cygpath -w $OUT)" "$(cygpath -w walk/skill)" "$(cygpath -w work/skillbake/walk_presets.json)"
for k in morning noon golden night; do cp $OUT/$k/gl/bake_*_shade.png walk/skill/media/$k/ 2>/dev/null || echo "no shade for $k"; done
python -c "
import json; d=json.load(open('work/skillbake/walk_presets.json',encoding='utf-8'))
json.dump({'keys':[{'name':k['name'],'hour':k['hour']} for k in d['keyframes']]}, open('walk/skill/daynight.json','w'), indent=1)"
ls walk/skill/media/noon | head -20; echo SYNCED
