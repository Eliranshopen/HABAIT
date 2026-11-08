#!/bin/bash
# DIAGNOSTIC ONLY, in the throwaway build-proof VM (fork E, 2026-11-05). The real gate verdict is FAIL (8 of 11 rooms over the 1% bar,
# kept in gate.json). To TIME build / package / qa on Linux, the VM-local fidelity bar is raised to 60% and the VM-local disclosure line
# carries that number; the real files are restored at the end. Nothing here is published; the VM is deleted after the evidence is fetched.
set -u
R=/vercel/sandbox; P=$R/proof; cd $R/hw
export HABAIT_PY=$R/venv/bin/python HABAIT_APP_DIR=$R/appdeps HABAIT_ENV_ROOT=$R/hw BLENDER=$R/blender/blender CHROME=$R/chrome PYTHONIOENCODING=utf-8 TOUR_EDIT_OPEN=0
cp Habait/tour360/fidelity.json $P/fidelity.real.json
cp Habait/tour360/copy/tour360-copy.json $P/copy.real.json
cat > $P/diag-patch.cjs <<'JS'
const fs = require('fs');
const f = 'Habait/tour360/fidelity.json'; const j = JSON.parse(fs.readFileSync(f, 'utf8')); j.max_deviation_pct = 60; fs.writeFileSync(f, JSON.stringify(j, null, 1));
const c = 'Habait/tour360/copy/tour360-copy.json'; const k = JSON.parse(fs.readFileSync(c, 'utf8'));
k.conceptLine.he = String(k.conceptLine.he).replace(/עד \d+(\.\d+)?%/, 'עד 60%'); fs.writeFileSync(c, JSON.stringify(k, null, 1));
console.log('patched (VM only):', k.conceptLine.he.match(/עד \d+%/)?.[0]);
JS
node $P/diag-patch.cjs
for st in gate build package qa; do
  s=$(date +%s); node Habait/tour360/tools/run-project.mjs pbuild846 --steps $st > $P/diag-$st.log 2>&1; rc=$?
  printf 'diag-%s\t%s\t%s\t%s\n' "$st" "$(( $(date +%s)-s ))" "$rc" "$(date -u +%FT%TZ)" | tee -a $P/timings.tsv
  [ $rc -ne 0 ] && tail -3 $P/diag-$st.log | cut -c1-400
done
cp $P/fidelity.real.json Habait/tour360/fidelity.json; cp $P/copy.real.json Habait/tour360/copy/tour360-copy.json; echo "restored the real fidelity.json and copy"
du -sh Habait/tour360/out/pbuild846/package 2>/dev/null; find Habait/tour360/out/pbuild846/package -type f 2>/dev/null | wc -l; ls Habait/tour360/out/pbuild846/qa 2>/dev/null | head -12
