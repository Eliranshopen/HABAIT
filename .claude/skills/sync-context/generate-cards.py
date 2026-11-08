"""generate-cards.py [--root C:\\RnD] [--check] [--apply]

The "card in every folder" rule (root CLAUDE.md, section 8.6, Eliran 2026-11-03):
every folder under the root gets a CLAUDE.md, present and future, except vendor and build output.

--check  : list folders that have no card (exit 1 if any) and generated cards whose tables are stale.
--apply  : write a card into every folder that lacks one; refresh the tables of every GENERATED card.
           Hand-written cards (no `generated-by` marker) are never touched.
           In a generated card the `## Purpose` and `## Gotchas` sections are kept verbatim across runs;
           only the What's-here / Subfolders tables and the date marker regenerate.
Also writes docs/context-map.generated.md: one row per card on disk (the root Context map lists the areas;
this file is the full list).

Facts only: every line comes from the file system. The Purpose line of a new card is an explicit
placeholder until a person or the cartographer writes it.
"""
import os, sys, io, re, datetime
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = r"C:\RnD"
if "--root" in sys.argv:
    ROOT = sys.argv[sys.argv.index("--root") + 1]
ROOT = os.path.abspath(ROOT)
CHECK = "--check" in sys.argv
APPLY = "--apply" in sys.argv
TODAY = datetime.date.today().isoformat()
MARK = "generated-by: generate-cards.py"

# Vendor and build output: never a card, never descended into (Eliran 2026-11-03).
SKIP_NAMES = {"node_modules", ".git", "__pycache__", ".cache", "dist", "build", ".next", ".turbo",
              ".pytest_cache", ".mypy_cache", "habait-venv", ".venv", "venv", "worktrees", ".wt"}
SKIP_PREFIXES = ("blender-4.",)          # the portable Blender bundle under tools/
PLACEHOLDER = "_Not written yet — one line on what this folder is for. Until then the parent context file's row for this folder is the description._"

def human(n):
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024 or unit == "GB":
            return f"{n:.0f} {unit}" if unit == "B" else f"{n:.1f} {unit}"
        n /= 1024

# Backup and archive copies stay byte-faithful to their source: never a card, never descended into (main session on Eliran's
# delegation, 2026-11-04 — after --apply wrote ~522 cards into Projects/Habait-backup-2026-11-04 mid-copy).
SKIP_RE = re.compile(r"-(backup|archive)-\d{4}-\d{2}-\d{2}$", re.I)

def skip_dir(name):
    return name in SKIP_NAMES or name.startswith(SKIP_PREFIXES) or bool(SKIP_RE.search(name))

def folders():
    out = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = sorted(d for d in dirnames if not skip_dir(d))
        out.append((dirpath, list(dirnames), sorted(filenames)))
    return out

def rel(p):
    r = os.path.relpath(p, ROOT).replace("\\", "/")
    return "" if r == "." else r

def tree_size(dirpath):
    """Files and bytes under a folder, vendor/build output excluded, the cards themselves not counted
    (so writing cards never makes the numbers stale)."""
    total, count = 0, 0
    for dp, dn, fn in os.walk(dirpath):
        dn[:] = [d for d in dn if not skip_dir(d)]
        for f in fn:
            if f == "CLAUDE.md":
                continue
            try:
                total += os.path.getsize(os.path.join(dp, f)); count += 1
            except OSError:
                pass
    return total, count

def section(text, title):
    m = re.search(r"^## " + re.escape(title) + r"\n(.*?)(?=^## |\Z)", text, re.S | re.M)
    return m.group(1).strip("\n") if m else None

