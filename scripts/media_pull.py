"""media_pull.py — give a feature worktree the media git does not carry, from the main checkout.

A git worktree holds tracked files only. The product's ignored media (_local/ folders, floor-plan
webp, node_modules) live only in the main checkout C:\\RnD. This script links them into a
worktree under C:\\RnD\\.wt\\<name>:
  * a FOLDER becomes a directory junction to the main checkout's folder (read it; writes land in main)
  * a FILE is copied and its sha256 checked against the source
  * a COPYDIR (a folder the feature's builds WRITE into, e.g. platform/_local/dist) is copied whole,
    so a build in the worktree never writes into the main checkout; file count and bytes are checked

Root §5 contract: dry-run by default; --go acts; idempotent (an existing correct link is kept);
writes the record C:\\RnD\\.wt\\<name>.media.json; exits non-zero with the reason on stderr.

--unlink removes ONLY the junctions and copied files this script made (from the record), never
what they point at. Run it BEFORE a worktree is removed: removing a worktree with live junctions
inside could reach into the main checkout's media.

Usage (Git Bash, from C:\\RnD):
  python scripts/media_pull.py fix-disclosure-badge          # dry run: what would be linked
  python scripts/media_pull.py fix-disclosure-badge --go     # link
  python scripts/media_pull.py fix-disclosure-badge --unlink --go
"""
import argparse, hashlib, json, os, shutil, sys, time

ROOT = r"C:\RnD"
W = r"Projects\Habait\habait-walkaround\Habait"
# (relative path from the repo root, kind). Build output (tour360/dist) is NOT linked: a worktree builds its own.
ITEMS = [
    (W + r"\tour360\apartments\apt846\_local", "dir"),
    (W + r"\tour360\apartments\apt846\plan\floorplan.webp", "file"),
    (W + r"\tour360\apartments\demo-01\plan\floorplan.webp", "file"),
    (W + r"\platform\_local", "copydir"),  # build_zip.mjs writes _local/dist here: a real copy, never a link
    (W + r"\engine\_local", "dir"),
    (W + r"\studio\_local", "dir"),
    (W + r"\platform\node_modules", "dir"),
    (W + r"\studio\node_modules", "dir"),
    (W + r"\tour360\engine\node_modules", "dir"),
]


def sha256(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def tree_size(d):
    n = b = 0
    for r, _, files in os.walk(d):
        for x in files:
            n += 1
            b += os.path.getsize(os.path.join(r, x))
    return n, b


def is_junction(p):
    if hasattr(os.path, "isjunction"):
        return os.path.isjunction(p)
    try:
        return bool(os.lstat(p).st_file_attributes & 0x400) and os.path.isdir(p)  # FILE_ATTRIBUTE_REPARSE_POINT
    except OSError:
        return False


def make_junction(src, dst):
    import _winapi
    _winapi.CreateJunction(src, dst)


def fail(msg):
    print("media_pull: " + msg, file=sys.stderr)
    sys.exit(1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("name", help="worktree folder name under C:\\RnD\\.wt")
    ap.add_argument("--go", action="store_true")
    ap.add_argument("--unlink", action="store_true")
    a = ap.parse_args()

    wt = os.path.join(ROOT, ".wt", a.name)
    record = os.path.join(ROOT, ".wt", a.name + ".media.json")
    if not os.path.isfile(os.path.join(wt, ".git")):
        fail(f"{wt} is not a git worktree (no .git file)")

    if a.unlink:
        if not os.path.exists(record):
            fail(f"no record {record}: nothing this script made to unlink")
        rows = json.load(open(record, encoding="utf-8"))["links"]
        for r in rows:
            dst = os.path.join(wt, r["path"])
            if not os.path.lexists(dst):
                print(f"gone      {r['path']}")
                continue
            if r["kind"] == "copydir":
                print(f"keep      {r['path']}  (a copy inside the worktree; it goes with the worktree)")
                continue
            if r["kind"] == "dir":
                if not is_junction(dst):
                    fail(f"{dst} is not a junction any more; refusing to touch it")
                print(("unlink    " if a.go else "would unlink ") + r["path"])
                if a.go:
                    os.rmdir(dst)  # removes the junction only, never its target
            else:
                print(("remove    " if a.go else "would remove ") + r["path"])
                if a.go:
                    os.remove(dst)
        if a.go:
            os.replace(record, record + ".unlinked")
        return

    rows, todo = [], 0
    for rel, kind in ITEMS:
        src, dst = os.path.join(ROOT, rel), os.path.join(wt, rel)
        if not os.path.exists(src):
            print(f"skip      {rel}  (not in the main checkout)")
            continue
        if os.path.lexists(dst):
            ok = (kind == "dir" and is_junction(dst) and os.path.samefile(dst, src)) or \
                 (kind == "file" and os.path.isfile(dst) and sha256(dst) == sha256(src)) or \
                 (kind == "copydir" and os.path.isdir(dst) and not is_junction(dst))
            if not ok:
                fail(f"{dst} exists and is not the expected {kind} link; resolve by hand")
            print(f"ok        {rel}")
            rows.append({"path": rel, "kind": kind, "source": src})
            continue
        todo += 1
        print(("link      " if a.go else "would link ") + f"{rel}  ({kind})")
        if a.go:
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            if kind == "dir":
                make_junction(src, dst)
                if not (is_junction(dst) and os.path.samefile(dst, src)):
                    fail(f"junction check failed for {dst}")
            elif kind == "copydir":
                shutil.copytree(src, dst, symlinks=True)
                if tree_size(dst) != tree_size(src):
                    fail(f"copy check failed for {dst}: {tree_size(dst)} vs {tree_size(src)} (files, bytes)")
            else:
                shutil.copy2(src, dst)
                if sha256(dst) != sha256(src):
                    fail(f"sha256 mismatch after copy: {dst}")
            rows.append({"path": rel, "kind": kind, "source": src})
    if a.go:
        json.dump({"worktree": wt, "made": time.strftime("%Y-%m-%dT%H:%M:%S"), "links": rows,
                   "note": "run `python scripts/media_pull.py %s --unlink --go` BEFORE removing this worktree" % a.name},
                  open(record, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
        print(f"record    {record}")
    elif todo:
        print("dry run: nothing changed; add --go")


if __name__ == "__main__":
    main()
