#!/usr/bin/env bash
# The render queue: one Blender at a time (machine lock), each job bounded, idempotent (a strip whose
# sidecar exists is never rendered again). Run from the job root:  bash scripts/render_queue.sh [stage]
# stages: living | panos | stills | all (default all)
set -u
cd "$(dirname "$0")/.."
PY=/c/RnD/Projects/3Dengine/.venv/Scripts/python.exe
R() { timeout 600 "$PY" scripts/run_blender.py --wait 900 --timeout 560 -- "$@"; }
strip() {  # cam res samples n out-prefix
  local cam=$1 res=$2 spp=$3 n=$4 pre=$5 i
  for ((i = 0; i < n; i++)); do
    if [ -f "work/strips/${pre}_$i.png.json" ]; then continue; fi
    R -b scene/hatzav.blend --python-exit-code 1 -P scripts/blender/render.py -- --cam "$cam" --res "$res" \
      --samples "$spp" --strip "$i/$n" --pad 48 --out "work/strips/${pre}_$i.png" | grep -E "RENDER OK|Error|TIMEOUT|exit" || true
  done
  local parts=()
  for ((i = 0; i < n; i++)); do parts+=("work/strips/${pre}_$i.png"); done
  "$PY" scripts/07_stitch.py "work/${pre}.png" "${parts[@]}"
}
STAGE=${1:-all}
mkdir -p work/strips
if [ "$STAGE" = living ] || [ "$STAGE" = all ]; then
  strip pano_living 4096x2048 64 8 pano_living
fi
if [ "$STAGE" = panos ] || [ "$STAGE" = all ]; then
  for c in pano_kitchen pano_bedroom pano_entrance pano_deck pano_saferoom pano_bath pano_hall; do
    strip "$c" 2048x1024 40 2 "$c"
  done
fi
if [ "$STAGE" = stills ] || [ "$STAGE" = all ]; then
  for c in still_hero_living still_kitchen_dining still_living_to_deck still_bedroom still_saferoom still_bath still_exterior; do
    strip "$c" 1600x1000 64 2 "$c"
  done
fi
echo "QUEUE DONE $STAGE"
