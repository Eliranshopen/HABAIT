"""The blend proof on frames the real browser painted: for each pair in <shots>/pairs.json the midpoint frame must equal
0.5*A + 0.5*B (mean error < 1.5/255, fitted weight 0.5 +- 0.05), A and B must differ (> 3/255), no shot blank.
python -I analyse.py <shots dir>  -> qa-result.json, exit 1 on failure."""
import json, os, sys
import numpy as np
from PIL import Image

d = sys.argv[1]
L = lambda n: np.asarray(Image.open(os.path.join(d, n + '.png')).convert('RGB')).astype(float)
res = {"checks": []}; ok = True


def check(name, cond, **kw):
    global ok
    ok &= bool(cond); res["checks"].append({"name": name, "pass": bool(cond), **kw})
    print(('PASS ' if cond else 'FAIL ') + name, kw)


for p in json.load(open(os.path.join(d, 'pairs.json'))):
    A, M, B = L(p['a']), L(p['mid']), L(p['b'])
    err = float(np.abs(M - (0.5 * A + 0.5 * B)).mean())
    w = float(np.linalg.lstsq(np.stack([A.ravel(), B.ravel()], 1), M.ravel(), rcond=None)[0][1])
    dab = float(np.abs(A - B).mean())
    check(f"{p['mid']} = 50/50 of {p['a']} and {p['b']}", err < 1.5 and abs(w - 0.5) < 0.05, err_255=round(err, 3), weight=round(w, 3))
    check(f"{p['a']} and {p['b']} differ", dab > 3, diff_255=round(dab, 2))
for n in sorted(os.listdir(d)):
    if n.endswith('.png'):
        a = L(n[:-4]); check(f"{n} painted", a.std() > 10, std=round(float(a.std()), 1))
res["pass"] = bool(ok)
json.dump(res, open(os.path.join(d, 'qa-result.json'), 'w'), indent=1)
sys.exit(0 if ok else 1)
