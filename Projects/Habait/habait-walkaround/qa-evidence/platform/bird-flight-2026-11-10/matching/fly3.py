"""fly3.py — bird-flight, the MATCHING entry (Eliran 2026-11-10: «הסרטון ממש שונה מאיך שהסלון נראה בהדמיה … זה בולט»; answer «2»).
Same call as fly2.py (Kling v2v on the 6 s clay of the entry) but the look is pinned to the tour's own living room:
 - @Image1 = the old terrace frame with the room behind the glass MASKED grey (in take t2 the old room in that frame pulled the sofa, rug and throw of 11-02 back in);
 - five views of the shipped parquet panorama, including the sofa / rug / coffee table from above and the armchair + floor.
  python fly3.py <take> [--go]     dry by default; booked in stage2/ledger.json before the call; refuses over CAP.
"""
import sys, os, json, subprocess, datetime
HAB = 'C:/RnD/Projects/Habait/habait-walkaround/Habait'
sys.path.insert(0, HAB + '/engine/video'); import kling_v2v as K
F = os.path.dirname(os.path.abspath(__file__)).replace('\\', '/'); OUT = F + '/stage2'
CAP = 10.0; DUR = 6.0
take = sys.argv[1]; go = '--go' in sys.argv
clay = OUT + '/clay-enter-6s.mp4'
PANO = HAB + '/tour360/apartments/apt846/_local/panos-parquet/04-living.webp'
masked = OUT + '/ref-terrace-masked.jpg'
if not os.path.exists(masked):
    import cv2
    im = cv2.imread(HAB + '/platform/_local/segments/rainbow-cine/enter-846.first.jpg'); im[75:490, 20:1010] = (128, 128, 128); cv2.imwrite(masked, im, [cv2.IMWRITE_JPEG_QUALITY, 92])
views = [('in', 180, -2, 95), ('tv', 95, -2, 95), ('kitchen', -115, -2, 95), ('sofa', -5, -30, 100), ('floor-in', 180, -30, 100)]
refs = [masked]
for n, yaw, pitch, hf in views:
    p = f'{OUT}/ref-{n}.jpg'
    if not os.path.exists(p): subprocess.run([sys.executable, F + '/persp.py', PANO, p, str(yaw), str(pitch), str(hf)], check=True)
    refs.append(p)
PROMPT = (
    "@Video1 is a plain grey 3D clay render of ONE continuous 6-second shot: the camera glides from the terrace of a 16th-floor apartment through its open "
    "glass sliding door and travels into the living room, ending in the middle of the room looking at the far wall with the front door. "
    "Re-render the SAME footage as a photoreal architectural visualization: keep every frame's camera motion, perspective and horizon, every wall, column, "
    "opening, door, the slider frames and every piece of furniture exactly where @Video1 draws them; only replace the clay materials with real ones. "
    "Nothing static may change shape, count or position between frames. "
    "The room must look EXACTLY like the real room photographed in @Image2 to @Image6; copy its furniture, colours and materials, and add nothing that is not in them. "
    "@Image1 shows only the terrace of the FIRST frame: the pale stone terrace floor, the glass railing with its pale handrail and the slim black-framed "
    "floor-to-ceiling sliding glazing with sheer cream curtains. The flat grey rectangle in @Image1 is a blank placeholder, not a wall: there the room is seen through the glass, and it follows @Image2 to @Image6. "
    "@Image2 is the view the shot ends on: a pale natural oak parquet floor of long straight planks; warm white plastered walls; a plain WHITE flush front door with a small "
    "black lever and the same white flush interior doors; a small light-oak console with a ceramic vase of green fern and a framed beige abstract print above it, beside the front door; "
    "a flat white ceiling with a few small recessed spots. "
    "@Image3 is the wall on the LEFT of the shot: a greige textured plaster wall with a wall-mounted black TV above a long low sand-grey floating unit; a floor lamp with a cream drum shade by the curtain. "
    "@Image4 is the RIGHT side of the shot: a handleless sand-grey kitchen with a lit open shelf of ceramics, a built-in black oven and a tall cabinet. "
    "@Image5 shows the seating from above: a low modular cream boucle sofa with a chaise end and beige-and-cream square cushions, NO blanket and NO throw on it; in front of it a low OVAL pale "
    "travertine coffee table carrying two books, a small stone bowl and a white vase of green fern; under them a pale CREAM textured RECTANGULAR rug (not round, not jute, not brown). "
    "@Image6 shows the round cream boucle swivel armchair standing on the bare parquet, and the floor near the front door. "
    "There is no round rug, no jute rug, no blanket, no extra plants and no extra furniture anywhere. "
    "Soft bright hazy morning daylight, neutral white, consistent exposure throughout. Smooth, continuous, no cuts, no text, no people, no watermark."
)
usd = K.estimate_usd(DUR, DUR, '720p')
lp = OUT + '/ledger.json'; L = json.load(open(lp, encoding='utf8')) if os.path.exists(lp) else []
booked = round(sum(e['usd'] for e in L), 2)
print(json.dumps({'take': take, 'go': go, 'estimate_usd': usd, 'booked_usd': booked, 'cap_usd': CAP, 'refs': [os.path.basename(r) for r in refs], 'prompt_chars': len(PROMPT)}, indent=1))
if not go: sys.exit(0)
if booked + usd > CAP: print('REFUSED: over the cap'); sys.exit(2)
L.append({'at': datetime.datetime.now().isoformat(timespec='seconds'), 'take': take, 'endpoint': K.ENDPOINT, 'usd': usd, 'state': 'booked before the call'}); json.dump(L, open(lp, 'w', encoding='utf8'), indent=1)
class Be(K.FalBackend):          # urllib has no CA bundle in this Python (take t1 was paid and lost at the download): fetch with httpx
    def download(self, url, dst):
        import httpx
        with httpx.stream('GET', url, timeout=600, follow_redirects=True) as r:
            r.raise_for_status()
            with open(dst, 'wb') as f:
                for chunk in r.iter_bytes(1 << 20): f.write(chunk)
def submitted(rid):
    L[-1]['request_id'] = rid; L[-1]['state'] = 'submitted'; json.dump(L, open(lp, 'w', encoding='utf8'), indent=1); print('submitted', rid, flush=True)
rec = K.run(clay, refs, PROMPT, f'{OUT}/{take}', resolution='720p', duration=None, on_submit=submitted, backend=Be())
L[-1]['state'] = 'done'; L[-1]['secs'] = rec['secs']; json.dump(L, open(lp, 'w', encoding='utf8'), indent=1)
print('done', f'{OUT}/{take}/real.mp4', rec['secs'], 's; booked total $', round(booked + usd, 2))
