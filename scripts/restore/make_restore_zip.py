# The engine's restore pack as ONE zip for a GitHub release: the files of C:\RnD-carry-2026-11-19 WITHOUT agent-side\
# (its git bundles carry commit metadata that is not for a public place). Files sit at the zip's root.
#   python make_restore_zip.py <pack folder> <zip file>
import hashlib
import os
import sys
import zipfile

PACK, OUT = sys.argv[1], sys.argv[2]
TOP = ['RESTORE.cmd', 'restore.ps1', 'README-HE.md', 'rnd-repo.bundle', 'not-in-git', 'claude-memory']
STORED = ('.bundle', '.zip', '.png', '.jpg', '.jpeg', '.webp', '.mp4', '.woff2', '.glb')


def secret_name(name):
    low = name.lower()
    return low.startswith('.env') or low == 'auth.json' or low.endswith('.pem') or low.endswith('.key')


count = size = 0
with zipfile.ZipFile(OUT, 'w', allowZip64=True) as z:
    for top in TOP:
        p = os.path.join(PACK, top)
        if not os.path.exists(p):
            sys.exit('missing in the pack: ' + top)
        items = [p] if os.path.isfile(p) else [os.path.join(r, n) for r, _, names in os.walk(p) for n in names]
        for f in items:
            if secret_name(os.path.basename(f)):
                sys.exit('a file with a secret-shaped name is in the pack')
            arc = os.path.relpath(f, PACK).replace('\\', '/')
            how = zipfile.ZIP_STORED if f.lower().endswith(STORED) else zipfile.ZIP_DEFLATED
            z.write(f, arc, compress_type=how, compresslevel=None if how == zipfile.ZIP_STORED else 6)
            count += 1
            size += os.path.getsize(f)
h = hashlib.sha256()
with open(OUT, 'rb') as f:
    for chunk in iter(lambda: f.read(1 << 22), b''):
        h.update(chunk)
print('%d files, %.0f MB in, %.0f MB zip, sha256 %s' % (count, size / 1e6, os.path.getsize(OUT) / 1e6, h.hexdigest()))
with zipfile.ZipFile(OUT) as z:
    bad = z.testzip()
    print('zip test:', 'ok' if bad is None else 'BAD ' + bad)
