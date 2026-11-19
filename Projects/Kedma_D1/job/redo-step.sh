#!/usr/bin/env bash
# kedma-d1: one view of a room redo, end to end (hand/room_paint.py): cut the view of the canvas, one paid image call (ledgered,
# refused past the ceiling), measure the answer against the CG view, keep a copy of the canvas, accept, write the check image.
# usage (from the pipeline folder, after `. ../jobs/kedma-d1/env.sh`):
#   bash ../jobs/kedma-d1/redo-step.sh <asset> <tag> <yaw> <pitch> <hfov> <prompt.txt> [<model, default nano-banana-2>]
# The ceiling is the project's: $45 in all (Eliran 2026-11-17) = 44.9 on the apartment ledger (the trace ledger holds $0.10).
set -euo pipefail
asset=$1; tag=$2; yaw=$3; pitch=$4; hfov=$5; prompt=$6; model=${7:-nano-banana-2}
J=../jobs/kedma-d1; APT=Habait/tour360/apartments/kedma-d1; D=$APT/_local/flatfix/$asset-r-$tag; R=$APT/_local/redo/$asset
V=$(timeout 120 "$HABAIT_PY" $J/hand/room_paint.py view $APT "$asset" "$tag" --yaw "$yaw" --pitch "$pitch" --hfov "$hfov"); echo "$V"
# a view that is already painted is not paid for (2026-11-17: a third floor view was 99 % painted when it was cut)
if node -e "process.exit(JSON.parse(process.argv[1]).already_painted_pct >= 97 ? 0 : 1)" "$V"; then echo "skipped: the view is already painted - no call"; exit 0; fi
timeout 420 node $J/flatfix-call.mjs kedma-d1 "$asset" "r-$tag" "$prompt" --cap 44.9 --in in.png --model "$model" --go | tail -1 | cut -c1-200
A=$(ls -t "$D"/answer-*.png | grep -v reg | head -1)
cp "$R/canvas.png" "$R/canvas.before-$tag.png"; cp "$R/painted.png" "$R/painted.before-$tag.png"
timeout 300 "$HABAIT_PY" $J/hand/room_paint.py accept $APT "$asset" "$tag" --answer "$A" | cut -c1-330
timeout 100 "$HABAIT_PY" $J/hand/flatcheck.py $APT "$asset" "r-$tag" "$J/review/flat/redo-$asset-$tag.jpg" --answer "$A"
