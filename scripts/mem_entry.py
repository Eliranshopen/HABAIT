"""mem_entry.py — write one memory entry the way root CLAUDE.md §0.2 asks, in one motion.

  python scripts/mem_entry.py --layer project --file 2026-11-03-foo.md --who "main session" \\
      --title "what this is" --did "..." --evidence path/a.md [--evidence path/b] \\
      --learned "..." --owed "..." --reader none|<agent> --index "pointer text" [--go]

Writes: the entry (memory/_TEMPLATE.md shape) appended to memory/<layer>/<file>;
one INDEX line under the layer's existing header; and, when --reader names an
agent, one pointer line appended to memory/agents/<reader>.md.
Refuses (exit 1): an evidence path that does not exist, an INDEX line over 400
chars, a missing header, or text that looks like a secret value (§8.1).
Dry-run by default (§5): prints what it would write; --go writes.
"""
import argparse, datetime, os, re, sys

LAYERS = {'agents', 'listings', 'project', 'runs'}
SECRET = re.compile(r'(sk-[A-Za-z0-9_-]{16,}|[A-Za-z0-9+/_-]{40,}|-----BEGIN|AKIA[0-9A-Z]{16})')


def die(msg):
    print('mem_entry: ' + msg, file=sys.stderr)
    sys.exit(1)


def main():
    for s in (sys.stdout, sys.stderr):
        s.reconfigure(encoding='utf-8', errors='replace')  # console is cp1255 here
    ap = argparse.ArgumentParser()
    ap.add_argument('--root', default=r'C:\RnD')
    ap.add_argument('--layer', required=True, choices=sorted(LAYERS))
    ap.add_argument('--file', required=True)
    ap.add_argument('--who', default='main session')
    ap.add_argument('--title', required=True)
    ap.add_argument('--did', required=True)
    ap.add_argument('--evidence', action='append', required=True)
    ap.add_argument('--learned', default='nothing new')
    ap.add_argument('--owed', default='none')
    ap.add_argument('--reader', default='none')
    ap.add_argument('--index', required=True)
    ap.add_argument('--go', action='store_true')
    a = ap.parse_args()

    root = os.path.abspath(a.root)
    mem = os.path.join(root, 'memory')
    if '/' in a.file or '\\' in a.file or not a.file.endswith('.md'):
        die('--file is a bare .md name inside the layer')
    for e in a.evidence:
        if not os.path.exists(os.path.join(root, e)):
            die('evidence path does not exist: ' + e)
    blob = ' '.join([a.title, a.did, a.learned, a.owed, a.index])
    if SECRET.search(blob):
        die('text looks like it holds a secret value; names only (§8.1)')

    today = datetime.date.today().isoformat()
    ev = ' · '.join('`%s`' % e.replace('\\', '/') for e in a.evidence)
    reader = a.reader if a.reader == 'none' else '`%s`' % a.reader
    entry = ('\n## %s · %s · %s\n- **Did:** %s\n- **Evidence:** %s\n- **Learned:** %s\n'
             '- **Owed / open:** %s\n- **Second reader:** %s\n') % (
        today, a.who, a.title, a.did, ev, a.learned, a.owed, reader)
    line = '- %s · %s · %s → `%s/%s`' % (today, a.who, a.index, a.layer, a.file)
    if len(line) > 400:
        die('INDEX line is %d chars (max 400); shorten --index' % len(line))

    idx = os.path.join(mem, 'INDEX.md')
    with open(idx, encoding='utf-8') as f:
        s = f.read()
    header = '## %s\n' % a.layer
    if header not in s:
        die('INDEX.md has no "%s" header; never add one' % header.strip())

    reader_file = None
    if a.reader != 'none':
        reader_file = os.path.join(mem, 'agents', a.reader + '.md')
        if not os.path.isfile(reader_file):
            die('no memory file for reader: memory/agents/%s.md' % a.reader)

    print('entry  -> memory/%s/%s%s' % (a.layer, a.file, entry))
    print('index  -> ' + line)
    if reader_file:
        print('reader -> memory/agents/%s.md' % a.reader)
    if not a.go:
        print('(dry run — nothing written; add --go)')
        return

    target = os.path.join(mem, a.layer, a.file)
    with open(target, 'a', encoding='utf-8', newline='\n') as f:
        f.write(entry)
    s = s.replace(header, header + line + '\n', 1)
    with open(idx, 'w', encoding='utf-8', newline='\n') as f:
        f.write(s)
    if reader_file:
        with open(reader_file, 'a', encoding='utf-8', newline='\n') as f:
            f.write('\n## %s · %s → second-reader pointer\n- %s → `memory/%s/%s`\n'
                    % (today, a.who, a.index, a.layer, a.file))
    print('written')


if __name__ == '__main__':
    main()
