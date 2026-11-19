#!/usr/bin/env bash
# kedma-d1: one view of a viewpoint, end to end, in look B at double resolution (Eliran's rulings of 2026-11-17):
#   cut the view of the room's canvas (2048 px) -> what the view contains, from the 3D model (hand/view_contents.py) -> its prompt
#   (hand/redo_prompt.py) -> ONE paid image call at 2K ($0.12, ledgered, refused past the ceiling) -> the answer is measured against
#   the render, tone-matched and put into the canvas (hand/room_paint.py accept) -> the check picture.
# usage (from the pipeline folder, after `. ../jobs/kedma-d1/env.sh`):
#   bash ../jobs/kedma-d1/paint-view.sh <asset> <camera id> <tag> <yaw> <pitch> <hfov> "<the room in words>" [first] ["extra note"]
# A view that is already 97 % painted is skipped (no call). The ceiling is the project's $48 = 47.9 on the apartment ledger (Eliran raised it 2026-11-19).
set -euo pipefail
asset=$1; cam=$2; tag=$3; yaw=$4; pitch=$5; hfov=$6; room=$7; first=${8:-}; note=${9:-}
J=../jobs/kedma-d1; APT=Habait/tour360/apartments/kedma-d1; TOUR=360walkaround/tours/kedma-d1
D=$APT/_local/flatfix/$asset-r-$tag; R=$APT/_local/redo/$asset
V=$(timeout 200 "$HABAIT_PY" $J/hand/room_paint.py view $APT "$asset" "$tag" --yaw "$yaw" --pitch "$pitch" --hfov "$hfov" --size 2048); echo "$V"
if node -e "process.exit(JSON.parse(process.argv[1]).already_painted_pct >= 97 ? 0 : 1)" "$V"; then echo "skipped: the view is already painted - no call"; exit 0; fi
C=$(timeout 100 "$HABAIT_PY" $J/hand/view_contents.py $APT $TOUR "$cam" --yaw "$yaw" --pitch "$pitch" --hfov "$hfov")
keys=$(node -e "const d=JSON.parse(process.argv[1]);console.log(d.keys.join(','))" "$C")
outdoor=$(node -e "const d=JSON.parse(process.argv[1]);console.log(d.outdoor?'--outdoor':'')" "$C")
camw=level; if node -e "process.exit(Number(process.argv[1]) < -15 ? 0 : 1)" "$pitch"; then camw=tilted; fi
P=$J/prompts/$asset-$tag.txt; mkdir -p $J/prompts
"$HABAIT_PY" $J/hand/redo_prompt.py "$P" --room "$room" ${first:+--first} --camera $camw --has "$keys" $outdoor \
  --not "piece of furniture, cabinet, shelf, lamp, rug, door or window that the render does not show" ${note:+--note "$note"}
timeout 500 node $J/flatfix-call.mjs kedma-d1 "$asset" "r-$tag" "$P" --cap 47.9 --in in.png --model nano-banana-2 --resolution 2K --go | tail -1 | cut -c1-160
A=$(ls -t "$D"/answer-*.png | grep -v reg | head -1)
# 2026-11-17 (Eliran asked what would cut the fixes): an answer that draws long straight structure the model does not have (a door, an
# opening, a niche, a skirting board, a frame) is NOT put into the canvas; it waits for a look (hand/invent_check.py, $0).
if ! timeout 120 "$HABAIT_PY" $J/hand/invent_check.py "$D" --answer "$A" --out "$J/review/flat/ic-$asset-$tag.jpg"; then
  echo "FLAG: the answer draws structure the model does not have - NOT accepted. Look at $J/review/flat/ic-$asset-$tag.jpg; accept by hand with room_paint.py accept if it is fine"; exit 3; fi
cp "$R/canvas.png" "$R/canvas.before-$tag.png"; cp "$R/painted.png" "$R/painted.before-$tag.png"
timeout 400 "$HABAIT_PY" $J/hand/room_paint.py accept $APT "$asset" "$tag" --answer "$A" --inset 32 --feather 96 | cut -c1-330
timeout 200 "$HABAIT_PY" $J/hand/flatcheck.py $APT "$asset" "r-$tag" "$J/review/flat/b-$asset-$tag.jpg" --answer "$A"
