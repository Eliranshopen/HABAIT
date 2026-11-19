#!/usr/bin/env bash
# After run_v3.sh (work/walk4): the v3 model into the walk, the registry, 20 frames, 20 realism photos (fal, ≈ $3, ledgered by
# 22_realism.mjs), the photo skin (project_photos.py) and the four hours of the day (skill day-night-keyframes) on walk4.
# Every step skips what it already made (re-run safe). Needs the walk server on 8895 (scripts/17_walk_server.mjs).
set -uo pipefail
cd "$(dirname "$0")/.."
W=work/walk4; URL=http://127.0.0.1:8895; PY=/c/RnD/Projects/3Dengine/.venv/Scripts/python.exe
step() { echo "== $* $(date +%H:%M:%S)"; }

step model
[ -d walkaround/model_v2 ] || cp -r walkaround/model walkaround/model_v2
cp $W/gl/* walkaround/model/
python - <<'EOF'
from PIL import Image; import glob
for f in glob.glob('walkaround/model/bake_[0-9].jpg'): Image.open(f).resize((1024,1024), Image.LANCZOS).save(f[:-4]+'_1k.jpg', quality=88)
EOF

step registry
PYTHONIOENCODING=utf-8 python scripts/18_items_registry.py . || exit 1

step frames
mkdir -p work/realism/frames work/realism/photos
timeout 900 node scripts/21_walk_frames.mjs $URL work/realism/frames $(cat work/realism/points.txt) || exit 1

step photos
for p in $(cut -d: -f1 work/realism/points.txt); do
  room=${p%_*}; ref=$(python -c "import json;print(json.load(open('work/realism/refs.json'))['$room'])")
  [ -f work/realism/photos/${p}_real.png ] && continue
  node scripts/22_realism.mjs work/realism/frames/$p.png "$ref" work/realism/photos/${p}_real.png --go || echo "PHOTO FAILED $p"
done

step views
python - <<'EOF'
import json, math, os
eye = 1.55 - 0.018 / 2
V = []
for line in open('work/realism/points.txt').read().split():
    n, rest = line.split(':'); u, v, y, pitch = [float(x) for x in rest.split(',')]
    ph = f'work/realism/photos/{n}_real.png'
    if os.path.exists(ph):
        V.append({"name": n, "photo": ph, "pos": [u / 100, eye, v / 100], "yaw": -math.pi / 2 - math.radians(y), "pitch": pitch, "fov_v": 68, "w": 1536, "h": 1024})
json.dump(V, open('work/realism/views4.json', 'w'), indent=1); print(len(V), 'views')
EOF

step project
python scripts/run_blender.py --wait 6000 --timeout 3000 -- -b $W/prep.blend --factory-startup -P scripts/blender/project_photos.py -- --walk $W --views work/realism/views4.json --out work/proj4 2>&1 | grep -E "PROJECT_OK|Error|BUSY"
mkdir -p walkaround/skin && cp work/proj4/bake_*.jpg walkaround/skin/
python - <<'EOF'
from PIL import Image; import glob
for f in glob.glob('walkaround/skin/bake_[0-9].jpg'): Image.open(f).resize((1024,1024), Image.LANCZOS).save(f[:-4]+'_1k.jpg', quality=88)
EOF

step hours
SK=/c/RnD/.claude/skills/day-night-keyframes/scripts
python -I $SK/walk/walk_keyframes.py --prep $W/prep.blend --presets work/daynight/walk_presets.json --out work/daynight/out4 \
  --walk-bake scripts/blender/walk_bake.py --blender "$(pwd -W)/scripts/blender_locked.cmd" --samples 16 --timeout 6000 --run | grep -E "DONE|FAIL|TIMEOUT"
python - <<'EOF'
import os, shutil, json, hashlib
from PIL import Image
man = {'note': 'walk4 hours, synced by run_skin.sh', 'atlases': {}}
for k in ['morning', 'noon', 'golden', 'night']:
    d = f'walkaround/media/{k}'; os.makedirs(d, exist_ok=True); g = 0
    while os.path.exists(f'work/daynight/out4/{k}/gl/bake_{g}.jpg'):
        s = f'work/daynight/out4/{k}/gl/bake_{g}.jpg'; shutil.copy(s, f'{d}/bake_{g}.jpg')
        Image.open(s).resize((1024, 1024), Image.LANCZOS).save(f'{d}/bake_{g}_1k.jpg', quality=88)
        man['atlases'][f'{k}/{g}'] = hashlib.sha256(open(s, 'rb').read()).hexdigest()[:16]; g += 1
    sh = f'work/daynight/out4/{k}/gl/bake_6_shade.png'
    if os.path.exists(sh): shutil.copy(sh, d)
json.dump(man, open('walkaround/media/manifest.json', 'w'), indent=1)
shutil.copy('work/daynight/daynight.json', 'walkaround/daynight.json'); print('hours synced', len(man['atlases']))
EOF
echo RUN_SKIN_DONE
