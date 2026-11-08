#!/bin/sh
# transition-rise: copy the shipping files (+ live apartment.css, rnd-23's 07:14 fix) into the run tree, rebuild platform 846 + tour apt846.
set -e
W=/c/RnD/.wt/transition-rise
R=$W/run
F=$W/files/Projects/Habait/habait-walkaround/Habait
RH=$R/Projects/Habait/habait-walkaround/Habait
LH=/c/RnD/Projects/Habait/habait-walkaround/Habait
cp "$F/platform/js/apartment-3d.js" "$RH/platform/js/apartment-3d.js"
cp "$F/platform/tools/build_zip.mjs" "$RH/platform/tools/build_zip.mjs"
cp "$F/tour360/viewer/tour.js" "$F/tour360/viewer/template.html" "$F/tour360/viewer/tour.css" "$RH/tour360/viewer/"
cp "$LH/platform/css/apartment.css" "$RH/platform/css/apartment.css"
cd "$RH/platform"
timeout 540 node tools/build_zip.mjs fixtures/rainbow 846 --out _local/dist/rainbow/846 2>&1 | tail -1 | cut -c1-80
cd "$RH/tour360"
timeout 540 node tools/build-tour.mjs apt846 --apartments "$LH/tour360/apartments" --out "$R/tourout/apt846" 2>&1 | tail -1 | cut -c1-80
