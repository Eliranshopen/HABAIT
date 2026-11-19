# sync-context, the three report-only checks that have no script of their own (read-only, writes nothing):
#   [0] context-file staleness · [2] ship-ledger currency · [3] OWED owners and age
# The other checks: check-context.mjs (1, 5-9), verify-memory.mjs (12), board_state.py (18), metrics.mjs.
# Usage: python scripts/sync_checks.py [repo]     (default C:\RnD)
import io, os, re, sys, time

repo = sys.argv[1] if len(sys.argv) > 1 else r'C:\RnD'
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
SKIP = {'node_modules', '.git', '__pycache__', '.cache', 'dist', 'build', '.next', '.turbo', '.venv', 'venv', '.wt', 'habait-venv'}
SKIP_RE = re.compile(r'-(backup|archive)-\d{4}-\d{2}-\d{2}$', re.I)

# Check 0: a hand-written context file whose folder holds a file newer than its last-updated date
flags, hand = [], 0
for d, dirs, files in os.walk(repo):
    dirs[:] = [x for x in dirs if x not in SKIP and not SKIP_RE.search(x) and not x.startswith('blender-4.')]
    if 'CLAUDE.md' not in files:
        continue
    p = os.path.join(d, 'CLAUDE.md')
    try:
        head = io.open(p, encoding='utf-8', errors='replace').read(600)
    except OSError:
        continue
    if 'generated-by: generate-cards.py' in head:
        continue
    hand += 1
    m = re.search(r'<!-- last-updated: (\d{4}-\d{2}-\d{2})', head)
    if not m:
        flags.append((os.path.relpath(d, repo).replace('\\', '/'), 'no marker', ''))
        continue
    newest, name = 0, ''
    for f in files:
        if f == 'CLAUDE.md' or f.startswith('.env'):   # a secrets file is never touched, not even its date
            continue
        t = os.path.getmtime(os.path.join(d, f))
        if t > newest:
            newest, name = t, f
    if newest and time.strftime('%Y-%m-%d', time.localtime(newest)) > m.group(1):
        flags.append((os.path.relpath(d, repo).replace('\\', '/'), m.group(1), '%s %s' % (name, time.strftime('%Y-%m-%d', time.localtime(newest)))))
print('[0] context-file staleness: %d hand-written files, %d flagged for review' % (hand, len(flags)))
for rel, marker, newer in flags[:40]:
    print('    %-58s marker %s · newer: %s' % (rel or '.', marker, newer))
print('    lint-bom / evidence-index: SKIP (no .claude/hooks/lint-bom.ps1, no qa-evidence/)')

# Check 2: ship-ledger currency
ship = io.open(repo + '/docs/governance/SHIP-LEDGER.md', encoding='utf-8', errors='replace').read()
ledger_dates = sorted(set(re.findall(r'20\d{2}-\d{2}-\d{2}', ship)))
runs = sorted(f for f in os.listdir(repo + '/memory/runs') if re.match(r'20\d{2}-\d{2}-\d{2}', f) and re.search(r'deploy|ship|live|prod|shipped', f, re.I))
newest_run = runs[-1][:10] if runs else '(none)'
newest_ledger = ledger_dates[-1] if ledger_dates else '(none)'
print('[2] ship-ledger currency: newest SHIP-LEDGER date %s · newest runs/ ship-or-deploy file %s (%s) → %s' % (
    newest_ledger, newest_run, runs[-1] if runs else '', 'IN SYNC' if newest_ledger >= newest_run else 'GAP'))

# Check 3: OWED owners and age
owed = io.open(repo + '/docs/governance/OWED.md', encoding='utf-8', errors='replace').read().splitlines()
rows = [l for l in owed if re.match(r'^\|\s*OWED-\d+', l)]
open_rows = [l for l in rows if not re.search(r'\b(CLOSED|RESOLVED|DONE|resolved|closed)\b', l)]
blank = [l for l in rows if re.search(r'\|\s*(TBD|—|-|)\s*\|\s*$', l)]
print('[3] OWED: %d rows · %d look open · rows whose last cell is blank/TBD: %d' % (len(rows), len(open_rows), len(blank)))
for l in open_rows[:12]:
    print('    ' + l[:150])
