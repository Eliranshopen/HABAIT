#!/usr/bin/env bash
# 2026-11-18: the dining 360 again from (420,620) cm — the walk view (300,630) stood 45 cm from the table's end, so the table
# filled the panorama. Waits for the living re-render (one Blender at a time), renders, then the realism pass (GPT Image 2.5,
# $1.20, ledgered) and the seam. The first versions are kept: dining-walkview.png, real/dining-walkview.jpg.
set -u
cd "$(dirname "$0")/.."
PY=/c/RnD/Projects/3Dengine/.venv/Scripts/python.exe
for i in $(seq 1 400); do grep -q LIVING2_DONE work/run_360_living.log 2>/dev/null && break; sleep 15; done
[ -f work/pano360/dining-walkview.png ] || mv work/pano360/dining.png work/pano360/dining-walkview.png
[ -f work/pano360/real/dining-walkview.jpg ] || { mv work/pano360/real/dining.jpg work/pano360/real/dining-walkview.jpg; mv work/pano360/real/dining.png work/pano360/real/dining-walkview.png; }
for i in 0 1; do
  s=work/pano360/strips/dining2_$i.png
  [ -f $s.json ] && continue
  timeout 900 "$PY" scripts/run_blender.py --wait 600 --timeout 650 -- -b scene/hatzav_v2.blend --python-exit-code 1 -P scripts/blender/render.py -- \
    --cam pano_living --at "420,620" --res 2048x1024 --samples 48 --threshold 0.02 --strip $i/2 --pad 48 --out $s 2>&1 | grep -E "RENDER OK|Error|TIMEOUT" | cut -c1-120
done
"$PY" scripts/07_stitch.py work/pano360/dining.png work/pano360/strips/dining2_0.png work/pano360/strips/dining2_1.png || exit 1
ref=$("$PY" -X utf8 -c "import json;print(json.load(open('work/realism/refs.json',encoding='utf-8'))['dining'])")
timeout 560 node scripts/27_pano_realism.mjs work/pano360/dining.png "$ref" work/pano360/real/dining.png --model gpt25 --go < /dev/null 2>&1 | tail -1
"$PY" scripts/28_pano_seam.py work/pano360/real/dining.png work/pano360/real/dining.jpg && echo DINING2_DONE $(date +%H:%M)
