"""Card 06: which output files of the test build differ from the live outputs (sha256), so exactly those are carried back."""
import hashlib
import os


def tree(root):
    out = {}
    for d, _, fs in os.walk(root):
        for f in fs:
            p = os.path.join(d, f)
            out[os.path.relpath(p, root).replace(os.sep, "/")] = hashlib.sha256(open(p, "rb").read()).hexdigest()
    return out


PAIRS = [
    ("platform dist", r"C:\RnD\.wt\dollhouse-in-tour\run\Projects\Habait\habait-walkaround\Habait\platform\_local\dist\rainbow\846",
     r"C:\RnD\Projects\Habait\habait-walkaround\Habait\platform\_local\dist\rainbow\846"),
    ("tour dist", r"C:\RnD\.wt\dollhouse-in-tour\run\tourout\apt846", r"C:\RnD\Projects\Habait\habait-walkaround\Habait\tour360\dist\apt846"),
]
for name, a, b in PAIRS:
    A, B = tree(a), tree(b)
    diff = sorted(k for k in A if A.get(k) != B.get(k))
    gone = sorted(k for k in B if k not in A)
    print(f"{name}: {len(A)} files vs live {len(B)} | differ/new: {diff} | only live: {gone[:10]}")
