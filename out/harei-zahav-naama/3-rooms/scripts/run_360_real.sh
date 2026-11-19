#!/usr/bin/env bash
# 2026-11-18: every room of the 360 through the comparison's winner, GPT Image 2.5 (qa/360-compare-kitchen.jpg: it kept every
# object and position, the most real light; nano-banana-pro added objects, Seedream changed the floor). Each room as soon as its
# Blender panorama exists; his Corona render of the room = the look reference (work/realism/refs.json); then the seam is closed.
# Paid: $1.20 a room, ledgered by 27_pano_realism.mjs against the $95 ceiling; cached by inputs hash (a rerun is $0).
set -u
cd "$(dirname "$0")/.."
PY=/c/RnD/Projects/3Dengine/.venv/Scripts/python.exe
mkdir -p work/pano360/real
ROOMS=${ROOMS:-"kitchen bedroom saferoom bath entrance hall dining deck garden living"}
for r in $ROOMS; do
  src=work/pano360/$r.png
  if [ $r = living ]; then for i in $(seq 1 240); do grep -q LIVING2_DONE work/run_360_living.log 2>/dev/null && break; sleep 15; done; fi
  for i in $(seq 1 360); do [ -f $src ] && break; sleep 15; done
  [ -f $src ] || { echo "NO PANO $r"; continue; }
  [ -f work/pano360/real/$r.jpg ] && continue
  ref=$("$PY" -X utf8 -c "import json;print(json.load(open('work/realism/refs.json',encoding='utf-8'))['$r'])")
  echo "== $r $(date +%H:%M)"
  timeout 560 node scripts/27_pano_realism.mjs $src "$ref" work/pano360/real/$r.png --model gpt25 --go < /dev/null 2>&1 | tail -1
  [ -f work/pano360/real/$r.png ] && "$PY" scripts/28_pano_seam.py work/pano360/real/$r.png work/pano360/real/$r.jpg
done
echo RUN_360_REAL_DONE $(date +%H:%M)
