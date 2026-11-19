#!/usr/bin/env bash
# bake_keys.sh <key> [groups...] - one day/night key of the walk: relight (the skill's relight.py, light only) the walk's prepared model
# into work/daynight/<key>/, bake the LIGHT of each group at 1024 / 16 samples, export the light atlases.  $0, CPU; one Blender at a time.
# Idempotent: a group whose light_<g>.exr exists is skipped.  usage: bash tools/daynight/bake_keys.sh golden 0 1 2
set -e
B="/c/Program Files/Blender Foundation/Blender 4.5/blender.exe"; K=$1; shift
WK=${WK:-work/walk3d4}; D=${DNO:-work/daynight4}/$K; mkdir -p $D; cp $WK/prep.json $D/
EV=$(python -c "import json;print(next(k for k in json.load(open('tools/daynight/presets.json',encoding='utf-8'))['keyframes'] if k['name']=='$K')['export_ev'])")
if [ ! -f $D/prep_$K.blend ]; then timeout 200 "$B" -b --factory-startup $WK/prep.blend -P /c/RnD/.claude/skills/day-night-keyframes/scripts/relight.py -- --presets tools/daynight/presets.json --key $K --out $D/prep_$K.blend | grep -E "RELIGHT_OK" | cut -c1-300; fi
for g in "$@"; do
  if [ "$g" = export ]; then timeout 300 "$B" -b --factory-startup $D/prep_$K.blend -P tools/walk3d_bake.py -- --stage export-light --dir $D --ev $EV | grep -E "EXPORT_LIGHT_OK|Error"; continue; fi
  [ -f $D/light_$g.exr ] && { echo "SKIP $K g$g"; continue; }
  T0=$(date +%s); timeout 280 "$B" -b --factory-startup $D/prep_$K.blend -P tools/walk3d_bake.py -- --stage bake --dir $D --group $g --pass light --samples 16 --bake-size 1024 | grep -E "baked group|Error"
  echo "  $K g$g $(( $(date +%s) - T0 )) s"
done
