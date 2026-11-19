#!/usr/bin/env bash
# Browser QA of a Day/Night viewer folder. Usage: timeout 300 bash run_qa.sh <viewer dir> <shots dir> [port]
# Starts a local HTTP server on the viewer, kills it by PID at the end; exit 0 = every check passed.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"; VIEW="$(cd "$1" && pwd)"; OUT="$2"; PORT="${3:-8765}"; mkdir -p "$OUT"
( cd "$VIEW" && exec python -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 ) & SRV=$!
trap 'kill $SRV 2>/dev/null' EXIT INT TERM
sleep 1
FAIL=0
node "$HERE/shots.mjs" "$OUT" "http://127.0.0.1:$PORT" || FAIL=1
python -I "$HERE/analyse.py" "$OUT" || FAIL=1
echo "QA exit $FAIL"; exit $FAIL
