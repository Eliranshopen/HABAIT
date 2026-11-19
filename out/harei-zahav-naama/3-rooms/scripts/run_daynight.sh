#!/usr/bin/env bash
# Four lighting keyframes of the v2 walk (skill day-night-keyframes, mode B) on the SAME prep.blend, then the media for the viewer.
set -euo pipefail
cd "$(dirname "$0")/.."
SK=/c/RnD/.claude/skills/day-night-keyframes/scripts
python -I $SK/walk/walk_keyframes.py --prep work/walk3/prep.blend --presets work/daynight/walk_presets.json --out work/daynight/out \
  --walk-bake scripts/blender/walk_bake.py --blender "$(pwd -W)/scripts/blender_locked.cmd" --samples 16 --timeout 4000 --run
echo RUN_DAYNIGHT_DONE
