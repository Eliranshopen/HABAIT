# Re-copies the working copies of hold/index.html + app.js over a staged test build, with stage_flow.py's URL rewrite (lines 111-112). Idempotent.
# usage: python -X utf8 -I rebuild-run.py <staged folder> [<source folder>]   (source default = the working folder copies)
import sys, os, hashlib
R = sys.argv[1]
W = sys.argv[2] if len(sys.argv) > 2 else r"C:\RnD\.wt\hold-building-tour\files\Projects\Habait\research\fal-bench-2026-11-02\flyover3d"
subs = [("http%3A%2F%2F127.0.0.1%3A8850", ""), ("http%3A%2F%2F127.0.0.1%3A8899", "%2Fhold"), ("http%3A%2F%2F127.0.0.1%3A8848", "%2Ftour"),
        ("http://127.0.0.1:8850", ""), ("http://127.0.0.1:8899", "/hold"), ("http://127.0.0.1:8848", "/tour")]
for f in ("index.html", "app.js"):
    t = open(os.path.join(W, f), encoding="utf-8", newline="").read()
    for a, b in subs: t = t.replace(a, b)
    d = os.path.join(R, "hold", f)
    open(d, "w", encoding="utf-8", newline="").write(t)
    print(f, hashlib.sha256(open(d, "rb").read()).hexdigest()[:16])
