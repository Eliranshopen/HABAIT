#!/usr/bin/env bash
# deploy-test.sh <stage dir> <stage log> [file to verify ...] — deploy ONE staged site folder to the TEST link only (2026-11-15, the Pi
# wrapper; the procedure the main session ran by hand for test-r19..r48).
#   refuses unless: the stage log carries `PREDEPLOY GATE: PASS`; <stage>/.vercel/project.json names projectName "rainbow-v2-test";
#                   <stage>/.vercelignore lists .env; the stage is outside every git work tree; no *.log / *.out / *.err / .env* inside.
#   then: `npx vercel deploy --prod --yes` (production OF THE TEST PROJECT: the test link's own alias), prints the deployment id, and
#   checks each given file (default: tour/index.html) served == staged (sha256). Production habait-flow is never this script.
set -uo pipefail
STAGE="${1:-}"; LOG="${2:-}"; shift 2 2>/dev/null || true
[ -d "$STAGE" ] && [ -f "$LOG" ] || { echo "usage: deploy-test.sh <stage dir> <stage log> [file ...]"; exit 2; }
grep -q "PREDEPLOY GATE: PASS" "$LOG" || { echo "REFUSED: the stage log has no 'PREDEPLOY GATE: PASS'"; exit 3; }
grep -q '"projectName":"rainbow-v2-test"' "$STAGE/.vercel/project.json" 2>/dev/null || { echo "REFUSED: $STAGE/.vercel/project.json does not name rainbow-v2-test"; exit 3; }
grep -q '^\.env' "$STAGE/.vercelignore" 2>/dev/null || { echo "REFUSED: $STAGE/.vercelignore must list .env*"; exit 3; }
if git -C "$STAGE" rev-parse --is-inside-work-tree >/dev/null 2>&1; then echo "REFUSED: the stage is inside a git work tree"; exit 3; fi
BAD=$(find "$STAGE" -path "$STAGE/.vercel" -prune -o \( -name '*.log' -o -name '*.out' -o -name '*.err' -o -name '.env*' \) -print | head -5)
[ -z "$BAD" ] || { echo "REFUSED: files that must not ship: $BAD"; exit 3; }
OUT=$(mktemp); ( cd "$STAGE" && timeout 500 npx --yes vercel deploy --prod --yes ) > "$OUT" 2>&1; RC=$?
DPL=$(grep -oE "dpl_[A-Za-z0-9]+" "$OUT" | sort -u | head -1); rm -f "$OUT"
[ $RC -eq 0 ] || { echo "DEPLOY FAILED (exit $RC)"; exit 1; }
echo "deployed: ${DPL:-<id not printed>} -> https://rainbow-v2-test.vercel.app"
FILES=("$@"); [ ${#FILES[@]} -gt 0 ] || FILES=(tour/index.html)
BADN=0
for f in "${FILES[@]}"; do
  a=$(curl -s "https://rainbow-v2-test.vercel.app/$f" | sha256sum | cut -c1-16); b=$(sha256sum "$STAGE/$f" | cut -c1-16)
  if [ "$a" = "$b" ]; then echo "served = stage: $f"; else echo "DIFF served vs stage: $f"; BADN=$((BADN+1)); fi
done
[ $BADN -eq 0 ] || exit 1
