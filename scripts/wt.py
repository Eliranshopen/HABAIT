"""wt.py — the working-folder procedure of root CLAUDE.md §8.7, as one script.

  python scripts/wt.py open   <name> <rel-path>... [--purpose "..."] [--go]
  python scripts/wt.py add    <name> <rel-path>...                    [--go]
  python scripts/wt.py status <name>
  python scripts/wt.py close  <name>                                  [--go]

Paths are relative to the root (default C:\\RnD, --root to override, e.g. for a test).
A path that does not exist yet is a new file: its sha256_at_open is null and you
create it under .wt\\<name>\\files\\<rel-path>.
Dry-run by default (§5): without --go it prints what it would do and writes nothing.
Close refuses (exit 1) if any live file changed since open: reconcile by hand.
Removing a working folder stays Eliran's act (D11); this script never deletes.
"""
import argparse, datetime, glob, hashlib, json, os, shutil, sys


def sha(p):
    with open(p, 'rb') as f:
        return hashlib.sha256(f.read()).hexdigest()


def die(msg):
    print('wt: ' + msg, file=sys.stderr)
    sys.exit(1)


def norm(rel):
    rel = rel.replace('\\', '/').lstrip('/')
    if rel.startswith('.wt/') or '..' in rel.split('/'):
        die('path must be a live path under the root: ' + rel)
    return rel


def load(mp):
    with open(mp, encoding='utf-8') as f:
        return json.load(f)


def save(mp, m):
    with open(mp, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(m, f, ensure_ascii=False, indent=1)
        f.write('\n')


def held_elsewhere(root, name, rel):
    """Names of other OPEN working folders whose manifest lists rel."""
    hits = []
    for mp in glob.glob(os.path.join(root, '.wt', '*', 'manifest.json')):
        other = os.path.basename(os.path.dirname(mp))
        if other == name:
            continue
        m = load(mp)
        if m.get('closed'):
            continue
        if any(f['path'] == rel for f in m.get('files', [])):
            hits.append(other)
    return hits


def stage(root, wt, name, m, rels, go):
    known = {f['path']: f for f in m['files']}
    for rel in map(norm, rels):
        entry = known.get(rel)
        if entry and 'sha256_at_close' not in entry:
            die(rel + ' is already in this manifest')
        others = held_elsewhere(root, name, rel)
        if others:
            die(rel + ' is held by open working folder(s): ' + ', '.join(others))
        live = os.path.join(root, rel)
        h = sha(live) if os.path.isfile(live) else None
        # a file closed earlier in the SAME task is reopened for a follow-up fix (one folder per task, §8.7):
        # the earlier open/close pair moves to 'rounds' and the live file is copied again with a fresh hash
        print(('reopen ' if entry else '') + ('copy ' if h else 'new  ') + rel + ('  ' + h[:12] if h else ''))
        if go and h:
            dst = os.path.join(wt, 'files', rel)
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.copy2(live, dst)
        if entry:
            entry.setdefault('rounds', []).append({'sha256_at_open': entry.pop('sha256_at_open'), 'sha256_at_close': entry.pop('sha256_at_close')})
            entry['sha256_at_open'] = h
        else:
            m['files'].append({'path': rel, 'sha256_at_open': h})


def main():
    for s in (sys.stdout, sys.stderr):
        s.reconfigure(encoding='utf-8', errors='replace')  # console is cp1255 here
    ap = argparse.ArgumentParser(description='working folders, root CLAUDE.md §8.7')
    ap.add_argument('cmd', choices=['open', 'add', 'status', 'close'])
    ap.add_argument('name')
    ap.add_argument('paths', nargs='*')
    ap.add_argument('--purpose', default='')
    ap.add_argument('--root', default=r'C:\RnD')
    ap.add_argument('--go', action='store_true')
    a = ap.parse_args()

    root = os.path.abspath(a.root)
    if not a.name.replace('-', '').replace('_', '').isalnum():
        die('name must be a flat slug: ' + a.name)
    wt = os.path.join(root, '.wt', a.name)
    mp = os.path.join(wt, 'manifest.json')
    now = datetime.datetime.now().isoformat(timespec='seconds')

    if a.cmd == 'open':
        if os.path.exists(wt):
            die('.wt/' + a.name + ' exists: use add for a follow-up (one folder per task)')
        if not a.paths:
            die('open needs at least one path')
        m = {'name': a.name, 'purpose': a.purpose, 'opened': now, 'files': []}
        stage(root, wt, a.name, m, a.paths, a.go)
        if a.go:
            os.makedirs(wt, exist_ok=True)
            save(mp, m)
    elif not os.path.isfile(mp):
        die('no manifest at ' + mp)
    else:
        m = load(mp)
        if a.cmd == 'add':
            if m.get('closed'):
                print('note: reopening a closed folder for a follow-up in the same task')
                m.pop('closed')
            stage(root, wt, a.name, m, a.paths, a.go)
            if a.go:
                save(mp, m)
        else:
            todo = [f for f in m['files'] if 'sha256_at_close' not in f]
            if not todo:
                print('nothing open in .wt/%s (closed %s)' % (a.name, m.get('closed', '?')))
            drift = []
            for f in todo:
                live = os.path.join(root, f['path'])
                copy = os.path.join(wt, 'files', f['path'])
                now_live = sha(live) if os.path.isfile(live) else None
                if now_live != f['sha256_at_open']:
                    drift.append(f['path'])
                state = 'missing-copy' if not os.path.isfile(copy) else (
                    'unchanged' if f['sha256_at_open'] and sha(copy) == f['sha256_at_open'] else 'changed')
                flag = '  DRIFT (live changed since open)' if f['path'] in drift else ''
                print('%-12s %s%s' % (state, f['path'], flag))
            if a.cmd == 'close':
                if drift:
                    die('live file(s) changed since open, reconcile by hand: ' + ', '.join(drift))
                missing = [f['path'] for f in todo if not os.path.isfile(os.path.join(wt, 'files', f['path']))]
                if missing:
                    die('no copy to bring back: ' + ', '.join(missing))
                if a.go:
                    for f in todo:
                        live = os.path.join(root, f['path'])
                        copy = os.path.join(wt, 'files', f['path'])
                        os.makedirs(os.path.dirname(live), exist_ok=True)
                        shutil.copy2(copy, live)
                        f['sha256_at_close'] = sha(live)
                        if f['sha256_at_close'] != sha(copy):
                            die('copy-back verify failed: ' + f['path'])
                    m['closed'] = now
                    save(mp, m)
                    print('closed %d file(s)' % len(todo))
    if not a.go and a.cmd != 'status':
        print('(dry run — nothing written; add --go)')


if __name__ == '__main__':
    main()
