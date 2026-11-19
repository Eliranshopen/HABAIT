#!/usr/bin/env bash
# 2026-11-18: the living-room 360 again from the middle of the room (700,880 cm, 2 m from the TV wall). The walk's view
# (560,930) stood 0.6–0.9 m from the TV unit, so the TV filled the panorama. The first render is kept as living-walkview.png.
set -u
cd "$(dirname "$0")/.."
PY=/c/RnD/Projects/3Dengine/.venv/Scripts/python.exe
R() { timeout 700 "$PY" scripts/run_blender.py --wait 6000 --timeout 650 -- "$@"; }
# wait for the room chain (run_360.sh) to finish first: two queued Blender jobs would starve each other's bounded waits
for i in $(seq 1 600); do grep -q RUN_360_DONE work/run_360.log 2>/dev/null && break; sleep 15; done
[ -f work/pano360/living.png ] && [ ! -f work/pano360/living-walkview.png ] && mv work/pano360/living.png work/pano360/living-walkview.png
for i in 0 1; do
  s=work/pano360/strips/living2_$i.png
  [ -f $s.json ] && continue
  R -b scene/hatzav_v2.blend --python-exit-code 1 -P scripts/blender/render.py -- --cam pano_living --at "700,880" --res 2048x1024 \
    --samples 48 --threshold 0.02 --strip $i/2 --pad 48 --out $s 2>&1 | grep -v -E "^Fra:|^ *$|Sample|Rendered|Denois" | tail -6 | cut -c1-200
done
"$PY" scripts/07_stitch.py work/pano360/living.png work/pano360/strips/living2_0.png work/pano360/strips/living2_1.png && echo LIVING2_DONE $(date +%H:%M)
