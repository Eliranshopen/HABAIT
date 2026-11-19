"""fly2.py — bird-flight stage 2 (Eliran 2026-11-10 «כן», cap $10): the entry segment of 846 re-made by Kling v2v on the SAME clay path,
with today's living room (perspective views of the shipped parquet panorama) as the look.
  python fly2.py <take name> [--go]         dry by default; --go pays. Takes are booked in <OUT>/ledger.json BEFORE the call (worst case),
                                            and the script refuses when booked + this take > CAP.
"""
import sys, os, json, subprocess, datetime
HAB = 'C:/RnD/Projects/Habait/habait-walkaround/Habait'
sys.path.insert(0, HAB + '/engine/video'); import kling_v2v as K
F = os.path.dirname(os.path.abspath(__file__)).replace('\\', '/'); OUT = F + '/stage2'; os.makedirs(OUT, exist_ok=True)
CAP = 10.0; T0, DUR = 8.375, 6.0        # clay frames 201.. (the entry), 6 s
take = sys.argv[1]; go = '--go' in sys.argv
clay = OUT + '/clay-enter-6s.mp4'
if not os.path.exists(clay):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(T0), '-i', HAB + '/studio/_local/projects/apt846-rainbow-tlv/renders/clay/ext-flight-full/clay.mp4', '-t', str(DUR), '-an', '-r', '24', '-c:v', 'libx264', '-crf', '14', '-pix_fmt', 'yuv420p', clay], check=True)
PANO = HAB + '/tour360/apartments/apt846/_local/panos-parquet/04-living.webp'
views = [('in', 180, 95), ('tv', 95, 95), ('kitchen', -115, 95)]
refs = [HAB + '/platform/_local/segments/rainbow-cine/enter-846.first.jpg']
for n, yaw, hf in views:
    p = f'{OUT}/ref-{n}.jpg'
    if not os.path.exists(p): subprocess.run([sys.executable, F + '/persp.py', PANO, p, str(yaw), '-2', str(hf)], check=True)
    refs.append(p)
PROMPT = (
    "@Video1 is a plain grey 3D clay render of ONE continuous 6-second shot: the camera glides from the terrace of a 16th-floor apartment through its open "
    "glass sliding door and travels into the living room, ending in the middle of the room looking at the far wall with the front door. "
    "Re-render the SAME footage as a photoreal architectural visualization: keep every frame's camera motion, perspective and horizon, every wall, column, "
    "opening, door, the slider frames and every piece of furniture exactly where @Video1 draws them; only replace the clay materials with real ones. "
    "Nothing static may change shape, count or position between frames. "
    "@Image1 is the real look of the FIRST frame: the terrace, its glass railing and the slim black-framed floor-to-ceiling glazing (use it for the terrace and the "
    "glazing only; the room behind the glass follows @Image2, @Image3 and @Image4). "
    "@Image2 is the real look of the living room as seen looking in from the terrace side, the view the shot ends on: a pale natural oak parquet floor of long planks; "
    "warm white plastered walls that meet the floor directly with NO skirting board; a plain WHITE flush zero-line front door with a slim black lever and the same white "
    "flush interior doors, no frames; a small light-oak console with a framed print above it beside the front door; flat white ceiling with small recessed spots. "
    "@Image3 is the wall on the LEFT of the shot: a greige textured plaster wall with a wall-mounted black TV above a long low sand-grey floating unit. "
    "@Image4 is the RIGHT side of the shot: a handleless sand-grey kitchen with a lit open shelf, a built-in black oven and a tall fridge cabinet. "
    "The furniture is cream boucle: a low sofa with beige cushions and a round swivel armchair; pale travertine coffee table. "
    "Soft bright morning daylight, neutral white, consistent exposure throughout. Smooth, continuous, no cuts, no text, no people, no watermark."
)
usd = K.estimate_usd(DUR, DUR, '720p')
lp = OUT + '/ledger.json'; L = json.load(open(lp, encoding='utf8')) if os.path.exists(lp) else []
booked = round(sum(e['usd'] for e in L), 2)
print(json.dumps({'take': take, 'go': go, 'estimate_usd': usd, 'booked_usd': booked, 'cap_usd': CAP, 'clay': clay, 'refs': refs, 'prompt_chars': len(PROMPT)}, indent=1))
if not go: sys.exit(0)
if booked + usd > CAP: print('REFUSED: over the cap'); sys.exit(2)
L.append({'at': datetime.datetime.now().isoformat(timespec='seconds'), 'take': take, 'endpoint': K.ENDPOINT, 'usd': usd, 'state': 'booked before the call'}); json.dump(L, open(lp, 'w', encoding='utf8'), indent=1)
class Be(K.FalBackend):          # urllib has no CA bundle in this Python (take t1 was paid and lost at the download): fetch with httpx, as fal_client does
    def download(self, url, dst):
        import httpx
        with httpx.stream('GET', url, timeout=600, follow_redirects=True) as r:
            r.raise_for_status()
            with open(dst, 'wb') as f:
                for chunk in r.iter_bytes(1 << 20): f.write(chunk)
def submitted(rid):
    L[-1]['request_id'] = rid; L[-1]['state'] = 'submitted'; json.dump(L, open(lp, 'w', encoding='utf8'), indent=1); print('submitted', rid, flush=True)
rec = K.run(clay, refs, PROMPT, f'{OUT}/{take}', resolution='720p', duration=None, on_submit=submitted, backend=Be())
L[-1]['state'] = 'done'; L[-1]['request_id'] = rec['request_id']; L[-1]['secs'] = rec['secs']; json.dump(L, open(lp, 'w', encoding='utf8'), indent=1)
print('done', f'{OUT}/{take}/real.mp4', rec['secs'], 's; booked total $', round(booked + usd, 2))
