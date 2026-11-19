# Secret scan of the WHOLE history of a repository: every blob reachable from every ref, not only the files of today.
#   python history_scan.py <repo> [--max-mb 20]
# A value is never printed: a hit shows the pattern's name, the path, the blob's short id and the line with the
# matched span replaced by its length. Files with a secret-shaped NAME are counted, never named.
import re
import subprocess
import sys

ROOT = sys.argv[1]
MAX = (int(sys.argv[sys.argv.index('--max-mb') + 1]) if '--max-mb' in sys.argv else 20) * 1000000
MEDIA = re.compile(r'\.(png|webp|jpe?g|gif|bmp|tiff?|exr|hdr|ico|avif|heic|psd|mp4|mov|webm|mkv|avi|m4v|mp3|wav|ogg|m4a|aac|flac|glb|gltf\.bin|bin|fbx|obj|blend|usdz|ply|stl|pdf|zip|tgz|gz|tar|7z|rar|woff2?|ttf|otf|eot|ktx2|basis|npy|npz|pyc|dll|exe|node|wasm)$', re.I)
SECRET_NAME = re.compile(r'(^|/)(\.env(\.[^/]*)?|auth\.json|[^/]*\.pem|[^/]*\.key|id_rsa[^/]*|credentials(\.json)?)$', re.I)
PATTERNS = [
    ('sk- key', re.compile(rb'(?<![A-Za-z0-9_\-])sk-[A-Za-z0-9_\-]{24,}')),
    ('fal key', re.compile(rb'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:[0-9a-f]{32}')),
    ('Google API key', re.compile(rb'AIza[0-9A-Za-z_\-]{35}')),
    ('AWS access key id', re.compile(rb'\b(AKIA|ASIA)[0-9A-Z]{16}\b')),
    ('GitHub token', re.compile(rb'\b(gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{40,})')),
    ('Slack token', re.compile(rb'xox[baprs]-[A-Za-z0-9-]{10,}')),
    ('private key block', re.compile(rb'-----BEGIN [A-Z ]*PRIVATE KEY-----')),
    ('JWT', re.compile(rb'eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}')),
    ('Stripe key', re.compile(rb'\b(sk|rk|pk)_(live|test)_[A-Za-z0-9]{20,}')),
    ('Twilio sid or key', re.compile(rb'\b(SK|AC)[0-9a-f]{32}\b')),
    ('Apify token', re.compile(rb'apify_api_[A-Za-z0-9]{30,}')),
    ('Hugging Face token', re.compile(rb'\bhf_[A-Za-z0-9]{30,}')),
    ('Replicate token', re.compile(rb'\br8_[A-Za-z0-9]{30,}')),
    ('npm token', re.compile(rb'\bnpm_[A-Za-z0-9]{36}\b')),
    ('Supabase key', re.compile(rb'\b(sbp_[a-f0-9]{40}|sb_secret_[A-Za-z0-9_\-]{20,})')),
    ('Vercel token', re.compile(rb'\b(vercel_[A-Za-z0-9]{20,}|vc[a-z]_[A-Za-z0-9]{20,})')),
    ('Telegram bot token', re.compile(rb'\b\d{8,10}:[A-Za-z0-9_-]{35}\b')),
    ('Bearer value', re.compile(rb'[Bb]earer\s+[A-Za-z0-9_\-\.=+/]{24,}')),
    ('user:password in a URL', re.compile(rb'https?://[^/\s:@"\'<>]{2,}:[^/\s:@"\'<>]{4,}@[A-Za-z0-9.-]+')),
    ('named secret with a long value', re.compile(rb'(?i)\b[A-Z0-9_]*(api[_-]?key|secret|token|passwd|password|private[_-]?key)[A-Z0-9_]*["\'`]?\s*[:=]\s*["\'`]?([A-Za-z0-9_\-\./+=]{24,})')),
    ('gmail address', re.compile(rb'[A-Za-z0-9._%+-]+@gmail\.com')),
]
FAKE = re.compile(rb'(?i)plant|fake|test|example|dummy|sample|xxxx|0000|abcd|1234|your|placeholder|redact|hidden|process\.env|not-a-|change-?me|\.\.\.|scripted|stub|demo|fixed-word|no-key|getProperty|from_pretrained|noreply')


