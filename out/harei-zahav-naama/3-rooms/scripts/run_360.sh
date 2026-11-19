#!/usr/bin/env bash
# 2026-11-18 Eliran: «תעצור את העבודה על WALK AROUND ותתקדם כרגע רק על 3D 360».
# The 360 of the plan layout: scene/hatzav_v2.blend (sales-sheet layout + the Hitem3D pieces made from his renders), one
# equirectangular panorama per room at the walk's checked viewpoints (walkaround/walk-grid.json views, free floor), 2048×1024,
# 2 strips each (bounded chunks, machine lock), OIDN denoise. Idempotent: a strip whose sidecar exists is never rendered again.
# Output: work/pano360/<room>.png  → the fal realism pass (4K) comes after, on the model chosen by the comparison.
set -u
cd "$(dirname "$0")/.."
PY=/c/RnD/Projects/3Dengine/.venv/Scripts/python.exe
R() { timeout 700 "$PY" scripts/run_blender.py --wait 3000 --timeout 650 -- "$@"; }
mkdir -p work/pano360/strips
ROOMS=${ROOMS:-"living kitchen bedroom saferoom bath entrance hall dining deck garden"}
for r in $ROOMS; do
  at=$("$PY" -X utf8 -c "import json;g=json.load(open('walkaround/walk-grid.json',encoding='utf-8'));v=g['views']['$r'];print(f'{v[0]},{v[1]}')")
  [ -f work/pano360/$r.png ] && continue
  echo "== $r at $at $(date +%H:%M)"
  for i in 0 1; do
    s=work/pano360/strips/${r}_$i.png
    [ -f $s.json ] && continue
    R -b scene/hatzav_v2.blend --python-exit-code 1 -P scripts/blender/render.py -- --cam pano_living --at "$at" --res 2048x1024 \
      --samples 48 --threshold 0.02 --strip $i/2 --pad 48 --out $s 2>&1 | grep -E "RENDER OK|Error|TIMEOUT" | cut -c1-200
  done
  [ -f work/pano360/strips/${r}_0.png.json ] && [ -f work/pano360/strips/${r}_1.png.json ] && \
    "$PY" scripts/07_stitch.py work/pano360/$r.png work/pano360/strips/${r}_0.png work/pano360/strips/${r}_1.png
done
echo RUN_360_DONE $(date +%H:%M)
