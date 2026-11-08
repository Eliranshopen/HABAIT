"""verify_walk.py SRC DST exclude.txt [--sample N] [--seed S]
Walks both trees with the same exclusion predicate as the robocopy pass and reports:
  files / bytes per side and the difference; paths present on one side only (first 50);
  sha256 of N random files (seeded) plus every file <= 64 KB under development/ and docs/.
Read-only. Exit 0 = every check PASS, 1 = any FAIL."""
import os, sys, hashlib, random, fnmatch

def load_excludes(path):
    names, abspaths, patterns = set(), set(), []
    for line in open(path, encoding="utf-8"):
        s = line.strip()
        if not s or s.startswith("#"):
            continue
        if s.startswith("*") or s.startswith("?"):
            patterns.append(s)
        elif ":" in s or s.startswith("\\\\"):
            abspaths.add(os.path.normcase(os.path.normpath(s)))
        else:
            names.add(s.lower())
    return names, abspaths, patterns

def long(p):
    p = os.path.abspath(p)
    return p if p.startswith("\\\\?\\") else "\\\\?\\" + p

def walk(root, names, abspaths, patterns, root_for_abs):
    out = {}
    rootl = long(root)
    for dirpath, dirnames, filenames in os.walk(rootl):
        rel_dir = os.path.relpath(dirpath, rootl)
        keep = []
        for d in dirnames:
            full_src = os.path.normcase(os.path.normpath(os.path.join(root_for_abs, rel_dir if rel_dir != "." else "", d)))
            if d.lower() in names or full_src in abspaths:
                continue
            keep.append(d)
        dirnames[:] = keep
        for f in filenames:
            if any(fnmatch.fnmatch(f, pat) for pat in patterns):
                continue
            rel = os.path.normpath(os.path.join(rel_dir if rel_dir != "." else "", f))
            try:
                out[rel] = os.path.getsize(os.path.join(dirpath, f))
            except OSError as e:
                out[rel] = -1
    return out

def sha(p):
    h = hashlib.sha256()
    with open(long(p), "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()

def main():
    src, dst, exc = sys.argv[1], sys.argv[2], sys.argv[3]
    sample = int(sys.argv[sys.argv.index("--sample") + 1]) if "--sample" in sys.argv else 300
    seed = int(sys.argv[sys.argv.index("--seed") + 1]) if "--seed" in sys.argv else 20261103
    names, abspaths, patterns = load_excludes(exc)
    # the absolute exclusions are written for the SOURCE root; map them onto the destination root too
    abs_dst = {os.path.normcase(os.path.normpath(a.replace(os.path.normcase(os.path.normpath(src)), os.path.normcase(os.path.normpath(dst)), 1))) for a in abspaths}
    S = walk(src, names, abspaths, patterns, src)
    D = walk(dst, names, abspaths | abs_dst, patterns, dst)
    fails = 0
    sb, db = sum(v for v in S.values() if v >= 0), sum(v for v in D.values() if v >= 0)
    print(f"[2] files  src={len(S)}  dst={len(D)}  diff={len(S)-len(D)}")
    print(f"[2] bytes  src={sb}  dst={db}  diff={sb-db}")
    only_s = sorted(set(S) - set(D)); only_d = sorted(set(D) - set(S))
    size_diff = sorted(k for k in set(S) & set(D) if S[k] != D[k])
    for label, lst in (("only in SRC", only_s), ("only in DST", only_d), ("size differs", size_diff)):
        print(f"[2] {label}: {len(lst)}")
        for k in lst[:50]:
            print("      ", k)
    if only_s or only_d or size_diff:
        fails += 1; print("[2] FAIL")
    else:
        print("[2] PASS")
    common = sorted(set(S) & set(D))
    rnd = random.Random(seed)
    picks = set(rnd.sample(common, min(sample, len(common))))
    for k in common:
        if (k.startswith("development") or k.startswith("docs")) and 0 <= S[k] <= 65536:
            picks.add(k)
    bad = []
    for k in sorted(picks):
        try:
            if sha(os.path.join(src, k)) != sha(os.path.join(dst, k)):
                bad.append(k)
        except OSError as e:
            bad.append(f"{k}  ({e})")
    print(f"[3] hashed {len(picks)} files (seed {seed}, sample {sample} + small development/docs files): mismatches {len(bad)}")
    for k in bad[:50]:
        print("      ", k)
    if bad:
        fails += 1; print("[3] FAIL")
    else:
        print("[3] PASS")
    sys.exit(1 if fails else 0)

if __name__ == "__main__":
    main()
