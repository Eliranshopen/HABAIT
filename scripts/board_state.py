"""board_state.py — one state source for plans and boards (plan development/plans/2026-11-04-workflow-cleanup.md).

  python scripts/board_state.py          # check: report drift, exit 1 if any
  python scripts/board_state.py --go     # also rewrite a drifted LEADING state word in a table cell

The source of truth is each board README's `**State:** `WORD`` line (development/tasks/<slug>/README.md).
Checked against it:
  - development/tasks/CLAUDE.md, the board table: one row per board, its State cell starts with the README's word;
  - development/plans/CLAUDE.md, the plans table: one row per plan file; a row whose Board cell starts with
    `../tasks/<slug>/` has a State cell that starts with that board's word. A plan with no board keeps its state
    in the table (not checked).
--go only replaces the leading state word of a drifted cell. It never adds or removes a row, never edits a README,
never touches prose: a missing row, a dead row or a cell that does not start with a state word is reported for a
hand fix (exit 1). Dry-run by default (root §5). --root points at a test copy.
"""
import argparse, glob, os, re, sys

VOCAB = ('PLANNED', 'EXECUTING', 'IN-PROGRESS', 'LIVE', 'BLOCKED', 'SHIPPED', 'CLOSED', 'ABANDONED')
STATE_RE = re.compile(r'\*\*State:\*\*\s*`([A-Z][A-Z-]*)')
LEAD_RE = re.compile(r'^(\s*)([A-Z][A-Z-]+)')


def read_lines(p):
    with open(p, encoding='utf-8', newline='') as f:
        return f.read().splitlines(keepends=True)


def write_lines(p, lines):
    with open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(''.join(lines))


def cells(line):
    """Split a markdown table row into cells; None if the line is not a data row."""
    s = line.rstrip('\r\n')
    if not s.startswith('|') or re.match(r'^\|[\s|:-]+\|?$', s):
        return None
    return [c.strip() for c in s.strip('|').split('|')]


def readme_states(root):
    states, missing = {}, []
    for rd in sorted(glob.glob(os.path.join(root, 'development', 'tasks', '*', 'README.md'))):
        slug = os.path.basename(os.path.dirname(rd))
        m = None
        for line in read_lines(rd)[:40]:
            m = STATE_RE.search(line)
            if m:
                break
        if m and m.group(1) in VOCAB:
            states[slug] = m.group(1)
        else:
            missing.append(slug)
    return states, missing


def check_table(path, row_key, state_col, states, label, go, findings, fixes):
    """row_key(cells) -> board slug or None; returns the set of slugs seen."""
    lines = read_lines(path)
    seen, changed = set(), False
    for i, line in enumerate(lines):
        c = cells(line)
        if not c or len(c) <= state_col:
            continue
        slug = row_key(c)
        if slug is None:
            continue
        seen.add(slug)
        if slug not in states:
            continue
        want, cell = states[slug], c[state_col]
        m = LEAD_RE.match(cell)
        if not m or m.group(2) not in VOCAB:
            findings.append(f'{label}: row `{slug}` State cell does not start with a state word (README says {want}) — fix by hand')
            continue
        if m.group(2) != want:
            if go:
                new_cell = want + cell[m.end(2):]
                parts = line.split('|')
                # parts[0] is '' before the first pipe, so cell k lives at parts[k + 1]
                parts[state_col + 1] = parts[state_col + 1].replace(cell, new_cell, 1)
                lines[i] = '|'.join(parts)
                changed = True
                fixes.append(f'{label}: row `{slug}` {m.group(2)} -> {want}')
            else:
                findings.append(f'{label}: row `{slug}` says {m.group(2)}, README says {want} (--go rewrites the word)')
    if changed:
        write_lines(path, lines)
    return seen


def main():
    ap = argparse.ArgumentParser(description='plan and board state parity (one source: the board README)')
    ap.add_argument('--root', default='C:\\RnD')
    ap.add_argument('--go', action='store_true')
    a = ap.parse_args()
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
    root = a.root
    tasks_md = os.path.join(root, 'development', 'tasks', 'CLAUDE.md')
    plans_md = os.path.join(root, 'development', 'plans', 'CLAUDE.md')
    for p in (tasks_md, plans_md):
        if not os.path.isfile(p):
            print('board_state: missing ' + p, file=sys.stderr)
            sys.exit(1)

    states, no_state = readme_states(root)
    findings, fixes, info = [], [], []
    for slug in no_state:
        findings.append(f'board `{slug}`: README has no `**State:** `WORD`` line with a state word — fix by hand')
    for d in sorted(glob.glob(os.path.join(root, 'development', 'tasks', '*', ''))):
        slug = os.path.basename(os.path.dirname(d))
        if not os.path.isfile(os.path.join(d, 'README.md')):
            info.append(f'`tasks/{slug}/` has no README.md (records folder, not a board)')

    def task_key(c):
        m = re.match(r'^`([^`/]+)/`$', c[0])
        return m.group(1) if m else None

    seen = check_table(tasks_md, task_key, 2, states, 'board table', a.go, findings, fixes)
    for slug in sorted(set(states) | set(no_state)):
        if slug not in seen:
            findings.append(f'board table: board `{slug}` has no row — add it by hand')
    for slug in sorted(seen):
        if not os.path.isdir(os.path.join(root, 'development', 'tasks', slug)):
            findings.append(f'board table: row `{slug}` has no board folder')

    plan_rows = {}

    def plan_key(c):
        m = re.match(r'^`(\d{4}-\d{2}-\d{2}-[^`]+\.md)`$', c[0])
        if not m:
            return None
        b = re.match(r'^`\.\./tasks/([^`/]+)/`', c[2]) if len(c) > 2 else None
        plan_rows[m.group(1)] = b.group(1) if b else None
        return b.group(1) if b else ('plan:' + m.group(1))

    check_table(plans_md, plan_key, 3, states, 'plans table', a.go, findings, fixes)
    on_disk = {os.path.basename(p) for p in glob.glob(os.path.join(root, 'development', 'plans', '2*.md'))}
    for f in sorted(on_disk - set(plan_rows)):
        findings.append(f'plans table: plan `{f}` has no row — add it by hand (root §8.8)')
    for f in sorted(set(plan_rows) - on_disk):
        findings.append(f'plans table: row `{f}` has no plan file')
    for f, b in sorted(plan_rows.items()):
        if b and b not in states and b not in no_state:
            findings.append(f'plans table: row `{f}` points at board `{b}`, which has no README')

    print(f'board_state: {len(states)} boards with a state · {len(on_disk)} plans · mode {"GO" if a.go else "dry-run"}')
    for slug, s in sorted(states.items()):
        print(f'  {s:<11} {slug}')
    for line in fixes:
        print('FIXED  ' + line)
    for line in findings:
        print('DRIFT  ' + line)
    for line in info:
        print('info   ' + line)
    if findings:
        print(f'board_state: {len(findings)} finding(s)', file=sys.stderr)
        sys.exit(1)
    print('board_state: CLEAN')


if __name__ == '__main__':
    main()
