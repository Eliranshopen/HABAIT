# Secret scan of a FOLDER (files on disk, not git): every text file under it, with the patterns of history_scan.py.
#   python dir_scan.py <folder> [<folder> ...]
# A value is never printed. A file with a secret-shaped name is counted and never opened.
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, 'history_scan.py'), encoding='utf-8').read()
exec(src[src.index('MEDIA = '):src.index('def git(')])      # MEDIA, SECRET_NAME, PATTERNS, FAKE

files = scanned = media = named = big = 0
hits = {}
for top in sys.argv[1:]:
    for root, dirs, names in os.walk(top):
        for n in names:
            files += 1
            p = os.path.join(root, n).replace('\\', '/')
            if SECRET_NAME.search(p):
                named += 1
                continue
            if MEDIA.search(p) or p.endswith('.bundle'):
                media += 1
                continue
            if os.path.getsize(p) > 30000000:
                big += 1
                continue
            data = open(p, 'rb').read()
            if b'\0' in data[:8000]:
                media += 1
                continue
            scanned += 1
            for name, rx in PATTERNS:
                for m in rx.finditer(data):
                    if FAKE.search(m.group(0)):
                        continue
                    s = data.rfind(b'\n', 0, m.start()) + 1
                    e = data.find(b'\n', m.end())
                    line = data[s:e if e >= 0 else len(data)]
                    if name != 'gmail address' and FAKE.search(line):
                        continue
                    key = (name, p)
                    hits[key] = hits.get(key, 0) + 1
                    if hits[key] == 1 and len(hits) <= 40:
                        masked = (line[:m.start() - s] + b'[%d chars]' % len(m.group(0)) + line[m.end() - s:]).decode('utf-8', 'replace').strip()
                        masked = re.sub(r'[A-Za-z0-9_\-+/=]{24,}', lambda x: '[%d chars]' % len(x.group(0)), masked)
                        print('  %-28s %s  %s' % (name, p.encode('ascii', 'replace').decode()[-80:], masked.encode('ascii', 'replace').decode()[:130]))
print('%d files: %d text scanned, %d media or binary left out, %d over 30 MB left out, %d with a secret-shaped name (never opened)'
      % (files, scanned, media, big, named))
print('hits that are not a planted fake: %d (pattern, file) pairs' % len(hits))
