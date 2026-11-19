p = "scripts/04_geometry.py"
s = open(p, encoding="utf-8").read()
rep = [
 ('hinge="n", swing="in", leaf_cm=92,', 'hinge="n", swing="in", swing_dir="e", open_deg=0, leaf_cm=92,'),
 ('hinge="e", swing="out_to_hall", leaf_cm=78,', 'hinge="e", swing="out_to_hall", swing_dir="s", open_deg=172, leaf_cm=78,'),
 ('hinge="s", swing="into_bedroom", leaf_cm=76)', 'hinge="s", swing="into_bedroom", swing_dir="e", open_deg=90, leaf_cm=76)'),
 ('hinge="n", swing="into_bath", leaf_cm=76)', 'hinge="n", swing="into_bath", swing_dir="w", open_deg=90, leaf_cm=76)'),
]
for a, b in rep:
    assert a in s, a
    s = s.replace(a, b)
open(p, "w", encoding="utf-8", newline="\n").write(s)
