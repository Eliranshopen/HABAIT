#!/usr/bin/env bash
# Serve the walk viewer on a local port, run the browser shots and the blend proof, stop the server by PID.
# Usage: timeout 400 bash qa/run_qa.sh [viewer dir] [shots dir] [port]
set -u
HERE="$(cd "$(dirname "$0")" && (pwd -W 2>/dev/null || pwd))"
VIEWER="${1:-$HERE/../viewer}"; SHOTS="${2:-$HERE/shots}"; PORT="${3:-8766}"
python -m http.server "$PORT" --bind 127.0.0.1 --directory "$VIEWER" >/dev/null 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null' EXIT
for i in $(seq 1 30); do curl -s -o /dev/null "http://127.0.0.1:$PORT/" && break; sleep 0.5; done   # wait until the server answers (a busy machine starts it slowly)
node "$HERE/shots.mjs" "http://127.0.0.1:$PORT" "$SHOTS"; A=$?
python -I "$HERE/analyse.py" "$SHOTS"; B=$?
echo "QA shots=$A blend=$B"
[ $A -eq 0 ] && [ $B -eq 0 ]
