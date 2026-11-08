#!/usr/bin/env bash
# run_v5.sh - lane C v5 (2026-11-02): bake the 16-node set into renders/baked-v5, check it (+ the 12-azimuth two-ring orbit
# sweep) into renders/baked-check-v5, export renders/baked-v5/site_baked.glb. $0 (no paid calls). One Blender at a time: every
# Blender step first waits (2 min polls, up to 30 min) while another blender.exe runs.
#   bash skins-extra/run_v5.sh [bake|composite|check|before|export|all]     (default: composite check export)
# bake      = full v5 bake from the copied v4 cache (renders/baked-v5/_cache = cp -r renders/baked/_cache; bake_meta.json copied)
# composite = re-composite only (--skip-bake), after a skin or bake-nodes-v5.json change
# before    = the same orbit sweep on the v4 bake (renders/baked/baked.blend, read only) -> renders/baked-check-v5/before-v4
set -u
export PYTHONIOENCODING=utf-8
B="C:/Habait/tools/blender-4.5.10/blender-4.5.10-windows-x64/blender.exe"
F="C:/Habait/habait-walkaround/Habait/flyover"
N="$F/skins-extra/bake-nodes-v5.json"
O="$F/renders/baked-v5"
C="$F/renders/baked-check-v5"
mkdir -p "$O" "$C"

wait_blender() {
  local n=0
  while tasklist 2>/dev/null | grep -qi blender.exe; do
    n=$((n + 1))
    if [ $n -gt 15 ]; then echo "[run_v5] blender still busy after 30 min, stop"; exit 3; fi
    echo "[run_v5] another blender.exe is running, poll $n"
    sleep 120
  done
}

step() {
  case "$1" in
    bake)
      wait_blender
      timeout 3000 "$B" -b --factory-startup -P "$F/bake_skins.py" -- --out "$O" --from-prep --nodes "$N" > "$O/_bake_log_v5.txt" 2>&1
      grep -q "^\[bake\] done" "$O/_bake_log_v5.txt" || { echo "[run_v5] bake FAILED"; tail -20 "$O/_bake_log_v5.txt"; exit 1; } ;;
    composite)
      wait_blender
      timeout 2400 "$B" -b --factory-startup -P "$F/bake_skins.py" -- --out "$O" --skip-bake --nodes "$N" > "$O/_bake_log_v5c.txt" 2>&1
      grep -q "^\[bake\] done" "$O/_bake_log_v5c.txt" || { echo "[run_v5] composite FAILED"; tail -20 "$O/_bake_log_v5c.txt"; exit 1; } ;;
    check)
      wait_blender
      timeout 2400 "$B" -b "$O/baked.blend" -P "$F/render_check.py" -- --out "$C" --samples 16 --orbit 12 > "$C/_check_log.txt" 2>&1
      [ -f "$C/contact.jpg" ] || { echo "[run_v5] check FAILED"; tail -20 "$C/_check_log.txt"; exit 1; } ;;
    before)
      wait_blender
      mkdir -p "$C/before-v4"
      timeout 900 "$B" -b "$F/renders/baked/baked.blend" -P "$F/render_check.py" -- --out "$C/before-v4" --samples 16 \
        --views none --variants cov --seq 0 --no-contact --orbit 12 > "$C/before-v4/_check_log.txt" 2>&1 ;;
    export)
      wait_blender
      timeout 1200 "$B" -b "$O/baked.blend" -P "$F/export_glb.py" -- --out "$O/site_baked.glb" > "$O/_export_log.txt" 2>&1
      [ -f "$O/site_baked.glb" ] || { echo "[run_v5] export FAILED"; tail -20 "$O/_export_log.txt"; exit 1; } ;;
  esac
  echo "[run_v5] $1 done $(date +%T)"
}

steps="${*:-composite check export}"
[ "$steps" = "all" ] && steps="bake before check export"
for s in $steps; do step "$s"; done
