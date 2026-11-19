"""The blend proof, on frames the real browser painted.
Keyframes: afternoon 15:00, golden 17:00, dusk 18.5, night 21.5 (scene.json). For an in-between hour the viewer must show
(1-t)*A + t*B of its two bracketing keyframes (piecewise-linear cross-fade, the mechanism measured in the reference).
Checks: 16:00 = 0.5*15 + 0.5*17 ; 20:00 = 0.5*18.5 + 0.5*21.5 ; and the frames differ (the slider does something).
Also: the painted pixels are not blank. Writes shots/qa-result.json. Exit 1 on failure."""
import json, os, sys
import numpy as np
from PIL import Image

d = sys.argv[1]
L = lambda n: np.asarray(Image.open(os.path.join(d, n + '.png')).convert('RGB')).astype(float)
res = {"checks": []}
ok = True


def check(name, cond, **kw):
    global ok
    ok &= bool(cond)
    res["checks"].append({"name": name, "pass": bool(cond), **kw})
    print(('PASS ' if cond else 'FAIL ') + name, kw)


for mid, a, b in (("16", "15", "17"), ("20", "18.5", "21.5")):
    M, A, B = L('raw_h' + mid), L('raw_h' + a), L('raw_h' + b)
    pred = 0.5 * A + 0.5 * B
    err = float(np.abs(M - pred).mean())
    w = float(np.linalg.lstsq(np.stack([A.ravel(), B.ravel()], 1), M.ravel(), rcond=None)[0][1])
    diff_ab = float(np.abs(A - B).mean())
    check(f"{mid}:00 is the 50/50 mix of {a} and {b}", err < 1.5 and abs(w - 0.5) < 0.05,
          mean_abs_err_255=round(err, 3), fitted_weight_of_later=round(w, 3), keyframes_differ_by=round(diff_ab, 2))
    check(f"keyframes {a} and {b} differ visibly", diff_ab > 3, mean_abs_diff_255=round(diff_ab, 2))
for n in sorted(os.listdir(d)):
    if n.endswith('.png'):
        a = L(n[:-4])
        check(f"{n} painted (not blank)", a.std() > 10, std=round(float(a.std()), 1), size=list(a.shape[1::-1]))
res["pass"] = bool(ok)
json.dump(res, open(os.path.join(d, 'qa-result.json'), 'w'), indent=1)
sys.exit(0 if ok else 1)
