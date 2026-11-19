# refs.py <film dir> <from> <to> — reference views cut from the tour's own pictures at the clay film's first and last camera, plus a
# side-by-side sheet (clay first | picture first ; clay last | picture last). The view maths is the tour's (persp.py).
import sys, json, os, math
import numpy as np, cv2
sys.path.insert(0, 'C:/RnD/Projects/Habait/habait-walkaround/qa-evidence/platform/bird-flight-2026-11-10/stage2'); import persp
F, A, B = sys.argv[1:4]
H = 'C:/RnD/Projects/Habait/habait-walkaround/Habait/tour360/'
asset = {'entrance': '01-entrance', 'kitchen': '02-kitchen', 'dining': '03-dining', 'living': '04-living', 'terraceLiving': '05-terrace-living', 'terraceBedroom': '06-terrace-bedroom', 'bedroomMain': '07-bedroom-main', 'wardrobe': '08-wardrobe', 'bathMain': '09-bath-main', 'bedroom2': '10-bedroom-2', 'bathguest': '11-bath-guest'}
cam = json.load(open(f'{F}/clay-{A}-{B}.mp4.camera.json'))
side = lambda n: json.load(open(f'C:/RnD/Projects/Habait/habait-walkaround/360walkaround/tours/apt846-furnished/renders/cp-{n}/pano.render.json', encoding='utf-8'))['point']['yaw_deg']
def pic(n): return cv2.imread(H + 'dist/apt846/panos-parquet/' + asset[n] + '.webp', cv2.IMREAD_COLOR)
cap = cv2.VideoCapture(f'{F}/clay-{A}-{B}.mp4'); frames = []
while True:
    ok, fr = cap.read()
    if not ok: break
    frames.append(fr)
out = {}
for tag, node, fi in (('first', A, 0), ('last', B, len(frames) - 1)):
    b = cam['frames_at'][fi]['bearing_deg']; yaw_in_pano = ((b - side(node) + 180) % 360) - 180   # the pano's centre faces the node's yaw
    v = persp.view(pic(node), yaw_in_pano, cam['pitch_deg'], cam['hfov_deg'], 1280, 720)
    p = f'{F}/ref-{A}-{B}-{tag}.jpg'; cv2.imwrite(p, v, [cv2.IMWRITE_JPEG_QUALITY, 92]); out[tag] = (frames[fi], v)
# side views of the destination (the room the walk ends in), to pin its look
for k, dy in (('left', -70), ('right', 70)):
    b = cam['frames_at'][-1]['bearing_deg'] + dy; yaw_in_pano = ((b - side(B) + 180) % 360) - 180
    cv2.imwrite(f'{F}/ref-{A}-{B}-end-{k}.jpg', persp.view(pic(B), yaw_in_pano, -4, 85, 1280, 720), [cv2.IMWRITE_JPEG_QUALITY, 92])
mid = frames[len(frames) // 2]
sheet = np.vstack([np.hstack([out['first'][0], out['first'][1]]), np.hstack([mid, np.zeros_like(mid)]), np.hstack([out['last'][0], out['last'][1]])])
cv2.imwrite(f'{F}/sheet-{A}-{B}.jpg', cv2.resize(sheet, (1280, 1080)), [cv2.IMWRITE_JPEG_QUALITY, 85]); print('ok', len(frames), 'frames')
