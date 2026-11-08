"""Card 06: refresh the stale generated context files, except the ones another open working folder holds (byte-exact restore)."""
import glob
import json
import os
import subprocess
import sys

ROOT = r"C:\RnD"
held = set()
for mp in glob.glob(os.path.join(ROOT, ".wt", "*", "manifest.json")):
    m = json.load(open(mp, encoding="utf-8"))
    if m.get("closed"):
        continue
    for f in m.get("files", []):
        if f["path"].endswith("CLAUDE.md") and "sha256_at_close" not in f:
            held.add(f["path"])
saved = {p: open(os.path.join(ROOT, p), "rb").read() for p in held if os.path.exists(os.path.join(ROOT, p))}
r = subprocess.run([sys.executable, os.path.join(ROOT, ".claude", "skills", "sync-context", "generate-cards.py"), "--apply"],
                   cwd=ROOT, capture_output=True, text=True, timeout=300)
print(r.stdout.strip().splitlines()[-1] if r.stdout.strip() else r.stderr[-400:])
restored = 0
for p, b in saved.items():
    full = os.path.join(ROOT, p)
    if open(full, "rb").read() != b:
        open(full, "wb").write(b)
        restored += 1
print(f"held by an open working folder: {len(saved)}; restored byte-exact after the refresh: {restored}")
