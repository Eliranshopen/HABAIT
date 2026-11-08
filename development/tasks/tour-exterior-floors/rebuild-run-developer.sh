#!/bin/sh
# tour-dollhouse-developer: a run copy of the live tour360 (sources only) + the working-folder tour.js, built into run/tourout/apt846.
set -e
W=/c/RnD/.wt/tour-dollhouse-developer
LT=/c/RnD/Projects/Habait/habait-walkaround/Habait/tour360
RT=$W/run/tour360
rm -rf "$W/run"
mkdir -p "$RT"
for d in viewer tools copy server catalog; do [ -d "$LT/$d" ] && cp -r "$LT/$d" "$RT/$d"; done
cd "$RT"
timeout 540 node tools/build-tour.mjs apt846 --apartments "$LT/apartments" --dollhouse /c/RnD/Projects/Habait/habait-walkaround/Habait/platform/_local/dist/rainbow/846/media/dollhouse.html --out "$W/run/tourout/apt846" 2>&1 | tail -1 | cut -c1-120
