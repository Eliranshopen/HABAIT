"""repoint.py ROOT [--apply]
Re-points the copied Habait tree from C:\\Habait to C:\\RnD\\Projects\\Habait, three forms, text files only.
Without --apply it only counts. Never touches .git/, _local/, node_modules/, .env, or binaries.
Writes a per-file count table to stdout (task 06 pastes it into REPOINTED.md)."""
import os, sys, io

ROOT = os.path.abspath(sys.argv[1])
APPLY = "--apply" in sys.argv
FORMS = [("C:\\Habait", "C:\\RnD\\Projects\\Habait"), ("C:/Habait", "C:/RnD/Projects/Habait"), ("/c/Habait", "/c/RnD/Projects/Habait"), ("c--Habait", "C--RnD")]
SKIP_DIRS = {".git", "_local", "node_modules", "__pycache__", ".cache", "renders", "renders-pano", "orbit", "skins-extra", "models", "probe-assets", "dist", "qa", "data_ring", "data_d"}
SKIP_PATHS = {os.path.join("research", "fal-bench-2026-11-02", "flyover3d", "data")}  # 1 GB of app data, no path text
TEXT_EXT = {".md", ".txt", ".json", ".mjs", ".js", ".cjs", ".py", ".ps1", ".sh", ".html", ".css", ".yaml", ".yml", ".toml", ".ini", ".cfg", ".csv", ".xml", ".svg", ".env.example", ".gitignore", ".gitattributes"}
SKIP_FILES = {".env"}

def is_text(path):
    name = os.path.basename(path)
    if name in SKIP_FILES:
        return False
    ext = os.path.splitext(name)[1].lower()
    if ext in TEXT_EXT or name in {".gitignore", ".gitattributes", "CLAUDE.md"}:
        return True
    return False

rows = []
total = 0
for dirpath, dirnames, filenames in os.walk(ROOT):
    dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS and os.path.relpath(os.path.join(dirpath, d), ROOT) not in SKIP_PATHS]
    for f in filenames:
        p = os.path.join(dirpath, f)
        if not is_text(p):
            continue
        try:
            raw = io.open(p, "r", encoding="utf-8", newline="").read()
        except (UnicodeDecodeError, OSError):
            continue
        counts = [raw.count(a) for a, _ in FORMS]
        n = sum(counts)
        if n == 0:
            continue
        rel = os.path.relpath(p, ROOT)
        rows.append((rel, counts))
        total += n
        if APPLY:
            new = raw
            for a, b in FORMS:
                new = new.replace(a, b)
            io.open(p, "w", encoding="utf-8", newline="").write(new)

print(f"| File | `C:\\Habait` | `C:/Habait` | `/c/Habait` | `c--Habait` |")
print("|---|---|---|---|---|")
for rel, c in sorted(rows):
    print(f"| `{rel}` | {c[0]} | {c[1]} | {c[2]} | {c[3]} |")
print(f"\nfiles: {len(rows)}  replacements: {total}  mode: {'APPLIED' if APPLY else 'count only'}")
