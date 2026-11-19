# cmpstage.py <old stage> <new stage> — what changed between two staged site folders (2026-11-10; tracked 2026-11-15 for the Pi wrapper):
# changed / added / removed files by sha256 (the .vercel link folder skipped), grouped by top folder, and the changed files OUTSIDE
# tour/ and _local/ (a tour-only change must show none). Read it before every deploy.
import collections, hashlib, os, sys
if len(sys.argv) != 3: sys.exit('usage: cmpstage.py <old stage> <new stage>')
a, b = sys.argv[1], sys.argv[2]
def walk(r):
    d = {}
    for root, dirs, files in os.walk(r):
        if '.vercel' in root.split(os.sep): continue
        for f in files:
            p = os.path.join(root, f)
            d[os.path.relpath(p, r).replace(os.sep, '/')] = hashlib.sha256(open(p, 'rb').read()).hexdigest()
    return d
A, B = walk(a), walk(b)
ch = sorted(k for k in B if k in A and A[k] != B[k]); ad = sorted(k for k in B if k not in A); rm = sorted(k for k in A if k not in B)
print('changed', len(ch), 'added', len(ad), 'removed', len(rm))
print('changed by folder', dict(collections.Counter('/'.join(k.split('/')[:2]) for k in ch)))
print('added', ad[:10]); print('removed', rm[:10])
print('changed outside tour/ and _local/:', [k for k in ch if not k.startswith(('tour/', '_local/'))][:20])
