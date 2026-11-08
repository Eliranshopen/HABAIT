#!/usr/bin/env bash
# Task 07 — the toolchain from the new root. Every step bounded, one at a time, exit codes recorded.
set -u
export PYTHONIOENCODING=utf-8
R=/c/RnD/Projects/Habait
B=/c/RnD/development/tasks/copy-habait-2026-11-03/logs
REP=$B/toolchain-report.md
BASEPY="/c/Users/elira/anaconda3/python.exe"
VENV=$R/tools/habait-venv
PY=$VENV/Scripts/python.exe
BLENDER=$R/tools/blender-4.5.10/blender-4.5.10-windows-x64/blender.exe
step() { printf '\n## %s\n```\n%s\n```\n' "$1" "$2" >> "$REP"; }
printf '# Toolchain report (task 07) — %s\n\nRoot: `C:\\RnD\\Projects\\Habait`\n' "$(date '+%Y-%m-%d %H:%M')" > "$REP"

# 1 venv
if [ ! -x "$PY" ]; then
  timeout 300 "$BASEPY" -m venv "$VENV" > "$B/venv-create.log" 2>&1; rc=$?
else rc=0; fi
step "1a venv create — exit $rc" "$(tail -3 "$B/venv-create.log" 2>/dev/null)"
timeout 540 "$PY" -m pip install --quiet --disable-pip-version-check -r "$B/pip-freeze.txt" > "$B/venv-install.log" 2>&1; rc=$?
step "1b pip install -r pip-freeze.txt — exit $rc" "$(grep -iE 'error|Successfully' "$B/venv-install.log" | tail -5)"
timeout 120 "$PY" -c "import numpy, PIL, cv2, shapely, ezdxf, fitz; print('imports ok', numpy.__version__, cv2.__version__)" > "$B/venv-imports.log" 2>&1; rc=$?
step "4 python imports — exit $rc" "$(cat "$B/venv-imports.log")"

# 2 blender
if [ -x "$BLENDER" ] && [ -f "$R/habait-walkaround/360walkaround/pipeline/probe/hello-render.py" ]; then
  ( cd "$R/habait-walkaround" && timeout 180 "$BLENDER" -b --factory-startup -P 360walkaround/pipeline/probe/hello-render.py > "$B/blender-smoke.log" 2>&1 ); rc=$?
  step "2 blender hello-render probe — exit $rc" "$(tail -4 "$B/blender-smoke.log")"
else
  step "2 blender probe — SKIPPED" "blender=$([ -x "$BLENDER" ] && echo present || echo missing) probe=$([ -f "$R/habait-walkaround/360walkaround/pipeline/probe/hello-render.py" ] && echo present || echo missing)"
fi

# 3 node deps + tests
( cd "$R/habait-walkaround/Habait/tour360/engine" && timeout 540 npm ci --no-audit --no-fund > "$B/npm-ci-engine.log" 2>&1 ); rc=$?
step "3a npm ci tour360/engine — exit $rc" "$(tail -2 "$B/npm-ci-engine.log")"
( cd "$R/habait-walkaround/Habait/tour360/engine" && timeout 300 node test/run.mjs > "$B/engine-tests.log" 2>&1 ); rc=$?
step "3b engine tests — exit $rc" "$(tail -4 "$B/engine-tests.log")"
( cd "$R/tools/appdeps" && timeout 540 npm ci --no-audit --no-fund > "$B/npm-ci-appdeps.log" 2>&1 ); rc=$?
step "3c npm ci tools/appdeps — exit $rc" "$(tail -2 "$B/npm-ci-appdeps.log")"

# 5 env lines
step "5 env lines for the new root" "export BLENDER=\"$BLENDER\"
export PYTHONIOENCODING=utf-8
export HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps
PY=$PY"
echo "TOOLCHAIN-DONE"; tail -40 "$REP"
