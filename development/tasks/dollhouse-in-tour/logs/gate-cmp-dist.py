import os, hashlib, json
A = 'C:/RnD/Projects/Habait/habait-walkaround/Habait/tour360/dist/apt846'
B = 'C:/RnD/.wt/dollhouse-in-tour/run/tourout/apt846'
def walk(r):
    d = {}
    for dp, _, fs in os.walk(r):
        for f in fs:
            p = os.path.join(dp, f)
            d[os.path.relpath(p, r).replace(chr(92), '/')] = p
    return d
a = walk(A); b = walk(B)
h = lambda p: hashlib.sha256(open(p, 'rb').read()).hexdigest()
print('files live/new', len(a), len(b))
print('only live', sorted(set(a) - set(b))[:10])
print('only new', sorted(set(b) - set(a))[:10])
dif = [k for k in a if k in b and h(a[k]) != h(b[k])]
print('content differs', dif[:30], len(dif))
