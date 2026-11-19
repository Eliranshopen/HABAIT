#!/usr/bin/env bash
# floorseam.sh <asset> <floor png in generated/> <u> <v0> [band-deg]: one lite close-seam band on a FLOOR variant's own wrap join (rows v0..1).
# close-seam reads the scene's pick, so the pick is pointed at the floor picture for the call and restored after it, whatever happens.
set -u
cd /c/RnD/Projects/Habait/habait-walkaround
export HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps PYTHONIOENCODING=utf-8
P=Habait/tour360/apartments/apt846/_local/picks.json
cp "$P" "$P.floorseam-tmp"
node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('$P'));p['$1']='$2';fs.writeFileSync('$P',JSON.stringify(p,null,1)+'\n')"
timeout 300 node Habait/tour360/tools/close-seam.mjs apt846 "$1" --lite --u "$3" --band-deg "${5:-16}" --rows "$4,1" --no-cg --cap 361.23 --extra "Inside the band only the FLOOR is repainted: the wooden floor planks run on across the band as one continuous floor, each plank line continuing straight from one side to the other at the same width and tone; no V-shaped join, no chevron, no change of plank direction, no seam line. Furniture, walls and doors are untouched." 2>&1 | tail -2 | cut -c1-240
cp "$P.floorseam-tmp" "$P" && rm "$P.floorseam-tmp"
