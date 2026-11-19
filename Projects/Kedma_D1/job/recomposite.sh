#!/usr/bin/env bash
# kedma-d1 ($0): what skin-project.mjs's seamTool does after a band repair whose cut still shows (parity row 24):
# the SAME answer (--raw) is composited again with a wider cut search (80, then 140 px); no new paid call.
# usage: recomposite.sh <job dir> <asset> <u> <band-deg> <extra text>
set -u
J="$1"; ASSET="$2"; U="$3"; BAND="$4"; EXTRA="$5"
G=Habait/tour360/apartments/kedma-d1/_local
PY="$HABAIT_PY"
info() { "$PY" -I - "$ASSET" <<'PYEOF'
import json, sys
A = 'Habait/tour360/apartments/kedma-d1/_local/'; a = sys.argv[1]
pk = json.load(open(A + 'picks.json', encoding='utf8'))[a]; sc = json.load(open(A + 'generated/' + pk[:-4] + '.seam.json', encoding='utf8'))
print(pk, sc.get('parent'), json.dumps([[c.get('structure'), c.get('line_step_px')] for c in sc.get('cuts', [])]))
PYEOF
}
read PICK PARENT CUTS <<<"$(info)"; echo "$ASSET pick $PICK parent $PARENT cuts $CUTS"
RAW="$G/generated/$(echo "$PICK" | sed 's/__seam3__/__seam__/; s/\.png$/.raw.png/')"
[ -f "$RAW" ] || { echo "no raw answer $RAW"; exit 1; }
for CS in 80 140; do
  "$PY" -I - "$ASSET" "$PARENT" <<'PYEOF'
import json, sys
p = 'Habait/tour360/apartments/kedma-d1/_local/picks.json'; d = json.load(open(p, encoding='utf8')); d[sys.argv[1]] = sys.argv[2]; json.dump(d, open(p, 'w', encoding='utf8'), indent=1)
PYEOF
  timeout 200 node "$J/run-with-key.mjs" C:/RnD Habait/tour360/tools/close-seam.mjs kedma-d1 "$ASSET" --lite --pick --u "$U" --band-deg "$BAND" --extra "$EXTRA" --cap 20 --raw "$RAW" --cut-search "$CS" 2>&1 | tail -2 | cut -c1-200
  read P2 PA2 C2 <<<"$(info)"; echo "  cut search $CS -> pick $P2 cuts $C2"
  # stop at the first composite whose cuts are inside fidelity.json band_edge (structure <= 5, line step < 4 px)
  if "$PY" -I -c "import json,sys; sys.exit(0 if all(c[0] <= 5 and (c[1] or 0) < 4 for c in json.loads(sys.argv[1])) else 1)" "$C2"; then echo "  inside the band-edge limits: kept"; break; fi
done
