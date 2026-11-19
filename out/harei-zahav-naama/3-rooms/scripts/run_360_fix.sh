#!/usr/bin/env bash
# 2026-11-18 evening: the 8 rooms that see the render fixes (qa/360/RENDER-AUDIT.md, Eliran approved all 8 at $102): each room
# rendered again from scene/hatzav_v2.blend (rebuilt 16:11), then the realism pass (GPT Image 2.5, $1.20, ledgered, sequential —
# one ledger file, never parallel) and the seam. The previous versions are kept with the suffix -before-fixes.
set -u
cd "$(dirname "$0")/.."
PY=/c/RnD/Projects/3Dengine/.venv/Scripts/python.exe
ROOMS=${ROOMS:-"kitchen bath saferoom dining living entrance hall deck"}
declare -A AT=( [living]="700,880" [dining]="420,620" )
mkdir -p work/pano360/strips work/pano360/real
for r in $ROOMS; do
  at=${AT[$r]:-$("$PY" -X utf8 -c "import json;g=json.load(open('walkaround/walk-grid.json',encoding='utf-8'));v=g['views']['$r'];print(f'{v[0]},{v[1]}')")}
  done_flag=work/pano360/strips/fix_${r}.done
  if [ ! -f $done_flag ]; then
    for f in work/pano360/$r.png work/pano360/real/$r.jpg work/pano360/real/$r.png; do
      [ -f $f ] && mv $f ${f%.*}-before-fixes.${f##*.}
    done
    echo "== render $r at $at $(date +%H:%M)"
    for i in 0 1; do
      s=work/pano360/strips/fix_${r}_$i.png
      [ -f $s.json ] && continue
      timeout 4800 "$PY" scripts/run_blender.py --wait 3000 --timeout 1500 -- -b scene/hatzav_v2.blend --python-exit-code 1 -P scripts/blender/render.py -- \
        --cam pano_living --at "$at" --res 2048x1024 --samples 48 --threshold 0.02 --strip $i/2 --pad 48 --out $s 2>&1 | grep -E "RENDER OK|Error|TIMEOUT" | cut -c1-100
    done
    "$PY" scripts/07_stitch.py work/pano360/$r.png work/pano360/strips/fix_${r}_0.png work/pano360/strips/fix_${r}_1.png || { echo "STITCH FAILED $r"; continue; }
    touch $done_flag
  fi
  [ -f work/pano360/real/$r.jpg ] && continue
  ref=$("$PY" -X utf8 -c "import json;print(json.load(open('work/realism/refs.json',encoding='utf-8'))['$r'])")
  timeout 560 node scripts/27_pano_realism.mjs work/pano360/$r.png "$ref" work/pano360/real/$r.png --model gpt25 --go < /dev/null 2>&1 | tail -1
  [ -f work/pano360/real/$r.png ] && "$PY" scripts/28_pano_seam.py work/pano360/real/$r.png work/pano360/real/$r.jpg
done
echo RUN_360_FIX_DONE $(date +%H:%M)
