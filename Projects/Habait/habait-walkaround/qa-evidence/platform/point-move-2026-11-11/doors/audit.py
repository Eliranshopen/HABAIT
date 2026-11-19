# audit.py <scenes.json> <out prefix> — every door button of the apartment as a 100° crop of its room picture with a mark where it stands
import sys, json, cv2, numpy as np
sys.path.insert(0, 'C:/Users/elira/AppData/Local/Temp/claude/76e6db1160dffba0/6ebc3d8f-7b16-4880-90d0-725aacae9a04/scratchpad/fly')
import persp
A = 'C:/RnD/Projects/Habait/habait-walkaround/Habait/tour360/apartments/apt846/_local/panos-parquet/'
s = json.load(open(sys.argv[1], encoding='utf8')); out = sys.argv[2]
W, H, HF, P = 500, 300, 100, -12
tx = np.tan(np.radians(HF) / 2); ty = tx * H / W; cp, sp = np.cos(np.radians(P)), np.sin(np.radians(P))
tiles = []; cache = {}
for sc in s['scenes']:
    if sc.get('exterior'): continue
    for h in sc['hotspots']:
        if h['to'] in ('terraceOut',): continue
        yw = (h['u'] - 0.5) * 360
        if sc['asset'] not in cache: cache[sc['asset']] = cv2.imread(A + sc['asset'] + '.webp')
        im = persp.view(cache[sc['asset']], yw, P, HF, W, H)
        pt = np.radians(-12 - min(5, (h.get('v', 0.68) - 0.6) * 35)); v = np.array([0, np.sin(pt), np.cos(pt)])
        y2 = v[1] * cp - v[2] * sp; z2 = v[1] * sp + v[2] * cp; y = int((1 - y2 / z2 / ty) / 2 * H)
        cv2.circle(im, (W // 2, y), 16, (0, 0, 255), 4)
        cv2.rectangle(im, (0, 0), (W, 30), (255, 255, 255), -1); cv2.putText(im, sc['id'] + ' > ' + h['to'] + ' ' + str(int(round(yw))), (6, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.62, (0, 0, 160), 2)
        tiles.append(im)
n = 9
for k in range(0, len(tiles), n):
    part = tiles[k:k + n]
    while len(part) % 3: part.append(np.full((H, W, 3), 255, np.uint8))
    rows = [np.hstack(part[i:i + 3]) for i in range(0, len(part), 3)]
    cv2.imwrite(f'{out}-{k // n + 1}.jpg', np.vstack(rows), [cv2.IMWRITE_JPEG_QUALITY, 82])
print(len(tiles), 'buttons')
