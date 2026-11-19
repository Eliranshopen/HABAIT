#!/usr/bin/env bash
# Browser QA of the Day/Night viewer: real Chrome (Playwright, SwiftShader WebGL), real HTTP, real fetch of scene.json.
# 1) screenshots desktop 1440x900 + phone 390x844, console errors, overflow;  2) the blend proof (analyse.py).
# Usage: timeout 300 bash run_qa.sh — starts a local server and kills it by PID at the end.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"; VIEW="$HERE/../viewer"; OUT="$HERE/shots"; mkdir -p "$OUT"
PORT=8765
( cd "$VIEW" && exec python -m http.server $PORT --bind 127.0.0.1 >/dev/null 2>&1 ) & SRV=$!
trap 'kill $SRV 2>/dev/null' EXIT INT TERM
sleep 1
FAIL=0
node "$HERE/shots.mjs" "$OUT" "http://127.0.0.1:$PORT" || FAIL=1
python -I "$HERE/analyse.py" "$OUT" || FAIL=1
echo "QA exit $FAIL"
exit $FAIL
