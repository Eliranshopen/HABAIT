# Copy a folder into the carry pack, WITHOUT any environment file, deploy-tool state or vendor folder.
#   python pack_copy_tree.py <source folder> <destination folder> [--go]
# A file whose name starts with ".env" is never opened, never copied and never named in the output: it is counted.
# Dry run by default. Safe to run twice (a file of the same size and time is left alone).
import os
import shutil
import sys

SRC, DST = sys.argv[1], sys.argv[2]
GO = '--go' in sys.argv
SKIP_DIRS = {'.vercel', 'node_modules', '.git', '__pycache__', '.next', '.cache'}


def secret_name(name):
    low = name.lower()
    return low.startswith('.env') or low in ('auth.json',) or low.endswith('.pem') or low.endswith('.key')


copied = same = skipped_secret = skipped_dirs = 0
size = 0
for root, dirs, files in os.walk(SRC):
    keep = []
    for d in dirs:
        if d in SKIP_DIRS:
            skipped_dirs += 1
        else:
            keep.append(d)
    dirs[:] = keep
    rel = os.path.relpath(root, SRC)
    out = DST if rel == '.' else os.path.join(DST, rel)
    for f in files:
        if secret_name(f):
            skipped_secret += 1
            continue
        s = os.path.join(root, f)
        t = os.path.join(out, f)
        st = os.stat(s)
        size += st.st_size
        if os.path.exists(t) and os.path.getsize(t) == st.st_size and int(os.path.getmtime(t)) == int(st.st_mtime):
            same += 1
            continue
        if GO:
            os.makedirs(out, exist_ok=True)
            shutil.copy2(s, t)
        copied += 1
print('%s: %d files to copy, %d already there, %.0f MB in all' % ('copied' if GO else 'dry run', copied, same, size / 1e6))
print('left out: %d files with a secret-shaped name (never opened), %d vendor or tool folders' % (skipped_secret, skipped_dirs))