def render(dirpath, dirnames, filenames, purpose, gotchas):
    r = rel(dirpath)
    name = (os.path.basename(dirpath) if r else os.path.basename(ROOT)) + "/"
    depth = r.count("/") + 1 if r else 0
    up = "../" * depth
    lines = [f"# {name} — context file", f"<!-- last-updated: {TODAY} -->",
             f"<!-- {MARK} · tables are facts from disk and regenerate; Purpose and Gotchas are kept as written -->", ""]
    lines += ["## Purpose", purpose or PLACEHOLDER, ""]
    files = [f for f in filenames if f != "CLAUDE.md"]
    tsize, tcount = tree_size(dirpath)
    lines += [f"## What's here ({TODAY})",
              f"{len(files)} files here · {len(dirnames)} subfolders · {tcount} files / {human(tsize)} in the whole tree (vendor and build output excluded)", ""]
    if files:
        lines += ["| File | Size | Modified |", "|---|---|---|"]
        for f in files[:40]:
            p = os.path.join(dirpath, f)
            try:
                st = os.stat(p)
                lines.append(f"| `{f}` | {human(st.st_size)} | {datetime.date.fromtimestamp(st.st_mtime).isoformat()} |")
            except OSError:
                lines.append(f"| `{f}` | ? | ? |")
        if len(files) > 40:
            lines.append(f"| … and {len(files) - 40} more | | |")
        lines.append("")
    if dirnames:
        lines += ["## Subfolders", "| Folder | Card | Files in tree |", "|---|---|---|"]
        for d in dirnames:
            s, c = tree_size(os.path.join(dirpath, d))
            lines.append(f"| `{d}/` | [`{d}/CLAUDE.md`]({d}/CLAUDE.md) | {c} ({human(s)}) |")
        lines.append("")
    skipped = []
    try:
        skipped = sorted(d for d in os.listdir(dirpath) if os.path.isdir(os.path.join(dirpath, d)) and skip_dir(d))
    except OSError:
        pass
    if skipped:
        lines += ["Vendor / build output here (no card by rule): " + ", ".join(f"`{d}/`" for d in skipped), ""]
    lines += ["## Gotchas", gotchas or "_none recorded_", ""]
    parent = f"Parent: [../CLAUDE.md](../CLAUDE.md) · " if r else ""
    lines += ["## Links", f"{parent}Root: [{up}CLAUDE.md]({up}CLAUDE.md) · Rule: root `CLAUDE.md` §8.6 · Full list: `docs/context-map.generated.md`", ""]
    return "\n".join(lines)

def main():
    missing, stale, written, kept = [], [], 0, 0
    index_rows = []
    for dirpath, dirnames, filenames in folders():
        card = os.path.join(dirpath, "CLAUDE.md")
        r = rel(dirpath) or "."
        if os.path.exists(card):
            text = io.open(card, encoding="utf-8", errors="replace").read()
            if MARK in text:
                purpose = section(text, "Purpose")
                gotchas = section(text, "Gotchas")
                new = render(dirpath, dirnames, filenames, purpose, gotchas)
                old_body = re.sub(r"<!-- last-updated: .*? -->", "", text)
                new_body = re.sub(r"<!-- last-updated: .*? -->", "", new)
                if old_body != new_body:
                    stale.append(r)
                    if APPLY:
                        io.open(card, "w", encoding="utf-8", newline="\n").write(new); written += 1
                p = purpose if purpose and purpose != PLACEHOLDER else "(purpose not written yet)"
                index_rows.append((r, "generated", p))
            else:
                kept += 1
                h1 = next((l.lstrip("# ").strip() for l in text.splitlines() if l.startswith("# ")), "")
                index_rows.append((r, "hand-written", h1))
        else:
            missing.append(r)
            if APPLY:
                io.open(card, "w", encoding="utf-8", newline="\n").write(render(dirpath, dirnames, filenames, None, None)); written += 1
            index_rows.append((r, "generated", "(purpose not written yet)"))
    if APPLY:
        idx = [f"# Context map — every CLAUDE.md on disk ({len(index_rows)} cards)",
               f"<!-- last-updated: {TODAY} -->",
               f"<!-- {MARK} · do not hand-edit; the root CLAUDE.md Context map lists the areas, this file lists every card -->", "",
               "| Folder | Context file | Kind | Purpose / title |", "|---|---|---|---|"]
        for r, kind, p in index_rows:
            link = "CLAUDE.md" if r == "." else f"{r}/CLAUDE.md"
            idx.append(f"| `{r}/` | [context file](../{link}) | {kind} | {p.replace('|', '/')[:160]} |")
        os.makedirs(os.path.join(ROOT, "docs"), exist_ok=True)
        io.open(os.path.join(ROOT, "docs", "context-map.generated.md"), "w", encoding="utf-8", newline="\n").write("\n".join(idx) + "\n")
    print(f"folders scanned: {len(index_rows)} · hand-written context files kept: {kept} · missing context files: {len(missing)} · stale generated: {len(stale)} · written: {written}")
    if CHECK:
        for m in missing: print("MISSING", m)
        for s in stale: print("STALE  ", s)
        sys.exit(1 if (missing or stale) else 0)

if __name__ == "__main__":
    main()