def git(*a, data=None):
    r = subprocess.run(['git', '-C', ROOT, '-c', 'core.quotepath=false', *a], input=data, capture_output=True)
    if r.returncode != 0:
        sys.exit('git %s failed: %s' % (a[0], r.stderr.decode('utf-8', 'replace')[:300]))
    return r.stdout


paths = {}
for line in git('rev-list', '--objects', '--all').decode('utf-8', 'replace').split('\n'):
    if ' ' in line:
        sha, path = line.split(' ', 1)
        paths.setdefault(sha, path)
check = git('cat-file', '--batch-check', data=('\n'.join(paths) + '\n').encode())
blobs, big, media, named = [], 0, 0, 0
for row in check.decode().split('\n'):
    p = row.split()
    if len(p) != 3 or p[1] != 'blob':
        continue
    path = paths[p[0]]
    if SECRET_NAME.search(path):
        named += 1                       # scanned like any text blob below, never named
    elif MEDIA.search(path):
        media += 1
        continue
    if int(p[2]) > MAX:
        big += 1
        continue
    blobs.append(p[0])
print('refs: %d · blobs in the history: %d text to scan, %d media left out, %d larger than %d MB left out, %d with a secret-shaped name'
      % (len(git('for-each-ref', '--format=%(refname)').split()), len(blobs), media, big, MAX // 1000000, named))

import tempfile
ids = tempfile.NamedTemporaryFile('wb', delete=False, suffix='.ids')
ids.write(('\n'.join(blobs) + '\n').encode())
ids.close()
proc = subprocess.Popen(['git', '-C', ROOT, 'cat-file', '--batch'], stdin=open(ids.name, 'rb'), stdout=subprocess.PIPE)
hits = {}
shown = 0
for part in [blobs]:
    for sha in part:
        head = proc.stdout.readline().split()
        size = int(head[2])
        data = proc.stdout.read(size)
        proc.stdout.read(1)
        if b'\0' in data[:8000]:
            continue
        for name, rx in PATTERNS:
            for m in rx.finditer(data):
                if FAKE.search(m.group(0)):
                    continue
                s = data.rfind(b'\n', 0, m.start()) + 1
                e = data.find(b'\n', m.end())
                line = data[s:e if e >= 0 else len(data)]
                if name != 'gmail address' and FAKE.search(line):
                    continue
                key = (name, paths[sha] if not SECRET_NAME.search(paths[sha]) else '<a file with a secret-shaped name>')
                hits.setdefault(key, []).append(sha[:8])
                if shown < 60 and len(hits[key]) == 1:
                    shown += 1
                    masked = (line[:m.start() - s] + b'[%d chars]' % len(m.group(0)) + line[m.end() - s:]).decode('utf-8', 'replace').strip()
                    masked = re.sub(r'[A-Za-z0-9_\-+/=]{24,}', lambda x: '[%d chars]' % len(x.group(0)), masked)
                    print('  %-28s %s  (%s)  %s' % (name, key[1].encode('ascii', 'replace').decode()[:90], sha[:8], masked.encode('ascii', 'replace').decode()[:150]))
proc.wait()
import os
os.remove(ids.name)
by = {}
for (name, path), v in hits.items():
    by.setdefault(name, [0, 0])
    by[name][0] += 1
    by[name][1] += len(v)
print('--- summary: %d (pattern, path) pairs that are not a planted fake' % len(hits))
for name, (files, n) in sorted(by.items()):
    print('  %-32s %d paths, %d blob versions' % (name, files, n))
