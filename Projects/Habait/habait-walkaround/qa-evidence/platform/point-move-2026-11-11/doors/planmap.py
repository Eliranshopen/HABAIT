import json, cv2, numpy as np, sys
A = 'C:/RnD/Projects/Habait/habait-walkaround/Habait/tour360/apartments/apt846/'
out = sys.argv[1]
c = json.load(open(A + 'cameras.json', encoding='utf8')); s = json.load(open(A + 'scenes.json', encoding='utf8'))
im = cv2.imread(A + '_local/plan/plan-crop.png')
if im is None:
    p = cv2.imread(A + 'plan/floorplan.webp'); im = cv2.resize(p, (3750, 3900))
byid = {x['id']: x for x in c['scenes']}
cols = [(0, 0, 255), (0, 140, 255), (0, 200, 0), (255, 0, 0), (255, 0, 255), (160, 0, 160), (0, 160, 160), (90, 90, 255), (40, 120, 40), (200, 120, 0), (0, 0, 120)]
for i, x in enumerate(c['scenes']):
    col = cols[i % len(cols)]; a = tuple(int(v) for v in x['at'])
    cv2.circle(im, a, 26, col, -1); cv2.putText(im, x['id'], (a[0] + 30, a[1] - 14), cv2.FONT_HERSHEY_SIMPLEX, 1.6, col, 4)
    la = x['lookAt']; d = np.array(la) - np.array(x['at']); d = d / (np.linalg.norm(d) + 1e-6) * 110
    cv2.arrowedLine(im, a, (int(a[0] + d[0]), int(a[1] + d[1])), col, 5, tipLength=0.4)
    for l in x.get('links', []):
        v = tuple(int(t) for t in l['via']); cv2.line(im, a, v, col, 4); cv2.drawMarker(im, v, col, cv2.MARKER_TILTED_CROSS, 40, 6)
        cv2.putText(im, '>' + l['to'], (v[0] + 12, v[1] + 34), cv2.FONT_HERSHEY_SIMPLEX, 1.0, col, 3)
cv2.imwrite(out, cv2.resize(im, (1500, 1560)), [cv2.IMWRITE_JPEG_QUALITY, 88])
print('ok')
